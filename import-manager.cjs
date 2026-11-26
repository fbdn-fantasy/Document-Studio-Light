'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const IMPORT_EXT=/\.(pdf|png|jpe?g|webp|bmp|tiff?)$/i;
const MAX_BYTES=256*1024*1024;
class ImportManager {
 constructor(root,notify){this.root=root;this.notify=notify;this.choices=new Map();this.active=null;}
 async select(inputs){
  if(!Array.isArray(inputs)||!inputs.length||inputs.length>200)throw Error('Select between 1 and 200 document files.');
  let total=0;
  for(const file of inputs){if(!path.isAbsolute(file)||!IMPORT_EXT.test(file))throw Error('Unsupported document import format.');const s=await fs.stat(file);if(!s.isFile()||s.size>MAX_BYTES)throw Error('Each input must be a file smaller than 256 MB.');total+=s.size;}
  if(total>2*1024*1024*1024)throw Error('Selected documents exceed the 2 GB import limit.');
  const token=crypto.randomUUID();this.choices.clear();this.choices.set(token,inputs);
  return {importToken:token,name:path.basename(inputs[0]),sourceCount:inputs.length};
 }
 async health(job){
  const manifestPath=path.join(this.root,'runtime-manifest.json');
  let manifest;
  try{manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));}catch{throw Error('The document import runtime is missing or incomplete. Run the installer again.');}
  if(!Array.isArray(manifest.files)||!manifest.files.length)throw Error('The import component manifest is invalid. Reinstall Document Studio.');
  const queue=manifest.files.slice();let checked=0;
  const checkNext=async()=>{while(queue.length&&!job?.canceled){const item=queue.pop();
   const file=path.resolve(this.root,item.path),rel=path.relative(this.root,file);
   if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('Invalid import component path.');
   let stat;try{stat=await fs.stat(file);}catch{throw Error('Missing import component: '+item.path+'. Run the installer again.');}
   if(stat.size!==item.size)throw Error('Damaged import component: '+item.path+'. Run the installer again.');
   const hash=crypto.createHash('sha256');
   for await(const chunk of require('node:fs').createReadStream(file,{highWaterMark:1024*1024})){
    if(job?.canceled)return;
    hash.update(chunk);
   }
   if(hash.digest('hex')!==item.sha256)throw Error('Corrupted import component: '+item.path+'. Run the installer again.');
   if(++checked%1000===0)this.notify({type:'progress',message:'Checking offline components',percent:Math.round(checked/manifest.files.length*100)});
  }};
  await Promise.all(Array.from({length:12},checkNext));
  return job?.canceled?{canceled:true}:{ok:true,files:manifest.files.length};
 }
 async cancel(){
  if(!this.active)return false;this.active.canceled=true;
  const child=this.active.child;if(child&&!child.killed){
   if(process.platform==='win32')await new Promise(resolve=>{const killer=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true});killer.on('close',resolve);killer.on('error',()=>{child.kill();resolve();});});
   else child.kill('SIGKILL');
  }
  return true;
 }
 async run(token){
  if(this.active)throw Error('A conversion is already running.');
  const inputs=this.choices.get(token);if(!inputs)throw Error('Choose the document files again.');this.choices.delete(token);
  const job={canceled:false,child:null};this.active=job;
  let temp;
  try{
   this.notify({type:'progress',stage:'Checking offline import components',percent:0});
   if(job.canceled)return {canceled:true};
   await this.health(job);
   if(job.canceled)return {canceled:true};
   temp=await fs.mkdtemp(path.join(os.tmpdir(),'document-studio-import-'));
   const request=path.join(temp,'request.json'),output=path.join(temp,'output');await fs.mkdir(output);
   await fs.writeFile(request,JSON.stringify({inputs,output}));
   const python=path.join(this.root,'runtime',...(process.platform==='win32'?['python.exe']:['bin','python3'])),worker=path.join(this.root,'import-engine','worker.py');
   const env={...process.env,TEMP:temp,TMP:temp,PYTHONIOENCODING:'utf-8',PYTHONUTF8:'1'};
   for(const name of Object.keys(env))if(/^PYTHON(PATH|HOME|STARTUP|USERBASE)$/i.test(name))delete env[name];
   const result=await new Promise((resolve,reject)=>{
    const child=job.child=spawn(python,['-I','-X','utf8','-B','-u',worker,'--request',request],{cwd:temp,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let buffer='',stderr='',lastResult=null,error=null,count=0;
    const timeout=setTimeout(()=>{error=Error('Conversion exceeded the 30-minute limit. Try importing fewer pages.');this.cancel();},30*60*1000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>{buffer+=chunk;count+=Buffer.byteLength(chunk);if(count>16*1024*1024){error=Error('The converter exceeded its status output limit.');this.cancel();return;}
     let pos;while((pos=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,pos);buffer=buffer.slice(pos+1);try{const message=JSON.parse(line);if(message.type==='result')lastResult=message;else if(message.type==='error')error=Error(message.message||message.error||'Document conversion failed.');else if(message.type==='progress')this.notify(message);}catch{}}
    });
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-16000);});
    child.on('error',e=>{clearTimeout(timeout);reject(Error('Cannot start the offline converter: '+e.message+'. Run the installer again.'));});
    child.on('close',code=>{clearTimeout(timeout);job.child=null;if(error)return reject(error);if(job.canceled)return resolve({canceled:true});if(code!==0||!lastResult)return reject(Error('Document conversion failed. '+(stderr.trim().slice(-1500)||'The document may be damaged, encrypted, or unsupported.')));resolve(lastResult);});
   });
   if(result.canceled)return result;
   if(job.canceled)return {canceled:true};
   const readOutput=async(file,binary=false)=>{if(typeof file!=='string')throw Error('Converter returned an invalid result.');const resolved=path.resolve(output,file),relative=path.relative(output,resolved);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Converter returned a path outside its output folder.');const stat=await fs.stat(resolved);if(stat.size>200*1024*1024)throw Error('Converted document exceeds the 200 MB editor limit.');return fs.readFile(resolved,binary?undefined:'utf8');};
   const project=JSON.parse(await readOutput(result.project)),report=JSON.parse(await readOutput(result.report));
   if(job.canceled)return {canceled:true};
   if(typeof project.html!=='string'||!project.html.trim())throw Error('Conversion returned no editable document.');
   const docx=await readOutput(result.docx,true);
   if(job.canceled)return {canceled:true};
   return {name:path.basename(inputs[0]).replace(/\.[^.]+$/,'')+(inputs.length>1?' and '+(inputs.length-1)+' more':'')+'.docx',project,report,docx:new Uint8Array(docx)};
  }finally{
   this.active=null;
   if(temp){const resolved=path.resolve(temp),base=path.resolve(os.tmpdir());if(path.dirname(resolved)===base&&path.basename(resolved).startsWith('document-studio-import-'))await fs.rm(resolved,{recursive:true,force:true}).catch(()=>{});}
  }
 }
}
module.exports={ImportManager,IMPORT_EXT};
