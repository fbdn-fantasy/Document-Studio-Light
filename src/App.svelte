<script lang="ts">
 import {onMount} from 'svelte';
 import {invoke} from '@tauri-apps/api/core';
 import {installBridge} from './bridge';
 import '../pro-themes.css';
 import PrintDialog from './PrintDialog.svelte';
 import type {PrintOptions} from './print-settings';
 let printRequest=$state<{total:number,resolve:(options:PrintOptions|null)=>void}|null>(null);
 function requestPrintOptions(total:number):Promise<PrintOptions|null>{
   if(printRequest)return Promise.resolve(null);
   return new Promise(resolve=>{printRequest={total,resolve};});
 }
 function finishPrint(options:PrintOptions|null){printRequest?.resolve(options);printRequest=null;}
 let ready=$state(false);let error=$state('');
 // The native window is restored while hidden. Reveal only after the iframe
 // has loaded, so neither the default geometry nor a startup shell flashes.
 async function reveal(){try{await invoke('show_main');}catch(e){error=String(e);}}
 function editorLoaded(event:Event){
   const frame=(event.currentTarget as HTMLIFrameElement).contentWindow;
   if(frame){
     const syncTheme=()=>{document.documentElement.dataset.appTheme=frame.document.documentElement.dataset.appTheme;};
     syncTheme();
     frame.addEventListener('document-studio-theme-change',syncTheme);
   }
   void reveal();
 }
 onMount(()=>{
   try{
     const theme=localStorage.getItem('document-studio-light-application-theme');
     document.documentElement.dataset.appTheme=theme && ['light','dark','original'].includes(theme)
       ? theme : window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
   }catch{}
   installBridge(requestPrintOptions).then(()=>ready=true).catch(e=>{error=String(e);void reveal();});
 });
</script>
{#if error}<main role="alert"><h1>Document Studio Light could not start</h1><p>{error}</p><p>Reinstall this version to restore bundled components.</p></main>
{:else if ready}<iframe title="Document Studio Light editor" src="/editor.html" onload={editorLoaded}></iframe>
{:else}<main role="status">Starting Document Studio Light…</main>{/if}
{#if printRequest}<PrintDialog total={printRequest.total} finish={finishPrint}/>{/if}
<style>iframe{position:fixed;inset:0;width:100%;height:100%;border:0}main{padding:2rem;font:16px system-ui;color:var(--text,#eee);background:var(--bg,#17101f);min-height:100vh;box-sizing:border-box}</style>
