# 轻页 PDF 压缩 — approved design

User approved an offline desktop PDF compressor for Windows EXE and macOS DMG.

## Scope and experience
Chinese single-window desktop app. Add PDFs by picker or drag/drop, remove/clear queue, choose clarity/balanced/small presets, select output folder (default alongside each source), start batch, see per-file progress, original/output sizes, savings, and reveal completed output. Original files must never be overwritten. Batch continues after an individual failure. Cancel stops active work and remaining queue. Existing outputs get numbered suffixes. No network, telemetry, accounts, or external runtime installation.

## Architecture
Electron hosts a local HTML/CSS/JS interface with sandboxed renderer and a narrow preload bridge. Main process owns file selection, input validation, file writing and job state. A separate worker runs MuPDF WebAssembly for each document and is terminated on cancellation or window close. Bundled WASM works on Mac ARM64 and Windows x64 without native compression dependencies. Compression code is independently testable with Node.

Compression preserves the existing PDF structure and text, bookmarks, annotations and forms. It replaces eligible opaque RGB/grayscale image streams with smaller JPEG images, preserving object references and physical page sizes. Masks, transparency, bilevel images and unusual color models may be left unchanged to prevent corruption. Presets cap image long edges at 3600/2600/1600 pixels with JPEG quality 88/78/62 respectively; never upscale. Only replace images if smaller. Clean unused objects and compress streams on save. Reopen output and check page count and geometry. If overall size is not reduced, export an exact source copy and explicitly report no reduction.

## Boundaries and errors
Skip encrypted/password protected and digitally signed documents with clear messages; scanned visual seals are ordinary images and work normally. Reject non-PDF, empty or invalid files, oversized inputs over 500 MiB, and unreasonable image allocations. Workers isolate memory-heavy jobs; process files serially. Atomic temporary output plus exclusive final creation prevents clobbering existing files. Remove own temporary files on cancellation/error. Inputs are validated again in main; renderer cannot invoke arbitrary filesystem operations. IPC errors display friendly Chinese messages. No remote content or document JavaScript execution.

## Deliverables and verification
Source code and lockfile, license notices (MuPDF AGPL), offline application, Windows x64 installer EXE and Mac ARM64 DMG. Include Windows native CI smoke-test workflow if no Windows runtime is available locally, and explicitly report untested Windows execution. No private user PDF is packaged. Mac application may be ad-hoc signed only, no Apple notarization or paid developer credentials assumed.

Verify real scanned contract at all presets for size and page preservation; render representative text and seal pages. Automated tests cover structured PDF text/forms, no-gain fallback, invalid/encrypted/signed inputs, output collisions, cancellation, and mixed batch failures where feasible. Exercise actual Electron UI and packaged Mac app. Inspect Windows package architecture and bundled assets; do not claim native Windows runtime validation without performing it.

## Work sequence
1. Context and design approval — complete.
2. Review this specification and address actionable gaps.
3. Record implementation plan, create app and compression engine.
4. Test engine and UI, fix issues.
5. Build and verify packages, deliver installers and source.
