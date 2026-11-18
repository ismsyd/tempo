const $ = (id) => document.getElementById(id);

function ago(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

function render({ token, status }) {
  if (token) $("code").value = token;
  const dot = $("dot");
  dot.className = "dot";
  if (!token) {
    $("status-title").textContent = "Not paired yet";
    $("status-sub").textContent = "Enter the code from Tempo to start.";
  } else if (status?.ok) {
    dot.classList.add("ok");
    $("status-title").textContent = "Connected";
    let host = "";
    try {
      host = status.url ? new URL(status.url).hostname.replace(/^www\./, "") : "";
    } catch {}
    $("status-sub").textContent = `${host ? host + " · " : ""}updated ${ago(status.at)}`;
  } else {
    dot.classList.add("bad");
    $("status-title").textContent = status?.error ?? "Not connected";
    $("status-sub").textContent = status?.error === "Tempo isn't running" ? "Start Tempo on this computer." : "";
  }
}

async function refresh() {
  render(await chrome.storage.local.get(["token", "status"]));
}

$("pair").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = $("code").value.trim().toUpperCase();
  if (!token) return;
  await chrome.storage.local.set({ token });
  $("status-title").textContent = "Connecting…";
  await chrome.runtime.sendMessage("report-now");
  refresh();
});

chrome.storage.onChanged.addListener(refresh);
refresh();
