const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{mkdtemp,rm,readFile}=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),readline=require('node:readline');
test('Tauri service preserves save/open, settings, recovery and bytes through JSON transport',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'document-studio-v20-test-'));const child=spawn(path.resolve(process.platform==='win32'?'node-windows/node.exe':'node-linux/bin/node'),['desktop-service.cjs',dir],{stdio:['pipe','pipe','inherit'],env:{...process.env,NODE_TEST_CONTEXT:''}});let id=0;const pending=new Map();const file=path.join(dir,'test.fte.json');
 let ready;const readyPromise=new Promise(r=>ready=r);const lines=readline.createInterface({input:child.stdout});lines.on('line',line=>{const m=JSON.parse(line);if(m.ready)return ready();if(m.native){assert.equal(m.method,'save');child.stdin.write(JSON.stringify({nativeReply:m.native,result:{canceled:false,filePath:file}})+'\n');return;}const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.result);}});
 const call=(method,...args)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});child.stdin.write(JSON.stringify({id:n,method,args})+'\n');});
 try{const earlyInit=await Promise.race([call('init'),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Early startup IPC was lost before ready')),5000);timer.unref();})]);assert.deepEqual(earlyInit.settings,{});await readyPromise;assert.deepEqual(await call('spell',['document','documment']),['documment']);assert.ok((await call('spellSuggestions','documment')).includes('document'));assert.deepEqual((await call('init')).settings,{});await call('settings',{theme:'light',autosave:false});assert.equal((await call('init')).settings.theme,'light');
 const body=JSON.stringify({format:'ForbiddenStudio',name:'Bridge test',html:'<p>Saved text</p>'});const saved=await call('save',{body,name:'test.fte.json'});assert.equal(saved.name,'test.fte.json');assert.equal(await readFile(file,'utf8'),body);await call('externalOpen',[file]);assert.equal(Buffer.from((await call('open','external')).bytes).toString(),body);
 const selected=await call('open','external');
 await assert.rejects(call('commitOpen',true,'stale-selection'),/selected file changed/);
 assert.equal((await call('documentInfo')).path,file);
 assert.equal((await call('commitOpen',true,selected.id)).id,saved.id);
 await assert.rejects(call('save',{body:JSON.stringify({format:'ForbiddenTextEditorEncrypted'}),name:'encrypted.fte.enc'}),/\.fte\.enc/);
 assert.equal(await readFile(file,'utf8'),body);
 await call('open','external');
 await call('commitOpen',false);
 assert.equal((await call('documentInfo')).path,'');
 const snapshot=await call('snapshot',{id:'test-project',body,recoverable:true});assert.equal(await call('recover',{id:'test-project',name:snapshot}),body);
 await assert.rejects(call('recover',{id:'../escape',name:snapshot}),/Invalid recovery/);await assert.rejects(call('save',{body:'{}',name:'bad.json'}),/Invalid project/);
 await call('export',{bytes:[0,255,128,42],name:'binary'});assert.deepEqual([...await readFile(file)],[0,255,128,42]);await call('close');
 }finally{const exited=new Promise(resolve=>child.once('close',resolve));child.stdin.end();await exited;await rm(dir,{recursive:true,force:true});}
});
