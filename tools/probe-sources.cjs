#!/usr/bin/env node
/**
 * Probe the quant/crypto source matrices, classify content_access, and
 * (with --apply) write content_access / last_checked / probe back into the YAML.
 *
 * Usage:
 *   node tools/probe-sources.cjs --file=quant            # probe quant matrix
 *   node tools/probe-sources.cjs --file=crypto --apply   # probe + write back
 *   node tools/probe-sources.cjs --file=quant --only=sec-data-apis,alfred
 *
 * Requires the `yaml` dev dependency (or the DSH profile copy).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const YAML_PATHS = [
  'C:/Users/leo wang/.dsh/profiles/desktop/node_modules/yaml',
  'yaml',
];
function loadYaml() {
  for (const p of YAML_PATHS) {
    try { return require(p); } catch { /* try next */ }
  }
  throw new Error('yaml package not found (npm install)');
}
const YAML = loadYaml();

const args = process.argv.slice(2);
const DOMAIN = (args.find((a) => a.startsWith('--file=')) || '--file=quant').slice('--file='.length);
const APPLY = args.includes('--apply');
const CHECK = args.includes('--check');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice('--only='.length);
const MATRIX_PATH = path.isAbsolute(DOMAIN)
  ? DOMAIN
  : path.join(ROOT, 'data', `${DOMAIN}-source-matrix.yaml`);
const REPORT_PATH = path.join(ROOT, 'data', `probe-report-${path.basename(MATRIX_PATH, '.yaml')}.json`);
const TODAY = new Date().toISOString().slice(0, 10);
const TIMEOUT_MS = 25000;
const ANALYSIS_CAP = 4 * 1024 * 1024;
const CONCURRENCY = 4;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 dsh-quant-source-probe/0.1 (contact: uhygyuf@users.noreply.github.com)';

const doc = YAML.parseDocument(fs.readFileSync(MATRIX_PATH, 'utf8'));
if (doc.errors && doc.errors.length) {
  for (const e of doc.errors) console.error('YAML error:', e.message);
  process.exit(2);
}
const data = doc.toJS({ maxAliasCount: -1 });
const sources = data.sources || [];
if (!sources.length) { console.error('no sources found'); process.exit(2); }

