/**
 * Pure registry logic for quantitativeTrading-source-reliable.
 * No DSH imports: tests and benchmark scripts can load this module directly.
 */
import { readFileSync } from 'node:fs';

const WORD_SPLIT = /[^\p{L}\p{N}+#.-]+/u;
export const DOMAINS = ['quant', 'crypto'];

/** Lowercase hostname without a leading www. */
export function hostOf(text) {
  try {
    return new URL(text).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/** Trim trailing punctuation (ASCII + full-width CJK) from a URL found inside prose. */
export function cleanUrl(raw) {
  return raw.replace(/[\s.,;:!?)\]}>'"“”‘’，。；：！？、）】》」』]+$/u, '');
}

const NORMALIZED_URLS = new Map();

/** Canonical URL used for matching: no fragment, no trailing slash, lowercase host. */
export function normalizeUrl(raw) {
  const text = String(raw ?? '').trim();
  if (NORMALIZED_URLS.has(text)) return NORMALIZED_URLS.get(text);
  let normalized = null;
  try {
    const url = new URL(text);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    const path = url.pathname.replace(/\/+$/, '') || '/';
    normalized = `${url.protocol}//${url.host}${path}${url.search}`;
  } catch {
    normalized = null;
  }
  NORMALIZED_URLS.set(text, normalized);
  return normalized;
}

const SENSITIVE_PARAMS = new Set([
  'api_key', 'apikey', 'key', 'token', 'access_token', 'secret', 'signature', 'sig',
  'auth', 'password', 'pass', 'session', 'sessionid',
]);

/** Redact credential-like URL parts for display; matching still uses the raw URL. */
export function redactUrl(raw) {
  const text = String(raw ?? '');
  let redacted = false;
  try {
    const url = new URL(text);
    if (url.username || url.password) {
      url.username = '***';
      url.password = '';
      redacted = true;
    }
    for (const [key, value] of [...url.searchParams]) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase()) && value !== '***') {
        url.searchParams.set(key, '***');
        redacted = true;
      }
    }
    return { url: redacted ? url.toString() : text, redacted };
  } catch {
    return { url: text, redacted: false };
  }
}

function pathOf(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
}

/** A path is a parent of another only when it is not the bare root. */
function underPath(child, parent) {
  if (parent === '/') return false;
  return child === parent || child.startsWith(`${parent}/`);
}

/**
 * Match one citation URL against the registry with an explicit confidence.
 * Only exact_url / canonical_page matches count as known.
 */
export function matchCitation(raw, sources) {
  const target = normalizeUrl(raw);
  if (!target) return { match_type: 'unknown', confidence: 'none', source: null, candidates: [] };
  const targetUrl = new URL(target);
  const host = targetUrl.hostname.replace(/^www\./, '');
  const targetPath = pathOf(target);

  const exact = sources.find((source) => normalizeUrl(source.url) === target);
  if (exact) return { match_type: 'exact_url', confidence: 'high', source: exact, candidates: [] };

  const sameHost = [];
  const related = [];
  for (const source of sources) {
    const normalized = normalizeUrl(source.url);
    if (!normalized) continue;
    const sourceUrl = new URL(normalized);
    if (sourceUrl.hostname.replace(/^www\./, '') !== host) continue;
    sameHost.push(source);
    const sourcePath = pathOf(normalized);
    if (sourcePath && targetPath && (underPath(targetPath, sourcePath) || underPath(sourcePath, targetPath))) {
      related.push(source);
    }
  }

  const candidateIds = (list) => list.slice(0, 5).map((source) => source.id);
  if (related.length === 1) {
    return {
      match_type: 'canonical_page',
      confidence: 'medium',
      source: related[0],
      candidates: sameHost.length > 1 ? candidateIds(sameHost) : [],
    };
  }
  const exactPath = related.filter((source) => pathOf(normalizeUrl(source.url)) === targetPath);
  if (exactPath.length === 1) {
    return { match_type: 'canonical_page', confidence: 'medium', source: exactPath[0], candidates: candidateIds(sameHost) };
  }
  if (sameHost.length > 0) {
    return {
      match_type: 'same_host_ambiguous',
      confidence: 'low',
      source: null,
      candidates: candidateIds(exactPath.length > 1 ? exactPath : sameHost),
    };
  }
  return { match_type: 'unknown', confidence: 'none', source: null, candidates: [] };
}

