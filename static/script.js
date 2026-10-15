const $ = id => document.getElementById(id);
const start = $("start");
const label = $("button-text");
const phase = $("phase");
const speed = $("speed");
const progress = $("progress");
const needle = $("needle");
const error = $("error");
let running = false;

function metric(id, n, digits = 1) {
  $(id).textContent = Number.isFinite(n) ? n.toFixed(digits) : "—";
}
function setSpeed(n) {
  n = Math.max(0, Number(n) || 0);
  speed.textContent = n < 10 ? n.toFixed(2) : n.toFixed(1);
  const ratio = Math.min(n / 200, 1);
  progress.style.strokeDashoffset = 377 * (1 - ratio);
  needle.style.transform = "rotate(" + (-90 + ratio * 180) + "deg)";
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function mbps(bytes, seconds) {
  return seconds > 0 ? bytes * 8 / seconds / 1e6 : 0;
}
async function pingOnce() {
  const started = performance.now();
  const response = await fetch("/api/ping?t=" + crypto.randomUUID(), { cache: "no-store" });
  if (!response.ok) throw Error("Latency endpoint failed.");
  await response.json();
  return performance.now() - started;
}
async function pingTest() {
  const samples = [];
  for (let i = 0; i < 6; i++) {
    samples.push(await pingOnce());
    metric("ping", median(samples));
  }
  const differences = samples.slice(1).map((v, i) => Math.abs(v - samples[i]));
  const jitter = differences.length ? differences.reduce((a, b) => a + b, 0) / differences.length : 0;
  return { ping: median(samples), jitter };
}
async function downloadTest() {
  const results = [];
  for (const bytes of [2 * 1048576, 8 * 1048576, 8 * 1048576]) {
    phase.textContent = "MEASURING DOWNLOAD";
    const started = performance.now();
    const response = await fetch("/api/download?bytes=" + bytes + "&t=" + crypto.randomUUID(), { cache: "no-store" });
    if (!response.ok) throw Error(response.status === 429 ? "Rate limit reached. Wait a minute and retry." : "Download test failed.");
    const data = await response.arrayBuffer();
    const seconds = (performance.now() - started) / 1000;
    if (data.byteLength !== bytes) throw Error("Incomplete download payload.");
    results.push(mbps(data.byteLength, seconds));
    setSpeed(median(results));
    metric("download", median(results));
  }
  return median(results.slice(1));
}
async function uploadTest() {
  const results = [];
  for (const bytes of [1048576, 3 * 1048576, 3 * 1048576]) {
    phase.textContent = "MEASURING UPLOAD";
    const body = new Uint8Array(bytes);
    for (let off = 0; off < body.length; off += 65536) {
      crypto.getRandomValues(body.subarray(off, Math.min(off + 65536, body.length)));
    }
    const started = performance.now();
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body,
      cache: "no-store"
    });
    if (!response.ok) throw Error(response.status === 429 ? "Rate limit reached. Wait a minute and retry." : "Upload test failed.");
    const result = await response.json();
    const seconds = (performance.now() - started) / 1000;
    if (result.received_bytes !== bytes) throw Error("Incomplete upload payload.");
    results.push(mbps(bytes, seconds));
    setSpeed(median(results));
    metric("upload", median(results));
  }
  return median(results.slice(1));
}
function renderHistory() {
  const host = $("history-list");
  let history = [];
  try { history = JSON.parse(localStorage.getItem("pulsespeed-history") || "[]"); } catch (_) {}
  if (!history.length) {
    host.innerHTML = '<span class="empty">Your completed tests will appear here.</span>';
    return;
  }
  host.innerHTML = history.map(item => {
    const date = new Date(item.at);
    return '<div class="history-item"><span>' + date.toLocaleDateString() + ' ' +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
      '</span><span><strong>' + item.down.toFixed(1) + ' ↓</strong> / ' +
      item.up.toFixed(1) + ' ↑ Mbps</span></div>';
  }).join("");
}
function saveHistory(result) {
  try {
    const history = JSON.parse(localStorage.getItem("pulsespeed-history") || "[]");
    history.unshift({ ...result, at: new Date().toISOString() });
    localStorage.setItem("pulsespeed-history", JSON.stringify(history.slice(0, 5)));
    renderHistory();
  } catch (_) {}
}

start.addEventListener("click", async () => {
  if (running) return;
  running = true;
  error.hidden = true;
  start.disabled = true;
  label.textContent = "Testing…";
  $("play").textContent = "◌";
  ["ping", "jitter", "download", "upload"].forEach(id => { $(id).textContent = "—"; });
  try {
    phase.textContent = "CHECKING LATENCY";
    const latency = await pingTest();
    metric("ping", latency.ping);
    metric("jitter", latency.jitter);
    const download = await downloadTest();
    const upload = await uploadTest();
    setSpeed(download);
    phase.textContent = "TEST COMPLETE";
    label.textContent = "Test again";
    saveHistory({ down: download, up: upload, ping: latency.ping, jitter: latency.jitter });
  } catch (e) {
    phase.textContent = "TEST COULDN'T FINISH";
    error.textContent = (e.message || "Something went wrong.") + " Check your connection and retry.";
    error.hidden = false;
    label.textContent = "Retry test";
  } finally {
    running = false;
    start.disabled = false;
    $("play").textContent = "▶";
  }
});
$("clear").addEventListener("click", () => {
  localStorage.removeItem("pulsespeed-history");
  renderHistory();
});
renderHistory();
