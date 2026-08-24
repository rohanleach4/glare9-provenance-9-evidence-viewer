export function jsonSafe(value) {
  if (value instanceof Uint8Array) {
    return {
      encoding: "base64",
      byteLength: value.byteLength,
      value: Buffer.from(value).toString("base64"),
    };
  }
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}
