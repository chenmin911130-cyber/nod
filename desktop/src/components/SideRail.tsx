import type { RunState } from '../types'

interface Props {
  run: RunState
  autoOn: boolean
  onListening: () => void
  onAuto: () => void
  onCopy: () => void
  onClear: () => void
}

function MicIcon() {
  return (
    <svg className="rail-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8.5" strokeOpacity="0.35" />
      <rect x="8" y="3" width="4" height="10" rx="2" />
      <path d="M5 11a5 5 0 0 0 10 0" />
      <line x1="10" y1="16" x2="10" y2="18" />
      <line x1="7" y1="18" x2="13" y2="18" />
    </svg>
  )
}

function EarIcon() {
  return (
    <svg className="rail-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8.5" strokeOpacity="0.35" />
      <path d="M6 7.5c2.5-1 6-.3 5.5 3.5-.3 2.3-1.8 3-1.8 4.5a1.4 1.4 0 0 1-1.4 1.4" />
      <path d="M9 8c1.3.5 1.7 2 1 3.2" />
      <path d="M13 7.5a5 5 0 0 1 1.6 3.8" />
      <path d="M16 9a2.5 2.5 0 0 1 1 2" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg className="rail-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8.5" strokeOpacity="0.35" />
      <rect x="6" y="6" width="11" height="13" rx="2" />
      <path d="M4 10V4.5A1.5 1.5 0 0 1 5.5 3H12" />
      <line x1="9" y1="10" x2="14" y2="10" />
      <line x1="9" y1="13" x2="14" y2="13" />
      <line x1="9" y1="16" x2="12" y2="16" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="rail-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8.5" strokeOpacity="0.35" />
      <path d="M4 6h12" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6" />
      <rect x="6" y="6" width="8" height="11" rx="1.5" />
      <line x1="9" y1="9.5" x2="9" y2="14" />
      <line x1="11" y1="9.5" x2="11" y2="14" />
    </svg>
  )
}

export default function SideRail({ run, autoOn, onListening, onAuto, onCopy, onClear }: Props) {
  const listeningActive = run === 'listen' || run === 'record'

  return (
    <div className="side-rail">
      <button
        className={`start-btn${listeningActive ? ' active' : ''}`}
        onClick={onListening}
        disabled={run === 'think'}
        title="Start / stop recording (F2)"
      >
        <MicIcon />
        <span className="start-label">{listeningActive ? 'Stop Listening' : 'Start Listening'}</span>
      </button>

      <div className="auto-row">
        <EarIcon />
        <span className="auto-label">Auto Listen</span>
        <button
          className={`switch${autoOn ? ' on' : ''}`}
          onClick={onAuto}
          role="switch"
          aria-checked={autoOn}
          title="Continuous listening (F3)"
        />
      </div>

      <div className="rail-divider" />

      <button className="rail-btn" onClick={onCopy} title="Copy latest answer (C)">
        <CopyIcon />
        <span className="rail-label">Copy Answer</span>
        <span className="rail-badge">C</span>
      </button>

      <button className="rail-btn" onClick={onClear} title="Clear history (F4)">
        <TrashIcon />
        <span className="rail-label">Clear</span>
        <span className="rail-badge">F4</span>
      </button>
    </div>
  )
}
