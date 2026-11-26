#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export XWIN_CACHE_DIR="${XWIN_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/cargo-xwin}"
python3 scripts/build-windows.py --cross "$@"
