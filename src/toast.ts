type Listener = (message: string | null) => void

let message: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener(message)
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getToast(): string | null {
  return message
}

export function toast(msg: string): void {
  message = msg
  emit()
  clearTimeout(timer)
  timer = setTimeout(() => {
    message = null
    emit()
  }, 2600)
}
