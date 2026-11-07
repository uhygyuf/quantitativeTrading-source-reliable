# quantitativeTrading-source-reliable

English · [简体中文](README.zh.md)

Source reliability for quantitative finance and crypto trading in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): a bundled registry of **119 curated, agent-collectable sources** with authority tiers, verification states, five-state point-in-time flags, revision-risk and per-source dataset tags, plus two model-facing tools to find sources and audit citations with match confidence and credential redaction.

A plugin for DeepSeek Harness (`dsh`). The registry ships as data; both tools are local lookups (no network calls), so they are fast and have no side effects. It is independent from [`cs-source-reliable`](https://github.com/uhygyuf/cs-source-reliable) and can be installed on its own.

## What it ships

- **119 sources** — 73 `quant` (filings, macro, fundamentals, China A-share/HK, execution, global official statistics) and 46 `crypto` (exchanges, derivatives, on-chain, archives, SDKs, news, ETF flows).
- Per source: domain, category, authority tier (`A` regulator/exchange/official docs, `B` institutional vendor/peer-reviewed, `C` curated secondary, `D` lead only), evidence type, `content_access`, `verification` (`discovered` / `reachable` / `schema_verified` / `semantic_verified` / `production_approved`), `license_class`, `cache_policy`, `attribution`, `refresh_days`, `last_checked`, `pit` (`yes` / `partial` / `no` / `not_applicable` / `unverified`), `revision_risk` (`none` / `rare` / `possible` / `routine` / `unknown`), `data_types` (dataset tags), `redistribution` (`allowed` / `restricted` / `prohibited` / `unknown`), and where verified `rate_limit`, `license_url`, `freshness_sla`, `fallback_id`, plus `free_tier`, `auth`, `iface`, `history_start`.
- `data_types` is a controlled vocabulary (`data/datasets.yaml`, 87 tags); `tools/build-data.cjs` rejects unknown tags, bad ids, bad enums and dangling `fallback_id`.
- `api_hosts` maps real API endpoint hosts to the source that documents them (22 sources, e.g. `fapi.binance.com` → `binance-futures-api`), so a genuine API URL is attributed even when the docs live on another host.
- A curation layer (`data/enrichment.yaml`, version 2) records what was verified after the probe — PIT corrections, verification states, revision-risk overrides, optional attributes and per-source dataset tags.
- `sources.json` carries `meta.data_version: 2` and `meta.build` (built_at, source_count, matrix/enrichment/dataset versions).
- **Two tools**: `qt_source_find` and `qt_source_audit`.
- A short system-prompt section (order 241) that tells the model when to use them and how to cite.

## It exists because the common advice is subtly wrong

Everything below was checked against the official page or API on **2026-11-06**; the probe snapshot is stored per source in the YAML matrices.

| Common claim | What the registry records instead |
|---|---|
| "Massive (formerly Polygon.io)" | True — `polygon.io` redirects to `massive.com`; personal pricing showed `$199/mo`. |
| "Alpha Vantage free tier is fine for a prototype" | Free tier is **25 requests/day**; premium starts at **$49.99/mo**. Useless for an agent loop. |
| "Alpaca data is free to start" | Free tier API data is **15-minute delayed**; real-time SIP requires **Algo Trader Plus $99/mo**. |
| "Twelve Data free tier" | **8 credits/min, 800/day**; Grow is **$79/mo**. |
| "Tiingo is about $30/month" | **Unverified** — the pricing page is client-rendered. The registry marks `free_tier: unverified` rather than repeating a number. |
| "Use FRED for macro backtests" | FRED serves **revised** series. Point-in-time macro needs **ALFRED** vintages. |
| "Get Sharadar through Nasdaq Data Link" | Sharadar now documents a **direct API** at `api.sharadar.com` and says not to call `data.nasdaq.com` with its key. |
| "FMP is a reliable structured source" | Its docs host returns **403 to non-browser clients**; it also serves latest revised values, not as-reported. |
| "Financial Datasets / Equibles are point-in-time" | They are real services, but they serve **latest revised** values unless documented otherwise. |
| "Massive supports MCP" | **No official MCP**; only community packages. Official MCP exists for Alpaca, Alpha Vantage, CoinGecko, Binance and Financial Datasets. |
| "Binance futures WebSocket is `/public` or `/market`" | Those paths do not exist. Public market streams: `wss://fstream.binance.com/ws/<stream>` or `/stream?streams=`; user data: `/private/ws/<listenKey>`. |
| "A Binance WebSocket can stay open" | A single connection is **valid for 24 hours**; the server disconnects at the 24-hour mark. |
| "Use python-binance or the official SDK" | Both are maintained (`python-binance` 7.2k stars). For one unified multi-exchange layer use **ccxt** (44.8k stars). |
| "Binance has a Skills Hub for natural-language trading" | The **Wallet Skills** docs exist; the "Skills Hub" name was not found in official docs. The official **MCP server** does trade — inside a dedicated **Agentic sub-account**. |

The matrices keep a dated `verified_on` field on every one of these claims; `free_tier: unverified` is a first-class value.

### What the flags mean

- `pit` describes whether PIT is the right control: `not_applicable` means PIT does not fit this source (raw ticks/snapshots, tooling, sandbox) — it does **not** mean history never changes; `unverified` means nobody checked.
- `revision_risk` is the second dimension: `none` (official raw archives observed without rebuild), `rare` (on-chain reorgs/backfills), `possible` (aggregators, vendor rebuilds, news corrections), `routine` (macro/fundamentals revised often), `unknown`. Build derives a category default; `data/enrichment.yaml` records verified exceptions.
- `verification` is separate from `authority`: `reachable` only means HTTP 200 from the probe network; `schema_verified` means a payload shape was seen; `semantic_verified` means a specific fee/limit/endpoint/PIT claim was checked; `production_approved` means it was used end-to-end; `discovered` means the page was unreachable at probe time and is a citation lead only.
- `data_types` names the datasets a source actually covers, so a citation can be matched to the dataset it claims (depth, aggTrades, funding, OI, XBRL, vintages, …).
- `redistribution` is a policy bucket derived from `license_class` (public-domain/open-source → allowed, site terms → restricted, unknown otherwise); it is not legal advice.
- For news and event-driven facts cite the first publication time; a page update time is not evidence.

## Coverage

**quant (73)** — filing 7, market-data 16, china 20, macro 15, fundamentals 5, news 5, research 3, execution 2.
Includes SEC EDGAR + `data.sec.gov` XBRL APIs, SEC 13F/Form 4 datasets, FINRA short interest, CFTC COT, Cboe DataShop, 巨潮/上交所/深交所/HKEX, HKEX Data Marketplace (historical Full Book), HKEXnews/CCASS/香港证监会/HKMA/香港统计处, FRED + ALFRED, BLS/BEA/Treasury/IMF/World Bank/BIS/OECD/ECB, Bank of Japan/ONS/Eurostat/BoE/FOMC calendar, 国家统计局/人民银行/中国货币网, Massive/Alpaca/Databento/Tiingo/Alpha Vantage/Finnhub/Twelve Data/Nasdaq Data Link/OpenBB, Sharadar/Compustat-WRDS/CRSP/OptionMetrics/FMP, Tushare/AKShare/CNEquity/Wind/iFinD/JoinQuant/RiceQuant, IBKR/Alpaca Trading, Nasdaq Trader/NYSE, SEC and CFTC press releases, NBER/SSRN/arXiv q-fin/GDELT/Benzinga/RavenPack.

**crypto (46)** — exchange 17, on-chain 9, news 5, aggregator 4, archive 3, SDK 3, market-data 3, derivatives 1, research 1.
Includes Binance (REST/WS/Agent Native/llms.txt/MCP/testnet/archive/public ticker/announcements), Bybit/OKX/Coinbase/Kraken/Deribit, CoinGecko (API + keyless MCP)/CoinMarketCap/CoinGlass/SoSoValue, Kaiko/Coin Metrics, Glassnode/Nansen/CryptoQuant/Etherscan/Dune/DefiLlama/Blockchair/mempool.space, Tokenomist (formerly TokenUnlocks), Farside BTC ETF flows, Tardis/CryptoHFTData, ccxt/binance-connector-python/python-binance, Binance Research, and CoinDesk/Cointelegraph/Decrypt/The Block (D-tier: leads only).

**Flags measured at build time**: auth `none` 71 / `key` 34 / `account` 14; PIT `yes` 3 / `partial` 29 / `no` 26 / `not_applicable` 56 / `unverified` 5; verification `discovered` 22 / `reachable` 71 / `schema_verified` 4 / `semantic_verified` 20 / `production_approved` 2; revision_risk `none` 37 / `rare` 9 / `possible` 53 / `routine` 20 / `unknown` 0; redistribution `allowed` 26 / `restricted` 92 / `unknown` 1; access static 66 / portal 19 / js 4 / api 8 / challenge 18 / unknown 4.

## Tools

### `qt_source_find`

Find a source by URL, keyword, or domain.

- `url` — match a page (host + path prefix; exact/deeper pages rank first).
- `query` — keywords, e.g. `"binance funding rate"` or `"sec xbrl"`.
- `domain` — `quant` or `crypto`.
- `layer` — `breadth` (stable/primary) or `depth` (fast-moving).
- `limit` — max results (default 5, ceiling 20).

```
- [binance-ws-futures] Binance USD-M Futures WebSocket Streams — crypto/exchange; A/spec; verify=semantic_verified; access=static; pit=not_applicable; rev=none; data=trades+orderbook_l2+mark_price+funding+liquidations+long_short_ratio; redist=restricted; auth=none; refresh=90d; https://developers.binance.info/en/docs/derivatives/usds-margined-futures/websocket-market-streams
  note: 公开行情 wss://fstream.binance.com/ws/<stream>（或 /stream?streams=）；私有用户流 /private/ws/<listenKey>。不存在 /public 或 /market 路径。
```

Ranking uses IDF-like token weighting with a subject-token boost; URL lookups rank an exact page or deeper path above other pages on the same host.

### `qt_source_audit`

Audit the URL citations in a draft with an explicit confidence per URL:

- `exact_url` (high) — the normalized URL matches a registry entry exactly;
- `canonical_page` (medium) — same host and the cited path is a parent/child of the registered page;
- `api_host` (medium) — the cited host is a documented API host of exactly one source (e.g. `fapi.binance.com` → `binance-futures-api`); the host is attributed, the endpoint path is not verified;
- `same_host_ambiguous` (low) — same host but no path relation: counts as **not known**, lists candidates, and asks you to pin the exact page;
- `unknown` — foreign host.

Only `exact_url` / `canonical_page` count as known. Credential-like URL parameters (`api_key`, `token`, `secret`, `signature`, `auth`, `password`, …) and URL userinfo are redacted in the output (matching still uses the raw URL), and the audit reports how many citations were ambiguous or redacted.

```
Citations: 4/4 audited, 2 known, 2 unknown (1 same-host ambiguous), 1 redacted; A=2 B=0 C=0 D=0; uncited paragraphs=0
- https://developers.binance.info/en/docs/.../websocket-market-streams -> binance-ws-futures (crypto, A/spec, pit=not_applicable, verify=semantic_verified, rev=none; match=canonical_page)
- https://api.binance.com/api/v3/ticker/24hr?api_key=***&symbol=BTCUSDT -> binance-market-data-api (crypto, A/official-doc, pit=not_applicable, verify=production_approved; match=canonical_page)
- https://www.hkex.com.hk/financials/annual-report-2025.pdf -> same-host ambiguous (candidates: hkex); same host but no path match: pin the exact page (candidates: hkex)
- https://example.com/post -> unknown; not in the registry: verify the domain yourself before relying on it
Suggestions:
- 1 citation(s) matched only at the host level; pin the exact page or treat them as unsourced.
- 1 citation URL(s) contained credential-like parameters; values were redacted in this report.
```

## Trigger rules

The plugin does not intercept requests. The model decides, guided by a system-prompt section (order 241):

- call `qt_source_find` before stating market-data, exchange-endpoint, fee, rate-limit, or point-in-time facts;
- prefer A/B sources, treat C as secondary and D as a lead, never as fact;
- cite as `[source-id] URL` with the date or version the source states, and never invent fees, limits, or endpoint paths;
- treat `pit`, `revision_risk` and `free_tier` as dated claims, not permanent facts;
- `verification=discovered` citations must be re-checked; `reachable` only means HTTP 200, not correctness;
- when `qt_source_audit` reports `same_host_ambiguous`, treat the citation as unsourced until the exact page is pinned;
- cite the first publication time for news or event-driven facts;
- use `data_types` to confirm the source actually covers the dataset being claimed;
- call `qt_source_audit` on a draft that cites URLs;
- skip both tools outside quant finance and crypto.

## Measured footprint (2026-11-07)

| Item | Measured |
|---|---|
| `qt_source_find` schema (name + description + parameters) | 1,054 chars ≈ 264 tokens |
| `qt_source_audit` schema | 594 chars ≈ 149 tokens |
| Guidance section | 1,199 chars ≈ 300 tokens |
| **Combined per-request overhead** | **≈ 712 tokens** (schemas + guidance) |
| Registry load | 2.3 ms |
| `qt_source_find` latency | avg 0.136 ms, p95 0.289 ms (5,000 calls) |
| `qt_source_audit` latency | avg 0.051 ms (3,008-char draft, 500 calls) |

Token counts are character-based estimates at 4 chars/token. If both this plugin and `cs-source-reliable` are installed, expect ≈ 1,215 tokens of combined per-request overhead.

## Install

Requirements: DeepSeek Harness `>=0.2.1-rc.1 <0.3.0-0`, Node.js 20+.

From the release tarball (recommended — no build step):

```sh
dsh plugin --profile web add https://github.com/uhygyuf/quantitativeTrading-source-reliable/releases/latest/download/quantitativeTrading-source-reliable.tgz
```

From the source repository:

```sh
dsh plugin --profile web add github:uhygyuf/quantitativeTrading-source-reliable
```

From a local directory during development:

```sh
dsh plugin --profile web add /absolute/path/to/quantitativeTrading-source-reliable
```

Restart or reload the profile after installing. The plugin row appears under Settings → Plugins as **Quantitative trading source reliability**.

## Development

The YAML matrices record probe-time facts; `data/enrichment.yaml` records verified corrections (PIT, verification, revision_risk, optional fields); `data/datasets.yaml` is the controlled `data_types` vocabulary. `tools/build-data.cjs` merges them into `data/sources.json`, rejects unknown ids/tags/enums and dangling `fallback_id`, and stamps `meta.build`.

```sh
npm install                 # dev dependency: yaml
node tools/probe-sources.cjs --file=quant --apply    # probe + write snapshot (adds snapshot_id)
node tools/probe-sources.cjs --file=crypto --apply
npm run build:data          # merge matrices + enrichment + vocabulary into data/sources.json
node test/check.mjs         # 108 checks: registry, matching confidence, redaction, api_hosts, vocabulary, latency budgets
npm run health              # weekly reachability diff with snapshot ids, writes reports/source-health-<date>.txt
```

`tools/probe-sources.cjs` records `content_access`, `last_checked`, a `snapshot_id` and a probe snapshot per source. Challenge sites (Cloudflare/202/401/403) are recorded as `challenge`, not treated as a valid data response. `tools/probe-classify.cjs` and `tools/health-diff.cjs` are pure helpers covered by offline tests.

### Weekly source health

`npm run health` probes every source without writing back, diffs the result against `reports/source-health-state.json`, writes `reports/source-health-YYYY-MM-DD.txt` (including both probe `snapshot_id`s), and restores the tracked probe snapshots so the working tree stays clean (`reports/` is gitignored). It checks reachability and content access only — not data values, fees or PIT semantics.

## Data provenance and maintenance

- Every source was probed on **2026-11-06**: 97 returned HTTP 200; 18 returned a challenge (SEC endpoints, BLS, SSRN, Benzinga, Binance testnet/research/announcements, CryptoQuant, Blockchair, Tokenomist, Farside, SoSoValue from this network); 4 were unreachable (World Bank, HKMA, 香港统计处, Bank of England).
- PIT and verification are curated, not scraped: 56 sources are `not_applicable`, 5 are `unverified` (World Bank, OECD, HKMA, 香港统计处, BoE — not checkable from this network), and 22 are `discovered` (unreachable at probe time; citation leads only). The rest were checked against official docs and dated 2026-11-06.
- `revision_risk` is derived per category (exchange/archive → `none`, on-chain → `rare`, market-data/aggregator/news/china → `possible`, macro/fundamentals/filing → `routine`) with verified overrides for SEC as-filed sets, ALFRED/FRED/Sharadar/Compustat and the BTC/ETH archives.
- Optional attributes are only filled when verified: `rate_limit` on 2 sources, `freshness_sla` on 7, `fallback_id` on 4; absent means unverified.
- `refresh_days` is a suggestion per class: specs 90 d, official/vendor docs 30 d, datasets/APIs 14 d, peer-reviewed 365 d. `last_checked` is the probe date.
- `license_class` / `redistribution` / `cache_policy` are policy buckets, not legal advice. Exchange and market-data terms restrict redistribution; link and quote briefly unless you have a license.

## v0.2 reuse roadmap

The plugin stays a source-trust core; it does not become a data gateway or trading system. When v0.2 needs to serve Grok or other agents, reuse established components instead of writing bespoke adapters:

| Layer | Reuse | Why not in v0.1.5 |
|---|---|---|
| Access | **MCP** (spec `2026-07-28`) — expose `source_find` / `source_audit` as one MCP server | protocol/tooling change; MCP Registry is still preview |
| Lineage | **OpenLineage** (Linux Foundation) for dataset/job/run lineage in a future data gateway | no pipeline yet |
| Data quality | **Great Expectations / dbt tests**, with **BCBS 239** principles as the checklist | overkill for 119 static registry rows |
| Identity | **FIGI / OpenFIGI** for instrument identity; FIBO only as terminology reference | no instrument master yet |
| PIT | **ALFRED / Sharadar / Compustat-WRDS** vintages (already in the registry) | already reused |

BCBS 239 dimensions map to existing fields: accuracy → `semantic_verified` / `production_approved`; completeness → `data_types` + coverage; timeliness → `freshness_sla` / `refresh_days` / `last_checked`; adaptability → `npm run health` + probe `snapshot_id`.

Deliberately not reused as reliability mechanisms: multi-agent debate over news, free web search as a primary market-data source, and LLM self-checks in place of hard risk limits (hard stops must live outside the model).

## Limitations

- The tools **look up a curated registry**; they do not fetch pages, call APIs, or verify claims on their own.
- `qt_source_audit` is a mechanical check (URL extraction, match confidence, tier mapping, uncited-paragraph count). It does not judge whether a cited source actually supports a sentence.
- Redaction covers common credential parameter names and userinfo; a nonstandard parameter name may pass through. The raw URL is used for matching and is not logged by the plugin.
- `same_host_ambiguous` matches are reported as not known; a legitimate deep link that is not registered will stay ambiguous until the registry records it.
- `api_host` attribution maps the host only; it does not prove that the cited endpoint path or parameters are the documented ones.
- A/B tiers reduce risk; they do not guarantee correctness. `verification` records what was checked and when — `reachable` is not a data-quality score. Fees, limits and endpoints change — re-probe before relying on a number.
- Non-registry URLs are flagged as unknown even when legitimate.
- The plugin does not execute trades, store API keys, or give legal/compliance advice. Trading requires a deterministic risk layer between the model and the exchange.

## License

MIT. The registry contains only source names, URLs and policy metadata; the referenced content remains under each source's own terms.
