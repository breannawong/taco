import { useEffect, useState, type ReactNode } from 'react'

type Props = {
  className?: string
  confirmLabel: string
  onConfirm: () => void
  children: ReactNode
}

/** Two-tap destructive button — never window.confirm. */
export function ConfirmButton({
  className = '',
  confirmLabel,
  onConfirm,
  children,
}: Props) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 3500)
    return () => window.clearTimeout(t)
  }, [armed])

  return (
    <button
      type="button"
      className={`${className} ${armed ? 'armed' : ''}`.trim()}
      onClick={() => {
        if (!armed) {
          setArmed(true)
          return
        }
        onConfirm()
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}
