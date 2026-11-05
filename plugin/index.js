/**
 * Host half of the Task Progress bundle.
 *
 * The board itself lives in the session log: every `task_progress` tool call
 * carries the complete board, and the `taskProgress` projection folds the most
 * recent accepted call into a client-visible wire value. No second database,
 * no plugin-owned Session event type, and no mutable cross-Session cache.
 */
import { z } from 'zod'

const STATUSES = ['pending', 'in_progress', 'completed']
const ACTIONS = ['plan', 'update', 'clear']
const SOURCES = ['task', 'todo', 'turn']

const MAX_TASKS = 12
const MAX_GOAL = 240
const MAX_SUMMARY = 400
const MAX_TITLE = 160
const MAX_DETAIL = 1200
const MAX_RESULT = 4000

/**
 * The standard plan used when the model asks for a plan without supplying
 * stages. It is deliberately generic: the model can replace it with a
 * domain-specific decomposition by passing `tasks`.
 */
export const FALLBACK_PHASES = Object.freeze([
  {
    title: '明确目标与边界',
    detail: '确认需求、约束与验收标准，形成可核对的目标。',
    status: 'in_progress',
  },
  {
    title: '拆解执行计划',
    detail: '拆出可执行的阶段、依赖关系与检查点。',
    status: 'pending',
  },
  {
    title: '推进核心工作',
    detail: '完成主要实现、研究或产出。',
    status: 'pending',
  },
  {
    title: '验证与修正',
    detail: '检查结果、补齐缺口并复核关键结论。',
    status: 'pending',
  },
  {
    title: '交付与总结',
    detail: '整理阶段性结果、交付物与下一步建议。',
    status: 'pending',
  },
])

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(STATUSES),
  detail: z.string(),
  result: z.string(),
})

const boardSchema = z.object({
  goal: z.string(),
  summary: z.string(),
  tasks: z.array(taskSchema),
  updatedAt: z.number(),
  source: z.enum(SOURCES),
  auto: z.boolean(),
})

const stateSchema = z.object({
  board: boardSchema.nullable(),
  taskSeen: z.boolean(),
  goal: z.string(),
  turnGoal: z.string(),
  turnStartedAt: z.number(),
  turnHadBoard: z.boolean(),
  assistantText: z.string(),
})

const viewSchema = boardSchema.nullable()

/** Trim and cap one free-form string; non-strings become empty. */
function text(value, max) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > max ? trimmed.slice(0, max - 1) + '…' : trimmed
}

/** Accept a few status spellings so old or hand-written boards still fold. */
function normalizeStatus(value) {
  if (value === 'completed' || value === 'done') return 'completed'
  if (value === 'in_progress' || value === 'in-progress' || value === 'running' || value === 'active') {
    return 'in_progress'
  }
  if (value === 'pending' || value === 'todo' || value === 'open') return 'pending'
  throw new Error(`invalid task status: ${JSON.stringify(value)}`)
}

/** Give every stage a stable, unique id even when the model omits one. */
function uniqueId(candidate, index, used) {
  const base = text(candidate, 64) || `step-${index + 1}`
  let id = base
  let suffix = 2
  while (used.has(id)) id = `${base}-${suffix++}`
  used.add(id)
  return id
}

/** Canonicalize one whole board. Throws on input the tool should reject. */
export function normalizeBoardArgs(args, now = Date.now()) {
  const action = args?.action
  if (!ACTIONS.includes(action)) {
    throw new Error('action must be "plan", "update", or "clear"')
  }
  if (action === 'clear') {
    return {
      action,
      board: null,
      counts: { pending: 0, inProgress: 0, completed: 0, total: 0 },
    }
  }

  const goal = text(args.goal, MAX_GOAL)
  if (goal === '') throw new Error('goal must be a non-empty string')

  let rawTasks = Array.isArray(args.tasks) ? args.tasks : []
  const auto = rawTasks.length === 0 && action === 'plan'
  if (auto) rawTasks = FALLBACK_PHASES
  if (rawTasks.length === 0) throw new Error('tasks must contain at least one stage for action "update"')
  if (rawTasks.length > MAX_TASKS) throw new Error(`tasks must contain at most ${MAX_TASKS} stages`)

  const usedIds = new Set()
  const usedTitles = new Set()
  const tasks = rawTasks.map((raw, index) => {
    if (raw === null || typeof raw !== 'object') {
      throw new Error(`task ${index + 1} must be an object`)
    }
    const title = text(raw.title ?? raw.content, MAX_TITLE)
    if (title === '') throw new Error(`task ${index + 1} needs a non-empty title`)
    if (usedTitles.has(title)) throw new Error(`duplicate task title: ${JSON.stringify(title)}`)
    usedTitles.add(title)
    return {
      id: uniqueId(raw.id, index, usedIds),
      title,
      status: normalizeStatus(raw.status),
      detail: text(raw.detail, MAX_DETAIL),
      result: text(raw.result, MAX_RESULT),
    }
  })

  const counts = {
    pending: tasks.filter((task) => task.status === 'pending').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    total: tasks.length,
  }

  return {
    action,
    board: {
      goal,
      summary: text(args.summary, MAX_SUMMARY),
      tasks,
      updatedAt: now,
      source: 'task',
      auto,
    },
    counts,
  }
}