// ---------- heuristics ----------
const JS_MARKERS = [
  '<div id="root"', 'id="root"', '__NEXT_DATA__', '__NUXT__', 'window.__INITIAL_STATE__',
  'requires JavaScript', 'enable JavaScript', 'data-reactroot', 'ng-version',
  'Please turn on JavaScript', 'JavaScript must be enabled', 'Enabling JavaScript',
];

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classify(src, res) {
  if (['api', 'rss', 'atom', 'xml', 'dataset'].includes(src.kind)) {
    // A 403/429 on an API endpoint is a challenge or an auth wall, not a data response.
    if ([401, 403, 429, 503, 202].includes(res.status)) return 'challenge';
    return 'api';
  }
  if (src.kind === 'pdf') return 'binary';
  if ([401, 403, 429, 503, 202].includes(res.status)) return 'challenge';
  const ct = (res.contentType || '').toLowerCase();
  if (ct.includes('json')) return 'api';
  if (ct.includes('html') || ct.includes('xhtml')) {
    const html = res.htmlSnippet || '';
    const head = html.slice(0, 5000);
    if (/http-equiv\s*=\s*["']?refresh/i.test(head) && /url\s*=/i.test(head)) return 'redirect';
    if (/<frameset/i.test(head)) return 'frameset';
    const hasJsMarkers = JS_MARKERS.some((m) => html.includes(m));
    if (hasJsMarkers && (res.textLen ?? 0) < 1200) return 'js';
    if (res.textLen < 250) return 'portal';
    if (res.textLen < 900 && (res.linkCount || 0) >= 8) return 'portal';
    return 'static';
  }
  if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom')) return 'api';
  if (ct.includes('text/')) return 'static';
  return 'binary';
}

const REFRESH_BY_EVIDENCE = {
  spec: 90,
  'official-doc': 30,
  'vendor-doc': 30,
  dataset: 30,
  community: 30,
  index: 30,
  preprint: 30,
  'peer-reviewed': 365,
  textbook: 365,
  course: 180,
  blog: 14,
  advisory: 2,
  'release-note': 14,
};
function refreshDays(src) {
  if (['api', 'rss', 'atom', 'dataset'].includes(src.kind)) return 14;
  return REFRESH_BY_EVIDENCE[src.evidence] ?? 30;
}

// Government / open-source / marketplace buckets. Anything not listed falls back
// to site-terms + metadata-only, which is the safe default.
const PUBLIC_DOMAIN = new Set([
  'sec-edgar-search', 'sec-data-apis', 'sec-companyfacts', 'sec-submissions',
  'sec-financial-statement-data-sets', 'sec-form-13f-datasets', 'sec-insider-transactions',
  'cftc-cot', 'fred', 'alfred', 'bls-api', 'bea-api', 'treasury-fiscal-data',
  'imf-data', 'world-bank-data', 'nbs-china', 'pbc-china', 'gdelt',
]);
const OPEN_SOURCE = {
  ccxt: { license_class: 'open-source', attribution: 'required' },
  'python-binance': { license_class: 'open-source', attribution: 'required' },
  'binance-connector-python': { license_class: 'open-source', attribution: 'required' },
  akshare: { license_class: 'open-source', attribution: 'required' },
  cnequity: { license_class: 'varies', attribution: 'required' },
  openbb: { license_class: 'open-source', attribution: 'required' },
};

function licenseInfo(src) {
  if (OPEN_SOURCE[src.id]) return { ...OPEN_SOURCE[src.id], cache_policy: 'metadata-only' };
  if (PUBLIC_DOMAIN.has(src.id)) {
    return { license_class: 'public-domain', cache_policy: 'short-quote', attribution: 'recommended' };
  }
  if (src.evidence === 'peer-reviewed' || src.evidence === 'preprint') {
    return { license_class: 'open-access-paper', cache_policy: 'short-quote', attribution: 'recommended' };
  }
  if (src.evidence === 'community') {
    return { license_class: 'varies', cache_policy: 'metadata-only', attribution: 'required' };
  }
  return { license_class: 'site-terms', cache_policy: 'metadata-only', attribution: 'recommended' };
}

// ---------- scheduling ----------
const HOST_INTERVAL = {
  'export.arxiv.org': 3500,
  'arxiv.org': 3500,
  'www.sec.gov': 1200,
  'data.sec.gov': 1200,
  'developers.binance.com': 700,
  'data.binance.vision': 700,
  'api.github.com': 1200,
};
const lastByHost = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gate(url) {
  let host = '';
  try { host = new URL(url).host; } catch { return; }
  const interval = HOST_INTERVAL[host] ?? 500;
  const last = lastByHost.get(host) || 0;
  const wait = last + interval - Date.now();
  if (wait > 0) await sleep(wait);
  lastByHost.set(host, Date.now());
}

async function fetchWithRetry(src) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(src.url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { 'user-agent': UA, accept: '*/*' },
      });
      clearTimeout(timer);
      return res;
    } catch (err) {
      lastErr = err;
      clearTimeout(timer);
      if (attempt === 0) await sleep(1500);
    }
  }
  throw lastErr;
}

