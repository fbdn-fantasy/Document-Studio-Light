/* Document Studio Light expansion. Uses existing pagination, history and native save bridge. */
'use strict';
(()=>{
const C=FTEProCore, E=C.escape, commands=[], settingsKey='fte-pro-preferences';
const originalInsert=insertHTML;insertHTML=function(html){
 const dialog=document.querySelector('#dialog[open]');if(dialog)dialog.close();
 if(!html.includes('data-pro-'))return originalInsert(html);
 focusSelection();if(data().formLocked)throw Error('Unlock the form layout before inserting objects.');
 let r=getSelection().rangeCount?getSelection().getRangeAt(0):null;
 if(!r||!pages.contains(r.startContainer)||!(r.startContainer.nodeType===3?r.startContainer.parentElement:r.startContainer).closest('.page-body')){r=document.createRange();r.selectNodeContents(pages.querySelector('.page-body'));r.collapse(false);}
 const protectedNode=(r.startContainer.nodeType===3?r.startContainer.parentElement:r.startContainer).closest('[contenteditable="false"],[data-pro-citation],[data-pro-field],[data-pro-dynamic-field]');if(protectedNode&&pages.contains(protectedNode)){r=document.createRange();r.setStartAfter(protectedNode);r.collapse(true);}
 r.deleteContents();const holder=document.createElement('template');holder.innerHTML=html;const fragment=holder.content,last=fragment.lastChild;
 const blocks=[...fragment.children].some(n=>/^(P|DIV|TABLE|H[1-6])$/.test(n.tagName));
 const parent=(r.startContainer.nodeType===3?r.startContainer.parentElement:r.startContainer).closest('p,h1,h2,h3');
 if(blocks&&parent&&parent.parentElement.classList.contains('page-body')){
  const tail=r.cloneRange();tail.setEnd(parent,parent.childNodes.length);const after=parent.cloneNode(false);after.append(tail.extractContents());parent.after(fragment);if(after.textContent||after.querySelector('img,br'))last.after(after);
 }else r.insertNode(fragment);
 if(last){r=document.createRange();r.setStartAfter(last);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r);savedRange=r.cloneRange();}
 layout();checkpoint();
};
let prefs;try{prefs=JSON.parse(localStorage.getItem(settingsKey)||'{}');}catch{prefs={};}
const persist=()=>localStorage.setItem(settingsKey,JSON.stringify(prefs));
const data=()=>extra.pro||(extra.pro={metadata:{},blocks:[],formLocked:false});
function tab(name){if(ribbons[name])return ribbons[name];const r=document.createElement('div');r.className='ribbon';r.hidden=true;ribbons[name]=r;$('toolbar').append(r);button(name,()=>click(name),tabs);return r;}
function click(name){currentTab=name;Object.entries(ribbons).forEach(([n,r])=>r.hidden=n!==name);[...tabs.children].forEach(b=>b.classList.toggle('active',b.textContent===name));}
function add(name,fn,group='Tools',keywords=''){const b=button(name,fn,tab(group));b.dataset.proCommand=name;commands.push({name,fn,keywords,button:b});return b;}
function mutate(fn){focusSelection();fn();layout();checkpoint();}
function selected(){focusSelection();const r=getSelection().rangeCount?getSelection().getRangeAt(0):null;return r&&pages.contains(r.startContainer)?r:null;}
function form(title,fields,apply){let inputs={};const d=modal(title,'<div id="pro-fields"></div>',[['Apply',async d=>{const values=Object.fromEntries(Object.entries(inputs).map(([k,i])=>[k,i.type==='checkbox'?i.checked:i.value]));await apply(values);d.close();}]]);const host=$('pro-fields');for(const [key,label,type,value,options]of fields){if(type==='select')inputs[key]=select(label,options,value,host,()=>{});else if(type==='textarea'){const l=document.createElement('label');l.textContent=label;const i=document.createElement('textarea');i.style.width='100%';i.rows=6;i.value=value||'';l.append(i);host.append(l);inputs[key]=i;}else{inputs[key]=field(label,type,value??'',host);if(type==='checkbox')inputs[key].checked=!!value;}}return {d,inputs};}
const appButton = $('btn-commands');
const appMenu = $('app-command-list');
const appOrder = ['Keyboard shortcuts', 'Interface settings', 'Typing preferences', 'Appearance', 'About Document Studio Light'];

function addApp(name, fn, keywords = '') {
  const item = document.createElement('button');
  item.type = 'button';
  item.textContent = name;
  item.setAttribute('role', 'menuitem');
  item.tabIndex = -1;
  item.dataset.proCommand = name;
  item.onclick = () => {
    closeCommands(true);
    fn();
  };
  const next = [...appMenu.children].find(button => appOrder.indexOf(button.dataset.proCommand) > appOrder.indexOf(name));
  appMenu.insertBefore(item, next || null);
  commands.push({name, fn, keywords, button:item});
  return item;
}

function addCommandIcons() {
  for (const control of [appButton, ...appMenu.children]) {
    if (control.querySelector('svg')) continue;
    const icon = window.DocumentStudioRibbonIcon?.(control.dataset.proCommand || 'Commands');
    if (icon) control.prepend(icon);
  }
}

function closeCommands(restoreFocus = false) {
  if (appMenu.hidden) return;
  appMenu.hidden = true;
  appButton.setAttribute('aria-expanded', 'false');
  if (restoreFocus) appButton.focus({preventScroll:true});
}

function commandMenu(last = false) {
  if (document.querySelector('dialog[open]')) return;
  addCommandIcons();
  appMenu.hidden = false;
  appButton.setAttribute('aria-expanded', 'true');
  const item = last ? appMenu.lastElementChild : appMenu.firstElementChild;
  item?.focus({preventScroll:true});
}

appButton.onclick = () => appMenu.hidden ? commandMenu() : closeCommands(true);
appButton.onkeydown = event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    commandMenu(event.key === 'ArrowUp');
  }
};
appMenu.addEventListener('keydown', event => {
  const items = [...appMenu.children];
  const index = items.indexOf(document.activeElement);
  const count = items.length;
  if (!count) return;
  let next;
  switch (event.key) {
    case 'Escape': event.preventDefault(); closeCommands(true); return;
    case 'Tab': closeCommands(true); return;
    case 'ArrowDown': next = (index + 1) % count; break;
    case 'ArrowUp': next = (index + count - 1) % count; break;
    case 'Home': next = 0; break;
    case 'End': next = count - 1; break;
    default:
      if (event.key.length !== 1 || !event.key.trim() || event.altKey || event.ctrlKey || event.metaKey) return;
      for (let step = 1; step <= count; step++) {
        const candidate = (index + step) % count;
        if (items[candidate].dataset.proCommand.toLowerCase().startsWith(event.key.toLowerCase())) {
          next = candidate;
          break;
        }
      }
  }
  if (next !== undefined) {
    event.preventDefault();
    items[next].focus();
  }
});
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('#app-commands')) closeCommands();
}, true);
document.addEventListener('focusin', event => {
  if (!event.target.closest('#app-commands')) closeCommands();
});
document.addEventListener('DOMContentLoaded', () => { addCommandIcons(); applyPreferences(); }, {once:true});

