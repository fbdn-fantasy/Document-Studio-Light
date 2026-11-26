'use strict';
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const {chromium} = require('playwright');
const {Store} = require('../storage.cjs');

const root = path.resolve(__dirname, '..');

// Use the actual file service, substituting only deterministic native dialogs.
function startService(profile, file) {
 const proc = spawn(process.execPath, ['desktop-service.cjs', profile], {cwd:root, stdio:['pipe','pipe','inherit']});
 let serial=0, saveChoices=0;
 const pending=new Map();
 const send=message=>proc.stdin.write(JSON.stringify(message)+'\n');
 readline.createInterface({input:proc.stdout}).on('line',line=>{
  const message=JSON.parse(line);
  if(message.native){
   let result=null;
   if(message.method==='save'){saveChoices++;result={filePath:file,canceled:false};}
   if(message.method==='open')result={filePaths:[file],canceled:false};
   if(message.method==='confirm')result={response:1};
   send({nativeReply:message.native,result});
  }else if(pending.has(message.id)){
   const {resolve,reject}=pending.get(message.id);pending.delete(message.id);
   if(message.error)reject(Error(message.error));else resolve(message.result);
  }
 });
 proc.once('exit',()=>{for(const p of pending.values())p.reject(Error('File service exited'));});
 return {
  call:(method,args=[])=>new Promise((resolve,reject)=>{
   const id=++serial;pending.set(id,{resolve,reject});send({id,method,args});
  }),
  get saveChoices(){return saveChoices;},
  stop:()=>new Promise(resolve=>{proc.once('exit',resolve);proc.kill();}),
 };
}

(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'studio-autosave-'));
 const file=path.join(profile,'Written document.docx'),store=new Store(profile);
 let service=startService(profile,file),browser;
 try{
  browser=await chromium.launch({executablePath:process.env.DOCUMENT_STUDIO_BROWSER});
  const page=await browser.newPage();
  const recoveryDialogs=[],errors=[];
  page.on('dialog',async d=>{if(d.type()==='confirm')recoveryDialogs.push(d.message());else errors.push(d.message());await d.accept();});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://localhost/**',async route=>{
   const name=path.posix.basename(new URL(route.request().url()).pathname);
   const keep=['editor.html','desktop.js','controls.js','pro-core.js','pro.js','pro-import-layout.js'];
   if(keep.includes(name))await route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:name.endsWith('.html')?'text/html':'text/javascript'});
   else await route.fulfill({body:'',contentType:name.endsWith('.css')?'text/css':'text/javascript'});
  });
  await page.exposeFunction('serviceCall',(method,args)=>service.call(method,args));
  await page.addInitScript(()=>{
   const api=window.documentStudioDesktop={onCommand:()=>{},onImportProgress:()=>()=>{}};
   for(const method of ['init','open','save','saveDocument','snapshot','commitOpen','settings','dirty','confirm','close','recent','recover','recoveries','ackRecovery']){
    api[method]=(...args)=>window.serviceCall(method,args.map(x=>x?.bytes?{...x,bytes:Array.from(x.bytes)}:x)).then(x=>x?.bytes?{...x,bytes:new Uint8Array(x.bytes)}:x);
   }
  });
  const ready=()=>page.waitForFunction(()=>!!window.FTEDesktop);
  const click=id=>page.locator(id).evaluate(b=>b.click());
  const body=page.locator('.page-body').first();
  const clean=()=>page.waitForFunction(()=>!FTEDesktop.getStatus().dirty);
  await page.goto('http://localhost/editor.html');await ready();
  await click('#btn-new');await page.waitForFunction(()=>document.querySelector('#desktop-status').textContent==='New document');
  assert.equal(await store.pendingRecovery(),false);
  await body.fill('First unsaved text');
  await page.waitForFunction(()=>FTEDesktop.getStatus().dirty);
  await assert.doesNotReject(async()=>{
   for(let i=0;i<100;i++){if(await store.pendingRecovery())return;await new Promise(r=>setTimeout(r,30));}
   assert.fail('Unsaved typing did not produce a crash draft');
  });
  assert.equal(service.saveChoices,0);
  await assert.rejects(fs.stat(file),{code:'ENOENT'});
  await service.stop();service=startService(profile,file);
  await page.reload();await ready();await page.locator('#disk-recovery button').click();
  await page.waitForFunction(()=>FTE.state().html.includes('First unsaved text'));
  assert.equal(recoveryDialogs.length,1);
  await click('#btn-draft');await page.locator('#export-format').waitFor();
  assert.equal(await page.locator('#export-format').inputValue(),'docx');
  await page.getByRole('button',{name:'Save',exact:true}).filter({visible:true}).last().click();
  await page.waitForFunction(()=>FTEDesktop.getStatus().hasFile);await clean();
  assert.equal(service.saveChoices,1);assert.equal(await store.pendingRecovery(),false);

  await body.fill('First saved edit');
  await body.locator('p').first().click();await page.keyboard.press('End');
  await page.keyboard.type(' and final edit',{delay:5});
  assert.equal((await body.innerText()).replace(/\u00a0/g,' '),'First saved edit and final edit');
  await clean();
  assert.equal(service.saveChoices,1);
  const saved=await fs.readFile(file);assert.equal(saved.readUInt32LE(0),0x04034b50);
  const xml=await page.evaluate(async data=>(await JSZip.loadAsync(new Uint8Array(data))).file('word/document.xml').async('string'),Array.from(saved));
  const text=await page.evaluate(xml=>[...new DOMParser().parseFromString(xml,'application/xml').getElementsByTagName('w:t')].map(n=>n.textContent).join(''),xml);
  assert.equal(text,'First saved edit and final edit');
  assert.equal(await store.pendingRecovery(),false);
  await page.keyboard.press('Control+o');
  await page.waitForFunction(()=>document.querySelector('#desktop-status').textContent.startsWith('Opened'));
  assert.match(await body.innerText(),/First saved edit and final edit/);

  await page.getByRole('button',{name:'Commands',exact:true}).click();
  await page.getByRole('menuitem',{name:'Interface settings',exact:true}).click();
  const delay=page.getByRole('spinbutton',{name:'Autosave delay in seconds'});
  await delay.fill('60');await delay.press('Tab');
  await page.waitForFunction(async()=> (await desktop.init()).settings.autosaveDelayMs===60000);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await body.fill('An edit waiting for the chosen delay');
  assert.equal(await page.evaluate(()=>FTEDesktop.getStatus().dirty),true);
  assert.deepEqual(await fs.readFile(file),saved);
  assert.equal(await store.pendingRecovery(),false);
  await service.stop();service=startService(profile,file);await page.reload();await ready();
  assert.equal(recoveryDialogs.length,1);
  assert.equal((await store.config()).autosaveDelayMs,60000);
  assert.deepEqual(errors,[]);
  console.log('Blank document, interrupted draft, first DOCX save, immediate edits, DOCX reopen, saved delay and saved-file crash passed.');
 }finally{
  if(browser)await browser.close();
  await service.stop();
  await fs.rm(profile,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
