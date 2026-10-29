# 半成品个人工作台

**当前版本：v0.2.1（本地迭代） · Work in progress / 半成品。**

这是一个仍在本地迭代的个人成长与业务工作台，用于连接今日任务、项目进度、知识与 Skill、作品、想法、公开资讯和复盘。当前不作为成熟产品或生产服务。

## 当前功能

- 八个工作板块与清晰的说明、备注入口。
- 方法与案例卡支持输入、步骤、检查、来源及小行动，私人提炼数据仍留在本机。
- 本地项目、作品、Skill 和知识入口目录；文件与视频按受控ID预览。
- 固定官方公开资讯源手动刷新，显示来源、日期、失败和旧缓存。
- 本机文件保存、浏览器恢复副本和手动记录备份。
- API / 中转连接仅保存非敏感草稿，尚未启用密钥或模型调用。

## 本地启动

使用已有 Node.js 24+；公开 RSS/Atom 解析另需已安装的 Python 3。

```powershell
node preview/server.cjs
```

打开 http://localhost:8869 。Windows 启动辅助脚本中的 Node 路径按实际安装位置调整；可用 WORKBENCH_PYTHON 指向已有 Python。无需部署或安装新的 npm 依赖。

## 备份范围

本仓库保存源码、测试与脱敏设计文档；**不包含私人聊天索引、用户上下文、知识库正文、素材原件、运行记录、密钥或账号登录态**。

本机资料与记录位于 preview/local-data/，公开资讯缓存位于 preview/public-cache/，均不入库。源码版本不能替代这些数据的独立备份。新电脑需要另行恢复经筛选的本地资料，否则资料目录会为空。

## 验证与当前限制

```powershell
node --test --test-concurrency=1 preview/tests/http-guard.test.cjs preview/tests/library.test.cjs preview/tests/model.test.cjs preview/tests/public-news.test.cjs
```

v0.2.0备份点曾执行20项测试及本地浏览器交互检查。资讯可达性随网络变化；未连接真实业务账号，未验证生产部署、异地灾难恢复或付费AI流程。作品存在不代表已发布或产生业务效果。

## 版本

版本号见 [VERSION](VERSION)，变更见 [CHANGELOG.md](CHANGELOG.md)。GitHub既有v0.2.0为半成品备份点；v0.2.1为本地内容迭代，不标为生产稳定版。

第三方Lucide图标许可保留在 preview/dist/assets/LUCIDE-LICENSE.txt。
