/**
 * Unit + performance checks for quantitativeTrading-source-reliable (no DSH runtime required).
 * Run: node test/check.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadRegistry, findSources, auditText, registryStats, DOMAINS, normalizeUrl, matchCitation, redactUrl } from '../lib/registry.js';
import { buildGuidance, SECTION_ORDER } from '../lib/guidance.js';
import { FIND_TOOL, AUDIT_TOOL, declarationChars } from '../lib/tool-defs.js';

const require = createRequire(import.meta.url);
function loadYamlLib() {
  for (const candidate of ['yaml', 'C:/Users/leo wang/.dsh/profiles/desktop/node_modules/yaml']) {
    try { return require(candidate); } catch { /* try next */ }
  }
  throw new Error('yaml package not found');
}
const YAML = loadYamlLib();
const { classify, classifyFailure } = require('../tools/probe-classify.cjs');
const { diffEntries } = require('../tools/health-diff.cjs');

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
ok(stats.count >= 110, 'registry has at least 110 sources', String(stats.count));
ok(stats.by_domain.quant >= 65, 'quant domain has at least 65 sources', String(stats.by_domain.quant));
ok(stats.by_domain.crypto >= 40, 'crypto domain has at least 40 sources', String(stats.by_domain.crypto));
ok(stats.count === 119, 'registry ships the 119-source v0.1.3 set', String(stats.count));
ok(Object.keys(stats.categories).length >= 10, 'at least 10 categories are covered', JSON.stringify(stats.categories));

const ids = registry.sources.map((s) => s.id);
ok(new Set(ids).size === ids.length, 'source ids are unique');
const incomplete = registry.sources.filter((s) => !s.domain || !s.category || !s.authority || !s.url || !s.last_checked || !s.content_access);
ok(incomplete.length === 0, 'every source has domain/category/authority/url/last_checked/content_access', incomplete.map((s) => s.id).join(','));
const badDomain = registry.sources.filter((s) => !DOMAINS.includes(s.domain));
ok(badDomain.length === 0, 'every source has a known domain', badDomain.map((s) => s.id).join(','));

const VERIFICATION_STATES = ['discovered', 'reachable', 'schema_verified', 'semantic_verified', 'production_approved'];
const badVerification = registry.sources.filter((s) => !VERIFICATION_STATES.includes(s.verification));
ok(badVerification.length === 0, 'every source has a known verification state', badVerification.map((s) => s.id).join(','));
const badTypes = registry.sources.filter((s) => !Array.isArray(s.data_types));
ok(badTypes.length === 0, 'every source has a data_types array', badTypes.map((s) => s.id).join(','));
const typed = registry.sources.filter((s) => s.data_types.length > 0).length;
ok(typed === stats.count, 'every source is tagged with at least one dataset', `${typed}/${stats.count}`);

const pitSum = Object.values(stats.by_pit).reduce((a, b) => a + b, 0);
ok(pitSum === stats.count, 'every source has exactly one PIT state', String(pitSum));
ok(
  stats.by_pit.yes === 3
  && stats.by_pit.partial >= 15
  && stats.by_pit.not_applicable >= 40
  && stats.by_pit.unverified >= 1
  && stats.by_pit.no >= 15,
  'PIT uses all five states (yes/partial/no/not_applicable/unverified)',
  JSON.stringify(stats.by_pit),
);
const unreachable = registry.sources.filter((s) => s.content_access === 'challenge' || s.content_access === 'unknown').length;
ok(
  stats.by_verification.discovered === unreachable,
  'challenge/unreachable sources are marked discovered',
  `${stats.by_verification.discovered} discovered vs ${unreachable} unreachable`,
);
ok(stats.by_verification.production_approved >= 1, 'at least one source is production approved', JSON.stringify(stats.by_verification));
ok(stats.by_verification.semantic_verified >= 18, 'at least 18 sources were semantically checked', JSON.stringify(stats.by_verification));

const REVISION_RISK = ['none', 'rare', 'possible', 'routine', 'unknown'];
const badRevision = registry.sources.filter((s) => !REVISION_RISK.includes(s.revision_risk));
ok(badRevision.length === 0, 'every source has a known revision_risk', badRevision.map((s) => s.id).join(','));
const revisionSum = Object.values(stats.by_revision_risk).reduce((a, b) => a + b, 0);
ok(revisionSum === stats.count, 'every source has exactly one revision_risk', String(revisionSum));
const REDISTRIBUTION = ['allowed', 'restricted', 'prohibited', 'unknown'];
const badRedistribution = registry.sources.filter((s) => !REDISTRIBUTION.includes(s.redistribution));
ok(badRedistribution.length === 0, 'every source has a known redistribution bucket', badRedistribution.map((s) => s.id).join(','));

