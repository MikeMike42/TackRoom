export function Wordmark({ large }: { large?: boolean }) {
  return (
    <div className={`wordmark ${large ? 'large' : ''}`}>
      <span className="wordmark-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width={large ? 40 : 28} height={large ? 40 : 28}>
          <rect width="32" height="32" rx="8" fill="var(--accent)" />
          <path d="M9 23V11.5a3.5 3.5 0 0 1 7 0V23M9 17h7M19 23V9h2.5a4 4 0 0 1 0 8H19" fill="none" stroke="var(--on-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="wordmark-text">Tack Room</span>
    </div>
  )
}
