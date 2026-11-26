'use strict';
(()=>{const P=FTEPro,E=FTEProCore.escape;const css=document.createElement('style');css.textContent='.pro-footnotes{position:absolute;border-top:1px solid #777;padding-top:6px;font-size:9pt;line-height:1.25;color:inherit;overflow-wrap:anywhere}.pro-footnotes p{margin:3px 0}.pro-footnote-ref{font-size:.75em;vertical-align:super}.pro-side-note{float:right;width:25%;padding:8px;border-inline-start:2px solid #9871c3;margin:0 0 8px 12px;font-size:9pt}';document.head.append(css);
window.FTEFootnotes={
 render(extend=false){
  let pending=[],number=0;const bodies=[...pages.querySelectorAll('.page-body')];
  for(let index=0;index<bodies.length||extend&&pending.length;index++){
   if(index>=500)throw Error('Footnotes exceed the document page limit.');
   const body=bodies[index]||newPage(),sheet=body.parentElement;
   let area=sheet.querySelector('.pro-footnotes');
   for(const ref of body.querySelectorAll('[data-pro-footnote]')){ref.textContent=String(++number);pending.push({number,text:ref.dataset.proFootnote,continued:false});}
   if(!pending.length){area?.remove();continue;}
   if(!area){area=document.createElement('div');area.className='pro-footnotes';area.contentEditable='false';sheet.append(area);}
   area.style.left=M+'px';area.style.right=M+'px';area.style.bottom=M+'px';area.replaceChildren();
   const capacity=Math.max(35,(parseFloat(sheet.style.height)-2*M)*.4),height=()=>area.getBoundingClientRect().height/scale;
   while(pending.length){const item=pending[0],row=document.createElement('p');area.append(row);const prefix=item.number+(item.continued?' (continued)':'')+'. ';
    row.textContent=prefix+item.text;if(height()<=capacity){pending.shift();continue;}
    let lo=0,hi=item.text.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);row.textContent=prefix+item.text.slice(0,mid);if(height()<=capacity)lo=mid;else hi=mid-1;}
    let cut=lo;const space=item.text.lastIndexOf(' ',cut);if(space>cut*.65)cut=space+1;if(/[\uD800-\uDBFF]/.test(item.text[cut-1]||''))cut--;
    if(cut<1){row.remove();break;}
    row.textContent=prefix+item.text.slice(0,cut);item.text=item.text.slice(cut);item.continued=true;break;
   }
  }
 },
 reserve(body){this.render();const area=body.parentElement.querySelector('.pro-footnotes');return area?area.getBoundingClientRect().height/scale+10:0;},
 refresh(){this.render(true);zoom();counts();}
};
function note(){P.form('Page-bottom footnote',[['text','Footnote text','textarea','']],v=>{if(!v.text.trim())throw Error('Enter footnote text.');if(v.text.length>100000)throw Error('A footnote can contain at most 100,000 characters.');insertHTML(`<span class="pro-footnote-ref" data-pro-footnote="${E(v.text)}" title="Double-click to edit footnote">*</span>`);});}
P.add('Page-bottom footnote',note,'References','academic note');
pages.addEventListener('dblclick',e=>{const n=e.target.closest('[data-pro-footnote]');if(!n)return;e.preventDefault();P.form('Edit footnote',[['text','Footnote text','textarea',n.dataset.proFootnote]],v=>{if(v.text.length>100000)throw Error('A footnote can contain at most 100,000 characters.');if(v.text.trim())n.dataset.proFootnote=v.text;else n.remove();layout();checkpoint();});});
P.add('Sidenote',()=>P.form('Sidenote',[['text','Sidenote text','textarea','']],v=>insertHTML(`<div class="pro-side-note" data-pro-sidenote="true"><p>${E(v.text)}</p></div>`)),'References','margin note');
const prev=layout;layout=function(...args){const result=prev(...args);FTEFootnotes.refresh();return result;};const load=loadState;loadState=function(...args){const result=load(...args);FTEFootnotes.refresh();return result;};
function labels(){const presets={'A4 · 21 labels':{width:210,height:297,cols:3,rows:7,labelWidth:63.5,labelHeight:38.1,left:7.25,top:15.15,xgap:2.5,ygap:0},'Letter · 30 labels':{width:215.9,height:279.4,cols:3,rows:10,labelWidth:66.675,labelHeight:25.4,left:4.7625,top:12.7,xgap:3.175,ygap:0}};const d=modal('Precise label sheets','<p>Print PDFs at 100% / Actual size. Verify dimensions against your label stock.</p><div id="pro-label-preset"></div><div id="pro-label-dimensions"></div>',[['Create sheet',()=>{const v=Object.fromEntries(Object.entries(inputs).map(([k,n])=>[k,+n.value]));if(Object.values(v).some(x=>!Number.isFinite(x)))throw Error('All dimensions must be numbers.');if(v.cols<1||v.rows<1||v.cols>20||v.rows>50||!Number.isInteger(v.cols)||!Number.isInteger(v.rows)||v.labelWidth<5||v.labelHeight<5||v.width<30||v.height<30||[v.left,v.top,v.xgap,v.ygap].some(x=>x<0))throw Error('Invalid sheet dimensions.');const neededWidth=v.left+v.cols*v.labelWidth+(v.cols-1)*v.xgap,neededHeight=v.top+v.rows*v.labelHeight+(v.rows-1)*v.ygap;if(neededWidth>v.width+.01||neededHeight>v.height+.01)throw Error('Labels do not fit the sheet.');const html=`<div data-pro-label-sheet="${E(JSON.stringify(v))}" style="width:${v.width}mm;height:${v.height}mm;box-sizing:border-box;padding:${v.top}mm 0 0 ${v.left}mm;display:grid;grid-template-columns:repeat(${v.cols},${v.labelWidth}mm);grid-template-rows:repeat(${v.rows},${v.labelHeight}mm);column-gap:${v.xgap}mm;row-gap:${v.ygap}mm;align-content:start">`+Array.from({length:v.cols*v.rows},()=>`<div style="box-sizing:border-box;padding:2mm;overflow:hidden"><p style="margin:0">${E(text.value).replace(/\n/g,'<br>')}</p></div>`).join('')+'</div>';d.close();P.form('Create label document',[['confirm','Replace current document with label sheet','checkbox',false]],async x=>{if(!x.confirm)throw Error('Select the checkbox to replace the document. Save your current work first.');const project={name:'Label sheet',html,margin:.001,extra:{width:v.width*96/25.4,height:v.height*96/25.4,margin:.001}};if(window.FTEDesktop){await FTEDesktop.applyTemplate(project.name,html,project);}else{loadState(project);checkpoint();}});}]]);const inputHost=$('pro-label-dimensions'),inputs={};for(const [k,v]of Object.entries(presets[Object.keys(presets)[0]]))inputs[k]=field(k+' (mm except rows/cols)','number',v,inputHost);select('Sheet preset',Object.keys(presets),Object.keys(presets)[0],$('pro-label-preset'),name=>{for(const [k,v]of Object.entries(presets[name]))inputs[k].value=v;});const text=field('Label text / variables','text','{{Full name}}',inputHost);}
P.add('Precise label sheets',labels,'Tools','labels millimeters stock sheet margins gaps');
})();
