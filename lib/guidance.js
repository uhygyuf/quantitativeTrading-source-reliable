/**
 * System-prompt guidance text for quantitativeTrading-source-reliable.
 * Kept separate so tests can measure its token footprint without loading DSH modules.
 */
export const SECTION_ORDER = 241; // plugin guidance band: after plugin tool sections (150-220), before PLAN_POLICY (500)

export function buildGuidance(stats) {
  return [
    '## Source reliability (quantitativeTrading-source-reliable)',
    `Bundled registry: ${stats.count} verified sources — quant ${stats.by_domain.quant} (filings, macro, fundamentals, China, execution), crypto ${stats.by_domain.crypto} (exchanges, derivatives, on-chain, archives).`,
    'Before stating market-data, exchange-endpoint, fee, rate-limit, or point-in-time facts:',
    '1. call qt_source_find with a query, a URL, or a domain;',
    '2. prefer A (regulator/exchange/official docs) or B (institutional vendor/peer-reviewed); C is secondary, D is a lead only;',
    '3. cite "[source-id] URL" with the date or version the source states; say "unsourced" when nothing fits, and never invent fees, limits, or endpoint paths;',
    '4. treat pit and free_tier as dated claims, not permanent facts.',
    'Call qt_source_audit on any draft that cites URLs. Skip both tools outside quant finance and crypto.',
  ].join('\n');
}
