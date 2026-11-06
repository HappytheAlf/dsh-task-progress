# DSH 任务进度可视化插件：设计与实现说明

> 项目：`projects/dsh-task-progress/`
> 插件包：`plugin/`（`@local/dsh-task-progress@0.1.0`）
> 当前状态：已安装到 `desktop` profile，Host/Client 均已激活，MVP 可运行。

---

## 0. 结论摘要

这个 MVP 没有另建任务数据库，也没有新增 Session 事件类型。任务看板的事实来源是 **Session 日志中的 `task_progress` 工具调用参数**：

1. 模型调用 `task_progress`，一次提交完整看板（目标、阶段、状态、阶段结果）。
2. Host 侧的 `taskProgress` Session Projection 折叠最近一次合法调用，生成只读 wire view。
3. Client 侧注册 `shell.overlay` 悬浮层，用 `useSessions` 找到当前会话，再用 `sessions.binding()` 读取 `taskProgress` 投影，渲染窗口右边缘的 360px 悬浮卡；会话标题栏的进度环按钮负责显隐。

这样同时满足 DSH 的几条硬约束：会话日志是唯一事实来源、fork/resume/replay 可重建、卸载插件不留下不可读的 Session 事件、UI 不直接读别的插件 DOM。

---

## 1. 技术栈与运行环境（已核对）

| 层 | 实际使用 | 说明 |
|---|---|---|
| Shell / 宿主 | DSH Desktop `0.2.2-rc.1`（当前 profile：`desktop`） | 当前机器上的实际版本；profile 目录由 `DSH_PROFILE_DIR` 标识 |
| 插件运行时 | Cordis `4.1.0` | Host 插件是 ESM 模块；生命周期由 Cordis Context / effect 管理 |
| Host | Node.js ESM，无构建步骤 | `index.js` 直接导出 `inject` / `apply` |
| Client | Web GUI + React 18 | 浏览器模块表提供 `react`；插件通过 `window.__ModuleLoader__.load` 注册 |
| 样式 | DSH theme tokens（`--dsw-alias-*`） | 深/浅色主题由宿主切换，插件不写死主色 |
| 文案 | Client `ctx.locale` + `locale/zh.json`、`locale/en.json` | 中文为主，英文完整 |
| 数据校验 | `zod@4.4.3` | 只用于 Session Projection 的 state/view schema |
| 测试 | Node 原生 `assert` + `react-dom/server` | `scripts/test-host.mjs`、`scripts/test-client.mjs` |
| 安装 | `plugin_manager` → `install_bundle` | 安装到当前 profile，跨会话生效 |

已通过 `cordis_inspect_query` 核对的 DSH 能力：

- Host `Service`：`tools`、`sessionProjections`、`systemPrompt`。
- Host `Event`：`tool/call`、`session/event`、`turn/start` 等。
- Client `Slots`：`shell.overlay`（root，悬浮层）/ `conversation.session.header.utilities`（session，标题栏入口）。
- Client `Theme`：`--dsw-alias-bg-layer-1`、`--dsw-alias-border-l1`、`--dsw-alias-brand-primary`、`--dsw-alias-state-success-primary` 等。
- Client `Service`：`slots`、`locale`。

---

## 2. 插件机制与接口

### 2.1 Bundle 形态

```text
plugin/
  package.json          dsh.bundle.patch + dsh.client
  cordis.patch.yml      插入 Host 行 task-progress
  index.js              Host 半：工具 + 投影 + prompt section
  client.js             Client 半：插槽 + React 看板 + 样式 + 文案
  locale/zh.json        Plugin Manager 显示名/描述
  locale/en.json
  icon.svg              原创图标
```

`package.json` 的关键声明：

- `dsh.bundle.patch`：让 `install_bundle` 知道这是 bundle。
- `dsh.client`：声明 Web 平台、`immediately: true`、依赖的 Client 包。
- `exports`：`.`、`./client`、`./locale/*.json`、`./icon`。
- `files`：保证本地目录安装/未来打包时，运行时文件与资源都在清单内。

### 2.2 Host 半

`index.js` 导出：

```js
export const inject = ['tools', 'sessionProjections', 'systemPrompt']
export function apply(ctx) { ... }
```

