# 本地工作台 v0.2

双击本目录的 `打开工作台.cmd`。启动器会检查并启动仅本机可访问的服务，再打开 `http://localhost:8869`。不需要安装新依赖；使用本机已有Node和Python。v0.2真实资料、来源预览、媒体及刷新功能需要本机服务，不再直接加载私人资料JS到静态页面。

八板块已加入真实项目、作品家族、Skill说明、Obsidian入口和有来源的想法。支持任务勾选、试用清单、备注、便签及复盘。记录保存到`preview/local-data/user-state.json`，上一份保留为`user-state.previous.json`，浏览器保留恢复副本。启动时比较修改时间，保留较新副本；AI与连接页支持手动备份到D盘。本机文件和浏览器副本不是异地备份。

如需HTTP预览，在本项目目录运行：

```powershell
node D:\Codex\personal-workbench\preview\server.cjs
```

打开 http://127.0.0.1:8869 。服务器只监听本机，只提供dist目录，不暴露项目上下文或来源资料。

资讯支持手动刷新5个固定官方源，显示发布日期、真实抓取时间及逐源失败，失败时保留旧条目并标“上次缓存”；每源最多10条，不代表覆盖全网。当前不自动采集、不连接平台账号、不启用付费模型。工具介绍与官方发布动态分别展示。API与中转页只保存地址/模型草稿，不接收密钥、不试连；搜索与模型接入分别规划。

资料复用旧索引并补查新记录，未逐句重读所有聊天。作品存在不等于已发布或有业务效果；Skill说明可读不等于已启用或稳定可用。原知识库和工程只读。AI主线与首条选题以较新有来源记录为准，不复活已退出候选。

私人元数据、扫描脚本、缩略图、记录与备份仅在`preview/local-data/`，不入Git；资讯缓存在`preview/public-cache/`，不入Git。源文件通过ID白名单读取，没有任意路径/URL代理；Host/Origin/跨来源资源保护只允许本机同源页面访问。原件不移动，媒体采用受控流式预览。

本地资料整理后运行 `node preview/tools/build-library.cjs` 可重新核对并汇总既有入口。此命令不重新审阅全部聊天；本轮私有盘点脚本和覆盖详情位于local-data。UI“重新核对入口”只检查已有文件。不要把原始会话、完整知识库或整个资料目录上传。

原生HTML/CSS/JavaScript，无npm运行依赖。Lucide图标来自lucide-static@0.468.0，许可见dist/assets/LUCIDE-LICENSE.txt；SVG是本地文件，不请求CDN。功能按钮采用可访问的原生控件，没有生成位图按钮。

GitHub参考与取舍见`docs/frontend/PUBLIC-REFERENCES.md`。本轮未安装Homarr、Homepage、SiYuan或Karakeep，也未复制其项目代码。

验证：`node --test preview/tests/*.test.cjs`（PowerShell可显式列出测试文件）。
