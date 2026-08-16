import { useEffect, useRef } from 'react'

interface Props {
  value: number
  onChange: (n: number) => void
}

const clamp = (n: number) => Math.min(100, Math.max(10, Math.round(n)))

export default function OpacityBar({ value, onChange }: Props) {
  const repeatRef = useRef<number | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  const stopRepeat = () => {
    if (repeatRef.current !== null) {
      clearInterval(repeatRef.current)
      repeatRef.current = null
    }
  }

  const startRepeat = (delta: number) => {
    stopRepeat()
    const apply = () => onChange(clamp(valueRef.current + delta))
    apply()
    repeatRef.current = window.setInterval(apply, 70)
  }

  useEffect(() => stopRepeat, [])

  return (
    <div className="opacity-bar no-drag">
      <span className="op-label">Opacity</span>
      <button
        className="op-btn"
        onPointerDown={() => startRepeat(-5)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
      >
        −
      </button>
      <span className="op-readout">{value}%</span>
      <button
        className="op-btn"
        onPointerDown={() => startRepeat(5)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
      >
        +
      </button>
      <input
        type="range"
        className="op-slider"
        min={10}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
