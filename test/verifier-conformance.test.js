import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { verifyG9pBytes } from "../src/vendor/provenance-verify.js";

const manifest = JSON.parse(
  await readFile(new URL("./fixtures/g9p-v1-v2-vectors.json", import.meta.url), "utf8"),
);

function mutate(source, mutation) {
  const bytes = Buffer.from(source);
  if (mutation.operation === "set-byte") {
    bytes[mutation.offset] = mutation.value;
    return bytes;
  }
  if (mutation.operation === "truncate") {
    return bytes.subarray(0, bytes.length - mutation.count);
  }
  if (mutation.operation === "append") {
    return Buffer.concat([bytes, Buffer.from(mutation.bytesHex, "hex")]);
  }
  if (mutation.operation === "xor-frame-payload-last") {
    const marker = bytes.indexOf(Buffer.from(mutation.frameType, "ascii"));
    assert.ok(marker >= 8, `frame ${mutation.frameType} must exist`);
    const length = bytes.readUInt32BE(marker + 4);
    assert.ok(length > 0, `frame ${mutation.frameType} must have a payload`);
    bytes[marker + 8 + length - 1] ^= mutation.value;
    return bytes;
  }
  throw new Error(`Unsupported conformance mutation ${mutation.operation}`);
}

test("bundled verifier accepts the frozen upstream valid vectors", () => {
  assert.equal(manifest.privateKeyMaterialIncluded, false);

  for (const vector of manifest.valid) {
    const bytes = Buffer.from(vector.bytesBase64, "base64");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), vector.sha256, vector.id);

    const result = verifyG9pBytes(bytes);
    assert.equal(result.valid, true, vector.id);
    assert.equal(result.kind, vector.kind, `${vector.id} kind`);
    for (const [field, expected] of Object.entries(vector.expected)) {
      assert.deepEqual(result[field], expected, `${vector.id} ${field}`);
    }
  }
});

test("bundled verifier rejects the frozen upstream invalid vectors", () => {
  const validById = new Map(manifest.valid.map((vector) => [vector.id, vector]));

  for (const vector of manifest.invalid) {
    const source = validById.get(vector.source);
    assert.ok(source, `${vector.id} source exists`);
    const bytes = mutate(Buffer.from(source.bytesBase64, "base64"), vector.mutation);
    assert.throws(
      () => verifyG9pBytes(bytes),
      (error) => error.category === vector.expected.portableCategory,
      `${vector.id} portable category`,
    );
  }
});
