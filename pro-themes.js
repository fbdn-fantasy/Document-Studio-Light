/* Application appearance only. Never changes document state, SVG or canvas pixels. */
'use strict';
(()=>{
  const key='document-studio-light-application-theme', names={system:'System',light:'Light',dark:'Dark',original:'Purple'};
  const systemDark=window.matchMedia('(prefers-color-scheme: dark)');
  let current='system',serial=0;
  try{const saved=localStorage.getItem(key);if(Object.hasOwn(names,saved))current=saved;}catch{}
  if(Object.hasOwn(names,window.desktop?.initialTheme))current=window.desktop.initialTheme;
  function apply(value,{persist=true,native=true}={}){
    if(!Object.hasOwn(names,value))value='system';
    current=value;document.documentElement.dataset.appTheme=value==='system'?(systemDark.matches?'dark':'light'):value;
    for(const button of document.querySelectorAll('#theme-buttons button'))button.setAttribute('aria-pressed',String(button.dataset.theme===value));
    for(const select of document.querySelectorAll('[data-app-theme-selector]'))select.value=value;
    if(persist){serial++;try{localStorage.setItem(key,value);}catch{}}
    if(native&&window.desktop?.settings)Promise.resolve(window.desktop.settings({theme:value})).catch(()=>{
      if(typeof say==='function')say('Appearance changed. The application preference could not be saved; check available disk space.');
    });
    window.dispatchEvent(new CustomEvent('document-studio-theme-change',{detail:{theme:value}}));
  }
  function appendSelector(host){
    const label=document.createElement('label');label.className='app-theme-setting';label.textContent='Application theme ';
    const select=document.createElement('select');select.dataset.appThemeSelector='';select.setAttribute('aria-label','Application theme');
    for(const [value,text]of Object.entries(names))select.add(new Option(text,value));
    select.value=current;select.onchange=()=>apply(select.value);label.append(select);host.append(label);
    return select;
  }
  function install(){
    const buttons=document.getElementById('theme-buttons');
    for(const button of buttons.querySelectorAll('button')){
      button.setAttribute('aria-pressed',String(button.dataset.theme===current));
      button.addEventListener('click',()=>apply(button.dataset.theme));
    }
    const support=document.getElementById('desktop-support');
    support.addEventListener('click',async event=>{
      if(!window.desktop?.openSupportPage)return;
      event.preventDefault();
      try{await window.desktop.openSupportPage();}
      catch{document.getElementById('message').textContent='Could not open your browser. Visit '+support.href;}
    });
    if(window.FTEPro){
      FTEPro.addApp('Appearance',()=>{modal('Appearance','<div id="app-appearance-settings"></div>');appendSelector(document.getElementById('app-appearance-settings'));},'application theme system original purple light dark settings');
      FTEPro.addApp('About Document Studio Light', () => {
        modal('About Document Studio Light', '<div class="app-about"><img src="assets/icon.png" alt="Document Studio Light" width="64" height="64"><div><strong>Document Studio Light</strong><p>Version 1.0.2</p><small>Created by Forbidden_Fantasy</small></div></div><p>Create, format and print documents offline.</p><details><summary>License and notice</summary><pre id="app-license-text"></pre></details>');
        document.getElementById('app-license-text').textContent = document.getElementById('software-license').content.textContent;
      }, 'version creator license');
    }
    if(Object.hasOwn(names,window.desktop?.initialTheme)){
      apply(current,{native:false});
    }else if(window.desktop?.init){
      const before=serial;
      Promise.resolve(window.desktop.init()).then(result=>{
        if(serial!==before)return;
        const saved=result?.settings?.theme;
        apply(Object.hasOwn(names,saved)?saved:current,{persist:true,native:!Object.hasOwn(names,saved)});
      }).catch(()=>{});
    }
  }
  window.DocumentStudioTheme={apply,appendSelector,get current(){return current;},names:Object.freeze(names)};
  apply(current,{persist:false,native:false});
  systemDark.addEventListener('change',()=>{if(current==='system')apply('system',{persist:false,native:false});});
  window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue,{persist:false,native:true});});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
