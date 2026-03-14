(function() {
  "use strict";
  const DEFAULT_IGNORE_DOMAINS = [
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
  ];
  const ENUM_FIELD_NAMES = [
    "status",
    "state",
    "type",
    "kind",
    "source",
    "role",
    "category",
    "phase",
    "stage",
    "mode",
    "format",
    "method",
    "reason",
    "result",
    "priority",
    "level",
    "action",
    "event",
    "origin",
    "channel"
  ];
  chrome.storage.sync.get(
    { domains: [], ignoreDomains: DEFAULT_IGNORE_DOMAINS, maxDepth: 5, serverPort: 7733 },
    (stored) => {
      const snifferConfig = {
        domains: stored["domains"],
        ignoreDomains: stored["ignoreDomains"],
        maxDepth: stored["maxDepth"],
        enumFieldNames: ENUM_FIELD_NAMES,
        maxEnumValues: 20,
        arraySampleSize: 3
      };
      const configScript = document.createElement("script");
      configScript.textContent = `window.__SNIFFER_CONFIG__ = ${JSON.stringify(snifferConfig)};`;
      document.documentElement.prepend(configScript);
      configScript.remove();
      const injectedScript = document.createElement("script");
      injectedScript.src = chrome.runtime.getURL("injected.js");
      injectedScript.onload = () => injectedScript.remove();
      document.documentElement.prepend(injectedScript);
    }
  );
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== "SNIFFER_CAPTURE") return;
    chrome.runtime.sendMessage(event.data).catch(() => {
    });
  });
})();
