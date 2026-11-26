#!/usr/bin/env bash
# Build the editor, its native window and all three Linux release packages.
set -euo pipefail
root=$(cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
# Cargo's encoded form keeps a flag containing a path with spaces intact.
# rustc uses the last matching mapping, so more specific directories follow HOME.
flags=()
if [[ -n "${CARGO_ENCODED_RUSTFLAGS:-}" ]]; then
  IFS=$'\x1f' read -r -a flags <<< "$CARGO_ENCODED_RUSTFLAGS"
elif [[ -n "${RUSTFLAGS:-}" ]]; then
  read -r -a flags <<< "$RUSTFLAGS"
fi
flags+=("--remap-path-prefix=$HOME=/build/account"
        "--remap-path-prefix=$root=/build/document-studio-light"
        "--remap-path-prefix=$(realpath -m -- "${CARGO_HOME:-$HOME/.cargo}")=/build/cargo"
        "--remap-path-prefix=${CARGO_TARGET_DIR:-$root/src-tauri/target}=/build/target")
printf -v CARGO_ENCODED_RUSTFLAGS '%s\x1f' "${flags[@]}"
export CARGO_ENCODED_RUSTFLAGS=${CARGO_ENCODED_RUSTFLAGS%$'\x1f'}
python3 scripts/stage.py linux
npm run tauri -- build --config src-tauri/tauri.linux.conf.json --no-bundle
bash scripts/package-linux.sh "$@"
