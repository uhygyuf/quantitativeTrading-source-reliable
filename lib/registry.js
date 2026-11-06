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
    license_class: source.license_class,
    pit: source.pit,
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
    const hits = registry.sources.filter((s) => inDomain(s) && matchesUrl(s, url));
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
  for (const url of found.slice(0, maxCitations)) {
    const host = hostOf(url);
    const exact = registry.sources.find((s) => s.url.replace(/\/+$/, '') === url.replace(/\/+$/, ''));
    const sameHost = exact ? [] : (registry.byHost.get(host) ?? []);
    const source = exact ?? sameHost[0];
    const citation = { url, host, known: source !== undefined };
    if (source) {
      if (source.id !== undefined) citation.source_id = source.id;
      if (source.domain !== undefined) citation.domain = source.domain;
      if (source.authority !== undefined) citation.authority = source.authority;
      if (source.evidence !== undefined) citation.evidence = source.evidence;
      if (source.pit !== undefined) citation.pit = source.pit;
      if (source.content_access !== undefined) citation.content_access = source.content_access;
    }
    if (source === undefined) {
      citation.note = 'not in the registry: verify the domain yourself before relying on it';
    } else if (sameHost.length > 1) {
      citation.note = `${sameHost.length} registry sources share this host; pin the exact page when citing`;
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

  const suggestions = [];
  if (byAuthority.D > 0) suggestions.push('D-tier (blog/aggregator) citations cannot carry a factual claim; find an A/B source.');
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
      by_authority: byAuthority,
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
  for (const source of sources) {
    if (byLayer[source.layer] !== undefined) byLayer[source.layer] += 1;
    if (byAuthority[source.authority] !== undefined) byAuthority[source.authority] += 1;
    if (byDomain[source.domain] !== undefined) byDomain[source.domain] += 1;
  }
  return {
    count: sources.length,
    by_layer: byLayer,
    by_authority: byAuthority,
    by_domain: byDomain,
    categories: registry.meta.categories ?? {},
    generated_at: registry.meta.generated_at,
  };
}
