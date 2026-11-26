'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

// Exercise the document editor and its desktop integration with isolated native
// dialogs and storage. The medical catalogs and other workspaces are unnecessary.
const root = path.join(__dirname, '..');
const scripts = new Set(['desktop.js', 'controls.js', 'pro-import-layout.js']);

(async () => {
  const browser = await chromium.launch({executablePath:process.env.DOCUMENT_STUDIO_BROWSER});
  try {
    const page = await browser.newPage();
    page.on('dialog', dialog => dialog.accept());
    await page.route('http://localhost/**', async route => {
      const name = path.posix.basename(new URL(route.request().url()).pathname);
      if (name === 'editor.html' || scripts.has(name)) {
        await route.fulfill({body:await fs.readFile(path.join(root,name)),contentType:name.endsWith('.html')?'text/html':'text/javascript'});
      } else {
        await route.fulfill({status:200,body:'',contentType:name.endsWith('.css')?'text/css':'text/javascript'});
      }
    });
    await page.addInitScript(() => {
      window.testStore = {snapshots:[],acknowledged:0,commits:[],failCommit:false};
      const store = window.testStore;
      const project = {format:'ForbiddenStudio',name:'Imported document',html:'<p>Converted page</p>'};
      window.documentStudioDesktop = {
        init:async()=>({settings:{autosave:false},recoveryAvailable:true}),
        recoveries:async()=>[{id:'original-history',name:'entry',label:'Encrypted project',time:1}],
        recover:async()=>store.encrypted,
        ackRecovery:async()=>{store.acknowledged++},
        confirm:async()=>1,dirty:async()=>{},
        snapshot:async entry=>{store.snapshots.push(entry)},
        save:async()=>({canceled:true}),saveDocument:async()=>({canceled:true}),
        commitOpen:async(native,id)=>{
          if(store.failCommit)throw Error('Storage unavailable');
          store.commits.push([native,id]);
          return {id:native?id:null};
        },
        onCommand:()=>{},onImportProgress:()=>()=>{},
        runImport:async()=>({project,name:'Sample',report:{pages:1,warnings:[],pageDetails:[],uncertain:[]}}),
      };
    });
    await page.goto('http://localhost/editor.html');
    await page.waitForFunction(()=>window.FTEDesktop && document.querySelector('#disk-recovery button'));
    const clickButton = label => page.getByRole('button',{name:label,exact:true,includeHidden:true}).evaluate(b=>b.click());
    await page.evaluate(async()=>{
      const s={format:'ForbiddenStudio',name:'Confidential draft',html:'<p>Private editing sample</p>'};
      testStore.encrypted=await (await FTE.encryptedBlob(s,'test-password')).text();
    });
    const selectRecovery=()=>page.locator('#disk-recovery button').click();
    await selectRecovery();
    await page.locator('#desktop-password').waitFor();
    await clickButton('Close');
    assert.equal(await page.evaluate(()=>testStore.acknowledged),0);
    assert.equal(await page.evaluate(()=>testStore.commits.length),0);
    await page.evaluate(()=>FTEDesktop.recovery());
    await selectRecovery();
    await page.locator('#desktop-password').fill('test-password');
    await clickButton('Continue');
    await page.waitForFunction(()=>FTEDesktop.getStatus().locked);
    const restored=await page.evaluate(()=>FTEDesktop.getStatus());
    assert.equal(restored.hasFile,false);
    assert.notEqual(restored.projectId,'original-history');
    const canceled=await page.evaluate(()=>FTEDesktop.saveNow(true,true,null,'project'));
    assert.equal(canceled,false);
    const snapshots=await page.evaluate(()=>testStore.snapshots);
    assert.ok(snapshots.length);
    assert.ok(snapshots.every(s=>s.id===restored.projectId && JSON.parse(s.body).format==='ForbiddenTextEditorEncrypted'));
    const failure=await page.evaluate(async()=>{
      testStore.failCommit=true;
      const s={format:'ForbiddenStudio',html:'<p>Different contents</p>'};
      try{await FTEDesktop.acceptFile({id:'bad',name:'new.fte.json',bytes:new TextEncoder().encode(JSON.stringify(s))});}
      catch(error){return error.message;}
    });
    assert.match(failure,/Storage unavailable/);
    assert.deepEqual(await page.evaluate(()=>FTEDesktop.getStatus()),restored);
    assert.match(await page.evaluate(()=>FTE.state().html),/Private editing sample/);
    const previous=await page.evaluate(()=>testStore.commits.length);
    assert.equal(await page.evaluate(()=>{
      testStore.failCommit=false;
      return FTEDesktop.acceptFile({id:'broken',name:'broken.docx',bytes:new Uint8Array([1,2,3])});
    }),false);
    assert.equal(await page.evaluate(()=>testStore.commits.length),previous);
    assert.deepEqual(await page.evaluate(()=>FTEDesktop.getStatus()),restored);
    assert.equal(await page.evaluate(()=>FTEDesktop.acceptFile({name:'Sample',importToken:'sample'})),true);
    await clickButton('Import review');
    assert.match(await page.locator('#import-review-content').innerText(),/1 page\(s\) imported/);
    await clickButton('Close');
    assert.equal(await page.evaluate(()=>FTEDesktop.acceptFile({id:'new',name:'New.txt',bytes:new TextEncoder().encode('Different document')})),true);
    await clickButton('Import review');
    assert.match(await page.locator('#import-review-content').innerText(),/Import a PDF or document image to review/);
    console.log('Document recovery, encrypted Save As, failed opens and import review passed.');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
