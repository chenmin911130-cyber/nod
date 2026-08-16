import type { AudioSource, Lang, ModelDef } from '../types'
import OpacityBar from './OpacityBar'

interface Props {
  models: ModelDef[]
  llm: { provider: string; model: string }
  stt: string
  lang: Lang
  source: AudioSource
  opacity: number
  pinned: boolean
  micMuted: boolean
  stealth: boolean
  onModel: (provider: string, model: string) => void
  onStt: (model: string) => void
  onLang: (lang: Lang) => void
  onSource: (s: AudioSource) => void
  onOpacity: (n: number) => void
  onPinned: (b: boolean) => void
  onMicMuted: (muted: boolean) => void
  onStealth: (on: boolean) => void
  onFullScreen: () => void
}

const STT_MODELS: Array<{ label: string; value: string }> = [
  { label: 'AssemblyAI · cloud (fast)', value: 'assemblyai' },
  { label: 'small · fast', value: 'small' },
  { label: 'medium', value: 'medium' },
  { label: 'turbo · accents', value: 'large-v3-turbo' },
  { label: 'large-v3 · strongest', value: 'large-v3' },
]

const LANGS: Array<{ label: string; value: Lang }> = [
  { label: 'Auto', value: 'auto' },
  { label: 'Chinese', value: 'zh' },
  { label: 'English', value: 'en' },
]

function NodLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M26 88 V32 A13 13 0 0 1 52 32 L78 58" stroke="#f5f8ff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M58 38 Q66 29 81 34 V60" stroke="#f5f8ff" strokeWidth="9" strokeLinecap="round" />
      <circle cx="81" cy="70" r="4.5" fill="#00d2ff" />
    </svg>
  )
}

function MicOnIcon() {
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

function MicOffIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8.5" strokeOpacity="0.35" />
      <rect x="8" y="3" width="4" height="10" rx="2" />
      <path d="M5 11a5 5 0 0 0 10 0" />
      <line x1="10" y1="16" x2="10" y2="18" />
      <line x1="7" y1="18" x2="13" y2="18" />
      <line x1="4" y1="3" x2="16" y2="17" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.35" />
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

/* 监听来源图标: 扬声器 + 麦克风组合, 圆环风格与 Pin/Stealth 统一 */
function SourceIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8.5" strokeOpacity="0.35" />
      {/* 扬声器 */}
      <path d="M4.8 8.2v3.6h1.8L9.3 14V6L6.6 8.2H4.8z" />
      <path d="M11.4 7.2a3.8 3.8 0 0 1 0 5.6" />
      {/* 麦克风 */}
      <path d="M14.6 5.4v7.2" />
      <path d="M12.8 7.2a2.2 2.2 0 0 1 0 3.6" />
    </svg>
  )
}

export default function TitleBar(props: Props) {
  const { models, llm, stt, lang, source, opacity, pinned, micMuted, stealth } = props
  const curIdx = models.findIndex((m) => m.provider === llm.provider && m.model === llm.model)

  return (
    <div className="titlebar">
      <div className="brand no-drag">
        <NodLogo />
        <span className="brand-white">Nod</span>
      </div>

      <select
        className="combo no-drag"
        value={curIdx >= 0 ? String(curIdx) : '0'}
        onChange={(e) => {
          const m = models[Number(e.target.value)]
          if (m) props.onModel(m.provider, m.model)
        }}
      >
        {models.map((m, i) => (
          <option key={`${m.provider}/${m.model}`} value={String(i)}>
            {m.label}
          </option>
        ))}
      </select>

      <select
        className="combo no-drag"
        value={stt}
        onChange={(e) => props.onStt(e.target.value)}
      >
        {STT_MODELS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <select
        className="combo no-drag"
        value={lang}
        title="Answer + speech language: English → answers in English only; Chinese → answers in Chinese only; Auto → follows the question"
        onChange={(e) => props.onLang(e.target.value as Lang)}
      >
        {LANGS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>

      <div className="titlebar-spacer" />

      <OpacityBar value={opacity} onChange={props.onOpacity} />

      <button
        className={`src-btn no-drag${source === 'both' ? ' on' : ''}`}
        onClick={() => props.onSource(source === 'both' ? 'system' : 'both')}
        title={
          source === 'both'
            ? 'Listening: System + Mic — click to hear system audio only'
            : 'Listening: System audio only — click to also hear your microphone (System + Mic)'
        }
      >
        <SourceIcon />
      </button>

      <button
        className={`mic-btn no-drag${micMuted ? ' muted' : ''}`}
        onClick={() => props.onMicMuted(!micMuted)}
        title={micMuted ? 'Unmute' : 'Mute microphone'}
      >
        {micMuted ? <MicOffIcon /> : <MicOnIcon />}
        {micMuted ? 'Muted' : 'Mute'}
      </button>

      <button
        className={`pin-btn no-drag${pinned ? ' on' : ''}`}
        onClick={() => props.onPinned(!pinned)}
        title={pinned ? 'Pinned on top' : 'Pin on top'}
      >
        <PinIcon />
      </button>

      <button
        className={`stealth-btn no-drag${stealth ? ' on' : ''}`}
        onClick={() => props.onStealth(!stealth)}
        title={stealth ? 'Stealth on — hidden from screen capture (F9)' : 'Stealth — hide from screen capture (F9)'}
      >
        <EyeOffIcon />
        {stealth ? 'Hidden' : 'Stealth'}
      </button>

      <button className="view-btn no-drag" onClick={() => props.onFullScreen()} title="Switch view (F8)">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H3v5" />
          <path d="M12 3h5v5" />
          <path d="M8 17H3v-5" />
          <path d="M12 17h5v-5" />
        </svg>
      </button>

      <button className="win-btn no-drag" onClick={() => window.api.minimize()}>
        ─
      </button>
      <button className="win-btn close no-drag" onClick={() => window.api.close()}>
        ✕
      </button>
    </div>
  )
}
