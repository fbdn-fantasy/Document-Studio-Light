'use strict';
(()=>{
 const P=FTEPro;
 let citationCache='';const processed=new WeakMap();
 function citations(){if(P.citationClusters)return P.citationClusters.refresh();const sources=P.data().cslSources||[],key=JSON.stringify(sources)+[...pages.querySelectorAll('[data-pro-citation],[data-pro-bibliography]')].map(n=>n.dataset.proCitation||n.dataset.proBibliography).join('');citationCache=key;
  for(const n of pages.querySelectorAll('[data-pro-citation]')){if(processed.get(n)===key)continue;processed.set(n,key);try{const v=JSON.parse(n.dataset.proCitation);n.textContent=sources.some(x=>x.id===v.id)?new FTECite(sources).format('citation',{format:'text',template:v.style,lang:v.lang,entry:[v.id]}):'[Missing citation source]';}catch{n.textContent='[Invalid citation]';}}
  for(const n of pages.querySelectorAll('[data-pro-bibliography]')){if(processed.get(n)===key)continue;processed.set(n,key);try{const v=JSON.parse(n.dataset.proBibliography);n.innerHTML='<h2>References</h2>'+sanitize(new FTECite(sources).format('bibliography',{format:'html',template:v.style,lang:v.lang}));}catch{n.textContent='[Bibliography needs valid sources]';}}
 }
 function watermarks(){const v=P.data().watermark;if(!v)return;for(const [i,sheet]of [...pages.children].entries()){
  const page=i+1,allowed=(!v.first||page===1)&&(!v.pages?.trim()||v.pages.split(',').some(part=>{const [a,b]=part.trim().split('-').map(Number);return page>=a&&page<=(b||a);}));
  sheet.querySelectorAll('.pro-watermark-layer').forEach(n=>n.remove());const original=sheet.querySelector('.sheet-watermark');if(original)original.style.display='none';if(!allowed||(!extra.watermark&&!v.image))continue;
  const layer=document.createElement('div');layer.className='pro-watermark-layer';layer.contentEditable='false';layer.setAttribute('aria-hidden','true');layer.style.cssText='position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:'+(v.above?'5':'0');
  const positions=v.repeat?Array.from({length:12},(_,j)=>({x:17+(j%3)*33,y:12+Math.floor(j/3)*25})):[{x:Math.max(0,Math.min(100,+v.x||50)),y:Math.max(0,Math.min(100,+v.y||50))}];
  for(const pos of positions){const node=document.createElement(v.image?'img':'div');if(v.image){node.src=v.image;node.style.width=Math.max(24,(+v.size||64)*3)+'px';}else{node.textContent=extra.watermark;node.style.fontSize=Math.max(8,+v.size||64)+'px';node.style.color=v.color||'#555';node.style.whiteSpace='nowrap';}node.style.position='absolute';node.style.left=pos.x+'%';node.style.top=pos.y+'%';node.style.opacity=Math.min(1,Math.max(0,+v.opacity||0));node.style.transform='translate(-50%,-50%) rotate('+(+v.rotation||0)+'deg)';layer.append(node);}sheet.append(layer);
 }}
 P.add('Watermark image',async()=>{const src=await pickImage();if(!src)return;P.data().watermark={color:'#555555',opacity:.12,rotation:-35,size:64,...P.data().watermark,image:src};layout();checkpoint();},'Design','image picture watermark');
 P.add('Remove watermark',()=>{extra.watermark='';delete P.data().watermark;pages.querySelectorAll('.pro-watermark-layer').forEach(n=>n.remove());layout();checkpoint();},'Design');
 const old=layout;layout=function(...args){const out=old(...args);citations();watermarks();return out;};
 const load=loadState;loadState=function(...args){citationCache='';return load(...args);};
 P.documentFinish={citations,watermarks};
})();
