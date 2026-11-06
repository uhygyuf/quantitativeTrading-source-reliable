# quantitativeTrading-source-reliable

English · [简体中文](README.zh.md)

Source reliability for quantitative finance and crypto trading in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): a bundled registry of **94 verified, agent-collectable sources** with authority tiers, point-in-time and free-tier flags, plus two model-facing tools to find sources and audit citations.

A plugin for DeepSeek Harness (`dsh`). The registry ships as data; both tools are local lookups (no network calls), so they are fast and have no side effects. It is independent from [`cs-source-reliable`](https://github.com/uhygyuf/cs-source-reliable) and can be installed on its own.

## What it ships

- **94 sources** — 58 `quant` (filings, macro, fundamentals, China A-share/HK, execution) and 36 `crypto` (exchanges, derivatives, on-chain, archives, SDKs).
- Per source: domain, category, authority tier (`A` regulator/exchange/official docs, `B` institutional vendor/peer-reviewed, `C` curated secondary, `D` lead only), evidence type, `content_access` (static / portal / js / challenge / api / binary), `license_class`, `cache_policy`, `attribution`, `refresh_days`, `last_checked`, and where meaningful `pit`, `free_tier`, `auth`, `iface`, `history_start`.
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

## Coverage

**quant (58)** — filing 7, market-data 14, china 14, macro 10, fundamentals 5, research 3, news 3, execution 2.
Includes SEC EDGAR + `data.sec.gov` XBRL APIs, SEC 13F/Form 4 datasets, FINRA short interest, CFTC COT, Cboe DataShop, 巨潮/上交所/深交所/HKEX, FRED + ALFRED, BLS/BEA/Treasury/IMF/World Bank/BIS/OECD/ECB, 国家统计局/人民银行/中国货币网, Massive/Alpaca/Databento/Tiingo/Alpha Vantage/Finnhub/Twelve Data/Nasdaq Data Link/OpenBB, Sharadar/Compustat-WRDS/CRSP/OptionMetrics/FMP, Tushare/AKShare/CNEquity/Wind/iFinD/JoinQuant/RiceQuant, IBKR/Alpaca Trading, NBER/SSRN/arXiv q-fin/GDELT/Benzinga/RavenPack.

**crypto (36)** — exchange 15, on-chain 8, archive 3, aggregator 3, SDK 3, market-data 2, derivatives 1, research 1.
Includes Binance (REST/WS/Agent Native/llms.txt/MCP/testnet/archive), Bybit/OKX/Coinbase/Kraken/Deribit, CoinGecko (API + keyless MCP)/CoinMarketCap/CoinGlass, Kaiko/Coin Metrics, Glassnode/Nansen/CryptoQuant/Etherscan/Dune/DefiLlama/Blockchair/mempool.space, Tardis/CryptoHFTData, ccxt/binance-connector-python/python-binance, Binance Research.

**Flags measured at build time**: auth `none` 46 / `key` 34 / `account` 14; PIT `yes` 3 / `partial` 13 / `no` 78; access static 63 / portal 10 / js 4 / api 2 / challenge 14 / unknown 1.

## Tools

### `qt_source_find`

Find a source by URL, keyword, or domain.

- `url` — match a page (host + path prefix).
- `query` — keywords, e.g. `"binance funding rate"` or `"sec xbrl"`.
- `domain` — `quant` or `crypto`.
- `layer` — `breadth` (stable/primary) or `depth` (fast-moving).
- `limit` — max results (default 5, ceiling 20).

```
- [binance-ws-futures] Binance USD-M Futures WebSocket Streams — crypto/exchange; A/spec; access=static; pit=no; auth=none; refresh=90d; https://developers.binance.info/en/docs/derivatives/usds-margined-futures/websocket-market-streams
  note: 公开行情 wss://fstream.binance.com/ws/<stream>（或 /stream?streams=）；私有用户流 /private/ws/<listenKey>。不存在 /public 或 /market 路径。
```

Ranking uses IDF-like token weighting with a subject-token boost, so `"binance funding rate"` ranks exchange/derivative sources above generic "rate" pages.

### `qt_source_audit`

Audit the URL citations in a draft: map each URL to a known source, report its domain, authority tier and PIT flag, flag unknown domains and C/D-tier citations, count substantive paragraphs without a source, and suggest fixes.

```
Citations: 3/3 audited, 2 known, 1 unknown; A=2 B=0 C=0 D=0; uncited paragraphs=0
- https://developers.binance.info/en/docs/.../websocket-market-streams -> binance-ws-futures (crypto, A/spec, pit=no)
- https://alfred.stlouisfed.org/ -> alfred (quant, A/official-doc, pit=yes)
- https://example.com/post -> unknown; not in the registry: verify the domain yourself before relying on it
```

## Trigger rules

The plugin does not intercept requests. The model decides, guided by a system-prompt section (order 241):

- call `qt_source_find` before stating market-data, exchange-endpoint, fee, rate-limit, or point-in-time facts;
- prefer A/B sources, treat C as secondary and D as a lead, never as fact;
- cite as `[source-id] URL` with the date or version the source states, and never invent fees, limits, or endpoint paths;
- treat `pit` and `free_tier` as dated claims, not permanent facts;
- call `qt_source_audit` on a draft that cites URLs;
- skip both tools outside quant finance and crypto.

## Measured footprint (2026-11-06)

| Item | Measured |
|---|---|
| `qt_source_find` schema (name + description + parameters) | 952 chars ≈ 238 tokens |
| `qt_source_audit` schema | 470 chars ≈ 118 tokens |
| Guidance section | 804 chars ≈ 201 tokens |
| **Combined per-request overhead** | **≈ 557 tokens** (schemas + guidance) |
| Registry load | 2.0 ms |
| `qt_source_find` latency | avg 0.095 ms, p95 0.205 ms (5,000 calls) |
| `qt_source_audit` latency | avg 0.018 ms (3,008-char draft, 500 calls) |

Token counts are character-based estimates at 4 chars/token. If both this plugin and `cs-source-reliable` are installed, expect ≈ 1,050 tokens of combined per-request overhead.

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

The YAML matrices are the source of truth; `data/sources.json` is generated from them.

```sh
npm install                 # dev dependency: yaml
node tools/probe-sources.cjs --file=quant --apply    # probe + write snapshot
node tools/probe-sources.cjs --file=crypto --apply
npm run build:data          # rebuild data/sources.json
node test/check.mjs         # 36 checks: registry, tools, lossless JSON, latency budgets
```

`tools/probe-sources.cjs` records `content_access`, `last_checked` and a probe snapshot per source. Challenge sites (Cloudflare/202/401/403) are recorded as `challenge`, not treated as a valid data response.

## Data provenance and maintenance

- Every source was probed on **2026-11-06**: 79 returned HTTP 200; 14 returned a challenge (SEC endpoints, BLS, SSRN, Benzinga, Binance testnet/research, CryptoQuant, Blockchair from this network); 1 was unreachable (World Bank).
- `refresh_days` is a suggestion per class: specs 90 d, official/vendor docs 30 d, datasets/APIs 14 d, peer-reviewed 365 d. `last_checked` is the probe date.
- `license_class` / `cache_policy` are policy buckets, not legal advice. Exchange and market-data terms restrict redistribution; link and quote briefly unless you have a license.

## Limitations

- The tools **look up a curated registry**; they do not fetch pages, call APIs, or verify claims on their own.
- `qt_source_audit` is a mechanical check (URL extraction, tier mapping, uncited-paragraph count). It does not judge whether a cited source actually supports a sentence.
- A/B tiers reduce risk; they do not guarantee correctness. Fees, limits and endpoints change — re-probe before relying on a number.
- Non-registry URLs are flagged as unknown even when legitimate.
- The plugin does not execute trades, store API keys, or give legal/compliance advice. Trading requires a deterministic risk layer between the model and the exchange.

## License

MIT. The registry contains only source names, URLs and policy metadata; the referenced content remains under each source's own terms.
