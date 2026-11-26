"""Launch an installed editor by its Linux application-menu ID in a private profile.

Run under an isolated graphical D-Bus session:
    python3 scripts/test-linux-menu.py /usr
For a TAR installation, pass the prefix used with install.sh.
"""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time


APP_ID = 'com.forbiddenfantasy.DocumentStudioLight'


def editor_processes(executable, profile):
    marker = os.fsencode('FTE_TEST_DATA=' + str(profile))
    for proc in Path('/proc').glob('[0-9]*'):
        try:
            if (proc / 'exe').resolve(strict=True) == executable:
                if marker in (proc / 'environ').read_bytes().split(b'\0'):
                    yield int(proc.name)
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            continue


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('prefix', type=Path)
    prefix = parser.parse_args().prefix.resolve(strict=True)
    binary = (prefix / 'bin/document-studio-light').resolve(strict=True)
    desktop = prefix / 'share/applications' / (APP_ID + '.desktop')
    assert desktop.is_file() and (prefix / 'share/icons/hicolor/128x128/apps' / (APP_ID + '.png')).is_file()
    with tempfile.TemporaryDirectory(prefix='document-studio-menu-') as scratch:
        home = Path(scratch)
        user_desktop = home / 'Desktop'
        user_desktop.mkdir()
        profile = home / 'editor-profile'
        document = home / 'Menu launch.txt'
        document.write_text('Application-menu launch test.\n')
        env = dict(os.environ, HOME=scratch, XDG_CONFIG_HOME=str(home / 'config'),
                   XDG_DATA_HOME=str(home / 'data'), XDG_CACHE_HOME=str(home / 'cache'),
                   XDG_DATA_DIRS=str(prefix / 'share') + ':/usr/local/share:/usr/share',
                   FTE_TEST_DATA=str(profile), GIO_USE_PORTALS='0', GTK_USE_PORTAL='0')
        env['PATH'] = os.pathsep.join(part for part in os.get_exec_path()
                                      if Path(part).resolve() != prefix / 'bin' or prefix == Path('/usr'))
        try:
            subprocess.run(['gtk-launch', APP_ID, document.as_uri()], cwd='/', env=env, check=True)
            deadline = time.monotonic() + 70
            while time.monotonic() < deadline:
                try:
                    settings = json.loads((profile / 'settings.json').read_text())
                    if str(document) in settings.get('recents', []) and any(editor_processes(binary, profile)):
                        assert not list(user_desktop.iterdir())
                        print('The application menu launched the installed binary and opened the document.')
                        return
                except (FileNotFoundError, json.JSONDecodeError):
                    pass
                time.sleep(.2)
            raise RuntimeError('The installed editor did not open the supplied document from its menu entry.')
        finally:
            for pid in editor_processes(binary, profile):
                try:
                    os.kill(pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass


if __name__ == '__main__':
    main()