注册了三类资源：

1. **工具**：`ctx.tools.register(taskProgressTool)`
   - 名称：`task_progress`
   - 参数：`action`、`goal`、`summary`、`tasks[]`
   - 输出：规范化后的完整看板 + 计数
   - 执行时要求 `exec.agent` 存在；没有 owning agent 就报错，不做静默写入。
2. **Session Projection**：`await ctx.sessionProjections.register({...})`（DSH 0.2.2 起返回 Promise；apply 为 async）
   - key：`taskProgress`
   - state：`{ board, taskSeen, goal, turnGoal, turnStartedAt, turnHadBoard, assistantText }`
   - wire view：`board | null`
   - `stateVersion: 2`
   - `apply` 处理 `user/message`、`assistant/message`、`todo/write`、`tool/call`（`task_progress`）与 `turn/end`。
3. **Prompt section**：`ctx.systemPrompt.section({ name: 'task-progress', order: 900, text })`
   - 告诉模型：两步以上的任务先建看板，阶段变化时重发完整看板，阶段结果写进 `result`。
   - 这不是权限提升，只是行为引导；它增加了每次请求的少量固定 token。

### 2.3 Client 半

`client.js` 通过模块表加载：

```js
window.__ModuleLoader__.load({
  id: '@local/dsh-task-progress',
  factory(require) {
    const React = require('react')
    ...
    return { inject: ['slots', 'locale', 'sessions'], apply(ctx) { ... } }
  },
})
```

注册内容：

- `ctx.locale.register('task-progress', { zh, en })`：中英文文案。
- 一个 `<style>` 元素（`ctx.effect` 持有，卸载时移除）：所有类名以 `tp-` 前缀隔离。
- `ctx.slots.inject('shell.overlay', ...)`
  - 注册 `id: 'task-progress-float'`，order=-10。
  - `inject` 提供 `sessions` 服务和命名空间翻译。
  - 组件用 `useSessions` 选出 `retainedBy.mainView > 0` 的当前会话。
  - 用 `sessions.binding(sessionId).session.projections.faceOf('taskProgress')` 读取投影，`useSyncExternalStore` 订阅。
  - `position: fixed; right: 18px; top: 86px; width: 360px`，浮在窗口右边缘。
- `ctx.slots.inject('conversation.session.header.utilities', ...)`
  - 在会话标题栏右侧加一个 28px 的进度环按钮。
  - 用一个模块级、按 sessionId 分组的 store 控制悬浮卡显隐。
  - 新看板出现后 20 秒内，如果悬浮卡关闭，自动打开一次。
- 兼容迁移：apply 时尝试关闭旧版本留下的 `task-progress` 右侧栏页签；不再注册右侧栏 tab 类型。

没有使用 iframe，没有替换 app root，没有读别的插件 DOM，没有直接操作 `document.body`（悬浮层由 `shell.overlay` 提供）。

### 2.4 数据存储

| 数据 | 存储位置 | 生命周期 |
|---|---|---|
| 看板事实 | Session 日志中的 `tool/call` 事件参数 | 随 Session 持久化；resume / fork / replay 可重建 |
| 看板 wire view | `taskProgress` 投影的缓存/检查点 | 由 DSH 的 session projection 机制管理；插件不另存 |
| 工具输出 | Session 的 `tool/result` | 与其他工具结果一致 |
| UI 局部状态 | React state（筛选、展开哪一行、悬浮卡显隐） | 组件卸载即丢失；不写回 Session |
| 插件配置 | 无 | MVP 没有 Config；如后续需要，放 `cordis.patch.yml` 的 `config` |

**没有**使用 `ctx.storage` / `ctx.storageDomain`，也**没有**新增 `plugin:` 记录或自定义 Session 事件。原因：新增未知事件类型会破坏旧 reader 的重开兼容性；`appendPluginRecord()` 属于实验性保留能力。把完整看板放进工具参数是最小、最稳的做法。

### 2.5 权限范围

MVP 不申请任何额外能力：

