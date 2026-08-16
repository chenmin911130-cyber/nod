import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/* ============================================================
   口试速记式答案渲染（AutoOverlay + AnswerPane 共用）
   结构: 首段 → 正文 → KEY POINTS(≤3) → VIVA-READY ANSWER(卡片)
         → WHY IT MATTERS(可选) → 术语 cyan 高亮(每段 ≤3)
   ============================================================ */

export interface ParsedAnswer {
  lead: string
  body: string
  keyPoints: string[]
  viva: string | null
  why: string | null
}

const TECH_TERMS = [
  'Object-Oriented Programming', 'OOP', 'API', 'SQL', 'TypeScript', 'JavaScript',
  'Python', 'Java', 'C#', 'ASP.NET', 'encapsulation', 'polymorphism', 'inheritance',
  'abstraction', 'database', 'algorithm', 'data structure', 'frontend', 'backend',
  'React', 'Kubernetes', 'Docker', 'REST', 'HTTP', 'JSON', 'Git', 'machine learning',
  'artificial intelligence', 'software engineering', 'microservices', 'agile', 'debugging',
]

// 前后非单词边界匹配（兼容 C#、多词术语）
const TERM_RE = new RegExp(
  `(?<![A-Za-z0-9])(?:${TECH_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![A-Za-z0-9])`,
  'gi'
)

export function parseAnswer(text: string): ParsedAnswer {
  const lines = (text || '').split('\n')
  const keyPoints: string[] = []
  const bodyLines: string[] = []
  let viva: string | null = null
  let why: string | null = null
  let inViva = false
  let inWhy = false

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      inViva = false
      inWhy = false
      bodyLines.push('')
      continue
    }
    const vm = line.match(/^(viva[- ]?ready(?:[-\s]+answer)?|viva|可直接复述|一句话总结)\s*[:：]?\s*/i)
    if (vm) {
      inViva = true
      inWhy = false
      const rest = line.slice(vm[0].length).trim()
      if (rest) viva = stripQuotes(rest)
      continue
    }
    if (inViva) {
      viva = (viva ? viva + ' ' : '') + stripQuotes(line)
      continue
    }
    const wm = line.match(/^(why it matters|why this matters|为什么重要|为什么这很重要)\s*[:：]?\s*/i)
    if (wm) {
      inWhy = true
      inViva = false
      const rest = line.slice(wm[0].length).trim()
      if (rest) why = rest
      continue
    }
    if (inWhy) {
      why = (why ? why + ' ' : '') + line
      continue
    }
    const lm = line.match(/^[-*•]\s+(.*)/)
    if (lm) {
      keyPoints.push(lm[1].trim())
      continue
    }
    bodyLines.push(line)
  }

  if (!viva) {
    const qm = text.match(/["“]([^"”]{8,})["”]/)
    if (qm) viva = qm[1]
  }

  // 首段 = 第一个非空段落（直接答案，不重复问题）
  const bodyText = bodyLines.join('\n').trim()
  const paras = bodyText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const lead = paras[0] ?? ''
  const restBody = paras.slice(1).join('\n\n')

  return {
    lead,
    body: restBody,
    keyPoints: keyPoints.slice(0, 3),
    viva,
    why,
  }
}

function stripQuotes(s: string): string {
  return s.replace(/^[\s"“]+|[\s"”]+$/g, '')
}

/* ---------- 行内渲染: **bold** / `code` / 技术术语(≤3/段) ---------- */