/** Load a registry JSON document into lookup structures. */
export function loadRegistry(fileUrl) {
  const data = JSON.parse(readFileSync(fileUrl, 'utf8'));
  const sources = data.sources ?? [];
  const byId = new Map();
  const byHost = new Map();
  for (const source of sources) {
    byId.set(source.id, source);
    const host = hostOf(source.url);
    if (!host) continue;
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(source);
  }
  return { meta: data.meta ?? {}, sources, byId, byHost };
}

/** Compact public projection. Undefined fields are omitted so the value is lossless JSON. */
export function project(source) {
  const row = {
    id: source.id,
    name: source.name,
    url: source.url,
    domain: source.domain,
    category: source.category,
    layer: source.layer,
    authority: source.authority,
    evidence: source.evidence,
    content_access: source.content_access,
    verification: source.verification,
    license_class: source.license_class,
    pit: source.pit,
    revision_risk: source.revision_risk,
    data_types: source.data_types,
    redistribution: source.redistribution,
    rate_limit: source.rate_limit,
    license_url: source.license_url,
    freshness_sla: source.freshness_sla,
    fallback_id: source.fallback_id,
    free_tier: source.free_tier,
    auth: source.auth,
    iface: source.iface,
    refresh_days: source.refresh_days,
    last_checked: source.last_checked,
    notes: source.notes,
  };
  for (const key of Object.keys(row)) if (row[key] === undefined) delete row[key];
  return row;
}

function matchesUrl(source, url) {
  if (!url) return false;
  const target = url.trim();
  if (source.url === target) return true;
  const a = source.url.replace(/\/+$/, '');
  const b = target.replace(/\/+$/, '');
  if (a === b) return true;
  if (b.startsWith(a + '/')) return true;
  if (a.startsWith(b + '/')) return true;
  return hostOf(source.url) !== undefined && hostOf(source.url) === hostOf(target);
}

function tokens(text) {
  return String(text ?? '')
    .toLowerCase()
    .split(WORD_SPLIT)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

const AUTHORITY_RANK = { A: 0, B: 1, C: 2, D: 3 };

/**
 * Find registry sources.
 * @param {ReturnType<typeof loadRegistry>} registry
 * @param {{query?: string, url?: string, domain?: string, layer?: 'breadth'|'depth', limit?: number}} args
 */
export function findSources(registry, args = {}) {
  const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20);
  const domain = args.domain ? String(args.domain).toLowerCase() : undefined;
  const layer = args.layer;
  if (domain && !DOMAINS.includes(domain)) {
    throw new Error(`unknown domain "${domain}"; use quant or crypto.`);
  }

  const inDomain = (source) => !domain || source.domain === domain;

  if (args.url) {
    const url = String(args.url).trim();
    const base = (value) => value.replace(/\/+$/, '');
    const target = base(url);
    // Rank an exact page / deeper path above other pages on the same host, so a
    // cited endpoint resolves to the source that actually documents it.
    const hits = registry.sources
      .filter((s) => inDomain(s) && matchesUrl(s, url))
      .map((s) => {
        const own = base(s.url);
        let rank = 3;
        if (own === target) rank = 0;
        else if (target.startsWith(`${own}/`)) rank = 1;
        else if (own.startsWith(`${target}/`)) rank = 2;
        return { s, rank };
      })
      .sort((a, b) => a.rank - b.rank || a.s.id.localeCompare(b.s.id))
      .map((entry) => entry.s);
    return { count: hits.length, results: hits.slice(0, limit).map(project) };
  }

  const query = String(args.query ?? '').trim();
  if (!query && !domain) {
    throw new Error('qt_source_find needs a query, a url, or a domain (quant | crypto).');
  }
  const wanted = tokens(query);

  // Domain-only lookup: representative sources, primary tiers first.
  if (wanted.length === 0) {
    const hits = registry.sources
      .filter((s) => inDomain(s) && (!layer || s.layer === layer))
      .sort((a, b) => (AUTHORITY_RANK[a.authority] ?? 9) - (AUTHORITY_RANK[b.authority] ?? 9));
    return { count: hits.length, results: hits.slice(0, limit).map(project) };
  }

  // IDF-ish weighting: rare query tokens matter more than generic ones.
  const total = registry.sources.length;
  const documentFrequency = new Map();
  for (const token of wanted) {
    let count = 0;
    for (const source of registry.sources) {
      const haystack = `${source.id} ${source.name ?? ''} ${source.notes ?? ''} ${(source.keywords ?? []).join(' ')} ${source.category ?? ''} ${source.domain ?? ''}`.toLowerCase();
      if (haystack.includes(token)) count += 1;
    }
    documentFrequency.set(token, count);
  }
  const tokenWeight = (token) => {
    const df = documentFrequency.get(token) ?? 0;
    if (df === 0) return 0;
    return Math.log((total + 1) / df) + 1;
  };

  const scored = [];
  for (const source of registry.sources) {
    if (!inDomain(source)) continue;
    if (layer && source.layer !== layer) continue;
    let score = 0;
    const id = source.id.toLowerCase();
    const name = String(source.name ?? '').toLowerCase();
    const notes = String(source.notes ?? '').toLowerCase();
    const keywordText = (source.keywords ?? []).join(' ').toLowerCase();
    const matched = new Set();
    for (const token of wanted) {
      const w = tokenWeight(token);
      if (w === 0) continue;
      const subject = token === wanted[0];
      const boost = subject ? 2.5 : 1;
      let hit = false;
      if (id === token) { score += 12 * w * boost; hit = true; }
      else if (id.includes(token)) { score += 6 * w * boost; hit = true; }
      if (name.includes(token)) { score += 4 * w * boost; hit = true; }
      if (notes.includes(token)) { score += 1 * w * boost; hit = true; }
      if (keywordText.includes(token)) { score += 2 * w * boost; hit = true; }
      if ((source.category ?? '').toLowerCase() === token) { score += 3 * w * boost; hit = true; }
      if ((source.domain ?? '').toLowerCase() === token) { score += 3 * w * boost; hit = true; }
      if (hit) matched.add(token);
    }
    if (score > 0) {
      const subjectMatched = matched.has(wanted[0]);
      if (!subjectMatched) score *= 0.25;
      else if (wanted.length >= 2 && matched.size === 1) score *= 0.6;
      if (matched.size > 1) score *= 1 + 0.25 * (matched.size - 1);
    }
    if (score > 0) scored.push([score, source]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].id.localeCompare(b[1].id));
  return { count: scored.length, results: scored.slice(0, limit).map(([, s]) => project(s)) };
}

