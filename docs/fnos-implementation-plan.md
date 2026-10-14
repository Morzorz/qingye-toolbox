# fnOS implementation plan

The standalone design was approved by the user and reviewed as Approved. The referenced writing-plans skill is unavailable in installed skill catalogs; this plan provides concrete implementation steps.

1. Build gateway-only Node server with admin authentication, per-user job ownership, current root boundaries, uploads and generated-result downloads; test request/permission failures before integration.
2. Adapt existing UI through a browser bridge and accessible NAS file chooser. Keep desktop IPC and original desktop delivery intact.
3. Implement native FPK metadata, package-user lifecycle, shared inbox/output directory and gateway entry. Package pinned Node/native modules, FFmpeg, LibreOffice, libraries and CJK font from Linux amd64 build environment.
4. Validate Linux engine functionality in a clean container and actual browser UI via a simulated gateway. Check shell lifecycle and official fnpack output. Document explicit fnOS hardware validation limits.
5. Deliver FPK, source, checksums and Chinese installation instructions; no publishing or remote NAS changes without access and authorization.
