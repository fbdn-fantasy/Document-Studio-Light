"""Test an NSIS installation under Wine in a disposable, offline Linux namespace.

Requires bubblewrap, Wine, Xvfb and a Microsoft x64 Evergreen standalone
WebView2 installer. Optional --previous-installer also tests the V1.0.0 upgrade.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time


def wait_for(check, seconds, message):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        result = check()
        if result:
            return result
        time.sleep(0.5)
    raise RuntimeError(message)


def exercise():
    # This entry point is invoked only from the mounted copy in the namespace.
    if Path(__file__) != Path('/tmp/test-install.py') or not os.statvfs('/').f_flag & os.ST_RDONLY:
        raise SystemExit('The installer test requires its private read-only namespace.')
    work = Path('/tmp/trial')
    home = Path(os.environ['HOME'])
    prefix = Path(os.environ['WINEPREFIX'])
    desktop = home / 'Desktop'
    for key in ('HOME', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
                'XDG_STATE_HOME', 'XDG_RUNTIME_DIR', 'TMPDIR', 'WINEPREFIX'):
        p = Path(os.environ[key])
        if not p.is_relative_to(work):
            raise SystemExit('All test directories must be inside the private mount.')
        p.mkdir(mode=0o700, parents=True, exist_ok=True)
    desktop.mkdir()
    Path('/tmp/.X11-unix').mkdir(mode=0o1777)
    (Path(os.environ['XDG_CONFIG_HOME']) / 'user-dirs.dirs').write_text(
        'XDG_DESKTOP_DIR="$HOME/Desktop"\n', encoding='utf-8')
    with (work / 'wine.log').open('wb') as log:
        def run(args, timeout=120):
            subprocess.run(args, check=True, stdout=log, stderr=log, timeout=timeout)

        display = subprocess.Popen(['Xvfb', ':51', '-screen', '0', '1280x900x24',
                                    '-nolisten', 'tcp'], stdout=log, stderr=log)
        try:
            wait_for(lambda: Path('/tmp/.X11-unix/X51').is_socket(), 15, 'Private X server failed')
            run(['wineboot', '-i'])
            run(['wineserver', '-w'])
            # Reject user-shell-folder redirects outside the test mount (including
            # customized Desktop paths). Wineboot itself already runs behind it.
            desktops = {desktop, prefix / 'drive_c/users/Public/Desktop'}
            for key, name in [(r'HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders', 'Desktop'),
                              (r'HKLM\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders', 'Common Desktop')]:
                value = subprocess.check_output(['wine', 'reg', 'query', key, '/v', name],
                                                stderr=log).decode('utf-8', 'replace')
                raw = next(line.split('REG_SZ', 1)[1].strip() for line in value.splitlines() if 'REG_SZ' in line)
                target = Path(subprocess.check_output(['winepath', '-u', raw], stderr=log, text=True).strip()).resolve()
                if not target.is_relative_to(work):
                    raise RuntimeError('Wine mapped the Desktop outside the disposable test directory')
                desktops.add(target)

            run(['wine', '/tmp/webview2.exe', '/silent', '/install'], timeout=240)
            install = prefix / 'drive_c/InstalledEditor'
            args = ['/S', r'/D=C:\InstalledEditor']
            def installed_shortcuts():
                for directory in desktops:
                    if any(f.suffix.lower() in ('.lnk', '.desktop') for f in directory.glob('*')):
                        raise RuntimeError('The installer left a desktop shortcut')
                data = Path(os.environ['XDG_DATA_HOME'])
                exported = list((data / 'applications').rglob('*.desktop'))
                if exported:
                    raise RuntimeError('Wine exported a launcher to XDG applications')
                programs = list((prefix / 'drive_c/users').rglob('Start Menu/Programs/**/Document Studio Light.lnk'))
                if not programs:
                    raise RuntimeError('Missing Windows Start Menu shortcut')
                app, = install.glob('Document-Studio-Light-V*.exe')
                if not all(app.name.encode('utf-16le') in link.read_bytes() or
                           app.name.encode('ascii') in link.read_bytes() for link in programs):
                    raise RuntimeError('Start Menu shortcut does not target the installed version')
                return app
            run(['wine', '/tmp/setup.exe', *args], timeout=180)
            app = installed_shortcuts()
            print('Fresh install registered the Start Menu shortcut and left both desktops clear.', flush=True)
            if Path('/tmp/previous.exe').is_file():
                run(['wine', str(install / 'uninstall.exe'), '/S', r'_?=C:\InstalledEditor'], timeout=120)
                run(['wine', '/tmp/previous.exe', *args], timeout=180)
                if not any((directory / 'Document Studio Light.lnk').is_file() for directory in desktops):
                    raise RuntimeError('V1.0.0 did not provide the desktop shortcut required for the upgrade test')
                run(['wine', '/tmp/setup.exe', *args], timeout=180)
                app = installed_shortcuts()
                print('Upgrade removed the old desktop shortcut and updated the Start Menu target.', flush=True)
            for name in ('LICENSE', 'NOTICE'):
                if not (install / 'app-resources' / name).is_file():
                    raise RuntimeError('Missing installed ' + name)
            profile = prefix / 'drive_c/EditorProbe'
            profile.mkdir()
            document = profile / 'probe.txt'
            document.write_text('Installed document smoke test', encoding='utf-8')
            app_env = dict(os.environ, FTE_TEST_DATA=r'C:\EditorProbe')
            process = subprocess.Popen(['wine', str(app), r'C:\EditorProbe\probe.txt'], env=app_env,
                                       stdout=log, stderr=log)
            try:
                def opened():
                    settings = profile / 'settings.json'
                    try:
                        return r'C:\EditorProbe\probe.txt' in json.loads(settings.read_text()).get('recents', [])
                    except (FileNotFoundError, json.JSONDecodeError):
                        return False
                wait_for(opened, 90, 'Installed app did not confirm opening the document')
            finally:
                subprocess.run(['wine', 'taskkill', '/F', '/IM', app.name], stdout=log, stderr=log, timeout=30)
                process.wait(timeout=30)
            print('Installed application opened its document. Start Menu target and clean desktops verified.')
        finally:
            subprocess.run(['wineserver', '-k'], stdout=log, stderr=log)
            display.terminate()
            display.wait(timeout=15)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('installer', type=Path)
    parser.add_argument('webview2', type=Path, help='Microsoft Evergreen x64 standalone installer')
    parser.add_argument('--previous-installer', type=Path)
    parser.add_argument('--tools-root', type=Path, help='Optional extracted distribution packages containing Xvfb')
    parser.add_argument('--work-parent', type=Path, help='Parent directory with space for a temporary Wine installation')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='document-studio-light-wine-', dir=args.work_parent) as tmp:
        cmd = ['bwrap', '--die-with-parent', '--new-session', '--unshare-all', '--ro-bind', '/', '/',
               '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--tmpfs', '/home', '--tmpfs', '/run',
               '--bind', str(Path(tmp).resolve()), '/tmp/trial', '--chdir', '/tmp/trial', '--clearenv',
               '--ro-bind', str(Path(__file__).resolve()), '/tmp/test-install.py',
               '--ro-bind', str(args.installer.resolve(strict=True)), '/tmp/setup.exe',
               '--ro-bind', str(args.webview2.resolve(strict=True)), '/tmp/webview2.exe']
        if args.previous_installer:
            cmd += ['--ro-bind', str(args.previous_installer.resolve(strict=True)), '/tmp/previous.exe']
        if args.tools_root:
            cmd += ['--ro-bind', str(args.tools_root.resolve(strict=True)), '/tmp/tools']
        env = {'HOME': '/tmp/trial/home', 'WINEPREFIX': '/tmp/trial/prefix', 'TMPDIR': '/tmp/trial/tmp',
               'XDG_CACHE_HOME': '/tmp/trial/cache', 'XDG_CONFIG_HOME': '/tmp/trial/config',
               'XDG_DATA_HOME': '/tmp/trial/data', 'XDG_STATE_HOME': '/tmp/trial/state', 'XDG_RUNTIME_DIR': '/tmp/trial/run',
               'XDG_CONFIG_DIRS': '/tmp/tools/etc/xdg:/etc/xdg', 'XDG_DATA_DIRS': '/tmp/tools/usr/share:/usr/share',
               'PATH': '/tmp/tools/usr/bin:/usr/bin:/bin', 'LD_LIBRARY_PATH': '/tmp/tools/usr/lib64',
               'DISPLAY': ':51', 'WINEDEBUG': '-all', 'WINEDLLOVERRIDES': 'winemenubuilder.exe,mscoree,mshtml=',
               'LIBGL_ALWAYS_SOFTWARE': '1', '__GLX_VENDOR_LIBRARY_NAME': 'mesa',
               '__EGL_VENDOR_LIBRARY_FILENAMES': '/usr/share/glvnd/egl_vendor.d/50_mesa.json', 'WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS': '--disable-gpu --no-sandbox',
               'LC_ALL': 'C.UTF-8'}
        for k, v in env.items():
            cmd += ['--setenv', k, v]
        cmd += ['/usr/bin/python3', '-I', '/tmp/test-install.py', '--in-namespace']
        try:
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError:
            log = Path(tmp, 'wine.log')
            if log.is_file():
                print(log.read_text(errors='replace')[-2400:], file=sys.stderr)
            raise SystemExit('The isolated Windows installer test failed.') from None


if __name__ == '__main__':
    if sys.argv[1:] == ['--in-namespace']:
        exercise()
    else:
        main()
