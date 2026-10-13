# 高性价比人生指南 · 网站

一个装在 Cloudflare 上的网站版：把仓库里的正文（`book/`、`docs/`、`README.md`）变成一个
可以装到手机上、离线也能看的应用。移动端优先，有搜索、筛选、生活自查、收藏和阅读进度。

## 是什么技术

没有框架，没有构建依赖，没有运行时依赖：

- 数据：`node tools/site/build.mjs` 把正文解析成 `site/data.json`（只用 Node 内置模块）。
- 前端：`site/` 下的原生 HTML / CSS / JS，路由用 hash，静态托管即可。
- 离线：`site/sw.js` 是 Service Worker，应用外壳缓存优先，`data.json` 先给旧的再后台更新。
- 图标：`tools/site/icons.mjs` 用 Node 的 zlib 手写 PNG，不引 sharp / canvas。

选零依赖是因为仓库里的其它工具（EPUB、PDF、离线单文件、Anki）都是这个路子，而且
CI 和本地都不需要联网装包，出问题好查。

## 本地跑

```bash
node tools/site/build.mjs          # 生成 site/data.json 和 site/icons/
python -m http.server 8000 -d site # 或者 npx serve site
# 浏览器打开 http://localhost:8000/
```

注意必须经 http 打开：直接双击 `index.html` 会读不到 `data.json`。

## 部署到 Cloudflare Pages

### 方式一：Git 集成（推荐）

1. Cloudflare 控制台 → Workers & Pages → 新建 Pages 项目 → 连接 Git 仓库。
2. 在构建设置（Build Settings）中配置：
   - 构建命令（Build command）：`node tools/site/build.mjs`
   - 输出目录（Build output directory）：`site`（也会自动从 `wrangler.toml` 读取）
   - Node 版本：22（默认即可，脚本只用了内置模块）
   *(注意：Cloudflare Pages 的 `wrangler.toml` 暂不支持 `[build]` 配置段，构建命令需在控制台界面中指定)*
3. 保存并部署。以后正文一改，push 到 main 就会自动重建。

### 方式二：命令行

```bash
node tools/site/build.mjs
npx wrangler pages deploy site --project-name=howtolivebetter
```

首次部署需要登录 `npx wrangler login`，或者设置 `CLOUDFLARE_API_TOKEN` 和
`CLOUDFLARE_ACCOUNT_ID` 两个环境变量。

### 方式三：GitHub Actions

仓库里带了 `.github/workflows/site.yml`。在仓库的
Settings → Secrets and variables → Actions 里配好：

- `CLOUDFLARE_API_TOKEN`：权限至少要有 **Pages: Edit**
- `CLOUDFLARE_ACCOUNT_ID`

配好之后，`book/`、`docs/`、`README.md` 或 `site/` 一有改动，就会自动构建并发布。
没配 Secret 时这个工作流会整条跳过，不会把 CI 弄红。

## 目录

```
site/
  index.html            应用外壳
  app.js                应用逻辑（路由、渲染、搜索、自查、设置）
  styles.css            样式（明暗主题、移动端优先）
  sw.js                 Service Worker
  manifest.webmanifest  PWA 清单
  icon.svg              图标（矢量，浏览器标签页用）
  _headers              Cloudflare 的响应头和缓存策略
  data.json             ← 构建产物，不入库
  icons/                ← 构建产物，不入库
tools/site/
  build.mjs             正文 → data.json
  icons.mjs             手写 PNG 图标
wrangler.toml           Cloudflare Pages 配置
```

## 和仓库里其它出口的关系

正文只有一份（`book/` + `docs/` + `README.md`），这个网站和 EPUB、PDF、离线单文件、
Anki 牌组一样，都是从同一份正文生成的出口。改正文不用动网站代码；改了正文的解析规则，
要同时看 `tools/site/build.mjs`、`index.html` 和 `selfcheck.html`——三处读的是同一批正文。

## 许可

正文 CC BY 4.0，代码 MIT，和仓库一致。
