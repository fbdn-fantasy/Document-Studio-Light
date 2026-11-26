'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
async function atomicWrite(file,data){await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{const h=await fs.open(temp,'wx',0o600);try{await h.writeFile(data);await h.sync();}finally{await h.close();}await fs.rename(temp,file);}finally{await fs.unlink(temp).catch(()=>{});}}
class Store{
 constructor(root){this.root=root;this.recoveryQueue=Promise.resolve();this.configQueue=Promise.resolve();}
 async read(name,fallback){try{return JSON.parse(await fs.readFile(path.join(this.root,name),'utf8'));}catch{return fallback;}}
 config(value){
  const data=value?JSON.stringify(value):null;
  const task=this.configQueue.then(async()=>{
   if(data){
    await atomicWrite(path.join(this.root,'settings.json'),data);
    return JSON.parse(data);
   }
   const saved=await this.read('settings.json',{});
   return saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
  });
  this.configQueue=task.catch(()=>{});
  return task;
 }
 // Prompt eligibility is separate from the retained version history.
 async interruptedDraft(){
  await this.recoveryQueue;
  const entry=await this.read('recovery-session.json',null);
  if(!entry)return [];
  try{
   const body=JSON.parse(await this.get(entry.id,entry.name));
   return [{id:entry.id,name:entry.name,time:Number(entry.name.split('-')[0]),label:body.format==='ForbiddenTextEditorEncrypted'?'Encrypted project':body.name||'Untitled document'}];
  }catch{return [];}
 }
 async pendingRecovery(){return (await this.interruptedDraft()).length>0;}
 setPendingRecovery(entry=null){const task=this.recoveryQueue.then(async()=>{if(entry)await this.get(entry.id,entry.name);await atomicWrite(path.join(this.root,'recovery-session.json'),JSON.stringify(entry));});this.recoveryQueue=task.catch(()=>{});return task;}
 async snapshot(id,body){if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))throw Error('Invalid recovery ID');JSON.parse(body);const dir=path.join(this.root,'recovery',id);await fs.mkdir(dir,{recursive:true,mode:0o700});const name=Date.now()+'-'+crypto.randomUUID()+'.json';await atomicWrite(path.join(dir,name),body);const files=(await fs.readdir(dir)).filter(x=>x.endsWith('.json')).sort().reverse();for(const f of files.slice(15))await fs.unlink(path.join(dir,f));return name;}
 async list(){const base=path.join(this.root,'recovery'),items=[];for(const id of await fs.readdir(base).catch(()=>[])){if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))continue;for(const name of await fs.readdir(path.join(base,id))){if(!/^\d+-[a-f0-9-]+\.json$/.test(name))continue;const body=await fs.readFile(path.join(base,id,name),'utf8');try{const s=JSON.parse(body);items.push({id,name,time:Number(name.split('-')[0]),label:s.format==='ForbiddenTextEditorEncrypted'?'Encrypted project':s.name||'Untitled document'});}catch{}}}return items.sort((a,b)=>b.time-a.time);}
 async get(id,name){if(!/^[a-zA-Z0-9-]{1,80}$/.test(id)||!/^\d+-[a-f0-9-]+\.json$/.test(name))throw Error('Invalid recovery entry');return fs.readFile(path.join(this.root,'recovery',id,name),'utf8');}
}
module.exports={Store,atomicWrite};
