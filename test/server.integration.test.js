import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import path from "node:path";
import test from "node:test";

import { createViewerServer } from "../src/server.js";

const fixturePath = path.resolve("test", "fixtures", "demo-segment.g9p");

test("local API verifies a real segment and keeps trust separate", async (context) => {
  const server = createViewerServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  const configResponse = await fetch(`${origin}/api/config`);
  assert.equal(configResponse.status, 200);
  const config = await configResponse.json();
  assert.equal(config.mode, "local-read-only");
  assert.equal(config.verifier.source, "bundled-independent-verifier");
  assert.equal(config.verifier.provenanceVersion, "0.1.0-alpha.2");
  assert.equal(config.limits.maxEvidenceFiles, 100);

  const response = await fetch(`${origin}/api/verify-segment?filename=demo.g9p`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Provenance-Viewer-Token": config.csrfToken,
      Origin: origin,
    },
    body: await readFile(fixturePath),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.valid, true);
  assert.equal(result.cryptographicStatus, "valid");
  assert.equal(result.trust.status, "not-assessed");
  assert.equal(result.recordCount, 3);
  assert.equal(result.events.length, 3);

  const bundle = {
    kind: "g9p-segment-trust-bundle",
    version: 1,
    bundleId: "viewer-integration-trust",
    bindings: [{
      ledgerId: result.ledgerId,
      epochNumber: result.routingEpochNumber ?? 0,
      shardId: result.shardId,
      firstSegmentNumber: result.segmentNumber,
      lastSegmentNumber: result.segmentNumber,
      keyId: result.signerKeyId,
      status: "trusted",
    }],
  };
  const trustResponse = await fetch(`${origin}/api/trust-bundle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Provenance-Viewer-Token": config.csrfToken, Origin: origin },
    body: JSON.stringify(bundle),
  });
  assert.equal(trustResponse.status, 200);
  const trustedResponse = await fetch(`${origin}/api/verify-segment?filename=demo.g9p`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "X-Provenance-Viewer-Token": config.csrfToken, Origin: origin },
    body: await readFile(fixturePath),
  });
  assert.equal(trustedResponse.status, 200);
  assert.equal((await trustedResponse.json()).trust.status, "trusted");
});

test("local API rejects altered evidence", async (context) => {
  const server = createViewerServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const config = await fetch(`${origin}/api/config`).then((response) => response.json());
  const bytes = await readFile(fixturePath);
  bytes[Math.floor(bytes.length / 2)] ^= 0x01;
  const response = await fetch(`${origin}/api/verify-segment?filename=altered.g9p`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "X-Provenance-Viewer-Token": config.csrfToken, Origin: origin },
    body: bytes,
  });
  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).error.code, "string");
});

test("static HEAD requests return headers without a response body", async (context) => {
  const server = createViewerServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/`, { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/u);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
});

test("local API rejects mutation requests without its session token", async (context) => {
  const server = createViewerServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/trust-bundle`, { method: "POST", body: "" });
  assert.equal(response.status, 403);
});

test("local server rejects non-loopback Host headers", async (context) => {
  const server = createViewerServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const status = await new Promise((resolve, reject) => {
    const outgoing = request({ host: "127.0.0.1", port: address.port, path: "/api/config", headers: { Host: "viewer.example" } }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
  assert.equal(status, 421);
});
