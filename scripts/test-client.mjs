import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const requireFromPlugin = createRequire(new URL('../plugin/package.json', import.meta.url))
const React = requireFromPlugin('react')
const { renderToStaticMarkup } = requireFromPlugin('react-dom/server')
let factory
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      factory = definition.factory
    },
  },
}
globalThis.document = {
  createElement() {
    return { dataset: {}, textContent: '', remove() {} }
  },
  head: { appendChild() {} },
}

await import('../plugin/client.js')

assert.equal(typeof factory, 'function')
const client = factory(requireFromPlugin)
let boardValue
const sessions = {
  binding(id) {
    if (id !== 's1') return undefined
    return {
      session: {
        projections: {
          faceOf(key) {
            if (key !== 'taskProgress') return undefined
            return {
              subscribe() {
                return () => {}
              },
              getSnapshot() {
                return boardValue
              },
            }
          },
        },
      },
    }
  },
}
const snapshot = {
  ids: ['s1'],
  byId: { s1: { id: 's1', retainedBy: { mainView: 1 } } },
}
const useSessions = (selector) => selector(snapshot)
const registrations = []
const ctx = {
  effect(fn) {
    return fn()
  },
  get() {
    return undefined
  },
  sessions,
  locale: {
    register() {
      return () => {}
    },
    bind() {
      return (key) => key
    },
  },
  slots: {
    inject(_key, callback) {
      callback()
      return () => {}
    },
    register(options, component) {
      registrations.push({ type: 'slot', options, component })
      return () => {}
    },
  },
}
client.apply(ctx)

assert.deepEqual(client.inject, ['slots', 'locale', 'sessions'])
assert.equal(registrations.some((entry) => entry.type === 'slot' && entry.options.name === 'shell.overlay'), true)
assert.equal(registrations.some((entry) => entry.type === 'slot' && entry.options.name === 'conversation.input.dock'), false)

const floating = registrations.find(
  (entry) => entry.type === 'slot' && entry.options.name === 'shell.overlay'
)
const header = registrations.find(
  (entry) => entry.type === 'slot' && entry.options.name === 'conversation.session.header.utilities'
)
assert.equal(floating.options.id, 'task-progress-float')
assert.equal(header.options.id, 'task-progress')
assert.equal(typeof floating.options.inject, 'function')

const dict = {
  title: '任务进度',
  titleDone: '任务完成',
  count: '{done}/{total} 完成',
  current: '当前',
  allDone: '全部阶段已完成',
  filterAll: '全部',
  filterOpen: '待办',
  filterDone: '已完成',
  result: '阶段结果',
  noResult: '尚未记录阶段结果',
  hint: '阶段结果会随任务进度自动同步',
  statusPending: '待开始',
  statusProgress: '进行中',
  statusCompleted: '已完成',
  untitled: '当前任务',
  progressLabel: '整体进度 {pct}%',
  updated: '更新于 {time}',
  auto: '自动拆解',
  thisTurn: '本轮',
  panelTitle: '任务进度',
  panelGuide: '查看阶段、结果与整体进度',
  panelEmptyTitle: '还没有任务看板',
  panelEmptyHint: '让 Agent 开始一个多步骤任务，看板会自动出现在这里。',
  headerLabel: '任务进度 {done}/{total}',
  headerEmpty: '任务进度',
  close: '关闭任务进度',
}
const t = (key) => dict[key] ?? key

const board = {
  goal: '交付任务进度插件',
  summary: '正在验证界面',
  auto: true,
  source: 'task',
  updatedAt: Date.now(),
  tasks: [
    { id: 'a', title: '核对机制', status: 'completed', detail: '', result: '已确认插槽与投影。' },
    { id: 'b', title: '实现组件', status: 'completed', detail: '', result: '组件已实现。' },
    { id: 'c', title: '验证渲染', status: 'in_progress', detail: '检查布局与交互', result: '' },
    { id: 'd', title: '收尾', status: 'pending', detail: '', result: '' },
  ],
}
boardValue = board
const injected = floating.options.inject()
assert.equal(injected.sessions, sessions)
assert.equal(typeof injected.t, 'function')
const html = renderToStaticMarkup(
  React.createElement(floating.component, {
    useSessions,
    sessions: injected.sessions,
    t,
    forceOpen: true,
  })
)
assert.match(html, /data-task-progress-float/)
assert.match(html, /tp-float/)
assert.match(html, /交付任务进度插件/)
assert.match(html, /2\/4 完成/)
assert.match(html, /核对机制/)
assert.match(html, /验证渲染/)
assert.match(html, /自动拆解/)
assert.match(html, /阶段结果会随任务进度自动同步/)
assert.match(html, /关闭任务进度/)

boardValue = null
const empty = renderToStaticMarkup(
  React.createElement(floating.component, {
    useSessions,
    sessions,
    t,
    forceOpen: true,
  })
)
assert.match(empty, /tp-panelEmpty/)
assert.match(empty, /还没有任务看板/)

boardValue = {
  ...board,
  tasks: board.tasks.map((task) => ({ ...task, status: 'completed' })),
}
const doneHtml = renderToStaticMarkup(
  React.createElement(floating.component, {
    useSessions,
    sessions,
    t,
    forceOpen: true,
  })
)
assert.match(doneHtml, /任务完成/)
assert.match(doneHtml, /100%/)

const buttonHtml = renderToStaticMarkup(
  React.createElement(header.component, {
    useProjection: () => board,
    t,
    sessionId: 's1',
  })
)
assert.match(buttonHtml, /tp-headerBtn/)
assert.match(buttonHtml, /任务进度 2\/4/)

const closed = renderToStaticMarkup(
  React.createElement(floating.component, {
    useSessions,
    sessions,
    t,
  })
)
assert.equal(closed, '')

console.log('client render tests: ok')