- 不读文件、不写文件、不访问网络、不碰凭证、不启动子进程、不读剪贴板。
- Host 只依赖 `tools`、`sessionProjections`、`systemPrompt` 三个已存在的服务。
- Client 只依赖 `slots`、`locale`、`sessions`；其中 `sessions` 用来从当前会话的投影面读取只读数据，不扩大任何权限。
- 工具调用不是“绕过审批”的通道：它仍然经过 DSH 的 tool registry、可见性、restriction、guard 和权限策略。当前插件没有注册 guard，也没有放宽任何策略。
- UI 只拿到当前 Session 的投影，不能跨 Session 读别的看板。
- 用户在 UI 里的筛选、展开、关闭悬浮卡是纯视图操作，不写数据；所以不需要 Remote 端点，也不需要额外确认。

需要注意的隐私边界：

- `task_progress` 的参数会进入模型历史，也会出现在 Session 日志中。阶段 `result` 不要写密钥、token、完整个人隐私数据。
- 看板内容会显示在会话界面，属于用户可见内容，不是隐藏的运行时缓存。

---

## 3. 需要澄清的事项（以及 MVP 采用的默认值）

下面这些是开发前真正会影响架构的点。MVP 已按“默认选择”落地；如果用户选择不同，需要额外工作。

| # | 待澄清问题 | MVP 默认选择 | 选另一种的影响 |
|---|---|---|---|
| 1 | 目标 DSH 版本 / profile？ | 当前机器 `desktop` profile，DSH `0.2.2-rc.1` | 跨大版本可能需要重查 slot 名、Projection API、Tool 定义 |
| 2 | 看板放在哪里？ | `shell.overlay` 悬浮层，窗口右边缘 360px 卡片；标题栏进度环控制显隐 | 独立主页面需要新增路由与跨会话数据源；系统窗口外需要 Native 能力 |
| 3 | 单会话还是全局任务中心？ | 单会话；每个 Session 一个看板 | 全局看板需要跨 Session 聚合、存储和权限模型，复杂度显著上升 |
| 4 | 自动拆解由谁完成？ | 模型给 3–8 个阶段；省略 `tasks` 时插件给五阶段通用模板 | 规则引擎拆解需要领域模板、优先级/依赖/工时模型 |
| 5 | 状态是否可由用户点击修改？ | 否；用户只筛选/展开，状态由模型通过工具更新 | 需要 Host service + Client remote + 并发/审计/权限设计 |
| 6 | 数据存哪里？ | Session 日志（工具参数 + 投影），不建库 | 外部数据库需要 schema、迁移、备份、跨设备同步 |
| 7 | 是否需要附件/交付物卡片？ | 暂不；阶段结果先支持纯文本 | 文件卡片需要路径鉴权、打开动作、workspace 授权、XSS/路径安全 |
| 8 | 是否需要多 Agent/子任务树？ | 否；看板只属于当前 agent session | 跨 agent 需要共享任务模型和聚合协议 |
| 9 | 是否需要阶段耗时/预计完成时间？ | 否；不伪造时间估计 | 需要开始/结束时间事件、估算模型和时区处理 |
| 10 | 是否需要深色/浅色双主题？ | 是，全部用 theme tokens | 如果写死颜色，需要两套 override |
| 11 | 是否需要中英双语？ | 是，zh 为默认，en 完整 | 单语可减一份字典，但不建议 |
| 12 | 是否需要埋点/分析？ | 否 | 需要隐私评审、上报端点和用户同意 |
| 13 | 悬浮卡是否自动打开？ | 新看板出现后 20 秒内、且当前关闭时自动打开一次 | 若不想打扰，可加 Config 关闭；当前不做 |
| 14 | 是否需要“清空看板”用户按钮？ | 否；模型可调用 `action=clear` | 用户按钮需要 Remote 写操作与确认 |

> 如果第 4 条要求“完全不依赖模型、由插件自动拆解”，当前实现只能做到通用五阶段；真正的领域拆解必须由模型或规则模板完成。这是 MVP 最重要的能力边界。

---

## 4. 功能清单

### 4.1 MVP 已实现

