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
