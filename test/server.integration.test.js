import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createViewerServer } from "../src/server.js";

const fixturePath = path.resolve("..", "Glare9-Provenance", "runtime", "demo-2026-07-28T15-27-33.714Z", "shard-0000-segment-000000.g9p");

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
});

test("local API rejects mutation requests without its session token", async (context) => {
  const server = createViewerServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/trust-bundle`, { method: "POST", body: "" });
  assert.equal(response.status, 403);
});
