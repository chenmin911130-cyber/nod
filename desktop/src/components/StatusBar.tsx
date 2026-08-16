import type { RunState } from '../types'
import Waveform from './Waveform'

interface Props {
  run: RunState
  status: string
}

const DOT_COLOR: Record<RunState, string> = {
  idle: '#34d399',
  record: '#ffc107',
  listen: '#22d3ee',
  think: '#a78bfa',
}

const STATE_TEXT: Record<RunState, string> = {
  idle: 'Ready',
  record: 'Recording',
  listen: 'Listening',
  think: 'Thinking',
}

export default function StatusBar({ run, status }: Props) {
  return (
    <div className="statusbar">
      <div className="audio-row">
        <span className="status-dot" style={{ background: DOT_COLOR[run] }} />
        <span className="audio-text">{STATE_TEXT[run]}</span>
        {(run === 'record' || run === 'listen') && <Waveform active />}
      </div>
      <div className="status-line">{status}</div>
    </div>
  )
}
