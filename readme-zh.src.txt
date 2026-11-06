# quantitativeTrading-source-reliable

[English](README.md) · 简体中文

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的量化金融与加密交易信源插件：内置 **100 个实测可采集的信源**，带权威分级、PIT（Point-in-Time）与免费额度标记，并给模型两个工具——查源、审引用。

这是 DSH 插件（`dsh`）。注册表以数据形式打包，两个工具都是本地查表（不联网），所以很快、没有副作用。它与 [`cs-source-reliable`](https://github.com/uhygyuf/cs-source-reliable) 完全独立，可以单独安装。

## 它装了什么

- **100 个信源** —— 58 个 `quant`（监管申报、宏观、基本面、A股/港股、执行接口）+ 42 个 `crypto`（交易所、衍生品、链上、归档、SDK、新闻）。
- 每条源包含：域、类别、权威级（`A` 监管/交易所/官方文档，`B` 机构数据商/同行评审，`C` 可靠二手，`D` 仅线索）、证据类型、`content_access`（static / portal / js / challenge / api / binary）、`license_class`、`cache_policy`、`attribution`、`refresh_days`、`last_checked`，以及按需出现的 `pit`、`free_tier`、`auth`、`iface`、`history_start`。
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

## 覆盖

**quant（58）** —— filing 7、market-data 14、china 14、macro 10、fundamentals 5、research 3、news 3、execution 2。
含 SEC EDGAR 与 `data.sec.gov` XBRL API、SEC 13F/Form 4 数据集、FINRA 空头、CFTC COT、Cboe DataShop、巨潮/上交所/深交所/港交所、FRED + ALFRED、BLS/BEA/财政部/IMF/世界银行/BIS/OECD/ECB、国家统计局/人民银行/中国货币网、Massive/Alpaca/Databento/Tiingo/Alpha Vantage/Finnhub/Twelve Data/Nasdaq Data Link/OpenBB、Sharadar/Compustat-WRDS/CRSP/OptionMetrics/FMP、Tushare/AKShare/CNEquity/Wind/iFinD/聚宽/米筐、IBKR/Alpaca Trading、NBER/SSRN/arXiv q-fin/GDELT/Benzinga/RavenPack。

**crypto（42）** —— exchange 17、on-chain 8、news 4、archive 3、aggregator 3、SDK 3、market-data 2、derivatives 1、research 1。
含 Binance（REST/WS/Agent Native/llms.txt/MCP/testnet/归档）、Bybit/OKX/Coinbase/Kraken/Deribit、CoinGecko（API + 免 key MCP）/CoinMarketCap/CoinGlass、Kaiko/Coin Metrics、Glassnode/Nansen/CryptoQuant/Etherscan/Dune/DefiLlama/Blockchair/mempool.space、Tardis/CryptoHFTData、ccxt/binance-connector-python/python-binance、Binance Research。

**构建时实测分布**：auth `none` 52 / `key` 34 / `account` 14；PIT `yes` 3 / `partial` 13 / `no` 84；访问方式 static 63 / portal 10 / js 4 / api 8 / challenge 14 / unknown 1。

## 工具

### `qt_source_find`

按 URL、关键词或域查源。

- `url` —— 匹配页面（域名 + 路径前缀）。
- `query` —— 关键词，如 `"binance funding rate"` 或 `"sec xbrl"`。
- `domain` —— `quant` 或 `crypto`。
- `layer` —— `breadth`（稳定/一手）或 `depth`（快速变化）。
- `limit` —— 最多返回条数（默认 5，上限 20）。

```
- [binance-ws-futures] Binance USD-M Futures WebSocket Streams — crypto/exchange; A/spec; access=static; pit=no; auth=none; refresh=90d; https://developers.binance.info/en/docs/derivatives/usds-margined-futures/websocket-market-streams
  note: 公开行情 wss://fstream.binance.com/ws/<stream>（或 /stream?streams=）；私有用户流 /private/ws/<listenKey>。不存在 /public 或 /market 路径。
```

排序用 IDF 式词权重 + 主语词加权，所以 `"binance funding rate"` 会把交易所/衍生品源排在泛化的 "rate" 页面前面。

### `qt_source_audit`

审一份草稿里的 URL 引用：映射到已知源，报告域、权威级与 PIT 标记，标出未知域名与 C/D 级引用，统计没有来源的实质段落，并给修改建议。

```
Citations: 3/3 audited, 2 known, 1 unknown; A=2 B=0 C=0 D=0; uncited paragraphs=0
- https://developers.binance.info/en/docs/.../websocket-market-streams -> binance-ws-futures (crypto, A/spec, pit=no)
- https://alfred.stlouisfed.org/ -> alfred (quant, A/official-doc, pit=yes)
- https://example.com/post -> unknown; not in the registry: verify the domain yourself before relying on it
```

## 触发规则

插件不拦截请求。由模型按 system prompt 引导（order 241）决定：

- 在陈述行情、交易所端点、费用、限流、PIT 事实前，先调 `qt_source_find`；
- 优先 A/B 源，C 只当二手，D 只当线索、不能当结论；
- 引用写成 `[source-id] URL`，并带上源站声明的日期或版本；不要凭空写费用、限额或端点路径；
- 把 `pit` 与 `free_tier` 当作**带日期的断言**，不是永久事实；
- 草稿里有 URL 就调 `qt_source_audit`；
- 量化金融与加密之外的话题，两个工具都跳过。

## 实测开销（2026-11-06）

| 项目 | 实测 |
|---|---|
| `qt_source_find` schema（名称+描述+参数） | 953 字符 ≈ 239 tokens |
| `qt_source_audit` schema | 470 字符 ≈ 118 tokens |
| 引导段 | 804 字符 ≈ 201 tokens |
| **每请求合计开销** | **≈ 557 tokens**（schema + 引导） |
| 注册表加载 | 2.0 ms |
| `qt_source_find` 延迟 | 平均 0.095 ms，p95 0.205 ms（5000 次） |
| `qt_source_audit` 延迟 | 平均 0.018 ms（3008 字符草稿，500 次） |

token 数是按 4 字符/token 的字符估算。若与 `cs-source-reliable` 同装，合计约 1,050 tokens/请求。

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

YAML 矩阵是事实来源，`data/sources.json` 由它生成。

```sh
npm install                 # 开发依赖：yaml
node tools/probe-sources.cjs --file=quant --apply    # 探测并写回快照
node tools/probe-sources.cjs --file=crypto --apply
npm run build:data          # 重建 data/sources.json
node test/check.mjs         # 38 项检查：注册表、工具、无损 JSON、延迟预算
```

`tools/probe-sources.cjs` 会为每条源记录 `content_access`、`last_checked` 与探测快照。反爬站点（Cloudflare / 202 / 401 / 403）记为 `challenge`，不当作有效数据响应。

## 数据来源与维护

- 全部信源在 **2026-11-06** 探测：85 条 HTTP 200；14 条返回 challenge（SEC 各端点、BLS、SSRN、Benzinga、Binance testnet/research、CryptoQuant、Blockchair，在本网络下）；1 条不可达（World Bank）。
- `refresh_days` 按类别给建议：规范 90 天、官方/数据商文档 30 天、数据集/API 14 天、同行评审 365 天。`last_checked` 是探测日期。
- `license_class` / `cache_policy` 是策略分桶，不是法律意见。交易所与行情条款限制再分发；没有授权时只链接 + 短引用。

## 限制

- 工具**只查注册表**；不抓页面、不调 API、不自行验证断言。
- `qt_source_audit` 是机械检查（抽 URL、映射等级、统计无来源段落），不判断被引源是否真的支持那句话。
- A/B 级降低风险，但不保证正确。费用、限额、端点都会变——依赖数字前重新探测。
- 不在注册表里的 URL 一律标 unknown，即使它本身合法。
- 插件不执行交易、不存 API key、不提供法律/合规意见。交易需要在模型与交易所之间加一层确定性的风控。

## 许可

MIT。注册表只含源名称、URL 与策略元数据；被引内容仍归各源自己的条款。
