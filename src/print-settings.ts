export type PrintOrientation='document'|'portrait'|'landscape';
export type PrintOptions={pages:string;orientation:PrintOrientation;color:'color'|'monochrome'};
export function parsePageRange(value:string,total:number):number[]{
 if(!Number.isInteger(total)||total<1)throw Error('The document has no pages to print.');
 if(value.trim()===''||value.trim().toLowerCase()==='all')return Array.from({length:total},(_,i)=>i);
 const result=new Set<number>();
 for(const part of value.split(',')){const match=/^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part);if(!match)throw Error('Enter page numbers or ranges, for example 1-3,5.');const first=Number(match[1]),last=Number(match[2]??first);if(first<1||last<first||last>total)throw Error(`Choose existing pages between 1 and ${total}.`);for(let i=first;i<=last;i++)result.add(i-1);}
 return Array.from(result).sort((a,b)=>a-b);
}
export function printGeometry(width:number,height:number,orientation:PrintOrientation){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid document page dimensions.');
 const targetWidth=orientation==='document'?width:orientation==='landscape'?Math.max(width,height):Math.min(width,height);
 const targetHeight=orientation==='document'?height:orientation==='landscape'?Math.min(width,height):Math.max(width,height);
 const scale=Math.min(targetWidth/width,targetHeight/height);
 return {width:targetWidth,height:targetHeight,scale,x:(targetWidth-width*scale)/2,y:(targetHeight-height*scale)/2};
}
