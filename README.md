# Provenance•9 Evidence Viewer

Provenance•9 Evidence Viewer is a local, read-only application for inspecting and exporting human-readable evidence from Provenance•9 ledgers.

It reports three different findings separately:

- **Cryptographic validity** — whether a supplied segment's framing, commitments, records and embedded signature verify.
- **Signer trust** — whether an external, operator-approved trust bundle authorises that signer at the authenticated ledger position.
- **Supplied-history continuity** — whether consecutive segments supplied to this viewer link correctly.

A positive result proves the integrity of the supplied recorded history. It does not prove that an assertion was factually true or that the supplied evidence is complete.

## Version 0.1.0

- Opens multiple sealed `.g9p` segment files without modifying or persisting them.
- Displays subjects, event types, times, sources, payloads, metadata and integrity references.
- Accepts an optional G9P v1 segment trust bundle for the current in-memory session.
- Checks continuity within each supplied ledger, routing epoch and shard stream.
- Exports a ZIP evidence pack containing the exact `.g9p` bytes, SHA-256 inventory, verification report, trust bundle when supplied, and verification guidance.
- Uses no remote services, telemetry, CDN resources, frontend frameworks or third-party runtime packages.
- Includes a verification-only snapshot of the independent Provenance•9 verifier from signed release `v0.1.0-alpha.2` (`b8ac0a1`), so a fresh clone does not require a sibling ledger checkout.

Routing descriptors, checkpoints and witness receipts are not yet accepted by milestone 0.1.0. The export discloses this limitation rather than implying completeness.

## Run locally

Requirements: Node.js 24 and npm 11.

Clone this repository, then run:

```sh
npm install
npm start
```

Open <http://127.0.0.1:4179>.

The viewer is intentionally self-contained. It does not import from a moving Provenance•9 branch or require writer, connector, custody or administration code. See [docs/VERIFIER-PROVENANCE.md](docs/VERIFIER-PROVENANCE.md) for the verifier source and compatibility record.

## Development

```sh
npm test
npm run check
npm run release:check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes and [RELEASING.md](RELEASING.md) for the maintainer release checklist.

## Non-negotiable boundary

This repository must not import or expose Provenance•9 writer, custody, connector, ingestion or administration modules. Its verifier dependency is the only intended core dependency. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [SECURITY.md](SECURITY.md).

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
