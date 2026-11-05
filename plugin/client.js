window.__ModuleLoader__.load({
  id: '@local/dsh-task-progress',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'task-progress'
    const PROJECTION = 'taskProgress'

    const zh = {
      title: '任务进度',
      titleDone: '任务完成',
      expand: '展开任务进度',
      collapse: '收起任务进度',
      auto: '自动拆解',
      thisTurn: '本轮',
      count: '{done}/{total} 完成',
      current: '当前',
      allDone: '全部阶段已完成',
      updated: '更新于 {time}',
      filterAll: '全部',
      filterOpen: '待办',
      filterDone: '已完成',
      empty: '暂无符合条件的阶段',
      result: '阶段结果',
      noResult: '尚未记录阶段结果',
      hint: '阶段结果会随任务进度自动同步',
      statusPending: '待开始',
      statusProgress: '进行中',
      statusCompleted: '已完成',
      untitled: '当前任务',
      progressLabel: '整体进度 {pct}%',
      panelTitle: '任务进度',
      panelGuide: '查看阶段、结果与整体进度',
      panelEmptyTitle: '还没有任务看板',
      panelEmptyHint: '让 Agent 开始一个多步骤任务，看板会自动出现在这里。',
      headerLabel: '任务进度 {done}/{total}',
      headerEmpty: '任务进度',
      close: '关闭任务进度',
    }

    const en = {
      title: 'Task Progress',
      titleDone: 'All Tasks Complete',
      expand: 'Expand task progress',
      collapse: 'Collapse task progress',
      auto: 'Auto-planned',
      thisTurn: 'This turn',
      count: '{done}/{total} done',
      current: 'Current',
      allDone: 'All stages are complete',
      updated: 'Updated {time}',
      filterAll: 'All',
      filterOpen: 'Open',
      filterDone: 'Done',
      empty: 'No stages match this filter',
      result: 'Stage result',
      noResult: 'No stage result recorded yet',
      hint: 'Stage results update with the task board',
      statusPending: 'Pending',
      statusProgress: 'In progress',
      statusCompleted: 'Completed',
      untitled: 'Current task',
      progressLabel: 'Overall progress {pct}%',
      panelTitle: 'Task Progress',
      panelGuide: 'Review stages, results, and overall progress',
      panelEmptyTitle: 'No task board yet',
      panelEmptyHint: 'Ask the agent to start a multi-step task; its board will appear here.',
      headerLabel: 'Task progress {done}/{total}',
      headerEmpty: 'Task progress',
      close: 'Close task progress',
    }

    const CSS = `
      .tp-dock {
        box-sizing: border-box;
        width: calc(100% - var(--dsh-composer-side-clearance, 0px) - var(--dsh-composer-side-clearance, 0px) - var(--dsh-composer-dock-inset, 0px) - var(--dsh-composer-dock-inset, 0px) - var(--dsh-composer-dock-inset, 0px) - var(--dsh-composer-dock-inset, 0px));
        margin: 0 auto;
      }
      .tp-card {
        box-sizing: border-box;
        width: 100%;
        max-width: calc(var(--dsh-composer-card-max-width, 748px) - 4 * var(--dsh-composer-dock-inset, 0px));
        margin: 0 auto;
        overflow: hidden;
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-bg-layer-1);
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 14px;
        box-shadow: var(--dsw-elevation-panel, 0 6px 20px rgba(0, 0, 0, .08));
        font-size: 13px;
        line-height: 1.45;
      }
      .tp-head {
        display: flex;
        align-items: center;
        gap: 11px;
        width: 100%;
        padding: 11px 12px 10px;
        color: inherit;
        background: transparent;
        border: 0;
        text-align: left;
        font: inherit;
        cursor: pointer;
      }
      .tp-head:hover { background: var(--dsw-alias-bg-layer-2); }
      .tp-head:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
      .tp-ring { flex: none; width: 36px; height: 36px; }
      .tp-ring svg { display: block; width: 36px; height: 36px; }
      .tp-ringTrack { fill: none; stroke: var(--dsw-alias-border-l1); stroke-width: 3; }
      .tp-ringValue { fill: none; stroke: var(--dsw-alias-brand-primary); stroke-width: 3; stroke-linecap: round; transition: stroke-dashoffset .4s ease; }
      .tp-ringCheck { fill: none; stroke: var(--dsw-alias-state-success-primary); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
      .tp-ringText { fill: var(--dsw-alias-label-primary); font-size: 9px; font-weight: 650; }
      .tp-headText { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 1px; }
      .tp-eyebrow { display: flex; align-items: center; gap: 7px; min-width: 0; }
      .tp-kicker { flex: none; color: var(--dsw-alias-label-primary); font-size: 12px; font-weight: 650; letter-spacing: .01em; }
      .tp-count { flex: none; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); border-radius: 999px; padding: 1px 7px; font-size: 10.5px; font-variant-numeric: tabular-nums; }
      .tp-auto { flex: none; color: var(--dsw-alias-brand-primary); border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 28%, transparent); border-radius: 999px; padding: 0 6px; font-size: 10px; }
      .tp-source { flex: none; color: var(--dsw-alias-label-secondary); border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; padding: 0 6px; font-size: 10px; }
      .tp-goal { display: block; min-width: 0; overflow: hidden; color: var(--dsw-alias-label-primary); font-size: 14px; font-weight: 600; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
      .tp-sub { display: block; min-width: 0; overflow: hidden; color: var(--dsw-alias-label-secondary); font-size: 11.5px; line-height: 17px; text-overflow: ellipsis; white-space: nowrap; }
      .tp-aside { display: flex; flex: none; align-items: center; gap: 6px; }
      .tp-pill { border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; padding: 2px 8px; font-size: 10.5px; line-height: 16px; white-space: nowrap; }
      .tp-pill--pending { color: var(--dsw-alias-state-idle-primary); background: var(--dsw-alias-bg-layer-2); }
      .tp-pill--in_progress { color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 24%, transparent); }
      .tp-pill--completed { color: var(--dsw-alias-state-success-primary); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 9%, transparent); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 24%, transparent); }
      .tp-chev { flex: none; color: var(--dsw-alias-label-secondary); display: inline-flex; transition: transform .18s ease; }
      .tp-chev.is-open { transform: rotate(180deg); }
      .tp-track { height: 3px; overflow: hidden; background: var(--dsw-alias-border-l1); }
      .tp-fill { height: 100%; background: linear-gradient(90deg, var(--dsw-alias-brand-primary), var(--dsw-alias-state-success-primary)); transition: width .35s cubic-bezier(.22, .8, .28, 1); }
      .tp-body { padding: 8px 12px 10px; }
      .tp-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
      .tp-filters { display: flex; gap: 2px; padding: 2px; background: var(--dsw-alias-bg-layer-2); border-radius: 8px; }
      .tp-filter { padding: 4px 8px; color: var(--dsw-alias-label-secondary); background: transparent; border: 0; border-radius: 6px; font: inherit; font-size: 11px; line-height: 16px; cursor: pointer; }
      .tp-filter:hover { color: var(--dsw-alias-label-primary); }
      .tp-filter.is-active { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); box-shadow: 0 1px 3px rgba(0, 0, 0, .10); }
      .tp-filter b { margin-left: 3px; color: var(--dsw-alias-label-secondary); font-weight: 500; font-variant-numeric: tabular-nums; }
      .tp-time { flex: none; color: var(--dsw-alias-label-secondary); font-size: 10.5px; white-space: nowrap; }
      .tp-list { display: flex; flex-direction: column; margin: 1px 0 0; padding: 0; list-style: none; }
      .tp-item { position: relative; }
      .tp-item::before { position: absolute; top: 29px; bottom: 0; left: 13px; width: 1px; background: var(--dsw-alias-border-l1); content: ''; }
      .tp-item:last-child::before { display: none; }
      .tp-itemHead { position: relative; z-index: 1; display: grid; grid-template-columns: 20px minmax(0, 1fr) 16px; align-items: start; gap: 10px; width: 100%; padding: 7px 6px 7px 4px; color: inherit; background: transparent; border: 0; border-radius: 8px; text-align: left; font: inherit; cursor: pointer; }
      .tp-itemHead:hover { background: var(--dsw-alias-bg-layer-2); }
      .tp-itemHead:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
      .tp-node { position: relative; display: grid; place-items: center; width: 20px; height: 20px; margin-top: 1px; border: 1.5px solid var(--dsw-alias-border-l2); border-radius: 50%; background: var(--dsw-alias-bg-layer-1); }
      .tp-node--completed { color: var(--dsw-alias-bg-layer-1); background: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
      .tp-node--in_progress { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent); }
      .tp-node--pending { background: var(--dsw-alias-bg-layer-2); }
      .tp-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-brand-primary); animation: tpPulse 1.8s ease-in-out infinite; }
      .tp-itemText { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
      .tp-itemTop { display: flex; min-width: 0; align-items: baseline; gap: 8px; }
      .tp-itemTitle { min-width: 0; overflow: hidden; color: var(--dsw-alias-label-primary); font-size: 12.5px; font-weight: 500; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
      .tp-itemStatus { flex: none; color: var(--dsw-alias-label-secondary); font-size: 10.5px; line-height: 18px; }
      .tp-preview { display: block; min-width: 0; overflow: hidden; color: var(--dsw-alias-label-secondary); font-size: 11.5px; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }
      .tp-chevron { align-self: center; color: var(--dsw-alias-label-secondary); display: inline-flex; opacity: .65; transition: transform .18s ease; }
      .tp-chevron.is-open { transform: rotate(180deg); }
      .tp-detail { margin: 1px 0 8px 30px; padding: 8px 10px; background: var(--dsw-alias-bg-layer-2); border-left: 2px solid var(--dsw-alias-border-l2); border-radius: 0 8px 8px 0; }
      .tp-item--completed .tp-detail { border-left-color: var(--dsw-alias-state-success-primary); }
      .tp-item--in_progress .tp-detail { border-left-color: var(--dsw-alias-brand-primary); }
      .tp-detailText { margin: 0 0 6px; color: var(--dsw-alias-label-secondary); font-size: 11.5px; line-height: 1.5; }
      .tp-resultLabel { margin-bottom: 2px; color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
      .tp-resultText { max-height: 180px; margin: 0; overflow: auto; color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; white-space: pre-wrap; }
      .tp-resultEmpty { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 11.5px; font-style: italic; }
      .tp-empty { padding: 10px 4px; color: var(--dsw-alias-label-secondary); font-size: 11.5px; }
      .tp-foot { display: flex; justify-content: space-between; gap: 10px; padding: 6px 12px 8px; border-top: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); font-size: 10.5px; line-height: 15px; }
      .tp-footHint { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tp-footTime { flex: none; white-space: nowrap; }

      /* Right sidebar panel */
      .tp-panel {
        box-sizing: border-box;
        display: flex;
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-bg-base);
        font-size: 13px;
        line-height: 1.45;
      }
      .tp-panelInner { display: flex; width: 100%; max-width: 760px; min-height: 0; flex-direction: column; margin: 0 auto; }
      .tp-panel .tp-head { flex: none; align-items: flex-start; padding: 16px 14px 10px; cursor: default; }
      .tp-panel .tp-head:hover { background: transparent; }
      .tp-panel .tp-ring { margin-top: 1px; }
      .tp-panel .tp-goal { display: -webkit-box; overflow: hidden; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
      .tp-panel .tp-sub { white-space: normal; }
      .tp-panel .tp-aside { display: none; }
      .tp-panel .tp-track { flex: none; }
      .tp-panel .tp-body { display: flex; flex: 1; min-height: 0; flex-direction: column; padding: 8px 12px 0; overflow: hidden; }
      .tp-panel .tp-toolbar { flex: none; margin-bottom: 4px; }
      .tp-panel .tp-list { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: 8px; }
      .tp-panel .tp-list::-webkit-scrollbar { width: 6px; }
      .tp-panel .tp-list::-webkit-scrollbar-thumb { background: var(--dsw-alias-border-l2); border-radius: 999px; }
      .tp-panel .tp-foot { flex: none; padding: 8px 14px 12px; }
      .tp-panel .tp-itemHead { padding-right: 4px; }
      .tp-panel .tp-resultText { max-height: 240px; }
      .tp-panelEmpty {
        box-sizing: border-box;
        display: flex;
        width: 100%;
        height: 100%;
        min-height: 240px;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
        padding: 28px;
        color: var(--dsw-alias-label-secondary);
        text-align: center;
      }
      .tp-panelEmptyIcon { color: var(--dsw-alias-brand-primary); opacity: .85; }
      .tp-panelEmptyTitle { color: var(--dsw-alias-label-primary); font-size: 14px; font-weight: 600; }
      .tp-panelEmptyHint { max-width: 260px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.6; }
      .tp-tabTitle { color: inherit; font-size: 12px; }

      /* Floating card outside the conversation body */
      .tp-float {
        position: fixed;
        top: 86px;
        right: 18px;
        z-index: 100;
        display: flex;
        width: 360px;
        max-width: calc(100vw - 36px);
        max-height: min(640px, calc(100vh - 164px));
        flex-direction: column;
        overflow: hidden;
        color: var(--dsw-alias-label-primary);
        background: var(--dsw-alias-bg-layer-1);
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 16px;
        box-shadow: var(--dsw-elevation-panel, 0 12px 34px rgba(0, 0, 0, .18));
        animation: tpFloatIn .18s ease-out;
      }
      .tp-floatBody { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; }
      .tp-float .tp-panel { height: auto; max-height: 100%; background: transparent; }
      .tp-float .tp-panelInner { width: 100%; max-width: none; }
      .tp-float .tp-head { padding-right: 42px; }
      .tp-float .tp-list { max-height: min(360px, calc(100vh - 360px)); }
      .tp-float .tp-foot { padding-bottom: 10px; }
      .tp-floatClose {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 2;
        display: grid;
        width: 26px;
        height: 26px;
        place-items: center;
        padding: 0;
        color: var(--dsw-alias-label-secondary);
        background: transparent;
        border: 0;
        border-radius: 999px;
        cursor: pointer;
      }
      .tp-floatClose:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
      .tp-floatClose:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
      @keyframes tpFloatIn {
        from { opacity: 0; transform: translateY(4px) scale(.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Header utility launcher */
      .tp-headerBtn {
        display: grid;
        width: 28px;
        height: 28px;
        place-items: center;
        padding: 0;
        color: var(--dsw-alias-label-secondary);
        background: transparent;
        border: 0;
        border-radius: 999px;
        cursor: pointer;
      }
      .tp-headerBtn:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
      .tp-headerBtn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
      .tp-headerBtn svg { display: block; }
      .tp-miniRingTrack { fill: none; stroke: var(--dsw-alias-border-l2); stroke-width: 2.2; }
      .tp-miniRingValue { fill: none; stroke: var(--dsw-alias-brand-primary); stroke-width: 2.2; stroke-linecap: round; transition: stroke-dashoffset .35s ease; }
      .tp-miniRingCheck { fill: none; stroke: var(--dsw-alias-state-success-primary); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
      .tp-headerIcon { color: var(--dsw-alias-label-secondary); }

      @keyframes tpPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(.55); opacity: .55; }
      }
      @media (max-width: 520px) {
        .tp-pill { display: none; }
        .tp-head { gap: 8px; padding: 10px 10px 9px; }
        .tp-goal { font-size: 13px; }
        .tp-sub { font-size: 11px; }
        .tp-time { display: none; }
        .tp-footHint { white-space: normal; }
      }
      @media (prefers-reduced-motion: reduce) {
        .tp-dot { animation: none; }
        .tp-fill, .tp-ringValue, .tp-chev, .tp-chevron { transition: none; }
        .tp-float { animation: none; }
      }
    `

    function interpolate(template, vars) {
      let out = template
      for (const key of Object.keys(vars)) out = out.split('{' + key + '}').join(String(vars[key]))
      return out
    }

    function tx(t, key, vars) {
      const raw = typeof t === 'function' ? t(key) : key
      return vars === undefined ? raw : interpolate(raw, vars)
    }

    function formatTime(value) {
      if (!Number.isFinite(value)) return ''
      try {
        return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      } catch {
        return ''
      }
    }

    function statusKey(status) {
      if (status === 'completed') return 'statusCompleted'
      if (status === 'in_progress') return 'statusProgress'
      return 'statusPending'
    }

    function createOpenStore() {
      const open = new Set()
      const listeners = new Set()
      const emit = () => {
        for (const listener of listeners) listener()
      }
      const isOpen = (sessionId) => open.has(sessionId)
      const setOpen = (sessionId, value) => {
        const changed = value ? !open.has(sessionId) : open.has(sessionId)
        if (!changed) return
        if (value) open.add(sessionId)
        else open.delete(sessionId)
        emit()
      }
      return {
        isOpen,
        setOpen,
        toggle(sessionId) {
          setOpen(sessionId, !isOpen(sessionId))
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    }

    const floatStore = createOpenStore()

    function useFloatOpen(sessionId) {
      return React.useSyncExternalStore(
        floatStore.subscribe,
        () => floatStore.isOpen(sessionId),
        () => false
      )
    }

    function Ring({ percent, done, t }) {
      const radius = 15
      const circumference = 2 * Math.PI * radius
      return h(
        'span',
        { className: 'tp-ring' },
        h(
          'svg',
          {
            viewBox: '0 0 36 36',
            role: 'img',
            'aria-label': tx(t, 'progressLabel', { pct: percent }),
          },
          h('circle', { className: 'tp-ringTrack', cx: 18, cy: 18, r: radius }),
          h('circle', {
            className: 'tp-ringValue',
            cx: 18,
            cy: 18,
            r: radius,
            strokeDasharray: String(circumference),
            strokeDashoffset: String(circumference * (1 - percent / 100)),
            transform: 'rotate(-90 18 18)',
          }),
          done
            ? h('path', {
                className: 'tp-ringCheck',
                d: 'M11.5 18.4l4.1 4.1 8.4-9.1',
              })
            : h(
                'text',
                {
                  className: 'tp-ringText',
                  x: 18,
                  y: 18,
                  textAnchor: 'middle',
                  dominantBaseline: 'central',
                },
                percent + '%'
              )
        )
      )
    }

    function CheckIcon() {
      return h(
        'svg',
        { width: 12, height: 12, viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', {
          d: 'M3.2 8.2l3 3 6.6-7',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        })
      )
    }

    function Chevron({ className }) {
      return h(
        'span',
        { className, 'aria-hidden': true },
        h(
          'svg',
          { width: 14, height: 14, viewBox: '0 0 16 16' },
          h('path', {
            d: 'M4 6l4 4 4-4',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          })
        )
      )
    }

    function TaskNode({ status }) {
      if (status === 'completed') {
        return h('span', { className: 'tp-node tp-node--completed' }, h(CheckIcon))
      }
      if (status === 'in_progress') {
        return h('span', { className: 'tp-node tp-node--in_progress' }, h('span', { className: 'tp-dot' }))
      }
      return h('span', { className: 'tp-node tp-node--pending' })
    }

    function TaskGlyph({ size = 16, className }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 20 20',
          className,
          'aria-hidden': true,
        },
        h('rect', {
          x: 2.5,
          y: 2.5,
          width: 15,
          height: 15,
          rx: 4,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
        }),
        h('path', {
          d: 'M6.2 7.1l1.2 1.2 2.2-2.4',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        h('path', { d: 'M11.5 7.4h2.5M6.2 12.6h7.8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' })
      )
    }

    function MiniRing({ percent, done }) {
      const radius = 8
      const circumference = 2 * Math.PI * radius
      return h(
        'svg',
        { width: 20, height: 20, viewBox: '0 0 20 20', 'aria-hidden': true },
        h('circle', { className: 'tp-miniRingTrack', cx: 10, cy: 10, r: radius }),
        h('circle', {
          className: 'tp-miniRingValue',
          cx: 10,
          cy: 10,
          r: radius,
          strokeDasharray: String(circumference),
          strokeDashoffset: String(circumference * (1 - percent / 100)),
          transform: 'rotate(-90 10 10)',
        }),
        done
          ? h('path', {
              className: 'tp-miniRingCheck',
              d: 'M6.3 10.2l2.2 2.2 5.2-5.7',
            })
          : null
      )
    }

    function EmptyPanel({ t }) {
      return h(
        'div',
        { className: 'tp-panelEmpty' },
        h(TaskGlyph, { size: 32, className: 'tp-panelEmptyIcon' }),
        h('div', { className: 'tp-panelEmptyTitle' }, tx(t, 'panelEmptyTitle')),
        h('div', { className: 'tp-panelEmptyHint' }, tx(t, 'panelEmptyHint'))
      )
    }

    function TaskProgressHeaderButton({ useProjection, t, sessionId }) {
      const rawBoard = useProjection(PROJECTION)
      const board = rawBoard === undefined ? null : rawBoard
      const tasks = board && Array.isArray(board.tasks) ? board.tasks : []
      const total = tasks.length
      const completed = tasks.filter((task) => task.status === 'completed').length
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
      const allDone = total > 0 && completed === total
      const label = total > 0 ? tx(t, 'headerLabel', { done: completed, total }) : tx(t, 'headerEmpty')
      const open = useFloatOpen(sessionId)
      const autoOpened = React.useRef(false)

      React.useEffect(() => {
        if (autoOpened.current || board === null || total === 0) return
        const fresh = Number.isFinite(board.updatedAt) && Date.now() - board.updatedAt < 20000
        if (!fresh) return
        autoOpened.current = true
        floatStore.setOpen(sessionId, true)
      }, [board, total, sessionId])

      return h(
        'button',
        {
          type: 'button',
          className: 'tp-headerBtn',
          onClick: () => floatStore.toggle(sessionId),
          title: label,
          'aria-label': label,
          'aria-expanded': open,
        },
        total > 0
          ? h(MiniRing, { percent, done: allDone })
          : h(TaskGlyph, { size: 17, className: 'tp-headerIcon' })
      )
    }

    function TaskProgressView({ useProjection, t, variant = 'dock' }) {
      const panel = variant === 'panel'
      const rawBoard = useProjection(PROJECTION)
      const board = rawBoard === undefined ? null : rawBoard
      const tasks = board && Array.isArray(board.tasks) ? board.tasks : []
      const total = tasks.length
      const completed = tasks.filter((task) => task.status === 'completed').length
      const inProgress = tasks.filter((task) => task.status === 'in_progress').length
      const open = total - completed
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
      const allDone = total > 0 && completed === total
      const activeTask = tasks.find((task) => task.status === 'in_progress') ?? tasks.find((task) => task.status === 'pending')
      const [expanded, setExpanded] = React.useState(true)
      const [filter, setFilter] = React.useState('all')
      const [openTask, setOpenTask] = React.useState(null)
      const seenBoard = React.useRef(null)

      React.useEffect(() => {
        const updatedAt = board && Number.isFinite(board.updatedAt) ? board.updatedAt : null
        if (updatedAt === null || total === 0) {
          seenBoard.current = null
          setOpenTask(null)
          return
        }
        if (seenBoard.current === null) {
          seenBoard.current = updatedAt
          setExpanded(true)
          setOpenTask(panel && activeTask ? activeTask.id : null)
        } else if (seenBoard.current !== updatedAt) {
          seenBoard.current = updatedAt
        }
        setOpenTask((current) => (current && tasks.some((task) => task.id === current) ? current : null))
      }, [board, total, panel, activeTask])

      const visible = React.useMemo(() => {
        if (filter === 'done') return tasks.filter((task) => task.status === 'completed')
        if (filter === 'open') return tasks.filter((task) => task.status !== 'completed')
        return tasks
      }, [tasks, filter])

      if (rawBoard === undefined) return null
      if (board === null || total === 0) return panel ? h(EmptyPanel, { t }) : null

      const status = allDone ? 'completed' : inProgress > 0 ? 'in_progress' : 'pending'
      const statusText = tx(t, statusKey(status))
      const goal = board.goal || tx(t, 'untitled')
      const subline = allDone ? board.summary || tx(t, 'allDone') : (activeTask ? tx(t, 'current') + ' · ' + activeTask.title : board.summary || '')
      const timeText = formatTime(board.updatedAt)
      const headProps = panel
        ? { className: 'tp-head' }
        : {
            type: 'button',
            className: 'tp-head',
            onClick: () => setExpanded((value) => !value),
            'aria-expanded': expanded,
            'aria-controls': 'task-progress-body',
            'aria-label': tx(t, expanded ? 'collapse' : 'expand'),
          }

      const filters = [
        { id: 'all', label: tx(t, 'filterAll'), count: total },
        { id: 'open', label: tx(t, 'filterOpen'), count: open },
        { id: 'done', label: tx(t, 'filterDone'), count: completed },
      ]

      return h(
        'div',
        { className: panel ? 'tp-panel' : 'tp-dock', 'data-task-progress': true },
        h(
          'div',
          { className: panel ? 'tp-panelInner' : 'tp-card' },
          h(
            panel ? 'div' : 'button',
            headProps,
            h(Ring, { percent, done: allDone, t }),
            h(
              'span',
              { className: 'tp-headText' },
              h(
                'span',
                { className: 'tp-eyebrow' },
                h('span', { className: 'tp-kicker' }, tx(t, allDone ? 'titleDone' : 'title')),
                h('span', { className: 'tp-count' }, tx(t, 'count', { done: completed, total })),
                board.auto
                  ? h('span', { className: 'tp-auto' }, tx(t, 'auto'))
                  : board.source === 'turn'
                    ? h('span', { className: 'tp-source' }, tx(t, 'thisTurn'))
                    : null
              ),
              h('span', { className: 'tp-goal' }, goal),
              h('span', { className: 'tp-sub' }, subline || tx(t, 'allDone'))
            ),
            h(
              'span',
              { className: 'tp-aside' },
              h('span', { className: 'tp-pill tp-pill--' + status }, statusText),
              panel ? null : h(Chevron, { className: 'tp-chev' + (expanded ? ' is-open' : '') })
            )
          ),
          h('div', { className: 'tp-track' }, h('div', { className: 'tp-fill', style: { width: percent + '%' } })),
          panel || expanded
            ? h(
                'div',
                { className: 'tp-body', id: panel ? undefined : 'task-progress-body' },
                h(
                  'div',
                  { className: 'tp-toolbar' },
                  h(
                    'div',
                    { className: 'tp-filters', role: 'group', 'aria-label': tx(t, 'title') },
                    filters.map((item) =>
                      h(
                        'button',
                        {
                          key: item.id,
                          type: 'button',
                          className: 'tp-filter' + (filter === item.id ? ' is-active' : ''),
                          onClick: () => setFilter(item.id),
                          'aria-pressed': filter === item.id,
                        },
                        item.label,
                        h('b', null, item.count)
                      )
                    )
                  ),
                  timeText ? h('span', { className: 'tp-time' }, tx(t, 'updated', { time: timeText })) : null
                ),
                visible.length === 0
                  ? h('div', { className: 'tp-empty' }, tx(t, 'empty'))
                  : h(
                      'ol',
                      { className: 'tp-list' },
                      visible.map((task) =>
                        h(
                          'li',
                          { key: task.id, className: 'tp-item tp-item--' + task.status },
                          h(
                            'button',
                            {
                              type: 'button',
                              className: 'tp-itemHead',
                              onClick: () => setOpenTask((current) => (current === task.id ? null : task.id)),
                              'aria-expanded': openTask === task.id,
                              'aria-label': task.title + ' · ' + tx(t, statusKey(task.status)),
                            },
                            h(TaskNode, { status: task.status }),
                            h(
                              'span',
                              { className: 'tp-itemText' },
                              h(
                                'span',
                                { className: 'tp-itemTop' },
                                h('span', { className: 'tp-itemTitle' }, task.title),
                                h('span', { className: 'tp-itemStatus' }, tx(t, statusKey(task.status)))
                              ),
                              task.status === 'completed' && task.result && openTask !== task.id
                                ? h('span', { className: 'tp-preview' }, task.result)
                                : null,
                              task.status === 'in_progress' && task.detail && openTask !== task.id
                                ? h('span', { className: 'tp-preview' }, task.detail)
                                : null
                            ),
                            h(Chevron, { className: 'tp-chevron' + (openTask === task.id ? ' is-open' : '') })
                          ),
                          openTask === task.id
                            ? h(
                                'div',
                                { className: 'tp-detail' },
                                task.detail ? h('p', { className: 'tp-detailText' }, task.detail) : null,
                                h('div', { className: 'tp-resultLabel' }, tx(t, 'result')),
                                task.result
                                  ? h('p', { className: 'tp-resultText' }, task.result)
                                  : h('p', { className: 'tp-resultEmpty' }, tx(t, 'noResult'))
                              )
                            : null
                        )
                      )
                    )
              )
            : null,
          h(
            'div',
            { className: 'tp-foot' },
            h('span', { className: 'tp-footHint' }, tx(t, 'hint'))
          )
        )
      )
    }

    function TaskProgressPanel(props) {
      return h(TaskProgressView, { ...props, variant: 'panel' })
    }

    function CloseIcon() {
      return h(
        'svg',
        { width: 13, height: 13, viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', {
          d: 'M4 4l8 8M12 4l-8 8',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
        })
      )
    }

    function useActiveSessionId(useSessions) {
      return useSessions((snapshot) => {
        if (snapshot === undefined || snapshot.byId === undefined || !Array.isArray(snapshot.ids)) {
          return undefined
        }
        for (const id of snapshot.ids) {
          if ((snapshot.byId[id]?.retainedBy?.mainView ?? 0) > 0) return id
        }
        return undefined
      })
    }

    function useSessionProjection(sessions, sessionId) {
      const face = React.useMemo(() => {
        if (sessionId === undefined) return undefined
        return sessions.binding(sessionId)?.session.projections.faceOf(PROJECTION)
      }, [sessions, sessionId])
      const subscribe = React.useCallback(
        (listener) => (face === undefined ? () => {} : face.subscribe(listener)),
        [face]
      )
      const getSnapshot = React.useCallback(() => (face === undefined ? undefined : face.getSnapshot()), [face])
      return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    }

    function TaskProgressOverlay({ useSessions, sessions, t, forceOpen = false }) {
      const sessionId = useActiveSessionId(useSessions)
      const board = useSessionProjection(sessions, sessionId)
      const open = useFloatOpen(sessionId)
      if (!forceOpen && !open) return null
      if (sessionId === undefined) return null
      return h(
        'div',
        {
          className: 'tp-float',
          role: 'dialog',
          'aria-label': tx(t, 'panelTitle'),
          'data-task-progress': true,
          'data-task-progress-float': true,
        },
        h(
          'button',
          {
            type: 'button',
            className: 'tp-floatClose',
            onClick: () => floatStore.setOpen(sessionId, false),
            'aria-label': tx(t, 'close'),
            title: tx(t, 'close'),
          },
          h(CloseIcon)
        ),
        h(
          'div',
          { className: 'tp-floatBody' },
          h(TaskProgressPanel, {
            useProjection: () => board,
            t,
          })
        )
      )
    }

    return {
      inject: ['slots', 'locale', 'sessions'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'task-progress: dictionaries')
        ctx.effect(() => {
          const tag = document.createElement('style')
          tag.dataset.plugin = '@local/dsh-task-progress'
          tag.textContent = CSS
          document.head.appendChild(tag)
          return () => tag.remove()
        }, 'task-progress: styles')

        // Migrate away from the short-lived right-sidebar tab version.
        ctx.effect(() => {
          try {
            const sidebarRight = ctx.get('sidebarRight')
            const active = sidebarRight?.active()
            if (active !== undefined && active.kind === 'task-progress') sidebarRight.close(active.id)
          } catch {
            /* layout may not have adopted the Session yet */
          }
        }, 'task-progress: close legacy tab')

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'task-progress-float',
              order: -10,
              inject: () => ({
                sessions: ctx.sessions,
                t: ctx.locale.bind(NS),
              }),
            },
            TaskProgressOverlay
          )
        )

        ctx.slots.inject('conversation.session.header.utilities', () =>
          ctx.slots.register(
            {
              name: 'conversation.session.header.utilities',
              id: 'task-progress',
              order: 5,
              locale: NS,
            },
            TaskProgressHeaderButton
          )
        )
      },
    }
  },
})
