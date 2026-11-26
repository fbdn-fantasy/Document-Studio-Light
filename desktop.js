/* Native integration; the original editor engine remains in editor.html. */
'use strict';
(async()=>{
const api=window.desktop;if(!api)return;
const init=await api.init();let auto=init.settings.autosave!==false,projectId=crypto.randomUUID(),password=null,timer=null,recoveryTimer=null,busy=false,loading=false,revision=0,queue=Promise.resolve(),lastSnapshot='',lastSnapshotRecoverable=null,hasFile=false,currentFormat=null;
const delaySetting=init.settings.autosaveDelayMs;
let delayMs=Number.isInteger(delaySetting)&&delaySetting>=0&&delaySetting<=86400000?delaySetting:0;
let scheduled=false,editedDraft=false;
const ui=ribbons.File;
const autoLabel=document.createElement('label');autoLabel.style.cssText='display:inline-flex;align-items:center;gap:6px;margin-left:8px';autoLabel.innerHTML='<input id="desktop-auto" type="checkbox"> Autosave';ui.append(autoLabel);
const statusNode=document.createElement('span');statusNode.id='desktop-status';statusNode.setAttribute('role','status');statusNode.setAttribute('aria-live','polite');statusNode.textContent='Ready';statusNode.style.cssText='margin-left:auto;font-size:12px;color:var(--muted)';$('statusbar').append(statusNode);
const status=text=>{statusNode.textContent=text;};$('desktop-auto').checked=auto;
$('file-actions').querySelectorAll('button').forEach(b=>b.remove());
const run=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
const fail=e=>{status('Action failed: '+e.message);say(e.message);};
$('doc-name').addEventListener('input',()=>checkpoint());
function resetHistory(){history=[JSON.stringify(state())];hi=0;}
function scheduleDraft(){
 clearTimeout(recoveryTimer);clearTimeout(timer);
 if(!dirty||loading||(hasFile?!auto:!editedDraft))return;
 const id=projectId;
 const flush=()=>{
  if(scheduled)return;
  scheduled=true;
  run(async()=>{
   scheduled=false;
   if(!dirty||loading)return;
   if(projectId!==id){scheduleDraft();return;}
   if(!hasFile)await snapshot(await bodyFor(),true);
   else if(auto)await saveNow(false);
  }).catch(fail);
 };
 // A slow export can have one follow-up queued. Its state is read when it runs.
 if(hasFile)timer=setTimeout(flush,delayMs);
 else recoveryTimer=setTimeout(flush,0);
}
function mark(edited=true){if(loading)return;if(!hasFile)editedDraft=edited;revision++;dirty=true;api.dirty(true);status('Unsaved changes');scheduleDraft();}
checkpoint=function(){
 const v=JSON.stringify(state());
 if(!window.FTEControls?.sameState(history[hi],v)){
  history=history.slice(0,hi+1);history.push(v);if(history.length>80)history.shift();hi=history.length-1;
  mark();
 }
 if(ready){updateStats();if(activePanel==='Navigation')renderSide();}
};
persistVersions=function(){if(loading)return;const captured=state(),pass=password,id=projectId;run(async()=>api.snapshot({id,body:await bodyFor(captured,pass)})).catch(fail);};
const originalUndo=undo;undo=function(d){const before=hi;originalUndo(d);if(before!==hi)mark();};
async function bodyFor(s=state(),pass=password){return pass?(await encryptedBlob(s,pass)).text():JSON.stringify(s);}
async function snapshot(body,recoverable=false){body=body||await bodyFor();if(body===lastSnapshot&&recoverable===lastSnapshotRecoverable)return;await api.snapshot({id:projectId,body,recoverable});lastSnapshot=body;lastSnapshotRecoverable=recoverable;}
const formatOf=name=>({markdown:'md',htm:'html',json:'project',enc:'encrypted'}[name.split('.').pop().toLowerCase()]||name.split('.').pop().toLowerCase());
// A shared dialog may reopen before the browser dispatches its old close event.
function promptResult(render){
 return new Promise(resolve=>{
  const finish=value=>{
   closeButton.removeEventListener('click',dismiss);
   dialog.removeEventListener('cancel',dismiss);
   dialog.removeEventListener('close',closed);
   resolve(value);
  };
  const dismiss=()=>finish(null),closed=()=>{if(!dialog.open)dismiss();};
  const dialog=render(finish),closeButton=dialog.querySelector('.dialog-actions button');
  closeButton.addEventListener('click',dismiss);
  dialog.addEventListener('cancel',dismiss);
  dialog.addEventListener('close',closed);
 });
}
function chooseFormat(initial=currentFormat||'docx'){
 return promptResult(finish=>{
  const formats=[['docx','Word (.docx)'],['odt','OpenDocument (.odt)'],['pdf','PDF (.pdf)'],['txt','Plain text (.txt)'],['rtf','Rich Text (.rtf)'],['md','Markdown (.md)'],['html','HTML (.html)'],['project','Editable native project (.fte.json)']];
  const options=formats.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('');
  const dialog=modal('Save As','<label>Format <select id="export-format">'+options+'</select></label>',[
   ['Save',d=>{finish($('export-format').value);d.close();}]
  ]);
  $('export-format').value=initial==='encrypted'?'project':initial;
  return dialog;
 });
}
async function saveNow(manual=true,saveAs=false,pass=password,format=null){
 if(loading||(!manual&&(!hasFile||!auto||!dirty)))return false;
 clearTimeout(timer);clearTimeout(recoveryTimer);
 if(dirty&&!hasFile&&editedDraft)await snapshot(await bodyFor(),true);
 if(manual&&!hasFile&&!format&&!pass){format=await chooseFormat();if(!format){status('Save canceled');scheduleDraft();return false;}saveAs=true;}
 const fmt=format||(pass?'encrypted':currentFormat||'docx');
 if(manual&&window.FTEPro?.confirmExport&&!await FTEPro.confirmExport(fmt)){status('Save canceled');scheduleDraft();return false;}
 const rev=revision,s=state(),body=await bodyFor(s,pass);
 status('Saving…');
 let result;
 if(fmt==='project'||fmt==='encrypted')result=await api.save({body,name:filename()+(pass?'.fte.enc':'.fte.json'),saveAs});
 else if(fmt==='pdf'){layout();updatePrintStyle();await Promise.all([...pages.querySelectorAll('img')].map(i=>i.decode().catch(()=>{})));result=await api.saveDocument({format:fmt,name:filename()+'.pdf',saveAs});}
 else result=await originalExport(fmt,false,async(blob,name)=>api.saveDocument({bytes:new Uint8Array(await blob.arrayBuffer()),format:fmt,name,saveAs}),!manual);
 if(!result||result.canceled){status('Save canceled');scheduleDraft();return false;}
 if(projectId!==result.id||pass!==password)lastSnapshot='';
 hasFile=true;editedDraft=false;currentFormat=fmt;projectId=result.id;password=pass;locked=!!pass;
 if(revision===rev){dirty=false;await api.dirty(false);status('Saved · '+new Date().toLocaleTimeString());}
 else {status('New changes pending');scheduleDraft();}
 await snapshot(body);
 return true;
}
async function guard(forImport=false){
 if(importing&&!forImport){status('Cancel the current conversion before changing documents or closing.');return false;}
 clearTimeout(timer);clearTimeout(recoveryTimer);await queue;
 if(!dirty)return true;
 try {
  const choice=await api.confirm();
  if(choice===1)return true;
  if(choice===0&&await run(()=>saveNow(true)))return !dirty||await guard(forImport);
  if(!hasFile&&editedDraft)await snapshot(await bodyFor(),true);scheduleDraft();return false;
 }catch(error){scheduleDraft();throw error;}
}
function askPassword(repeat=false){
 const hint=repeat?'Use at least 8 characters. Previous unencrypted recovery copies remain available.':'Enter the project password. It is kept in memory only while this project is open.';
 const fields='<label>Password <input id="desktop-password" type="password" autocomplete="off"></label>'+(repeat?'<label>Repeat password <input id="desktop-password2" type="password" autocomplete="off"></label>':'');
 return promptResult(finish=>modal(repeat?'Encrypt project':'Unlock project','<p>'+hint+'</p>'+fields,[
  ['Continue',dialog=>{
   const pass=$('desktop-password').value;
   if(repeat&&(pass.length<8||pass!==$('desktop-password2').value)){alert('Use at least 8 characters and matching passwords.');return;}
   finish(pass);dialog.close();
  }]
 ]));
}
async function decode(text){const o=JSON.parse(text);if(o.format==='ForbiddenTextEditorEncrypted'){const pass=await askPassword();if(pass===null)return null;return {s:validateProject(await decryptProject(o,pass)),pass};}return {s:validateProject(o),pass:null};}
const legacyImport=$('file-input').onchange;
let importing=false;
function showImportReview(){
 const report=extra?.documentImport?.report;
 const d=modal('Document import review','<div id="import-review-content"></div>');
 const host=$('import-review-content');
 if(!report){host.textContent='Import a PDF or document image to review conversion details.';return;}
 const add=(tag,text,parent=host)=>{const element=document.createElement(tag);element.textContent=text;parent.append(element);return element;};
 add('p',`${report.pages||0} page(s) imported. ${report.validation?.missingTextBlocks===0?'All extracted text blocks are present in the generated DOCX.':''} Review text and layout against the original before relying on them.`);
 if(report.warnings?.length){const list=document.createElement('ul');host.append(list);for(const text of report.warnings)add('li',text,list);}
 add('h3','Original pages');
 for(const item of report.pageDetails||[]){const details=document.createElement('details');host.append(details);add('summary',`Page ${item.page} · ${item.source} · ${item.method==='pdf-text'?'Original selectable text':'Page image'}`,details);if(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(item.preview||'')){const img=document.createElement('img');img.src=item.preview;img.alt=`Original page ${item.page}`;img.style.cssText='display:block;max-width:100%;height:auto;max-height:65vh;object-fit:contain;background:white;margin:10px auto';details.append(img);}}
 if(report.visualComparison?.reason)add('p',report.visualComparison.reason);
}
async function acceptImport(file){
 if(importing)return false;importing=true;clearTimeout(timer);clearTimeout(recoveryTimer);
 let previous=null,success=false;
 const panel=document.createElement('div');panel.id='document-import-progress';panel.setAttribute('role','status');panel.style.cssText='position:fixed;right:22px;bottom:42px;z-index:3000;padding:14px;width:340px;max-width:90vw;border:1px solid var(--border);border-radius:10px;background:var(--panel);color:var(--text);box-shadow:0 4px 20px #0005';
 const label=document.createElement('div');label.textContent='Preparing '+file.name;
 const progress=document.createElement('progress');progress.max=100;progress.style.cssText='width:100%;margin:9px 0';
 const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=async()=>{cancel.disabled=true;label.textContent='Canceling conversion…';await api.cancelImport();};panel.append(label,progress,cancel);document.body.append(panel);
 const unsubscribe=api.onImportProgress(message=>{label.textContent=(message.message||message.stage||'Converting document…')+(message.total?` · Page ${message.page||0} of ${message.total}`:'');const value=message.percent??(message.total?message.page/message.total*100:message.progress);if(Number.isFinite(value))progress.value=Math.max(0,Math.min(100,value));else progress.removeAttribute('value');});
 status('Importing '+file.name);
 try{
  const result=await api.runImport(file.importToken);if(result.canceled){status('Import canceled');return false;}
  cancel.disabled=true;label.textContent='Opening the converted document…';
  // Editing may continue during conversion. Confirm before replacing those edits.
  if(!await guard(true)){status('Converted document was not opened');return false;}
  previous={s:state(),password,locked,dirty,hasFile,currentFormat,projectId,lastSnapshot,revision,history:history.slice(),hi};
  loading=true;loadState(result.project);
  if(window.DocumentStudioImportLayout?.validateRendered){label.textContent='Checking the reconstructed layout…';try{result.report.visualComparison=await DocumentStudioImportLayout.validateRendered(result.report);result.report.warnings=[...new Set([...(result.report.warnings||[]),...(result.report.visualComparison.warnings||[])])];}catch(error){result.report.warnings=[...(result.report.warnings||[]),'Automatic layout comparison could not finish. Review source previews.'];}}
  extra.documentImport={...(extra.documentImport||{}),report:result.report};
  window.DocumentStudioImportLayout?.reviewUncertain(true);
  await api.commitOpen(false);
  password=null;locked=false;hasFile=false;currentFormat='docx';projectId=crypto.randomUUID();lastSnapshot='';revision++;resetHistory();dirty=false;loading=false;mark(false);success=true;
  status('Imported '+result.name+' · Review conversion, then Save as DOCX');
  const warnings=result.report?.warnings||[];if(warnings.length)showImportReview();
  return true;
 }catch(e){if(loading&&previous){loadState(previous.s);password=previous.password;locked=previous.locked;dirty=previous.dirty;hasFile=previous.hasFile;currentFormat=previous.currentFormat;projectId=previous.projectId;lastSnapshot=previous.lastSnapshot;revision=previous.revision;history=previous.history;hi=previous.hi;await api.dirty(dirty);}fail(e);return false;}
 finally{loading=false;importing=false;unsubscribe?.();panel.remove();if(!success)scheduleDraft();}
}

async function replaceDocument(load, file=null){
 if(loading)return false;
 loading=true;
 clearTimeout(timer);clearTimeout(recoveryTimer);
 try {
  await queue;
  const previous={s:state(),locked,dirty,history:history.slice(),hi};
  let committed=false;
  try {
   const result=await load();
   if(!result)return false;
   resetHistory();
   const binding=await api.commitOpen(!!file,file?.id);
   committed=true;
   hasFile=!!file;editedDraft=!file;currentFormat=file?formatOf(file.name):(result.pass?'encrypted':null);
   password=result.pass;locked=!!password;projectId=binding.id||crypto.randomUUID();
   lastSnapshot='';revision++;dirty=false;
   if(file){await api.dirty(false);status('Opened '+file.name);}
   else {revision++;dirty=true;await api.dirty(true);status('Recovered copy · Save to choose a file');}
   return true;
  }finally{
   if(!committed){loadState(previous.s);locked=previous.locked;dirty=previous.dirty;history=previous.history;hi=previous.hi;}
  }
 }finally{loading=false;scheduleDraft();}
}
async function acceptFile(file){
 if(!file){scheduleDraft();return false;}
 if(file.importToken)return acceptImport(file);
 return replaceDocument(async()=>{
  if(/\.(json|enc)$/i.test(file.name)){
   const result=await decode(new TextDecoder().decode(file.bytes));
   if(result)loadState(result.s);
   return result;
  }
  dirty=false;
  const success=await legacyImport({target:{files:[new File([file.bytes],file.name)],value:''}});
  return success?{pass:null}:null;
 },file);
}
async function chooseFile(select){
 if(!await guard())return false;
 try{return await acceptFile(await select());}finally{scheduleDraft();}
}
async function open(mode){return chooseFile(()=>api.open(mode));}
async function fresh(){if(!await guard())return;await api.commitOpen(false);loading=true;loadState({html:'<p><br></p>',name:'Untitled document'});loading=false;hasFile=false;editedDraft=false;currentFormat=null;password=null;locked=false;projectId=crypto.randomUUID();lastSnapshot='';revision++;resetHistory();dirty=false;await api.dirty(false);status('New document');}
async function recovery(interrupted=false){
 const list=await api.recoveries(interrupted);
 const description=interrupted?'Restore the unsaved document from the interrupted session.':'Up to 15 versions per document. Restoring a version opens a separate unsaved copy.';
 modal(interrupted?'Recover unsaved document':'Disk recovery','<p>'+description+'</p><div id="disk-recovery"></div>');
 if(!list.length)$('disk-recovery').textContent='No recovery drafts yet.';
 for(const item of list)button(new Date(item.time).toLocaleString()+' · '+item.label,async()=>{
  $('dialog').close();
  if(!await guard())return;
  try {
   await replaceDocument(async()=>{
    const result=await decode(await api.recover(item));
    if(result)loadState(result.s);
    return result;
   });
  }catch(error){fail(error);}
 },$('disk-recovery'));
}
async function recents(){const files=await api.recent();modal('Recent projects','<div id="desktop-recents"></div>');if(!files.length)$('desktop-recents').textContent='No recent files.';files.forEach((file,i)=>button(file,()=>{$('dialog').close();return chooseFile(()=>api.recent(i)).catch(fail);},$('desktop-recents')));}
function appendSaveSettings(host){
 const label=document.createElement('label');
 label.textContent='Autosave delay in seconds (0 saves immediately) ';
 const input=document.createElement('input');input.type='number';input.min='0';input.max='86400';input.step='0.001';
 input.setAttribute('aria-label','Autosave delay in seconds');input.value=String(delayMs/1000);
 input.onchange=async()=>{
  if(!input.value||!input.reportValidity()){input.value=String(delayMs/1000);return;}
  const value=Math.round(input.valueAsNumber*1000);
  try{await api.settings({autosaveDelayMs:value});delayMs=value;scheduleDraft();}
  catch(error){input.value=String(delayMs/1000);fail(error);}
 };
 label.append(input);host.append(label);
}
$('desktop-auto').onchange=async()=>{
 const value=$('desktop-auto').checked;
 try{await api.settings({autosave:value});auto=value;scheduleDraft();status(auto?'Autosave enabled':'Autosave disabled');}
 catch(error){$('desktop-auto').checked=auto;fail(error);}
};
for(const b of [...ui.querySelectorAll('button')]){if(b.textContent==='Save As…')b.onclick=()=>saveDialog();if(b.textContent==='Export…')b.remove();if(b.textContent==='Print / PDF'){b.textContent='Print';b.onclick=()=>printDocument().catch(fail);}}
button('Recent',recents,ui);button('Import PDF / images…',()=>chooseFile(()=>api.chooseImport()).catch(fail),ui);button('Import review',()=>showImportReview(),ui);ui.append(autoLabel);
saveProject=async encrypted=>{if(encrypted&&!password){const p=await askPassword(true);if(p!==null)return run(()=>saveNow(true,true,p));return false;}return run(()=>saveNow(true,false,password));};
const originalExport=exportAs;
saveDialog=async(manuscript=false)=>{const fmt=await chooseFormat();if(!fmt)return false;return manuscript?exportAs(fmt,true):run(()=>saveNow(true,true,null,fmt));};
exportAs=async(fmt,manuscript=false)=>{
 if(manuscript){
  if(fmt!=='pdf')return originalExport(fmt,true);
  const original=state();try{extra.activeChapter=null;layout(manuscriptState().html);updatePrintStyle();await Promise.all([...pages.querySelectorAll('img')].map(i=>i.decode().catch(()=>{})));return await api.pdf(filename()+'-manuscript.pdf');}finally{loadState(original);}
 }

 if(fmt==='encrypted'){const p=password||await askPassword(true);return p===null?false:run(()=>saveNow(true,true,p,'encrypted'));}
 if(fmt==='project')return run(()=>saveNow(true,true,null,'project'));
 return run(()=>saveNow(true,true,null,fmt));
};
download=async(blob,name)=>{const ok=await api.export({bytes:new Uint8Array(await blob.arrayBuffer()),name});status(ok?'Saved '+name:'Save canceled');return ok;};
printDocument=async()=>{layout();updatePrintStyle();await Promise.all([...pages.querySelectorAll('img')].map(i=>i.decode().catch(()=>{})));await api.print();};
$('btn-open').onclick=()=>open().catch(fail);$('file-input').onclick=e=>{e.preventDefault();open().catch(fail);};$('btn-new').onclick=()=>fresh().catch(fail);$('btn-draft').textContent='Save';$('btn-draft').onclick=()=>saveProject(locked).catch(fail);$('btn-save').remove();
const oldPanel=panel;panel=label=>label==='Recovery'?recovery():oldPanel(label);
// Window capture runs before the editor's document shortcut listener.
window.addEventListener('keydown',e=>{if(window.FTEBatchBusy){e.preventDefault();e.stopImmediatePropagation();return;}if(e.target.closest?.('#pro-key-list input'))return;if(!(e.ctrlKey||e.metaKey))return;const k=e.key.toLowerCase();if(!['s','o','p','n'].includes(k)||(k==='p'&&e.shiftKey))return;
 e.preventDefault();e.stopImmediatePropagation();const f=k==='s'?()=>e.shiftKey?saveDialog():run(()=>saveNow(true)):k==='o'?()=>open():k==='p'?()=>printDocument():()=>fresh();Promise.resolve().then(f).catch(fail);},true);
api.onCommand(command=>{if(busy)return;busy=true;const fn=command==='close'?async()=>{if(await guard())await api.close();}:command==='new'?fresh:command==='open'?()=>open():command==='external-open'?()=>open('external'):command==='save-as'?()=>saveDialog():command==='print'?()=>printDocument():()=>saveProject(locked);Promise.resolve().then(fn).catch(fail).finally(()=>{busy=false;});});
window.FTEDesktop={appendSaveSettings,withTemporaryDocument:fn=>run(async()=>{clearTimeout(timer);clearTimeout(recoveryTimer);const previousLoading=loading;loading=true;try{return await fn();}finally{loading=previousLoading;if(dirty&&!loading)scheduleDraft();}}),applyTemplate:async(name,html,project=null)=>{if(!await guard())return false;await run(()=>snapshot());await api.commitOpen(false);loading=true;loadState({...project,html,name,selection:null});loading=false;hasFile=false;editedDraft=false;currentFormat=null;password=null;locked=false;projectId=crypto.randomUUID();lastSnapshot='';resetHistory();mark(false);$('dialog').close();return true;},saveNow:(...args)=>run(()=>saveNow(...args)),acceptFile,recovery,mark,decode,getStatus:()=>({auto,hasFile,locked,dirty,projectId})};
if(init.recoveryAvailable){status('Unsaved recovery draft available');const restore=confirm('The previous session ended unexpectedly with an unsaved recovery draft. Open recovery?');if(restore)await recovery(true);else{await api.ackRecovery();if(init.startup)await open('startup');}}else if(init.startup)await open('startup');
})().catch(e=>{console.error(e);alert('Desktop initialization failed: '+e.message);});
