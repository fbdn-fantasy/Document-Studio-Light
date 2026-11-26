'use strict';
// Tauri owns windows, lifecycle and native dialogs. This bundled Node service
// retains the mature dictionary and document storage engines; no Electron.
const readline=require('node:readline');
// Keep Node alive while the unref'd dictionary worker initializes. Leave stdin
// paused so early Tauri requests stay buffered until readline is listening.
const startupHold=setInterval(()=>{},1000);
let nativeId=0;const nativePending=new Map();
const send=value=>process.stdout.write(JSON.stringify(value,(_k,v)=>v instanceof Uint8Array?Array.from(v):v)+'\n');
function native(method,args=[]){return new Promise((resolve,reject)=>{const id=++nativeId;nativePending.set(id,{resolve,reject});send({native:id,method,args});});}
const win={webContents:{send:(event,payload)=>send({event:event.replace('fte:',''),payload})},setTitle:title=>native('title',[title]).catch(()=>{})};
const dialog={showOpenDialog:(_w,opts)=>native('open',[opts]),showSaveDialog:(_w,opts)=>native('save',[opts]),showMessageBox:(_w,opts)=>native('confirm',[opts])};
const app={getPath:name=>name==='userData'?process.argv[2]:require('node:os').homedir()+'/Documents'};
const nativeTheme=null;
const crypto=require('node:crypto');
const idFor=file=>crypto.createHash('sha256').update(file).digest('hex');
const fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL,fileURLToPath}=require('node:url');
const {Store,atomicWrite}=require('./storage.cjs');
const {DictionaryClient}=require('./dictionary-client.cjs');
const {ImportManager,IMPORT_EXT}=require('./import-manager.cjs');
const resourceRoot=__dirname;
const importer=new ImportManager(resourceRoot,message=>win?.webContents.send('fte:import-progress',message));
let store,settings={},current=null,pending=null,externalFile=null,changed=false,closing=false;
const allowed=/\.(json|enc|docx|odt|txt|rtf|html|htm|md|markdown|pdf|png|jpe?g|webp|bmp|tiff?)$/i;
function argumentFile(args){for(let p of args){try{if(p.startsWith('file://'))p=fileURLToPath(p);}catch{continue;}if(allowed.test(p)&&path.isAbsolute(p))return p;}return null;}
const startup=argumentFile(process.argv.slice(3));
const handlers=new Map();function register(name,fn){handlers.set(name,fn);}
async function persist(){await store.config(settings);}
async function choose(name){const ext=path.extname(name).slice(1);const r=await dialog.showSaveDialog(win,{defaultPath:path.join(settings.folder||app.getPath('documents'),path.basename(name)),filters:ext?[{name:ext.toUpperCase()+' document',extensions:[ext]}]:undefined});if(r.canceled)return null;settings.folder=path.dirname(r.filePath);await persist();return r.filePath;}
async function remember(file){settings.recents=[file,...(settings.recents||[]).filter(x=>x!==file)].slice(0,12);settings.folder=path.dirname(file);await persist();}
async function writeDocument(target,body){
 await atomicWrite(target,body);
 if(current!==target){
  await store.setPendingRecovery();
  await remember(target);
  current=target;
 }
 return {name:path.basename(target),id:idFor(target)};
}
function validateBody(body){if(typeof body!=='string'||body.length>200*1024*1024)throw Error('Project is too large');const s=JSON.parse(body);if(!['ForbiddenStudio','ForbiddenTextEditorEncrypted'].includes(s.format))throw Error('Invalid project');return s;}
async function openFile(file){if(!file){const r=await dialog.showOpenDialog(win,{defaultPath:settings.folder||app.getPath('documents'),properties:['openFile'],filters:[{name:'Documents and document images',extensions:['json','enc','docx','odt','txt','rtf','html','htm','md','markdown','pdf','png','jpg','jpeg','webp','bmp','tif','tiff']}]});if(r.canceled)return null;file=r.filePaths[0];}if(!allowed.test(file))throw Error('Unsupported file');if(IMPORT_EXT.test(file)){pending=null;return importer.select([file]);}const stat=await fs.stat(file);if(stat.size>200*1024*1024)throw Error('File is too large');const bytes=await fs.readFile(file);pending=file;return {name:path.basename(file),id:idFor(file),bytes:new Uint8Array(bytes)};}

