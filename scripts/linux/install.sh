#!/usr/bin/env bash
# Install into a private release directory, then switch its stable application links.
set -euo pipefail
prefix=${1:-/usr/local}
if [[ $# -gt 1 || "$prefix" != /* || "$prefix" == / ]]; then
  echo "Usage: ./install.sh [/absolute/install/prefix]" >&2
  exit 2
fi
here=$(cd -- "$(dirname -- "$0")" && pwd)
(cd "$here" && sha256sum -c SHA256SUMS)
base="$prefix/lib/document-studio-light"
mkdir -p "$base/releases"
if [[ -e "$base/current" && ! -L "$base/current" ]]; then
  echo "The installation directory already contains an unrelated file." >&2
  exit 1
fi
release=$(mktemp -d -- "$base/releases/build-XXXXXXXX")
switch=$(mktemp -d -- "$base/.select-XXXXXXXX")
trap 'rm -rf -- "$switch"; if [[ ! -e "$release/.installed" ]]; then rm -rf -- "$release"; fi' EXIT
chmod 755 "$release"
tar --extract --gzip --file="$here/payload.tar.gz" --directory="$release" --no-same-owner --no-same-permissions
# Preserve an existing file installed by another package in the same prefix.
desktop=share/applications/com.forbiddenfantasy.DocumentStudioLight.desktop
# The desktop environment can launch an application with a different PATH
# from a login shell. Point its menu entry at this installation's stable link.
"$release/usr/lib/Document Studio Light/app-resources/runtime/bin/python3" -IB - "$prefix/bin/document-studio-light" "$release/usr/$desktop" <<'PYTHON'
from pathlib import Path
import sys

command, desktop = sys.argv[1], Path(sys.argv[2])
# GLib checks argv[0] before expanding %% in a literal path. env accepts
# the installed path as argv[1], including spaces, quotes and percent signs.
argument = ''.join('\\' + c if c in '\\"$`' else c for c in command.replace('%', '%%'))
value = argument.replace('\\', '\\\\').replace('\n', '\\n').replace('\r', '\\r')
lines = desktop.read_text().splitlines()
if lines.count('Exec=/usr/bin/document-studio-light %F') != 1:
    raise SystemExit('The package has an invalid application menu entry.')
desktop.write_text('\n'.join(f'Exec=/usr/bin/env "{value}" %F' if line.startswith('Exec=') else line for line in lines) + '\n')
PYTHON
files=(bin/document-studio-light "$desktop")
for file in "$release"/usr/share/icons/hicolor/*/apps/com.forbiddenfantasy.DocumentStudioLight.png; do
  files+=("${file#"$release/usr/"}")
done
for file in "${files[@]}"; do
  target="$base/current/usr/$file"
  link="$prefix/$file"
  if [[ -e "$link" || -L "$link" ]]; then
    [[ -L "$link" && "$(readlink -- "$link")" == "$target" ]] || {
      echo "An existing installation owns $link. Choose a different prefix." >&2
      exit 1
    }
  fi
done
for file in "${files[@]}"; do
  mkdir -p -- "$(dirname -- "$prefix/$file")"
  if [[ ! -L "$prefix/$file" ]]; then ln -s -- "$base/current/usr/$file" "$prefix/$file"; fi
done
ln -s -- "releases/$(basename -- "$release")" "$switch/current"
touch "$release/.installed"
mv -Tf -- "$switch/current" "$base/current"
echo "Installed Document Studio Light at $prefix/bin/document-studio-light"