const datasets = YAML.parse(readFileSync(new URL('../data/datasets.yaml', import.meta.url), 'utf8'));
const vocabulary = new Set(Object.keys(datasets.tags ?? {}));
const strayTags = [...new Set(registry.sources.flatMap((s) => s.data_types))].filter((tag) => !vocabulary.has(tag));
ok(strayTags.length === 0, 'all data_types tags are in the controlled vocabulary', strayTags.join(','));
const undescribed = Object.entries(datasets.tags ?? {}).filter(([, description]) => !description);
ok(undescribed.length === 0, 'every vocabulary tag has a description', undescribed.map(([tag]) => tag).join(','));
ok(vocabulary.size >= 87, 'vocabulary keeps at least 87 tags', String(vocabulary.size));

const buildMeta = registry.meta.build;
ok(registry.meta.data_version === 2, 'registry data_version is 2', String(registry.meta.data_version));
ok(
  buildMeta && typeof buildMeta.built_at === 'string' && !Number.isNaN(Date.parse(buildMeta.built_at)),
  'sources.json meta.build has a parseable built_at',
  JSON.stringify(buildMeta),
);
ok(buildMeta?.source_count === registry.sources.length, 'meta.build source_count matches', String(buildMeta?.source_count));

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

const futuresResults = findSources(registry, { url: 'https://developers.binance.info/en/docs/derivatives/usds-margined-futures' }).results;
ok(futuresResults[0]?.id === 'binance-futures-api', 'URL lookup ranks the exact page above same-host fallbacks', futuresResults.map((s) => s.id).join(','));
const futuresRow = futuresResults[0];
ok(futuresRow?.verification === 'semantic_verified', 'find exposes the verification state', futuresRow?.verification);
ok(
  futuresRow?.data_types?.includes('funding') && futuresRow?.data_types?.includes('open_interest'),
  'find exposes dataset tags for a derivatives source',
  JSON.stringify(futuresRow?.data_types),
);

const hkexDm = findSources(registry, { url: 'https://www.hkex.com.hk/Services/Market-Data-Services/Historical-Data-Services/HKEX-Data-Marketplace?sc_lang=en' }).results[0];
ok(hkexDm?.id === 'hkex-data-marketplace' && hkexDm?.category === 'china', 'HKEX Data Marketplace is registered as a China source', JSON.stringify(hkexDm));
ok(hkexDm?.data_types?.includes('orderbook_l2'), 'HKEX Data Marketplace carries Full Book dataset tags', JSON.stringify(hkexDm?.data_types));
const etfFlow = findSources(registry, { query: 'bitcoin etf flow farside', limit: 5 }).results.find((s) => s.id === 'farside-btc-etf');
ok(etfFlow?.authority === 'C' && etfFlow?.verification === 'discovered', 'Farside ETF flows are a C-tier, discovered-only lead', JSON.stringify(etfFlow));
ok(registry.byId.has('hkexnews') && registry.byId.has('fed-fomc') && registry.byId.has('ccass'), 'HKEXnews, CCASS and FOMC calendar are registered');

const unknownUrl = findSources(registry, { url: 'https://unknown.invalid/x' });
ok(unknownUrl.count === 0, 'unknown URL returns zero matches', String(unknownUrl.count));
ok(isLosslessJson(byUrl) && isLosslessJson(funding) && isLosslessJson(byDomain), 'find output is lossless JSON');

let threw = false;
try { findSources(registry, {}); } catch { threw = true; }
ok(threw, 'empty query throws a helpful error');

let badDomainThrew = false;
try { findSources(registry, { domain: 'equities' }); } catch { badDomainThrew = true; }
ok(badDomainThrew, 'unknown domain throws');