function allCommands() {
  const live = commands.filter(c => c.button.isConnected);
  const known = new Set(live.map(c => c.button));
  for (const [group, ribbon] of Object.entries(ribbons)) {
    for (const b of ribbon.querySelectorAll('button:not([data-ribbon-ui])')) {
      if (known.has(b)) continue;
      const name = b.dataset.ribbonOriginalName || b.title || b.textContent.trim();
      if (name) live.push({name, label:b.dataset.ribbonHint || name, keywords:group, fn:() => b.click()});
    }
  }
  return live;
}
const reservedShortcuts = new Map([
  ['Ctrl+n','New document'], ['Ctrl+o','Open'], ['Ctrl+s','Save'], ['Ctrl+Shift+s','Save as'],
  ['Ctrl+p','Print'], ['Ctrl+f','Find'], ['Ctrl+z','Undo'], ['Ctrl+Shift+z','Redo'], ['Ctrl+y','Redo'],
  ['Ctrl+a','Select all'], ['Ctrl+c','Copy'], ['Ctrl+x','Cut'], ['Ctrl+v','Paste'],
  ['Ctrl+b','Bold'], ['Ctrl+i','Italic'], ['Ctrl+u','Underline'], ['Ctrl+Enter','Page break'],
  ['Ctrl+Shift+p','Commands'], ['F1','User guide'], ['Alt+F4','Close window']
]);
function shortcuts() {
  modal('Keyboard shortcuts', '<input type="search" id="pro-key-search" aria-label="Search shortcuts" placeholder="Find a command or shortcut"><div id="pro-key-list"></div><p id="pro-key-message" role="status"></p>',
    [['Restore defaults', () => { prefs.keys = {}; persist(); render(); }]]);
  const search = $('pro-key-search');
  const host = $('pro-key-list');
  const active = allCommands();
  const feedback = message => { $('pro-key-message').textContent = message; };
  function render() {
    host.replaceChildren();
    const query = search.value.trim().toLowerCase();
    const builtIn = [...reservedShortcuts].filter(([key, name]) => (name + ' ' + key).toLowerCase().includes(query));
    const matching = active.filter(c => [c.label, c.name, c.keywords, prefs.keys?.[c.name]].join(' ').toLowerCase().includes(query));
    if (builtIn.length) {
      const header = document.createElement('h3');
      header.textContent = 'Built-in shortcuts';
      host.append(header);
      for (const [key, name] of builtIn) {
        const row = document.createElement('div');
        row.className = 'shortcut-row';
        const keys = document.createElement('kbd');
        keys.textContent = key.replace(/[a-z]$/, ch => ch.toUpperCase());
        row.append(name, keys);
        host.append(row);
      }
    }
    if (matching.length) {
      const header = document.createElement('h3');
      header.textContent = 'Custom shortcuts';
      host.append(header);
      for (const c of matching) {
        const input = field(c.label || c.name, 'text', prefs.keys?.[c.name] || '', host);
        input.parentElement.className = 'shortcut-row';
        input.placeholder = 'Press shortcut';
        input.onkeydown = event => {
          if (event.key === 'Tab' || event.key === 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          if (['Control','Shift','Alt','Meta'].includes(event.key)) return;
          const key = keyName(event);
          if (event.key === 'Backspace' || event.key === 'Delete') {
            delete (prefs.keys || {})[c.name];
            input.value = '';
            feedback('Shortcut removed.');
          } else {
            if (!event.ctrlKey && !event.metaKey && !event.altKey) return feedback('Use Ctrl or Alt with a key.');
            if (reservedShortcuts.has(key)) return feedback('This shortcut is reserved.');
            const duplicate = active.find(other => other.name !== c.name && prefs.keys?.[other.name] === key);
            if (duplicate) return feedback('Already assigned to ' + (duplicate.label || duplicate.name));
            (prefs.keys ||= {})[c.name] = key;
            input.value = key;
            feedback('Shortcut assigned.');
          }
          persist();
        };
      }
    }
    if (!builtIn.length && !matching.length) host.textContent = 'No matching shortcuts.';
  }
  search.oninput = render;
  render();
  search.focus();
}
const keyName=e=>[e.ctrlKey||e.metaKey?'Ctrl':'',e.altKey?'Alt':'',e.shiftKey?'Shift':'',e.key.length===1?e.key.toLowerCase():e.key].filter(Boolean).join('+');
window.addEventListener('keydown',e=>{if(e.isComposing||document.querySelector('dialog[open]'))return;if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='p'){e.preventDefault();e.stopImmediatePropagation();commandMenu();return;}const key=keyName(e);if(!Object.values(prefs.keys||{}).includes(key))return;const c=allCommands().find(command=>prefs.keys[command.name]===key);if(c){e.preventDefault();e.stopImmediatePropagation();c.fn();}},true);
function mergeHTML(html,record,strict=true){const root=document.createElement('div');root.innerHTML=sanitize(html);for(const node of [...root.querySelectorAll('[data-pro-condition]')]){const c=JSON.parse(node.dataset.proCondition);if(!C.condition(record[c.key],c.operator,c.value))node.remove();else node.removeAttribute('data-pro-condition');}
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode())n.textContent=C.interpolate(n.textContent,record,strict);
 for(const n of root.querySelectorAll('[data-pro-field]')){const spec=JSON.parse(n.dataset.proField);if(Object.hasOwn(record,spec.name))n.textContent=spec.type==='checkbox'?(/^(true|yes|1|☑)$/i.test(record[spec.name])?'☑':'☐'):record[spec.name];}
 return root.innerHTML;}
