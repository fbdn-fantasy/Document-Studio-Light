import {invoke} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {jsPDF} from 'jspdf';
import {parsePageRange,printGeometry,type PrintOptions} from './print-settings';
type Callback=(value:unknown)=>void;
declare global {interface Window {documentStudioDesktop:Record<string,unknown>}}
export async function installBridge(requestPrintOptions:(total:number)=>Promise<PrintOptions|null>){
 const commands=new Set<Callback>();const progress=new Set<Callback>();
 await listen<{event:string,payload:unknown}>('service-event',({payload:m})=>{if(m.event==='command'&&m.payload==='close'&&!commands.size){void invoke('finish_close');return;}for(const fn of m.event==='command'?commands:m.event==='import-progress'?progress:[])fn(m.payload);});
 const call=(method:string,args:unknown[]=[])=>invoke('desktop_command',{method,args:JSON.parse(JSON.stringify(args,(_key,value)=>ArrayBuffer.isView(value)?Array.from(value as unknown as ArrayLike<number>):value))}).then(result=>{
  if(result&&typeof result==='object'&&!Array.isArray(result)){const value=result as Record<string,unknown>;for(const key of ['bytes','docx'])if(Array.isArray(value[key]))value[key]=new Uint8Array(value[key] as number[]);}
  return result;
 });
 const editor=()=>document.querySelector('iframe')!.contentWindow!;
 const prepare=async()=>{const w=editor() as Window & {layout:()=>void,updatePrintStyle:()=>void};w.layout();w.updatePrintStyle();await w.document.fonts.ready;await Promise.all(Array.from(w.document.images).map(i=>i.decode().catch(()=>{})));return w;};
 const pdfBytes=async()=>{const w=await prepare();const sheets=Array.from(w.document.querySelectorAll<HTMLElement>('#pages-container > .sheet'));if(!sheets.length)throw Error('No document pages to export.');let pdf:jsPDF|undefined;
 for(const sheet of sheets){const width=sheet.offsetWidth*72/96,height=sheet.offsetHeight*72/96;const orientation=width>height?'landscape':'portrait';if(!pdf)pdf=new jsPDF({unit:'pt',format:[width,height],orientation});else pdf.addPage([width,height],orientation);
 const canvas=await (w as unknown as {html2canvas:(e:HTMLElement,o:unknown)=>Promise<HTMLCanvasElement>}).html2canvas(sheet,{scale:2,width:sheet.offsetWidth,height:sheet.offsetHeight,backgroundColor:'#fff',useCORS:false,logging:false,onclone:(doc:Document)=>{for(const style of Array.from(doc.querySelectorAll('style')))style.textContent=(style.textContent??'').replace(/@media print/g,'@media all');const container=doc.getElementById('pages-container');if(container)container.style.setProperty('transform','none','important');}});pdf.addImage(canvas.toDataURL('image/jpeg',.96),'JPEG',0,0,width,height);canvas.width=canvas.height=1;}
 return Array.from(new Uint8Array(pdf!.output('arraybuffer')));};
 const api:Record<string,unknown>={};
 api.openSupportPage=()=>invoke('open_support_page');
 for(const name of ['addPersonal','suggestCJK','analyzeCJK','documentInfo','init','ackRecovery','open','chooseImport','runImport','cancelImport','importHealth','commitOpen','save','export','snapshot','recoveries','recover','settings','confirm','dirty','recent','dictionaries','dictionary','importDictionary','fonts','spell','spellSuggestions'])api[name]=(...args:unknown[])=>call(name,args);
 api.saveDocument=async(value:{format:string,bytes?:number[]})=>call('saveDocument',[value.format==='pdf'?{...value,bytes:await pdfBytes()}:value]);
 api.pdfBytes=pdfBytes;api.pdf=async(name:string)=>call('pdf',[name,await pdfBytes()]);
 api.print=async()=>{
  const w=await prepare();
  const pageSelector='#pages-container > .sheet';
  const options=await requestPrintOptions(w.document.querySelectorAll(pageSelector).length);
  if(!options)return false;
  // Pagination can replace the page elements while the settings dialog is open.
  const sheets=Array.from(w.document.querySelectorAll<HTMLElement>(pageSelector));
  document.querySelectorAll('iframe[data-print-frame]').forEach(frame=>frame.remove());
  const selected=parsePageRange(options.pages,sheets.length);const frame=document.createElement('iframe');frame.dataset.printFrame='true';frame.title='Print preview';frame.style.cssText='position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0';document.body.append(frame);
  try{
  const target=frame.contentDocument!,pw=frame.contentWindow!;target.open();target.write('<!doctype html><html><head><meta charset="utf-8"><title>Document Studio Light — Print</title></head><body></body></html>');target.close();
  const base=target.createElement('base');base.href=w.document.baseURI;target.head.append(base);
  const stylesReady:Promise<void>[]=[];
  for(const style of Array.from(w.document.querySelectorAll('style,link[rel="stylesheet"]'))){const copy=target.importNode(style,true);if(copy.tagName==='LINK')stylesReady.push(new Promise<void>(resolve=>{copy.addEventListener('load',()=>resolve(),{once:true});copy.addEventListener('error',()=>resolve(),{once:true});}));target.head.append(copy);}
  let rules='html,body{margin:0!important;padding:0!important;background:white!important;overflow:visible!important;height:auto!important} .v20-print-page{position:relative;overflow:hidden;break-after:page;break-inside:avoid;margin:0;padding:0}.v20-print-page:last-child{break-after:auto}.v20-print-page>.sheet{position:absolute!important;margin:0!important;box-shadow:none!important;transform-origin:0 0!important;page:auto!important;break-after:auto!important;break-inside:avoid!important}.v20-print-page .selected-image{outline:none!important}';
  if(options.color==='monochrome')rules+='.v20-print-page{filter:grayscale(1)!important;-webkit-filter:grayscale(1)!important}';
  for(const [order,index] of selected.entries()){
   const source=sheets[index],g=printGeometry(source.offsetWidth,source.offsetHeight,options.orientation);const wrapper=target.createElement('div');wrapper.className='v20-print-page';wrapper.style.cssText=`width:${g.width}px;height:${g.height}px;page:v20page${order}`;
   const clone=target.importNode(source,true);clone.style.setProperty('transform',`translate(${g.x}px,${g.y}px) scale(${g.scale})`,'important');
   // DOM cloning does not copy a canvas bitmap. Preserve charts and drawings.
   for(const [i,canvas] of Array.from(source.querySelectorAll('canvas')).entries()){const copy=clone.querySelectorAll('canvas')[i];const image=target.createElement('img');image.src=canvas.toDataURL();image.style.cssText=copy.style.cssText;image.style.width=`${canvas.offsetWidth}px`;image.style.height=`${canvas.offsetHeight}px`;copy.replaceWith(image);}
   wrapper.append(clone);target.body.append(wrapper);rules+=`@page v20page${order}{size:${g.width}px ${g.height}px;margin:0}`;
  }
  const style=target.createElement('style');style.textContent=rules;target.head.append(style);
  await Promise.all(stylesReady);await target.fonts.ready;await Promise.all(Array.from(target.images).map(i=>i.decode().catch(()=>{})));await new Promise<void>(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>resolve())));
  // Keep the print frame alive until the native dialog closes. No editor state
  // is changed, and cancelling the system dialog leaves the document untouched.
  const cleanup=()=>frame.remove();pw.addEventListener('afterprint',cleanup,{once:true});pw.focus();pw.print();return true;
  }catch(error){frame.remove();throw error;}
 };
 api.close=async()=>{await call('close');await invoke('finish_close');};
 api.onCommand=(fn:Callback)=>{commands.add(fn);return()=>commands.delete(fn);};
 api.onImportProgress=(fn:Callback)=>{progress.add(fn);return()=>progress.delete(fn);};
 // Read the saved palette before mounting the editor or revealing the native window.
 const startup=await call('init') as {settings?:{theme?:string}};
 api.initialTheme=startup.settings?.theme;
 window.documentStudioDesktop=api;
}
