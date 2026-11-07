# quantitativeTrading-source-reliable

[English](README.md) · 简体中文

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的量化金融与加密交易信源插件：内置 **119 个人工核定、可采集的信源**，带权威分级、验证状态、PIT 五态、修订风险与数据集标签，并给模型两个工具——查源、审引用（带匹配置信度与凭据脱敏）。

这是 DSH 插件（`dsh`）。注册表以数据形式打包，两个工具都是本地查表（不联网），所以很快、没有副作用。它与 [`cs-source-reliable`](https://github.com/uhygyuf/cs-source-reliable) 完全独立，可以单独安装。

## 它装了什么

- **119 个信源** —— 73 个 `quant`（监管申报、宏观、基本面、A股/港股、执行接口、全球官方统计）+ 46 个 `crypto`（交易所、衍生品、链上、归档、SDK、新闻、ETF 资金流）。
- 每条源包含：域、类别、权威级（`A` 监管/交易所/官方文档，`B` 机构数据商/同行评审，`C` 可靠二手，`D` 仅线索）、证据类型、`content_access`、`verification`（`discovered` / `reachable` / `schema_verified` / `semantic_verified` / `production_approved`）、`license_class`、`cache_policy`、`attribution`、`refresh_days`、`last_checked`、`pit`（`yes` / `partial` / `no` / `not_applicable` / `unverified`）、`revision_risk`（`none` / `rare` / `possible` / `routine` / `unknown`）、`data_types`（数据集标签）、`redistribution`（`allowed` / `restricted` / `prohibited` / `unknown`），以及按需出现的 `rate_limit`、`license_url`、`freshness_sla`、`fallback_id`、`free_tier`、`auth`、`iface`、`history_start`。
- `data_types` 是受控词表（`data/datasets.yaml`，87 个 tag）；`tools/build-data.cjs` 拒绝未知 tag、错误枚举、悬空 `fallback_id`。
- 人工核验层（`data/enrichment.yaml`，version 2）记录探测之后才核实的内容——PIT 修正、验证状态、修订风险覆盖、可选字段与每条源的数据集标签。
- `sources.json` 带 `meta.data_version: 2` 与 `meta.build`（built_at、source_count、矩阵/核验层/词表版本）。
- **两个工具**：`qt_source_find`、`qt_source_audit`。
- 一段很短的 system prompt 引导（order 241），告诉模型什么时候用、怎么引用。

## 它存在的理由：常见说法经常是"差一点就对"

下面每一条都在 **2026-11-06** 对官方页面或 API 核过；探测快照存在每条源的 YAML 里。

| 常见说法 | 注册表记录的实际值 |
|---|---|
| "Massive（原 Polygon.io）" | 对——`polygon.io` 已跳转 `massive.com`；个人档页面显示 `$199/月`。 |
| "Alpha Vantage 免费层够做原型" | 免费层 **25 请求/天**；付费 **$49.99/月起**。agent 循环基本不够用。 |
| "Alpaca 免费起步" | 免费档 API 行情 **延迟 15 分钟**；实时 SIP 要 **Algo Trader Plus $99/月**。 |
| "Twelve Data 免费层" | **8 credits/min、800/天**；Grow **$79/月**。 |
| "Tiingo 大约 $30/月" | **未核实**——定价页是前端渲染的。注册表写 `free_tier: unverified`，不照抄数字。 |
| "宏观回测用 FRED" | FRED 给的是**修订后**序列。PIT 宏观要用 **ALFRED** 的 vintage。 |
| "Sharadar 走 Nasdaq Data Link" | Sharadar 现在文档写的是**自有 API** `api.sharadar.com`，并明确说不要把它的 key 用在 `data.nasdaq.com`。 |
| "FMP 是可靠的结构化源" | 它的文档站对非浏览器客户端返回 **403**；数据默认是最新修订值，不是 as-reported。 |
| "Financial Datasets / Equibles 是 PIT" | 服务真实存在，但除非文档明确，给的是**最新修订值**。 |
| "Massive 支持 MCP" | **没有官方 MCP**，只有社区包。官方 MCP 只有 Alpaca、Alpha Vantage、CoinGecko、Binance、Financial Datasets 等。 |
| "Binance 合约 WS 是 `/public` 或 `/market`" | 这两个路径不存在。公开行情：`wss://fstream.binance.com/ws/<stream>` 或 `/stream?streams=`；用户数据：`/private/ws/<listenKey>`。 |
| "Binance 一条 WS 可以一直连着" | 单条连接**最长 24 小时**，到点服务端断开。 |
| "用 python-binance 或官方 SDK" | 两者都在维护（`python-binance` 7.2k stars）。要多所统一执行层，用 **ccxt**（44.8k stars）。 |
| "Binance 有 Skills Hub，能自然语言下单" | **Wallet Skills** 文档存在；"Skills Hub" 这个名字在官方没找到。官方 **MCP server** 确实能交易——在专用 **Agentic 子账户**里。 |

矩阵里每条断言都带 `verified_on` 日期；`free_tier: unverified` 是合法的正式取值。

### 字段含义

- `pit` 描述 PIT 是否是合适的控制手段：`not_applicable` 表示 PIT 不适用于这个源（原始逐笔/快照、工具、沙盒），**不**表示历史永不修订；`unverified` 表示没人核过。
- `revision_risk` 是第二个维度：`none`（官方原始归档，未观察到重建）、`rare`（链上重组/回填）、`possible`（聚合器、供应商重建、新闻更正）、`routine`（宏观/基本面经常修订）、`unknown`。构建按类别给默认值，`data/enrichment.yaml` 记录核实过的例外。
- `verification` 与 `authority` 是两回事：`reachable` 只表示探测网络下 HTTP 200；`schema_verified` 表示实际看过返回结构；`semantic_verified` 表示核对过具体的费率/限频/端点/PIT 口径；`production_approved` 表示端到端用过；`discovered` 表示探测时页面不可达，只能当引用线索。
- `data_types` 标明一条源真正覆盖的数据集，引用时可以用它核对"这条源是否真的含这个数据"（depth、aggTrades、funding、OI、XBRL、vintage 等）。
- `redistribution` 是由 `license_class` 推导的策略分桶（公有领域/开源 → allowed，站点条款 → restricted，其余 unknown），不是法律意见。
- 新闻与事件类事实引用**首次发布时间**，页面更新时间不算证据。

## 覆盖

**quant（73）** —— filing 7、market-data 16、china 20、macro 15、fundamentals 5、news 5、research 3、execution 2。
含 SEC EDGAR 与 `data.sec.gov` XBRL API、SEC 13F/Form 4 数据集、FINRA 空头、CFTC COT、Cboe DataShop、巨潮/上交所/深交所/港交所、HKEX Data Marketplace（历史 Full Book）、HKEXnews/CCASS/香港证监会/HKMA/香港统计处、FRED + ALFRED、BLS/BEA/财政部/IMF/世界银行/BIS/OECD/ECB、日本央行/ONS/Eurostat/BoE/FOMC 日历、国家统计局/人民银行/中国货币网、Massive/Alpaca/Databento/Tiingo/Alpha Vantage/Finnhub/Twelve Data/Nasdaq Data Link/OpenBB、Sharadar/Compustat-WRDS/CRSP/OptionMetrics/FMP、Tushare/AKShare/CNEquity/Wind/iFinD/聚宽/米筐、IBKR/Alpaca Trading、Nasdaq Trader/NYSE、SEC 与 CFTC 新闻稿、NBER/SSRN/arXiv q-fin/GDELT/Benzinga/RavenPack。

**crypto（46）** —— exchange 17、on-chain 9、news 5、aggregator 4、archive 3、SDK 3、market-data 3、derivatives 1、research 1。
含 Binance（REST/WS/Agent Native/llms.txt/MCP/testnet/归档/公告）、Bybit/OKX/Coinbase/Kraken/Deribit、CoinGecko（API + 免 key MCP）/CoinMarketCap/CoinGlass/SoSoValue、Kaiko/Coin Metrics、Glassnode/Nansen/CryptoQuant/Etherscan/Dune/DefiLlama/Blockchair/mempool.space、Tokenomist（原 TokenUnlocks）、Farside BTC ETF 资金流、Tardis/CryptoHFTData、ccxt/binance-connector-python/python-binance、Binance Research。

**构建时实测分布**：auth `none` 71 / `key` 34 / `account` 14；PIT `yes` 3 / `partial` 29 / `no` 26 / `not_applicable` 56 / `unverified` 5；验证状态 `discovered` 22 / `reachable` 71 / `schema_verified` 4 / `semantic_verified` 20 / `production_approved` 2；revision_risk `none` 37 / `rare` 9 / `possible` 53 / `routine` 20 / `unknown` 0；redistribution `allowed` 26 / `restricted` 92 / `unknown` 1；访问方式 static 66 / portal 19 / js 4 / api 8 / challenge 18 / unknown 4。

## 工具

### `qt_source_find`

按 URL、关键词或域查源。

- `url` —— 匹配页面（域名 + 路径前缀；精确页面/更深路径优先）。
- `query` —— 关键词，如 `"binance funding rate"` 或 `"sec xbrl"`。
- `domain` —— `quant` 或 `crypto`。
- `layer` —— `breadth`（稳定/一手）或 `depth`（快速变化）。
- `limit` —— 最多返回条数（默认 5，上限 20）。

```
- [binance-ws-futures] Binance USD-M Futures WebSocket Streams — crypto/exchange; A/spec; verify=semantic_verified; access=static; pit=not_applicable; rev=none; data=trades+orderbook_l2+mark_price+funding+liquidations+long_short_ratio; redist=restricted; auth=none; refresh=90d; https://developers.binance.info/en/docs/derivatives/usds-margined-futures/websocket-market-streams
  note: 公开行情 wss://fstream.binance.com/ws/<stream>（或 /stream?streams=）；私有用户流 /private/ws/<listenKey>。不存在 /public 或 /market 路径。
```

排序用 IDF 式词权重 + 主语词加权；URL 查询会先排精确页面/更深路径，再排同域兜底。

### `qt_source_audit`

审一份草稿里的 URL 引用，每条 URL 给出明确置信度：

- `exact_url`（high）—— 规范化后与注册表条目完全一致；
- `canonical_page`（medium）—— 同 host，且引用路径与注册页面是父子路径关系；
- `same_host_ambiguous`（low）—— 同 host 但路径无关系：**不算 known**，列出候选源，要求固定到具体页面；
- `unknown` —— 外部域名。

只有 `exact_url` / `canonical_page` 计入 known。疑似凭据参数（`api_key`、`token`、`secret`、`signature`、`auth`、`password` 等）与 URL userinfo 会在输出中脱敏（匹配仍用原始 URL），并报告 ambiguous 与 redacted 数量。

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

## 触发规则

插件不拦截请求。由模型按 system prompt 引导（order 241）决定：

- 在陈述行情、交易所端点、费用、限流、PIT 事实前，先调 `qt_source_find`；
- 优先 A/B 源，C 只当二手，D 只当线索、不能当结论；
- 引用写成 `[source-id] URL`，并带上源站声明的日期或版本；不要凭空写费用、限额或端点路径；
- 把 `pit`、`revision_risk` 与 `free_tier` 当作**带日期的断言**，不是永久事实；
- `verification=discovered` 的引用必须重新确认；`reachable` 只表示 HTTP 200，不表示数据正确；
- `qt_source_audit` 报 `same_host_ambiguous` 时，按 unsourced 处理，直到固定到具体页面；
- 新闻与事件类事实要带**首次发布时间**；
- 用 `data_types` 核对一条源是否真的覆盖所引数据；
- 草稿里有 URL 就调 `qt_source_audit`；
- 量化金融与加密之外的话题，两个工具都跳过。

## 实测开销（2026-11-07）

| 项目 | 实测 |
|---|---|
| `qt_source_find` schema（名称+描述+参数） | 1,054 字符 ≈ 264 tokens |
| `qt_source_audit` schema | 583 字符 ≈ 146 tokens |
| 引导段 | 1,199 字符 ≈ 300 tokens |
| **每请求合计开销** | **≈ 709 tokens**（schema + 引导） |
| 注册表加载 | 2.3 ms |
| `qt_source_find` 延迟 | 平均 0.136 ms，p95 0.289 ms（5000 次） |
| `qt_source_audit` 延迟 | 平均 0.051 ms（3008 字符草稿，500 次） |

token 数是按 4 字符/token 的字符估算。若与 `cs-source-reliable` 同装，合计约 1,210 tokens/请求。

## 安装

要求：DeepSeek Harness `>=0.2.1-rc.1 <0.3.0-0`，Node.js 20+。

从 Release tarball 安装（推荐，无需构建）：

```sh
dsh plugin --profile web add https://github.com/uhygyuf/quantitativeTrading-source-reliable/releases/latest/download/quantitativeTrading-source-reliable.tgz
```

从源码仓库安装：

```sh
dsh plugin --profile web add github:uhygyuf/quantitativeTrading-source-reliable
```

本地开发目录安装：

```sh
dsh plugin --profile web add /absolute/path/to/quantitativeTrading-source-reliable
```

安装后重启或重载 profile。插件行会出现在「设置 → 插件」里，名称是 **量化交易信源可靠性**。

## 开发

YAML 矩阵记录探测时的事实；`data/enrichment.yaml` 记录探测后人工核定的修正（PIT、验证状态、revision_risk、可选字段）；`data/datasets.yaml` 是 `data_types` 的受控词表。`tools/build-data.cjs` 合并三层生成 `data/sources.json`，拒绝未知 id/tag/枚举与悬空 `fallback_id`，并写入 `meta.build`。

```sh
npm install                 # 开发依赖：yaml
node tools/probe-sources.cjs --file=quant --apply    # 探测并写回快照（带 snapshot_id）
node tools/probe-sources.cjs --file=crypto --apply
npm run build:data          # 合并矩阵 + 核验层 + 词表，生成 data/sources.json
node test/check.mjs         # 103 项检查：注册表、匹配置信度、脱敏、词表、延迟预算
npm run health              # 每周可达性巡检（带 snapshot id），输出 reports/source-health-<日期>.txt
```

`tools/probe-sources.cjs` 会为每条源记录 `content_access`、`last_checked`、`snapshot_id` 与探测快照。反爬站点（Cloudflare / 202 / 401 / 403）记为 `challenge`，不当作有效数据响应。`tools/probe-classify.cjs` 与 `tools/health-diff.cjs` 是纯函数，由离线测试覆盖。

### 每周信源巡检

`npm run health` 会探测全部信源但不写回，与 `reports/source-health-state.json` 做周对比，输出 `reports/source-health-YYYY-MM-DD.txt`（含两个探测 `snapshot_id`），并恢复被探测覆盖的已跟踪快照，保持工作区干净（`reports/` 已加入 .gitignore）。它只检查可达性与内容形态，不验证数据值、费率或 PIT 口径。

## 数据来源与维护

- 全部信源在 **2026-11-06** 探测：97 条 HTTP 200；18 条返回 challenge（SEC 各端点、BLS、SSRN、Benzinga、Binance testnet/research/公告、CryptoQuant、Blockchair、Tokenomist、Farside、SoSoValue，在本网络下）；4 条不可达（World Bank、HKMA、香港统计处、Bank of England）。
- PIT 与验证状态是人工核定的，不是抓出来的：56 条为 `not_applicable`，5 条为 `unverified`（World Bank、OECD、HKMA、香港统计处、BoE，本网络下无法核实），22 条为 `discovered`（探测时不可达，只能当引用线索）；其余按官方文档核对过，日期为 2026-11-06。
- `revision_risk` 按类别推导（交易所/归档 → `none`，链上 → `rare`，行情/聚合/新闻/中国 → `possible`，宏观/基本面/申报 → `routine`）；SEC as-filed 数据集、ALFRED/FRED/Sharadar/Compustat 与 BTC/ETH 归档有核实过的覆盖值。
- 可选字段只在核实过时填写：`rate_limit` 2 条、`freshness_sla` 7 条、`fallback_id` 4 条；缺省表示未核实。
- `refresh_days` 按类别给建议：规范 90 天、官方/数据商文档 30 天、数据集/API 14 天、同行评审 365 天。`last_checked` 是探测日期。
- `license_class` / `redistribution` / `cache_policy` 是策略分桶，不是法律意见。交易所与行情条款限制再分发；没有授权时只链接 + 短引用。

## v0.2 复用路线

插件保持"信源可信度核心"定位，不变成数据网关或交易系统。v0.2 需要给 Grok 或其他 agent 复用时，优先接成熟组件，而不是为每个模型写 adapter：

| 层 | 复用 | v0.1.5 不接的原因 |
|---|---|---|
| 接入 | **MCP**（spec `2026-07-28`）——把 `source_find` / `source_audit` 暴露成一个 MCP server | 会动协议层与工具面；MCP Registry 仍是 preview |
| 血缘 | **OpenLineage**（Linux Foundation）记录未来数据网关的 dataset/job/run 血缘 | 当前没有数据管线 |
| 数据质量 | **Great Expectations / dbt tests**，用 **BCBS 239** 原则做清单 | 119 条静态注册表用它属过度工程 |
| 身份 | **FIGI / OpenFIGI** 做 instrument identity；FIBO 仅作术语参考 | 当前没有 instrument master |
| PIT | **ALFRED / Sharadar / Compustat-WRDS** 的 vintage（已在注册表） | 已经复用 |

BCBS 239 四维对应现有字段：准确性 → `semantic_verified` / `production_approved`；完整性 → `data_types` + 覆盖；时效性 → `freshness_sla` / `refresh_days` / `last_checked`；适应性 → `npm run health` + 探测 `snapshot_id`。

明确不作为可靠性机制复用的：多 Agent 辩论、把自由网页搜索当行情主源、用 LLM 自检替代硬风控（硬止损必须在模型之外）。

## 限制

- 工具**只查注册表**；不抓页面、不调 API、不自行验证断言。
- `qt_source_audit` 是机械检查（抽 URL、匹配置信度、映射等级、统计无来源段落），不判断被引源是否真的支持那句话。
- 脱敏只覆盖常见凭据参数名与 userinfo；非标准参数名可能漏过。原始 URL 只用于匹配，插件不记录它。
- `same_host_ambiguous` 一律按 not known 报告；未注册的合法深层链接会一直 ambiguous，直到注册表补录。
- A/B 级降低风险，但不保证正确。`verification` 只记录核过什么、什么时候核的——`reachable` 不是数据质量分。费用、限额、端点都会变——依赖数字前重新探测。
- 不在注册表里的 URL 一律标 unknown，即使它本身合法。
- 插件不执行交易、不存 API key、不提供法律/合规意见。交易需要在模型与交易所之间加一层确定性的风控。

## 许可

MIT。注册表只含源名称、URL 与策略元数据；被引内容仍归各源自己的条款。
