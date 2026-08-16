import { useCallback, useEffect, useRef, useState } from 'react'
import type { RunState, Turn } from '../types'
import { AnswerContent, QuestionBlock } from './AnswerContent'

interface Props {
  run: RunState
  currentQ: string
  partial: string
  turns: Turn[]
  busy: boolean
  autoOn: boolean
  fullscreen: boolean
  draft: string
  pinned: boolean
  stealth: boolean
  micMuted: boolean
  onDraft: (text: string) => void
  onAsk: (text: string) => void
  onCopy: () => void
  onExpand: () => void
  onStop: () => void
  onViewToggle: () => void
  onPinned: (b: boolean) => void
  onStealth: (on: boolean) => void
  onMicMuted: (muted: boolean) => void
}

/* ---------- 图标 ---------- */

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4l7 7-4 4-1.5-1.5L8 17l-5-5 3.5-2.5L5 8z" />
      <line x1="3" y1="17" x2="7" y2="13" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 3l15 14" />
      <path d="M10.6 5.1A8.6 8.6 0 0 0 2 10a8.8 8.8 0 0 0 4.2 3.7M8 15.6A8.8 8.8 0 0 0 18 10a8.6 8.6 0 0 0-1.4-2.4" />
      <path d="M9.9 12.9a3 3 0 0 1-3-3" />
      <path d="M12.5 10.4a2.5 2.5 0 0 0-2.9-2.9" />
    </svg>
  )
}

function MicMuteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8.5" strokeOpacity="0.35" />
      <rect x="8" y="3" width="4" height="10" rx="2" />
      <path d="M5 11a5 5 0 0 0 7 2.2" />
      <line x1="10" y1="16" x2="10" y2="18" />
      <line x1="7" y1="18" x2="13" y2="18" />
      <line x1="2" y1="2" x2="18" y2="18" />
    </svg>
  )
}

function MicOnIcon2() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8.5" strokeOpacity="0.35" />
      <rect x="8" y="3" width="4" height="10" rx="2" />
      <path d="M5 11a5 5 0 0 0 10 0" />
      <line x1="10" y1="16" x2="10" y2="18" />
      <line x1="7" y1="18" x2="13" y2="18" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H3v5" />
      <path d="M12 3h5v5" />
      <path d="M8 17H3v-5" />
      <path d="M12 17h5v-5" />
    </svg>
  )
}

function MicStopIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="3" width="4" height="10" rx="2" />
      <path d="M5 11a5 5 0 0 0 10 0" />
      <line x1="10" y1="16" x2="10" y2="18" />
      <line x1="7" y1="18" x2="13" y2="18" />
    </svg>
  )
}

