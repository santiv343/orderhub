(function() {
  "use strict";
  const ALARM_NAME = "sniffer-queue-flush";
  function getPort() {
    return new Promise(
      (resolve) => chrome.storage.sync.get({ serverPort: 7733 }, (c) => resolve(c["serverPort"]))
    );
  }
  function getSchemas() {
    return new Promise(
      (resolve) => chrome.storage.local.get({ schemas: {} }, (c) => resolve(c["schemas"]))
    );
  }
  function saveSchemas(schemas) {
    return new Promise((resolve) => chrome.storage.local.set({ schemas }, resolve));
  }
  function getQueue() {
    return new Promise(
      (resolve) => chrome.storage.local.get({ queue: [] }, (c) => resolve(c["queue"]))
    );
  }
  function saveQueue(queue) {
    return new Promise((resolve) => chrome.storage.local.set({ queue }, resolve));
  }
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "SNIFFER_CAPTURE") return;
    if (!message.payload || typeof message.payload !== "object") return;
    const { endpoint, schema } = message.payload;
    if (!endpoint || typeof endpoint !== "string") return;
    handleCapture(endpoint, schema).catch(console.error);
  });
  async function handleCapture(endpoint, schema) {
    const schemas = await getSchemas();
    schemas[endpoint] = schema;
    await saveSchemas(schemas);
    const port = await getPort();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, schema })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      chrome.runtime.sendMessage({ type: "SNIFFER_STATS_UPDATE" }).catch(() => {
      });
    } catch {
      const queue = await getQueue();
      queue.push({ endpoint, schema });
      await saveQueue(queue);
    }
  }
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) flushQueue().catch(console.error);
  });
  async function flushQueue() {
    const queue = await getQueue();
    if (queue.length === 0) return;
    const port = await getPort();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/schemas/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queue)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await saveQueue([]);
      chrome.runtime.sendMessage({ type: "SNIFFER_STATS_UPDATE" }).catch(() => {
      });
    } catch {
    }
  }
})();
