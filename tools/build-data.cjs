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

// Human-verified curation layer applied on top of the probe-time matrices.
const ENRICH_FILE = path.join(ROOT, 'data', 'enrichment.yaml');
const ENRICH = YAML.parse(fs.readFileSync(ENRICH_FILE, 'utf8')) ?? {};
const PIT_OVERRIDES = ENRICH.pit ?? {};
const VERIFICATION_OVERRIDES = ENRICH.verification ?? {};
const DATA_TYPE_OVERRIDES = ENRICH.data_types ?? {};
const REVISION_OVERRIDES = ENRICH.revision_risk ?? {};
const RATE_LIMIT_OVERRIDES = ENRICH.rate_limit ?? {};
const LICENSE_URL_OVERRIDES = ENRICH.license_url ?? {};
const REDISTRIBUTION_OVERRIDES = ENRICH.redistribution ?? {};
const FRESHNESS_OVERRIDES = ENRICH.freshness_sla ?? {};
const FALLBACK_OVERRIDES = ENRICH.fallback_id ?? {};
const API_HOST_OVERRIDES = ENRICH.api_hosts ?? {};
const OVERRIDE_IDS = new Set([
  ...Object.keys(PIT_OVERRIDES),
  ...Object.keys(VERIFICATION_OVERRIDES),
  ...Object.keys(DATA_TYPE_OVERRIDES),
  ...Object.keys(REVISION_OVERRIDES),
  ...Object.keys(RATE_LIMIT_OVERRIDES),
  ...Object.keys(LICENSE_URL_OVERRIDES),
  ...Object.keys(REDISTRIBUTION_OVERRIDES),
  ...Object.keys(FRESHNESS_OVERRIDES),
  ...Object.keys(FALLBACK_OVERRIDES),
  ...Object.keys(API_HOST_OVERRIDES),
]);

// Controlled vocabulary for source.data_types.
const DATASETS_FILE = path.join(ROOT, 'data', 'datasets.yaml');
const DATASETS = YAML.parse(fs.readFileSync(DATASETS_FILE, 'utf8')) ?? {};
const DATASET_TAGS = new Set(Object.keys(DATASETS.tags ?? {}));
if (DATASET_TAGS.size === 0) throw new Error('data/datasets.yaml has no tags');

const FIELDS = [
  'id', 'name', 'url', 'domain', 'category', 'layer', 'authority', 'evidence', 'kind',
  'content_access', 'verification', 'license_class', 'cache_policy', 'attribution',
  'refresh_days', 'last_checked', 'keywords', 'notes', 'auth', 'iface', 'pit',
  'revision_risk', 'data_types', 'api_hosts', 'redistribution', 'rate_limit', 'license_url',
  'freshness_sla', 'fallback_id', 'free_tier', 'as_reported', 'survivorship',
  'history_start', 'verified_on', 'terms',
];

const PIT = new Set(['yes', 'partial', 'no', 'not_applicable', 'unverified']);
const VERIFICATION = new Set([
  'discovered', 'reachable', 'schema_verified', 'semantic_verified', 'production_approved',
]);
const REVISION_RISK = new Set(['none', 'rare', 'possible', 'routine', 'unknown']);
const REDISTRIBUTION = new Set(['allowed', 'restricted', 'prohibited', 'unknown']);

// Default revision risk by category; enrichment can override per source.
const REVISION_DEFAULT = {
  exchange: 'none',
  archive: 'none',
  sdk: 'none',
  derivatives: 'none',
  execution: 'none',
  research: 'none',
  onchain: 'rare',
  'market-data': 'possible',
  aggregator: 'possible',
  news: 'possible',
  china: 'possible',
  macro: 'routine',
  fundamentals: 'routine',
  filing: 'routine',
};

