(function() {
  "use strict";
  const DEFAULT_IGNORE_DOMAINS = [
    "google-analytics",
    "googletagmanager",
    "googlesyndication",
    "doubleclick",
    "google.com/pagead",
    "facebook.net",
    "fbcdn.net",
    "connect.facebook",
    "segment.io",
    "segment.com",
    "sentry.io",
    "sentry-cdn",
    "ingest.sentry",
    "hotjar.com",
    "static.hotjar",
    "intercom.io",
    "intercomcdn.com",
    "mixpanel.com",
    "amplitude.com",
    "api.amplitude",
    "newrelic.com",
    "nr-data",
    "rollbar.com",
    "logrocket.com",
    "fullstory.com",
    "datadoghq.com",
    "browser-intake-datadoghq",
    "twitter.com",
    "ads-twitter",
    "crisp.chat",
    "client.crisp"
  ];
  const cfg = window.__SNIFFER_CONFIG__ ?? {
    domains: [],
    ignoreDomains: DEFAULT_IGNORE_DOMAINS,
    maxDepth: 5,
    enumFieldNames: [
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
    ],
    maxEnumValues: 20,
    arraySampleSize: 3
  };
  const endpoints = {};
  function emit(endpoint, entry) {
    window.postMessage({ type: "SNIFFER_CAPTURE", payload: { endpoint, schema: entry } }, "*");
  }
  function logCapture(key, calls) {
    console.log(`[Sniffer] ✓ ${key} (${calls}x)`);
  }
  function shouldCapture(url) {
    if (cfg.ignoreDomains.some((d) => url.includes(d))) return false;
    if (!cfg.domains.length) return true;
    return cfg.domains.some((d) => url.includes(d));
  }
  function resolveUrl(rawUrl) {
    if (rawUrl.startsWith("http")) return rawUrl;
    try {
      return new URL(rawUrl, window.location.href).href;
    } catch {
      return rawUrl;
    }
  }
  function normalize(rawUrl) {
    try {
      const u = new URL(resolveUrl(rawUrl));
      const path = u.pathname.replace(/\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/gi, "/:uuid").replace(/\/\d+/g, "/:id");
      return u.origin + path;
    } catch {
      return rawUrl.replace(/\/\d+/g, "/:id");
    }
  }
  function extractQueryParams(rawUrl) {
    try {
      const u = new URL(resolveUrl(rawUrl));
      const params = {};
      u.searchParams.forEach((v, k) => {
        params[k] = isNaN(Number(v)) || v === "" ? "string" : "number";
      });
      return Object.keys(params).length ? params : null;
    } catch {
      return null;
    }
  }
  function mergeSchemas(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length && b.length ? [mergeSchemas(a[0], b[0])] : a.length ? a : b;
    }
    if (typeof a !== "object" || typeof b !== "object" || Array.isArray(a) || Array.isArray(b)) return a;
    const result = { ...a };
    for (const k of Object.keys(b)) {
      result[k] = k in result ? mergeSchemas(result[k], b[k]) : b[k];
    }
    return result;
  }
  function extractSchema(value, depth) {
    if (depth > cfg.maxDepth) return "(max depth)";
    if (value === null) return "null";
    if (Array.isArray(value)) {
      if (!value.length) return [];
      const n = Math.min(cfg.arraySampleSize, value.length);
      let sample = extractSchema(value[0], depth + 1);
      for (let i = 1; i < n; i++) sample = mergeSchemas(sample, extractSchema(value[i], depth + 1));
      return [sample];
    }
    if (typeof value === "object") {
      const s = {};
      for (const k of Object.keys(value)) {
        s[k] = extractSchema(value[k], depth + 1);
      }
      return s;
    }
    return typeof value;
  }
  function collectEnumValues(obj, accumulated) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach((item) => collectEnumValues(item, accumulated));
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      const fieldName = k.toLowerCase();
      const isEnumField = cfg.enumFieldNames.some(
        (n) => fieldName === n || fieldName.endsWith("_" + n) || k.endsWith(n.charAt(0).toUpperCase() + n.slice(1))
      );
      if (isEnumField && typeof v === "string" && v.length > 0 && v.length < 50) {
        if (!accumulated[k]) accumulated[k] = /* @__PURE__ */ new Set();
        if (accumulated[k].size < cfg.maxEnumValues) accumulated[k].add(v);
      }
      if (v && typeof v === "object") collectEnumValues(v, accumulated);
    }
  }
  function record(key, schema, opts = {}) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const prev = endpoints[key];
    const enumAccumulator = {};
    if (prev == null ? void 0 : prev.enumValues) {
      for (const [k, vals] of Object.entries(prev.enumValues)) {
        enumAccumulator[k] = new Set(vals);
      }
    }
    if (opts.rawData) collectEnumValues(opts.rawData, enumAccumulator);
    const enumsSerialized = {};
    for (const [k, s] of Object.entries(enumAccumulator)) {
      if (s.size > 0 && s.size <= cfg.maxEnumValues) enumsSerialized[k] = [...s].sort();
    }
    const statuses = new Set((prev == null ? void 0 : prev.statusCodesSeen) ?? []);
    if (opts.statusCode) statuses.add(opts.statusCode);
    const entry = {
      schema,
      calls: ((prev == null ? void 0 : prev.calls) ?? 0) + 1,
      firstSeen: (prev == null ? void 0 : prev.firstSeen) ?? now,
      lastSeen: now,
      ...Object.keys(enumsSerialized).length ? { enumValues: enumsSerialized } : {},
      ...opts.queryParams ? { queryParams: opts.queryParams } : (prev == null ? void 0 : prev.queryParams) ? { queryParams: prev.queryParams } : {},
      ...statuses.size ? { statusCodesSeen: [...statuses].sort() } : {}
    };
    endpoints[key] = entry;
    emit(key, entry);
    logCapture(key, entry.calls);
  }
  function recordMerge(key, schema, rawData) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const prev = endpoints[key];
    const merged = (prev == null ? void 0 : prev.schema) != null ? mergeSchemas(prev.schema, schema) : schema;
    const enumAccumulator = {};
    if (prev == null ? void 0 : prev.enumValues) {
      for (const [k, vals] of Object.entries(prev.enumValues)) {
        enumAccumulator[k] = new Set(vals);
      }
    }
    collectEnumValues(rawData, enumAccumulator);
    const enumsSerialized = {};
    for (const [k, s] of Object.entries(enumAccumulator)) {
      if (s.size > 0 && s.size <= cfg.maxEnumValues) enumsSerialized[k] = [...s].sort();
    }
    const entry = {
      schema: merged,
      calls: ((prev == null ? void 0 : prev.calls) ?? 0) + 1,
      firstSeen: (prev == null ? void 0 : prev.firstSeen) ?? now,
      lastSeen: now,
      ...Object.keys(enumsSerialized).length ? { enumValues: enumsSerialized } : {}
    };
    endpoints[key] = entry;
    emit(key, entry);
    logCapture(key, entry.calls);
  }
  function isGraphQL(url, body) {
    return (url.includes("/graphql") || url.includes("/api/query")) && !!body && typeof body === "object" && !Array.isArray(body) && "query" in body;
  }
  function gqlKey(url, body) {
    return `GQL ${normalize(url)} [${body.operationName ?? "anonymous"}]`;
  }
  function parseBody(raw) {
    if (!raw || raw instanceof ReadableStream) return null;
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  function captureResponse(method, url, status, contentType, rawBody, reqBody, getHeader) {
    if (!shouldCapture(url)) return;
    if (status < 200 || status >= 300) return;
    if (!contentType || !contentType.includes("application/json")) return;
    const parsedBody = parseBody(rawBody);
    if (!parsedBody) return;
    const schema = extractSchema(parsedBody, 0);
    const qp = extractQueryParams(url);
    if (isGraphQL(url, reqBody)) {
      record(gqlKey(url, reqBody), schema, { queryParams: qp, statusCode: status, rawData: parsedBody });
    } else {
      record(`${method} ${normalize(url)}`, schema, { queryParams: qp, statusCode: status, rawData: parsedBody });
    }
  }
  function captureRequest(method, url, reqBody) {
    if (!["POST", "PUT", "PATCH"].includes(method)) return;
    if (!shouldCapture(url) || !reqBody || typeof reqBody !== "object") return;
    if (isGraphQL(url, reqBody)) return;
    record(`REQ ${method} ${normalize(url)}`, extractSchema(reqBody, 0), { rawData: reqBody });
  }
  function stealthSet(obj, prop, patched, original) {
    if (original) patched.toString = () => String(original);
    Object.defineProperty(obj, prop, { value: patched, writable: true, configurable: true });
  }
  const _fetch = window.fetch;
  async function patchedFetch(...args) {
    const input = args[0];
    const init = args[1] ?? {};
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    const method = (init.method ?? (input instanceof Request ? input.method : null) ?? "GET").toUpperCase();
    const rawReqBody = init.body ?? (input instanceof Request ? input.body : null);
    const reqBody = parseBody(rawReqBody);
    if (shouldCapture(url) && reqBody) captureRequest(method, url, reqBody);
    const response = await _fetch.apply(this, args);
    if (shouldCapture(url)) {
      const clone = response.clone();
      const ct = clone.headers.get("content-type") ?? "";
      clone.text().then((body) => {
        captureResponse(
          method,
          url,
          response.status,
          ct,
          body,
          reqBody
        );
      }).catch(() => {
      });
    }
    return response;
  }
  stealthSet(window, "fetch", patchedFetch, _fetch);
  const _XHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new _XHR();
    let _method = "GET";
    let _url = "";
    let _reqBody = null;
    const _open = xhr.open;
    xhr.open = function(method, url, async, user, password) {
      _method = (method ?? "GET").toUpperCase();
      _url = url ?? "";
      return _open.call(xhr, method, url, async ?? true, user, password);
    };
    const _send = xhr.send;
    xhr.send = function(body) {
      _reqBody = body;
      const reqBody = parseBody(body);
      if (reqBody) captureRequest(_method, resolveUrl(_url), reqBody);
      return _send.apply(xhr, [body]);
    };
    xhr.addEventListener("load", function() {
      const resolvedUrl = resolveUrl(_url);
      const ct = xhr.getResponseHeader("content-type") ?? "";
      captureResponse(
        _method,
        resolvedUrl,
        xhr.status,
        ct,
        xhr.responseText,
        parseBody(_reqBody)
      );
    });
    return xhr;
  }
  Object.setPrototypeOf(PatchedXHR, _XHR);
  PatchedXHR.prototype = _XHR.prototype;
  PatchedXHR.toString = () => _XHR.toString();
  Object.defineProperty(window, "XMLHttpRequest", { value: PatchedXHR, writable: true, configurable: true });
  const _WS = window.WebSocket;
  function PatchedWS(url, protocols) {
    const ws = protocols !== void 0 ? new _WS(url, protocols) : new _WS(url);
    if (shouldCapture(url)) {
      const key = `WS ${normalize(url)}`;
      ws.addEventListener("message", (e) => {
        if (typeof e.data !== "string") return;
        const parsed = parseBody(e.data);
        if (parsed) recordMerge(key, extractSchema(parsed, 0), parsed);
      });
    }
    return ws;
  }
  Object.setPrototypeOf(PatchedWS, _WS);
  PatchedWS.prototype = _WS.prototype;
  PatchedWS.toString = () => _WS.toString();
  Object.defineProperty(window, "WebSocket", { value: PatchedWS, writable: true, configurable: true });
  if (typeof window.EventSource !== "undefined") {
    let PatchedES = function(url, opts) {
      const es = opts !== void 0 ? new _ES(url, opts) : new _ES(url);
      if (shouldCapture(url)) {
        const key = `SSE ${normalize(url)}`;
        es.addEventListener("message", (e) => {
          const parsed = parseBody(e.data);
          if (parsed) recordMerge(key, extractSchema(parsed, 0), parsed);
        });
      }
      return es;
    };
    const _ES = window.EventSource;
    Object.setPrototypeOf(PatchedES, _ES);
    PatchedES.prototype = _ES.prototype;
    PatchedES.toString = () => _ES.toString();
    Object.defineProperty(window, "EventSource", { value: PatchedES, writable: true, configurable: true });
  }
  console.log(
    "[Sniffer] Interceptor activo",
    cfg.domains.length ? `— filtrando: [${cfg.domains.join(", ")}]` : "— capturando todo"
  );
})();