- [x] `task_progress` 工具：`plan` / `update` / `clear`
- [x] 省略 `tasks` 时自动生成 5 阶段标准计划
- [x] 模型可提交 3–8 个领域阶段（最多 12 个）
- [x] 阶段状态：`pending` / `in_progress` / `completed`
- [x] 阶段说明 `detail`；阶段结果 `result`
- [x] 总目标 `goal`；当前进展摘要 `summary`
- [x] 整体进度环 + 进度条 + `4/5 完成`
- [x] 当前阶段提示与状态徽标
- [x] 阶段时间线（完成 / 进行中 / 待开始三种节点）
- [x] 已完成阶段的单行结果预览
- [x] 点击阶段展开完整说明与阶段结果
- [x] 筛选：全部 / 待办 / 已完成，带计数
- [x] 窗口内右侧 360px 悬浮卡（`shell.overlay`），不挤压聊天区
- [x] 会话标题栏进度环按钮：打开/收起悬浮卡
- [x] 悬浮卡右上角关闭按钮
- [x] 新看板出现时，若悬浮卡关闭则自动打开一次（20 秒新鲜度窗口）
- [x] 每轮新请求自动生成本轮占位板；`turn/end` 用本轮回复补齐结果；Agent 调用 `task_progress` 时替换为完整阶段计划
- [x] `todo_write` 回退：本轮未调用 `task_progress` 时，可用内置待办生成阶段列表
- [x] 实时更新（Session Projection push）
- [x] 刷新 / resume 后从 Session 日志恢复
- [x] 中英文文案
- [x] 主题令牌适配深/浅色
- [x] 键盘可访问（button、`aria-expanded`、`aria-pressed`、focus-visible）
- [x] 输入校验：空标题、重复标题、非法状态、超长字段、超阶段数
- [x] 安装后无需重启即可注册 Host 工具与 Client 插槽（当前安装结果 `applied`）

### 4.2 明确不在 MVP

- 用户手动拖拽排序 / 改状态 / 改结果
- 阶段附件、文件卡片、打开文件
- 跨 Session 任务中心、看板聚合
- 多 Agent 共享任务树
- 工时估算、开始/结束时间、甘特图
- 通知、提醒、到期告警
- 导出 Markdown / PDF / 图片
- 模型自动为每个阶段生成子任务（只支持阶段级）
- 看板级评论 / @mention

---

## 5. 界面结构

### 5.1 位置

```text
┌────────────────────────────────────────────────────────────────┐
│ Conversation header …                    [◔ 4/5]  [⋯]          │
│                                                                │
│   Conversation chat（宽度不变，不被挤压）                       │
│   …                                          ┌───────────────┐ │
│   …                                          │ 任务进度    × │ │
│   …                                          │ ◔ 4/5 完成    │ │
│   …                                          │ 为 DSH 开发…  │ │
│   …                                          │ ███████░░ 80% │ │
│   …                                          │ 全部5 待办1   │ │
│   …                                          │ ✓ 核对机制…   │ │
│   …                                          │ ● 安装验证…   │ │
│   …                                          │ [阶段结果]    │ │
│                                              └───────────────┘ │
│ Composer                                                       │
└────────────────────────────────────────────────────────────────┘
```

- 悬浮层：`shell.overlay`，root scope，位于所有列之上、滚动容器之外。
- 定位：`position: fixed; top: 86px; right: 18px; width: 360px`，高度按内容收缩，`max-height: min(640px, calc(100vh - 164px))`。
- 标题栏按钮：`conversation.session.header.utilities`，28px 进度环；无看板时显示清单图标。
- 关闭：悬浮卡右上角 `×`；标题栏进度环仍可再次打开。
- 自动打开：新看板的 `updatedAt` 在 20 秒内，且该 Session 的悬浮卡当前关闭时，自动打开一次。

### 5.2 组件解剖

- **Float frame**：360px 宽、圆角 16px、边框 + 阴影；`pointer-events:auto`，因为 `shell.overlay` 本身是点击穿透层。
- **Header**
  - `ProgressRing`：36×36 SVG，进度环 + 百分比；全完成时变绿色对勾。
  - `eyebrow`：标题（`任务进度` / `任务完成`）+ 计数 pill + 可选 `自动拆解` 标签。
  - `goal`：总目标；悬浮卡内最多两行。
  - `subline`：当前阶段，或完成后的 summary / “全部阶段已完成”。
  - `status pill`：悬浮卡内隐藏，避免 360px 宽度下挤压；状态由标题、环和进度条表达。
  - `close`：右上角 26px `×`。
