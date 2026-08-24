import assert from "node:assert/strict";
import test from "node:test";

import { jsonSafe } from "../src/lib/json-safe.js";

test("jsonSafe preserves ordinary event data and encodes byte strings explicitly", () => {
  assert.deepEqual(jsonSafe({ payload: { label: "approval", proof: new Uint8Array([0, 1, 255]) } }), {
    payload: {
      label: "approval",
      proof: { encoding: "base64", byteLength: 3, value: "AAH/" },
    },
  });
});

test("jsonSafe handles byte strings nested in arrays", () => {
  assert.deepEqual(jsonSafe([new Uint8Array([9]), null]), [{ encoding: "base64", byteLength: 1, value: "CQ==" }, null]);
});
