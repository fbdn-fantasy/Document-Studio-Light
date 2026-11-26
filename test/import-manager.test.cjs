'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {ImportManager}=require('../import-manager.cjs');
test('offline runtime manifest detects missing, corrupt and escaping components',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ds-manifest-test-')),manager=new ImportManager(root,()=>{});
 try{
  await assert.rejects(manager.health(),/missing or incomplete/);
  const content=Buffer.from('verified component'),entry={path:'component.bin',size:content.length,sha256:crypto.createHash('sha256').update(content).digest('hex')};
  await fs.writeFile(path.join(root,entry.path),content);await fs.writeFile(path.join(root,'runtime-manifest.json'),JSON.stringify({files:[entry]}));assert.deepEqual(await manager.health(),{ok:true,files:1});
  await fs.writeFile(path.join(root,entry.path),'corrupted component');await assert.rejects(manager.health(),/Damaged|Corrupted/);
  await fs.writeFile(path.join(root,'runtime-manifest.json'),JSON.stringify({files:[{...entry,path:'../outside'}]}));await assert.rejects(manager.health(),/Invalid import component path/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('document selection is bounded, accepts image groups and never edits sources',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ds-selection-test-')),manager=new ImportManager(root,()=>{});
 try{
  const files=['one.pdf','two.TIFF','three.webp'].map(n=>path.join(root,n));for(const file of files)await fs.writeFile(file,'original');
  const item=await manager.select(files);assert.equal(item.sourceCount,3);assert.equal(item.name,'one.pdf');assert.equal(typeof item.importToken,'string');
  await assert.rejects(manager.select(['one.pdf']),/Unsupported/);await assert.rejects(manager.select([path.join(root,'bad.exe')]),/Unsupported/);await assert.rejects(manager.select(Array(201).fill(files[0])),/200/);
  await assert.rejects(manager.run('not-issued'),/Choose the document files again/);assert.equal(await manager.cancel(),false);
  for(const file of files)assert.equal(await fs.readFile(file,'utf8'),'original');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('canceling an import stops verification before it reads more components', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ds-cancel-test-'));
 const job = {canceled: false};
 const manager = new ImportManager(root, () => { job.canceled = true; });
 try {
  const data = Buffer.from('offline component');
  const entry = {path: 'file.bin', size: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex')};
  // Verification consumes the manifest from the end with twelve concurrent readers.
  const files = [{...entry, path: 'must-not-be-read'}, ...Array(1020).fill(entry)];
  await fs.writeFile(path.join(root, entry.path), data);
  await fs.writeFile(path.join(root, 'runtime-manifest.json'), JSON.stringify({files}));
  assert.deepEqual(await manager.health(job), {canceled: true});
 } finally {
  await fs.rm(root, {recursive: true, force: true});
 }
});
