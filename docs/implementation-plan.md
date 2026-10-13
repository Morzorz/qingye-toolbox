# Implementation plan

Specification reviewed and approved. The referenced writing-plans skill is not installed; this concrete plan covers its role without requiring it.

1. Pin MuPDF, Electron and electron-builder. Inspect installed API types before integrating. License project under AGPL-3.0-or-later and bundle notices/source.
2. Build worker-friendly compression engine: preflight, image allocation guards, JPEG recompression/downsampling, stream replacement, structural verification, unchanged-size fallback. Main owns exclusive output writes.
3. Build Chinese accessible UI, guarded preload IPC, serial queue, progress/cancel, output folder selection, collision-free exports and reveal.
4. Test synthetic fixtures plus real user sample outside source tree. Run automated Electron interaction and packaged Mac smoke tests.
5. Package ARM64 DMG and x64 EXE using reproducible scripts, inspect both outputs and record Windows runtime limitations. Deliver source archive and instructions.


## Toolbox and local AI extension (1.1.0)

Completed: shared operation catalog and job service; worker PDF/image operations; FFmpeg/LibreOffice subprocess operations; optional verified/staged component downloads; Chinese toolbox UI; folder-scoped MCP and CLI; synthetic regression and real packaged app verification. Design: docs/superpowers/specs/2026-10-12-toolbox-ai-design.md. Results and remaining platform limits: docs/verification.md.
