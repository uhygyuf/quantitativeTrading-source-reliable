#!/usr/bin/env node
/**
 * Build data/sources.json from data/quant-source-matrix.yaml and
 * data/crypto-source-matrix.yaml.
 *
 * The YAML matrices are the source of truth (comments, legends, probe snapshots);
 * the plugin ships a compact lossless JSON projection.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function loadYaml() {
  for (const p of ['C:/Users/leo wang/.dsh/profiles/desktop/node_modules/yaml', 'yaml']) {
    try { return require(p); } catch { /* next */ }
  }
  throw new Error('yaml package not found (npm install)');
}
const YAML = loadYaml();

const ROOT = path.join(__dirname, '..');
const FILES = ['quant-source-matrix.yaml', 'crypto-source-matrix.yaml'];
const OUT = path.join(ROOT, 'data', 'sources.json');

const FIELDS = [
  'id', 'name', 'url', 'domain', 'category', 'layer', 'authority', 'evidence', 'kind',
  'content_access', 'license_class', 'cache_policy', 'attribution', 'refresh_days',
  'last_checked', 'keywords', 'notes', 'auth', 'iface', 'pit', 'free_tier',
  'as_reported', 'survivorship', 'history_start', 'verified_on', 'rate_limit', 'terms',
];

const PIT = new Set(['yes', 'partial', 'no']);
const DOMAINS = new Set(['quant', 'crypto']);

const sources = [];
const seenIds = new Set();
const errors = [];
const categories = {};
const domains = { quant: 0, crypto: 0 };
let generatedAt = '';

for (const file of FILES) {
  const full = path.join(ROOT, 'data', file);
  const doc = YAML.parseDocument(fs.readFileSync(full, 'utf8'));
  if (doc.errors.length) {
    errors.push(`${file}: ${doc.errors.map((e) => e.message).join('; ')}`);
    continue;
  }
  const data = doc.toJS({ maxAliasCount: -1 });
  generatedAt = generatedAt || data.meta?.generated_at || '';
  for (const src of data.sources || []) {
    const layer = data.meta?.domain;
    if (!src.domain) src.domain = layer;
    if (!DOMAINS.has(src.domain)) errors.push(`${file}:${src.id}: bad domain ${src.domain}`);
    if (!src.category) errors.push(`${file}:${src.id}: missing category`);
    else categories[src.category] = (categories[src.category] || 0) + 1;
    if (src.pit && !PIT.has(src.pit)) errors.push(`${file}:${src.id}: bad pit ${src.pit}`);
    if (!src.authority || !'ABCD'.includes(src.authority)) errors.push(`${file}:${src.id}: bad authority`);
    if (!src.url) errors.push(`${file}:${src.id}: missing url`);
    if (seenIds.has(src.id)) errors.push(`${file}:${src.id}: duplicate id`);
    seenIds.add(src.id);
    domains[src.domain] = (domains[src.domain] || 0) + 1;

    const row = {};
    for (const field of FIELDS) if (src[field] !== undefined) row[field] = src[field];
    row.ka = undefined;
    delete row.ka;
    sources.push(row);
  }
}

if (errors.length) {
  console.error('build errors:\n - ' + errors.join('\n - '));
  process.exit(1);
}

const out = {
  meta: {
    name: 'Quant/crypto source registry',
    data_version: 1,
    generated_at: generatedAt || new Date().toISOString().slice(0, 10),
    source_matrices: FILES.map((f) => `data/${f}`),
    count: sources.length,
    by_domain: domains,
    categories,
    authority_legend: {
      A: '一手事实：监管原始文件、官方统计、交易所/官方 API',
      B: '权威解释：持牌数据商、学术机构、同行评审',
      C: '可靠二手：开源聚合器 / 社区维护项目（需交叉验证）',
      D: '线索：博客、媒体、未审来源（不可当结论）',
    },
    content_access_legend: {
      static: '静态 HTML，可直接取正文',
      portal: '落地页/目录页，需跟到正文',
      js: '需要浏览器渲染（纯 fetch 拿不到正文）',
      challenge: '反爬 / 人机校验 / 鉴权墙，需浏览器或人工确认',
      api: 'JSON / XML 结构化返回',
      binary: 'PDF / 二进制',
    },
    license_class_legend: {
      'public-domain': '公有领域（美国政府作品等）',
      'site-terms': '站点条款保留，默认只链接 + 短引用',
      'open-source': '开源许可，署名要求以仓库 LICENSE 为准',
      'open-access-paper': '论文开放获取，单篇许可可能不同',
      'cc-by-sa': '署名 + 相同方式共享',
      varies: '逐条不同，需逐项核对',
      unknown: '未知，按最严格策略处理',
    },
    cache_policy_legend: {
      'metadata-only': '只存元数据与链接，不缓存正文',
      'short-quote': '可存短引用并必须署名 / 链接',
      'full-text-allowed': '可缓存全文（仍需核对具体许可）',
    },
    pit_legend: {
      yes: '提供 Point-in-Time / as-reported 版本',
      partial: '部分字段或部分数据集提供 PIT',
      no: '只给最新修订值，回测需自行处理未来函数',
    },
    license_note: 'license_class 是策略分桶，不是法律意见；绑定许可以源站条款为准。',
  },
  sources,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
console.log(`wrote ${path.relative(ROOT, OUT)}: ${sources.length} sources (quant ${domains.quant}, crypto ${domains.crypto}), ${fs.statSync(OUT).size} bytes`);
