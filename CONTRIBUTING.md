# Contributing

Provenance•9 Evidence Viewer welcomes design discussion, review, documentation and code contributions under Apache License 2.0. Contributions use the Developer Certificate of Origin 1.1 in `DCO.txt`; no contributor licence agreement is required.

Changes must preserve the viewer’s local, read-only authority boundary. Do not add ledger writes, custody keys, connector credentials, administration APIs, telemetry, remote evidence upload or a dependency on a moving source branch. Verification findings must keep cryptographic validity, signer trust, supplied-history continuity, factual truth and completeness separate.

Before proposing a change:

1. open an issue describing the user benefit, threat impact and compatibility effect;
2. do not include customer evidence, credentials, private keys or runtime files;
3. run `npm run release:check`;
4. test the interface with valid, malformed and unsupported `.g9p` files;
5. update documentation and tests with the implementation.

Every commit must carry a DCO sign-off:

```text
Signed-off-by: Your Name <your-email@example.com>
```

Use `git commit -s` to add it. Do not submit code you do not have the right to license.