- **Progress bar**：3px，品牌色到成功色渐变，宽度 = 完成数 / 总数。
- **Toolbar**：筛选 chips（全部 / 待办 / 已完成）+ 更新时间。
- **Timeline**：每行是 button，左侧 20px 节点，中间标题/状态/结果预览，右侧 chevron；行间有细竖线。
- **Detail**：点击行展开，显示 `detail` 与 `result`；左侧 2px 状态色边框。悬浮卡内默认展开当前进行中的阶段。
- **Footer**：一行同步提示，固定在卡片底部。
- **Empty**：无看板时显示清单图标 + “还没有任务看板” + 引导文案。

### 5.3 状态与交互

| 交互 | 行为 |
|---|---|
| 点标题栏进度环按钮 | 打开/关闭当前 Session 的悬浮卡 |
| 点悬浮卡 `×` | 关闭当前 Session 的悬浮卡 |
| 新看板出现 | 当前关闭时自动打开一次；已打开时不动 |
| 点筛选 chip | 只过滤当前视图；不改变任务状态 |
| 点阶段行 | 展开/收起该阶段详情；`aria-expanded` 同步 |
| Session 切换 | `useSessions` 选出新的当前会话，读取其投影；显隐状态按 sessionId 隔离 |
| 新任务更新 | Projection push → 重新渲染；筛选/展开状态保留 |
| 全部完成 | 标题变“任务完成”，环变 100% 对勾；用户可继续查看结果 |
| 看板清空 | 悬浮卡保留，正文显示空状态 |

### 5.4 视觉规则

- 只用 theme tokens；浅色/深色由宿主切换。
- 字号：标题 14/600，正文 12–12.5，辅助 10–11.5。
- 固定 360px 宽，不改变聊天区布局；`max-width` / `max-height` 适配小屏。
- 不使用生硬的纯黑/纯白边框；统一 `--dsw-alias-border-l1`。
- active 节点有 1.8s 脉冲点；`prefers-reduced-motion` 下关闭。
- 窄宽度优先保证目标与阶段标题可读：目标最多两行，状态 pill 隐藏，结果预览单行省略。

---

## 6. 核心模块设计

### 6.1 文件职责

| 文件 | 职责 |
|---|---|
| `plugin/index.js` | 常量/校验/规范化；`task_progress` 工具；`taskProgress` 投影；prompt section |
| `plugin/client.js` | Client 插件入口；locale + CSS；shell.overlay 悬浮卡 / 标题栏按钮；所有 UI 交互 |
| `plugin/cordis.patch.yml` | 插入 Host 行 `task-progress` |
| `plugin/package.json` | bundle/client 声明、导出、依赖 |
| `plugin/locale/*.json` | Plugin Manager 的标题/描述 |
| `plugin/icon.svg` | 原创图标 |
| `scripts/test-host.mjs` | 规范化/计数/校验测试 |
| `scripts/test-client.mjs` | 模拟 ModuleLoader + slots，服务端渲染组件，断言关键内容 |

### 6.2 工具契约

```json
{
  "action": "plan",
  "goal": "为 DSH 开发任务进度可视化插件，并交付可运行 MVP",
  "summary": "开始核对平台能力",
  "tasks": [
    {
      "id": "mechanism",
      "title": "核对 DSH 技术栈与插件机制",
      "status": "in_progress",
      "detail": "确认 Host/Client、插槽、投影、工具与权限边界",
      "result": ""
    }
  ]
}
```

规则：

- `action=plan`：创建或重排；`tasks` 可省略，省略时使用五阶段模板。
- `action=update`：必须提交**完整** `tasks`，不是补丁；省略 `tasks` 报错。
- `action=clear`：清空看板；不需要 `goal`。
- `tasks` 最多 12 个；标题非空且不重复；状态必须是三态之一。
- `result` 是阶段结果；`detail` 是阶段说明/验收点。
- 超长字段会截断并加 `…`，避免看板撑爆；但工具仍会拒绝空标题/重复标题等结构错误。