function fieldDialog(existing=null){let spec=existing?JSON.parse(existing.dataset.proField):{name:'Full name',type:'text',value:'',options:'Option 1\nOption 2',width:220};form(existing?'Edit form field':'Insert form field',[
 ['name','Field / variable name','text',spec.name],['type','Type','select',spec.type,['text','checkbox','dropdown','date']],['value','Default / current value','text',existing?.textContent||spec.value],['options','Dropdown options (one per line)','textarea',spec.options],['width','Width (px)','number',spec.width]
 ],v=>{if(!v.name.trim())throw Error('Enter a field name.');v.width=Math.max(20,Math.min(1000,+v.width||220));const markup=`<span data-pro-field="${E(JSON.stringify(v))}" style="display:inline-block;min-width:${v.width}px;border-bottom:1px solid #888;padding:3px 6px" tabindex="0" role="button" title="Click to fill; right-click to configure">${E(v.type==='checkbox'?(/^(true|yes|1|☑)$/i.test(v.value)?'☑':'☐'):(v.value||'['+v.name+']'))}</span>`;if(existing){existing.outerHTML=markup;layout();checkpoint();}else insertHTML(markup);});}
function fillField(n){const s=JSON.parse(n.dataset.proField);if(s.type==='checkbox'){n.textContent=n.textContent==='☑'?'☐':'☑';layout();checkpoint();return;}const type=s.type==='dropdown'?'select':s.type==='date'?'date':'text';form('Fill '+s.name,[['value',s.name,type,n.textContent.startsWith('[')?'':n.textContent,(s.options||'').split('\n')]],v=>{n.textContent=v.value;layout();checkpoint();});}
pages.addEventListener('click',e=>{const n=e.target.closest('[data-pro-field]');if(n){e.preventDefault();fillField(n);}});
pages.addEventListener('keydown',e=>{if(e.target.matches('[data-pro-field]')&&['Enter',' '].includes(e.key)){e.preventDefault();fillField(e.target);}});
pages.addEventListener('contextmenu',e=>{const n=e.target.closest('[data-pro-field]');if(n){e.preventDefault();if(data().formLocked)return say('Unlock the form layout before configuring fields.');fieldDialog(n);}});
function applyLock(){const isLocked=!!data().formLocked;pages.contentEditable=String(!isLocked);pages.querySelectorAll('[data-pro-field]').forEach(n=>{n.contentEditable='false';n.tabIndex=0;});}
const prevLayout=layout;layout=function(...args){const out=prevLayout(...args);applyLock();return out;};const prevLoad=loadState;loadState=function(s){const out=prevLoad(s);applyLock();return out;};
function automation(){const d=modal('Mail merge & batch generation','<p>Use {{Column name}} in the document. CSV headings match variable names exactly. Data stays on this computer.</p><input id="pro-csv-file" type="file" accept=".csv,text/csv"><textarea id="pro-csv" aria-label="CSV data" rows="7" style="width:100%" placeholder="Full name,Address\nAlex,Example street"></textarea><div id="pro-merge-summary"></div><div id="pro-merge-preview" style="background:white;color:#222;padding:20px;max-height:250px;overflow:auto"></div>',[
 ['Preview',()=>{const x=C.parseCSV($('pro-csv').value);if(!x.rows.length)throw Error('CSV contains no data rows.');$('pro-merge-summary').textContent=x.rows.length+' records · '+x.headers.join(', ');$('pro-merge-preview').innerHTML=mergeHTML(clean(),x.rows[0]);}],
 ['Generate PDFs ZIP',async()=>{
 if(!window.desktop?.pdfBytes)throw Error('Batch PDF requires the desktop application.');
 const csv=C.parseCSV($('pro-csv').value);if(!csv.rows.length)throw Error('CSV contains no records.');if(csv.rows.length>500)throw Error('Use at most 500 records per batch.');d.close();
 const produce=async()=>{const source=state(),zip=new JSZip(),wasDirty=dirty,wasInert=document.body.inert;window.FTEBatchBusy=true;document.body.inert=true;
 try{for(let i=0;i<csv.rows.length;i++){const s=clone(source);s.html=mergeHTML(source.html,csv.rows[i]);s.selection=null;s.extra.chapters=[];s.extra.activeChapter=null;loadState(s);layout();updatePrintStyle();await document.fonts.ready;layout();await Promise.all([...pages.querySelectorAll('img')].map(im=>im.decode().catch(()=>{})));await new Promise(requestAnimationFrame);zip.file(String(i+1).padStart(4,'0')+'-'+C.safeName(source.name)+'.pdf',new Uint8Array(await desktop.pdfBytes()));}await download(await zip.generateAsync({type:'blob'}),C.safeName(source.name)+'-pdfs.zip');}
 finally{loadState(source);dirty=wasDirty;document.body.inert=wasInert;window.FTEBatchBusy=false;}};
 return window.FTEDesktop?FTEDesktop.withTemporaryDocument(produce):produce();
 }],
 ['Generate native documents ZIP',async()=>{const csv=C.parseCSV($('pro-csv').value);if(!csv.rows.length)throw Error('CSV contains no records.');const source=state(),zip=new JSZip();for(let i=0;i<csv.rows.length;i++){const s=clone(source);s.html=mergeHTML(source.html,csv.rows[i]);s.selection=null;s.name=source.name+' '+(i+1);s.extra.chapters=[];s.extra.activeChapter=null;s.extra.notes=[];s.extra.comments=[];zip.file(String(i+1).padStart(4,'0')+'-'+C.safeName(s.name)+'.fte.json',JSON.stringify(s,null,2));}await download(await zip.generateAsync({type:'blob'}),C.safeName(source.name)+'-merged.zip');}]
 ]);$('pro-csv-file').onchange=async e=>{$('pro-csv').value=await e.target.files[0].text();};}
