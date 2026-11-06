/**
 * Unit + performance checks for quantitativeTrading-source-reliable (no DSH runtime required).
 * Run: node test/check.mjs
 */
import { loadRegistry, findSources, auditText, registryStats, DOMAINS } from '../lib/registry.js';import { buildGuidance, SECTION_ORDER } from '../lib/guidance.js';
import { FIND_TOOL, AUDIT_TOOL, declarationChars } from '../lib/tool-defs.js';

const DATA = new URL('../data/sources.json', import.meta.url);
let failures = 0;
let checks = 0;

function ok(condition, label, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function ms(ns) {
  return Number(ns) / 1e6;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

/** The tool executor rejects values that do not survive a JSON round trip. */
function isLosslessJson(value) {
  if (value === null) return true;
  const t = typeof value;
  if (t === 'string' || t === 'boolean') return true;
  if (t === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isLosslessJson);
  if (t === 'object') return Object.values(value).every(isLosslessJson);
  return false;
}

// ---------- load ----------
const loadStart = process.hrtime.bigint();
const registry = loadRegistry(DATA);
const loadMs = ms(process.hrtime.bigint() - loadStart);
const stats = registryStats(registry);

console.log(`\n[registry] ${stats.count} sources, quant ${stats.by_domain.quant} / crypto ${stats.by_domain.crypto}, load ${loadMs.toFixed(1)} ms`);
ok(stats.count >= 90, 'registry has at least 90 sources', String(stats.count));
ok(stats.by_domain.quant >= 50, 'quant domain has at least 50 sources', String(stats.by_domain.quant));
ok(stats.by_domain.crypto >= 30, 'crypto domain has at least 30 sources', String(stats.by_domain.crypto));
ok(Object.keys(stats.categories).length >= 10, 'at least 10 categories are covered', JSON.stringify(stats.categories));

const ids = registry.sources.map((s) => s.id);
ok(new Set(ids).size === ids.length, 'source ids are unique');
const incomplete = registry.sources.filter((s) => !s.domain || !s.category || !s.authority || !s.url || !s.last_checked || !s.content_access);
ok(incomplete.length === 0, 'every source has domain/category/authority/url/last_checked/content_access', incomplete.map((s) => s.id).join(','));
const badDomain = registry.sources.filter((s) => !DOMAINS.includes(s.domain));
ok(badDomain.length === 0, 'every source has a known domain', badDomain.map((s) => s.id).join(','));

// ---------- find ----------
const byUrl = findSources(registry, { url: 'https://alfred.stlouisfed.org/' });
ok(byUrl.results[0]?.id === 'alfred', 'find by ALFRED URL', byUrl.results[0]?.id);

const cryptoUrl = findSources(registry, { url: 'https://data.binance.vision/' });
ok(cryptoUrl.results[0]?.id === 'binance-data-archive', 'find by Binance archive URL', cryptoUrl.results[0]?.id);

const funding = findSources(registry, { query: 'binance funding rate', limit: 3 });
ok(
  ['binance-futures-api', 'coinglass-api', 'binance-ws-futures'].includes(funding.results[0]?.id),
  'funding-rate query ranks a Binance/derivatives source first',
  funding.results.map((s) => s.id).join(','),
);

const pitQuery = findSources(registry, { query: 'point in time fundamentals', limit: 3 });
ok(
  pitQuery.results.some((s) => ['alfred', 'sharadar', 'compustat-wrds', 'crsp'].includes(s.id)),
  'PIT query returns a point-in-time source',
  pitQuery.results.map((s) => s.id).join(','),
);

const byDomain = findSources(registry, { domain: 'crypto', limit: 20 });
ok(byDomain.count === stats.by_domain.crypto, 'domain-only lookup returns the whole crypto domain', String(byDomain.count));
ok(byDomain.results.every((s) => s.domain === 'crypto'), 'domain filter only returns crypto sources');
ok(byDomain.results.every((s) => s.authority === 'A' || s.authority === 'B'), 'domain-only lookup is primary-tier first');

const quantOnly = findSources(registry, { domain: 'quant', query: 'fed', limit: 5 });
ok(quantOnly.results.length > 0 && quantOnly.results.every((s) => s.domain === 'quant'), 'query + domain filter stays in domain');

const breadthDepth = findSources(registry, { domain: 'quant', layer: 'depth', limit: 5 });
ok(breadthDepth.results.every((s) => s.layer === 'depth'), 'layer filter works');

const unknownUrl = findSources(registry, { url: 'https://unknown.invalid/x' });
ok(unknownUrl.count === 0, 'unknown URL returns zero matches', String(unknownUrl.count));
ok(isLosslessJson(byUrl) && isLosslessJson(funding) && isLosslessJson(byDomain), 'find output is lossless JSON');

let threw = false;
try { findSources(registry, {}); } catch { threw = true; }
ok(threw, 'empty query throws a helpful error');

let badDomainThrew = false;
try { findSources(registry, { domain: 'equities' }); } catch { badDomainThrew = true; }
ok(badDomainThrew, 'unknown domain throws');

// ---------- audit ----------
const draft = [
  'US CPI vintages are available in ALFRED (see https://alfred.stlouisfed.org/).',
  'This random blog says otherwise: https://example.com/some-post.',
  'A long paragraph without any URL that makes several factual claims about funding rates, exchange endpoints and fee schedules, which should be counted as uncited because it is longer than eighty characters and carries no link at all.',
].join('\n\n');
const audit = auditText(registry, { text: draft });
ok(audit.summary.total_urls === 2, 'audit finds 2 URLs', String(audit.summary.total_urls));
ok(audit.summary.known === 1, 'audit maps alfred to a known source', String(audit.summary.known));
ok(audit.summary.unknown === 1, 'audit flags example.com as unknown', String(audit.summary.unknown));
ok(audit.summary.by_authority.A === 1, 'audit counts authority A', JSON.stringify(audit.summary.by_authority));
ok(audit.summary.uncited_paragraphs === 1, 'audit counts uncited paragraphs', String(audit.summary.uncited_paragraphs));
ok(audit.citations[0]?.pit === 'yes', 'audit exposes the PIT flag', audit.citations[0]?.pit);
ok(audit.suggestions.length >= 2, 'audit returns suggestions', String(audit.suggestions.length));
ok(isLosslessJson(audit), 'audit output is lossless JSON');

const badTier = auditText(registry, {
  text: 'Claim: exchanges are simple. Sources: https://www.reddit.com/r/binance and https://www.ssrn.com/.',
});
ok(badTier.summary.by_authority.C === 1, 'audit grades SSRN as C', JSON.stringify(badTier.summary.by_authority));
ok(badTier.summary.by_authority.unknown === 1, 'audit grades reddit as unknown', JSON.stringify(badTier.summary.by_authority));

const cjkUrl = auditText(registry, { text: '参考（https://alfred.stlouisfed.org/）。' });
ok(cjkUrl.citations[0]?.url === 'https://alfred.stlouisfed.org/', 'audit strips full-width CJK punctuation from URLs', cjkUrl.citations[0]?.url);

const newsAudit = auditText(registry, { text: 'Headline: https://www.coindesk.com/arc/outboundfeeds/rss/' });
ok(newsAudit.citations[0]?.known === true && newsAudit.citations[0]?.authority === 'D', 'crypto media is known but D-tier', JSON.stringify(newsAudit.citations[0]));

// ---------- prompt footprint ----------
const guidance = buildGuidance(stats);
const estTokens = (text) => Math.ceil(text.length / 4);
console.log(`\n[prompt] guidance ${guidance.length} chars (~${estTokens(guidance)} tokens at 4 chars/token), section order ${SECTION_ORDER}`);
ok(guidance.length < 1200, 'guidance stays under 1200 chars', String(guidance.length));

const findChars = declarationChars(FIND_TOOL);
const auditChars = declarationChars(AUDIT_TOOL);
const totalChars = findChars + auditChars + guidance.length;
const totalTokens = Math.ceil(totalChars / 4);
console.log(`[tokens] find schema ${findChars} chars (~${Math.ceil(findChars / 4)} tokens), audit schema ${auditChars} chars (~${Math.ceil(auditChars / 4)} tokens), combined ~${totalTokens} tokens per request (schemas + guidance)`);
ok(findChars + auditChars < 2600, 'two tool schemas under 2600 chars', String(findChars + auditChars));
ok(totalTokens < 750, 'combined per-request overhead under 750 tokens', String(totalTokens));

// ---------- performance ----------
const queries = [
  { query: 'binance' }, { query: 'funding rate' }, { query: 'sec xbrl' },
  { url: 'https://alfred.stlouisfed.org/' }, { domain: 'crypto', limit: 10 }, { domain: 'quant', layer: 'depth' },
];
const findTimes = [];
for (let i = 0; i < 5000; i++) {
  const q = queries[i % queries.length];
  const t = process.hrtime.bigint();
  findSources(registry, q);
  findTimes.push(ms(process.hrtime.bigint() - t));
}

const auditTextLong = draft.repeat(8);
const auditTimes = [];
for (let i = 0; i < 500; i++) {
  const t = process.hrtime.bigint();
  auditText(registry, { text: auditTextLong });
  auditTimes.push(ms(process.hrtime.bigint() - t));
}

const findAvg = findTimes.reduce((a, b) => a + b, 0) / findTimes.length;
const auditAvg = auditTimes.reduce((a, b) => a + b, 0) / auditTimes.length;
console.log(`\n[perf] find: avg ${findAvg.toFixed(3)} ms, p95 ${percentile(findTimes, 95).toFixed(3)} ms, max ${Math.max(...findTimes).toFixed(3)} ms (5000 calls)`);
console.log(`[perf] audit (${auditTextLong.length} chars): avg ${auditAvg.toFixed(3)} ms, p95 ${percentile(auditTimes, 95).toFixed(3)} ms, max ${Math.max(...auditTimes).toFixed(3)} ms (500 calls)`);
console.log(`[perf] registry load: ${loadMs.toFixed(1)} ms`);
ok(findAvg < 2, 'find average under 2 ms', findAvg.toFixed(3));
ok(auditAvg < 5, 'audit average under 5 ms', auditAvg.toFixed(3));
ok(loadMs < 100, 'registry load under 100 ms', loadMs.toFixed(1));

// ---------- summary ----------
console.log(`\n${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
