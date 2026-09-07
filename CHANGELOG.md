# Changelog

All notable changes to Provenance•9 Evidence Viewer are recorded here. The project follows Semantic Versioning independently of the G9P file-format versions it supports.

## 0.1.0 — 2026-09-07

### Added

- Local, loopback-only and read-only evidence interface.
- Verification and human-readable display of G9P segment versions 1 and 2.
- Separate cryptographic-validity, signer-trust and supplied-history-continuity findings.
- Optional in-memory G9P segment trust bundle version 1.
- Searchable record details and exact-byte ZIP governance evidence-pack export.
- Self-contained independent verifier pinned to the signed Provenance•9 `v0.1.0-alpha.2` release.
- Repository-owned test fixture, pinned CI, security policy, contribution guidance and release procedure.

### Known limitations

- Routing descriptors, checkpoints and witness receipts are not accepted by the version 0.1.0 interface or included in its evidence-pack contract.
- Verification establishes the integrity of supplied recorded history; it does not establish factual truth or completeness.