function textFromContent(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function turnBoard(goal, now, status, result) {
  return {
    goal: text(goal, MAX_GOAL),
    summary: status === 'completed' ? '本轮已完成' : status === 'in_progress' ? '正在处理本轮请求' : '本轮未完成',
    tasks: [
      {
        id: 'turn',
        title: '处理本轮请求',
        status,
        detail: '',
        result: text(result, MAX_RESULT),
      },
    ],
    updatedAt: now,
    source: 'turn',
    auto: false,
  }
}

/** Fold one committed Session event into the board projection. */
export function fold(state, event) {
  if (event.type === 'user/message') {
    const nextGoal = text(textFromContent(event.data?.content), MAX_GOAL)
    if (nextGoal === '') return state
    const previousComplete =
      state.board === null || state.board.tasks.every((task) => task.status === 'completed')
    return {
      ...state,
      board: previousComplete ? turnBoard(nextGoal, event.time, 'in_progress', '') : state.board,
      taskSeen: previousComplete ? true : state.taskSeen,
      goal: state.goal || nextGoal,
      turnGoal: nextGoal,
      turnStartedAt: event.time,
      turnHadBoard: false,
      assistantText: '',
    }
  }

  if (event.type === 'assistant/message') {
    const assistantText = text(textFromContent(event.data?.message?.content), MAX_RESULT)
    if (assistantText === '') return state
    return { ...state, assistantText }
  }

  if (event.type === 'todo/write' && !state.turnHadBoard) {
    const rawTodos = Array.isArray(event.data?.todos) ? event.data.todos : []
    const seen = new Set()
    const tasks = []
    for (const todo of rawTodos) {
      if (tasks.length >= MAX_TASKS) break
      const title = text(todo?.content, MAX_TITLE)
      if (title === '' || seen.has(title)) continue
      seen.add(title)
      try {
        tasks.push({
          id: `todo-${tasks.length + 1}`,
          title,
          status: normalizeStatus(todo?.status),
          detail: '',
          result: '',
        })
      } catch {
        /* ignore a malformed todo item */
      }
    }
    if (tasks.length === 0) return state
    const goal = state.turnGoal || state.goal || '当前任务'
    return {
      ...state,
      board: {
        goal,
        summary: '',
        tasks,
        updatedAt: event.time,
        source: 'todo',
        auto: false,
      },
      taskSeen: true,
      goal: state.goal || goal,
      turnHadBoard: true,
    }
  }

  if (event.type === 'tool/call' && event.data?.name === 'task_progress') {
    let args
    try {
      args = JSON.parse(event.data.arguments)
    } catch {
      return state
    }

    let normalized
    try {
      normalized = normalizeBoardArgs(args, event.time)
    } catch {
      // The tool call failed validation and never reached a usable board.
      return state
    }

    if (normalized.action === 'clear') {
      return { ...state, board: null, taskSeen: false, turnHadBoard: true }
    }

    return {
      ...state,
      board: normalized.board,
      taskSeen: true,
      goal: normalized.board.goal,
      turnHadBoard: true,
    }
  }

  if (event.type === 'turn/end' && !state.turnHadBoard) {
    const active =
      state.board !== null &&
      state.board.source !== 'turn' &&
      state.board.tasks.some((task) => task.status === 'in_progress' || task.status === 'pending')
    if (active) return state
    const completed = event.data?.reason?.kind === 'completed'
    const result = state.assistantText || (completed ? '本轮已完成。' : '本轮未完成。')
    const goal = state.turnGoal || state.board?.goal || ''
    if (goal === '') return state
    return {
      ...state,
      board: turnBoard(goal, event.time, completed ? 'completed' : 'pending', result),
      taskSeen: true,
    }
  }

  return state
}

const taskProgressTool = {
  name: 'task_progress',
  description:
    '维护当前会话的可视化任务进度板，用于多步骤工作。开始前调用一次 action="plan"，传入总目标和 3–8 个具体阶段；省略 tasks 时插件会自动拆成五阶段。之后每当阶段状态变化或产生阶段性结果，调用 action="update" 并重新提交完整看板（不是补丁），用 result 写一句可展示的结果。action="clear" 清除看板。看板显示在窗口右边缘的悬浮卡中，用户会实时看到状态与结果。',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      action: {
        type: 'string',
        enum: ACTIONS,
        description: 'plan 创建或重排看板；update 更新完整看板；clear 清除看板。',
      },
      goal: {
        type: 'string',
        description: '总目标，一句话。plan/update 必填。',
      },
      summary: {
        type: 'string',
        description: '可选的当前进展摘要，一句话。',
      },
      tasks: {
        type: 'array',
        description:
          '完整阶段列表；每次 update 都必须提交全部阶段。plan 时可省略，插件会生成五阶段标准计划。',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', description: '可选稳定 id；省略时按顺序生成。' },
            title: { type: 'string', description: '阶段名称，短句。' },
            status: { type: 'string', enum: STATUSES, description: 'pending | in_progress | completed。' },
            detail: { type: 'string', description: '可选阶段说明或验收点。' },
            result: { type: 'string', description: '阶段完成后的结果摘要；进行中也可写当前产出。' },
          },
          required: ['title', 'status'],
        },
      },
    },
    required: ['action'],
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ACTIONS },
        goal: { type: 'string' },
        summary: { type: 'string' },
        auto: { type: 'boolean' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string', enum: STATUSES },
              detail: { type: 'string' },
              result: { type: 'string' },
            },
            required: ['id', 'title', 'status', 'detail', 'result'],
          },
        },
        counts: {
          type: 'object',
          additionalProperties: false,
          properties: {
            pending: { type: 'integer' },
            inProgress: { type: 'integer' },
            completed: { type: 'integer' },
            total: { type: 'integer' },
          },
          required: ['pending', 'inProgress', 'completed', 'total'],
        },
      },
      required: ['action', 'goal', 'summary', 'auto', 'tasks', 'counts'],
    },
    render: (_args, value) => {
      if (value.action === 'clear') {
        return [{ type: 'text', text: '任务进度看板已清空。' }]
      }
      const { completed, inProgress, total } = value.counts
      return [
        {
          type: 'text',
          text: `任务进度已更新：${completed}/${total} 完成，${inProgress} 进行中。`,
        },
      ]
    },
  },
  async execute(args, exec) {
    if (exec.agent === undefined) {
      throw new Error('task_progress requires an owning agent session')
    }
    const normalized = normalizeBoardArgs(args)
    if (normalized.board === null) {
      return {
        action: 'clear',
        goal: '',
        summary: '',
        auto: false,
        tasks: [],
        counts: normalized.counts,
      }
    }
    return {
      action: normalized.action,
      goal: normalized.board.goal,
      summary: normalized.board.summary,
      auto: normalized.board.auto,
      tasks: normalized.board.tasks,
      counts: normalized.counts,
    }
  },
}

export const inject = ['tools', 'sessionProjections', 'systemPrompt']

export async function apply(ctx) {
  await ctx.sessionProjections.register({
    key: 'taskProgress',
    stateSchema,
    init: () => ({
      board: null,
      taskSeen: false,
      goal: '',
      turnGoal: '',
      turnStartedAt: 0,
      turnHadBoard: false,
      assistantText: '',
    }),
    apply: fold,
    wire: {
      viewSchema,
      view: (state) => state.board,
    },
    stateVersion: 2,
  })

  ctx.tools.register(taskProgressTool)

  ctx.systemPrompt.section({
    name: 'task-progress',
    order: 900,
    text:
      'For a request that needs more than two concrete steps, maintain the visual task board with `task_progress`: call it once before starting with the full goal and 3–8 concrete stages, then resend the complete board whenever a stage changes status or produces a result. Put user-visible stage results in `result`. If `todo_write` is available, use it only for private scratch planning when no visual progress board is wanted.',
  })
}
