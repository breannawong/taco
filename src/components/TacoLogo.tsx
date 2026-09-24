type Props = {
  className?: string
}

export function TacoLogo({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M4 17a16 16 0 0 0 32 0z" fill="var(--accent)" />
      <path
        d="M4 17c2-4 4-4 5.3 0s3.4 4 5.3 0 3.4-4 5.4 0 3.4 4 5.3 0 3.4-4 5.4 0 3.3 4 5.3 0"
        fill="none"
        stroke="var(--pine)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="13" cy="13.5" r="2.2" fill="var(--tomato)" />
      <circle cx="25" cy="13" r="2.2" fill="var(--tomato)" />
      <path
        d="M8 24a12 12 0 0 0 24 0"
        fill="none"
        stroke="var(--accent-ink)"
        strokeOpacity=".18"
        strokeWidth="1.5"
      />
    </svg>
  )
}
