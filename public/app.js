import { buildStoredZip } from "./zip.js";

const state = {
  config: null,
  segments: [],
  selectedEventKey: null,
  trustBundle: null,
  trustBundleBytes: null,
};

const elements = Object.fromEntries([
  "segment-input", "trust-input", "export-button", "empty-state", "workspace", "segment-count",
  "segment-size", "record-count", "crypto-status", "trust-status", "trust-bundle-label", "chain-status",
  "record-list", "record-detail", "segment-list", "search-input", "clear-button", "toast",
].map((id) => [id, document.getElementById(id)]));

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
}

function toast(message, error = false) {
  elements.toast.textContent = message;
  elements.toast.className = `toast show${error ? " error" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { elements.toast.className = "toast"; }, 4500);
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...options.headers, "X-Provenance-Viewer-Token": state.config.csrfToken },
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error?.message ?? "Local viewer request failed"), result.error);
  return result;
}

async function verifyFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await api(`/api/verify-segment?filename=${encodeURIComponent(file.name)}`, {
    method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: bytes,
  });
  return { file, bytes, sha256: await sha256Hex(bytes), result };
}

function allEvents() {
  return state.segments.flatMap((segment, segmentIndex) => (segment.result.events ?? []).map((event, eventIndex) => ({
    event,
    segment,
    key: `${segmentIndex}:${eventIndex}`,
    position: { segmentIndex, eventIndex },
  })));
}

function continuity() {
  const streams = new Map();
  for (const segment of state.segments) {
    const result = segment.result;
    const key = `${result.ledgerId}\0${result.routingEpochNumber ?? 0}\0${result.shardId}`;
    const stream = streams.get(key) ?? [];
    stream.push(result);
    streams.set(key, stream);
  }

  let partial = false;
  for (const stream of streams.values()) {
    stream.sort((left, right) => left.segmentNumber - right.segmentNumber);
    if (stream[0].segmentNumber !== 0 || stream[0].previousSegmentHash !== null) partial = true;
    for (let index = 1; index < stream.length; index += 1) {
      const previous = stream[index - 1];
      const current = stream[index];
      if (current.segmentNumber === previous.segmentNumber) return { status: "broken", label: "Conflict" };
      if (current.segmentNumber !== previous.segmentNumber + 1) {
        partial = true;
        continue;
      }
      if (current.previousSegmentHash !== previous.segmentHash) return { status: "broken", label: "Broken" };
    }
  }
  return partial ? { status: "partial", label: "Partial" } : { status: "complete", label: "Continuous" };
}

function trustSummary() {
  const statuses = state.segments.map(({ result }) => result.trust.status);
  if (statuses.length === 0 || statuses.every((status) => status === "not-assessed")) return { label: "Not assessed", className: "warn" };
  if (statuses.some((status) => status === "revoked" || status === "untrusted")) return { label: "Attention", className: "bad" };
  if (statuses.every((status) => status === "trusted")) return { label: "Trusted", className: "good" };
  return { label: "Indeterminate", className: "warn" };
}

function render() {
  const events = allEvents();
  const hasEvidence = state.segments.length > 0;
  elements["empty-state"].hidden = hasEvidence;
  elements.workspace.hidden = !hasEvidence;
  elements["export-button"].disabled = !hasEvidence;
  if (!hasEvidence) return;

  elements["segment-count"].textContent = state.segments.length;
  elements["segment-size"].textContent = formatBytes(state.segments.reduce((sum, item) => sum + item.bytes.byteLength, 0));
  elements["record-count"].textContent = events.length;
  elements["crypto-status"].textContent = "Valid";
  elements["crypto-status"].className = "status-text good";

  const trust = trustSummary();
  elements["trust-status"].textContent = trust.label;
  elements["trust-status"].className = `status-text ${trust.className}`;
  elements["trust-bundle-label"].textContent = state.trustBundle ? state.trustBundle.bundleId : "No bundle loaded";

  const chain = continuity();
  elements["chain-status"].textContent = chain.label;
  elements["chain-status"].className = `status-text ${chain.status === "complete" ? "good" : chain.status === "broken" ? "bad" : "warn"}`;

  renderRecordList();
  renderSegments();
  if (state.selectedEventKey && events.some((item) => item.key === state.selectedEventKey)) renderDetail(state.selectedEventKey);
  else if (events[0]) selectEvent(events[0].key);
}

function searchable(item) {
  const event = item.event;
  return [event.eventId, event.subject, event.type, event.source?.identity, event.source?.kind, event.policyReference, JSON.stringify(event.payload ?? "")].join(" ").toLowerCase();
}

function renderRecordList() {
  const query = elements["search-input"].value.trim().toLowerCase();
  const events = allEvents().filter((item) => !query || searchable(item).includes(query));
  elements["record-list"].innerHTML = events.length === 0
    ? '<p class="muted" style="padding:20px">No records match this search.</p>'
    : events.map((item) => {
        const { event, segment, key } = item;
        return `<button class="record-card${key === state.selectedEventKey ? " selected" : ""}" data-event-key="${key}" type="button">
          <span class="record-dot" aria-hidden="true"></span>
          <span class="record-main"><strong>${escapeHtml(event.type)}</strong><span>${escapeHtml(event.subject)}</span><small>${escapeHtml(event.source?.identity)} · ${escapeHtml(segment.file.name)}</small></span>
          <span class="record-time">${escapeHtml(formatDate(event.occurredAt))}</span>
        </button>`;
      }).join("");
}

function renderDetail(key) {
  const item = allEvents().find((candidate) => candidate.key === key);
  if (!item) return;
  const { event, segment, position } = item;
  const facts = [
    ["Occurred", formatDate(event.occurredAt)], ["Recorded", formatDate(event.recordedAt)],
    ["Source", `${event.source?.kind}: ${event.source?.identity}`], ["Event ID", event.eventId],
    ["Ledger", event.ledgerId], ["Position", `${segment.result.shardId} · segment ${segment.result.segmentNumber} · record ${position.eventIndex}`],
    ["Correlation", event.correlationId ?? "Not supplied"], ["Policy reference", event.policyReference ?? "Not supplied"],
  ];
  const content = event.payload !== undefined ? event.payload : { payloadHash: event.payloadHash };
  elements["record-detail"].innerHTML = `
    <p class="eyebrow">SELECTED RECORD</p>
    <p class="type-label">${escapeHtml(event.type)} · schema v${escapeHtml(event.schemaVersion)}</p>
    <h2>${escapeHtml(event.subject)}</h2>
    <div class="fact-grid">${facts.map(([label, value]) => `<div class="fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>
    <section class="content-section"><h3>Recorded payload</h3><pre class="payload">${escapeHtml(JSON.stringify(content, null, 2))}</pre></section>
    ${event.metadata === undefined ? "" : `<section class="content-section"><h3>Metadata</h3><pre class="payload">${escapeHtml(JSON.stringify(event.metadata, null, 2))}</pre></section>`}
    <section class="content-section"><h3>Integrity references</h3><pre class="payload">${escapeHtml(JSON.stringify({
      segmentHash: segment.result.segmentHash,
      logicalRoot: segment.result.logicalRoot,
      signerKeyId: segment.result.signerKeyId,
      trust: segment.result.trust,
      previousStateHash: event.previousStateHash ?? null,
      resultingStateHash: event.resultingStateHash ?? null,
    }, null, 2))}</pre></section>`;
}

function renderSegments() {
  elements["segment-list"].innerHTML = state.segments.map(({ file, result }) => `<div class="segment-row">
    <strong>${escapeHtml(file.name)}<br><span class="muted">${escapeHtml(result.segmentHash)}</span></strong>
    <span>${escapeHtml(result.ledgerId)}<br><span class="muted">${escapeHtml(result.shardId)} / ${result.segmentNumber}</span></span>
    <span class="good">Cryptography: valid<br><span class="muted">Format v${result.formatVersion}</span></span>
    <span class="${result.trust.status === "trusted" ? "good" : result.trust.status === "revoked" || result.trust.status === "untrusted" ? "bad" : "warn"}">Trust: ${escapeHtml(result.trust.status)}<br><span class="muted">${result.recordCount} records</span></span>
  </div>`).join("");
}

function selectEvent(key) {
  state.selectedEventKey = key;
  renderRecordList();
  renderDetail(key);
}

async function openSegments(files) {
  const candidates = [...files].filter((file) => file.name.toLowerCase().endsWith(".g9p"));
  if (candidates.length === 0) return toast("Choose one or more .g9p segment files.", true);
  let added = 0;
  for (const file of candidates) {
    try {
      const verified = await verifyFile(file);
      const duplicate = state.segments.some((item) => item.result.segmentHash === verified.result.segmentHash);
      if (!duplicate) { state.segments.push(verified); added += 1; }
    } catch (error) {
      toast(`${file.name}: ${error.message}`, true);
    }
  }
  state.segments.sort((left, right) => left.result.ledgerId.localeCompare(right.result.ledgerId)
    || (left.result.routingEpochNumber ?? 0) - (right.result.routingEpochNumber ?? 0)
    || left.result.shardId.localeCompare(right.result.shardId)
    || left.result.segmentNumber - right.result.segmentNumber);
  render();
  if (added) toast(`${added} sealed segment${added === 1 ? "" : "s"} verified locally.`);
}

async function loadTrustBundle(file) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const trustBundle = JSON.parse(new TextDecoder().decode(bytes));
    const response = await api("/api/trust-bundle", { method: "POST", headers: { "Content-Type": "application/json" }, body: bytes });
    state.trustBundle = { ...trustBundle, bundleId: response.bundleId };
    state.trustBundleBytes = bytes;
    if (state.segments.length) {
      const files = state.segments.map((item) => item.file);
      state.segments = [];
      state.selectedEventKey = null;
      await openSegments(files);
    } else render();
    toast(`Trust bundle “${response.bundleId}” loaded for this session.`);
  } catch (error) {
    toast(`Trust bundle rejected: ${error.message}`, true);
  }
}

