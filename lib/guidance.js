/**
 * System-prompt guidance text for quantitativeTrading-source-reliable.
 * Kept separate so tests can measure its token footprint without loading DSH modules.
 */
export const SECTION_ORDER = 241; // plugin guidance band: after plugin tool sections (150-220), before PLAN_POLICY (500)

export function buildGuidance(stats) {
  return [
    '## Source reliability (quantitativeTrading-source-reliable)',
    `Registry: ${stats.count} sources (quant ${stats.by_domain.quant}, crypto ${stats.by_domain.crypto}) with authority, verification, PIT, revision_risk and dataset tags.`,
    'Before market-data, endpoint, fee, rate-limit or PIT claims:',
    '1. call qt_source_find with a query, a URL, or a domain;',
    '2. prefer A (regulator/exchange/official docs) or B (institutional vendor/peer-reviewed); C is secondary, D is a lead only;',
    '3. cite "[source-id] URL" with the source\'s date/version; say "unsourced" when nothing fits; never invent fees, limits or endpoint paths;',
    '4. discovered = unreachable at last probe; re-check. reachable = HTTP 200 only, not correctness;',
    '5. pit=not_applicable means PIT does not fit (ticks/tooling), not that history never changes; revision_risk covers restatement; unverified = unchecked; pit/free_tier are dated claims;',
    '6. cite first publication time for news/events; page update time is not evidence;',
    '7. data_types names datasets covered (orderbook_l2, funding, xbrl); prefer the dataset over a vendor home page;',
    '8. audit redacts credential-like URLs; same-host-only matches are ambiguous.',
    'Call qt_source_audit on drafts that cite URLs; skip both tools outside quant finance and crypto.',
  ].join('\n');
}
