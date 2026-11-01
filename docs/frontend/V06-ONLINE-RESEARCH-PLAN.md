# v0.6 本地联网搜索与AI研究

用户已明确授权关键词→参考/对标内容/选题→一键加入选题或今天任务，只做本地。真实验收上限搜索1次、文字研究1次，失败不追加、0生图。此本轮特别预算优先于额外Jev调用：记录needs_review，未调用Jev/未模拟；子任务也不追加外部模型检查。

沿用已确认研究工作流和原生UI，新增后端Tavily basic搜索，复用现有文字relay。已查Tavily官方API及tavily-ai/tavily-js；本轮不安装SDK，使用内置HTTP。Tavilykey只读进程环境TAVILY_API_KEY；现有文字密钥只由原relay内部读取，不打印/复制。不把本机项目、知识、备注或客户资料附带到搜索或模型。

## 接口

- GET /api/web-research/status：配置布尔值、busy、recent完整最近研究（不含密钥）。只读不调用上游。
- POST /api/web-research/search：严格query/requestId，手动header。返回持久化search对象{id,query,fetchedAt,provider,sources:[{id:'S1',title,url,snippet,publishedAt:null}]}。id等于requestId（UI使用web-search-UUID）。Tavily固定https://api.tavily.com/search，basic/general,max_results6,include_answer/raw_content/images false,auto_parameters false，绝不自动重试。
- POST /api/web-research/analyze：严格searchId/requestId，服务端读取缓存公开来源构造≤4000字符提示，原relay单次文字研究。返回{searchId,requestId,analysis:{summary,benchmarks:[{title,angle,sourceIds}],topics:[{title,problem,steps,check,sourceIds}]},warnings,metadata}。模型只输出来源ID，引用只可指向缓存来源，不能生成新URL/账号数据。截断或坏JSON不得伪装完整研究；保留已搜参考，显式失败，不暗中追加。
- GET /api/web-research/search/:id：恢复已有公开研究，不付费。

所有新接口沿用本机Host/Origin保护。搜索和AI各自单活动任务、requestId幂等及重启processing状态不明禁止自动重发；数据保存在local-data/web-research独立目录，保留失败/来源/日期/实际覆盖。上游key和错误原文不得进前端或日志。URL只作为公开原文链接，不服务端任意抓取。

## 文件与分工

backend：lib/web-research.cjs、tests/web-research.test.cjs。createWebResearch({dir,searchClient,analyzeText,configured,maxSearchCalls})，方法status/search/analyze/getSearch，所有外部调用均依赖注入可离线测试；默认搜索transport由总控注入。

UI：dist/online-research-ui.js、online-research.css、tests/online-research-ui.test.cjs。window.WBOnlineResearchUI(ctx,helpers)，ctx为既有esc/icon/badge/heading/modal/toast/render/getState/save/go；helpers.createTopic/addTask。返回init/view/handleClick/handleSubmit/handleInput/openSaved。研究页顶部新增本地资料/联网研究模式，输入词后显式点击触发。UIsearch请求ID web-search-UUID，AI web-ai-UUID。只搜索或搜索+AI，状态分段，错误保留来源，最近研究可恢复。每个参考、对标建议、选题都能本地转任务或选题，来源保留链接与searchId；source={type:'research',origin:'web-research',id:search.id,label:query,url:首个引用URL}。任务sourceType research/sourceId同searchID。

controller：可信固定Tavily HTTPS POST transport（凭据仅在内存/stdin/env）、relay研究token预算、server/routes、enrich/index合并入口、来源回链与指纹、真实验收计数、原数据保护、最终文档/本地Git。0.4.1公网演示及其冻结生成源不变。

## 验证

先做离线失败测试：字段白名单、缺key、输入疑似密钥拒绝、无结果、URL/来源去重与安全、上下游错误不泄漏key、搜索requestId去重与重启恢复、AI只发缓存公开字段、无效来源ID/截断/坏JSON、busy与验证预算不重试、UI来源呈现/一键保存与失败恢复。

全量回归后，启用search最多1次、relay最多1次的临时验证cap，用泛化公开关键词实测；原始请求和计数本机回执。成功结果留作真实研究，不把本地QA记录当业务成果。测试选题/任务按ID清理，保留原notes/growth资料。最后恢复正常“每次明确按钮调用”的手动模式，记录未经真实验证的限制。不需要部署、推送、定时任务或新账号权限。
