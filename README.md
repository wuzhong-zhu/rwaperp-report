# RWA Perp Report

独立的 RWA Perp 经营数据报表，固定 broker_id 为 `rwaperp_xyz`。

## 本地运行

```sh
python3 -m http.server 8080
```

打开 http://localhost:8080 。无需安装依赖或构建。

## 部署

GitHub Pages 从 `main` 分支根目录发布。提交到 main 后自动更新。

- `index.html`：报表页面与样式
- `rwaperp-report.js`：公开 API 请求、图表、日期筛选与 CSV 导出
- `.nojekyll`：禁用 Jekyll 处理

## 数据来源

浏览器直接请求 `data-api.orderly.network` 和 `api.orderly.org` 的公开接口，无需 API key。可用性取决于上游接口及其 CORS 设置。缺失或失败数据在页面中标明；统计口径详见页面底部。

## 市场行情与 OI

CoinGecko `/md/coingecko/contracts` 提供市场双边 OI（多头 + 空头）、按标记价格计算的 USD 值、最新价、24h 成交额、买卖价差与资金费率。双边 OI 不与原生单边 OI 直接比较；资金费率按返回的结算周期展示，不年化。行情不并入 broker 经营汇总。

BTC 对照分别请求 `/v1/public/futures_market?broker_id=rwaperp_xyz&symbol=PERP_BTC_USDC` 与无 broker 参数的同合约接口。broker OI 缺失可能回退市场值，响应没有回退标志，故不将其当成已确认的 broker OI。两次请求并非原子快照，数值差异也不能单独证明 broker 归属。

原 CMC 快照保留。所有快照独立于日期范围和每日 CSV，不提供历史 OI。缺失数据显示 —。
