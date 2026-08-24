import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

let loaded;

export async function loadProvenanceVerifier({ viewerRoot, corePath = process.env.G9P_CORE_PATH } = {}) {
  if (loaded !== undefined) return loaded;

  const resolvedCore = path.resolve(corePath ?? path.join(viewerRoot, "..", "Glare9-Provenance"));
  const verifierPath = path.join(resolvedCore, "src", "verify.js");
  await access(verifierPath);
  const verifier = await import(pathToFileURL(verifierPath).href);

  for (const name of ["verifySegmentBytes", "validateSegmentTrustBundle", "evaluateSegmentTrust"]) {
    if (typeof verifier[name] !== "function") {
      throw new Error(`The configured Provenance core does not export ${name}`);
    }
  }

  loaded = Object.freeze({
    corePath: resolvedCore,
    verifySegmentBytes: verifier.verifySegmentBytes,
    validateSegmentTrustBundle: verifier.validateSegmentTrustBundle,
    evaluateSegmentTrust: verifier.evaluateSegmentTrust,
  });
  return loaded;
}
