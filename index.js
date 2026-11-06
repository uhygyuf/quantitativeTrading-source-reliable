/**
 * quantitativeTrading-source-reliable — Host plugin (bundle) for DeepSeek Harness.
 *
 * Ships a verified quant/crypto source registry (bidirectional probe snapshots) and
 * two model-facing tools:
 *   - qt_source_find:  locate sources by URL / keyword / domain
 *   - qt_source_audit: audit URL citations in a draft answer
 *
 * The registry is data-only and bundled; tools are pure local lookups (no network),
 * so they are fast and do not add network latency or side effects.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { loadRegistry, findSources, auditText, registryStats } from './lib/registry.js';
import { buildGuidance, SECTION_ORDER } from './lib/guidance.js';
import { FIND_TOOL, AUDIT_TOOL } from './lib/tool-defs.js';

export const name = 'quantitativeTrading-source-reliable';
export const inject = ['tools', 'systemPrompt'];

const DATA_URL = new URL('./data/sources.json', import.meta.url);

function renderFind(value) {
  if (!value?.results?.length) return 'No matching source in the registry.';
  const lines = [`${value.count} match(es); showing ${value.results.length}:`];
  for (const s of value.results) {
    const types = s.data_types ?? [];
    const shownTypes = types.length > 8 ? `${types.slice(0, 8).join('+')}+${types.length - 8}` : types.join('+');
    const flags = [
      `${s.domain}/${s.category}`,
      `${s.authority}/${s.evidence}`,
      `verify=${s.verification}`,
      `access=${s.content_access}`,
      s.pit ? `pit=${s.pit}` : undefined,
      shownTypes ? `data=${shownTypes}` : undefined,
      s.free_tier ? `free=${String(s.free_tier).slice(0, 80)}` : undefined,
      s.auth ? `auth=${s.auth}` : undefined,
      `refresh=${s.refresh_days}d`,
    ].filter(Boolean);
    lines.push(`- [${s.id}] ${s.name} — ${flags.join('; ')}; ${s.url}`);
    if (s.notes) lines.push(`  note: ${String(s.notes).slice(0, 200)}`);
  }
  return lines.join('\n');
}

function renderAudit(value) {
  const s = value.summary;
  const lines = [
    `Citations: ${s.audited}/${s.total_urls} audited, ${s.known} known, ${s.unknown} unknown; A=${s.by_authority.A} B=${s.by_authority.B} C=${s.by_authority.C} D=${s.by_authority.D}; uncited paragraphs=${s.uncited_paragraphs}.`,
  ];
  for (const c of value.citations) {
    const where = c.known
      ? `${c.source_id} (${c.domain ?? '?'}, ${c.authority}/${c.evidence}${c.pit ? `, pit=${c.pit}` : ''}${c.verification ? `, verify=${c.verification}` : ''})`
      : 'unknown';
    lines.push(`- ${c.url} -> ${where}${c.note ? `; ${c.note}` : ''}`);
  }
  if (value.suggestions.length) {
    lines.push('Suggestions:');
    for (const item of value.suggestions) lines.push(`- ${item}`);
  }
  return lines.join('\n');
}

const findTool = defineTool({
  ...FIND_TOOL,
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        count: { type: 'integer', required: true },
        results: {
          type: 'array',
          required: true,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string', required: true },
              name: { type: 'string', required: true },
              url: { type: 'string', required: true },
              domain: { type: 'string' },
              category: { type: 'string' },
              layer: { type: 'string' },
              authority: { type: 'string' },
              evidence: { type: 'string' },
              content_access: { type: 'string' },
              verification: { type: 'string' },
              license_class: { type: 'string' },
              pit: { type: 'string' },
              data_types: { type: 'array', items: { type: 'string' } },
              free_tier: { type: 'string' },
              auth: { type: 'string' },
              iface: { type: 'array', items: { type: 'string' } },
              refresh_days: { type: 'integer' },
              last_checked: { type: 'string' },
              notes: { type: 'string' },
            },
          },
        },
      },
    },
    render: (_args, value) => [{ type: 'text', text: renderFind(value) }],
  },
  timeoutMs: 5000,
  isConcurrencySafe: () => true,
  execute: async (args) => findSources(registry, args ?? {}),
});

const auditTool = defineTool({
  ...AUDIT_TOOL,
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        citations: { type: 'array', required: true, items: { type: 'object', additionalProperties: true } },
        summary: { type: 'object', required: true, additionalProperties: true },
        suggestions: { type: 'array', required: true, items: { type: 'string' } },
      },
    },
    render: (_args, value) => [{ type: 'text', text: renderAudit(value) }],
  },
  timeoutMs: 5000,
  isConcurrencySafe: () => true,
  execute: async (args) => auditText(registry, args ?? {}),
});

let registry;

export function apply(ctx) {
  registry = loadRegistry(DATA_URL);
  const stats = registryStats(registry);
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'quantitativeTrading-source-reliable:guidance',
    order: SECTION_ORDER,
    text: buildGuidance(stats),
  }));
  ctx.effect(() => ctx.tools.register(findTool));
  ctx.effect(() => ctx.tools.register(auditTool));
}
