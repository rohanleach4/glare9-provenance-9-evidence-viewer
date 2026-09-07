import assert from "node:assert/strict";
import test from "node:test";

import { buildStoredZip, crc32 } from "../public/zip.js";

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("buildStoredZip writes local, central and end records with exact bytes", () => {
  const bytes = buildStoredZip([{ name: "evidence/sample.g9p", bytes: new Uint8Array([0, 1, 2, 255]) }]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 12, true), 1);
  assert.match(new TextDecoder().decode(bytes), /evidence\/sample\.g9p/u);
  assert.deepEqual([...bytes.slice(49, 53)], [0, 1, 2, 255]);
});

test("buildStoredZip rejects traversal entry names", () => {
  assert.throws(() => buildStoredZip([{ name: "../outside", bytes: "no" }]), /unsafe/u);
});

test("buildStoredZip rejects names outside classic ZIP limits", () => {
  assert.throws(() => buildStoredZip([{ name: "a".repeat(65_536), bytes: "no" }]), /classic ZIP limits/u);
});
