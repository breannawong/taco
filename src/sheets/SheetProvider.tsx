import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type SheetContextValue = {
  openSheet: (content: ReactNode) => void
  closeSheet: () => void
}

const SheetContext = createContext<SheetContextValue | null>(null)

export function SheetProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null)

  const closeSheet = useCallback(() => setContent(null), [])
  const openSheet = useCallback((node: ReactNode) => setContent(node), [])

  useEffect(() => {
    if (!content) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [content, closeSheet])

  const value = useMemo(
    () => ({ openSheet, closeSheet }),
    [openSheet, closeSheet],
  )

  return (
    <SheetContext.Provider value={value}>
      {children}
      {content ? (
        <div id="sheetWrap">
          <div className="scrim" onClick={closeSheet} aria-hidden="true" />
          <div className="sheet" role="dialog" aria-modal="true">
            <div className="grab" />
            {content}
          </div>
        </div>
      ) : null}
    </SheetContext.Provider>
  )
}

export function useSheet(): SheetContextValue {
  const ctx = useContext(SheetContext)
  if (!ctx) throw new Error('useSheet must be used within SheetProvider')
  return ctx
}