### 6.3 投影折叠

```text
init: { board: null, taskSeen: false, goal: '', turnGoal: '', turnStartedAt: 0, turnHadBoard: false, assistantText: '' }

apply(state, event):
  user/message
    → 提取本轮用户文本
    → 若上一看板为空或全部完成：board = 本轮占位板（1 条“处理本轮请求”，in_progress，source=turn）
    → 记录 turnGoal / turnStartedAt；turnHadBoard = false；assistantText = ''
  assistant/message
    → 记录本轮最后一条助手文本（用于 turn/end 回填 result）
  todo/write 且本轮还没有看板更新
    → 用 todos 生成 source=todo 的阶段列表；turnHadBoard = true
  tool/call.name === 'task_progress'
    → JSON.parse(arguments) → normalizeBoardArgs
    → 合法：board = normalized.board；turnHadBoard = true
    → clear：board = null；turnHadBoard = true
    → 非法：忽略
  tool/call 其他工具且本轮没有显式看板
    → 从工具名与参数生成阶段（读取/搜索/运行/修改等），source=turn
    → 第一个工具调用替换“处理本轮请求”占位；最多保留 8 条
  tool/result
    → 把对应工具阶段标记为 completed（失败则 pending），result=已完成/执行失败
  assistant/message
    → 记录本轮最后一条助手文本；source=turn 时摘要变为“正在整理结果”
  turn/end 且本轮没有看板更新
    → 若上一看板仍在进行且不是本轮占位板：保留
    → 有工具阶段：全部收敛为 completed/pending，并追加“整理结果”（result=助手文本）
    → 没有工具阶段：board = 1 条本轮记录
  其他事件
    → 原样返回 state
```

要点：

- 投影是纯同步函数；忽略的事件返回同一引用，避免无意义的下游发布。
- 只依赖已提交的 Session 事件；不订阅 `session/event` 做二次扫描。
- `wire.view` 只返回 `board`，Client 不需要理解内部 `turnHadBoard`。
- 旧看板/错误参数不会让整个 Session 打不开；`normalize` 失败时直接忽略。
- `stateVersion: 3`；改字段或折叠语义时递增，缓存检查点会失效重算。
- 每轮自动回退优先使用工具活动，至少让用户看到“读取/搜索/运行/修改”等真实工作，而不是只有一个“处理本轮请求”；完整阶段仍由 `task_progress` 提供。

### 6.4 Client 状态

组件本地状态只有：

- `filter`：`all` / `open` / `done`
- `openTask`：当前展开的阶段 id
- `seenBoard`：ref，用来区分“首次出现”与后续更新，避免每次更新强行重置用户视图
- 模块级 `floatStore`：按 `sessionId` 记录悬浮卡打开/关闭
- 标题栏按钮的 `autoOpened`：ref，保证新看板只自动打开一次

悬浮卡始终展示完整内容，没有“收起看板内部”的状态；关闭是整卡隐藏。首次出现时默认展开当前进行中的阶段；后续更新保留筛选/展开选择；如果当前展开的阶段被删除，自动清空 `openTask`。

### 6.5 错误与降级

- 工具参数非法：`execute` 抛错，模型看到失败；投影忽略该调用。
- 当前会话未确定 / 投影未加载：悬浮层返回 `null`，不渲染半成品。
- 投影为空 / 无 tasks：悬浮卡显示空状态“还没有任务看板”，不报错。
- `t` 缺失：`tx()` 回退到 key，不崩溃。
- `board.updatedAt` 非数字：不显示时间，也不自动打开。
- 当前会话没有 `mainView` retention：`useSessions` 返回 undefined，悬浮层不渲染。
- 旧右侧栏页签关闭失败：`ctx.effect` 内 `try/catch` 静默忽略，不影响悬浮卡。
- Client 组件异常：只影响 `shell.overlay` 的这一项，不会替换 app root；这是 DSH slot 的隔离边界。

---

## 7. 开发步骤（实际执行）

