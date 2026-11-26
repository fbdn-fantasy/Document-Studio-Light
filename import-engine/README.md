# Offline document import

Digital PDF pages use their embedded text and font information. The converter preserves the original page size and graphics, and reconstructs ruled tables as editable cells where native text and ruled boundaries agree. Image-only PDF pages, photos and multi-page TIFFs become page artwork. Review the page previews in the editor after conversion.

The bundled worker runs in a separate local process with no network connections. It accepts a JSON request specifying local inputs and a fresh output directory. It writes the converted DOCX, the editable project and a layout report, then reports their paths over JSONL. The original source files stay intact.

The platform-specific Python distributions include pypdfium2, PDFium, Pillow, python-docx, lxml and typing_extensions. Their licenses are retained alongside the runtime packages. The supplied Windows PDFium build carries additional licenses under pdfium-supplied/.

From the source root, run the native integration suite with `runtime-linux/bin/python3 -IB import-engine/test_import.py` on Linux or `runtime\python.exe -IB import-engine/test_import.py` on Windows.