async function exportEvidencePack() {
  const generatedAt = new Date().toISOString();
  const evidence = state.segments.map((segment, index) => ({
    filename: `evidence/${String(index + 1).padStart(4, "0")}-${segment.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
    sourceFilename: segment.file.name,
    sha256: segment.sha256,
    verification: segment.result,
  }));
  const report = {
    kind: "provenance-9-governance-evidence-report",
    version: 1,
    generatedAt,
    viewer: { name: "Provenance•9 Evidence Viewer", version: "0.1.0", mode: "local-read-only", verifier: state.config.verifier },
    scope: {
      suppliedSegments: evidence.length,
      recordedEvents: allEvents().length,
      continuity: continuity(),
      trustBundleId: state.trustBundle?.bundleId ?? null,
    },
    limitation: "This report proves the integrity of supplied recorded history, not factual truth or completeness outside the supplied trust boundary.",
    evidence,
  };
  const entries = evidence.map((item, index) => ({ name: item.filename, bytes: state.segments[index].bytes }));
  if (state.trustBundleBytes) entries.push({ name: "trust/segment-trust-bundle.json", bytes: state.trustBundleBytes });
  entries.push({ name: "governance-report.json", bytes: JSON.stringify(report, null, 2) });
  entries.push({ name: "README.txt", bytes: [
    "Provenance•9 governance evidence pack", "", `Generated: ${generatedAt}`,
    "", "This pack contains the exact sealed .g9p bytes supplied to the viewer and a machine-readable verification report.",
    "Re-verify each .g9p file with a compatible official Provenance•9 verifier.",
    "Compare each file's SHA-256 digest with governance-report.json before relying on the copied bytes.",
    "", "Cryptographic validity, signer trust and supplied-history continuity are separate findings.",
    "A valid record is not proof that the recorded assertion was factually true or that the supplied history is complete.",
    "", "Routing descriptors, checkpoints and witness receipts are not yet supported by viewer version 0.1.0 and must be preserved separately.",
  ].join("\n") });
  const blob = new Blob([buildStoredZip(entries)], { type: "application/zip" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `provenance-9-evidence-pack-${generatedAt.replace(/[:.]/g, "-")}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  toast("Governance evidence pack exported with exact sealed source bytes.");
}

elements["segment-input"].addEventListener("change", (event) => openSegments(event.target.files));
elements["trust-input"].addEventListener("change", (event) => event.target.files[0] && loadTrustBundle(event.target.files[0]));
elements["record-list"].addEventListener("click", (event) => event.target.closest("[data-event-key]") && selectEvent(event.target.closest("[data-event-key]").dataset.eventKey));
elements["search-input"].addEventListener("input", renderRecordList);
elements["export-button"].addEventListener("click", exportEvidencePack);
elements["clear-button"].addEventListener("click", () => {
  state.segments = []; state.selectedEventKey = null; elements["search-input"].value = ""; render();
});
for (const eventName of ["dragenter", "dragover"]) elements["empty-state"].addEventListener(eventName, (event) => { event.preventDefault(); elements["empty-state"].classList.add("drag"); });
for (const eventName of ["dragleave", "drop"]) elements["empty-state"].addEventListener(eventName, (event) => { event.preventDefault(); elements["empty-state"].classList.remove("drag"); });
elements["empty-state"].addEventListener("drop", (event) => openSegments(event.dataTransfer.files));

try {
  state.config = await fetch("/api/config").then(async (response) => {
    const value = await response.json();
    if (!response.ok) throw new Error(value.error?.message ?? "Configuration failed");
    return value;
  });
} catch (error) {
  toast(`Viewer could not start: ${error.message}`, true);
}
