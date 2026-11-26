# Third-party notices

The editor is licensed under AGPL-3.0-only. Third-party software, fonts, dictionaries, artwork and data retain their respective terms. The application license and publisher notice are in LICENSE and NOTICE.

## Desktop and document formats

- Tauri, its plugins, Svelte, jsPDF and other locked Rust and npm dependencies are listed by version in `notices/dependencies/`. The manifests link each component to its license texts. The platform webview and Linux GUI libraries are system dependencies.
- The Node.js distributions include their notices in `node-linux/LICENSE` and `node-windows/LICENSE`. The installed service includes the license for its platform in `app-resources/node/LICENSE`.
- The editor embeds docx, Mammoth, JSZip and pako. Their notices appear in `editor.html` and `notices/`.
- Digital PDF and image conversion uses CPython, pypdfium2 with PDFium, Pillow, lxml, python-docx and typing_extensions. The Python distributions include their interpreter license, package license directories and native library notices. Additional PDFium build licenses accompany `import-engine/pdfium-supplied/`. These components run in a separate process. The lxml extensions include GNU libiconv under LGPL-2.1. See the [replacement and relinking instructions](notices/document-import/RELINKING.md) and the corresponding sources included with this release.

## Writing and layout

- Chart.js, KaTeX, MathLive, mathjs, QRCode, JsBarcode, canvas2svg and html2canvas supply charts, math, codes and document rendering. See the accompanying licenses in `assets/vendor/` and `notices/`.
- Citation.js plugins and citeproc-js supply citation formatting. citeproc-js is used under the AGPL option. The bundled MLA, Chicago and IEEE CSL files under `assets/vendor/csl/` retain attribution and licensing information.
- WordNet 3.0 supplies the English thesaurus. The hyphen engine supplies hyphenation. See the WordNet and hyphen notices in `notices/`.
- Fontsource font files and Liberation Sans are distributed with the licenses in `assets/fonts/`. The bundled math fonts have dedicated notices.

## Spelling and language data

The installed dictionary modules include upstream notices and data. The preserved dictionaries in `dictionary-sources/` also include their licenses. Offline checking uses nspell, hunspell-asm and Hunspell. The accompanying source ZIP includes Hunspell, the binding build materials and Korean dictionary sources in addition to the locked npm dependencies. The Korean dictionary is GPL-3.0-or-later. The Arabic dictionary from LibreOffice is offered under GPL/LGPL/MPL terms and this edition uses its GPL version 3 option. The original notices remain in `notices/`.

The Chinese language tools use Jieba dictionary data and Pycorrector candidate tables. Japanese tools include Kuromoji with IPADIC and the Sudachi core dictionary. Rights, attributions and included upstream data terms are in the Jieba, Pycorrector, Kuromoji and Sudachi notices.

## Supplied artwork

The reference application credits Forbidden Fantasy for the 54 PDF templates and 50 page backgrounds. It includes these for use with the editor. Its source materials do not document a separate grant for redistributing the artwork individually. The additional eight material swatches are part of the project. Template and background authoring metadata was removed for this edition.

The support button uses the [Ko-fi cup image](https://storage.ko-fi.com/cdn/cup-border.png). Ko-fi retains its rights in the mark.
