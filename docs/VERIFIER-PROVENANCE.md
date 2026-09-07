# Verifier provenance and compatibility

The viewer bundles the independent, verification-only implementation from the signed Provenance•9 release `v0.1.0-alpha.2`.

- Upstream repository: <https://github.com/rohanleach4/glare9-provenance-9>
- Upstream release commit: `b8ac0a1614ada09f06766789163b4916e4f2fb48`
- Upstream source: `tools/independent-verifier/verify.js`
- Local snapshot: `src/vendor/provenance-verify.js`
- Conformance snapshot: `test/fixtures/g9p-v1-v2-vectors.json`
- Licence: Apache License 2.0
- Supported segment formats: G9P segment versions 1 and 2
- Supported trust policy: G9P segment trust bundle version 1

The local snapshot adds only the verified event projection and positional fields required by the interface. It does not add a write path. Its cryptographic, framing, canonical-decoding, compression, semantic-validation and resource-limit rules remain those of the upstream independent verifier. The checked-in conformance snapshot comes from the same signed release and covers valid and deliberately corrupted segment, routing, checkpoint and witness containers.

Every verifier update must:

1. identify an immutable, signed upstream release or commit;
2. review the upstream diff and preserve the read-only authority boundary;
3. update the version and commit reported by `/api/config`;
4. update this compatibility record;
5. refresh the checked-in conformance snapshot from the same release and run the complete viewer tests;
6. receive an ordinary repository review before release.

Routing descriptors, checkpoints and witness receipts are cryptographically recognised by the bundled verifier but are not yet accepted by the version 0.1.0 interface or evidence-pack contract. The interface discloses this limitation.