1. **读规范**：加载 `cordis-plugin-development`，读 host/client/practices/user-actions/verification 参考。
2. **核对运行环境**：`cordis_inspect_list` → `Service` / `Event` / `Slots` / `Theme`；确认 `shell.overlay`、`conversation.session.header.utilities`、`useSessions` 与 `sessions.binding()` 的可用性。
3. **定架构**：选“工具参数 + Session Projection”而不是外部存储；选 `shell.overlay` 悬浮卡而不是右侧栏页签/主页面。
4. **写 Host**：`index.js` + `cordis.patch.yml` + `package.json`；实现规范化、工具、投影、prompt。
5. **写 Client**：`client.js`；locale、CSS、`shell.overlay` 悬浮卡、标题栏按钮、按 sessionId 的显隐 store。
6. **资源**：中英文 locale、原创 icon。
7. **测试**：Host 规范化测试；模拟 ModuleLoader + `shell.overlay` + `useSessions` 的 React 服务端渲染测试。
8. **安装**：`plugin_manager install_bundle` → `application: applied`。
9. **结构验证**：`cordis_inspect_query Slots` 确认 `shell.overlay` 出现 `task-progress-float`，`conversation.session.header.utilities` 出现 `task-progress`，且 `conversation.input.dock` 不再占用。
10. **真实调用**：在当前会话调用 `task_progress`，确认 `tool/result` 写入，悬浮卡自动打开并渲染看板。
11. **视觉走查**：截图检查悬浮卡是否被裁剪、宽度、滚动、目标换行、关闭按钮；确认聊天区宽度不变。
12. **收尾**：补文档、清理临时产物、回归测试。

---

## 8. 安装、使用与卸载

### 安装

已通过：

```text
plugin_manager install_bundle
target = D:\Documents\deepseek-harness\default-workspace\projects\dsh-task-progress\plugin
```

安装结果：`application: applied`，`warnings: []`。

### 让 Agent 使用

工具已注册为 `task_progress`，并有一条 prompt section 提醒模型在多步任务开始时使用。模型典型调用：

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

只给目标、不给阶段，也能自动得到五阶段：

```json
{ "action": "plan", "goal": "整理一份竞品分析" }
```

更新时重发完整列表：

```json
{
  "action": "update",
  "goal": "整理一份竞品分析",
  "summary": "已完成资料收集，正在写对比矩阵",
  "tasks": [
    { "title": "收集资料", "status": "completed", "result": "已收集 8 家竞品，来源存档。" },
    { "title": "写对比矩阵", "status": "in_progress" },
    { "title": "复核结论", "status": "pending" }
  ]
}
```

清空：

```json
{ "action": "clear" }
```

### 卸载

```text
plugin_manager remove_bundle target = @local/dsh-task-progress
```

卸载后：工具、投影、prompt、Client 插槽、locale、CSS 都会随 effect 清理；Session 里已有的 `task_progress` 工具调用仍保留在日志中，但不再渲染看板。

---

## 9. 验证记录

### 9.1 已通过

- `node --check plugin/index.js`、`node --check plugin/client.js`：通过。
- `scripts/test-host.mjs`：自动拆解 5 阶段、计数、结果字段、重复标题、清空；每轮占位板、助手回复回填、`task_progress` 替换、`todo/write` 回退；并断言 `apply` 在异步 `sessionProjections.register` 完成前不注册工具，全部通过。
- `scripts/test-client.mjs`：模拟 ModuleLoader + `shell.overlay` + `useSessions`，渲染悬浮卡与标题栏按钮，断言 `tp-float`、目标、`2/4 完成`、阶段标题、`自动拆解`、空状态、全完成状态、关闭态，全部通过。
- `plugin_manager install_bundle`：`application: applied`，`warnings: []`。
- `cordis_inspect_query Slots`：
  - `shell.overlay` 出现 `task-progress-float`，order=-10，active。
  - `conversation.session.header.utilities` 出现 `task-progress`，order=5，active。
  - `conversation.input.dock` 不再有 `task-progress`。
  - `sidebar.right.pane.tab` 不再有本插件。
