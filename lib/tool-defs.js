/**
 * Model-facing tool declarations for quantitativeTrading-source-reliable.
 * Kept separate from index.js so tests can measure the exact prompt footprint.
 */
export const FIND_TOOL = {
  name: 'qt_source_find',
  description:
    'Find curated quantitative-finance or crypto sources in a bundled registry (119 entries) by URL, keyword, or domain. '
    + 'Returns authority tier, verification state (discovered / reachable / schema_verified / semantic_verified / production_approved), '
    + 'access mode, five-state PIT, dataset tags, free-tier/auth flags and refresh interval. '
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
    'Audit URL citations in a draft answer against the quant/crypto source registry: match each URL to a source with a confidence level '
    + '(exact_url / canonical_page / api_host / same_host_ambiguous / unknown), redact credential-like URL parameters, '
    + 'report authority tier, PIT and verification state, count paragraphs with no source, and suggest fixes.',
  parameters: {
    text: { type: 'string', description: 'Draft answer text to audit; URLs are extracted from it.' },
    maxCitations: { type: 'integer', description: 'Max URLs to audit (default 20, ceiling 50).' },
  },
};

/** Exact model-facing JSON size of one tool declaration. */
export function declarationChars(tool) {
  return JSON.stringify({ name: tool.name, description: tool.description, parameters: tool.parameters }).length;
}