function renderInline(text: string, keyBase: string, maxTerms = 3): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  let termCount = 0
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  // 术语单独扫描（不拆开 bold/code 内部）
  const termMatches: Array<{ index: number; len: number; text: string }> = []
  for (const m of text.matchAll(TERM_RE)) {
    if (m.index === undefined) continue
    termMatches.push({ index: m.index, len: m[0].length, text: m[0] })
  }
  const tokens: Array<{ start: number; end: number; kind: 'bold' | 'code' | 'term' | 'text'; text: string }> = []
  for (const m of text.matchAll(re)) {
    if (m.index === undefined) continue
    tokens.push({ start: m.index, end: m.index + m[0].length, kind: m[0].startsWith('**') ? 'bold' : 'code', text: m[0] })
  }
  for (const tm of termMatches) {
    tokens.push({ start: tm.index, end: tm.index + tm.len, kind: 'term', text: tm.text })
  }
  tokens.sort((a, b) => a.start - b.start)

  let cursor = 0
  for (const tok of tokens) {
    if (tok.start < cursor) continue // 重叠(术语在 bold 内) → 跳过
    if (tok.start > last) out.push(text.slice(last, tok.start))
    if (tok.kind === 'bold') out.push(<strong key={`${keyBase}b${i}`}>{tok.text.slice(2, -2)}</strong>)
    else if (tok.kind === 'code') out.push(<code key={`${keyBase}c${i}`}>{tok.text.slice(1, -1)}</code>)
    else if (tok.kind === 'term' && termCount < maxTerms) {
      termCount++
      out.push(<mark key={`${keyBase}t${i}`} className="ans-term">{tok.text}</mark>)
    } else if (tok.kind === 'term') {
      out.push(<span key={`${keyBase}s${i}`}>{tok.text}</span>)
    }
    last = tok.end
    cursor = tok.end
    i++
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function renderBody(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  text.split('\n').forEach((raw, idx) => {
    const line = raw.trimEnd()
    if (!line.trim()) {
      out.push(<div key={`${keyBase}g${idx}`} className="ans-gap" />)
      return
    }
    const weak = /^(for example|example:|note:|note\b|e\.g\.|i\.e\.|tip:|in short|in summary|in practice)/i.test(
      line.trim()
    )
    out.push(
      <p key={`${keyBase}p${idx}`} className={weak ? 'ans-weak' : ''}>
        {renderInline(line, `${keyBase}p${idx}`)}
      </p>
    )
  })
  return out
}

/* ---------- 答案内容 ---------- */

export function AnswerContent({ answer, base }: { answer: string; base?: string }) {
  const parsed = useMemo(() => parseAnswer(answer), [answer])
  const b = base ?? 'a'
  return (
    <article className="answer-content">
      {parsed.lead && (
        <p className="ans-lead">{renderInline(parsed.lead, `${b}l`)}</p>
      )}
      {parsed.body && <div className="ans-body">{renderBody(parsed.body, `${b}b`)}</div>}
      {parsed.keyPoints.length > 0 && (
        <section className="ans-module">
          <h4 className="ans-mod-title">KEY POINTS</h4>
          <ul className="ans-list">
            {parsed.keyPoints.map((kp, i) => (
              <li key={`${b}k${i}`}>{renderInline(kp, `${b}k${i}`)}</li>
            ))}
          </ul>
        </section>
      )}
      {parsed.viva && (
        <section className="ans-viva">
          <h4 className="ans-viva-title">VIVA-READY ANSWER</h4>
          <div className="ans-viva-text">{renderInline(parsed.viva, `${b}v`, 2)}</div>
        </section>
      )}
      {parsed.why && (
        <section className="ans-module">
          <h4 className="ans-mod-title">WHY IT MATTERS</h4>
          <p className="ans-why">{renderInline(parsed.why, `${b}w`)}</p>
        </section>
      )}
    </article>
  )
}

/* ---------- 当前问题块（4 行省略 + 展开） ---------- */

export function QuestionBlock({ q, partial }: { q: string; partial?: string }) {
  const [expanded, setExpanded] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)

  useEffect(() => {
    const el = textRef.current
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 2)
  }, [q, partial])

  const text = partial ? `Listening… ${partial}…` : q

  return (
    <div className="qblock">
      {overflow && !expanded && (
        <button className="qblock-more" onClick={() => setExpanded(true)}>
          Expand
        </button>
      )}
      <div
        ref={textRef}
        className={`qblock-text${expanded ? ' open' : ''}`}
      >
        {text}
      </div>
    </div>
  )
}
