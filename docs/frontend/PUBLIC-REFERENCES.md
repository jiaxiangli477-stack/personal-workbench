# 公开参考与无需 AI API 的资讯模块

核验日期：2026-10-29。仅查询公开官方页面、GitHub README / LICENSE / 仓库元数据与固定 RSS/Atom；没有安装参考项目，没有连接用户账号、发送项目私有资料、调用付费 AI API 或部署。

## 四个成熟项目的取舍

| 项目与已核验能力 | 许可证、运行与维护代价 | 可借鉴的布局（本项目设计判断） |
|---|---|---|
| [Homarr](https://github.com/homarr-labs/homarr)：拖拽网格、应用入口、组件与用户权限；官方介绍实时组件采用 WebSocket / tRPC / Redis。 | [Apache-2.0](https://raw.githubusercontent.com/homarr-labs/homarr/dev/LICENSE)。[官方推荐 Docker Compose](https://homarr.dev/docs/getting-started/installation/docker/)，持久化 appdata、配置加密密钥；系统版本退回还须匹配数据库备份。完整部署与迁移成本高于当前本地页面。 | 总览只放当前任务、近期项目与少量重要资讯；分组清楚、每块一个明确动作。借鉴模块分组，不在本轮增加自由拖拽与服务器组件。 |
| [Homepage](https://github.com/gethomepage/homepage)：服务入口、书签、搜索、信息组件；YAML 配置、Docker 服务发现，后端代理第三方请求。 | [GPL-3.0](https://raw.githubusercontent.com/gethomepage/homepage/dev/LICENSE)。[README](https://raw.githubusercontent.com/gethomepage/homepage/dev/README.md)提供 Docker 和 pnpm 构建方案，运行数据/配置与前端分离；远端访问要另做访问保护。仍需维护服务和配置。 | 左侧稳定导航、主区按主题分组；顶部简要状态，详细条目再展开。服务在线状态与业务进展分别显示，避免混淆。 |
| [SiYuan](https://github.com/siyuan-note/siyuan)：块引用、双向链接、Markdown 编辑、多标签、分屏与知识检索。 | [AGPL-3.0](https://raw.githubusercontent.com/siyuan-note/siyuan/master/LICENSE)。[README](https://raw.githubusercontent.com/siyuan-note/siyuan/master/README.md)说明大部分功能免费，部分会员功能收费；AI 写作/问答采用 OpenAI API。Docker 方案有客户端和导入导出限制，不能默认等同桌面端。 | 知识页面采用“主题索引 → 摘要/关联项目 → 主知识源链接”，保留来源和更新时点。这里承接工作，不复制第二份 Obsidian。 |
| [Karakeep](https://github.com/karakeep-app/karakeep)：链接/笔记/图片收藏、列表、全文搜索、规则管理与 RSS 收集。 | [AGPL-3.0](https://raw.githubusercontent.com/karakeep-app/karakeep/main/LICENSE)。[官方安装文档](https://docs.karakeep.com/installation/docker/)采用 Docker Compose；自动标签/摘要的 OpenAI 配置是可选项，也支持本地模型。搜索、抓取和归档增加服务与存储维护，部署本地模型仍有硬件成本。 | 资讯先进入收件箱，再由人决定收藏、转任务或建立内容选题；每条保留原链接、日期和简短摘要，不用“收集很多”冒充实际行动。 |

维护状态单独通过 GitHub 官方仓库 API 实际核验：四个仓库均 `archived=false`；最后推送时间分别为 Homarr `2026-10-29T08:41:14Z`、Homepage `2026-10-29T00:38:06Z`、SiYuan `2026-10-29T06:39:35Z`、Karakeep `2026-10-27T07:28:27Z`。推送活跃不等于质量或兼容性保证。来源：[Homarr API](https://api.github.com/repos/homarr-labs/homarr)、[Homepage API](https://api.github.com/repos/gethomepage/homepage)、[SiYuan API](https://api.github.com/repos/siyuan-note/siyuan)、[Karakeep API](https://api.github.com/repos/karakeep-app/karakeep)。

当前建议：复用这些项目清楚的分组、引用、收件箱和主次层级，沿用现有本地代码；本轮不引入任何项目代码或运行依赖。若未来真正采用其中代码，必须按当时固定版本重新核对许可与交付义务。此处仅记录官方许可标识，不以本次比较作法律合规结论。

## 公开资讯来源及本次实际结果

本次模块抓取尝试始于 `2026-10-29T08:45:23.956Z`，生成 40 条资讯。`updatedAt` 是整批尝试开始时点，每条 `fetchedAt` 和各源 `lastSuccessAt` 才是实际成功时点。后续刷新结果以 `preview/public-cache/news.json` 的真实内容为准。

| 固定来源 | 分类 | 本次结果 | 来源说明 |
|---|---|---|---|
| [OpenAI RSS](https://openai.com/news/rss.xml) | AI工具 | 10 条；成功于 `08:45:25.783Z` | 官方新闻与发布；不是单纯工具榜单，包含研究与公司动态。 |
| [n8n 官方 Releases Atom](https://github.com/n8n-io/n8n/releases.atom) | AI工具 | 10 条；成功于 `08:45:26.289Z` | 项目官方发布版本，可能含预发布及不同发布渠道；不表示推荐升级。 |
| [Google Search Central RSS](https://feeds.feedburner.com/blogspot/amDG) | 搜索与独立站 | 0 条；网络连接失败 | [官方博客](https://developers.google.com/search/blog)明确链接该 FeedBurner 地址。本机 Node 请求未成功；没有用网页搜索结果伪装成本次采集，也未切换未核验代理。 |
| [Cloudflare RSS](https://blog.cloudflare.com/rss/) | 搜索与独立站 | 10 条；成功于 `08:45:27.813Z` | 官方基础设施与产品动态，范围较广；不能把每篇都当作搜索排名建议。 |
| [WTO news RSS](https://www.wto.org/library/rss/latest_news_e.xml) | 外贸资讯 | 10 条；成功于 `08:45:28.956Z` | [WTO 官方 RSS 指引](https://www.wto.org/english/res_e/webcas_e/rss_e.htm)确认此新闻源并要求明确署名 WTO news；不使用 WTO 标志。 |

抓取事实仅证明公开源返回且成功解析，不证明消息适用于用户业务、覆盖全网、已完成人工阅读或试用。英文官方标题保持原文；摘要截取、去 HTML，不翻译、不生成新事实。`relevance` 是按源预设的中文适用提示，属于规则提示，并非 AI 阅读结论或效果判断。

## 模块调用与状态约定

实现：`preview/lib/public-news.cjs`、`preview/lib/feed_parser.py`；测试：`preview/tests/public-news.test.cjs`。

```js
const {getSources, readNews, refreshNews} = require('./lib/public-news.cjs');
const cacheDir = 'D:/Codex/personal-workbench/preview/public-cache';
const sources = getSources();
const previous = await readNews(cacheDir);                 // 只读，不联网
const latest = await refreshNews({cacheDir, force: true}); // 手动联网刷新
```

返回 `{updatedAt, items, sources, errors}`。资讯包含 `id,title,url,source,sourceId,category,publishedAt,summary,relevance,evidenceType,fetchedAt`；`evidenceType='official'` 表示来自固定官方源，不能当作每条内容已独立核验。缺失或无法解析发布日期时 `publishedAt=null`，不得使用抓取时间伪造发布日期。

每源最多 10 条；按移除追踪参数后的公开链接去重。同源成功 `status='ok'`，`count` 为该源本次有效条数；失败为 `status='error'`、`count=0`，并保留 `retainedCount`、`lastSuccessAt` 和错误说明。失败源只保留该源上次缓存，旧条目的 `fetchedAt` 不变。首次无缓存 `status='not_fetched'`。界面应依据源状态给保留条目标“上次缓存”，不能将其标成刚刷新成功。不同源重复链接会在列表再次去重，因此列表总条数可以少于各源 count 之和。

默认十分钟内复用缓存，`force:true` 绕过缓存；同一缓存目录在单进程中并发刷新共享同一任务。没有定时器、账号接入或隐含自动采集。固定白名单源之外不接受 URL；拒绝 HTTP 重定向；两路并发、请求最长 15 秒、每源最大 1.5 MiB，XML 解析最长 5 秒；拒绝 DTD/实体声明，解析器不访问网络。没有下载全文或附图。

Node 使用内置 fetch 与文件模块，Python 使用已有标准库 ElementTree / HTMLParser，无需安装包。本机可直接只读调用已有 Python 3.13；迁移时通过 `WORKBENCH_PYTHON` 指定已安装解释器，其他平台默认 `python3`。Python 使用 `-I -B -X utf8`，不写字节码缓存；资讯缓存明确落在 D:/E: 路径。没有把 Python 安装位置当作允许在 C: 写入的授权。

## 本次验证与研究限制

测试 6/6 通过：RSS 实体与 HTML 清理/链接去重、Atom 命名空间/上限/缺失日期、失败源保留旧资讯及抓取时点、拒绝 DTD 与 HTML 错误页、缓存复用/损坏缓存提示、超长响应与禁止重定向；`node --check` 通过。完整测试命令：

```powershell
node --test 'D:/Codex/personal-workbench/preview/tests/public-news.test.cjs'
```

按既有公开研究路由尝试 WebGPT：已确认已登录且处于 Chat，现有技能 dispatch helper 返回 `tab.getAXState is not a function`；没有成功提交提示、没有返回研究结果，因此本次不算 WebGPT 委派。已关闭本次新开的未提交页面；比较由 Codex 直接核验上述官方资料完成，没有更改浏览器或技能配置。Jev 由总控在本轮前段完成通用检查；本子任务遵循用户本轮不增加付费 AI 调用的选择，不再额外调用或切换模拟。

未验证：GitHub 项目的实际安装/使用体验、未来部署和迁移、本模块之外的页面整合；这些由总控另行验收。本模块已真抓取的 4 个官方源和 Google 连接失败应同时展示，避免用“刷新成功”掩盖局部失败。
