# Security

## Security boundary

The viewer is a local evidence consumer. It has no ledger write path, custody keys, connector credentials or administrative authority. It binds to `127.0.0.1` by default, serves all assets locally, sets a restrictive Content Security Policy, rejects cross-site mutation requests and holds the optional trust bundle only in memory.

Source evidence is read into memory for verification and is not persisted by the server. The only intended write occurs when the user explicitly downloads an evidence pack through their browser.

The server address is deliberately fixed to `127.0.0.1`; exposing the viewer on a public interface is not a supported deployment mode.

## Reporting a vulnerability

Please do not disclose a suspected vulnerability in a public issue. Use GitHub private vulnerability reporting once the public repository is available. Until then, report it through Glare•9's published private security contact.

Include the affected version, reproduction steps, impact and any suggested mitigation. Do not include real customer evidence or private keys.

## Dependency and release policy

- Keep runtime dependencies at the minimum required to verify and present evidence.
- Pin the official verifier to an exact released version and record supported G9P formats.
- Pin GitHub Actions to full commit hashes.
- Give CI no production secrets and only the permissions required for its job.
- Produce an SBOM and checksums for public releases.
