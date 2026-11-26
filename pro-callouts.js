// Chart annotations. A target key identifies model geometry, not a screen
// location. Its projected position is recomputed on every redraw.
'use strict';
(()=>{
 const P=FTEPro;
 const modes=[['auto','Use chart default'],['named','Show descriptor'],['blank','Empty answer box'],['line','Pointer only'],['hide','Hide this descriptor and pointer']];
 const choices=new Set(modes.map(([v])=>v));
 function valid(s){
   if(!s||s.calloutOverrides===undefined)return;
   if(!s.calloutOverrides||typeof s.calloutOverrides!=='object'||Array.isArray(s.calloutOverrides)||Object.entries(s.calloutOverrides).some(([k,v])=>k.length>600||!choices.has(v)))throw Error('Invalid diagram callout settings.');
 }
 const mode=(s,id)=>Object.hasOwn(s.calloutOverrides||{},id)?s.calloutOverrides[id]:'auto';
 function uid(o){return o.calloutId||(o.calloutId=crypto.randomUUID());}
 function resize(canvas,w,h,density=2){
   if(canvas.width!==w*density||canvas.height!==h*density){canvas.width=w*density;canvas.height=h*density;}
   canvas.getContext('2d').setTransform(density,0,0,density,0,0);
 }
 function draw(canvas,s,targets,w,h,options={}){
   const ctx=options.context||canvas.getContext('2d'),byKey=new Map();
   for(const t of targets){if(t&&t.key&&Number.isFinite(t.x)&&Number.isFinite(t.y)&&!byKey.has(t.key))byKey.set(t.key,t);}
   canvas.fteTargets=[...byKey.values()];canvas.fteBoxes=[];
   const candidates=canvas.fteTargets.filter(t=>t.visible!==false&&t.x>=2&&t.x<=w-2&&t.y>=h*.063&&t.y<=h*.93).map(t=>{
     const explicit=mode(s,t.key);
     return {...t,explicit,style:explicit==='auto'?(t.eligible===false?'hide':(options.defaultMode||'hide')):explicit};
   }).filter(t=>t.style!=='hide'&&(!options.onlySelected||t.explicit!=='auto'||t.selected));
   candidates.sort((a,b)=>(a.explicit==='auto')-(b.explicit==='auto')||(a.rank??99)-(b.rank??99));
   const pages=Math.max(1,Math.ceil(candidates.length/16));
   const page=Math.max(0,Math.min(options.page||0,pages-1)),batch=candidates.slice(page*16,page*16+16);
   if(options.pages)options.pages(page,pages);
   // Sort spatially, then distribute each bank independently to avoid crossings.
   batch.sort((a,b)=>a.x-b.x);const half=batch.length===1&&batch[0].x>w/2?0:Math.ceil(batch.length/2);
   const banks=[batch.slice(0,half),batch.slice(half)],pad=w*.014,bw=w*.187,bh=Math.max(19,h*.047);
   ctx.save();ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);ctx.globalAlpha=1;ctx.filter='none';ctx.setLineDash([]);ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineJoin='round';
   for(let side=0;side<2;side++){
     const rows=banks[side].sort((a,b)=>a.y-b.y);
     for(let i=0;i<rows.length;i++){
       const t=rows[i],x=side?w-pad-bw:pad;
       const preferred=rows.length===1?t.y:(h*.12+(h*.75)*i/Math.max(1,rows.length-1));
       const y=Math.max(h*.09,Math.min(h*.88,preferred)),edge=side?x:x+bw;
       const style=canvas.fteMemo&&['line','blank'].includes(t.style)?'named':t.style;
       if(options.leaders!==false||t.style==='line'||t.explicit==='blank'){
         ctx.strokeStyle='#59636c';ctx.lineWidth=Math.max(1,w/850);ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(edge+(side?-1:1)*w*.015,y);ctx.lineTo(edge,y);ctx.stroke();
         ctx.fillStyle='#364e5b';ctx.beginPath();ctx.arc(t.x,t.y,Math.max(1.6,w*.0022),0,Math.PI*2);ctx.fill();
       }
       if(style!=='line'){
         ctx.fillStyle='rgba(255,255,255,.97)';ctx.fillRect(x,y-bh/2,bw,bh);
         if(style==='blank'||canvas.fteMemo){ctx.strokeStyle='#59636c';ctx.lineWidth=w/760;ctx.strokeRect(x,y-bh/2,bw,bh);}
         if(style==='named'){ctx.fillStyle='#222836';ctx.font='500 '+Math.max(11,w*.016)+'px Arial';ctx.fillText(t.name,x+w*.006,y,bw-w*.012);}
       }
       canvas.fteBoxes.push({...t,boxX:x+bw/2,boxY:y,boxW:bw,boxH:bh,w,h});
     }
   }ctx.restore();canvas.fteCalloutsSync?.();return {pages,total:candidates.length};
 }
 function attach(canvas,get,redraw,host,subject,settings={}){
   const box=document.createElement('details');box.className='fte-quiz-labels';
   const summary=document.createElement('summary');summary.textContent='Chart labels · individual descriptors';box.append(summary);
   const nav=canvas.closest('dialog')?.querySelector('.diagram-nav');
   if(nav)nav.after(box);else if(host)host.prepend(box);else canvas.before(box);
   const search=field('Find descriptor','search','',box),targets=select('Descriptor target',[],'',box,()=>sync(true));
   const display=select('Selected descriptor',modes,'auto',box,v=>{
     if(!targets.value)return;
     const s=get(),over={...(s.calloutOverrides||{})};if(v==='auto')delete over[targets.value];else over[targets.value]=v;s.calloutOverrides=over;
     redraw();
   });
   button('Reset individual descriptors',()=>{get().calloutOverrides={};redraw();},box);
   if(settings.focus)button('Frame this target',()=>settings.focus(targets.value),box);
   let signature='',last='';
   function sync(force=false){
     if(!canvas.fteTargets)return;
     const rows=canvas.fteTargets.filter(t=>t.name.toLowerCase().includes(search.value.toLowerCase()));
     const sig=rows.map(t=>t.key+'|'+t.name).join('\n');
     if(signature!==sig){const chosen=targets.value||last;targets.replaceChildren(...rows.map(t=>new Option(t.name,t.key)));
       if(rows.some(t=>t.key===chosen))targets.value=chosen;signature=sig;}
     if(targets.value)last=targets.value;display.value=mode(get(),targets.value);display.disabled=!targets.value;
   }
   canvas.fteChooseDescriptor=key=>{if(!canvas.fteTargets?.some(t=>t.key===key))return;search.value='';sync();targets.value=key;sync(true);};
   search.oninput=()=>sync(true);canvas.fteCalloutsSync=sync;sync();return box;
 }
 const style=document.createElement('style');style.textContent='.fte-quiz-labels{margin:5px 0;padding:6px 9px;border:1px solid var(--border);border-radius:6px}.fte-quiz-labels>summary{cursor:pointer;font-weight:600;color:var(--accent)}.fte-quiz-labels label{display:inline-flex!important;align-items:center;gap:4px;margin:4px 7px 4px 0}.fte-quiz-labels select{max-width:240px}.fte-quiz-labels button{margin:2px 4px}dialog.diagram-full>.fte-quiz-labels{order:-2;max-height:14vh;overflow:auto}';document.head.append(style);
 P.callouts={attach,draw,mode,uid,resize,valid};
})();