async function probeOne(src) {
  const out = {
    id: src.id,
    url: src.url,
    kind: src.kind,
    evidence: src.evidence,
    status: null,
    contentType: '',
    bytes: 0,
    finalUrl: '',
    textLen: null,
    linkCount: null,
    jsMarkers: [],
    access: null,
    flags: [],
    error: null,
  };
  await gate(src.url);
  try {
    const res = await fetchWithRetry(src);
    out.status = res.status;
    out.contentType = res.headers.get('content-type') || '';
    out.finalUrl = res.url || src.url;
    const buf = Buffer.from(await res.arrayBuffer());
    out.bytes = buf.length;
    const ct = out.contentType.toLowerCase();
    if (ct.includes('html') || ct.includes('xhtml')) {
      const slice = buf.subarray(0, ANALYSIS_CAP).toString('utf8');
      out.htmlSnippet = slice;
      const text = visibleText(slice);
      out.textLen = text.length;
      out.linkCount = (slice.match(/<a\s/gi) || []).length;
      out.jsMarkers = JS_MARKERS.filter((m) => slice.includes(m));
    } else if (ct.includes('json')) {
      out.textSample = buf.subarray(0, 100).toString('utf8');
    } else if (ct.includes('pdf')) {
      out.textSample = '%PDF';
    } else {
      out.textLen = buf.subarray(0, Math.min(buf.length, 2000)).toString('utf8').length;
    }
    out.access = classify(src, out);
  } catch (err) {
    out.error = err && err.name ? `${err.name}: ${err.message}` : String(err);
    out.flags.push('error');
  } finally {
    delete out.htmlSnippet;
  }

  if (out.error) out.access = null;
  if (out.status !== null && out.status !== 200) out.flags.push(`http-${out.status}`);
  if (out.access === 'js') out.flags.push('js-shell');
  if (out.access === 'challenge') out.flags.push('challenge');
  if (out.access === 'redirect') out.flags.push('meta-redirect');
  if (out.access === 'frameset') out.flags.push('frameset');
  if (out.access === 'portal') out.flags.push('portal');
  if (out.textLen !== null && out.textLen < 200) out.flags.push('low-text');
  if (out.finalUrl && src.url && out.finalUrl !== src.url) out.flags.push('http-redirect');
  return out;
}

async function pool(items, worker, size) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: size }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
      const r = results[i];
      console.log(
        `[${String(i + 1).padStart(3)}/${items.length}] ${r.id.padEnd(28)} ` +
        `${String(r.status ?? 'ERR').padEnd(4)} ${String(r.bytes).padStart(8)}B ` +
        `text=${String(r.textLen ?? '-').padStart(7)} access=${r.access ?? '-'} ${r.flags.join(',')}`,
      );
    }
  });
  await Promise.all(runners);
  return results;
}

function applyResults(sources, results) {
  const seq = doc.get('sources');
  if (!seq || !seq.items) { console.error('sources seq missing'); process.exit(2); }
  const byId = new Map(results.map((r) => [r.id, r]));
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const r = byId.get(src.id);
    if (!r) continue;
    const node = seq.items[i];
    if (!node || typeof node.set !== 'function') continue;
    node.set('content_access', r.access ?? 'unknown');
    node.set('last_checked', TODAY);
    node.set('check_method', 'probe-v1');
    node.set('refresh_days', refreshDays(src));
    const lic = licenseInfo(src);
    node.set('license_class', lic.license_class);
    node.set('cache_policy', lic.cache_policy);
    node.set('attribution', lic.attribution);
    node.set('probe', doc.createNode({
      status: r.status,
      content_type: r.contentType,
      bytes: r.bytes,
      text_len: r.textLen,
      final_url: r.finalUrl,
      checked_at: TODAY,
      method: 'probe-v1',
    }));
  }
  fs.writeFileSync(MATRIX_PATH, doc.toString({ lineWidth: 0 }), 'utf8');
  console.log(`\napplied to ${MATRIX_PATH}`);
}

const selected = ONLY ? sources.filter((s) => ONLY.split(',').includes(s.id)) : sources;

(async () => {
  if (!selected.length) { console.error('no matching sources'); process.exit(2); }
  console.log(`probing ${selected.length} sources from ${path.basename(MATRIX_PATH)} (concurrency ${CONCURRENCY})${CHECK ? ' [check]' : APPLY ? ' [apply]' : ''}\n`);
  const results = await pool(selected, (s) => probeOne(s), CONCURRENCY);
  const summary = {
    total: results.length,
    ok: results.filter((r) => r.status === 200).length,
    non200: results.filter((r) => r.status !== 200).map((r) => `${r.id}:${r.status ?? r.error}`),
    access: results.reduce((a, r) => { const k = r.access ?? 'error'; a[k] = (a[k] || 0) + 1; return a; }, {}),
    flags: results.reduce((a, r) => { for (const f of r.flags) a[f] = (a[f] || 0) + 1; return a; }, {}),
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ generated_at: TODAY, method: 'probe-v1', summary, entries: results }, null, 2), 'utf8');
  console.log('\nsummary:', JSON.stringify(summary, null, 2));
  console.log('report:', REPORT_PATH);
  if (CHECK) process.exit(0);
  if (APPLY) applyResults(sources, results);
})().catch((e) => { console.error('fatal:', e); process.exit(1); });
