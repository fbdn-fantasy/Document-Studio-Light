<script lang="ts">
 import {onMount} from 'svelte';
 import type {PrintOptions,PrintOrientation} from './print-settings';
 import {parsePageRange} from './print-settings';
 let {total,finish}:{total:number,finish:(options:PrintOptions|null)=>void}=$props();
 let dialog:HTMLDialogElement;
 onMount(()=>dialog.showModal());
 let all=$state(true),range=$state(''),orientation=$state<PrintOrientation>('document'),color=$state<'color'|'monochrome'>('color'),error=$state('');
 function submit(event:SubmitEvent){
   event.preventDefault();
   const pages=all?'all':range.trim();
   if(!all&&(!pages||pages.toLowerCase()==='all')){
     error='Enter the page numbers to print, for example 1-3,5.';
     return;
   }
   try{parsePageRange(pages,total);finish({pages,orientation,color});}
   catch(e){error=(e as Error).message;}
 }
</script>
<dialog bind:this={dialog} aria-labelledby="print-heading" oncancel={(e)=>{e.preventDefault();finish(null);}}>
 <form onsubmit={submit}>
  <h1 id="print-heading">Print document</h1>
  <p>{total} {total===1?'page':'pages'} · Continue to choose your printer in the system print dialog.</p>
  <fieldset><legend>Pages</legend><label><input type="radio" name="pages" checked={all} onchange={()=>all=true}> All pages</label><label><input type="radio" name="pages" checked={!all} onchange={()=>all=false}> Selected pages</label><label class="range">Page numbers <input type="text" bind:value={range} disabled={all} placeholder="1-3,5" aria-label="Page numbers and ranges"></label></fieldset>
  <label class="option">Print orientation <select aria-label="Print orientation" bind:value={orientation}><option value="document">Use document orientation</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
  <label class="option">Print color <select aria-label="Print color" bind:value={color}><option value="color">Color</option><option value="monochrome">Monochrome</option></select></label>
  <p class="hint">Orientation changes fit pages to the paper without changing your document. Monochrome converts text, pictures and backgrounds to grayscale. Printer capabilities and driver settings determine the final output.</p>
  {#if error}<p role="alert">{error}</p>{/if}
  <footer><button type="button" onclick={()=>finish(null)}>Cancel</button><button class="primary" type="submit">Open system print dialog</button></footer>
 </form>
</dialog>

<style>
 dialog::backdrop{background:#0009}dialog{position:fixed;inset:0;margin:auto;z-index:9999;width:min(480px,calc(100vw - 48px));max-height:calc(100vh - 48px);overflow:auto;border:1px solid var(--ui-popover-border);border-radius:12px;padding:24px;background:var(--surface,#21182e);color:var(--text,#eee);font:14px system-ui;box-sizing:border-box}h1{font-size:21px;margin:0 0 12px}p{line-height:1.5}fieldset{border:1px solid var(--border,#645774);border-radius:6px}fieldset label{display:inline-flex;gap:6px;margin:6px 14px 6px 0}.range{display:flex;align-items:center;flex-wrap:wrap}.option{display:flex;align-items:center;justify-content:space-between;margin-top:16px;gap:12px}select,input[type=text]{background:var(--ui-input);color:var(--text,#eee);border:1px solid var(--border,#776686);border-radius:4px;padding:7px;font:inherit}.hint{font-size:12px;color:var(--muted,#c9bdd5)}footer{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}button{padding:9px 12px;border:1px solid var(--border,#776686);border-radius:5px;background:var(--surface,#332341);color:var(--text,#fff);font:inherit;cursor:pointer}button.primary{background:var(--ui-primary);color:var(--ui-primary-text)}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--ui-focus);outline-offset:2px}[role=alert]{color:var(--ui-danger)}
</style>
