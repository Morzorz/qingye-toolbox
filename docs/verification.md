# Verification record — 1.1.1, 2026-10-13

- Reproduced Chinese text rendering as blank/missing glyphs while extracted PDF text remained valid. Both available headless Office paths reproduced it on synthetic DOCX with 宋体、微软雅黑、仿宋、黑体 and an unavailable font.
- Previous 1.1.0 Office tests checked English text only. They did not establish Chinese visual correctness; the new regression covers this gap.
- Added unmodified Noto Sans SC Regular 2.004 under SIL OFL 1.1. Copied into each temporary LibreOffice user/fonts directory; no system font installation or modification of original documents.
- Font SHA-256: faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9. Source tag Sans2.004 in notofonts/noto-cjk, Sans/SubsetOTF/SC/NotoSansSC-Regular.otf. License supplied in assets/fonts/OFL.txt.
- npm test with Chinese Office fixtures: all 13 passed, no skips. Office tests require correct Chinese text and at least six distinct rendered Chinese glyphs, catching the old repeated missing-glyph behavior.
- Final packaged Mac application converted Chinese DOCX, XLSX and PPTX through the actual GUI. Rendered all three outputs at 1.5 scale and visually checked: Chinese visible, no boxes, sample cells not clipped. Word tested five requested font names including a deliberately missing font.
- Packaged font and license byte parity checked for both Mac and Windows; source parity and platform engine checks passed. Mac ad-hoc signature and DMG checksum verified.
- Windows package cross-built; Windows native conversion has not been tested. User's original document was not provided, so validation used synthetic reproductions of the screenshot's symptoms.
- Font fallback can change typography/line wrapping if the original font is unavailable. Upgrade and reconvert the original Office file; previously generated broken PDFs are not automatically repaired.

---

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
