#!/usr/bin/env node
/**
 * Weekly source-health check for quantitativeTrading-source-reliable.
 *
 * - probes both matrices with tools/probe-sources.cjs --check (no write-back)
 * - diffs the result against reports/source-health-state.json (week over week)
 * - writes reports/source-health-YYYY-MM-DD.txt
 * - restores the tracked probe-report snapshots so the working tree stays clean
 *
 * Usage: node tools/weekly-health.cjs
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { diffEntries } = require('./health-diff.cjs');

const ROOT = path.join(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const STATE = path.join(REPORTS, 'source-health-state.json');
const PROBE = path.join(ROOT, 'tools', 'probe-sources.cjs');
const TRACKED_SNAPSHOTS = [
  'data/probe-report-quant-source-matrix.json',
  'data/probe-report-crypto-source-matrix.json',
];
const DOMAINS = [
  ['quant', path.join(ROOT, 'data', 'probe-report-quant-source-matrix.json')],
  ['crypto', path.join(ROOT, 'data', 'probe-report-crypto-source-matrix.json')],
];

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function restoreTrackedSnapshots() {
  try {
    execFileSync('git', ['-C', ROOT, 'checkout', '--', ...TRACKED_SNAPSHOTS], { stdio: 'ignore' });
  } catch (err) {
    console.warn(`warning: could not restore tracked probe snapshots: ${err.message}`);
  }
}

const registry = readJson(path.join(ROOT, 'data', 'sources.json'), { sources: [] });
const authority = new Map(registry.sources.map((s) => [s.id, s.authority]));
const previous = readJson(STATE, { entries: {} });
const now = {};
const snapshots = {};

function runProbe(domain) {
  execFileSync(process.execPath, [PROBE, `--file=${domain}`, '--check'], { cwd: ROOT, stdio: 'inherit' });
}

const date = today();
try {
  for (const [domain, reportFile] of DOMAINS) {
    runProbe(domain);
    const report = readJson(reportFile, null);
    if (!report) {
      console.error(`missing probe report: ${reportFile}`);
      continue;
    }
    snapshots[domain] = {
      snapshot_id: report.snapshot_id ?? null,
      started_at: report.started_at ?? null,
      completed_at: report.completed_at ?? null,
      concurrency: report.concurrency ?? null,
    };
    for (const entry of report.entries ?? []) {
      now[entry.id] = {
        domain,
        status: entry.status,
        access: entry.access,
        final_url: entry.finalUrl,
        flags: entry.flags ?? [],
        error: entry.error ?? null,
      };
    }
  }
} finally {
  restoreTrackedSnapshots();
}

const ids = Object.keys(now);
const ok = ids.filter((id) => now[id].status === 200);
const non200 = ids.filter((id) => now[id].status !== 200);
const accessCounts = {};
for (const id of ids) {
  const key = now[id].access ?? 'error';
  accessCounts[key] = (accessCounts[key] ?? 0) + 1;
}

const hasBaseline = Object.keys(previous.entries ?? {}).length > 0;
const diff = hasBaseline ? diffEntries(previous.entries, now) : { changes: [], added: [], removed: [] };
const changes = diff.changes;

const lines = [
  `# quantitativeTrading-source-reliable weekly source health — ${date}`,
  '',
  `Sources probed: ${ids.length} (quant ${ids.filter((id) => now[id].domain === 'quant').length}, crypto ${ids.filter((id) => now[id].domain === 'crypto').length})`,
  `Snapshot IDs: quant=${snapshots.quant?.snapshot_id ?? '-'}, crypto=${snapshots.crypto?.snapshot_id ?? '-'}`,
  `Batch: concurrent probe (not the matrix single-source snapshot); started ${snapshots.quant?.started_at ?? '-'} / ${snapshots.crypto?.started_at ?? '-'}`,
  `HTTP 200: ${ok.length}; non-200: ${non200.length}`,
  `access: ${Object.entries(accessCounts).map(([key, value]) => `${key}=${value}`).join(', ')}`,
  '',
];

if (!hasBaseline) {
  lines.push('Baseline created: no week-over-week diff yet.', '');
} else if (changes.length === 0) {
  lines.push('Changes since last run: none.', '');
} else {
  lines.push(`Changes since last run (${changes.length}):`);
  for (const change of changes) lines.push(`- ${change}`);
  lines.push('');
}

if (non200.length === 0) {
  lines.push('Non-200 sources: none.', '');
} else {
  lines.push(`Non-200 sources (${non200.length}):`);
  for (const id of non200) {
    const cur = now[id];
    const tier = authority.get(id) ?? '?';
    const detail = cur.error ? `error=${cur.error}` : `flags=${cur.flags.join(',') || '-'}`;
    lines.push(`- ${id} (${tier}): status=${cur.status ?? 'ERR'} access=${cur.access ?? '-'} ${detail}`);
  }
  lines.push('');
}

lines.push('This check is reachability and content-access only; it does not verify data values,');
lines.push('fees, rate limits or PIT semantics. Use qt_source_audit / qt_source_find for those.');
lines.push('');

fs.mkdirSync(REPORTS, { recursive: true });
const reportFile = path.join(REPORTS, `source-health-${date}.txt`);
fs.writeFileSync(reportFile, `${lines.join('\n')}\n`, 'utf8');

const stateFile = path.join(REPORTS, 'source-health-state.json');
fs.writeFileSync(stateFile, `${JSON.stringify({
  generated_at: date,
  snapshot_ids: {
    quant: snapshots.quant?.snapshot_id ?? null,
    crypto: snapshots.crypto?.snapshot_id ?? null,
  },
  entries: now,
}, null, 1)}\n`, 'utf8');

console.log(`[health] ${date}: ${ok.length}/${ids.length} HTTP 200, ${non200.length} non-200, ${changes.length} change(s)`);
if (non200.length) {
  const aTier = non200.filter((id) => authority.get(id) === 'A');
  console.log(`[health] non-200: ${non200.join(', ')}${aTier.length ? ` | A-tier: ${aTier.join(', ')}` : ''}`);
}
console.log(`[health] report: ${path.relative(ROOT, reportFile)}`);
console.log(`[health] state:  ${path.relative(ROOT, stateFile)}`);
