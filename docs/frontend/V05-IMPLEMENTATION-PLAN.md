# v0.5 本地第一期实施计划

日期：2026-11-01。用户已批准WORKBENCH-GROWTH-PROPOSAL-2026-11-01.md的第一期，并指定Packrivo试点。本轮只在原D盘工程实现、验证和交付，不部署、不推送、不接账号、不安装依赖、不运行应用付费生成或定时任务。

## 技术与交互决定

沿用原生HTML/CSS/JS、Node及现有本机API/安全边界。主状态保持version2；新参考/对标/研究/IP资料使用独立growth-state.json，避免破坏式迁移。选题和任务只增加兼容的可选字段，原记录先备份。八个主导航保持清楚，旧资讯与AI路由继续可达。

新增API仅供同源本机：GET/POST /api/growth；GET /api/site-health，POST /api/site-health/check。Packrivo仅固定公开HTTPS端点，检查手动触发，不请求后台、登录接口或提交表单。GSC/GA4/询盘指标明确显示未接入。

## 并行任务与文件所有权

- [x] growth_model：dist/growth-model.js、lib/growth-store.cjs及对应tests。纯模型负责空值/URL/文本校验、参考/对标/主题/IP保存、跨类型搜索。独立本地store负责校验、原子写和上一份备份。不得读写现有用户状态或密钥。
- [x] growth_ui：dist/growth-ui.js、dist/growth.css及对应tests。统一搜索、参考/研究/对标表单与详情、IP定位/系列；结果可转选题/任务；加载失败不覆盖已存数据。
- [x] topic_flow：dist/model.js、topic-ui.js、daily-ui.js、app.js的任务详情及对应tests。兼容旧v2；选题简化创建与折叠阶段，任务返回选题并保存结果/证据。app.js交付后总控再作入口集成，不并行改同文件。
- [x] 总控：Packrivo lib/site-health.cjs、dist/site-health-ui.js、tests；server/index/data/enrich/styles入口、首页与CSS整合；旧公开演示生成器固定v0.4.1基线；原始备份、QA清理、状态文档与收尾。

## 新资料契约

```js
{
  version:1,modifiedAt:0,
  references:[],benchmarks:[],research:[],
  profile:{positioning:'',audience:'',promise:'',pillars:[],series:[]}
}
```

reference：id,title,url,summary,note,tags[],status,createdAt,updatedAt。benchmark：id,title,platform,url,kind,topic,hook,structure,evidence,learning,difference,note,observedAt。research：id,title,question,note,tags[],createdAt,updatedAt。profile为用户可编辑的已确认方向预填，不伪造实绩。

growth UI工厂：WBGrowthUI(ctx,helpers)，ctx含D/M/esc/icon/badge/heading/link/modal/toast/render/getState/save/go，helpers含getLibrary/getNews/createTopic/addTask/openRecord。返回init/research/ip/handleClick/handleSubmit/handleInput/search/getState/isReady。动作统一growth-前缀；POST成功才替换本机growth快照，失败保留输入和显式提示。

搜索返回稳定对象：kind,id,title,summary,sourceLabel,updatedAt,action；涵盖现有catalog、主状态任务/选题/想法、公开资讯和新growth资料。顶部快速查找和研究页共享数据集合；有来源，支持分类，未知来源不会伪装联网结果。

## 实施与验证顺序

1. 保存原user-state.json/previous与现有growth-state字节备份和SHA。记录基线，不回滚覆盖并发新记录。
2. 各负责人先写关键失败测试：新资料校验/存储、旧选题兼容、跨类型搜索、证据保存、固定域名监控与错误状态。使用临时D盘fixtures及注入网络，不读真实密钥或发付费请求。
3. 实现模块后跑各自测试；总控检查接口和diff，再整合。
4. 主页以继续选题和今日安排为重点，压缩页头/任务；研究结果和长表单按需展开，复用图标与既有品牌，检查keyboard/focus/mobile/empty/loading/error。
5. 运行node --test --test-concurrency=1 preview/tests/*.test.cjs和相关语法检查；站点监控只发一次真实手动公开检查，记录时间和失败范围，不伪造正常状态。
6. 重启确认属于本项目的本机服务，核对0.5.0与代码指纹。浏览器验收新增参考→搜索→选题→任务→证据→返回、对标/IP保存、刷新恢复、Packrivo检查与未接入指标，桌面/390布局。
7. QA按专用ID和标记清理，只删除测试记录；核对原数据仍在；独立只读代码审查后修复重要问题。保存本地Git版本、证据、CURRENT-STATE、决定和manifest，交付本地URL及截图。

Jev：route/growth_model/growth_ui选中；topic_flow为needs_review（0.78），不当权限批准。通过升级前字节备份、旧v2归一化保留测试、实际读回与独立审查处理此兼容风险，不重复请求用户已给的实施授权。


完成验证：142/142，全链路浏览器与390布局，Packrivo3入口200；同名健康检查采用本机已装PowerShell7系统网络，保留HTTPS验证。结果与限制以CURRENT-STATE和verification-0.5.0.json为准。
