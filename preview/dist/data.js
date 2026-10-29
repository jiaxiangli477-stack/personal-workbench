window.WBData = {
  sections:[
    {id:'home',name:'首页总览',short:'今天',icon:'house',desc:'先看今天要做的事，再看项目进度和与你相关的新机会。',help:'这里汇总各个板块的信息。勾选任务、打开项目或查看工具详情，就可以从今天的一小步开始。'},
    {id:'projects',name:'目标·项目·流程',short:'项目',icon:'target',desc:'知道为什么做、做到哪一步，以及下一步怎么推进。',help:'目标连接项目，项目拆成任务。流程是可以重复使用的步骤；完成证据说明这一步到底做成了什么。'},
    {id:'content',name:'自媒体与作品',short:'自媒体',icon:'clapperboard',desc:'从真实工作案例出发，做成能让同行照着实践的内容。',help:'三个平台共用选题和素材，各自保留内容版本与发布记录。两天一发是整体目标，不是每个平台都要求两天一发。'},
    {id:'business',name:'独立站与外贸业务',short:'外贸业务',icon:'globe',desc:'把网站、客户需求和供应链的下一步放在一起看。',help:'这里承接各业务项目的摘要和入口。网站真实状态、客户沟通和供应商核实，仍需要在原项目确认。'},
    {id:'knowledge',name:'知识与 AI 能力',short:'知识与能力',icon:'book-open',desc:'找到已有的方法、工具和实践，让经验可以再次使用。',help:'Obsidian继续保存长期知识正文，这里记录入口、用途和实践证据。工具已安装，不代表已经稳定可用。'},
    {id:'radar',name:'资讯与机会',short:'资讯与工具',icon:'radar',desc:'看懂新变化，挑一件真正对你有用的事去尝试。',help:'资讯覆盖AI、外贸运营、独立站和内容平台。官方介绍、用户案例和亲手实测分别记录；推荐尝试不会自动执行。'},
    {id:'board',name:'思考画板',short:'画板',icon:'lightbulb',desc:'把零散想法摊开，慢慢找到值得推进的方向。',help:'这里先用想法便签整理关联。想法可以保留、延伸或转成任务；第一版支持新增便签，连线与自由拖拽留待后续。'},
    {id:'review',name:'复盘与成长',short:'复盘',icon:'chart-no-axes-combined',desc:'回看投入与积累，决定接下来继续什么、调整什么。',help:'日记录留下一步，周复盘做取舍，月复盘看方向。记录保存在当前浏览器，不会自动写入Obsidian。'}
  ],
  tasks:[
    {id:'case',title:'挑一个真实案例，写清要解决的问题',minutes:20,tag:'内容准备',body:'建议从已有的外贸社媒工作台或产品属性填写案例中选择一个。只写清“原来遇到什么问题、AI做了哪一步、结果怎么检查”。',evidence:'完成标准：一段问题描述＋一个可核对的资料入口。'},
    {id:'outline',title:'整理成一条内容的讲解提纲',minutes:25,tag:'自媒体',body:'建议采用“问题 → 操作 → 结果 → 注意事项”的顺序。先用现有素材，不增加复杂动画。',evidence:'完成标准：提纲能让外贸运营同行理解操作过程。'},
    {id:'reflection',title:'留下今天的进展和下一步',minutes:15,tag:'日记录',body:'记录实际用时、今天做到了什么、卡在哪里。剩余时间可用于核对资料与整理备注。',evidence:'完成标准：下一次打开就知道先做哪一步。'}
  ],
  projects:[
    {id:'creator',title:'AI 实操自媒体',category:'内容与账号',icon:'clapperboard',stage:'准备首条内容',steps:['方向确认','案例准备','制作检查','发布反馈'],current:1,desc:'给外贸运营同行讲清楚，怎样用 AI 解决实际工作问题。',next:'选择一个有资料、有操作过程的真实案例。',evidence:'方向、受众、每天约1小时已确认；首条内容尚未选定，发布和效果未核实。',route:'content'},
    {id:'workbench',title:'个人成长与业务工作台',category:'个人项目',icon:'layout-dashboard',stage:'本地页面预览',steps:['框架讨论','本地预览','使用调整','后续部署'],current:1,desc:'连接目标、项目、证据、知识和下一步，成为长期使用的工作入口。',next:'点击体验各个板块，记录需要调整的地方。',evidence:'当前可浏览页面；服务器、远端仓库和账号接入尚未配置。',route:'projects'},
    {id:'packrivo',title:'Packrivo 独立站',category:'网站与业务',icon:'globe',stage:'线上状态待复核',steps:null,current:0,desc:'持续推进包装采购协调业务，连接产品内容、获客和客户需求。',next:'回原项目核对最新网站验收与业务跟进。',evidence:'这里只引用项目背景；没有在本预览中重新核实线上状态或客户成果。',route:'business'}
  ],
  tools:[
    {id:'grok',name:'Grok Bot',monogram:'G',type:'AI 工具',tone:'indigo',label:'推荐了解',title:'把多步工作，交给一个 AI 队友',summary:'了解能使用浏览器和文件、持续处理任务的智能体。',benefit:'适合观察：公开资料收集与整理，能否少一些来回复制。',capability:'官方介绍：在持久云端电脑上使用浏览器、文件与工具，处理多步骤工作并保留上下文。',cases:'官方场景包括客户研究、联系优先级整理和广告表现分析。这是厂商示例，尚非本人的实测结果。',trial:'选3个公开同行网站，整理产品、受众与内容差异；每个判断都附来源。',criteria:'核对至少3个结论能否回到原网页，检查有没有自行编造。',minutes:25,source:'https://docs.x.ai/grok-bot/overview',sourceName:'Grok Bot 官方文档',date:'2026-10-29',limits:'需要核对账号订阅和可用额度；本机尚未试用。推荐本身不触发安装、连接或付费。'},
    {id:'muse',name:'Muse',monogram:'M',type:'AI 工具',tone:'teal',label:'值得尝试',title:'从一个目标，整理出可执行的计划',summary:'暂按 Meta 个人智能体介绍，关注任务规划与后台执行。',benefit:'适合观察：能否把模糊目标变成少而清楚的下一步。',capability:'Meta官方介绍：协助目标规划、使用浏览器处理任务，可在关闭应用后继续工作。',cases:'官方举例包括行程、邮件和长期目标安排；能力与实际账号可用性仍需试验。',trial:'用虚构的一周任务做计划，再增加一件临时工作，观察它怎样重新安排。',criteria:'计划是否留出可用时间，调整时是否遗漏任务，下一步是否清楚。',minutes:20,source:'https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/',sourceName:'Meta 官方介绍',date:'2026-10-29',limits:'Muse存在同名产品，此处指Meta版本；地区、账号与费用需核对。未连接个人账户或实测。'},
    {id:'trade',name:'外贸运营观察',monogram:'贸',type:'外贸运营',tone:'amber',label:'关注方向',title:'平台的新变化，与你的工作有什么关系？',summary:'关注平台规则、获客方式和买家需求变化。',benefit:'帮助你发现需要调整的运营动作或可讲解的选题。',capability:'此条是资讯栏目示例，并非一条已核实的最新新闻。',cases:'后续每条资讯会附官方公告或可追溯案例。',trial:'挑一条官方平台公告，写出受影响的工作环节和一个待验证动作。',criteria:'有原始来源、日期，且明确区分事实和自己的判断。',minutes:15,source:null,date:'栏目示例',limits:'未接入自动抓取，也没有虚构最新平台规则。'},
    {id:'seo',name:'独立站与获客',monogram:'站',type:'独立站',tone:'blue',label:'关注方向',title:'把搜索和内容变化，连接到网站下一步',summary:'整理SEO/GEO、产品内容与询盘转化相关的信息。',benefit:'优先关注能帮助你改进真实产品页面或客户承接的变化。',capability:'此条是资讯栏目示例，当前没有实时流量或排名数据。',cases:'后续可收集有来源的网站改进案例，分别记录操作与结果。',trial:'挑一个公开产品页面，检查它是否回答了买家最关心的3个问题。',criteria:'给出原文依据和建议；不把修改建议当作流量提升证明。',minutes:20,source:null,date:'栏目示例',limits:'网站真实数据和修改，需回到原项目核对与执行。'}
  ],
  ideas:[{title:'一个案例，可以怎样延伸？',body:'外贸问题 → AI操作 → 验收方法 → 实操内容。',lane:'灵感收集'},{title:'观众反复问的问题',body:'记录能否形成下一条内容，或者值得验证的服务需求。',lane:'延伸思考'},{title:'先让流程变得清楚',body:'每件事都有下一步、完成标准和证据入口。',lane:'准备行动'}],
  workflows:['明确问题','准备资料','动手操作','检查结果','留下证据','复盘复用']
};
