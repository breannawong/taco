const DISMISS_KEY = 'taco.finishPromptDismissed'

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x) => typeof x === 'string'))
    }
  } catch {
    // ignore
  }
  return new Set()
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore
  }
}

export function isFinishPromptDismissed(listId: string): boolean {
  return loadDismissed().has(listId)
}

export function dismissFinishPrompt(listId: string): void {
  const next = loadDismissed()
  next.add(listId)
  saveDismissed(next)
}

export function clearFinishPromptDismiss(listId: string): void {
  const next = loadDismissed()
  next.delete(listId)
  saveDismissed(next)
}