function WaveBars() {
  return (
    <span className="ov-wave" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

/* ---------- 跨视图滚动位置保持 ---------- */

let lastScrollTop = 0

/* ---------- 主组件 ---------- */

export default function AutoOverlay(props: Props) {
  const { run, currentQ, partial, turns, busy, autoOn, fullscreen, draft,
    pinned, stealth, micMuted, onDraft, onAsk, onCopy, onExpand, onStop,
    onViewToggle, onPinned, onStealth, onMicMuted } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const focusedRef = useRef(false)
  const hideTimer = useRef<number | undefined>(undefined)
  const [scrollPinned, setScrollPinned] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inputVisible, setInputVisible] = useState(false)
  const [newQHint, setNewQHint] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)
  const prevTurns = useRef(turns.length)

  const answer = turns.length > 0 ? turns[turns.length - 1].a : ''

  // 切换视图后恢复滚动位置
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = lastScrollTop
    return () => {
      if (scrollRef.current) lastScrollTop = scrollRef.current.scrollTop
    }
  }, [])

  // 自动滚动(用户手动上滚时暂停)
  useEffect(() => {
    if (scrollPinned) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [answer, scrollPinned])

  useEffect(() => {
    const clear = () => {
      window.clearTimeout(copyTimer.current)
      window.clearTimeout(hideTimer.current)
    }
    window.addEventListener('beforeunload', clear)
    return () => {
      clear()
      window.removeEventListener('beforeunload', clear)
    }
  }, [])

  // 鼠标移到底部 36px → 滑入输入栏
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (e.clientY > window.innerHeight - 36) setInputVisible(true)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // Ctrl+K / / / Esc 唤出/收起输入栏(来自 App keydown 的 CustomEvent)
  useEffect(() => {
    const show = () => {
      setInputVisible(true)
      window.setTimeout(() => inputRef.current?.focus(), 60)
    }
    const hide = () => setInputVisible(false)
    window.addEventListener('ov:show-input', show)
    window.addEventListener('ov:hide-input', hide)
    return () => {
      window.removeEventListener('ov:show-input', show)
      window.removeEventListener('ov:hide-input', hide)
    }
  }, [])

  // Auto 检测到新问题而输入框有草稿 → 轻量提示
  useEffect(() => {
    if (turns.length > prevTurns.current && draft.trim()) {
      setNewQHint(true)
      window.setTimeout(() => setNewQHint(false), 2000)
    }
    prevTurns.current = turns.length
  }, [turns.length, draft])

  const scheduleHide = () => {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      if (!focusedRef.current) setInputVisible(false)
    }, 1500)
  }

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    setScrollPinned(!nearBottom)
  }

  const jumpLatest = () => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
    setScrollPinned(false)
  }

  const handleCopy = useCallback(() => {
    if (!answer.trim()) return
    onCopy()
    setCopied(true)
    window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000)
  }, [answer, onCopy])

  const submitAsk = () => {
    const text = draft.trim()
    if (!text) return
    onAsk(text)
    onDraft('')
    inputRef.current?.focus()
  }

  const listening = run === 'listen' || run === 'record'
  const transcribing = !!partial
  const generating = run === 'think' || busy
  const ready = !!answer && !generating

  const statusText = generating
    ? 'Generating answer…'
    : transcribing
      ? 'Transcribing…'
      : ready
        ? 'Answer ready'
        : 'Listening for the next question…'

  const showQ = currentQ && currentQ !== 'Waiting for the next question…' && !partial

  return (
    <div className={`ov-root${fullscreen ? ' full' : ''}`}>
      {/* 顶栏 56px */}
      <div className="ov-topbar">
        <div className="ov-brand">
          <svg width="22" height="22" viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <path d="M26 88 V32 A13 13 0 0 1 52 32 L78 58" stroke="#f5f8ff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M58 38 Q66 29 81 34 V60" stroke="#f5f8ff" strokeWidth="9" strokeLinecap="round" />
            <circle cx="81" cy="70" r="4.5" fill="#00d2ff" />
          </svg>
          <span className="ov-brand-name">Nod</span>
          <span className="ov-status-dot" />
          <span className="ov-mode-tag">AUTO LISTENING</span>
        </div>
        <div className="ov-top-actions">
          <button
            className={`ov-fn-btn${micMuted ? ' on' : ''}`}
            onClick={() => onMicMuted(!micMuted)}
            title={micMuted ? 'Unmute' : 'Mute microphone'}
          >
            {micMuted ? <MicMuteIcon /> : <MicOnIcon2 />}
          </button>
          <button
            className={`ov-fn-btn${pinned ? ' on' : ''}`}
            onClick={() => onPinned(!pinned)}
            title={pinned ? 'Pinned on top' : 'Pin on top'}
          >
            <PinIcon />
          </button>
          <button
            className={`ov-fn-btn${stealth ? ' on' : ''}`}
            onClick={() => onStealth(!stealth)}
            title={stealth ? 'Stealth on — hidden from screen capture (F9)' : 'Stealth — hide from screen capture (F9)'}
          >
            <EyeOffIcon />
          </button>
          <button className="ov-view-btn" onClick={onViewToggle} title="Switch view (F8)">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H3v5" />
              <path d="M12 3h5v5" />
              <path d="M8 17H3v-5" />
              <path d="M12 17h5v-5" />
            </svg>
          </button>
          <button
            className={`ov-stop-btn${!autoOn ? ' start' : ''}`}
            onClick={onStop}
            title={autoOn ? 'Stop Listening' : 'Start Listening'}
          >
            <MicStopIcon />
            {autoOn ? 'Stop Listening' : 'Start Listening'}
          </button>
        </div>
      </div>

      {/* 当前问题区(固定顶部, 视觉权重低于答案) */}
      <div className="ov-question">
        <div className="ov-section-label">CURRENT QUESTION</div>
        {showQ || partial ? (
          <QuestionBlock q={currentQ} partial={partial} />
        ) : (
          <div className="ov-q-content">
            <div className="ov-q-wait">Listening for the next question…</div>
            <div className="ov-q-sub">Nod will detect the question and prepare an answer automatically.</div>
          </div>
        )}
      </div>

      {/* 回答区(滚动, 标题栏固定) */}
      <div className="ov-answer-wrap">
        <div className="ov-section-label ov-answer-label">
          NOD ANSWER
          <button
            className={`ov-copy-btn${copied ? ' done' : ''}`}
            onClick={handleCopy}
            disabled={!answer}
          >
            {copied ? '✓ Copied' : 'Copy answer'}
          </button>
        </div>
        <div className="ov-answer" ref={scrollRef} onScroll={handleScroll}>
          {answer ? (
            <AnswerContent answer={answer} base="ov" />
          ) : (
            <div className="ov-answer-empty">
              {generating
                ? 'Generating answer…'
                : 'Your answer will appear here.'}
            </div>
          )}
        </div>
        {scrollPinned && (
          <button className="ov-jump-btn" onClick={jumpLatest}>
            Jump to latest
          </button>
        )}
      </div>

      {/* 底部状态条(固定底部) */}
      <div className="ov-statusbar">
        <span className="ov-status-left">
          <span className="ov-dot" />
          <span className="ov-status-text">{statusText}</span>
        </span>
        <span className="ov-status-right">
          {(listening || transcribing) && <WaveBars />}
          <button className="ov-icon-btn" onClick={onExpand} title="Expand to workspace">
            <ExpandIcon />
          </button>
        </span>
      </div>

      {/* 底部悬浮输入栏 */}
      <div
        className={`ov-inputbar${inputVisible ? ' show' : ''}`}
        onMouseEnter={() => window.clearTimeout(hideTimer.current)}
        onMouseLeave={scheduleHide}
      >
        {newQHint && <div className="ov-hint">New question detected</div>}
        <div className="ov-input-row">
          <input
            ref={inputRef}
            className="ov-input"
            placeholder="Ask a follow-up question…"
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onFocus={() => {
              focusedRef.current = true
              window.clearTimeout(hideTimer.current)
            }}
            onBlur={() => {
              focusedRef.current = false
              scheduleHide()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitAsk()
              else if (e.key === 'Escape') setInputVisible(false)
              e.stopPropagation()
            }}
          />
          <button className="ov-ask-btn" onClick={submitAsk} disabled={!draft.trim()}>
            Ask
          </button>
        </div>
        <div className="ov-input-hint">Press Enter to send · Esc to hide · F8 for Workspace</div>
      </div>
    </div>
  )
}
