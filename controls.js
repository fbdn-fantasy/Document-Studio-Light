/* V2 editing interaction fixes. No network dependencies. */
'use strict';
function askText(title,value=''){
  focusSelection();const range=getSelection().rangeCount?getSelection().getRangeAt(0).cloneRange():null;
  return new Promise(resolve=>{let result=null;const d=modal(title,'<label>'+esc(title)+' <input id="text-answer" type="text"></label>',[['Apply',d=>{result=$('text-answer').value;d.close();}]]);$('text-answer').value=value;$('text-answer').focus();$('text-answer').select();$('text-answer').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();result=e.target.value;d.close();}};d.addEventListener('close',()=>{if(range&&pages.contains(range.startContainer))savedRange=range;focusSelection();resolve(result);},{once:true});});
}
(function(){
const style=document.createElement('style');style.textContent=`button[aria-pressed="true"],button.active{background:#b79aee!important;color:#20122f!important;border-color:#d4baff!important;box-shadow:inset 0 0 0 1px #d4baff}#editor-wrap{overflow-anchor:none;scroll-behavior:auto}.rulers .sheet:before{display:none!important}#live-ruler{position:sticky;top:0;height:48px;background:#2e213b;color:#eee;z-index:25;margin:0 auto 8px;user-select:none;overflow:hidden;flex-shrink:0}#live-ruler .ticks{height:22px;position:relative;border-bottom:1px solid #b79aee}#live-ruler .tick{position:absolute;border-left:1px solid #b79aee;height:13px;padding-left:3px;font:10px Arial;top:4px}#ruler-indent{position:absolute;bottom:0;height:22px;margin:0;accent-color:#c7a6ff;cursor:ew-resize}#ruler-readout{position:absolute;right:4px;bottom:3px;pointer-events:none;font:10px Arial}@media print{#live-ruler{display:none!important}}`;
document.head.append(style);
const previous=$('font-family'),font=document.createElement('select');font.id='font-family';font.setAttribute('aria-label','Font family');font.style.width='170px';font.append(...[...new Set([previous.value,...[...$('font-list').options].map(o=>o.value)])].map(f=>new Option(f,f)));font.value=previous.value;font.onchange=previous.onchange;previous.replaceWith(font);
const originalFocus=focusSelection;focusSelection=function(){const s=getSelection();if(document.activeElement===pages&&s.rangeCount&&pages.contains(s.anchorNode))return;originalFocus();};
const findButton=t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t);
const commandButtons={'btn-bold':'bold','btn-italic':'italic','btn-underline':'underline','btn-bullet':'insertUnorderedList','btn-number':'insertOrderedList','btn-align-left':'justifyLeft','btn-align-center':'justifyCenter','btn-align-right':'justifyRight','btn-align-justify':'justifyFull'};
for(const [t,c] of [['Strike','strikeThrough'],['x²','superscript'],['x₂','subscript']]){const b=findButton(t);b.dataset.command=c;}
for(const [id,c] of Object.entries(commandButtons))$(id).dataset.command=c;
function currentBlock(){const s=getSelection();let n=s.anchorNode;if(n?.nodeType===3)n=n.parentElement;return n?.closest('.page-body p,.page-body h1,.page-body h2,.page-body h3,.page-body li,.page-body blockquote,.page-body td');}
function pressed(b,on){if(!b)return;b.setAttribute('aria-pressed',String(!!on));b.classList.toggle('active',!!on);}
function refresh(){const s=getSelection();if(s.rangeCount&&pages.contains(s.anchorNode)){for(const b of document.querySelectorAll('[data-command]'))pressed(b,document.queryCommandState(b.dataset.command));pressed(findButton('Checklist'),!!currentBlock()?.querySelector('[data-check]'));const family=document.queryCommandValue('fontName').replace(/^['"]|['"]$/g,'');if(family&&document.activeElement!==font){if(![...font.options].some(o=>o.value===family))font.add(new Option(family,family));font.value=family;}}
pressed(findButton('Spellcheck on / off'),pages.spellcheck);pressed(findButton('Typewriter mode'),extra.typewriter);pressed(findButton('Ruler'),document.body.classList.contains('rulers'));pressed(findButton('Margin guides'),document.body.classList.contains('guides'));for(const t of ['Navigation','Comments','Table tools','Image tools'])pressed(findButton(t),activePanel===t.replace(' tools',''));renderRuler();}
function centerCaret(){if(!extra.typewriter)return;const s=getSelection();if(!s.rangeCount||!pages.contains(s.anchorNode))return;const r=s.getRangeAt(0).cloneRange();r.collapse(false);let rect=r.getBoundingClientRect();if(!rect.height)rect=currentBlock()?.getBoundingClientRect();if(!rect)return;const box=wrap.getBoundingClientRect();const delta=rect.top+rect.height/2-(box.top+box.height/2);if(Math.abs(delta)>8)wrap.scrollTop+=delta;}
function reflow(){const needs=[...pages.querySelectorAll('.page-body')].some(b=>b.scrollHeight>H-2*M+2)||pages.children.length>1;if(needs){const y=wrap.scrollTop;layout();if(!extra.typewriter)wrap.scrollTop=y;}counts();centerCaret();refresh();}
const originalLayout=layout;layout=function(html=null){const y=wrap.scrollTop;const s=getSelection(),editing=html===null&&s.rangeCount&&s.isCollapsed&&pages.contains(s.anchorNode);const flags=editing?Object.fromEntries(['bold','italic','underline','strikeThrough','superscript','subscript'].map(c=>[c,document.queryCommandState(c)])):null;originalLayout(html);if(flags){for(const [c,on]of Object.entries(flags))if(document.queryCommandState(c)!==on)document.execCommand(c,false,null);}if(!extra.typewriter)wrap.scrollTop=y;refresh();};
function sameState(a,b){if(!a||!b)return false;const strip=v=>{const s=JSON.parse(v);delete s.selection;if(typeof s.html==='string')s.html=s.html.replace(/(<(?:p|h[1-6])\b[^>]*>)<br\s*\/?>(<\/(?:p|h[1-6])>)/gi,'$1$2');if(s.extra)delete s.extra.stats;return JSON.stringify(s);};return strip(a)===strip(b);}
// Capture pre-edit state without creating a separate undo step for cursor movement.
pages.addEventListener('beforeinput',()=>{const v=JSON.stringify(state());if(history[hi]&&sameState(history[hi],v))history[hi]=v;else checkpoint();},true);
const oldUndo=undo;undo=function(d){clearTimeout(timer);const v=JSON.stringify(state());if(!sameState(history[hi],v))checkpoint();oldUndo(d);refresh();};
const checklist=findButton('Checklist');function toggleCheck(){focusSelection();let p=currentBlock();if(!p){exec('formatBlock','p');p=currentBlock();}if(!p)return;const check=p.querySelector('[data-check]');if(check)check.remove();else {const n=document.createElement('span');n.dataset.check='false';n.contentEditable='false';n.setAttribute('role','checkbox');n.setAttribute('aria-checked','false');n.tabIndex=0;n.textContent='☐';p.prepend(n);const r=document.createRange();r.setStartAfter(n);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r);savedRange=r.cloneRange();}checkpoint();refresh();}
checklist.onclick=toggleCheck;
pages.addEventListener('keydown',e=>{if(e.key!=='Backspace'&&e.key!=='Enter')return;const s=getSelection(),p=currentBlock(),check=p?.querySelector('[data-check]');if(!check||!s.isCollapsed)return;const r=document.createRange();r.selectNodeContents(p);r.setEnd(s.anchorNode,s.anchorOffset);const before=r.toString().replace(/[☐☑\s\u200b]/g,'');const rest=p.textContent.replace(/[☐☑\s\u200b]/g,'');if((e.key==='Backspace'&&!before)||(e.key==='Enter'&&!rest)){e.preventDefault();e.stopImmediatePropagation();check.remove();if(!p.textContent)p.innerHTML='<br>';const caret=document.createRange();caret.selectNodeContents(p);caret.collapse(true);s.removeAllRanges();s.addRange(caret);savedRange=caret.cloneRange();checkpoint();refresh();}else if(e.key==='Enter'){e.preventDefault();exec('insertParagraph');const next=currentBlock();if(next){next.querySelectorAll('[data-check]').forEach(n=>n.remove());toggleCheck();}}},true);
for(const [t,delta]of [['Indent +',36],['Indent −',-36]])findButton(t).onclick=()=>{focusSelection();const r=getSelection().rangeCount?getSelection().getRangeAt(0):null;if(!r)return;let blocks=r.collapsed?[currentBlock()]:[...pages.querySelectorAll('.page-body p,.page-body h1,.page-body h2,.page-body h3,.page-body li')].filter(n=>r.intersectsNode(n));for(const b of blocks.filter(Boolean))b.style.marginLeft=Math.max(0,Math.min(W-2*M-80,(parseFloat(b.style.marginLeft)||0)+delta))+'px';layout();checkpoint();};
const ruler=document.createElement('div');ruler.id='live-ruler';ruler.contentEditable='false';ruler.innerHTML='<div class="ticks"></div><input id="ruler-indent" type="range" min="0" step="1" aria-label="Paragraph left indent" title="Drag to set the selected paragraph’s left indent"><span id="ruler-readout"></span>';wrap.prepend(ruler);let rulerKey='';
function renderRuler(){ruler.hidden=!document.body.classList.contains('rulers');if(ruler.hidden)return;const key=[W,M,scale].join();ruler.style.width=W*scale+'px';if(key!==rulerKey){rulerKey=key;const ticks=ruler.querySelector('.ticks');ticks.replaceChildren();for(let cm=0;cm<=W/37.795;cm++){const n=document.createElement('span');n.className='tick';n.style.left=cm*37.795*scale+'px';n.textContent=cm % Math.max(1,Math.ceil(24/(37.795*scale)))===0?String(cm):'';ticks.append(n);}$('ruler-indent').style.left=M*scale+'px';$('ruler-indent').style.width=(W-2*M)*scale+'px';$('ruler-indent').max=Math.max(0,W-2*M-80);}
if(document.activeElement!==$('ruler-indent'))$('ruler-indent').value=parseFloat(currentBlock()?.style.marginLeft)||0;$('ruler-readout').textContent=(+$('ruler-indent').value*25.4/96).toFixed(1)+' mm indent';}
$('ruler-indent').oninput=e=>{focusSelection();const p=currentBlock();if(p){p.style.marginLeft=e.target.value+'px';$('ruler-readout').textContent=(+e.target.value*25.4/96).toFixed(1)+' mm indent';}};$('ruler-indent').onchange=()=>{layout();checkpoint();};
document.addEventListener('selectionchange',refresh);document.addEventListener('click',()=>queueMicrotask(refresh));new ResizeObserver(renderRuler).observe(wrap);$('zoom').addEventListener('change',renderRuler);
window.FTEControls={refresh,reflow,centerCaret,sameState};refresh();
})();

// Clipboard plain text uses document structure, never Chromium's visual
// paragraph spacing. Keep explicit empty paragraphs and soft breaks intact.
function documentPlainText(root){
 const blocks=new Set(['P','DIV','H1','H2','H3','H4','H5','H6','LI','UL','OL','BLOCKQUOTE','PRE','TABLE','TR','SECTION']);
 function content(n){
  if(n.nodeType===3)return n.nodeValue;
  if(n.nodeType!==1&&n.nodeType!==11)return '';
  if(n.nodeName==='BR')return '\n';
  if(n.nodeName==='IMG')return n.getAttribute('alt')||'';
  if(n.nodeName==='TR')return [...n.children].map(content).join('\t');
  const children=[...n.childNodes].filter(c=>!(c.nodeType===3&&!c.textContent.trim()&&/[\r\n]/.test(c.textContent)));
  // A sole BR is the editable placeholder for an empty paragraph.
  if(blocks.has(n.nodeName)&&children.length===1&&children[0].nodeName==='BR')return '';
  let out='',previousBlock=false,hasPrevious=false;
  for(const c of children){const block=blocks.has(c.nodeName);if(hasPrevious&&(block||previousBlock))out+='\n';out+=content(c);previousBlock=block;hasPrevious=true;}
  return out;
 }
 return content(root).replace(/\u00a0/g,' ');
}
plainText=function(html){const root=document.createElement('div');root.innerHTML=html;return documentPlainText(root);};
for(const kind of ['copy','cut'])document.addEventListener(kind,e=>{
 const selection=getSelection();if(!e.clipboardData||!selection.rangeCount||selection.isCollapsed)return;
 const range=selection.getRangeAt(0);
 if(!pages.contains(range.startContainer)||!pages.contains(range.endContainer))return;
 const root=document.createElement('div');
 for(const body of pages.querySelectorAll('.page-body')){
  if(!range.intersectsNode(body))continue;
  const part=document.createRange();part.selectNodeContents(body);
  if(body.contains(range.startContainer))part.setStart(range.startContainer,range.startOffset);
  if(body.contains(range.endContainer))part.setEnd(range.endContainer,range.endOffset);
  root.append(part.cloneContents());
 }
 root.querySelectorAll('.bookmark').forEach(n=>n.remove());join(root);
 e.clipboardData.setData('text/plain',documentPlainText(root));
 e.clipboardData.setData('text/html',root.innerHTML);e.preventDefault();
 if(kind==='cut'){document.execCommand('delete');checkpoint();}
});
