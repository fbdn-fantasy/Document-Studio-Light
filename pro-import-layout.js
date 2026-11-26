/* Positioned, editable document imports. All colors belong to the document. */
'use strict';
(()=>{
 const css=document.createElement('style');css.textContent=`
 .page-body .ds-import-page{position:relative;isolation:isolate;box-sizing:border-box;overflow:hidden;margin:0;padding:0;break-inside:avoid;color:#000;background:#fff;line-height:1.15}
 .page-body .ds-import-background{position:absolute;inset:0;width:100%;height:100%;max-width:none!important;max-height:none!important;pointer-events:none;user-select:none;z-index:0;margin:0}
 .page-body .ds-import-block{position:absolute;box-sizing:border-box;margin:0;padding:0;z-index:1;color:#000;overflow:visible;white-space:pre-wrap}
 .page-body .ds-import-text{font-family:Arial,sans-serif;overflow-wrap:normal;white-space:pre}
 .page-body .ds-import-block p{margin:0;padding:0;line-height:inherit}
 .page-body .ds-import-block table{white-space:normal;margin:0;max-width:none}
 .page-body .ds-import-block:focus-within{outline:1px dashed #7b59a5;outline-offset:2px}
 body.ds-import-review .ds-import-block[data-ds-uncertain=true]{outline:2px dashed #b97700}
 @media print{.page-body .ds-import-block{outline:none!important}.ds-import-page{break-inside:avoid!important}body.ds-import-document #pages-container{width:auto!important}body.ds-import-document #editor-wrap{display:block!important}body.ds-import-document #zoom-frame{width:auto!important}}
 `;document.head.append(css);
 const point=n=>{const s=String(n||'0');return (parseFloat(s)||0)*(s.endsWith('px')?.75:s.endsWith('in')?72:s.endsWith('mm')?72/25.4:1);};
 const originalLayout=layout;
 function refresh(){
  document.body.classList.toggle('ds-import-document',!!pages.querySelector('.ds-import-page'));
  for(const page of pages.querySelectorAll('.ds-import-page')){
   const w=+page.dataset.dsWidth,h=+page.dataset.dsHeight;
   if(!(w>=36&&w<=3750&&h>=36&&h<=3750))continue;
   const sheet=page.closest('.sheet');if(sheet){sheet.style.width=w*4/3+'px';sheet.style.height=h*4/3+'px';sheet.style.padding='0';sheet.style.setProperty('--margin','0px');}
   for(const b of page.querySelectorAll('.ds-import-block')){b.dataset.dsUncertain=String(+b.dataset.dsConfidence<.85);}
  }
  // Existing print support emits named @page rules for each sheet; update after
  // replacing temporary maximum dimensions with the individual source sizes.
  if(typeof updatePrintStyle==='function')updatePrintStyle();
 }
 layout=function(...args){const v=originalLayout(...args);refresh();return v;};
 const oldLoad=loadState;loadState=function(...args){const v=oldLoad(...args);refresh();return v;};
 const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');
 async function packageHash(z){
  const entries=Object.keys(z.files).filter(n=>!z.files[n].dir&&n!=='document-studio/project.json').sort();
  if(entries.length>10000)throw Error('DOCX contains too many parts.');
  let size=0;const parts=[];
  for(const name of entries){if((z.files[name]._data?.uncompressedSize||0)>256*1024*1024-size)throw Error('DOCX expanded size exceeds the safe limit.');const prefix=new TextEncoder().encode(name+'\0'),bytes=await z.file(name).async('uint8array');size+=prefix.length+bytes.length;if(size>256*1024*1024)throw Error('DOCX expanded size exceeds the safe limit.');parts.push(prefix,bytes);}
  const all=new Uint8Array(size);let pos=0;for(const part of parts){all.set(part,pos);pos+=part.length;}return digest(all);
 }
 const oldOpen=$('file-input').onchange;
 $('file-input').onchange=async e=>{
  const f=e.target.files?.[0];if(f&&/\.docx$/i.test(f.name)){
   let saved=null;
   try{const z=await JSZip.loadAsync(await f.arrayBuffer());const part=z.file('document-studio/project.json');if(part&&(part._data?.uncompressedSize||0)<64*1024*1024){const data=await part.async('string');if(data.length<64*1024*1024){const o=JSON.parse(data);if(o.packageHash===await packageHash(z)&&o.project?.format==='ForbiddenStudio'&&o.project.html?.includes('ds-import-page'))saved=o.project;}}}catch(err){console.warn('Document Studio Light layout metadata unavailable',err);}
   if(saved){if(!window.desktop&&dirty&&!confirm('Replace the current document? Save your work first if needed.'))return;loadState(validateProject(saved));checkpoint();dirty=false;e.target.value='';say('Opened editable Document Studio Light layout.');return true;}
  }
  return oldOpen(e);
 };
 async function imageRun(src,w,h,D,floating){
  if(!/^data:image\/(png|jpeg);base64,/i.test(src||''))return null;
  return new D.ImageRun({type:src.startsWith('data:image/jpeg')?'jpg':'png',data:Uint8Array.from(atob(src.split(',')[1]),c=>c.charCodeAt(0)),transformation:{width:w*4/3,height:h*4/3},floating});
 }
 function rgb(value){const m=value?.match(/\d+/g);return m&&m.length>=3?m.slice(0,3).map(x=>Math.max(0,Math.min(255,+x)).toString(16).padStart(2,'0')).join(''):'000000';}
 function textRuns(node,D){
  if(node.nodeType===3){const s=getComputedStyle(node.parentElement);return [new D.TextRun({text:node.textContent,font:s.fontFamily.split(',')[0].replace(/["']/g,''),size:Math.max(2,Math.round(parseFloat(s.fontSize)*1.5)),color:rgb(s.color),bold:parseInt(s.fontWeight)>=600,italics:s.fontStyle==='italic',underline:s.textDecorationLine.includes('underline')?{}:undefined,strike:s.textDecorationLine.includes('line-through')})];}
  if(node.nodeType!==1)return[];if(node.tagName==='BR')return[new D.TextRun({break:1})];return [...node.childNodes].flatMap(n=>textRuns(n,D));
 }
 async function richRuns(node,D){
  if(node.nodeType===3||node.nodeType===1&&node.tagName==='BR')return textRuns(node,D);
  if(node.nodeType!==1)return[];
  if(node.tagName==='IMG'){
   await node.decode().catch(()=>{});const r=node.getBoundingClientRect(),w=(r.width||node.width||node.naturalWidth)/scale*.75,h=(r.height||node.height||node.naturalHeight)/scale*.75;
   let src=node.src;if(!/^data:image\/(png|jpeg);base64,/i.test(src)){const c=document.createElement('canvas');c.width=node.naturalWidth;c.height=node.naturalHeight;c.getContext('2d').drawImage(node,0,0);src=c.toDataURL();}
   const run=await imageRun(src,w,h,D);return run?[run]:[];
  }
  const out=[];for(const child of node.childNodes)out.push(...await richRuns(child,D));
  if(node.tagName==='A'&&/^https?:/i.test(node.href))return[new D.ExternalHyperlink({link:node.href,children:out})];
  return out;
 }
 async function ordinaryBlocks(parent,D){
  const out=[];
  for(const el of parent.childNodes){
   if(el.nodeType===3){if(el.textContent.trim())out.push(new D.Paragraph({children:await richRuns(el,D)}));continue;}
   if(el.nodeType!==1||el.matches('.ds-import-page,.page-break'))continue;
   if(el.tagName==='TABLE'){
    const rows=[];for(const row of el.rows){const cells=[];for(const cell of row.cells){const nested=await ordinaryBlocks(cell,D);cells.push(new D.TableCell({rowSpan:cell.rowSpan>1?cell.rowSpan:undefined,columnSpan:cell.colSpan>1?cell.colSpan:undefined,children:nested.length?nested:[new D.Paragraph({children:await richRuns(cell,D)})]}));}rows.push(new D.TableRow({children:cells}));}out.push(new D.Table({rows,width:{size:100,type:D.WidthType.PERCENTAGE}}));
   }else if(el.matches('UL,OL')){for(const li of el.children)out.push(new D.Paragraph({bullet:el.tagName==='UL'?{level:0}:undefined,children:[...(el.tagName==='OL'?[new D.TextRun(String([...el.children].indexOf(li)+1)+'. ')]:[]),...await richRuns(li,D)]}));}
   else if(el.tagName==='DIV'&&el.querySelector(':scope > p,:scope > table,:scope > div'))out.push(...await ordinaryBlocks(el,D));
   else out.push(new D.Paragraph({heading:/^H[1-6]$/.test(el.tagName)?D.HeadingLevel['HEADING_'+el.tagName[1]]:undefined,alignment:{center:D.AlignmentType.CENTER,right:D.AlignmentType.RIGHT,justify:D.AlignmentType.JUSTIFIED}[getComputedStyle(el).textAlign],children:await richRuns(el,D)}));
  }
  return out;
 }
 function safeMath(xml,D,size=12){
  if(!xml||xml.length>1000000)return null;
  const x=new DOMParser().parseFromString(xml,'application/xml');
  if(x.querySelector('parsererror')||x.documentElement.localName!=='oMath'||[...x.querySelectorAll('*')].some(n=>n.namespaceURI!=='http://schemas.openxmlformats.org/officeDocument/2006/math'))return null;
  const wns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  for(const run of x.getElementsByTagNameNS('http://schemas.openxmlformats.org/officeDocument/2006/math','r')){const props=x.createElementNS(wns,'w:rPr');for(const tag of ['sz','szCs']){const s=x.createElementNS(wns,'w:'+tag);s.setAttributeNS(wns,'w:val',String(Math.round(Math.max(4,size)*2)));props.append(s);}run.prepend(props);}
  const parsed=D.ImportedXmlComponent.fromXmlString(new XMLSerializer().serializeToString(x.documentElement));
  // The library parses a complete XML document into a dummy root.
  return parsed.rootKey===undefined||parsed.rootKey==='_attr'?parsed:parsed.rootKey==='m:oMath'?parsed:parsed.root?.find(c=>c&&c.rootKey==='m:oMath')||parsed;
 }
 const oldExport=exportDocx;
 exportDocx=async function(background=false){
  if(!background)layout();const imported=[...pages.querySelectorAll('.ds-import-page')];if(!imported.length)return oldExport(background);
  const D=docx,sections=[];
  for(const page of imported){
   const w=+page.dataset.dsWidth,h=+page.dataset.dsHeight,children=[];
   const bg=page.querySelector('.ds-import-background');if(bg){const im=await imageRun(bg.src,w,h,D,{horizontalPosition:{relative:'page',offset:0},verticalPosition:{relative:'page',offset:0},behindDocument:true,allowOverlap:true,zIndex:0});if(im)children.push(new D.Paragraph({spacing:{before:0,after:0,line:1},children:[im]}));}
   for(const b of page.querySelectorAll(':scope > .ds-import-block')){
    const x=point(b.style.left),y=point(b.style.top),bw=point(b.style.width),bh=Math.max(point(b.style.minHeight),b.scrollHeight*.75);
    const frame={type:'absolute',position:{x:Math.round(x*20),y:Math.round(y*20)},width:Math.round(bw*20),height:Math.round(bh*20),rule:'atLeast',wrap:'none',anchor:{horizontal:'page',vertical:'page'}};
    const table=b.querySelector('table');
    if(table){
     const rows=[];for(const row of table.rows){const cells=[];for(const cell of row.cells){const s=getComputedStyle(cell);cells.push(new D.TableCell({rowSpan:cell.rowSpan>1?cell.rowSpan:undefined,columnSpan:cell.colSpan>1?cell.colSpan:undefined,verticalAlign:'center',children:[new D.Paragraph({spacing:{before:0,after:0,line:240},children:await richRuns(cell,D)})],margins:{top:Math.round(point(s.paddingTop)*20),bottom:Math.round(point(s.paddingBottom)*20),left:Math.round(point(s.paddingLeft)*20),right:Math.round(point(s.paddingRight)*20)}}));}rows.push(new D.TableRow({height:row.style.height?{value:Math.round(point(row.style.height)*20),rule:'atLeast'}:undefined,children:cells}));}
     const widths=[...table.querySelectorAll('col')].map(c=>Math.round(point(c.style.width)*20));
     children.push(new D.Table({rows,columnWidths:widths.length?widths:undefined,width:{size:Math.round(bw*20),type:D.WidthType.DXA},layout:D.TableLayoutType.FIXED,float:{horizontalAnchor:'page',verticalAnchor:'page',absoluteHorizontalPosition:Math.round(x*20),absoluteVerticalPosition:Math.round(y*20),overlap:'overlap'},borders:Object.fromEntries(['top','left','bottom','right','insideHorizontal','insideVertical'].map(k=>[k,{style:D.BorderStyle.SINGLE,size:4,color:'555555'}]))}));
    }else if(b.dataset.dsType==='formula'&&safeMath(b.dataset.dsOmml,D,+b.dataset.dsMathSize||bh*.95))children.push(new D.Paragraph({frame,spacing:{before:0,after:0,line:240},children:[safeMath(b.dataset.dsOmml,D,+b.dataset.dsMathSize||bh*.95)]}));
    else if(b.querySelector('img')){const im=await imageRun(b.querySelector('img').src,bw,bh,D,{horizontalPosition:{relative:'page',offset:Math.round(x*12700)},verticalPosition:{relative:'page',offset:Math.round(y*12700)},behindDocument:false,allowOverlap:true,zIndex:1});if(im)children.push(new D.Paragraph({spacing:{before:0,after:0,line:1},children:[im]}));}
    else children.push(new D.Paragraph({frame,spacing:{before:0,after:0,line:240},children:await richRuns(b,D)}));
   }
   children.push(new D.Paragraph({spacing:{before:0,after:0,line:1},children:[new D.TextRun({text:'',size:2})]}));
   sections.push({properties:{type:D.SectionType.NEXT_PAGE,page:{size:{width:Math.round(Math.min(w,h)*20),height:Math.round(Math.max(w,h)*20),orientation:w>h?'landscape':'portrait'},margin:{top:0,bottom:0,left:0,right:0,header:0,footer:0}}},children});
  }
  // Preserve user-added ordinary paragraphs outside imported pages as a section.
  const loose=[];for(const body of pages.querySelectorAll('.page-body'))loose.push(...await ordinaryBlocks(body,D));
  if(loose.length)sections.push({children:loose});
  const blob=await D.Packer.toBlob(new D.Document({creator:'Document Studio Light',title:$('doc-name').value,sections}));
  const z=await JSZip.loadAsync(await blob.arrayBuffer());
  const types=await z.file('[Content_Types].xml').async('string');z.file('[Content_Types].xml',types.replace('</Types>','<Default Extension="json" ContentType="application/json"/></Types>'));
  z.file('document-studio/project.json',JSON.stringify({packageHash:await packageHash(z),project:{...state(),format:'ForbiddenStudio',version:2}}));
  return z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE',compressionOptions:{level:9}});
 };
 function editRegion(b){
  const fields=[['x','Left (points)','number',point(b.style.left)],['y','Top (points)','number',point(b.style.top)],['width','Width (points)','number',point(b.style.width)],['height','Minimum height (points)','number',point(b.style.minHeight)]];
  FTEPro.form('Imported document region',fields,v=>{for(const k of ['x','y','width','height'])if(!Number.isFinite(+v[k])||+v[k]<0||+v[k]>3750)throw Error('Use dimensions from 0 to 3750 points.');b.style.left=+v.x+'pt';b.style.top=+v.y+'pt';b.style.width=Math.max(1,+v.width)+'pt';b.style.minHeight=Math.max(1,+v.height)+'pt';layout();checkpoint();});
 }
 function mathXml(latex){
  const holder=document.createElement('div');holder.innerHTML=katex.renderToString(latex,{output:'mathml',throwOnError:true,trust:false});const root=holder.querySelector('math'),ns='http://schemas.openxmlformats.org/officeDocument/2006/math',doc=document.implementation.createDocument(ns,'m:oMath');
  const el=(tag,children=[],text=null)=>{const e=doc.createElementNS(ns,'m:'+tag);if(text!==null)e.textContent=text;for(const c of children){if(['oMath','e','num','den','sup','sub','deg'].includes(tag)&&c.localName==='e')e.append(...c.childNodes);else e.append(c);}return e;};
  const group=(tag,children)=>el(tag,children.map(convert));
  function convert(n){const tag=n.localName,c=[...n.children];if(['math','mrow','mstyle','semantics'].includes(tag))return group('e',c.filter(x=>x.localName!=='annotation'));if(['mi','mn','mo','mtext','ms'].includes(tag))return el('r',[el('t',[],n.textContent)]);if(tag==='mspace')return el('r',[el('t',[],' ')]);if(tag==='mfrac')return el('f',[group('num',c.slice(0,1)),group('den',c.slice(1))]);if(tag==='msup')return el('sSup',[group('e',c.slice(0,1)),group('sup',c.slice(1))]);if(tag==='msub')return el('sSub',[group('e',c.slice(0,1)),group('sub',c.slice(1))]);if(tag==='msubsup')return el('sSubSup',[group('e',c.slice(0,1)),group('sub',c.slice(1,2)),group('sup',c.slice(2))]);if(['msqrt','mroot'].includes(tag))return el('rad',[group('deg',tag==='mroot'?c.slice(1):[]),group('e',tag==='mroot'?c.slice(0,1):c)]);if(tag==='mtable')return el('m',c.map(r=>el('mr',[...r.children].map(x=>group('e',[...x.children])))));
   throw Error('This equation will be preserved as an image in Word.');}
  const converted=convert(root);doc.documentElement.append(...converted.childNodes);return new XMLSerializer().serializeToString(doc.documentElement);
 }
 function editFormula(b){
  const d=modal('Edit imported equation','<math-field id="ds-import-math" aria-label="Equation" style="display:block;background:white;color:black;font-size:24px;padding:12px"></math-field><div id="ds-import-math-preview" style="padding:18px;background:white;color:black"></div><p id="ds-import-math-status"></p>',[['Apply',async()=>{
   const latex=$('ds-import-math').value;let xml='';katex.render(latex,$('ds-import-math-preview'),{throwOnError:true,trust:false,displayMode:true});try{xml=mathXml(latex);}catch{}
   await document.fonts.ready;const rendered=$('ds-import-math-preview').querySelector('.katex')||$('ds-import-math-preview');const canvas=await html2canvas(rendered,{backgroundColor:'#ffffff',scale:2,logging:false});const img=b.querySelector('img'),bw=point(b.style.width),bh=bw*canvas.height/canvas.width;img.src=canvas.toDataURL();img.alt='Equation: '+latex;img.style.width=bw+'pt';img.style.height=bh+'pt';b.style.minHeight=bh+'pt';b.dataset.dsMathSize=String(parseFloat(getComputedStyle(rendered).fontSize)*.75*bw/(canvas.width/2*.75));b.dataset.dsLatex=latex;b.dataset.dsOmml=xml;b.dataset.dsConfidence='1';d.close();layout();checkpoint();say(xml?'Equation updated with editable Word mathematics.':'Equation updated. Word export will preserve its appearance as an image.');
  }]]);
  const field=$('ds-import-math');field.mathVirtualKeyboardPolicy='manual';field.value=b.dataset.dsLatex||'';const preview=()=>{try{katex.render(field.value,$('ds-import-math-preview'),{throwOnError:true,trust:false,displayMode:true});try{mathXml(field.value);$('ds-import-math-status').textContent='Editable Word equation supported.';}catch(e){$('ds-import-math-status').textContent=e.message;}}catch(e){$('ds-import-math-status').textContent=e.message;}};field.addEventListener('input',preview);preview();
 }
 // Opening the ordinary image sidebar on the first click changes fit-to-width
 // zoom and moves the target before the second click. Equations own this gesture.
 pages.addEventListener('click',e=>{if(e.target.closest('.ds-import-block[data-ds-type="formula"]'))e.stopImmediatePropagation();},true);
 pages.addEventListener('dblclick',e=>{const b=e.target.closest('.ds-import-block');if(!b)return;if(e.altKey||b.dataset.dsType==='formula'){e.preventDefault();e.stopImmediatePropagation();if(e.altKey)editRegion(b);else editFormula(b);}},true);
 if(window.FTEPro)FTEPro.add('Imported region layout',()=>{let n=getSelection().anchorNode;if(n?.nodeType===3)n=n.parentElement;const b=n?.closest?.('.ds-import-block');if(!b){say('Place the cursor in an imported region, or Alt-double-click it.');return;}editRegion(b);},'Layout','imported pdf position region size');
 async function validateRendered(report){
  const sheets=[...pages.querySelectorAll('.ds-import-page')],metrics=[],warnings=[];
  const sample=sheets.length<=10?sheets.map((_,i)=>i):Array.from({length:10},(_,i)=>Math.round(i*(sheets.length-1)/9));
  await document.fonts.ready;const wasReview=document.body.classList.contains('ds-import-review');document.body.classList.remove('ds-import-review');
  try{for(const i of sample){
   const page=sheets[i],source=report.pageDetails?.[i]?.preview;if(!source)continue;
   await Promise.all([...page.querySelectorAll('img')].map(im=>im.decode().catch(()=>{})));
   const pw=+page.dataset.dsWidth,ph=+page.dataset.dsHeight;let outside=0,overflow=0;
   for(const b of page.querySelectorAll(':scope>.ds-import-block')){const x=point(b.style.left),y=point(b.style.top),w=point(b.style.width),h=b.scrollHeight*.75;if(x<-.5||y<-.5||x+w>pw+2||y+h>ph+2)outside++;if(b.scrollWidth>b.clientWidth+8||b.dataset.dsType==='text'&&h>point(b.style.minHeight)*1.6+3)overflow++;}
   const render=await html2canvas(page,{backgroundColor:'#ffffff',scale:Math.min(1,720/(pw*4/3)),logging:false,useCORS:false});
   const im=new Image();im.src=source;await im.decode();const width=180,height=Math.max(1,Math.round(width*ph/pw));
   function pixels(image){const c=document.createElement('canvas');c.width=width;c.height=height;const g=c.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';g.fillRect(0,0,width,height);g.drawImage(image,0,0,width,height);return g.getImageData(0,0,width,height).data;}
   const a=pixels(im),b=pixels(render),aa=new Uint8Array(width*height),bb=new Uint8Array(width*height);let color=0;
   for(let k=0;k<aa.length;k++){const q=k*4,ag=(a[q]+a[q+1]+a[q+2])/3,bg=(b[q]+b[q+1]+b[q+2])/3;aa[k]=ag<220?1:0;bb[k]=bg<220?1:0;color+=(Math.abs(a[q]-b[q])+Math.abs(a[q+1]-b[q+1])+Math.abs(a[q+2]-b[q+2]))/3;}
   function near(mask,index){const x=index%width,y=Math.floor(index/width);for(let yy=Math.max(0,y-1);yy<=Math.min(height-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(width-1,x+1);xx++)if(mask[yy*width+xx])return true;return false;}
   let missing=0,total=0;for(let k=0;k<aa.length;k++){if(aa[k]){total++;if(!near(bb,k))missing++;}if(bb[k]){total++;if(!near(aa,k))missing++;}}
   const inkMismatch=total?missing/total:0,meanColorDifference=color/(aa.length*255);metrics.push({page:i+1,inkMismatch:+inkMismatch.toFixed(4),meanColorDifference:+meanColorDifference.toFixed(4),outOfBoundsBlocks:outside,overflowingBlocks:overflow});
   if(outside||overflow||inkMismatch>.25||meanColorDifference>.12)warnings.push('Page '+(i+1)+' may have a layout discrepancy'+(outside?' ('+outside+' region(s) extend past the page)':overflow?' ('+overflow+' region(s) overflow their original bounds)':'')+'. Compare its source preview and adjust imported regions as needed.');
  }}finally{document.body.classList.toggle('ds-import-review',wasReview);}
  return {status:'compared',method:'Browser page render versus source preview; low-resolution ink displacement with one-pixel tolerance',comparedPages:metrics.length,totalPages:sheets.length,metrics,warnings};
 }
 window.DocumentStudioImportLayout={refresh,editRegion,validateRendered,reviewUncertain(enabled=true){document.body.classList.toggle('ds-import-review',enabled);refresh();},focus(id){const b=[...pages.querySelectorAll('.ds-import-block')].find(n=>n.dataset.dsId===id);if(!b)return false;b.scrollIntoView({block:'center'});const r=document.createRange();r.selectNodeContents(b);getSelection().removeAllRanges();getSelection().addRange(r);pages.focus();return true;}};
 refresh();
})();
