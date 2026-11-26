const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {Store,atomicWrite}=require('../storage.cjs');
test('rapid appearance changes persist the last choice and a damaged settings file can be reopened', async () => {
 const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ds-settings-'));
 try {
  const store = new Store(dir);
  await fs.writeFile(path.join(dir, 'settings.json'), 'null');
  assert.deepEqual(await store.config(), {});
  const writes = Array.from({length: 24}, (_, i) => store.config({theme: i % 2 ? 'dark' : 'light'}));
  writes.push(store.config({theme: 'original', autosave: false}));
  await Promise.all(writes);
  assert.deepEqual(await new Store(dir).config(), {theme: 'original', autosave: false});
 } finally {
  await fs.rm(dir, {recursive: true, force: true});
 }
});
test('atomic save replaces complete contents and leaves no partial files',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fte-'));try{const f=path.join(dir,'doc.json');await atomicWrite(f,'first');await atomicWrite(f,'second');assert.equal(await fs.readFile(f,'utf8'),'second');assert.deepEqual(await fs.readdir(dir),['doc.json']);if(process.platform!=='win32')assert.equal((await fs.stat(f)).mode&0o777,0o600);}finally{await fs.rm(dir,{recursive:true});}});
test('recovery retains 15 entries per project and rejects path traversal',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fte-'));try{const s=new Store(dir);for(let i=0;i<19;i++)await s.snapshot('project-a',JSON.stringify({name:'Doc',html:String(i)}));await s.snapshot('project-b',JSON.stringify({format:'ForbiddenTextEditorEncrypted',data:'ciphertext'}));const list=await s.list();assert.equal(list.filter(x=>x.id==='project-a').length,15);assert.equal(list.filter(x=>x.id==='project-b').length,1);const enc=list.find(x=>x.id==='project-b');assert.equal(enc.label,'Encrypted project');assert.match(await s.get(enc.id,enc.name),/ciphertext/);await assert.rejects(s.get('../escape','x'));await assert.rejects(s.snapshot('../escape','{}'));}finally{await fs.rm(dir,{recursive:true});}});
test('only an interrupted unsaved snapshot is eligible for the startup prompt',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fte-session-'));try{let s=new Store(dir);const name=await s.snapshot('draft',JSON.stringify({name:'Unsaved work'}));assert.equal(await s.pendingRecovery(),false,'old version history alone must not prompt');await s.setPendingRecovery({id:'draft',name});s=new Store(dir);assert.equal(await s.pendingRecovery(),true,'interrupted session survives reopening');await s.setPendingRecovery();assert.equal(await new Store(dir).pendingRecovery(),false,'clean close/save clears eligibility');assert.equal((await s.list()).length,1,'manual recovery history is retained');await s.setPendingRecovery({id:'draft',name});await fs.unlink(path.join(dir,'recovery','draft',name));assert.equal(await s.pendingRecovery(),false,'missing snapshot must not prompt');await assert.rejects(s.setPendingRecovery({id:'../bad',name}));}finally{await fs.rm(dir,{recursive:true,force:true});}});
