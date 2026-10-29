# 本地工作台预览 v0.1

双击本目录的 `打开工作台.cmd`，或直接打开 `dist/index.html`。不需要安装依赖。

八板块均可浏览；支持任务完成/取消、新增任务、工具加入尝试、板块备注、画板便签和日周月复盘草稿。所有改动保存在当前浏览器的localStorage中。文件打开与HTTP打开的数据可能各自独立；不要把浏览器记录当作可靠备份。

如需HTTP预览，在本项目目录运行：

```powershell
node D:\Codex\personal-workbench\preview\server.cjs
```

打开 http://127.0.0.1:8869 。服务器只监听本机，只提供dist目录，不暴露项目上下文或来源资料。

工具信息引用2026-10-29核对过的公开来源；未实测、未连接账户，资讯未自动更新。首页建议任务是试排，不代表用户已有真实待办；项目阶段不冒充业务完成比例。备注、便签和复盘仅供本地体验。

原生HTML/CSS/JavaScript，无npm运行依赖。Lucide图标来自lucide-static@0.468.0，许可见dist/assets/LUCIDE-LICENSE.txt；SVG是本地文件，不请求CDN。功能按钮采用可访问的原生控件，没有生成位图按钮。

验证：`node --test D:\Codex\personal-workbench\preview\tests\model.test.cjs`
