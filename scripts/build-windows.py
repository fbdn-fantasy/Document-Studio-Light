"""Compile the x64 editor and build its standard NSIS installer."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cross', action='store_true', help='Use the Cargo XWin runner on Linux.')
    parser.add_argument('--out', type=Path, help='Destination directory for the installer.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    target = 'x86_64-pc-windows-msvc'
    env = os.environ.copy()
    env.setdefault('CARGO_PROFILE_RELEASE_DEBUG', '0')
    cargo_home = Path(env.get('CARGO_HOME', Path.home() / '.cargo'))
    target_dir = Path(env.get('CARGO_TARGET_DIR', root / 'src-tauri' / 'target'))
    flags = []
    for original, destination in [(Path.home(), 'account'), (root, 'document-studio-light'),
                                  (cargo_home, 'cargo'), (target_dir, 'target')]:
        path = original
        # cargo-xwin passes flags separated by spaces. Map the enclosing clean
        # directory when the checkout includes spaces, e.g. Documents/My App.
        if args.cross and ' ' in str(path) and path.is_relative_to(Path.home()):
            continue  # The home prefix already covers this directory.
        while args.cross and ' ' in str(path):
            path = path.parent
        if path != Path(path.anchor):
            flags.append(f'--remap-path-prefix={path}=/build/{destination}')
    flags += ['-C', 'link-arg=/PDBALTPATH:%_PDB%', '-C', 'strip=symbols']
    if args.cross:
        env['RUSTFLAGS'] = ' '.join(filter(None, [env.get('RUSTFLAGS'), *flags]))
    else:
        env['CARGO_ENCODED_RUSTFLAGS'] = '\x1f'.join(filter(None, [env.get('CARGO_ENCODED_RUSTFLAGS'), *flags]))
    subprocess.run([sys.executable, 'scripts/stage.py', 'windows'], cwd=root, env=env, check=True)
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm:
        raise SystemExit('Install Node.js and npm before building.')
    command = [npm, 'run', 'tauri', 'build', '--']
    if args.cross:
        command += ['--runner', 'cargo-xwin']
    command += ['--target', target, '--bundles', 'nsis']
    subprocess.run(command, cwd=root, env=env, check=True)
    version = json.loads((root / 'package.json').read_text())['version']
    generated = target_dir / target / 'release' / 'bundle' / 'nsis' / f'Document Studio Light_{version}_x64-setup.exe'
    destination = args.out or root / 'release' / 'Windows'
    destination.mkdir(parents=True, exist_ok=True)
    setup = destination / f'Document-Studio-Light-V{version}-Setup.exe'
    shutil.copy2(generated, setup)
    print('Created', setup.name)


if __name__ == '__main__':
    main()