// Redistribution is a policy default derived from license_class, not legal advice.
const REDISTRIBUTION_DEFAULT = {
  'public-domain': 'allowed',
  'open-source': 'allowed',
  'site-terms': 'restricted',
  'open-access-paper': 'restricted',
  'cc-by-sa': 'allowed',
  varies: 'unknown',
  unknown: 'unknown',
};
// The probe could not read these from this network; they are citations only.
const UNREACHABLE_ACCESS = new Set(['challenge', 'unknown']);
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
    if (PIT_OVERRIDES[src.id] !== undefined) src.pit = PIT_OVERRIDES[src.id];
    if (src.pit && !PIT.has(src.pit)) errors.push(`${file}:${src.id}: bad pit ${src.pit}`);
    if (!src.authority || !'ABCD'.includes(src.authority)) errors.push(`${file}:${src.id}: bad authority`);
    if (!src.url) errors.push(`${file}:${src.id}: missing url`);
    if (seenIds.has(src.id)) errors.push(`${file}:${src.id}: duplicate id`);
    seenIds.add(src.id);
    src.verification = VERIFICATION_OVERRIDES[src.id]
      ?? (UNREACHABLE_ACCESS.has(src.content_access) ? 'discovered' : 'reachable');
    if (!VERIFICATION.has(src.verification)) errors.push(`${file}:${src.id}: bad verification ${src.verification}`);
    src.data_types = DATA_TYPE_OVERRIDES[src.id] ?? [];
    if (!Array.isArray(src.data_types) || src.data_types.some((t) => typeof t !== 'string' || !t)) {
      errors.push(`${file}:${src.id}: data_types must be an array of non-empty strings`);
    }
    for (const tag of src.data_types) {
      if (!DATASET_TAGS.has(tag)) errors.push(`${file}:${src.id}: unknown data_types tag "${tag}" (add it to data/datasets.yaml)`);
    }
    src.revision_risk = REVISION_OVERRIDES[src.id] ?? REVISION_DEFAULT[src.category] ?? 'unknown';
    if (!REVISION_RISK.has(src.revision_risk)) errors.push(`${file}:${src.id}: bad revision_risk ${src.revision_risk}`);
    src.redistribution = REDISTRIBUTION_OVERRIDES[src.id] ?? REDISTRIBUTION_DEFAULT[src.license_class] ?? 'unknown';
    if (!REDISTRIBUTION.has(src.redistribution)) errors.push(`${file}:${src.id}: bad redistribution ${src.redistribution}`);
    if (RATE_LIMIT_OVERRIDES[src.id] !== undefined) {
      const value = RATE_LIMIT_OVERRIDES[src.id];
      if (typeof value !== 'string' || value.length === 0 || value.length > 120) {
        errors.push(`${file}:${src.id}: rate_limit must be a 1-120 char string`);
      } else {
        src.rate_limit = value;
      }
    }
    if (LICENSE_URL_OVERRIDES[src.id] !== undefined) {
      const value = String(LICENSE_URL_OVERRIDES[src.id]);
      if (!/^https:\/\//.test(value)) errors.push(`${file}:${src.id}: license_url must start with https://`);
      else src.license_url = value;
    }
    if (FRESHNESS_OVERRIDES[src.id] !== undefined) {
      const value = FRESHNESS_OVERRIDES[src.id];
      if (typeof value !== 'string' || value.length === 0 || value.length > 80) {
        errors.push(`${file}:${src.id}: freshness_sla must be a 1-80 char string`);
      } else {
        src.freshness_sla = value;
      }
    }
    if (FALLBACK_OVERRIDES[src.id] !== undefined) src.fallback_id = String(FALLBACK_OVERRIDES[src.id]);
    if (API_HOST_OVERRIDES[src.id] !== undefined) {
      const hosts = API_HOST_OVERRIDES[src.id];
      const list = Array.isArray(hosts) ? hosts : [hosts];
      const cleaned = list.map((host) => String(host).trim().toLowerCase());
      const invalid = cleaned.filter((host) => !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(host));
      if (invalid.length) errors.push(`${file}:${src.id}: invalid api_hosts ${invalid.join(', ')}`);
      else if (new Set(cleaned).size !== cleaned.length) errors.push(`${file}:${src.id}: duplicate api_hosts`);
      else src.api_hosts = cleaned;
    }
    domains[src.domain] = (domains[src.domain] || 0) + 1;

    const row = {};
    for (const field of FIELDS) if (src[field] !== undefined) row[field] = src[field];
    row.ka = undefined;
    delete row.ka;
    sources.push(row);
  }
}

for (const id of OVERRIDE_IDS) {
  if (!seenIds.has(id)) errors.push(`enrichment.yaml: unknown source id ${id}`);
}

for (const row of sources) {
  if (!row.fallback_id) continue;
  if (row.fallback_id === row.id) errors.push(`data:${row.id}: fallback_id points to itself`);
  else if (!seenIds.has(row.fallback_id)) errors.push(`data:${row.id}: fallback_id "${row.fallback_id}" is not in the registry`);
}

if (errors.length) {
  console.error('build errors:\n - ' + errors.join('\n - '));
  process.exit(1);
}

const out = {
  meta: {
    name: 'Quant/crypto source registry',
    data_version: 2,
    generated_at: generatedAt || new Date().toISOString().slice(0, 10),
    build: {
      built_at: new Date().toISOString(),
      source_count: sources.length,
      matrices: FILES.map((f) => `data/${f}`),
      enrichment: 'data/enrichment.yaml',
      enrichment_version: ENRICH.meta?.version ?? 1,
      datasets: 'data/datasets.yaml',
      datasets_version: DATASETS.meta?.version ?? 1,
    },
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
      not_applicable: 'PIT 不是这个源合适的控制手段（原始逐笔/快照/工具/沙盒），不代表历史值永不修订',
      unverified: '尚未核实，不能假设有或没有 PIT',
    },
    verification_legend: {
      discovered: '已登记但本网络不可达（403/429/202/challenge 或不可解析），只能当引用线索',
      reachable: '仅 HTTP 200 可达；没有检查返回内容',
      schema_verified: '实际抓取过返回内容，结构与文档一致',
      semantic_verified: '核对过具体口径（费率、限频、端点、PIT、更名等）',
      production_approved: '在真实任务里端到端用过',
    },
    revision_risk_legend: {
      none: '官方原始归档/逐笔/交易记录，未观察到重建',
      rare: '链上数据（重组、回填少）',
      possible: '行情聚合器、供应商重建历史、新闻更正',
      routine: '宏观/基本面等经常修订的数据',
      unknown: '未核实',
    },
    redistribution_legend: {
      allowed: 'license_class 为公有领域/开源，默认允许再分发（仍需核对具体条款）',
      restricted: '站点条款保留，默认只链接 + 短引用',
      prohibited: '明确禁止再分发',
      unknown: '未核实，按最严格策略处理',
    },
    data_types_note: 'data_types 是数据集级标签（如 orderbook_l2、funding、xbrl），来自受控词表 data/datasets.yaml；未知标签会让构建失败。',
    license_note: 'license_class / redistribution 是策略分桶，不是法律意见；绑定许可以源站条款为准。',
  },
  sources,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
console.log(`wrote ${path.relative(ROOT, OUT)}: ${sources.length} sources (quant ${domains.quant}, crypto ${domains.crypto}), ${fs.statSync(OUT).size} bytes`);
