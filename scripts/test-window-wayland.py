"""Run on a Wayland desktop (1600 x 1050 or larger, scale 1) with WebKitWebDriver.

    dbus-run-session -- python3 scripts/test-window-wayland.py /path/to/document-studio

The native app uses a temporary profile. All dimensions below are GTK client pixels.
"""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request


def wait_for(check, description, timeout=40):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        value = check()
        if value:
            return value
        time.sleep(0.1)
    raise TimeoutError(description)


def request(port, method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    message = urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=data,
                                     method=method, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(message, timeout=30) as response:
        return json.load(response)['value']


def session(application, env, check_window, expected_theme, next_theme):
    with socket.socket() as available:
        available.bind(('127.0.0.1', 0))
        port = available.getsockname()[1]
    driver = subprocess.Popen(['WebKitWebDriver', f'--port={port}'], env=env)
    try:
        def ready():
            try:
                return request(port, 'GET', '/status')['ready']
            except OSError:
                return False

        wait_for(ready, 'WebKitWebDriver did not start')
        options = {'webkitgtk:browserOptions': {'binary': str(application)}}
        result = request(port, 'POST', '/session', {'capabilities': {'alwaysMatch': options}})
        base = '/session/' + result['sessionId']

        def script(code):
            return request(port, 'POST', base + '/execute/sync', {'script': code, 'args': []})

        def size():
            return script("return document.querySelector('iframe')?.contentWindow?.FTEDesktop"
                          " && innerWidth && innerHeight ? [innerWidth, innerHeight] : null")

        wait_for(size, 'Editor did not become visible')
        frame = "document.querySelector('iframe').contentWindow"
        wait_for(lambda: script(f"return {frame}.DocumentStudioTheme?.current") == expected_theme,
                 'Application did not restore its theme')
        active = script(f"const w={frame};return [w.document.documentElement.dataset.appTheme,"
                        "w.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light']")
        assert active[0] == (active[1] if expected_theme == 'system' else expected_theme), active
        script(f"const w={frame};w.document.querySelector('#theme-buttons [data-theme={next_theme}]').click();"
               "return true")
        def theme_saved():
            return request(port, 'POST', base + '/execute/async', {
                'script': "window.documentStudioDesktop.init().then(x => arguments[0](x.settings.theme));",
                'args': [],
            }) == next_theme
        wait_for(theme_saved, 'The selected theme was not written to the desktop profile')
        check_window(size, lambda path, data: request(port, 'POST', base + path, data))
        script('setTimeout(() => window.documentStudioDesktop.close(), 100); return true')

        def exited():
            try:
                script('return true')
            except (urllib.error.HTTPError, OSError):
                return True
            return False

        wait_for(exited, 'The native app did not close')
    finally:
        driver.terminate()
        driver.wait(timeout=10)


def main():
    app = Path(sys.argv[1]).resolve(strict=True)
    if not os.environ.get('WAYLAND_DISPLAY'):
        raise SystemExit('Run this check in a Wayland session.')
    with tempfile.TemporaryDirectory(prefix='studio-wayland-window-') as temporary:
        profile = Path(temporary)
        env = dict(os.environ, HOME=temporary, FTE_TEST_DATA=temporary, GDK_BACKEND='wayland',
                   XDG_CONFIG_HOME=str(profile/'config'), XDG_DATA_HOME=str(profile/'data'),
                   XDG_CACHE_HOME=str(profile/'cache'), GDK_SCALE='1', GDK_DPI_SCALE='1',
                   TAURI_WEBVIEW_AUTOMATION='true', GTK_USE_PORTAL='0', GIO_USE_PORTALS='0',
                   WEBKIT_DISABLE_DMABUF_RENDERER='1', WEBKIT_DISABLE_COMPOSITING_MODE='1')
        state_file = profile/'window-state.json'
        old = dict(width=1140, height=800, x=0, y=0, prev_x=0, prev_y=0, maximized=False,
                   visible=True, decorated=True, fullscreen=False)
        state_file.write_text(json.dumps({'main': old}))
        normal = [1110, 760]

        def resize(size, command):
            assert size() == [1140, 800], 'Existing window state did not restore'
            command('/window/rect', {'width': normal[0], 'height': normal[1]})
            wait_for(lambda: size() == normal, 'Native resize did not take effect')

        def reopened(size, _command):
            assert size() == normal, 'Normal client dimensions changed across launches'

        maximized = []

        def maximize(size, command):
            reopened(size, command)
            command('/window/maximize', {})
            wait_for(lambda: size()[0] > normal[0] and size()[1] > normal[1], 'Window did not maximize')
            maximized.extend(size())

        def reopened_maximized(size, _command):
            assert size() == maximized, 'Maximized dimensions changed on restart'

        for check, is_maximized, expected, selected in [
            (resize, False, 'system', 'dark'), (reopened, False, 'dark', 'original'),
            (maximize, True, 'original', 'light'), (reopened_maximized, True, 'light', 'system'),
        ]:
            session(app, env, check, expected, selected)

            def saved():
                try:
                    state = json.loads(state_file.read_text())['main']
                    return [state['width'], state['height']] == normal and state['maximized'] == is_maximized
                except (OSError, ValueError):
                    return False

            wait_for(saved, 'Saved state did not retain the normal client dimensions and maximize flag', 5)
        print('Passed legacy state, repeat normal restarts, maximized restarts and all four theme selections on Wayland.')


if __name__ == '__main__':
    main()
