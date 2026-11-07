#!/usr/bin/env node
/**
 * Pure classification helpers for tools/probe-sources.cjs.
 * Extracted so tests can exercise failure modes without network access.
 */
'use strict';

const JS_MARKERS = [
  '<div id="root"', 'id="root"', '__NEXT_DATA__', '__NUXT__', 'window.__INITIAL_STATE__',
  'requires JavaScript', 'enable JavaScript', 'data-reactroot', 'ng-version',
  'Please turn on JavaScript', 'JavaScript must be enabled', 'Enabling JavaScript',
];

/**
 * Classify one probe response.
 * @param {{kind?: string}} src
 * @param {{status?: number|null, contentType?: string, htmlSnippet?: string, textLen?: number|null, linkCount?: number|null}} res
 * @returns {'challenge'|'api'|'binary'|'js'|'portal'|'redirect'|'frameset'|'static'}
 */
function classify(src, res) {
  if (['api', 'rss', 'atom', 'xml', 'dataset'].includes(src.kind)) {
    // A 403/429 on an API endpoint is a challenge or an auth wall, not a data response.
    if ([401, 403, 429, 503, 202].includes(res.status)) return 'challenge';
    return 'api';
  }
  if (src.kind === 'pdf') return 'binary';
  if ([401, 403, 429, 503, 202].includes(res.status)) return 'challenge';
  const contentType = (res.contentType || '').toLowerCase();
  if (contentType.includes('json')) return 'api';
  if (contentType.includes('html') || contentType.includes('xhtml')) {
    const html = res.htmlSnippet || '';
    const head = html.slice(0, 5000);
    if (/http-equiv\s*=\s*["']?refresh/i.test(head) && /url\s*=/i.test(head)) return 'redirect';
    if (/<frameset/i.test(head)) return 'frameset';
    const hasJsMarkers = JS_MARKERS.some((marker) => html.includes(marker));
    if (hasJsMarkers && (res.textLen ?? 0) < 1200) return 'js';
    if (res.textLen < 250) return 'portal';
    if (res.textLen < 900 && (res.linkCount || 0) >= 8) return 'portal';
    return 'static';
  }
  if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) return 'api';
  if (contentType.includes('text/')) return 'static';
  return 'binary';
}

/** Shape a fetch/DNS/TLS failure like a probe result. */
function classifyFailure(err) {
  const message = err && err.name ? `${err.name}: ${err.message}` : String(err);
  return { access: null, error: message, flags: ['error'] };
}

module.exports = { classify, classifyFailure, JS_MARKERS };
