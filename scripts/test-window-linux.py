"""Native X11 acceptance: normal/maximized restoration and first-visible size.
Run under dbus-run-session; requires Xvfb, openbox, xdotool, wmctrl and xprop.
Uses a disposable profile; never touches the user's settings.
"""
import json, os, subprocess, sys, tempfile, time
from pathlib import Path

app = str(Path(sys.argv[1]).resolve(strict=True))
out = Path(sys.argv[2]).resolve(); out.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='docstudio-window-test-') as temp:
    env = dict(os.environ, HOME=temp, XDG_CONFIG_HOME=temp+'/config',
               XDG_DATA_HOME=temp+'/data', XDG_CACHE_HOME=temp+'/cache',
               DISPLAY=':121', GDK_BACKEND='x11', GDK_SCALE='1', GDK_DPI_SCALE='1',
               WEBKIT_DISABLE_DMABUF_RENDERER='1', WEBKIT_DISABLE_COMPOSITING_MODE='1')
    log = (out/'window-test.log').open('w')
    display = subprocess.Popen(['Xvfb', ':121', '-screen', '0', '1600x1100x24', '-nolisten', 'tcp'], env=env, stdout=log, stderr=log)
    time.sleep(.5)
    wm = subprocess.Popen(['openbox'], env=env, stdout=log, stderr=log)
    time.sleep(.5)
    child = None
    def command(*args, check=True):
        return subprocess.run(args, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=check).stdout.strip()
    def geometry(w):
        return {k:int(v) for k,v in (s.split('=',1) for s in command('xdotool','getwindowgeometry','--shell',w).splitlines()) if k in ('WIDTH','HEIGHT','X','Y')}
    def launch():
        global child
        child = subprocess.Popen([app], env=env, stdout=log, stderr=log)
        end=time.monotonic()+90
        while time.monotonic()<end:
            ids=command('xdotool','search','--onlyvisible','--pid',str(child.pid),check=False).splitlines()
            for w in ids:
                g=geometry(w)
                if g['WIDTH']>=900 and g['HEIGHT']>=650:
                    return w,g
            if child.poll() is not None:raise AssertionError('App exited before becoming visible')
            time.sleep(.01)
        raise AssertionError('Window did not become visible')
    def close(w):
        command('xdotool','windowactivate','--sync',w)
        command('wmctrl','-ic',w)
        child.wait(timeout=30)
        assert child.returncode==0
    try:
        w,first=launch()
        assert first['WIDTH']>1400 and first['HEIGHT']>950, first
        icon=command('xprop','-id',w,'_NET_WM_ICON')
        assert 'not found' not in icon and 'no such atom' not in icon, icon
        wmclass=command('xprop','-id',w,'WM_CLASS')
        assert 'com.forbiddenfantasy.documentstudiolight' in wmclass.lower(), wmclass
        command('wmctrl','-ir',w,'-b','remove,maximized_vert,maximized_horz')
        time.sleep(.3)
        command('xdotool','windowsize','--sync',w,'1110','760')
        command('xdotool','windowmove','--sync',w,'125','85')
        time.sleep(.3); normal=geometry(w); close(w)
        statefile=Path(temp)/'config/com.forbiddenfantasy.DocumentStudioLight/.window-state.json'
        saved=json.loads(statefile.read_text())['main']
        assert (saved['width'],saved['height'])==(1110,760), saved
        w,restored=launch()
        assert (restored['WIDTH'],restored['HEIGHT'])==(1110,760), restored
        second=subprocess.run([app],env=env,stdout=log,stderr=log,timeout=15)
        assert second.returncode==0 and child.poll() is None
        command('xdotool','windowactivate','--sync',w)
        command('wmctrl','-ir',w,'-b','toggle,maximized_vert,maximized_horz')
        time.sleep(.5); maximized=geometry(w)
        assert maximized['WIDTH']>1400,maximized
        close(w)
        savedmax=json.loads(statefile.read_text())['main']; assert savedmax['maximized'],savedmax
        w,reopenedmax=launch()
        assert reopenedmax['WIDTH']==maximized['WIDTH'] and reopenedmax['HEIGHT']==maximized['HEIGHT'],reopenedmax
        command('wmctrl','-ir',w,'-b','toggle,maximized_vert,maximized_horz');time.sleep(.5)
        unmaximized=geometry(w)
        assert (unmaximized['WIDTH'],unmaximized['HEIGHT'])==(1110,760),unmaximized
        close(w)
        result={'passed':True,'initial':first,'savedNormal':normal,'firstVisibleRestored':restored,
                'maximized':maximized,'firstVisibleMaximized':reopenedmax,'unmaximized':unmaximized,
                'iconPresent':True,'windowClass':wmclass,'singleInstance':True,
                'observation':'First visible X11 window sampled at 10 ms intervals; normal and maximized geometry checked.'}
        (out/'window-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
    finally:
        if child and child.poll() is None:child.terminate();child.wait(timeout=10)
        wm.terminate();display.terminate();wm.wait(timeout=10);display.wait(timeout=10);log.close()



