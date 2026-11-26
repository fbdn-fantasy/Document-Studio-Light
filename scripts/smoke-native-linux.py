"""Exercise the installed Tauri/WebKitGTK application using native WebDriver.

Requires WebKitWebDriver and dbus-run-session, plus either Xvfb, ImageMagick and
libXtst (--xvfb /usr/bin/Xvfb), or Broadway and optional test-only Playwright.
The test enables Tauri automation only for its child processes and never modifies
the user profile. X11/Xvfb is the verified path; Broadway has DPI artifacts here.
Run: dbus-run-session -- python3 scripts/smoke-native-linux.py APP EVIDENCE_DIR --xvfb /usr/bin/Xvfb
"""
from pathlib import Path
import argparse,base64,json,os,socket,subprocess,tempfile,time,urllib.request,urllib.error
p=argparse.ArgumentParser();p.add_argument('application');p.add_argument('evidence');p.add_argument('--broadway-browser',action='store_true');p.add_argument('--native-print',action='store_true');p.add_argument('--xvfb');p.add_argument('--startup');p.add_argument('--expect-text');args=p.parse_args();app=Path(args.application).resolve(strict=True);out=Path(args.evidence).resolve();out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='document-studio-native-') as temp:
 env=dict(os.environ,HOME=temp,GTK_USE_PORTAL='0',GIO_USE_PORTALS='0',GDK_BACKEND='broadway',BROADWAY_DISPLAY=':19',TAURI_WEBVIEW_AUTOMATION='true',WEBKIT_DISABLE_DMABUF_RENDERER='1',WEBKIT_DISABLE_COMPOSITING_MODE='1',XDG_CONFIG_HOME=str(Path(temp)/'config'),XDG_DATA_HOME=str(Path(temp)/'data'),XDG_CACHE_HOME=str(Path(temp)/'cache'))
 if args.xvfb:env.update(GDK_BACKEND='x11',DISPLAY=':119',GDK_SCALE='1',GDK_DPI_SCALE='1')
 broadwaylog=(out/'display.log').open('w');driverlog=(out/'webdriver.log').open('w');display_args=[str(Path(args.xvfb).resolve()),':119','-screen','0','1500x1050x24','-nolisten','tcp'] if args.xvfb else ['broadwayd',':19'];broadway=subprocess.Popen(display_args,env=env,stdout=broadwaylog,stderr=subprocess.STDOUT);time.sleep(.5);driver=subprocess.Popen(['WebKitWebDriver','--port=9457'],env=env,stdout=driverlog,stderr=subprocess.STDOUT)
 session=None;observer=None
 if args.broadway_browser:
  observer=subprocess.Popen(['node',str(Path(__file__).with_name('broadway-view.cjs')),'http://127.0.0.1:8099'],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=driverlog,text=True,bufsize=1)
  if observer.stdout.readline().strip()!='ready':
   driver.terminate();broadway.terminate();observer.terminate();driver.wait(timeout=5);broadway.wait(timeout=5);raise RuntimeError('Broadway browser observer did not start; see webdriver.log')
 def capture(path):
  if observer:
   observer.stdin.write(str(path)+'\n');observer.stdin.flush();assert observer.stdout.readline().strip()=='captured'
  elif args.xvfb:subprocess.run(['import','-window','root',str(path)],env=env,check=True)
 def escape():
  if observer:
   observer.stdin.write('key:Escape\n');observer.stdin.flush();assert observer.stdout.readline().strip()=='key sent'
  else:
   import ctypes
   x=ctypes.CDLL('libX11.so.6');xt=ctypes.CDLL('libXtst.so.6');x.XOpenDisplay.restype=ctypes.c_void_p;x.XOpenDisplay.argtypes=[ctypes.c_char_p];d=x.XOpenDisplay(env['DISPLAY'].encode());assert d
   x.XStringToKeysym.restype=ctypes.c_ulong;x.XStringToKeysym.argtypes=[ctypes.c_char_p];x.XKeysymToKeycode.argtypes=[ctypes.c_void_p,ctypes.c_ulong];x.XKeysymToKeycode.restype=ctypes.c_uint;code=x.XKeysymToKeycode(d,x.XStringToKeysym(b'Escape'));xt.XTestFakeKeyEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong];xt.XTestFakeKeyEvent(d,code,1,0);xt.XTestFakeKeyEvent(d,code,0,0);x.XFlush.argtypes=[ctypes.c_void_p];x.XFlush(d);x.XCloseDisplay.argtypes=[ctypes.c_void_p];x.XCloseDisplay(d)
 def request(method,path,body=None,timeout=180):
  data=None if body is None else json.dumps(body).encode();r=urllib.request.Request('http://127.0.0.1:9457'+path,data=data,method=method,headers={'Content-Type':'application/json'})
  try:
   with urllib.request.urlopen(r,timeout=timeout) as res:value=json.load(res)
  except urllib.error.HTTPError as e:raise RuntimeError(e.read().decode()) from e
  if isinstance(value.get('value'),dict) and 'error' in value['value']:raise RuntimeError(json.dumps(value))
  return value.get('value')
 try:
  deadline=time.monotonic()+10
  while True:
   try:request('GET','/status',timeout=1);break
   except Exception:
    if time.monotonic()>deadline:raise
    time.sleep(.2)
  created=request('POST','/session',{'capabilities':{'alwaysMatch':{'webkitgtk:browserOptions':{'binary':str(app),'args':[str(Path(args.startup).resolve())] if args.startup else []}}}});session=created['sessionId'];(out/'session.json').write_text(json.dumps(created,indent=2));prefix='/session/'+session
  request('POST',prefix+'/timeouts',{'script':180000,'pageLoad':180000,'implicit':0})
  def js(script,*values):return request('POST',prefix+'/execute/sync',{'script':script,'args':list(values)})
  deadline=time.monotonic()+120
  while True:
   state=js("const f=document.querySelector('iframe');return {title:document.title,text:document.body.innerText,ready:!!f?.contentWindow?.FTEPro&&!!f?.contentWindow?.FTESurfaceFiles&&f?.contentDocument?.readyState==='complete',sheets:f?.contentDocument?.querySelectorAll('#pages-container > .sheet').length||0};")
   (out/'loading-state.json').write_text(json.dumps(state,indent=2))
   if state['ready'] and state['sheets']:break
   if time.monotonic()>deadline:raise RuntimeError('Editor did not become ready: '+json.dumps(state))
   time.sleep(.5)
  initial=state
  if args.expect_text:
   deadline=time.monotonic()+20
   while True:
    opened=js("const w=document.querySelector('iframe').contentWindow;return {text:w.document.querySelector('#pages-container').textContent,status:w.document.querySelector('#desktop-status')?.textContent};")
    if args.expect_text in opened['text']:break
    if time.monotonic()>deadline:raise RuntimeError('Startup document bytes were not decoded: '+json.dumps(opened))
    time.sleep(.2)
   (out/'startup-document.json').write_text(json.dumps(opened,indent=2))
  request('POST',prefix+'/execute/async',{'script':"document.querySelector('iframe').contentDocument.fonts.ready.then(arguments[arguments.length-1]);",'args':[]})
  document=js("const w=document.querySelector('iframe').contentWindow;w.loadState({name:'Native Linux acceptance',html:'<h1>Native Tauri</h1><p>Offline document editing works.</p><div class=\"page-break\"></div><h1>Page two</h1>'});return {pages:w.document.querySelectorAll('#pages-container > .sheet').length,text:w.document.querySelector('#pages-container').innerText};")
  time.sleep(1)
  document=js("const w=document.querySelector('iframe').contentWindow;w.layout();return {pages:w.document.querySelectorAll('#pages-container > .sheet').length,text:w.document.querySelector('#pages-container').textContent,viewport:[w.innerWidth,w.innerHeight]};")
  capture(out/'native-before-assert.png')
  assert document['pages']==2,document
  assert 'Native Tauri' in document['text'],document
  dictionary=request('POST',prefix+'/execute/async',{'script':"window.documentStudioDesktop.dictionaries().then(arguments[arguments.length-1]);",'args':[]});assert len(dictionary['items'])>=8,dictionary
  screenshot=request('GET',prefix+'/screenshot');(out/'native-editor.png').write_bytes(base64.b64decode(screenshot))
  capture(out/'native-gtk-window.png')
  print_check=None
  if args.native_print:
   assert observer or args.xvfb,'Native print screenshot requires a display observer'
   before=js("return JSON.stringify(document.querySelector('iframe').contentWindow.state());")
   js("window.__nativePrintState='pending';window.documentStudioDesktop.print().then(value=>window.__nativePrintState=value).catch(error=>window.__nativePrintState=String(error));return true;")
   deadline=time.monotonic()+20
   while not js("return !!document.querySelector('dialog[open] #print-heading');"):
    if time.monotonic()>deadline:raise RuntimeError('Print settings did not open')
    time.sleep(.2)
   js("document.querySelectorAll('input[name=pages]')[1].click();let range=document.querySelector('[aria-label=\"Page numbers and ranges\"]');range.value='2';range.dispatchEvent(new Event('input',{bubbles:true}));for(const [label,value] of [['Print orientation','landscape'],['Print color','monochrome']]){let s=document.querySelector('[aria-label=\"'+label+'\"]');s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}));}document.querySelector('button[type=submit]').click();return true;")
   time.sleep(4)
   diagnostic=js("const f=document.querySelector('iframe[data-print-frame]');return {state:window.__nativePrintState,frame:!!f,styles:Array.from(f?.contentDocument?.querySelectorAll('link')||[]).map(l=>({href:l.href,loaded:!!l.sheet})),fonts:f?.contentDocument?.fonts.status,ready:f?.contentDocument?.readyState,pages:f?.contentDocument?.querySelectorAll('.v20-print-page').length};");(out/'print-diagnostic.json').write_text(json.dumps(diagnostic,indent=2))
   capture(out/'native-gtk-print-dialog.png');escape()
   time.sleep(1)
   after=js("return JSON.stringify(document.querySelector('iframe').contentWindow.state());")
   assert before==after,'Printing changed the document'
   print_check={'settings':'page 2, landscape, monochrome','rootScreenshot':'native-gtk-print-dialog.png','dialogObserved':None,'scope':'Native dialog requires visual confirmation; WebDriver can suppress print UI.','documentUnchanged':True}
  result={'ok':True,'application':str(app),'engine':'Native Tauri 2 / WebKitGTK via '+('X11/Xvfb' if args.xvfb else 'Broadway')+' and WebDriver','initial':initial,'document':document,'dictionaryCount':len(dictionary['items']),'nativePrint':print_check,'checks':['native application launch','bundled service bridge','editor ready','two-page document editing','native IPC dictionary response','native screenshot']}
  (out/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
 finally:
  if session:
   try:request('DELETE','/session/'+session,timeout=5)
   except Exception:pass
  if observer:
   try:observer.stdin.write('close\n');observer.stdin.flush();observer.wait(timeout=10)
   except Exception:observer.kill()
  driver.terminate();broadway.terminate()
  for process in [driver,broadway]:
   try:process.wait(timeout=5)
   except subprocess.TimeoutExpired:process.kill();process.wait()
  driverlog.close();broadwaylog.close()
