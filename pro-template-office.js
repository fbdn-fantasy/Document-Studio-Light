/* Express the editable template rows and independent art in Office page coordinates. */
window.FTETemplateOffice={
 measure(sheet){
  const page=sheet.getBoundingClientRect(),ratio=page.width/parseFloat(sheet.style.width);
  const rect=node=>{const r=node.getBoundingClientRect();return {x:(r.left-page.left)/ratio,y:(r.top-page.top)/ratio,w:r.width/ratio,h:r.height/ratio};};
  const filled=[...sheet.querySelectorAll('.photo-slot img')].map(im=>im.getBoundingClientRect());
  const visible=node=>{const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect(),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;return !filled.some(slot=>x>=slot.left&&x<=slot.right&&y>=slot.top&&y<=slot.bottom);};
  return {art:[...sheet.querySelectorAll('.supplied-anchor img')].map(node=>({node:node.cloneNode(true),photo:!!node.closest(".photo-slot"),round:!!node.closest(".round"),...rect(node)})),rows:[...sheet.querySelectorAll('.supplied-copy')].filter(visible).map(node=>({node:node.cloneNode(true),photo:!!node.closest(".photo-slot"),round:!!node.closest(".round"),...rect(node)}))};
 },
 async image({node,w,h,photo,round}){
  await node.decode();if(!photo&&/^data:image\/(?:png|jpeg);/.test(node.src))return node.src;
  const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w*2));c.height=Math.max(1,Math.ceil(h*2));const g=c.getContext('2d');
  if(round){g.beginPath();g.ellipse(c.width/2,c.height/2,c.width/2,c.height/2,0,0,2*Math.PI);g.clip();}
  const k=Math.max(c.width/node.naturalWidth,c.height/node.naturalHeight);g.drawImage(node,(c.width-k*node.naturalWidth)/2,(c.height-k*node.naturalHeight)/2,k*node.naturalWidth,k*node.naturalHeight);return c.toDataURL();
 },
 async word(sheet,D,runs){
  const {art,rows}=sheet,out=[],twip=x=>Math.round(x*15);
  for(const item of art){const src=await this.image(item);out.push(new D.Paragraph({spacing:{before:0,after:0,line:1},children:[new D.ImageRun({type:src.startsWith('data:image/jpeg')?'jpg':'png',data:Uint8Array.from(atob(src.split(',')[1]),c=>c.charCodeAt(0)),transformation:{width:item.w,height:item.h},floating:{horizontalPosition:{relative:'page',offset:Math.round(item.x*9525)},verticalPosition:{relative:'page',offset:Math.round(item.y*9525)},behindDocument:true,allowOverlap:true,zIndex:out.length+1}})]}));}
  for(const {node,x,y,w,h} of rows){out.push(new D.Paragraph({frame:{type:'absolute',position:{x:twip(x),y:twip(y)},width:twip(w),height:twip(h),rule:'atLeast',wrap:'none',anchor:{horizontal:'page',vertical:'page'}},spacing:{before:0,after:0,line:240},children:[new D.TextRun({text:node.textContent,font:"Arial",size:Math.round(parseFloat(node.style.fontSize)*2),bold:node.style.fontWeight==="bold"||Number(node.style.fontWeight)>=600,italics:node.style.fontStyle==="italic",color:cssHex(node.style.color).slice(1)})]}));}
  return out;
 },
 async odt(sheet,pageNumber,zip,imgfiles,node){
  const {art,rows}=sheet,parts=[];const box=({x,y,w,h})=>`text:anchor-type="page" text:anchor-page-number="${pageNumber}" svg:x="${x/96}in" svg:y="${y/96}in" svg:width="${w/96}in" svg:height="${h/96}in"`;
  for(const item of art){const src=await this.image(item),jpeg=src.startsWith('data:image/jpeg'),path='Pictures/art'+imgfiles.length+(jpeg?'.jpg':'.png');zip.file(path,src.split(',')[1],{base64:true});imgfiles.push({path,type:jpeg?'image/jpeg':'image/png'});parts.push(`<draw:frame draw:style-name="TemplateFrame" draw:z-index="${parts.length}" ${box(item)}><draw:image xlink:href="${path}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`);}
  for(const item of rows)parts.push(`<draw:frame draw:style-name="TemplateFrame" draw:z-index="${parts.length}" ${box({...item,h:item.h*1.45})}><draw:text-box><text:p>${node(item.node)}</text:p></draw:text-box></draw:frame>`);
  return '<text:p>'+parts.join('')+'</text:p>';
 }
};
