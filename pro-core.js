/* Local, deterministic document automation primitives. */
(function(root){'use strict';
function parseCSV(text){
 text=String(text).replace(/^\uFEFF/,'');if(text.length>10000000)throw Error('CSV exceeds 10 MB.');
 const rows=[];let row=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
 if(c==='"'){if(value||closed)throw Error('Unexpected quote in CSV.');quoted=true;}
 else if(c===','){row.push(value);value='';closed=false;}
 else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';closed=false;}
 else{if(closed&&!/\s/.test(c))throw Error('Unexpected text after a quoted field.');if(!closed)value+=c;}}
 if(quoted)throw Error('Unclosed quote in CSV.');if(row.length||value||closed)rows.push([...row,value]);
 if(!rows.length)throw Error('CSV is empty.');const headers=rows.shift().map(s=>s.trim());
 if(headers.some(s=>!s)||new Set(headers).size!==headers.length)throw Error('CSV needs unique, non-empty column headings.');
 if(rows.length>10000)throw Error('Use at most 10,000 CSV records.');
 return {headers,rows:rows.filter(r=>r.some(Boolean)).map((r,i)=>{if(r.length!==headers.length)throw Error('CSV row '+(i+2)+' has '+r.length+' cells; expected '+headers.length+'.');return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));})};
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function interpolate(text,data,strict=true){return String(text).replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(all,key)=>{if(!Object.hasOwn(data,key)){if(strict)throw Error('Missing variable: '+key);return all;}return String(data[key]??'');});}
function safeName(s){return String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,120)||'Document';}
function condition(value,operator,expected){switch(operator){case'equals':return String(value??'')===expected;case'not equal':return String(value??'')!==expected;case'contains':return String(value??'').includes(expected);case'not empty':return String(value??'').length>0;default:throw Error('Unknown condition operator');}}
const api={parseCSV,escape,interpolate,safeName,condition};if(typeof module==='object')module.exports=api;else root.FTEProCore=api;
})(globalThis);
