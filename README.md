# quantitativeTrading-source-reliable

English · [简体中文](README.zh.md)

Source reliability for quantitative finance and crypto trading in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): a bundled registry of **119 curated, agent-collectable sources** with authority tiers, verification states, five-state point-in-time flags and per-source dataset tags, plus two model-facing tools to find sources and audit citations.

A plugin for DeepSeek Harness (`dsh`). The registry ships as data; both tools are local lookups (no network calls), so they are fast and have no side effects. It is independent from [`cs-source-reliable`](https://github.com/uhygyuf/cs-source-reliable) and can be installed on its own.

## What it ships

- **119 sources** — 73 `quant` (filings, macro, fundamentals, China A-share/HK, execution, global official statistics) and 46 `crypto` (exchanges, derivatives, on-chain, archives, SDKs, news, ETF flows).
- Per source: domain, category, authority tier (`A` regulator/exchange/official docs, `B` institutional vendor/peer-reviewed, `C` curated secondary, `D` lead only), evidence type, `content_access` (static / portal / js / challenge / api / binary), `verification` (`discovered` / `reachable` / `schema_verified` / `semantic_verified` / `production_approved`), `license_class`, `cache_policy`, `attribution`, `refresh_days`, `last_checked`, `pit` (`yes` / `partial` / `no` / `not_applicable` / `unverified`), `data_types` (dataset tags such as `orderbook_l2`, `funding`, `xbrl`), and where meaningful `free_tier`, `auth`, `iface`, `history_start`.
- A curation layer (`data/enrichment.yaml`) records what was verified after the probe — PIT corrections, verification states and per-source dataset tags; `tools/build-data.cjs` merges it and rejects unknown ids.
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

- `pit=not_applicable` — the data cannot be revised (raw ticks/quotes/order books, on-chain state, archives) or the entry is tooling; `pit=unverified` means nobody checked. A live stream is not a "no PIT" dataset.
- `verification` is separate from `authority`: `reachable` only means HTTP 200 from the probe network; `schema_verified` means a payload shape was seen; `semantic_verified` means a specific fee/limit/endpoint/PIT claim was checked; `production_approved` means it was used end-to-end; `discovered` means the page was unreachable at probe time and is a citation lead only.
- `data_types` names the datasets a source actually covers, so a citation can be matched to the dataset it claims (e.g. depth, aggTrades, funding, OI, XBRL, vintages).
- For news and event-driven facts cite the first publication time; a page update time is not evidence.

## Coverage

**quant (73)** — filing 7, market-data 16, china 20, macro 15, fundamentals 5, news 5, research 3, execution 2.
Includes SEC EDGAR + `data.sec.gov` XBRL APIs, SEC 13F/Form 4 datasets, FINRA short interest, CFTC COT, Cboe DataShop, 巨潮/上交所/深交所/HKEX, HKEX Data Marketplace (historical Full Book), HKEXnews/CCASS/香港证监会/HKMA/香港统计处, FRED + ALFRED, BLS/BEA/Treasury/IMF/World Bank/BIS/OECD/ECB, Bank of Japan/ONS/Eurostat/BoE/FOMC calendar, 国家统计局/人民银行/中国货币网, Massive/Alpaca/Databento/Tiingo/Alpha Vantage/Finnhub/Twelve Data/Nasdaq Data Link/OpenBB, Sharadar/Compustat-WRDS/CRSP/OptionMetrics/FMP, Tushare/AKShare/CNEquity/Wind/iFinD/JoinQuant/RiceQuant, IBKR/Alpaca Trading, Nasdaq Trader/NYSE, SEC and CFTC press releases, NBER/SSRN/arXiv q-fin/GDELT/Benzinga/RavenPack.

**crypto (46)** — exchange 17, on-chain 9, news 5, aggregator 4, archive 3, SDK 3, market-data 3, derivatives 1, research 1.
Includes Binance (REST/WS/Agent Native/llms.txt/MCP/testnet/archive/public ticker/announcements), Bybit/OKX/Coinbase/Kraken/Deribit, CoinGecko (API + keyless MCP)/CoinMarketCap/CoinGlass/SoSoValue, Kaiko/Coin Metrics, Glassnode/Nansen/CryptoQuant/Etherscan/Dune/DefiLlama/Blockchair/mempool.space, Tokenomist (formerly TokenUnlocks), Farside BTC ETF flows, Tardis/CryptoHFTData, ccxt/binance-connector-python/python-binance, Binance Research, and CoinDesk/Cointelegraph/Decrypt/The Block (D-tier: leads only).

**Flags measured at build time**: auth `none` 71 / `key` 34 / `account` 14; PIT `yes` 3 / `partial` 29 / `no` 26 / `not_applicable` 56 / `unverified` 5; verification `discovered` 22 / `reachable` 71 / `schema_verified` 4 / `semantic_verified` 20 / `production_approved` 2; access static 66 / portal 19 / js 4 / api 8 / challenge 18 / unknown 4.

## Tools

### `qt_source_find`

Find a source by URL, keyword, or domain.

- `url` — match a page (host + path prefix).
- `query` — keywords, e.g. `"binance funding rate"` or `"sec xbrl"`.
- `domain` — `quant` or `crypto`.
- `layer` — `breadth` (stable/primary) or `depth` (fast-moving).
- `limit` — max results (default 5, ceiling 20).

```
- [binance-ws-futures] Binance USD-M Futures WebSocket Streams — crypto/exchange; A/spec; verify=semantic_verified; access=static; pit=not_applicable; data=trades+orderbook_l2+mark_price+funding+liquidations+long_short_ratio; auth=none; refresh=90d; https://developers.binance.info/en/docs/derivatives/usds-margined-futures/websocket-market-streams
  note: 公开行情 wss://fstream.binance.com/ws/<stream>（或 /stream?streams=）；私有用户流 /private/ws/<listenKey>。不存在 /public 或 /market 路径。
```

Ranking uses IDF-like token weighting with a subject-token boost, so `"binance funding rate"` ranks exchange/derivative sources above generic "rate" pages. URL lookups rank an exact page or deeper path above other pages on the same host, so a cited endpoint resolves to the source that documents it.

### `qt_source_audit`

Audit the URL citations in a draft: map each URL to a known source, report its domain, authority tier, PIT and verification state, flag unknown domains, C/D-tier citations and sources that were unreachable at the last probe, count substantive paragraphs without a source, and suggest fixes.

```
Citations: 4/4 audited, 3 known, 1 unknown; A=3 B=0 C=0 D=0; uncited paragraphs=0
- https://developers.binance.info/en/docs/.../websocket-market-streams -> binance-ws-futures (crypto, A/spec, pit=not_applicable, verify=semantic_verified)
- https://alfred.stlouisfed.org/ -> alfred (quant, A/official-doc, pit=yes, verify=semantic_verified)
- https://www.sec.gov/edgar/search/ -> sec-edgar-search (quant, A/official-doc, pit=no, verify=discovered); not reachable from this network at the last probe; re-check the page before citing
- https://example.com/post -> unknown; not in the registry: verify the domain yourself before relying on it
```

## Trigger rules

The plugin does not intercept requests. The model decides, guided by a system-prompt section (order 241):

- call `qt_source_find` before stating market-data, exchange-endpoint, fee, rate-limit, or point-in-time facts;
- prefer A/B sources, treat C as secondary and D as a lead, never as fact;
- cite as `[source-id] URL` with the date or version the source states, and never invent fees, limits, or endpoint paths;
- treat `pit` and `free_tier` as dated claims, not permanent facts;
- `verification=discovered` citations must be re-checked; `verification=reachable` only means HTTP 200, not correctness;
- cite the first publication time for news or event-driven facts;
- use `data_types` to confirm the source actually covers the dataset being claimed;
- call `qt_source_audit` on a draft that cites URLs;
- skip both tools outside quant finance and crypto.

## Measured footprint (2026-11-06)

| Item | Measured |
|---|---|
| `qt_source_find` schema (name + description + parameters) | 953 chars ≈ 239 tokens |
| `qt_source_audit` schema | 470 chars ≈ 118 tokens |
| Guidance section | 1,169 chars ≈ 293 tokens |
| **Combined per-request overhead** | **≈ 648 tokens** (schemas + guidance) |
| Registry load | 8.4 ms |
| `qt_source_find` latency | avg 0.563 ms, p95 1.268 ms (5,000 calls) |
| `qt_source_audit` latency | avg 0.098 ms (3,008-char draft, 500 calls) |

Token counts are character-based estimates at 4 chars/token. If both this plugin and `cs-source-reliable` are installed, expect ≈ 1,150 tokens of combined per-request overhead.

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

The YAML matrices record probe-time facts; `data/enrichment.yaml` records verified corrections (PIT, verification states, dataset tags). `tools/build-data.cjs` merges both into `data/sources.json` and rejects unknown ids.

```sh
npm install                 # dev dependency: yaml
node tools/probe-sources.cjs --file=quant --apply    # probe + write snapshot
node tools/probe-sources.cjs --file=crypto --apply
npm run build:data          # merge matrices + enrichment into data/sources.json
node test/check.mjs         # 60 checks: registry, five-state PIT, verification, dataset tags, latency budgets
```

`tools/probe-sources.cjs` records `content_access`, `last_checked` and a probe snapshot per source. Challenge sites (Cloudflare/202/401/403) are recorded as `challenge`, not treated as a valid data response.

## Data provenance and maintenance

- Every source was probed on **2026-11-06**: 97 returned HTTP 200; 18 returned a challenge (SEC endpoints, BLS, SSRN, Benzinga, Binance testnet/research/announcements, CryptoQuant, Blockchair, Tokenomist, Farside, SoSoValue from this network); 4 were unreachable (World Bank, HKMA, 香港统计处, Bank of England).
- PIT and verification are curated, not scraped: 56 sources are `not_applicable` (immutable raw data or tooling), 5 are `unverified` (World Bank, OECD, HKMA, 香港统计处, BoE — not checkable from this network), and 22 are `discovered` (unreachable at probe time; citation leads only). The rest were checked against official docs and dated 2026-11-06.
- `refresh_days` is a suggestion per class: specs 90 d, official/vendor docs 30 d, datasets/APIs 14 d, peer-reviewed 365 d. `last_checked` is the probe date.
- `license_class` / `cache_policy` are policy buckets, not legal advice. Exchange and market-data terms restrict redistribution; link and quote briefly unless you have a license.

## Limitations

- The tools **look up a curated registry**; they do not fetch pages, call APIs, or verify claims on their own.
- `qt_source_audit` is a mechanical check (URL extraction, tier mapping, uncited-paragraph count). It does not judge whether a cited source actually supports a sentence.
- A/B tiers reduce risk; they do not guarantee correctness. `verification` records what was checked and when — `reachable` is not a data-quality score. Fees, limits and endpoints change — re-probe before relying on a number.
- Non-registry URLs are flagged as unknown even when legitimate.
- The plugin does not execute trades, store API keys, or give legal/compliance advice. Trading requires a deterministic risk layer between the model and the exchange.

## License

MIT. The registry contains only source names, URLs and policy metadata; the referenced content remains under each source's own terms.
