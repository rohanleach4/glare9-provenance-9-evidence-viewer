import { verifyG9pBytes } from "../vendor/provenance-verify.js";
import { evaluateSegmentTrust, validateSegmentTrustBundle } from "../vendor/signer-trust.js";

const verifier = Object.freeze({
  source: "bundled-independent-verifier",
  provenanceVersion: "0.1.0-alpha.2",
  provenanceCommit: "b8ac0a1614ada09f06766789163b4916e4f2fb48",
  verifySegmentBytes(bytes) {
    const result = verifyG9pBytes(bytes);
    if (result.kind !== "segment") {
      const error = new Error("The selected .g9p file is not a sealed segment");
      error.code = "VIEWER_UNSUPPORTED_PROFILE";
      throw error;
    }
    return result;
  },
  validateSegmentTrustBundle,
  evaluateSegmentTrust,
});

export async function loadProvenanceVerifier() {
  return verifier;
}
