import { useId } from 'react'
export function IceBolt({ large = false }: { large?: boolean }) {
  const id = useId().replaceAll(':', '')
  return (
    <svg
      className={large ? 'ice-bolt large' : 'ice-bolt'}
      viewBox="0 0 180 220"
      fill="none"
      aria-label="Bifrost, ice lightning bolt"
      role="img"
    >
      <defs>
        <linearGradient
          id={`${id}ice`}
          x1="39"
          y1="10"
          x2="136"
          y2="206"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ECFDFF" />
          <stop offset=".33" stopColor="#9DE7FF" />
          <stop offset=".65" stopColor="#36B9EF" />
          <stop offset="1" stopColor="#C0F5FF" />
        </linearGradient>
        <linearGradient id={`${id}edge`} x1="40" y1="10" x2="140" y2="218">
          <stop stopColor="white" />
          <stop offset=".55" stopColor="#3CB1E7" />
          <stop offset="1" stopColor="#C7F2FF" />
        </linearGradient>
        <filter id={`${id}shadow`} x="-50%" y="-30%" width="200%" height="180%">
          <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#39B8E8" floodOpacity=".22" />
        </filter>
      </defs>
      <g filter={`url(#${id}shadow)`}>
        <path
          d="M101 9 32 119h48l-9 92 78-126h-52l24-76h-20Z"
          fill={`url(#${id}ice)`}
          stroke={`url(#${id}edge)`}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="m101 9-47 99 43-23 24-76h-20Z" fill="white" fillOpacity=".5" />
        <path d="m32 119 65-34-17 34H32Z" fill="#C5F6FF" fillOpacity=".8" />
        <path d="m80 119 17-34 52 0-78 126 37-99-28 7Z" fill="#409DDC" fillOpacity=".24" />
        <path d="m97 85 11 27 41-27H97Z" fill="white" fillOpacity=".65" />
        <path d="m101 9-4 76 11 27-37 99" stroke="white" strokeOpacity=".7" />
        <path
          d="m62 68 21 12-8 19m36 32-14 8 2 19"
          stroke="white"
          strokeOpacity=".48"
          strokeWidth="1.5"
        />
      </g>
      {large && (
        <g fill="#80CFEF">
          <path d="m30 42 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
          <path d="m148 147 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
          <circle cx="146" cy="53" r="2" />
          <circle cx="28" cy="155" r="2" />
        </g>
      )}
    </svg>
  )
}
