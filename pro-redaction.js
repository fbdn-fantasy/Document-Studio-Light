'use strict';
(()=>{
 const P=FTEPro,E=FTEProCore.escape;
 function text(){const root=document.createElement('div');root.innerHTML=clean();root.querySelectorAll('[data-pro-redact]').forEach(n=>n.replaceWith('[REDACTED]'));root.querySelectorAll('img,video,audio,object,script,style').forEach(n=>n.remove());return plainText(root.innerHTML);}
 async function pdf(){if(!window.desktop?.pdfBytes)throw Error('PDF export requires the desktop application.');const value=text();const action=async()=>{const original=state(),wasDirty=dirty;window.FTEBatchBusy=true;const wasInert=document.body.inert;document.body.inert=true;try{loadState({html:value.split(/\r?\n/).map(line=>'<p>'+E(line||' ')+'</p>').join(''),name:'Redacted document',selection:null,extra:{width:794,height:1123,margin:70,watermark:'',watermarkImage:'',comments:[],notes:[],chapters:[],pro:{}}});layout();updatePrintStyle();await document.fonts.ready;await new Promise(requestAnimationFrame);const bytes=new Uint8Array(await desktop.pdfBytes());await download(new Blob([bytes],{type:'application/pdf'}),'Redacted-document.pdf');}finally{loadState(original);dirty=wasDirty;document.body.inert=wasInert;window.FTEBatchBusy=false;}};return window.FTEDesktop?FTEDesktop.withTemporaryDocument(action):action();}
 P.redaction={text,pdf};
 const command=P.commands.find(c=>c.name==='Conceal / redact text'),old=command.fn;
 command.fn=()=>{focusSelection();const sel=getSelection();const range=sel.rangeCount?sel.getRangeAt(0).cloneRange():null;modal('Concealment and redacted export','<p>Mark selected text for reversible concealment. Redacted TXT and text-only PDF replace marked text with [REDACTED]. The PDF intentionally omits images, formatting, attachments and project metadata. Original documents, undo history and recovery copies remain unchanged.</p><pre id="redaction-preview" style="white-space:pre-wrap;max-height:220px;overflow:auto"></pre>',[
 ['Mark visual concealment',d=>{if(!range||range.collapsed||!pages.contains(range.startContainer))throw Error('Select text before marking it.');d.close();const n=document.createElement('span');n.dataset.proRedact='true';n.style.backgroundColor='#000';n.style.color='#000';n.append(range.extractContents());range.insertNode(n);layout();checkpoint();}],
 ['Preview redacted text',()=>{$('redaction-preview').textContent=text();}],
 ['Export redacted TXT',()=>download(new Blob([text()],{type:'text/plain;charset=utf-8'}),'Redacted-document.txt')],
 ['Export text-only redacted PDF',async d=>{d.close();await pdf();}]
 ]);};command.button.onclick=command.fn;
})();
