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
