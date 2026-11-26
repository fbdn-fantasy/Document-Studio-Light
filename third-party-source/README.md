# XML import library sources

The source archives here accompany the statically linked GNU libiconv used in lxml. For the installation and relinking procedure, see `notices/document-import/RELINKING.md`. Verify each archive against `SHA256SUMS`.

| Source | Upstream release |
|---|---|
| lxml | [lxml 6.1.3 source distribution](https://pypi.org/project/lxml/6.1.3/#files) |
| libiconv on Linux | [GNU libiconv 1.18](https://ftp.gnu.org/gnu/libiconv/libiconv-1.18.tar.gz) |
| libxml2 on Linux | [GNOME libxml2 2.14.6](https://download.gnome.org/sources/libxml2/2.14/libxml2-2.14.6.tar.xz) |
| libxslt on Linux | [GNOME libxslt 1.1.43](https://download.gnome.org/sources/libxslt/1.1/libxslt-1.1.43.tar.xz) |
| zlib | [zlib 1.3.2](https://zlib.net/fossils/zlib-1.3.2.tar.gz) |
| Windows build files and dependency submodules | [lxml Windows release 2026.05.17](https://github.com/lxml/libxml2-win-binaries/tree/2026.05.17) |

The `windows-*` archives contain the exact winlibs source trees pinned by that release's submodules. Each filename ends with the first twelve characters of the pinned Git commit. The port reports libiconv 1.17 through the C version API and uses the Windows source release name 1.17.1.