// Stop at whitespace, ASCII/typographic quotes, and full-width CJK punctuation so
// "(https://x/）。" and "https://x/，2026-11-06" keep only the URL itself.
const URL_RE = /\bhttps?:\/\/[^\s<>"'`“”‘’，。；：！？、）】》」』]+/giu;

/**
 * Audit citations in a draft answer.
 * @param {ReturnType<typeof loadRegistry>} registry
 * @param {{text?: string, maxCitations?: number}} args
 */
export function auditText(registry, args = {}) {
  const text = String(args.text ?? '');
  const maxCitations = Math.min(Math.max(Number(args.maxCitations) || 20, 1), 50);
  const found = [];
  const seen = new Set();
  for (const match of text.matchAll(URL_RE)) {
    const url = cleanUrl(match[0]);
    if (seen.has(url)) continue;
    seen.add(url);
    found.push(url);
  }

  const citations = [];
  let redactedCount = 0;
  for (const rawUrl of found.slice(0, maxCitations)) {
    const host = hostOf(rawUrl);
    const { url: safeUrl, redacted } = redactUrl(rawUrl);
    if (redacted) redactedCount += 1;
    const match = matchCitation(rawUrl, registry.sources);
    const source = match.source;
    const citation = {
      url: safeUrl,
      host,
      known: source !== null,
      match_type: match.match_type,
      confidence: match.confidence,
    };
    if (redacted) citation.url_redacted = true;
    if (match.candidates.length) citation.candidates = match.candidates;
    if (source) {
      if (source.id !== undefined) citation.source_id = source.id;
      if (source.domain !== undefined) citation.domain = source.domain;
      if (source.authority !== undefined) citation.authority = source.authority;
      if (source.evidence !== undefined) citation.evidence = source.evidence;
      if (source.pit !== undefined) citation.pit = source.pit;
      if (source.revision_risk !== undefined) citation.revision_risk = source.revision_risk;
      if (source.content_access !== undefined) citation.content_access = source.content_access;
      if (source.verification !== undefined) citation.verification = source.verification;
      if (source.data_types !== undefined) citation.data_types = source.data_types;
      if (source.redistribution !== undefined) citation.redistribution = source.redistribution;
    }
    if (match.match_type === 'same_host_ambiguous') {
      const candidates = match.candidates.length ? ` (candidates: ${match.candidates.join(', ')})` : '';
      citation.note = `same host but no path match: pin the exact page${candidates}`;
    } else if (!source) {
      citation.note = 'not in the registry: verify the domain yourself before relying on it';
    } else if (source.verification === 'discovered') {
      citation.note = 'not reachable from this network at the last probe; re-check the page before citing';
    } else if (match.candidates.length > 1) {
      citation.note = `${match.candidates.length} registry sources share this host; pin the exact page when citing`;
    }
    citations.push(citation);
  }

  const paragraphs = text.split(/\n\s*\n/u);
  let uncitedParagraphs = 0;
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (trimmed.length < 80) continue;
    if (!URL_RE.test(trimmed) && !/\[[a-z0-9-]+\]/iu.test(trimmed)) uncitedParagraphs += 1;
    URL_RE.lastIndex = 0;
  }

  const byAuthority = { A: 0, B: 0, C: 0, D: 0, unknown: 0 };
  for (const c of citations) {
    if (c.authority && byAuthority[c.authority] !== undefined) byAuthority[c.authority] += 1;
    else byAuthority.unknown += 1;
  }

  const byVerification = {};
  for (const c of citations) {
    if (c.verification) byVerification[c.verification] = (byVerification[c.verification] ?? 0) + 1;
  }
  const byMatchType = {};
  for (const c of citations) byMatchType[c.match_type] = (byMatchType[c.match_type] ?? 0) + 1;
  const discovered = citations.filter((c) => c.verification === 'discovered').length;

  const suggestions = [];
  if (byAuthority.D > 0) suggestions.push('D-tier (blog/aggregator) citations cannot carry a factual claim; find an A/B source.');
  if (byMatchType.same_host_ambiguous > 0) suggestions.push(`${byMatchType.same_host_ambiguous} citation(s) matched only at the host level; pin the exact page or treat them as unsourced.`);
  if (redactedCount > 0) suggestions.push(`${redactedCount} citation URL(s) contained credential-like parameters; values were redacted in this report.`);
  if (discovered > 0) suggestions.push(`${discovered} citation(s) point to sources that were unreachable at the last probe; re-check them before relying on the data.`);
  if (byAuthority.unknown > 0) suggestions.push('Some citations are not in the registry; confirm they are first-party or institutional before using them.');
  if (uncitedParagraphs > 0) suggestions.push(`${uncitedParagraphs} substantive paragraph(s) have no source link.`);
  if (found.length > citations.length) suggestions.push(`Only the first ${citations.length} of ${found.length} citations were audited.`);
  if (citations.length === 0) suggestions.push('No URLs were found; cite sources as "https://..." (optionally [source-id]).');

  return {
    citations,
    summary: {
      total_urls: found.length,
      audited: citations.length,
      known: citations.filter((c) => c.known).length,
      unknown: citations.filter((c) => !c.known).length,
      ambiguous: byMatchType.same_host_ambiguous ?? 0,
      redacted: redactedCount,
      by_authority: byAuthority,
      by_verification: byVerification,
      by_match_type: byMatchType,
      uncited_paragraphs: uncitedParagraphs,
    },
    suggestions,
  };
}