- 当前会话调用 `task_progress`：新看板出现后悬浮卡自动打开，真实渲染 4/5 看板。
- 视觉走查后修复：最初把 fixed 卡放在 `conversation.input.dock` 内，受祖先包含块影响被窗口裁切；改用 `shell.overlay` 后完整显示在窗口右侧，且不改变聊天区宽度。
- 视觉走查确认：360px 宽、右上角关闭按钮、进度环、目标两行、阶段结果、筛选均可见。
- HMR：修改 `client.js` 后页面自动出现悬浮卡版本，无需手动重启。

### 9.2 验证截图

为避免泄露会话内容和个人信息，仓库不保留任何界面截图。视觉验证在本地完成，截图仅用于当时检查、不随项目分发。

### 9.3 仍有限制 / 未覆盖

- 没有做深色主题的实机截图；样式全部使用 theme tokens，理论上自动适配，但未逐像素验证。
- 没有做极窄窗口的实机截图；已写 `max-width` / `max-height` 规则。
- 没有做键盘 Tab 全链路走查；已实现 focus-visible 与语义化 button。
- 没有做“多会话同时打开”的并发截图；显隐状态按 sessionId 隔离，投影按 Session 隔离。
- 悬浮卡位置固定（右上），不做拖拽；系统窗口之外的独立面板需要 Native 能力，当前不支持。
- 没有截到最终 5/5 悬浮态：验证过程中桌面窗口被关闭；5/5 内容由服务端渲染测试覆盖。
- “自动拆解”的领域质量取决于模型提交的 tasks；省略 tasks 时是通用五阶段，不是领域推理。
- 未调用 `task_progress`/`todo_write` 的轮次，自动回退会把本轮工具活动转成阶段；没有工具活动时仍只有一条“处理本轮请求”。完整语义阶段仍需 Agent 调用工具。
- 如果上一轮看板仍有进行中阶段，新一轮用户消息不会强制重置，避免丢掉正在执行的进度；本轮结束也不回退覆盖。
- 未实现用户手动编辑任务状态；这是有意的 MVP 边界。

---

## 10. 风险与后续

| 风险 | 影响 | 缓解 |
|---|---|---|
| Slot 名称/结构随 DSH 版本变化 | 看板不渲染 | 已集中在一个常量/一处注册；升级时先跑 `Slots.listSubTree` |
| fixed 卡被祖先容器裁切 | 只显示一部分 | 已改用 `shell.overlay`；不要退回普通内容槽里的 fixed 定位 |
| `useSessions` 快照结构变化 | 找不到当前会话 | 已集中在一个 hook；升级时对照 `retainedBy.mainView` |
| 悬浮卡 360px 在极窄窗口拥挤 | 内容换行/截断 | `max-width` 收缩；目标两行；状态 pill 隐藏 |
| 自动打开打断用户 | 覆盖聊天区 | 仅在悬浮卡关闭且看板 20 秒内新鲜时自动打开一次；可手动关闭 |
| 工具名 `task_progress` 与未来官方工具冲突 | 注册失败 | 安装前用 `Tool.listTools` 检查；必要时改名并迁移 |
| 看板过长 | 查看费力 | 最多 12 阶段；列表最大高度 + 滚动；详情按需展开 |
| 模型不调用工具 | 没有看板 | Prompt section + 工具描述双重引导；后续可加 Config 开关 |
| 阶段结果含敏感信息 | 进入 Session 日志/模型上下文 | 文档提示；不做自动抓取；结果由模型/用户控制 |
| 用户希望手动勾选 | 当前只能看 | 下一版加 Host service + Remote 命令，复用同一看板状态 |
| 跨 agent 汇总 | 当前每个 Session 独立 | 需要单独设计共享任务模型，不能简单读别的 Session |
| 需要渲染到 DSH 应用窗口外 | 纯 Client 插件做不到 | 需要独立的 Native companion 进程/窗口，另立项目；当前悬浮卡仍在窗口内 |

### 建议的下一版顺序

1. 增加 Config：`promptEnabled`、`defaultExpanded`、`maxTasks`。
2. 增加用户操作：勾选完成/改状态（Host service + command/remote + 权限确认）。
3. 增加阶段附件/交付物卡片（走 `openFile` 授权，不直接读路径）。
4. 增加任务中心页面（跨 Session 聚合，需要新的存储与权限设计）。
5. 增加导出（Markdown / PNG）与阶段耗时。
