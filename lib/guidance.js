/**
 * System-prompt guidance text for quantitativeTrading-source-reliable.
 * Kept separate so tests can measure its token footprint without loading DSH modules.
 */
export const SECTION_ORDER = 241; // plugin guidance band: after plugin tool sections (150-220), before PLAN_POLICY (500)

export function buildGuidance(stats) {
  return [
    '## Source reliability (quantitativeTrading-source-reliable)',
    `Bundled registry: ${stats.count} curated sources (quant ${stats.by_domain.quant}, crypto ${stats.by_domain.crypto}); each row carries authority, verification, PIT and dataset tags.`,
    'Before stating market-data, exchange-endpoint, fee, rate-limit, or point-in-time facts:',
    '1. call qt_source_find with a query, a URL, or a domain;',
    '2. prefer A (regulator/exchange/official docs) or B (institutional vendor/peer-reviewed); C is secondary, D is a lead only;',
    '3. cite "[source-id] URL" with the source\'s date/version; say "unsourced" when nothing fits; never invent fees, limits or endpoint paths;',
    '4. verification=discovered means unreachable at the last probe — re-check; reachable means HTTP 200 only, not correctness;',
    '5. pit=not_applicable means the data cannot be revised (quotes/ticks, tooling); unverified means unchecked; treat pit and free_tier as dated claims;',
    '6. cite first publication time for news/events — a page update time is not evidence;',
    '7. data_types names the datasets a source covers (orderbook_l2, funding, xbrl); prefer the dataset over a vendor home page.',
    'Call qt_source_audit on drafts that cite URLs; skip both tools outside quant finance and crypto.',
  ].join('\n');
}