/** Registry summary used by guidance and tests. */
export function registryStats(registry) {
  const sources = registry.sources;
  const byLayer = { breadth: 0, depth: 0 };
  const byAuthority = { A: 0, B: 0, C: 0, D: 0 };
  const byDomain = { quant: 0, crypto: 0 };
  const byPit = {};
  const byVerification = {};
  const byRevisionRisk = {};
  for (const source of sources) {
    if (byLayer[source.layer] !== undefined) byLayer[source.layer] += 1;
    if (byAuthority[source.authority] !== undefined) byAuthority[source.authority] += 1;
    if (byDomain[source.domain] !== undefined) byDomain[source.domain] += 1;
    if (source.pit) byPit[source.pit] = (byPit[source.pit] ?? 0) + 1;
    if (source.verification) byVerification[source.verification] = (byVerification[source.verification] ?? 0) + 1;
    if (source.revision_risk) byRevisionRisk[source.revision_risk] = (byRevisionRisk[source.revision_risk] ?? 0) + 1;
  }
  return {
    count: sources.length,
    by_layer: byLayer,
    by_authority: byAuthority,
    by_domain: byDomain,
    by_pit: byPit,
    by_verification: byVerification,
    by_revision_risk: byRevisionRisk,
    categories: registry.meta.categories ?? {},
    generated_at: registry.meta.generated_at,
  };
}