// ---------- matching & redaction ----------
ok(normalizeUrl('https://Example.COM/a/b/?q=1#x') === 'https://example.com/a/b?q=1', 'normalizeUrl lowercases host, keeps query, drops fragment', normalizeUrl('https://Example.COM/a/b/?q=1#x'));
const exactMatch = matchCitation('https://alfred.stlouisfed.org/', registry.sources);
ok(exactMatch.match_type === 'exact_url' && exactMatch.source?.id === 'alfred', 'matchCitation classifies exact URLs', JSON.stringify(exactMatch));
const canonicalMatch = matchCitation('https://developers.binance.info/en/docs/derivatives/usds-margined-futures/market-data/rest-api', registry.sources);
ok(canonicalMatch.match_type === 'canonical_page' && canonicalMatch.source?.id === 'binance-futures-api', 'matchCitation classifies a deeper page as canonical', JSON.stringify(canonicalMatch));
const ambiguousMatch = matchCitation('https://www.hkex.com.hk/financials/annual-report-2025.pdf', registry.sources);
ok(ambiguousMatch.match_type === 'same_host_ambiguous' && ambiguousMatch.source === null && ambiguousMatch.candidates.includes('hkex'), 'matchCitation refuses a same-host-only guess', JSON.stringify(ambiguousMatch));
const unknownMatch = matchCitation('https://example.com/x', registry.sources);
ok(unknownMatch.match_type === 'unknown' && unknownMatch.source === null, 'matchCitation returns unknown for a foreign host', JSON.stringify(unknownMatch));

const secretUrl = redactUrl('https://api.example.com/v1/data?token=abc123&symbol=BTC');
ok(secretUrl.redacted && secretUrl.url.includes('token=***') && !secretUrl.url.includes('abc123'), 'redactUrl masks credential-like query params', secretUrl.url);
const userInfoUrl = redactUrl('https://user:pass@example.com/x');
ok(userInfoUrl.redacted && userInfoUrl.url.includes('***@example.com') && !userInfoUrl.url.includes('pass'), 'redactUrl masks URL userinfo', userInfoUrl.url);
const cleanUrlValue = redactUrl('https://alfred.stlouisfed.org/');
ok(!cleanUrlValue.redacted && cleanUrlValue.url === 'https://alfred.stlouisfed.org/', 'redactUrl leaves clean URLs unchanged', cleanUrlValue.url);

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

const discoveredAudit = auditText(registry, { text: 'SEC filing search: https://www.sec.gov/edgar/search/' });
ok(discoveredAudit.citations[0]?.verification === 'discovered', 'audit exposes the verification state', discoveredAudit.citations[0]?.verification);
ok(
  discoveredAudit.suggestions.some((s) => s.includes('unreachable')),
  'audit suggests re-checking unreachable citations',
  JSON.stringify(discoveredAudit.suggestions),
);

const secretAudit = auditText(registry, { text: 'Data: https://api.binance.com/api/v3/ticker/24hr?api_key=secret123&symbol=BTCUSDT' });
ok(secretAudit.summary.redacted === 1, 'audit counts redacted citations', String(secretAudit.summary.redacted));
ok(
  secretAudit.citations[0]?.url_redacted === true && !JSON.stringify(secretAudit).includes('secret123'),
  'audit output never contains the credential value',
  JSON.stringify(secretAudit.citations[0]),
);
ok(secretAudit.citations[0]?.known === true, 'redaction does not break source matching', JSON.stringify(secretAudit.citations[0]));

const ambiguousAudit = auditText(registry, { text: 'Annual report: https://www.hkex.com.hk/financials/annual-report-2025.pdf' });
ok(
  ambiguousAudit.citations[0]?.match_type === 'same_host_ambiguous' && ambiguousAudit.citations[0]?.known === false,
  'audit marks same-host-only matches ambiguous',
  JSON.stringify(ambiguousAudit.citations[0]),
);
ok(ambiguousAudit.summary.ambiguous === 1, 'audit summarizes ambiguous matches', String(ambiguousAudit.summary.ambiguous));
ok(ambiguousAudit.suggestions.some((s) => s.includes('host level')), 'audit suggests pinning the exact page', JSON.stringify(ambiguousAudit.suggestions));

// ---------- prompt footprint ----------
const guidance = buildGuidance(stats);
const estTokens = (text) => Math.ceil(text.length / 4);
console.log(`\n[prompt] guidance ${guidance.length} chars (~${estTokens(guidance)} tokens at 4 chars/token), section order ${SECTION_ORDER}`);
ok(guidance.length < 1200, 'guidance stays under 1200 chars', String(guidance.length));
ok(guidance.includes('119 sources'), 'guidance states the current registry size', 'missing 119');
ok(guidance.includes('first publication time'), 'guidance requires news first-published time', 'missing news-time rule');
ok(guidance.includes('HTTP 200'), 'guidance decouples reachability from data correctness', 'missing HTTP-200 caveat');
ok(guidance.includes('not_applicable'), 'guidance explains the not_applicable PIT state', 'missing PIT state');
ok(guidance.includes('revision_risk'), 'guidance explains revision_risk', 'missing revision_risk');
ok(guidance.includes('redacts'), 'guidance mentions audit redaction', 'missing redaction');

