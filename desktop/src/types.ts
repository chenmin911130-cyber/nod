export type RunState = 'idle' | 'record' | 'listen' | 'think'
export type Turn = { id: string; q: string; a: string }
export type Lang = 'auto' | 'zh' | 'en'
export type ViewMode = 'workspace' | 'focus' | 'fullscreen'
export type AudioSource = 'system' | 'both'

export interface ModelDef {
  label: string
  provider: string
  model: string
}

export interface AppConfig {
  llm?: { provider?: string; model?: string; max_tokens?: number; temperature?: number }
  stt?: { model?: string; language?: string | null }
  audio?: { source?: string }
  ui?: { opacity?: number }
  models?: ModelDef[]
}

export interface AppState {
  run: RunState
  status: string
  currentQ: string
  currentQId: string
  turns: Turn[]
  partial: string
  busy: boolean
  opacity: number
  pinned: boolean
  micMuted: boolean
  stealth: boolean
  view: ViewMode
  draft: string
  llm: { provider: string; model: string }
  stt: string
  lang: Lang
  source: AudioSource
  autoOn: boolean
  models: ModelDef[]
  keys: { hasLlm: boolean; hasStt: boolean }
}

// 引擎 → 前端
export type EngineEvent =
  | { type: 'ready' }
  | { type: 'pong' }
  | { type: 'keys_status'; has_llm: boolean; has_stt: boolean }
  | { type: 'state'; state: string }
  | { type: 'status'; text: string }
  | { type: 'partial'; text: string }
  | { type: 'question'; id: string; text: string }
  | { type: 'chunk'; id: string; text: string }
  | { type: 'done'; id: string; stt: number; llm: number; ok: boolean }
  | { type: 'error'; text: string }

// 前端 → 引擎
export type EngineMsg =
  | { type: 'manual' }
  | { type: 'toggle_listen' }
  | { type: 'ask'; text: string }
  | { type: 'set_llm'; provider: string; model: string }
  | { type: 'set_stt'; model: string }
  | { type: 'set_lang'; language: string | null }
  | { type: 'set_source'; source: string }
  | { type: 'set_mic_muted'; muted: boolean }
  | { type: 'save_keys'; openrouter_key: string; assemblyai_key: string }
  | { type: 'clear' }
  | { type: 'ping' }

export interface Api {
  send(msg: EngineMsg): void
  onEvent(cb: (e: EngineEvent) => void): () => void
  onShortcut(cb: (k: 'f2' | 'f3' | 'f4' | 'f8' | 'f9') => void): () => void
  setOpacity(n: number): void
  setPinned(b: boolean): void
  setStealth(on: boolean): void
  setView(mode: ViewMode): void
  copy(text: string): void
  close(): void
  minimize(): void
  getConfig(): Promise<AppConfig>
  openExternal(url: string): void
}

declare global {
  interface Window {
    api: Api
  }
}
