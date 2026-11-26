"""Stage a clean web frontend and the offline resources for one desktop target."""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_CACHE = shutil.ignore_patterns('__pycache__', '*.pyc')


def stage_web():
    web = ROOT / 'web-assets'
    if web.exists():
        shutil.rmtree(web)
    web.mkdir()
    for pattern in ('editor.html', 'LICENSE', 'NOTICE', 'desktop.js', 'controls.js', 'language-tools.js',
                    'pro*.js', 'pro*.css', 'studio-*.js', 'studio-*.css'):
        for source in ROOT.glob(pattern):
            shutil.copy2(source, web / source.name)
    shutil.copytree(ROOT / 'assets', web / 'assets', ignore=shutil.ignore_patterns('arabic', 'cjk', 'document-studio-light.png', 'icon.ico', 'icons'))


def stage_resources(platform):
    subprocess.run(['node', 'scripts/restore-large-files.cjs'], cwd=ROOT, check=True)
    resources = ROOT / f'app-resources-{platform}'
    if resources.exists():
        shutil.rmtree(resources)
    resources.mkdir()
    for name in ('desktop-service.cjs', 'storage.cjs', 'dictionary-client.cjs', 'dictionary-worker.cjs',
                 'dictionaries.cjs', 'cjk.cjs', 'sudachi.cjs', 'import-manager.cjs',
                 'LICENSE', 'NOTICE', 'THIRD-PARTY-NOTICES.md'):
        shutil.copy2(ROOT / name, resources / name)
    for name in ('assets/vendor/arabic', 'assets/vendor/cjk', 'notices', 'import-engine'):
        shutil.copytree(ROOT / name, resources / name, ignore=SKIP_CACHE)
    runtime = 'runtime' if platform == 'windows' else 'runtime-linux'
    shutil.copytree(ROOT / runtime, resources / 'runtime', ignore=SKIP_CACHE)
    shutil.copytree(ROOT / f'node-{platform}', resources / 'node')

    package = json.loads((ROOT / 'package.json').read_text())
    modules = ROOT / 'node_modules'
    names = ['nspell', 'hunspell-asm', *(name for name in package['dependencies'] if name.startswith('dictionary-'))]
    pending = [modules / name for name in names]
    while pending:
        source = pending.pop()
        destination = resources / 'node_modules' / source.relative_to(modules)
        if destination.is_dir():
            continue
        shutil.copytree(source, destination, ignore=shutil.ignore_patterns('node_modules'))
        for dep in json.loads((source / 'package.json').read_text()).get('dependencies', {}):
            for parent in (source, *source.parents):
                candidate = parent / 'node_modules' / dep
                if candidate.is_dir():
                    pending.append(candidate)
                    break
                if parent == ROOT:
                    raise FileNotFoundError(f'Missing npm dependency {dep} required by {source.name}')

    entries = []
    for folder in ('runtime', 'import-engine'):
        for path in sorted((resources / folder).rglob('*')):
            if path.is_file():
                with path.open('rb') as stream:
                    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
                entries.append({'path': path.relative_to(resources).as_posix(),
                                'size': path.stat().st_size, 'sha256': digest})
    manifest = {'version': package['version'], 'platform': platform, 'files': entries}
    (resources / 'runtime-manifest.json').write_text(json.dumps(manifest, indent=2))
    dev = ROOT / 'app-resources'
    if platform == 'linux' and not dev.exists():
        dev.symlink_to(resources.name, target_is_directory=True)
    print(f'Staged {platform} with {len(entries)} verified import files.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target', choices=['web', 'linux', 'windows'])
    parser.add_argument('--resources-only', action='store_true')
    args = parser.parse_args()
    if not args.resources_only:
        stage_web()
    if args.target != 'web':
        stage_resources(args.target)