async function start(){
 store=new Store(app.getPath('userData'));settings=await store.config();
 const recoveryAvailable=await store.pendingRecovery();
 const dictionaries=new DictionaryClient(path.join(app.getPath('userData'),'dictionaries'));
 try{await dictionaries.select(settings.dictionary||'en-US');}catch{await dictionaries.select('en-US');}
 let dictionaryQueue=Promise.resolve();
  register('analyzeCJK',(language,text)=>dictionaries.analyzeCJK(language,text));
 register('addPersonal',(language,word)=>dictionaries.addPersonal(language,word));
 register('suggestCJK',(language,text)=>dictionaries.suggestCJK(language,text));
 register('spellSuggestions',word=>typeof word==='string'&&word.length<100?dictionaries.suggest(word):[]);
 register('spell',words=>{if(!Array.isArray(words))return [];return dictionaries.check(words.slice(0,5000).filter(w=>typeof w==='string'&&w.length<100));});
 register('dictionaries',async()=>({items:await dictionaries.list(),active:dictionaries.active}));
 register('dictionary',id=>{const task=dictionaryQueue.then(async()=>{await dictionaries.select(id);settings.dictionary=id;await persist();win.webContents.send('fte:dictionary',id);return id;});dictionaryQueue=task.catch(()=>{});return task;});
 register('importDictionary',async()=>{const a=await dialog.showOpenDialog(win,{title:'Choose Hunspell .aff file',properties:['openFile'],filters:[{name:'Hunspell rules',extensions:['aff']}]});if(a.canceled)return null;const d=await dialog.showOpenDialog(win,{title:'Choose the matching .dic file',defaultPath:path.dirname(a.filePaths[0]),properties:['openFile'],filters:[{name:'Hunspell dictionary',extensions:['dic']}]});if(d.canceled)return null;return dictionaries.install(await fs.readFile(a.filePaths[0]),await fs.readFile(d.filePaths[0]),path.basename(d.filePaths[0],'.dic'));});
 register('fonts',()=>new Promise(resolve=>{if(process.platform!=='linux')return resolve([]);require('node:child_process').execFile('fc-list',['--format','%{family}\n'],{timeout:5000,maxBuffer:2*1024*1024},(err,out)=>resolve(err?[]:[...new Set(out.split(/[\n,]/).map(x=>x.trim()).filter(Boolean))].sort()));}));
 register('ackRecovery',()=>store.setPendingRecovery());
 register('init',()=>({settings,startup:!!startup,recoveryAvailable}));
 // Private host-only message; deliberately absent from the webview allowlist.
 register('externalOpen',args=>{const file=argumentFile(args);if(file){externalFile=file;win.webContents.send('fte:command','external-open');}return true;});
 register('open',async mode=>openFile(mode==='startup'?startup:mode==='external'?externalFile:null));
 register('chooseImport',async()=>{const result=await dialog.showOpenDialog(win,{title:'Import PDF or document images',defaultPath:settings.folder||app.getPath('documents'),properties:['openFile','multiSelections'],filters:[{name:'PDF and document images',extensions:['pdf','png','jpg','jpeg','webp','bmp','tif','tiff']}]});if(result.canceled)return null;pending=null;return importer.select(result.filePaths);});
 register('runImport',token=>importer.run(token));
 register('cancelImport',()=>importer.cancel());
 register('importHealth',()=>importer.health());
 register('documentInfo',()=>({path:current||'',name:current?path.basename(current):''}));
 register('commitOpen',async(native,expectedId)=>{
  const target=native?pending:null;
  if(native&&(!target||idFor(target)!==expectedId))throw Error('The selected file changed. Open it again.');
  if(target)await remember(target);
  await store.setPendingRecovery();
  current=target;
  if(pending===target||!native)pending=null;
  return {id:current?idFor(current):null};
 });
 register('save',async({body,name,saveAs=false})=>{const s=validateBody(body);let target=current;if(saveAs||!target||!(/\.(json|enc)$/i.test(target)))target=await choose(name);if(!target)return {canceled:true};const encrypted=s.format==='ForbiddenTextEditorEncrypted';
  const extension=path.extname(target).toLowerCase();
  if(extension!==(encrypted?'.enc':'.json'))throw Error('Use Save As and a filename ending in '+(encrypted?'.fte.enc':'.fte.json')+'.');
  return writeDocument(target,body);});
 register('saveDocument',async({bytes,name,format,saveAs=false})=>{
 const formats={docx:['docx'],odt:['odt'],txt:['txt'],rtf:['rtf'],md:['md','markdown'],html:['html','htm'],pdf:['pdf']};
 if(!formats[format])throw Error('Unsupported document format');
 let target=current;
 if(saveAs||!target||!formats[format].includes(path.extname(target).slice(1).toLowerCase()))target=await choose(name);
 if(!target)return {canceled:true};
 if(!formats[format].includes(path.extname(target).slice(1).toLowerCase()))throw Error('The filename must end in .'+formats[format][0]);
 const data=Buffer.from(bytes);
 if(data.length>200*1024*1024)throw Error('Document is too large');
 return writeDocument(target,data);
 });
 register('export',async({bytes,name})=>{const f=await choose(name);if(!f)return false;await atomicWrite(f,Buffer.from(bytes));return true;});
 register('pdfBytes',async bytes=>bytes);
 register('pdf',async (name,bytes)=>{const f=await choose(name);if(!f)return false;const data=Buffer.from(bytes);await atomicWrite(f,data);return true;});
 register('snapshot',async({id,body,recoverable=false})=>{validateBody(body);const name=await store.snapshot(id,body);if(recoverable===true&&!current)await store.setPendingRecovery({id,name});return name;});
 register('recoveries',(interrupted=false)=>interrupted?store.interruptedDraft():store.list());register('recover',({id,name})=>store.get(id,name));
 register('settings',async value=>{if(typeof value.autosave==='boolean')settings.autosave=value.autosave;if(Number.isInteger(value.autosaveDelayMs)&&value.autosaveDelayMs>=0&&value.autosaveDelayMs<=86400000)settings.autosaveDelayMs=value.autosaveDelayMs;if(['system','original','light','dark'].includes(value.theme)){settings.theme=value.theme;if(nativeTheme)nativeTheme.themeSource=value.theme==='original'?'dark':value.theme;}await persist();return settings;});
 register('confirm',async()=>{const r=await dialog.showMessageBox(win,{type:'question',buttons:['Save','Discard changes','Cancel'],defaultId:0,cancelId:2,message:'Save changes before continuing?'});return r.response;});
 register('dirty',value=>{changed=!!value;win.setTitle((changed?'● ':'')+'Document Studio Light');});
 register('recent',async index=>{if(index===undefined)return settings.recents||[];const f=(settings.recents||[])[index];if(!f)throw Error('Recent file unavailable');return openFile(f);});
 register('close',async()=>{await importer.cancel();await store.setPendingRecovery();await persist();closing=true;return true;});

 const input=readline.createInterface({input:process.stdin});
 input.on('line',async line=>{let m;try{m=JSON.parse(line);if(m.nativeReply){const p=nativePending.get(m.nativeReply);if(p){nativePending.delete(m.nativeReply);m.error?p.reject(Error(m.error)):p.resolve(m.result);}return;}
 const fn=handlers.get(m.method);if(!fn)throw Error('Unsupported desktop command: '+m.method);
 const result=await fn(...(m.args||[]));send({id:m.id,result:result??null});
 }catch(e){send({id:m?.id,error:e.message});}});
 input.on('close',()=>{importer.cancel().finally(()=>process.exit());});
 send({ready:true});clearInterval(startupHold);
}
start().catch(e=>{process.stderr.write(e.stack+'\n');process.exit(1);});