function metadata(){const m=data().metadata;form('Document properties', [['title','Title','text',$('doc-name').value],['author','Author','text',m.author||''],['subject','Subject','text',m.subject||''],['keywords','Keywords','text',m.keywords||''],['custom','Custom properties (JSON object)','textarea',JSON.stringify(m.custom||{},null,2)]],v=>{const c=JSON.parse(v.custom);if(!c||Array.isArray(c)||typeof c!=='object')throw Error('Custom properties must be an object.');$('doc-name').value=v.title;data().metadata={author:v.author,subject:v.subject,keywords:v.keywords,custom:c};checkpoint();});}
function contentBlocks(){const selectedRange=selected()?.cloneRange();const d=modal('Reusable content blocks','<div id="pro-blocks"></div>',[['Save selection',async()=>{const r=selectedRange;if(!r||r.collapsed)throw Error('Select document content before opening this tool.');const div=document.createElement('div');div.append(r.cloneContents());const name=await askText('Block name');if(!name)return;data().blocks.push({name,html:sanitize(div.innerHTML)});checkpoint();contentBlocks();}]]);for(const b of data().blocks){const row=document.createElement('div');row.className='row';button(b.name,()=>{d.close();insertHTML(b.html);},row);button('Delete',()=>{data().blocks=data().blocks.filter(x=>x!==b);checkpoint();contentBlocks();},row);$('pro-blocks').append(row);}}
function conditionDialog(){const r=selected();if(!r||r.collapsed)return say('Select the content to show conditionally first.');const saved=r.cloneRange();form('Conditional content',[['key','CSV field name','text',''],['operator','Condition','select','equals',['equals','not equal','contains','not empty']],['value','Compare with','text','']],v=>{const span=document.createElement('span');span.dataset.proCondition=JSON.stringify(v);span.style.borderBottom='1px dashed #9572c0';span.append(saved.extractContents());saved.insertNode(span);checkpoint();});}
function populate(){const html=clean(),keys=[...new Set([...html.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(m=>m[1]))];for(const n of pages.querySelectorAll('[data-pro-field]')){const k=JSON.parse(n.dataset.proField).name;if(!keys.includes(k))keys.push(k);}if(!keys.length)return say('Insert variables or form fields first.');form('Populate document fields',keys.map((k,i)=>['k'+i,k,'text',/date/i.test(k)?new Date().toISOString().slice(0,10):'']),v=>{const record=Object.fromEntries(keys.map((k,i)=>[k,v['k'+i]]));layout(mergeHTML(html,record));checkpoint();});}
function settings(){modal('Interface settings','<input id="pro-settings-filter" placeholder="Search settings" aria-label="Search settings"><div id="pro-settings-list"></div>',[['Reset interface',()=>{prefs.hiddenTabs=[];prefs.hiddenStatus=[];prefs.quick=[];window.DocumentStudioTheme?.apply('system');persist();applyPreferences();$('dialog').close();}]]);const host=$('pro-settings-list');window.DocumentStudioTheme?.appendSelector(host);window.FTEDesktop?.appendSaveSettings(host);for(const name of Object.keys(ribbons)){if(['File','Home'].includes(name))continue;const i=field('Show '+name+' tab','checkbox','',host);i.checked=!(prefs.hiddenTabs||[]).includes(name);i.onchange=()=>{prefs.hiddenTabs=i.checked?(prefs.hiddenTabs||[]).filter(x=>x!==name):[...(prefs.hiddenTabs||[]),name];persist();applyPreferences();};}for(const label of ['Words','Chars','Pages']){const i=field('Show '+label+' counter','checkbox','',host);i.checked=!(prefs.hiddenStatus||[]).includes(label);i.onchange=()=>{prefs.hiddenStatus=i.checked?(prefs.hiddenStatus||[]).filter(x=>x!==label):[...(prefs.hiddenStatus||[]),label];persist();applyPreferences();};}for(const c of allCommands()){const i=field('Quick access: '+(c.label||c.name),'checkbox','',host);i.checked=(prefs.quick||[]).includes(c.name);i.onchange=()=>{prefs.quick=i.checked?[...(prefs.quick||[]),c.name]:(prefs.quick||[]).filter(x=>x!==c.name);persist();applyPreferences();};}$('pro-settings-filter').oninput=e=>[...host.children].forEach(l=>l.hidden=!l.textContent.toLowerCase().includes(e.target.value.toLowerCase()));}
const quick=document.createElement('div');quick.id='pro-quick';quick.className='row';$('titlebar').append(quick);
function applyPreferences(){[...tabs.children].forEach(b=>b.hidden=(prefs.hiddenTabs||[]).includes(b.textContent));[...$('counters').children].forEach(p=>p.hidden=(prefs.hiddenStatus||[]).includes(p.firstElementChild?.textContent));quick.replaceChildren();for(const name of prefs.quick||[]){const c=allCommands().find(c=>c.name===name);if(c)button(c.label||name,c.fn,quick);}if((prefs.hiddenTabs||[]).includes(currentTab))click('Home');}
addApp('Keyboard shortcuts',shortcuts,'assign keys');addApp('Interface settings',settings,'settings quick access status tabs');
add('Form field',()=>fieldDialog(),'Insert','checkbox dropdown date fillable');add('Populate fields',populate);add('Lock / unlock form layout',()=>{data().formLocked=!data().formLocked;applyLock();checkpoint();say(data().formLocked?'Layout locked. Click fields to fill.':'Layout unlocked.');});add('Template variable',()=>form('Insert variable',[['name','Variable name','text','Full name']],v=>insertHTML(E('{{'+v.name+'}}'))),'Insert');add('Mail merge',automation,'Tools','CSV batch personalized documents');add('Conditional content',conditionDialog);add('Content blocks',contentBlocks,'Insert','reusable');add('Document properties',metadata,'Tools','metadata author title');
window.FTEPro={add,addApp,tab,form,mergeHTML,commandMenu,commands,data,applyLock,applyPreferences};
applyPreferences();applyLock();
})();
