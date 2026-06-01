import { useId } from 'react'

const COLORS = [
  { offset: '0%', stopColor: '#2563eb' },
  { offset: '50%', stopColor: '#06b6d4' },
  { offset: '100%', stopColor: '#10b981' },
]

export default function Logo({ variant = 'compact', size = 28, animated = false, className = '' }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gid = `mk-grad-${id}`
  const isFull = variant === 'full'

  return (
    <svg
      width={size}
      height={Math.round(size * 0.6)}
      viewBox={isFull ? '0 0 120 36' : '0 0 60 36'}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          {COLORS.map((c, i) => (
            <stop key={i} offset={c.offset} stopColor={c.stopColor} />
          ))}
        </linearGradient>
      </defs>

      {isFull ? (
        <>
          <text
            x="0" y="28" fontSize="20" fontWeight="700"
            fontFamily="'Courier New', Consolas, 'SF Mono', monospace"
            fill={`url(#${gid})`} opacity="0.45"
          >&lt;</text>
          <text
            x="17" y="28" fontSize="28" fontWeight="900"
            fontFamily="'Courier New', Consolas, 'SF Mono', monospace"
            fill={`url(#${gid})`}
          >MK</text>
          <text
            x="78" y="28" fontSize="20" fontWeight="700"
            fontFamily="'Courier New', Consolas, 'SF Mono', monospace"
            fill={`url(#${gid})`} opacity="0.45"
          >/&gt;</text>
          {animated && (
            <circle cx="118" cy="14" r="2" fill={`url(#${gid})`}>
              <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
        </>
      ) : (
        <text
          x="2" y="28" fontSize="28" fontWeight="900"
          fontFamily="'Courier New', Consolas, 'SF Mono', monospace"
          fill={`url(#${gid})`}
        >MK</text>
      )}
    </svg>
  )
}
