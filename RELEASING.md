# Release procedure

Only a maintainer may publish a release. Version 0.1.0 is a source release; the package is marked private to prevent accidental npm publication.

1. Start from a clean `main` branch synchronized with `origin/main`.
2. Confirm the Node.js and npm versions declared in `.nvmrc` and `package.json`.
3. Run `npm ci` from a fresh dependency state.
4. Run `npm run release:check`.
5. Run `npm pack --dry-run` and inspect the included files.
6. Generate a CycloneDX SBOM with `npm sbom --sbom-format cyclonedx > provenance-9-evidence-viewer-0.1.0.cdx.json`.
7. Confirm `CHANGELOG.md`, `SECURITY.md`, `NOTICE`, `TRADEMARKS.md` and `docs/VERIFIER-PROVENANCE.md` match the release.
8. Confirm CI and CodeQL are green on the exact release commit.
9. Configure Git to use the tracked signer list: `git config gpg.format ssh`, `git config user.signingkey ~/.ssh/id_ed25519` and `git config gpg.ssh.allowedSignersFile RELEASE_SIGNERS`.
10. Create and verify a signed tag: `git tag -s v0.1.0 -m "Provenance•9 Evidence Viewer 0.1.0"` and `git tag -v v0.1.0`.
11. Push the commit and tag, then create a GitHub release containing the source archive, SBOM and SHA-256 checksums.

Making the repository public and creating the GitHub release are deliberate maintainer actions. They are not performed by build or test scripts.
