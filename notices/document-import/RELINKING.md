# Document import libraries

Document Studio Light imports PDF text and page artwork through a separate Python process. The program uses lxml 6.1.3, which links GNU libiconv under LGPL-2.1-or-later. The enclosed LGPL text applies to libiconv. Users may modify these libraries, replace them, and reverse-engineer the combined modules to debug those modifications.

Each installer or package is distributed beside its platform source ZIP. The ZIP's `third-party-source/` directory contains the lxml sources, native dependencies and the Windows build scripts needed to relink the XML modules. `SHA256SUMS` identifies the original supplied archives. Each archive retains its upstream copyright and license notices.

Pillow, python-docx, pypdfium2, PDFium, lxml and typing_extensions retain their package licenses in the runtime. The retained Pillow builds omit libimagequant. On Linux, its optional FriBiDi support uses the system library. On Windows the shipped wheel does not load FriBiDi. The bundled libtiff retains the permissive TIFF license in Pillow's notices.

The Linux interpreter matches the CPython 3.12.14 standalone build dated 2026-08-25. Applicable upstream interpreter dependency notices are in `cpython/`. The Windows CPython 3.13 runtime contains its license and Microsoft redistributable terms in `runtime/LICENSE.txt`. Its OpenSSL 3 license is also included under `cpython/`.

## Linux

Use an x86-64 build environment with the CPython 3.12 headers, C compiler, setuptools, wheel, make and the ordinary GNU development tools. Extract the lxml archive. Place the supplied libiconv 1.18, libxml2 2.14.6, libxslt 1.1.43 and zlib 1.3.2 source tarballs in its `libs/` directory. The upstream static build uses `buildlibxml.py` and the accompanying patch script. From the lxml source directory, build the extensions with the native library versions pinned.

```sh
STATIC_DEPS=true LIBICONV_VERSION=1.18 LIBXML2_VERSION=2.14.6 LIBXSLT_VERSION=1.1.43 ZLIB_VERSION=1.3.2 python3.12 setup.py bdist_wheel
```

To modify libiconv, apply the changes in the extracted libiconv build tree before compilation or change the bundled build script to use your modified source and expected checksum. Use the headers and libraries produced by that build when linking the lxml extensions. The upstream `doc/build.txt` and `setupinfo.py` describe the available build configurations.

## Windows

The Windows wheel uses the winlibs port of GNU libiconv 1.17.1, libxml2 2.11.9, libxslt 1.1.45 and zlib 1.3.2. Extract the `libxml2-win-binaries-2026.05.17` archive. Extract the four `windows-*` source archives into the matching `libiconv`, `libxml2`, `libxslt` and `zlib` subdirectories, removing each archive's leading directory. Apply any changes to libiconv there. Run the upstream `build.ps1 -x64` script from its source directory with its documented Visual Studio tools and PowerShell Community Extensions. The resulting archives under `dist/` contain static libraries and headers.

Extract those results. In a Visual Studio x64 developer shell configured for CPython 3.13, include the resulting four header directories through `INCLUDE` and the four library directories through `LIBRARY`. From the lxml source directory run `py -3.13 setup.py bdist_wheel --static`. The upstream build looks for `libxml2_a`, `libxslt_a`, `libexslt_a`, `iconv_a` and `zlib`.

## Installing a replacement

In the application source tree, replace the lxml modules under `runtime-linux/lib/python3.12/site-packages/` or `runtime/Lib/site-packages/` with the modules from the wheel you built. Follow the application README to rebuild the distribution. Its resource staging script regenerates the integrity manifest for the replacement files. Run `import-engine/test_import.py` with the applicable bundled Python to test the result. The native editor and Node helper communicate with this process through JSON and do not link the Python modules themselves.
