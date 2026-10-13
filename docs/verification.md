# Verification record — 1.1.0, 2026-10-13

- Retained Electron desktop architecture; no Tauri migration files included in application or source archive.
- npm test: 13 tests passed, 0 skipped, using newly downloaded FFmpeg and LibreOffice components. Includes compression structural preservation, PDF merging/extraction/rendering, image conversion, Office DOCX/XLSX/PPTX to searchable PDF, audio/video decoding, batch error isolation, concurrency/cancel cleanup, downloads SHA verification, MCP permissions and symlink rejection.
- Developer and final packaged Mac GUI: file selection, PDF compression, filename collisions, WebP conversion, PDF merging, AI directory authorization/revocation and copyable MCP configuration passed. Synthetic fixtures only.
- Final packaged executable: standard SDK MCP client initialization/list tools/submit/poll/permission denial passed. CLI conversion returned valid final JSON with existing output file. No separately installed Node needed by packaged application.
- FFmpeg Mac ARM64 component downloaded through the real Electron network/install path into a temporary validation directory; SHA-256 checked, executable version probe and conversion passed.
- LibreOffice Mac ARM64 official DMG downloaded through the real Electron path; SHA-256 checked, mounted, staged, version-checked and installed successfully. Newly installed binary converted all three synthetic Office formats to readable PDFs.
- Test environment required its existing HTTPS proxy for remote component downloads; ordinary direct access timed out. Real application uses the OS network stack. Component availability depends on the user's network; selecting a preinstalled component remains supported.
- Final Mac app: codesign --verify --deep --strict passed (ad-hoc). Final DMG: hdiutil verify VALID.
- Both ASAR archives passed scripts/verify-packages.mjs: allowed roots only, source byte-for-byte parity, correct native image component, MuPDF WASM, no abandoned migration files or user documents. Windows includes Sharp native addon plus both required libvips DLLs.
- Release sizes: Windows EXE 113,112,865 bytes (107.9 MiB); Mac DMG 129,190,078 bytes (123.2 MiB).
- Windows installation, native execution and optional component installation have NOT been tested on Windows. CI workflow provided but not executed remotely.
- No commercial code signing or Apple notarization. No live advertising provider integrated.
- Component downloads remain separate from installation packages. Original private contract is absent from source, screenshots and packages.

## Reproduce

Run npm test with QINGYE_FFMPEG, QINGYE_SOFFICE and QINGYE_OFFICE_FIXTURES set to installed components and synthetic fixture directory. Run scripts/toolbox-smoke.mjs with QINGYE_APP set to packaged executable. Run tests/mcp.test.mjs and scripts/cli-smoke.mjs with QINGYE_PACKAGED_APP. Run scripts/verify-packages.mjs after building both platforms.

---

# Verification record — 2026-10-12

- Node 22, Electron 41.10.7, MuPDF 1.28.1, electron-builder 26.15.3.
- npm test: 5 tests passed.
- Developer app and packaged Mac ARM64 app: automated GUI smoke passed. Includes file chooser, mixed valid/invalid batch, collision suffixes, original preservation, drag-and-drop bridge, custom output directory/reset, cancellation and recovery.
- Actual 7-page scanned PDF: all presets retain 7 pages. Input 74,048,354 bytes. Clear 8,580,985; balanced 2,940,407; small 801,228. Balanced seal/text page visually inspected.
- codesign --verify --deep --strict on final Mac app: passed (ad-hoc identity).
- hdiutil verify on final DMG: VALID.
- Windows installer identified as NSIS self-extracting installer; payload main executable is PE32+ x86-64. ASAR contains main, worker, MuPDF WASM; no private PDF bundled.
- Electron Mac/Windows runtime downloads verified against npm electron package SHA-256 manifest.
- Windows native launch and installation have NOT been tested locally; workflow provided, not executed remotely.
- No developer certificate signing or Apple notarization performed. Mac ad-hoc signing is for structural correctness, not publisher identification.
