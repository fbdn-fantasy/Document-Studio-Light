#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Rebuild the two Emscripten modules consumed by the upstream TypeScript bindings.
set -eu
if [ "$#" -ne 2 ]; then
  echo "Usage: bash build-hunspell-wasm.sh EXTRACTED_HUNSPELL_SOURCE EXTRACTED_BINDING_SOURCE" >&2
  exit 2
fi
core=$(cd "$1" && pwd)
binding=$(cd "$2" && pwd)
test -f "$core/configure.ac"
test -f "$binding/bootstrap.ts"
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
cp -a "$core/." "$scratch/"
cd "$scratch"
autoreconf -vfi
emconfigure ./configure
emmake make

# Publish the filesystem operations required by the TypeScript binding.
cat > fs-access.js <<'JS'
Module.preRun = [function () {
  var exposed = {};
  var names = ['filesystems', 'stat', 'isDir', 'isFile', 'mkdir', 'mount', 'writeFile', 'unlink', 'unmount', 'rmdir'];
  names.forEach(function (name) { exposed[name] = FS[name]; });
  Module.FS = exposed;
}];
JS

c_api='["_Hunspell_create","_Hunspell_destroy","_Hunspell_spell","_Hunspell_suggest","_Hunspell_free_list","_Hunspell_add_dic","_Hunspell_add","_Hunspell_remove","_Hunspell_add_with_affix"]'
runtime_api='["cwrap","stringToUTF8","allocateUTF8","getValue","UTF8ToString"]'
for platform in node browser; do
  runtime=node
  if [ "$platform" = browser ]; then runtime=web,worker; fi
  destination="$binding/src/lib/$platform"
  mkdir -p "$destination"
  em++ -O2 -s NO_EXIT_RUNTIME=1 -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 \
    -s ASSERTIONS=1 -s DYNAMIC_EXECUTION=0 -s SINGLE_FILE=1 \
    -s "EXPORTED_FUNCTIONS=$c_api" -s "EXTRA_EXPORTED_RUNTIME_METHODS=$runtime_api" \
    -s NODEJS_CATCH_REJECTION=0 -s "ENVIRONMENT=$runtime" \
    src/hunspell/.libs/libhunspell-1.6.a --pre-js fs-access.js -o "$destination/hunspell.js"
done
