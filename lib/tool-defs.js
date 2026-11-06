/**
 * Model-facing tool declarations for quantitativeTrading-source-reliable.
 * Kept separate from index.js so tests can measure the exact prompt footprint.
 */
export const FIND_TOOL = {
  name: 'qt_source_find',
  description:
    'Find verified quantitative-finance or crypto sources in a bundled registry (94 entries) by URL, keyword, or domain. '
    + 'Returns authority tier, evidence type, access mode, point-in-time / free-tier / auth flags and refresh interval. '
    + 'Use before stating market-data, exchange-endpoint, fee, limit, or point-in-time facts.',
  parameters: {
    query: { type: 'string', description: 'Keywords, e.g. "binance funding rate" or "sec xbrl". Optional when url or domain is set.' },
    url: { type: 'string', description: 'A URL or page to locate in the registry (matches host and path prefix).' },
    domain: { type: 'string', enum: ['quant', 'crypto'], description: 'Restrict to equities/macro sources or exchange/crypto sources.' },
    layer: { type: 'string', enum: ['breadth', 'depth'], description: 'Primary/stable layer or fast-moving frontier layer.' },
    limit: { type: 'integer', description: 'Max results (default 5, ceiling 20).' },
  },
};

export const AUDIT_TOOL = {
  name: 'qt_source_audit',
  description:
    'Audit URL citations in a draft answer against the quant/crypto source registry: mark each URL as known/unknown, '
    + 'report its domain, authority tier and point-in-time flag, count paragraphs with no source, and suggest fixes.',
  parameters: {
    text: { type: 'string', description: 'Draft answer text to audit; URLs are extracted from it.' },
    maxCitations: { type: 'integer', description: 'Max URLs to audit (default 20, ceiling 50).' },
  },
};

/** Exact model-facing JSON size of one tool declaration. */
export function declarationChars(tool) {
  return JSON.stringify({ name: tool.name, description: tool.description, parameters: tool.parameters }).length;
}