const findChars = declarationChars(FIND_TOOL);
const auditChars = declarationChars(AUDIT_TOOL);
const totalChars = findChars + auditChars + guidance.length;
const totalTokens = Math.ceil(totalChars / 4);
console.log(`[tokens] find schema ${findChars} chars (~${Math.ceil(findChars / 4)} tokens), audit schema ${auditChars} chars (~${Math.ceil(auditChars / 4)} tokens), combined ~${totalTokens} tokens per request (schemas + guidance)`);
ok(findChars + auditChars < 2600, 'two tool schemas under 2600 chars', String(findChars + auditChars));
ok(totalTokens < 780, 'combined per-request overhead under 780 tokens', String(totalTokens));
ok(!FIND_TOOL.description.includes('verified quantitative'), 'find description no longer claims every source is verified', FIND_TOOL.description.slice(0, 80));
ok(FIND_TOOL.description.includes('verification state'), 'find description names the verification state');
ok(AUDIT_TOOL.description.includes('exact_url') && AUDIT_TOOL.description.includes('same_host_ambiguous'), 'audit description names the match confidence levels');
ok(AUDIT_TOOL.description.includes('redact'), 'audit description mentions redaction');

// ---------- probe classification & weekly diff (no network) ----------
ok(classify({ kind: 'html' }, { status: 403, contentType: 'text/html', textLen: 10 }) === 'challenge', 'classify: 403 is challenge');
ok(classify({ kind: 'html' }, { status: 429, contentType: 'text/html', textLen: 10 }) === 'challenge', 'classify: 429 is challenge');
ok(classify({ kind: 'html' }, { status: 202, contentType: 'text/html', textLen: 0 }) === 'challenge', 'classify: 202 is challenge');
ok(classify({ kind: 'api' }, { status: 200, contentType: 'application/json' }) === 'api', 'classify: JSON is api');
ok(classify({ kind: 'html' }, { status: 200, contentType: 'text/html', htmlSnippet: '', textLen: 120, linkCount: 2 }) === 'portal', 'classify: low text is portal');
ok(classify({ kind: 'html' }, { status: 200, contentType: 'text/html', htmlSnippet: '', textLen: 400, linkCount: 10 }) === 'portal', 'classify: link-heavy page is portal');
ok(classify({ kind: 'html' }, { status: 200, contentType: 'text/html', htmlSnippet: '<div id="root"></div>', textLen: 300 }) === 'js', 'classify: JS shell is js');
ok(classify({ kind: 'html' }, { status: 200, contentType: 'text/html', htmlSnippet: '<p>ok</p>', textLen: 2000 }) === 'static', 'classify: normal HTML is static');
ok(classify({ kind: 'pdf' }, { status: 200, contentType: 'application/pdf' }) === 'binary', 'classify: PDF is binary');
const failure = classifyFailure(new TypeError('fetch failed'));
ok(failure.access === null && failure.error.startsWith('TypeError:') && failure.flags.includes('error'), 'classifyFailure shapes network errors', JSON.stringify(failure));

const statusDiff = diffEntries({ a: { status: 200, access: 'static', final_url: 'x' } }, { a: { status: 403, access: 'challenge', final_url: 'x' } });
ok(statusDiff.changes.includes('a: status 200 -> 403') && statusDiff.changes.includes('a: access static -> challenge'), 'diffEntries reports status/access changes', JSON.stringify(statusDiff));
const addedDiff = diffEntries({}, { b: { status: 200, access: 'static', final_url: 'y' } });
ok(addedDiff.added.includes('b') && addedDiff.changes.some((c) => c.startsWith('b: new')), 'diffEntries reports new sources', JSON.stringify(addedDiff));
const removedDiff = diffEntries({ c: { status: 200, access: 'static', final_url: 'z' } }, {});
ok(removedDiff.removed.includes('c') && removedDiff.changes.some((c) => c.startsWith('c: no longer')), 'diffEntries reports dropped sources', JSON.stringify(removedDiff));
const quietDiff = diffEntries({ a: { status: 200, access: 'static', final_url: 'x' } }, { a: { status: 200, access: 'static', final_url: 'x' } });
ok(quietDiff.changes.length === 0, 'diffEntries reports no change for identical entries', JSON.stringify(quietDiff));

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
