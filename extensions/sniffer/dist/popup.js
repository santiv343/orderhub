(function() {
  "use strict";
  const POPUP_DEFAULT_IGNORE_DOMAINS = [
    "google-analytics",
    "googletagmanager",
    "googlesyndication",
    "doubleclick",
    "facebook.net",
    "fbcdn.net",
    "segment.io",
    "sentry.io",
    "hotjar.com",
    "intercom.io",
    "mixpanel.com",
    "amplitude.com",
    "newrelic.com",
    "rollbar.com",
    "logrocket.com",
    "fullstory.com",
    "datadoghq.com"
  ].join("\n");
  async function init() {
    const stored = await new Promise(
      (resolve) => chrome.storage.sync.get(
        { domains: [], ignoreDomains: POPUP_DEFAULT_IGNORE_DOMAINS.split("\n"), serverPort: 7733, maxDepth: 5 },
        resolve
      )
    );
    const local = await new Promise(
      (resolve) => chrome.storage.local.get(
        { schemas: {}, queue: [] },
        (r) => resolve(r)
      )
    );
    const dot = document.getElementById("dot");
    const statusText = document.getElementById("status-text");
    const schemaCount = document.getElementById("schema-count");
    const queueCount = document.getElementById("queue-count");
    const domainsInput = document.getElementById("domains");
    const ignoreInput = document.getElementById("ignore-domains");
    const portInput = document.getElementById("server-port");
    const depthInput = document.getElementById("max-depth");
    const saveBtn = document.getElementById("save-btn");
    const savedMsg = document.getElementById("saved-msg");
    const exportBtn = document.getElementById("export-btn");
    const clearBtn = document.getElementById("clear-btn");
    domainsInput.value = stored["domains"].join("\n");
    ignoreInput.value = stored["ignoreDomains"].join("\n");
    portInput.value = String(stored["serverPort"]);
    depthInput.value = String(stored["maxDepth"]);
    schemaCount.textContent = String(Object.keys(local.schemas).length);
    queueCount.textContent = String(local.queue.length);
    async function checkServer() {
      const port = parseInt(portInput.value, 10) || 7733;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/ping`);
        const data = await res.json();
        if (data.ok) {
          dot.className = "dot connected";
          statusText.textContent = `Server online · ${data.endpoints} endpoints en disco`;
        } else {
          throw new Error();
        }
      } catch {
        dot.className = "dot error";
        statusText.textContent = "Server offline — ejecutá: node tools/sniffer-server.js";
      }
    }
    await checkServer();
    const pingInterval = setInterval(checkServer, 5e3);
    window.addEventListener("unload", () => clearInterval(pingInterval));
    saveBtn.addEventListener("click", async () => {
      const newConfig = {
        domains: domainsInput.value.split("\n").map((s) => s.trim()).filter(Boolean),
        ignoreDomains: ignoreInput.value.split("\n").map((s) => s.trim()).filter(Boolean),
        serverPort: parseInt(portInput.value, 10) || 7733,
        maxDepth: parseInt(depthInput.value, 10) || 5
      };
      await new Promise((resolve) => chrome.storage.sync.set(newConfig, resolve));
      savedMsg.style.display = "block";
      setTimeout(() => savedMsg.style.display = "none", 3e3);
    });
    exportBtn.addEventListener("click", async () => {
      const { schemas } = await new Promise(
        (resolve) => chrome.storage.local.get(
          { schemas: {} },
          (r) => resolve(r)
        )
      );
      const json = JSON.stringify(schemas, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `schemas-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
    });
    clearBtn.addEventListener("click", async () => {
      if (!confirm("¿Borrar todos los schemas capturados de chrome.storage?")) return;
      await new Promise(
        (resolve) => chrome.storage.local.set({ schemas: {}, queue: [] }, resolve)
      );
      schemaCount.textContent = "0";
      queueCount.textContent = "0";
    });
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type !== "SNIFFER_STATS_UPDATE") return;
      chrome.storage.local.get({ schemas: {}, queue: [] }, (r) => {
        schemaCount.textContent = String(Object.keys(r["schemas"]).length);
        queueCount.textContent = String(r["queue"].length);
      });
    });
  }
  init().catch(console.error);
})();
