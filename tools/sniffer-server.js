#!/usr/bin/env node
/**
 * Sniffer Server — recibe schemas de la extensión Chrome y los escribe a disco
 *
 * Uso:
 *   node tools/sniffer-server.js              # puerto 7733, schemas.json en CWD
 *   node tools/sniffer-server.js 8080         # puerto custom
 *   node tools/sniffer-server.js 7733 ./out/schemas.json
 */
import { createServer } from 'http';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { resolve } from 'path';

const PORT = parseInt(process.argv[2] ?? '7733', 10);
const OUT_FILE = resolve(process.argv[3] ?? 'schemas.json');
const TMP_FILE = OUT_FILE + '.tmp';

// ── Estado ─────────────────────────────────────────────────────────────────────

// Carga schemas existentes al iniciar (reinicios del server no pierden datos)
let schemas = {};
if (existsSync(OUT_FILE)) {
  try {
    schemas = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
    log(`Cargados ${Object.keys(schemas).length} endpoints desde ${OUT_FILE}`);
  } catch {
    log(`Aviso: no se pudo parsear ${OUT_FILE}, empezando de cero`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-AR', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function fieldCount(schema) {
  if (!schema || typeof schema !== 'object') return 0;
  return Object.keys(schema).length;
}

// ── Escritura debounceada + atómica ───────────────────────────────────────────

let writeTimer = null;

function scheduleWrite() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const json = JSON.stringify(schemas, null, 2);
    writeFileSync(TMP_FILE, json, 'utf8');
    renameSync(TMP_FILE, OUT_FILE);
    log(`💾 ${OUT_FILE}  (${Object.keys(schemas).length} endpoints)`);
    writeTimer = null;
  }, 500);
}

// ── Merge ─────────────────────────────────────────────────────────────────────

function mergeOne(endpoint, schema) {
  // Last write wins — la extensión ya hizo el merge/acumulación en memoria
  schemas[endpoint] = schema;
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function respond(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // POST /schema — schema individual
  if (req.method === 'POST' && req.url === '/schema') {
    try {
      const { endpoint, schema } = await readBody(req);
      if (!endpoint || schema === undefined) {
        respond(res, 400, { error: 'endpoint and schema required' });
        return;
      }
      mergeOne(endpoint, schema);
      scheduleWrite();
      log(`✓ ${endpoint}  (${fieldCount(schema)} campos)`);
      respond(res, 200, { ok: true });
    } catch {
      respond(res, 400, { error: 'invalid JSON' });
    }
    return;
  }

  // POST /schemas/batch — flush de cola
  if (req.method === 'POST' && req.url === '/schemas/batch') {
    try {
      const items = await readBody(req);
      if (!Array.isArray(items)) {
        respond(res, 400, { error: 'expected array' });
        return;
      }
      items.forEach(({ endpoint, schema }) => { if (endpoint) mergeOne(endpoint, schema); });
      scheduleWrite();
      log(`⚡ batch flush — ${items.length} pendientes`);
      respond(res, 200, { ok: true, count: items.length });
    } catch {
      respond(res, 400, { error: 'invalid JSON' });
    }
    return;
  }

  // GET /schemas — estado actual
  if (req.method === 'GET' && req.url === '/schemas') {
    respond(res, 200, schemas);
    return;
  }

  // GET /ping — health check para el popup
  if (req.method === 'GET' && req.url === '/ping') {
    respond(res, 200, { ok: true, endpoints: Object.keys(schemas).length });
    return;
  }

  respond(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  log(`Sniffer Server escuchando en http://127.0.0.1:${PORT}`);
  log(`Escribiendo en: ${OUT_FILE}`);
  log('Endpoints: POST /schema  ·  POST /schemas/batch  ·  GET /schemas  ·  GET /ping');
});
