#!/usr/bin/env node
/**
 * Pure week-over-week diff for tools/weekly-health.cjs.
 * Entries share the shape { status, access, final_url }.
 */
'use strict';

/**
 * @param {Record<string, {status?: number|null, access?: string|null, final_url?: string|null}>} previousEntries
 * @param {Record<string, {status?: number|null, access?: string|null, final_url?: string|null}>} currentEntries
 * @returns {{changes: string[], added: string[], removed: string[]}}
 */
function diffEntries(previousEntries = {}, currentEntries = {}) {
  const changes = [];
  const added = [];
  const removed = [];

  for (const id of Object.keys(currentEntries)) {
    const old = previousEntries[id];
    const current = currentEntries[id];
    if (!old) {
      added.push(id);
      changes.push(`${id}: new in registry`);
      continue;
    }
    if (old.status !== current.status) changes.push(`${id}: status ${old.status ?? 'ERR'} -> ${current.status ?? 'ERR'}`);
    if (old.access !== current.access) changes.push(`${id}: access ${old.access ?? '-'} -> ${current.access ?? '-'}`);
    if (current.final_url && old.final_url !== current.final_url) changes.push(`${id}: final_url -> ${current.final_url}`);
  }

  for (const id of Object.keys(previousEntries)) {
    if (!currentEntries[id]) {
      removed.push(id);
      changes.push(`${id}: no longer probed`);
    }
  }

  return { changes, added, removed };
}

module.exports = { diffEntries };
