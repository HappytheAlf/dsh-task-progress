# DSH 任务进度可视化插件

面向 DeepSeek Harness（DSH）的任务进度看板：以 **360px 悬浮卡**停在 DSH 窗口右边缘，不占右侧栏、不挤压聊天区，实时显示任务目标、自动拆解的阶段、子任务状态、阶段结果与整体进度。交互参考 Kimi 桌面 Agent 的任务面板。

当前适配：**DSH 0.2.2-rc.1 / Cordis 4.1.0**。0.2.2 的 `sessionProjections.register` 改为异步，插件已改为 `async apply` 并 `await` 注册。

## 现在能做什么

- 每轮新请求自动刷新为本轮看板：先显示“本轮”占位；回合结束后用本轮回复补齐；Agent 调用 `task_progress` 时替换为完整阶段计划。
- 模型通过 `task_progress` 工具维护看板；开始多步任务时自动出现。
- **窗口内右侧悬浮卡**：`shell.overlay` + `position: fixed`，宽 360px，不改变聊天区宽度。
- 会话标题栏进度环按钮：一键打开/收起悬浮卡。
- 悬浮卡右上角关闭按钮；不挡输入框，贴在窗口右边缘。
- 新看板出现时，若悬浮卡关闭，自动打开一次（20 秒新鲜度窗口）。
- `plan` 省略阶段时，插件自动拆成五阶段：目标与边界 → 执行计划 → 核心工作 → 验证修正 → 交付总结。
- 阶段支持 `pending` / `in_progress` / `completed`，可附带说明和阶段结果。
- 顶部显示目标、`4/5 完成`、环形进度与横向进度条；全完成变为“任务完成”。
- 点击阶段行展开完整说明和结果；支持“全部 / 待办 / 已完成”筛选。
- 状态写入 Session 日志，刷新、恢复、fork 后可重建；不另建数据库。
- 中英文文案，全部使用 DSH theme tokens。

## 目录

```text
plugin/                可直接安装的 bundle
  package.json         dsh.bundle + dsh.client 声明
  cordis.patch.yml     Host 行 task-progress
  index.js             task_progress 工具 + taskProgress 投影 + prompt
  client.js            shell.overlay 悬浮卡 + 标题栏入口 + 样式 + 文案
  locale/              Plugin Manager 显示名与描述
  icon.svg
docs/design.md         技术栈、机制、澄清项、功能清单、界面、模块、验证
scripts/
  test-host.mjs        规范化/计数/校验测试
  test-client.mjs      ModuleLoader + shell.overlay + React 服务端渲染测试
```

## 安装

```text
plugin_manager install_bundle
target = D:\Documents\deepseek-harness\default-workspace\projects\dsh-task-progress\plugin
```

已安装到当前 `desktop` profile，安装结果：`application: applied`，`warnings: []`。

> 如果移动了整个项目目录，插件仍通过 profile 里的链接指向旧路径；重新执行上面的 `install_bundle`，或在 `plugin/` 下执行 `pnpm install --ignore-scripts` 补齐 `zod`。

## 打开方式

1. **标题栏进度环按钮**：在会话标题栏右侧，显示当前完成比例；点击打开/收起悬浮卡。
2. **关闭按钮**：悬浮卡右上角 `×`；关闭后标题栏进度环仍保留，可再次打开。
3. **自动打开**：Agent 新建看板后 20 秒内，如果悬浮卡是关闭状态，会自动打开一次。

## Agent 用法

创建看板：

```json
{
  "action": "plan",
  "goal": "为 DSH 开发任务进度可视化插件",
  "tasks": [
    { "title": "核对插件机制", "status": "in_progress" },
    { "title": "实现 Host 工具与投影", "status": "pending" },
    { "title": "实现 Client 看板", "status": "pending" },
    { "title": "安装与验证", "status": "pending" }
  ]
}
```

只给目标也能自动拆：

```json
{ "action": "plan", "goal": "整理一份竞品分析" }
```

更新阶段状态与结果（每次提交完整列表）：

```json
{
  "action": "update",
  "goal": "整理一份竞品分析",
  "summary": "资料已收集，正在写对比矩阵",
  "tasks": [
    { "title": "收集资料", "status": "completed", "result": "已收集 8 家竞品并归档来源。" },
    { "title": "写对比矩阵", "status": "in_progress" },
    { "title": "复核结论", "status": "pending" }
  ]
}
```

清空：

```json
{ "action": "clear" }
```

## 验证

```powershell
node projects\dsh-task-progress\scripts\test-host.mjs
node projects\dsh-task-progress\scripts\test-client.mjs
```

- Host：自动五阶段、计数、结果字段、重复标题、清空；每轮占位板、助手回复回填、`task_progress` 替换、`todo/write` 回退，全部通过。
- Client：模拟 `window.__ModuleLoader__` + `shell.overlay` + `useSessions`，服务端渲染悬浮卡与标题栏按钮，断言目标、计数、阶段、空状态、全完成状态、关闭态，全部通过。
- 安装：`application: applied`。
- 槽位：`shell.overlay` 出现 `task-progress-float`；`conversation.session.header.utilities` 出现 `task-progress`，order=5；`conversation.input.dock` 不再占用。
- 视觉验证在本地进行；仓库不保留任何界面截图，避免泄露会话内容。

## 设计边界

- 单会话看板，不做跨 Session 任务中心。
- 用户目前只做视图交互（筛选/展开），不改任务状态。
- 阶段结果暂为纯文本，不接附件/文件打开。
- “自动拆解”省略 tasks 时是通用五阶段；领域阶段由模型提供。
- 未调用 `task_progress` 的轮次，自动回退只有一条“处理本轮请求”记录；完整阶段仍需 Agent 调用工具。
- 不申请文件、网络、凭证、子进程权限。
- 悬浮卡固定在窗口内右侧，不会渲染到操作系统窗口之外；真正“界面外”的独立置顶窗需要单独的原生 companion 进程，当前插件不包含。
- 小屏时 `max-width` / `max-height` 自动收缩，极端窄屏仍可能拥挤。

详细设计与待澄清项见 [docs/design.md](docs/design.md)。
