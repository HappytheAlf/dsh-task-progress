import assert from 'node:assert/strict'
import { FALLBACK_PHASES, apply, fold, normalizeBoardArgs } from '../plugin/index.js'

const planned = normalizeBoardArgs({ action: 'plan', goal: '交付任务进度插件' }, 1_700_000_000_000)
assert.equal(planned.action, 'plan')
assert.equal(planned.board.auto, true)
assert.equal(planned.board.tasks.length, FALLBACK_PHASES.length)
assert.equal(planned.counts.total, 5)
assert.equal(planned.counts.inProgress, 1)
assert.equal(planned.board.tasks[0].status, 'in_progress')

const updated = normalizeBoardArgs(
  {
    action: 'update',
    goal: '交付任务进度插件',
    summary: '最小可用版本已就绪',
    tasks: [
      { title: '核对 DSH 插件机制', status: 'completed', result: '已确认插槽、投影与工具接口。' },
      { title: '实现 Host 与 Client', status: 'completed', result: '工具与看板已实现。' },
      { title: '安装并验证', status: 'in_progress' },
    ],
  },
  1_700_000_000_100
)
assert.equal(updated.board.auto, false)
assert.equal(updated.counts.completed, 2)
assert.equal(updated.counts.inProgress, 1)
assert.equal(updated.board.tasks[0].result, '已确认插槽、投影与工具接口。')

assert.throws(
  () =>
    normalizeBoardArgs({
      action: 'update',
      goal: '重复标题',
      tasks: [
        { title: '同一阶段', status: 'pending' },
        { title: '同一阶段', status: 'completed' },
      ],
    }),
  /duplicate task title/
)

const cleared = normalizeBoardArgs({ action: 'clear' })
assert.equal(cleared.board, null)
assert.equal(cleared.counts.total, 0)

const initial = {
  board: null,
  taskSeen: false,
  goal: '',
  turnGoal: '',
  turnStartedAt: 0,
  turnHadBoard: false,
  assistantText: '',
}
const afterUser = fold(initial, {
  type: 'user/message',
  time: 1000,
  data: { content: [{ type: 'text', text: '给插件补上每轮自动更新' }] },
})
assert.equal(afterUser.turnGoal, '给插件补上每轮自动更新')
assert.equal(afterUser.board.source, 'turn')
assert.equal(afterUser.board.tasks[0].status, 'in_progress')

const afterAnswer = fold(afterUser, {
  type: 'assistant/message',
  time: 1100,
  data: { message: { content: [{ type: 'text', text: '已补上 turn/end 回退逻辑。' }] } },
})
const afterTurn = fold(afterAnswer, {
  type: 'turn/end',
  time: 1200,
  data: { reason: { kind: 'completed' } },
})
assert.equal(afterTurn.board.source, 'turn')
assert.equal(afterTurn.board.tasks[0].status, 'completed')
assert.match(afterTurn.board.tasks[0].result, /turn\/end/)

const explicit = normalizeBoardArgs(
  {
    action: 'plan',
    goal: '显式任务板',
    tasks: [{ title: '阶段一', status: 'in_progress' }],
  },
  1300
)
const afterTool = fold(afterUser, {
  type: 'tool/call',
  time: 1300,
  data: { name: 'task_progress', arguments: JSON.stringify({ action: 'plan', goal: '显式任务板' }) },
})
assert.equal(afterTool.board.goal, explicit.board.goal)
assert.equal(afterTool.turnHadBoard, true)
const explicitEnd = fold(afterTool, {
  type: 'turn/end',
  time: 1400,
  data: { reason: { kind: 'completed' } },
})
assert.equal(explicitEnd.board.goal, '显式任务板')
assert.equal(explicitEnd.board.tasks[0].status, 'in_progress')

const todoState = fold(initial, {
  type: 'user/message',
  time: 1500,
  data: { content: [{ type: 'text', text: '用内置待办规划' }] },
})
const todoBoard = fold(todoState, {
  type: 'todo/write',
  time: 1600,
  data: { todos: [{ content: '收集资料', status: 'completed' }, { content: '写结论', status: 'in_progress' }] },
})
assert.equal(todoBoard.board.source, 'todo')
assert.equal(todoBoard.board.tasks.length, 2)
assert.equal(todoBoard.turnHadBoard, true)

const activityCall = fold(afterUser, {
  type: 'tool/call',
  time: 1700,
  data: { name: 'read', callId: 'call-1', arguments: JSON.stringify({ path: 'D:\\repo\\plugin\\index.js' }) },
})
assert.equal(activityCall.board.source, 'turn')
assert.equal(activityCall.board.tasks.length, 1)
assert.match(activityCall.board.tasks[0].title, /读取/)
assert.equal(activityCall.board.tasks[0].status, 'in_progress')
assert.equal(activityCall.turnHadBoard, false)

const activityDone = fold(activityCall, {
  type: 'tool/result',
  time: 1750,
  data: {
    message: {
      role: 'tool',
      toolCallId: 'call-1',
      source: { kind: 'tool', callId: 'call-1' },
      isError: false,
      content: [{ type: 'text', text: 'ok' }],
    },
  },
})
assert.equal(activityDone.board.tasks[0].status, 'completed')
assert.equal(activityDone.board.tasks[0].result, '已完成')

const activityAnswer = fold(activityDone, {
  type: 'assistant/message',
  time: 1800,
  data: { message: { content: [{ type: 'text', text: '已读取并检查插件源码。' }] } },
})
const activityTurn = fold(activityAnswer, {
  type: 'turn/end',
  time: 1900,
  data: { reason: { kind: 'completed' } },
})
assert.equal(activityTurn.board.source, 'turn')
assert.equal(activityTurn.board.tasks.every((task) => task.status === 'completed'), true)
assert.equal(activityTurn.board.tasks.at(-1).id, 'answer')
assert.match(activityTurn.board.tasks.at(-1).result, /已读取/)

let registered = false
const ctx = {
  sessionProjections: {
    async register() {
      await Promise.resolve()
      registered = true
      return { dispose() {} }
    },
  },
  tools: {
    register() {
      assert.equal(registered, true, 'tool must register only after projection await')
      return () => {}
    },
  },
  systemPrompt: {
    section() {
      return () => {}
    },
  },
}
await apply(ctx)
assert.equal(registered, true)

console.log('host normalization tests: ok')
