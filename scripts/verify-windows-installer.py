"""Verify the installed files in the standard NSIS archive against the staged build."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

installer = Path(sys.argv[1]).resolve(strict=True)
binary = Path(sys.argv[2]).resolve(strict=True)
root = Path(__file__).resolve().parents[1]
stage = root / 'app-resources-windows'
with tempfile.TemporaryDirectory(prefix='document-studio-installer-') as tmp:
    extracted = Path(tmp)
    subprocess.run(['7z', 'x', '-y', '-bd', f'-o{extracted}', str(installer)],
                   stdout=subprocess.DEVNULL, check=True)
    resources = next(extracted.rglob('app-resources'))
    app = next(extracted.rglob(binary.name))

    def digest(path):
        with path.open('rb') as stream:
            return hashlib.file_digest(stream, 'sha256').digest()

    # Tauri changes its single fixed-width bundle marker while building NSIS,
    # then restores the unbundled PE in Cargo's release directory.
    expected = binary.read_bytes()
    original = b'__TAURI_BUNDLE_TYPE_VAR_UNK'
    packaged = b'__TAURI_BUNDLE_TYPE_VAR_NSS'
    if expected.count(original) == 1 and packaged not in expected:
        expected = expected.replace(original, packaged, 1)
    if expected.count(packaged) != 1 or app.read_bytes() != expected:
        raise SystemExit('Installer has the wrong executable')
    for source in stage.rglob('*'):
        if source.is_file() and digest(source) != digest(resources / source.relative_to(stage)):
            raise SystemExit('Installer mismatch: ' + source.relative_to(stage).as_posix())
    for name in ['LICENSE', 'NOTICE', 'THIRD-PARTY-NOTICES.md']:
        assert (root / name).read_bytes() == (resources / name).read_bytes()
    manifest = json.loads((resources / 'runtime-manifest.json').read_text())
    print('Verified executable, notices and all installer resources (including',
          len(manifest['files']), 'import runtime files).')
