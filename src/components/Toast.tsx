import { useSyncExternalStore } from 'react'
import { getToast, subscribeToast } from '../toast'

export function Toast() {
  const message = useSyncExternalStore(subscribeToast, getToast, getToast)
  if (!message) return null
  return (
    <div id="toast" role="status">
      {message}
    </div>
  )
}
