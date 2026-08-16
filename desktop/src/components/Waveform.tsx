interface Props {
  active: boolean
}

const BARS = [10, 18, 8, 22, 14, 26, 12, 20, 16, 24, 9, 19, 13, 23, 11, 21, 15, 17, 22, 12, 18, 10]

export default function Waveform({ active }: Props) {
  return (
    <div className={`waveform${active ? ' active' : ''}`}>
      {BARS.map((h, i) => (
        <span
          key={i}
          className="wave-bar"
          style={{ height: `${h}px`, animationDelay: `${(i % 10) * 60}ms` }}
        />
      ))}
    </div>
  )
}
