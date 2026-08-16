import { useEffect, useRef, useState } from 'react'
import type { Turn } from '../types'
import { AnswerContent, QuestionBlock } from './AnswerContent'

interface Props {
  currentQ: string
  partial: string
  turns: Turn[]
  busy: boolean
  onAsk: (text: string) => void
}

export default function AnswerPane({ currentQ, partial, turns, busy, onAsk }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pinned) return
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [turns, pinned])

  const submit = () => {
    const t = input.trim()
    if (!t || busy) return
    onAsk(t)
    setInput('')
  }

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    setPinned(!nearBottom)
  }

  const jumpLatest = () => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
    setPinned(false)
  }

  const isEmpty = turns.length === 0 && !partial && !busy
  const answer = turns.length > 0 ? turns[turns.length - 1].a : ''
  const showQ = currentQ && currentQ !== 'Waiting for the next question…'

  return (
    <div className="main">
      <div className="kicker">CURRENT QUESTION</div>
      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-orbit">
            <svg width="74" height="74" viewBox="0 0 100 100" fill="none" aria-hidden="true">
              <path d="M26 88 V32 A13 13 0 0 1 52 32 L78 58" stroke="rgba(245,248,255,0.92)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M58 38 Q66 29 81 34 V60" stroke="rgba(245,248,255,0.92)" strokeWidth="9" strokeLinecap="round" />
              <circle cx="81" cy="70" r="4.5" fill="#00d2ff" />
            </svg>
          </div>
          <div className="empty-title">Waiting for the next question</div>
          <div className="empty-sub">Click Start Listening, or type a question directly</div>
          <div className="empty-shortcuts">
            <span>
              <b>F2</b>Record
            </span>
            <span className="sep">·</span>
            <span>
              <b>F3</b>Auto Listen
            </span>
            <span className="sep">·</span>
            <span>
              <b>F4</b>Clear
            </span>
          </div>
        </div>
      ) : (
        <div className="ap-question">
          <QuestionBlock q={showQ ? currentQ : (partial ? 'Listening…' : '')} partial={partial} />
        </div>
      )}
      <div className="divider" />

      <div className="kicker">NOD ANSWER</div>
      <div className="answer-scroll" ref={scrollRef} onScroll={handleScroll}>
        {answer ? (
          <AnswerContent answer={answer} base="ap" />
        ) : (
          <div className="answer-empty">
            {busy ? 'Generating answer…' : 'Your answer will appear here.'}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {pinned && (
        <button className="ap-jump-btn" onClick={jumpLatest}>
          Jump to latest
        </button>
      )}

      <div className="prompt-row">
        <input
          className="prompt-input"
          placeholder="Type a question, then press Enter"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <button className="gen-btn" onClick={submit} disabled={busy}>
          Answer
        </button>
      </div>
    </div>
  )
}
