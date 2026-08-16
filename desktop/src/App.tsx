import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { AppConfig, AppState, AudioSource, EngineEvent, Lang, ViewMode } from './types'
import TitleBar from './components/TitleBar'
import SideRail from './components/SideRail'
import AnswerPane from './components/AnswerPane'
import StatusBar from './components/StatusBar'
import AutoOverlay from './components/AutoOverlay'
import KeySetup from './components/KeySetup'

const PLACEHOLDER = 'Waiting for the next question…'
const STATUS_READY = 'Ready · F2 record / F3 listen / F4 clear'

const initial: AppState = {
  run: 'idle',
  status: 'Starting…',
  currentQ: PLACEHOLDER,
  currentQId: '',
  turns: [],
  partial: '',
  busy: false,
  opacity: 83,
  pinned: true,
  micMuted: false,
  stealth: false,
  view: 'workspace',
  draft: '',
  llm: { provider: 'deepseek', model: '' },
  stt: 'small',
  lang: 'auto',
  source: 'system',
  autoOn: false,
  models: [],
  keys: { hasLlm: true, hasStt: true },
}

type Action =
  | { type: 'engine'; ev: EngineEvent }
  | { type: 'opacity'; value: number }
  | { type: 'pinned'; value: boolean }
  | { type: 'mic_muted'; muted: boolean }
  | { type: 'stealth'; on: boolean }
  | { type: 'view'; view: ViewMode }
  | { type: 'draft'; text: string }
  | { type: 'llm'; provider: string; model: string }
  | { type: 'stt'; model: string }
  | { type: 'lang'; lang: Lang }
  | { type: 'source'; source: AudioSource }
  | { type: 'config'; cfg: AppConfig }
  | { type: 'clear' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'config': {
      const cfg = action.cfg
      const llm = { provider: cfg.llm?.provider ?? 'deepseek', model: cfg.llm?.model ?? '' }
      const stt = cfg.stt?.model ?? 'small'
      const langRaw = cfg.stt?.language
      const lang: Lang = langRaw === 'zh' || langRaw === 'en' ? langRaw : 'auto'
      const srcRaw = cfg.audio?.source ?? 'system'
      const source: AudioSource = srcRaw === 'both' ? 'both' : 'system'
      const opacity = Math.min(100, Math.max(10, Math.round(cfg.ui?.opacity ?? 83)))
      return { ...state, llm, stt, lang, source, opacity, models: cfg.models ?? [] }
    }
    case 'engine': {
      const ev = action.ev
      switch (ev.type) {
        case 'ready':
          return { ...state, status: STATUS_READY, run: 'idle' }
        case 'keys_status':
          return { ...state, keys: { hasLlm: ev.has_llm, hasStt: ev.has_stt } }
        case 'state': {
          const run = ev.state as AppState['run']
          let autoOn = state.autoOn
          let view = state.view
          if (run === 'listen') {
            if (!autoOn && view === 'workspace') view = 'focus' // 刚进入监听 → Auto Focus
            autoOn = true
          } else if (run === 'idle') {
            autoOn = false
            if (view !== 'workspace') view = 'workspace' // 退出 Auto → 回 Workspace
          }
          const busy = run === 'think'
          return { ...state, run, autoOn, view, busy }
        }
        case 'status':
          return { ...state, status: ev.text }
        case 'partial':
          return { ...state, partial: ev.text }
        case 'question': {
          const qid = ev.id ?? ''
          const turns = [...state.turns, { id: qid, q: ev.text, a: '' }]
          return { ...state, turns, currentQ: ev.text, currentQId: qid, partial: '' }
        }
        case 'chunk': {
          if (state.turns.length === 0) return state
          const turns = state.turns.slice()
          const last = turns[turns.length - 1]
          // 只接受绑定当前 questionId 的 chunk, 旧请求/晚到回答直接丢弃
          if (ev.id && last.id !== ev.id) return state
          turns[turns.length - 1] = { ...last, a: last.a + ev.text }
          return { ...state, turns }
        }
        case 'done':
          return { ...state, busy: false }
        case 'error':
          return { ...state, status: ev.text }
        default:
          return state
      }
    }
    case 'opacity':
      return { ...state, opacity: action.value }
    case 'pinned':
      return { ...state, pinned: action.value }
    case 'mic_muted':
      return { ...state, micMuted: action.muted }
    case 'stealth':
      return { ...state, stealth: action.on }
    case 'view':
      return { ...state, view: action.view }
    case 'draft':
      return { ...state, draft: action.text }
    case 'llm':
      return { ...state, llm: { provider: action.provider, model: action.model } }
    case 'stt':
      return { ...state, stt: action.model }
    case 'lang':
      return { ...state, lang: action.lang }
    case 'source':
      return { ...state, source: action.source }
    case 'clear':
      return { ...state, turns: [], currentQ: PLACEHOLDER, currentQId: '', partial: '', status: 'Cleared' }
    default:
      return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initial)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const api = window.api
    const offEvent = api.onEvent((e) => dispatch({ type: 'engine', ev: e }))
    const offShortcut = api.onShortcut((k) => {
      if (k === 'f2') api.send({ type: 'manual' })
      else if (k === 'f3') api.send({ type: 'toggle_listen' })
      else if (k === 'f4') {
        api.send({ type: 'clear' })
        dispatch({ type: 'clear' })
      }
      else if (k === 'f8') {
        // F8: Workspace ↔ Auto Full Screen
        const v = stateRef.current.view
        dispatch({ type: 'view', view: v === 'workspace' ? 'fullscreen' : 'workspace' })
      }
      else if (k === 'f9') {
        const next = !stateRef.current.stealth
        api.setStealth(next)
        dispatch({ type: 'stealth', on: next })
        dispatch({ type: 'engine', ev: { type: 'status', text: next ? 'Stealth on — hidden from screen capture' : 'Stealth off' } })
      }
    })
    api.getConfig().then((cfg) => dispatch({ type: 'config', cfg }))
    return () => {
      offEvent()
      offShortcut()
    }
  }, [])

  const copyLatest = useCallback(() => {
    const turns = stateRef.current.turns
    const text = (turns[turns.length - 1]?.a ?? '').trim()
    if (text) {
      window.api.copy(text)
      dispatch({ type: 'engine', ev: { type: 'status', text: 'Copied latest answer' } })
    } else {
      dispatch({ type: 'engine', ev: { type: 'status', text: 'No completed answer to copy yet.' } })
    }
  }, [])

  // 窗口级 A / C / X 快捷键(输入框聚焦时当普通字母)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (stateRef.current.view !== 'workspace') {
        // Auto 视图: Ctrl+K 或 / 唤出输入栏; Esc 收起; C 复制
        if (e.ctrlKey && k === 'k') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('ov:show-input'))
        } else if (k === '/') {
          window.dispatchEvent(new CustomEvent('ov:show-input'))
        } else if (k === 'escape') {
          window.dispatchEvent(new CustomEvent('ov:hide-input'))
        } else if (k === 'c') {
          copyLatest()
        }
        return
      }
      if (k === 'a') window.api.send({ type: 'toggle_listen' })
      else if (k === 'c') copyLatest()
      else if (k === 'x') {
        window.api.send({ type: 'clear' })
        dispatch({ type: 'clear' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [copyLatest])

  const handleManual = useCallback(() => window.api.send({ type: 'manual' }), [])
  const handleAuto = useCallback(() => window.api.send({ type: 'toggle_listen' }), [])
  const handleClear = useCallback(() => {
    window.api.send({ type: 'clear' })
    dispatch({ type: 'clear' })
  }, [])
  const handleAsk = useCallback((text: string) => window.api.send({ type: 'ask', text }), [])

  const handleOpacity = useCallback((n: number) => {
    window.api.setOpacity(n)
    dispatch({ type: 'opacity', value: n })
  }, [])

  const handlePinned = useCallback((b: boolean) => {
    window.api.setPinned(b)
    dispatch({ type: 'pinned', value: b })
  }, [])

  const handleMicMuted = useCallback((muted: boolean) => {
    window.api.send({ type: 'set_mic_muted', muted })
    dispatch({ type: 'mic_muted', muted })
  }, [])

  const handleStealth = useCallback((on: boolean) => {
    window.api.setStealth(on)
    dispatch({ type: 'stealth', on })
    dispatch({ type: 'engine', ev: { type: 'status', text: on ? 'Stealth on — hidden from screen capture' : 'Stealth off' } })
  }, [])

  const handleModel = useCallback((provider: string, model: string) => {
    window.api.send({ type: 'set_llm', provider, model })
    dispatch({ type: 'llm', provider, model })
  }, [])

  // 同步窗口尺寸(Workspace / Auto Focus / Auto Full Screen)
  useEffect(() => {
    window.api.setView(state.view)
  }, [state.view])

  const handleStt = useCallback((model: string) => {
    window.api.send({ type: 'set_stt', model })
    dispatch({ type: 'stt', model })
  }, [])

  const handleLang = useCallback((lang: Lang) => {
    window.api.send({ type: 'set_lang', language: lang === 'auto' ? null : lang })
    dispatch({ type: 'lang', lang })
  }, [])

  const handleSource = useCallback((source: AudioSource) => {
    window.api.send({ type: 'set_source', source })
    dispatch({ type: 'source', source })
    dispatch({ type: 'engine', ev: { type: 'status', text: source === 'both' ? 'Listen source: system + microphone' : 'Listen source: system audio' } })
  }, [])

  if (!state.keys.hasLlm || !state.keys.hasStt) {
    return <KeySetup hasLlm={state.keys.hasLlm} hasStt={state.keys.hasStt} />
  }

  if (state.view !== 'workspace') {
    const fullscreen = state.view === 'fullscreen'
    return (
      <div className={`app overlay-app${fullscreen ? ' fullscreen' : ''}`}>
        <AutoOverlay
          run={state.run}
          currentQ={state.currentQ}
          partial={state.partial}
          turns={state.turns}
          busy={state.busy}
          autoOn={state.autoOn}
          fullscreen={fullscreen}
          draft={state.draft}
          pinned={state.pinned}
          stealth={state.stealth}
          micMuted={state.micMuted}
          onDraft={(text) => dispatch({ type: 'draft', text })}
          onAsk={handleAsk}
          onCopy={copyLatest}
          onExpand={() => dispatch({ type: 'view', view: 'workspace' })}
          onStop={() => {
            window.api.send({ type: 'toggle_listen' })
            if (state.autoOn) dispatch({ type: 'view', view: 'workspace' })
          }}
          onViewToggle={() =>
            dispatch({ type: 'view', view: fullscreen ? 'workspace' : 'fullscreen' })
          }
          onPinned={handlePinned}
          onStealth={handleStealth}
          onMicMuted={handleMicMuted}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <TitleBar
        models={state.models}
        llm={state.llm}
        stt={state.stt}
        lang={state.lang}
        source={state.source}
        opacity={state.opacity}
        pinned={state.pinned}
        micMuted={state.micMuted}
        stealth={state.stealth}
        onModel={handleModel}
        onStt={handleStt}
        onLang={handleLang}
        onSource={handleSource}
        onOpacity={handleOpacity}
        onPinned={handlePinned}
        onMicMuted={handleMicMuted}
        onStealth={handleStealth}
        onFullScreen={() => dispatch({ type: 'view', view: 'fullscreen' })}
      />
      <div className="workspace">
        <SideRail
          run={state.run}
          autoOn={state.autoOn}
          onListening={handleManual}
          onAuto={handleAuto}
          onCopy={copyLatest}
          onClear={handleClear}
        />
        <AnswerPane
          currentQ={state.currentQ}
          partial={state.partial}
          turns={state.turns}
          busy={state.busy}
          onAsk={handleAsk}
        />
      </div>
      <StatusBar run={state.run} status={state.status} />
    </div>
  )
}
