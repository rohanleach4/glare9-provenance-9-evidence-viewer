import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import { jsonSafe } from "./lib/json-safe.js";
import { loadProvenanceVerifier } from "./lib/provenance-adapter.js";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const viewerRoot = path.resolve(sourceDir, "..");
const publicDir = path.join(viewerRoot, "public");
const host = "127.0.0.1";
const port = Number(process.env.VIEWER_PORT ?? 4179);
const maxSegmentBytes = Number(process.env.VIEWER_MAX_SEGMENT_BYTES ?? 512 * 1024 * 1024);
const maxTrustBundleBytes = 5 * 1024 * 1024;
const csrfToken = randomBytes(24).toString("base64url");
let trustBundle = null;

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

const securityHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function send(response, status, body, contentType = "application/json; charset=utf-8") {
  response.writeHead(status, { ...securityHeaders, "Content-Type": contentType });
  response.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function errorBody(error) {
  return {
    error: {
      code: typeof error?.code === "string" ? error.code : "VIEWER_ERROR",
      message: error instanceof Error ? error.message : "The evidence could not be processed",
    },
  };
}

async function readBody(request, limit) {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (declared > limit) throw Object.assign(new Error(`Request exceeds the ${limit} byte limit`), { code: "VIEWER_FILE_LIMIT", status: 413 });
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limit) throw Object.assign(new Error(`Request exceeds the ${limit} byte limit`), { code: "VIEWER_FILE_LIMIT", status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function acceptsMutation(request) {
  const origin = request.headers.origin;
  const expectedOrigin = `http://${request.headers.host}`;
  return request.headers["x-provenance-viewer-token"] === csrfToken
    && (origin === undefined || origin === expectedOrigin)
    && request.headers["sec-fetch-site"] !== "cross-site";
}

async function api(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/config") {
    const verifier = await loadProvenanceVerifier({ viewerRoot });
    return send(response, 200, {
      product: "Provenance•9 Evidence Viewer",
      mode: "local-read-only",
      csrfToken,
      verifier: { source: "local-development-adapter" },
      limits: { maxSegmentBytes },
    });
  }

  if (request.method !== "POST" || !acceptsMutation(request)) {
    return send(response, 403, { error: { code: "VIEWER_REQUEST_REJECTED", message: "The local request was rejected" } });
  }

  const verifier = await loadProvenanceVerifier({ viewerRoot });
  if (url.pathname === "/api/trust-bundle") {
    const bytes = await readBody(request, maxTrustBundleBytes);
    if (bytes.length === 0) {
      trustBundle = null;
      return send(response, 200, { loaded: false, status: "not-assessed" });
    }
    trustBundle = verifier.validateSegmentTrustBundle(JSON.parse(bytes.toString("utf8")));
    return send(response, 200, { loaded: true, bundleId: trustBundle.bundleId, bindings: trustBundle.bindings.length });
  }

  if (url.pathname === "/api/verify-segment") {
    const bytes = await readBody(request, maxSegmentBytes);
    const filename = path.basename(url.searchParams.get("filename") ?? "evidence.g9p");
    const result = await verifier.verifySegmentBytes(bytes, { source: filename });
    const epochNumber = result.routingEpochNumber ?? 0;
    const trust = trustBundle === null
      ? { status: "not-assessed", bundleId: null, keyId: result.signerKeyId }
      : verifier.evaluateSegmentTrust(trustBundle, {
          ledgerId: result.ledgerId,
          epochNumber,
          shardId: result.shardId,
          segmentNumber: result.segmentNumber,
          keyId: result.signerKeyId,
        });
    return send(response, 200, jsonSafe({
      ...result,
      cryptographicStatus: "valid",
      trust,
      signerTrusted: undefined,
      trustStatus: undefined,
    }));
  }

  return send(response, 404, { error: { code: "VIEWER_NOT_FOUND", message: "API route not found" } });
}

async function staticFile(response, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const relative = pathname.replace(/^\/+/, "");
  const candidate = path.resolve(publicDir, relative);
  if (!candidate.startsWith(`${publicDir}${path.sep}`)) return send(response, 404, "Not found", "text/plain; charset=utf-8");
  try {
    const bytes = await readFile(candidate);
    return send(response, 200, bytes, mimeTypes.get(path.extname(candidate)) ?? "application/octet-stream");
  } catch (error) {
    if (error?.code === "ENOENT") return send(response, 404, "Not found", "text/plain; charset=utf-8");
    throw error;
  }
}

export function createViewerServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
      if (url.pathname.startsWith("/api/")) return await api(request, response, url);
      if (request.method !== "GET" && request.method !== "HEAD") return send(response, 405, "Method not allowed", "text/plain; charset=utf-8");
      return await staticFile(response, url);
    } catch (error) {
      console.error(error);
      return send(response, Number(error?.status ?? 400), errorBody(error));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const verifier = await loadProvenanceVerifier({ viewerRoot }).catch((error) => {
    console.error(`Cannot load the Provenance verifier: ${error.message}`);
    console.error("Set G9P_CORE_PATH to a compatible Glare9-Provenance checkout.");
    process.exitCode = 1;
    return null;
  });
  if (verifier !== null) {
    createViewerServer().listen(port, host, () => {
      console.log(`Provenance•9 Evidence Viewer: http://${host}:${port}`);
      console.log("Local read-only mode. No evidence is uploaded or persisted by the viewer.");
    });
  }
}
