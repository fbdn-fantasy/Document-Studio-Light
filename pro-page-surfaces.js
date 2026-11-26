'use strict';
(()=>{
const P=FTEPro;
function photoPicker(e){
 const slot=e.target.closest('.photo-slot');
 if(!slot||(e.type==='keydown'&&!['Enter',' '].includes(e.key)))return;
 e.preventDefault();e.stopImmediatePropagation();
 pickImage().then(src=>{const img=new Image();img.src=src;img.alt='Selected photo';slot.replaceChildren(img);layout();checkpoint();}).catch(err=>{if(err.message!=='No image selected.')say(err.message);});
}
pages.addEventListener('click',photoPicker,true);pages.addEventListener('keydown',photoPicker,true);
let activePage=0;
for(const type of ['pointerdown','focusin','keyup'])pages.addEventListener(type,e=>{
 const node=type==='keyup'?getSelection().anchorNode:e.target;
 const sheet=(node?.nodeType===1?node:node?.parentElement)?.closest('.sheet');
 if(sheet)activePage=[...pages.children].indexOf(sheet);
});
function scopeDialog(parent){
 const scope=select('Apply to',['Current page','Selected pages','Entire document'],'Current page',parent,()=>{range.parentElement.hidden=scope.value!=='Selected pages';});
 const range=field('Pages (e.g. 1-3,5)','text',String(Math.min(activePage+1,pages.children.length)),parent);range.parentElement.hidden=true;
 return (key,value)=>{
  const map=extra.pageSettings??={};const total=pages.children.length;
  if(scope.value==='Entire document'){for(const entry of Object.values(map))delete entry[key];(extra.pageDefaults??={})[key]=value;return;}
  const targets=new Set();
  if(scope.value==='Current page')targets.add(Math.min(activePage,total-1));else for(const part of range.value.split(',')){
   const m=/^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part),a=Number(m?.[1]),b=Number(m?.[2]||a);
   if(!m||a<1||b<a||b>total)throw Error('Enter existing page numbers or ranges.');for(let i=a;i<=b;i++)targets.add(i-1);
  }
  for(const i of targets)(map[i]??={})[key]=value;
 };
}
const options=i=>({...extra.pageDefaults,...extra.pageSettings?.[i]});
const previous=newPage;
newPage=function(){
 const b=previous(),s=b.parentElement,i=pages.children.length-1,v=options(i);
 if(v.orientation){const landscape=v.orientation==='Landscape';s.style.width=(landscape?Math.max(W,H):Math.min(W,H))+'px';s.style.height=(landscape?Math.min(W,H):Math.max(W,H))+'px';}
 const surface=extra.surfaceAssets?.[v.surface];
 if(surface&&/^data:image\/jpeg;base64,/.test(surface.render)){s.dataset.surface=v.surface;s.style.backgroundColor=surface.color;s.style.backgroundImage='url("'+surface.render+'")';s.style.backgroundSize='100% 100%';}
 return b;
};
function orientation(){
 const d=modal('Page orientation','<div class="row" id="orient-fields"></div>',[['Apply',()=>{try{apply('orientation',choice.value);layout();checkpoint();d.close();}catch(e){say(e.message);}}]]);
 const row=d.querySelector('.row'),s=pages.children[activePage]||pages.firstElementChild;
 const choice=select('Page orientation',['Portrait','Landscape'],s.offsetWidth>s.offsetHeight?'Landscape':'Portrait',row,()=>{}),apply=scopeDialog(row);
}
function surfaces(){
 const d=modal('Page background and texture','<div id="surface-fields"></div><canvas width="300" height="400" style="max-height:22vh"></canvas><p role="status"></p>',[]);
 const fields=d.querySelector('#surface-fields'),canvas=d.querySelector('canvas'),status=d.querySelector('[role=status]');
 const apply=scopeDialog(fields),catalog=window.FTESurfaceFiles;
 let source='',serial=0;
 const asset=select('Texture or artwork',[['','Choose an image'],...catalog.map(n=>[n,n.replace(/^A4_BG_\d+_/,'').replace(/_/g,' ').replace('.jpg','')]),['import','Imported image']],'',fields,async()=>{if(asset.value==='import'){importer.click();return;}source=asset.value?'assets/page-surfaces/'+asset.value:'';preview();});
 const importer=document.createElement('input');importer.type='file';importer.accept='image/*';importer.onchange=()=>{const f=importer.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{source=r.result;preview();};r.readAsDataURL(f);};
 const color=field('Page color','color','#fff8eb',fields,preview),strength=field('Strength (%)','number',24,fields,preview),scaleControl=field('Scale (%)','number',100,fields,preview),angle=field('Rotation (degrees)','number',0,fields,preview);
 const placement=select('Placement',['Full page','Mirror tile'],'Full page',fields,preview),include=field('Print / export backgrounds','checkbox','',fields);include.checked=extra.printSurface!==false;
 const bounded=(input,lo,hi)=>Math.min(hi,Math.max(lo,Number(input.value)||0));
 function settings(){return {source,name:asset.value,color:color.value,strength:bounded(strength,0,100),scale:bounded(scaleControl,10,400),angle:bounded(angle,-360,360),placement:placement.value};}
 async function paint(c,v){
  const g=c.getContext('2d'),w=c.width,h=c.height;g.fillStyle=v.color;g.fillRect(0,0,w,h);if(!v.source)return;
  const im=new Image();im.src=v.source;await im.decode();
  g.save();g.translate(w/2,h/2);g.rotate(v.angle*Math.PI/180);g.globalAlpha=v.strength/100;
  if(/texture/i.test(v.name)){g.filter='grayscale(1)';g.globalCompositeOperation='multiply';}
  const k=(v.placement==='Mirror tile'?w/3/im.width:Math.max(w/im.width,h/im.height))*v.scale/100;
  const iw=im.width*k,ih=im.height*k,L=Math.hypot(w,h);
  if(v.placement==='Mirror tile'){for(let x=-Math.ceil(L/iw);x<=Math.ceil(L/iw);x++)for(let y=-Math.ceil(L/ih);y<=Math.ceil(L/ih);y++){g.save();g.translate(x*iw,y*ih);g.scale(x%2?-1:1,y%2?-1:1);g.drawImage(im,-iw/2,-ih/2,iw+.5,ih+.5);g.restore();}}else g.drawImage(im,-iw/2,-ih/2,iw,ih);g.restore();
 }
 async function preview(){const id=++serial,c=canvas.cloneNode();try{await paint(c,settings());if(id===serial)canvas.getContext('2d').drawImage(c,0,0);}catch(e){status.textContent=e.message;}}
 const presets=JSON.parse(localStorage.getItem('fte-page-presets')||'{}');
 const preset=select('Preset',['Choose preset',...Object.keys(presets)],'Choose preset',fields,()=>{const v=presets[preset.value];if(!v)return;asset.value=v.name;source=v.source;color.value=v.color;strength.value=v.strength;scaleControl.value=v.scale;angle.value=v.angle;placement.value=v.placement;preview();});
 const name=field('Preset name','text','',fields);
 button('Save preset',()=>{try{if(!name.value.trim())throw Error('Enter a preset name.');const key=name.value.trim();presets[key]=settings();localStorage.setItem('fte-page-presets',JSON.stringify(presets));if(![...preset.options].some(o=>o.value===key))preset.add(new Option(key,key));status.textContent='Preset saved.';}catch(e){status.textContent=e.message;}},fields);
 async function commit(remove){try{if(remove)apply('surface',null);else{const v=settings(),c=document.createElement('canvas');c.width=1000;c.height=Math.round(1000*H/W);await paint(c,v);const key=crypto.randomUUID();apply('surface',key);(extra.surfaceAssets??={})[key]={...v,render:c.toDataURL('image/jpeg',.9)};}extra.printSurface=include.checked;layout();checkpoint();d.close();}catch(e){status.textContent=e.message;}}
 const current=extra.surfaceAssets?.[options(Math.min(activePage,pages.children.length-1)).surface];
 if(current){asset.value=current.name;source=current.source;color.value=current.color;strength.value=current.strength;scaleControl.value=current.scale;angle.value=current.angle;placement.value=current.placement;}
 button('Apply',()=>commit(false),fields);button('Remove texture',()=>commit(true),fields);preview();
}
function fitPageAnchors(){
 for(const sheet of pages.children){
  const w=parseFloat(sheet.style.width),h=parseFloat(sheet.style.height);
  for(const n of sheet.querySelectorAll('[data-pro-anchor]')){
   let a;try{a=JSON.parse(n.dataset.proAnchor);}catch{continue;}
   if(a.anchor!=='Page'||a.wrap!=='None')continue;
   const gap=Math.max(0,Math.min(100,Number(a.gap)||0));n.style.maxWidth=Math.max(1,w-2*M-2*gap)+'px';
   if(n.tagName==='IMG')n.style.maxHeight=Math.max(1,h-2*M-2*gap)+'px';
   n.style.left=Math.max(M,Math.min(M+(Number(a.x)||0),w-M-n.offsetWidth-2*gap))+'px';
   n.style.top=Math.max(M,Math.min(M+(Number(a.y)||0),h-M-n.offsetHeight-2*gap))+'px';
  }
 }
}
const baseLayout=layout;layout=function(...args){const result=baseLayout(...args);fitPageAnchors();return result;};
const baseLoad=loadState;loadState=function(...args){const result=baseLoad(...args);fitPageAnchors();return result;};
window.FTEPageSurface={orientation,surfaces};
P.add('Page orientation',orientation,'Layout','portrait landscape selected pages');
P.add('Page texture',surfaces,'Layout','paper color texture background presets');
})();
(()=>{
 const previous=renderSide;
 renderSide=function(){
  previous();if(activePanel!=='Navigation')return;
  const strip=document.createElement('div');strip.setAttribute('aria-label','Page thumbnails');side.append(strip);
  for(const [index,sheet] of [...pages.children].entries()){
   const thumb=button('Page '+(index+1),()=>sheet.scrollIntoView({block:'start'}),strip);
   const frame=document.createElement('div'),copy=sheet.cloneNode(true),ratio=92/sheet.offsetWidth;
   frame.style.cssText='position:relative;overflow:hidden;pointer-events:none;width:92px;height:'+sheet.offsetHeight*ratio+'px';
   copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));copy.inert=true;copy.setAttribute('aria-hidden','true');
   copy.style.cssText+=';margin:0;position:absolute;left:0;top:0;transform-origin:0 0;transform:scale('+ratio+')';frame.append(copy);thumb.prepend(frame);
  }
 };
})();
