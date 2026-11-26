"""Interactive, non-WebDriver native print validation on an isolated Xvfb.

Commands on stdin: key Control_L p | click X Y | capture NAME.png | quit.
No physical print job should be submitted: cancel the system print dialog.
"""
from pathlib import Path
import argparse,ctypes,os,subprocess,tempfile,time
p=argparse.ArgumentParser();p.add_argument('application');p.add_argument('xvfb');p.add_argument('evidence');a=p.parse_args();out=Path(a.evidence).resolve();out.mkdir(exist_ok=True,parents=True)
with tempfile.TemporaryDirectory(prefix='document-studio-native-print-') as tmp:
 env=dict(os.environ,HOME=tmp,DISPLAY=':120',GDK_BACKEND='x11',GDK_SCALE='1',GDK_DPI_SCALE='1',GTK_USE_PORTAL='0',GIO_USE_PORTALS='0',WEBKIT_DISABLE_DMABUF_RENDERER='1',WEBKIT_DISABLE_COMPOSITING_MODE='1',XDG_CONFIG_HOME=str(Path(tmp)/'config'),XDG_DATA_HOME=str(Path(tmp)/'data'),XDG_CACHE_HOME=str(Path(tmp)/'cache'))
 for key in ['TAURI_AUTOMATION','TAURI_WEBVIEW_AUTOMATION']:env.pop(key,None)
 sample=Path(tmp)/'Native print acceptance.txt';sample.write_text('Native print acceptance\nThis document tests the real operating-system print dialog.\n')
 log=(out/'native-process.log').open('w');display=subprocess.Popen([a.xvfb,':120','-screen','0','1500x1050x24','-nolisten','tcp'],env=env,stdout=log,stderr=subprocess.STDOUT);time.sleep(.7);app=subprocess.Popen([str(Path(a.application).resolve()),str(sample)],env=env,stdout=log,stderr=subprocess.STDOUT)
 x=ctypes.CDLL('libX11.so.6');xt=ctypes.CDLL('libXtst.so.6');x.XOpenDisplay.restype=ctypes.c_void_p;x.XOpenDisplay.argtypes=[ctypes.c_char_p];d=x.XOpenDisplay(b':120');assert d
 x.XStringToKeysym.restype=ctypes.c_ulong;x.XStringToKeysym.argtypes=[ctypes.c_char_p];x.XKeysymToKeycode.argtypes=[ctypes.c_void_p,ctypes.c_ulong];x.XKeysymToKeycode.restype=ctypes.c_uint;x.XFlush.argtypes=[ctypes.c_void_p];xt.XTestFakeKeyEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong];xt.XTestFakeMotionEvent.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_ulong];xt.XTestFakeButtonEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
 def capture(name):subprocess.run(['import','-window','root',str(out/name)],env=env,check=True);print('Captured',name,flush=True)
 try:
  time.sleep(6);capture('native-app.png');print('READY: key/click/capture/quit',flush=True)
  import sys
  for line in sys.stdin:
   parts=line.strip().split()
   if not parts:continue
   if parts[0]=='quit':break
   if parts[0]=='capture':capture(parts[1]);continue
   if parts[0]=='click':
    xt.XTestFakeMotionEvent(d,-1,int(parts[1]),int(parts[2]),0);xt.XTestFakeButtonEvent(d,1,1,0);xt.XTestFakeButtonEvent(d,1,0,0)
   elif parts[0]=='key':
    codes=[x.XKeysymToKeycode(d,x.XStringToKeysym(k.encode())) for k in parts[1:]]
    for code in codes:xt.XTestFakeKeyEvent(d,code,1,0)
    for code in reversed(codes):xt.XTestFakeKeyEvent(d,code,0,0)
   x.XFlush(d);time.sleep(.5);print('Sent',line.strip(),flush=True)
 finally:
  x.XCloseDisplay.argtypes=[ctypes.c_void_p];x.XCloseDisplay(d)
  for child in [app,display]:
   child.terminate()
   try:child.wait(timeout=5)
   except subprocess.TimeoutExpired:child.kill();child.wait()
  log.close()
