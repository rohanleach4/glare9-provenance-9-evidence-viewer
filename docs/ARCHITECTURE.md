# Viewer architecture and authority boundary

## Authority model

The sealed `.g9p` files and applicable externally governed trust material are evidence inputs. The viewer is not an authority. Its record list, search results, summaries and reports are disposable projections that can be rebuilt from verified inputs.

The interface must never collapse these questions into one “verified” badge:

1. Are the supplied bytes cryptographically self-consistent?
2. Was the signing key trusted for this exact ledger position under the supplied policy?
3. Are the supplied segments continuous within each shard stream?
4. Is the recorded claim factually correct and is the evidence set complete?

The verifier can answer the first three only within the inputs it receives. It cannot establish the fourth.

## Components

- `src/server.js` is a loopback-only static server and narrow verification API.
- `src/lib/provenance-adapter.js` is the sole boundary to the bundled, verification-only independent verifier.
- `public/` is a dependency-free interface. It receives verified, JSON-safe records and never receives a write capability.
- Search is performed in browser memory and is non-authoritative.
- Export packages exact source bytes; it does not rewrite `.g9p` evidence.

## Dependency rule

The bundled verifier is sourced from the independently implemented verifier in the signed Provenance•9 `v0.1.0-alpha.2` release. Writer, custody, connector, ingestion and administration modules are prohibited. The source and compatibility record is maintained in [VERIFIER-PROVENANCE.md](VERIFIER-PROVENANCE.md).

## Ordering

Records are displayed deterministically by routing epoch, shard, segment and record position. The viewer must not invent a global order across shards. Event correlation and causation fields may describe application relationships but do not create a ledger-level total order.

## Planned evidence inputs

The complete evidence-pack contract will add routing descriptors, checkpoints, witness receipts and their trusted-key context. Until those are implemented, the viewer and its exports state the limitation explicitly.
