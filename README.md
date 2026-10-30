# 半成品个人工作台

**当前版本：v0.3.0（本地迭代） · Work in progress / 半成品。**

这是一个仍在本地迭代的个人成长与业务工作台，用于连接今日任务、项目进度、知识与 Skill、作品、想法、公开资讯和复盘。当前不作为成熟产品或生产服务。

## 当前功能

- 八个工作板块与清晰的说明、备注入口。
- 方法与案例卡支持输入、步骤、检查、来源及小行动，私人提炼数据仍留在本机。
- 本地项目、作品、Skill 和知识入口目录；文件与视频按受控ID预览。
- 固定官方公开资讯源手动刷新，显示来源、日期、失败和旧缓存。
- 本机文件保存、浏览器恢复副本和手动记录备份。
- AI工作区支持手动文字与生图，由本机服务按供应商和能力分别连接，主用明确失败时一次备用，显示使用线路和实际图片尺寸。
- 只发送手动输入，不自动读取私人资料作为模型上下文；密钥从Git忽略的本机私有配置读取，不进入浏览器。

## 本地启动

使用已有 Node.js 24+；公开 RSS/Atom 解析另需已安装的 Python 3。

```powershell
node preview/server.cjs
```

打开 http://localhost:8869 。Windows 启动辅助脚本中的 Node 路径按实际安装位置调整；可用 WORKBENCH_PYTHON 指向已有 Python。无需部署或安装新的 npm 依赖。

## 备份范围

本仓库保存源码、测试与脱敏设计文档；**不包含私人聊天索引、用户上下文、知识库正文、素材原件、运行记录、密钥或账号登录态**。

本机资料与记录位于 preview/local-data/，公开资讯缓存位于 preview/public-cache/，均不入库。源码版本不能替代这些数据的独立备份。新电脑需要另行恢复经筛选的本地资料，否则资料目录会为空。

AI配置放在Git忽略的 `.secrets/api-connections.private.v2.ini`；应用源码不包含凭据。新环境可参考[无密钥示例](docs/frontend/AI-CONNECTIONS.example.ini)和[AI接入计划](docs/frontend/AI-INTEGRATION-PLAN.md)填写本机配置。AI结果及图片在 `preview/local-data/ai-results/`，与任务备份分开。仓库克隆不会带回这些数据。

## 验证与当前限制

```powershell
node preview/tools/verify.cjs
```

验证脚本需要本机服务已启动。AI已做真实调用和浏览器流程验收；供应商可用性、分组权限和返回尺寸仍需分别核对，成功返回不独立证明上游模型身份。当前生图只接收经过完整结构、CRC及像素数据检查的PNG；其他格式明确拒绝。生图超时、格式或下载失败不会自动再次生成。未部署，也未验证异地灾难恢复或实际账单。作品存在不代表已发布或产生业务效果。

## 版本

版本号见 [VERSION](VERSION)，变更见 [CHANGELOG.md](CHANGELOG.md)。GitHub既有v0.2.0为半成品备份点；v0.3.0为本地AI接入迭代，尚未推送，不标为生产稳定版。

第三方Lucide图标许可保留在 preview/dist/assets/LUCIDE-LICENSE.txt。
