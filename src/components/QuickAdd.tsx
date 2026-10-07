import { IconCheck } from './Icons'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  addItem,
  memoryForText,
  peopleForList,
  setLastWho,
  suggestItemMemories,
  whoForListMemory,
  type ItemMemory,
  type Who,
} from '../store'
import { useStore } from '../store/useStore'
import { useSheet } from '../sheets/SheetProvider'
import {
  QuickAddSectionSheet,
  defaultQuickAddWho,
} from '../sheets/QuickAddSectionSheet'
import { toast } from '../toast'

type Props = {
  listId: string
  /**
   * When set, every add goes into this section (section-header +).
   * Suggestions still come from household memory; picking one remembered
   * under a different section adds here and becomes the new memory.
   */
  sectionId?: string
  autoFocus?: boolean
}

/**
 * Quick-add box. Suggests item names from household history (templates + trips).
 * Top of list: remembers section from last use. Section +: locked to that section.
 */
export function QuickAdd({ listId, sectionId, autoFocus = false }: Props) {
  const data = useStore()
  const { openSheet } = useSheet()
  const inputRef = useRef<HTMLInputElement>(null)
  const listIdAttr = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [busy, setBusy] = useState(false)

  const list = data.lists.find((l) => l.id === listId)
  const travelers = peopleForList(listId, data)
  const lockedSection = sectionId
    ? data.sections.find((s) => s.id === sectionId && s.listId === listId)
    : undefined

  const sections = useMemo(
    () =>
      data.sections
        .filter((s) => s.listId === listId)
        .sort((a, b) => a.position - b.position),
    [data.sections, listId],
  )

  const suggestions = useMemo(
    () => suggestItemMemories(text, data),
    [text, data],
  )

  const trimmed = text.trim()
  const exactMemory = trimmed ? memoryForText(trimmed, data) : null
  const showNewRow =
    trimmed.length > 0 &&
    !suggestions.some((s) => s.text.toLowerCase() === trimmed.toLowerCase())

  const rows: Array<
    | { kind: 'memory'; memory: ItemMemory }
    | { kind: 'new'; text: string }
  > = [
    ...suggestions.map((memory) => ({ kind: 'memory' as const, memory })),
    ...(showNewRow ? [{ kind: 'new' as const, text: trimmed }] : []),
  ]

  useEffect(() => {
    setHighlight(0)
  }, [text])

  useEffect(() => {
    if (!autoFocus) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [autoFocus])

  const findSectionId = (sectionName: string): string | undefined => {
    const key = sectionName.trim().toLowerCase()
    return sections.find((s) => s.name.trim().toLowerCase() === key)?.id
  }

  const clear = () => {
    setText('')
    setOpen(false)
    setHighlight(0)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const saveItem = async (name: string, who: Who, targetSectionId: string) => {
    if (!list) return
    setBusy(true)
    if (list.kind === 'trip' && travelers.length > 1) setLastWho(who)
    const added = await addItem(listId, targetSectionId, name, who)
    setBusy(false)
    if (!added) return
    toast(`Added ${added.text}`)
    clear()
  }

  const addWithMemory = async (memory: ItemMemory) => {
    if (busy || !list) return
    const who = whoForListMemory(
      memory.who,
      travelers.map((p) => p.id),
    )

    if (lockedSection) {
      await saveItem(memory.text, who, lockedSection.id)
      return
    }

    const destId = findSectionId(memory.sectionName)
    if (!destId) {
      openSheet(
        <QuickAddSectionSheet
          listId={listId}
          text={memory.text}
          who={who}
          preferredSectionName={memory.sectionName}
          onAdded={clear}
        />,
      )
      return
    }
    await saveItem(memory.text, who, destId)
  }

  const addBrandNew = (name: string) => {
    if (!list) return
    if (lockedSection) {
      const who: Who = defaultQuickAddWho(listId)
      void saveItem(name, who, lockedSection.id)
      return
    }
    if (sections.length === 0) {
      toast('Add a section first')
      return
    }
    const who: Who = defaultQuickAddWho(listId)
    if (sections.length === 1) {
      void saveItem(name, who, sections[0]!.id)
      return
    }
    openSheet(
      <QuickAddSectionSheet
        listId={listId}
        text={name}
        who={who}
        onAdded={clear}
      />,
    )
  }

  const chooseRow = (index: number) => {
    const row = rows[index]
    if (!row) return
    if (row.kind === 'memory') void addWithMemory(row.memory)
    else addBrandNew(row.text)
  }

  const tryAdd = () => {
    if (!trimmed || busy) return
    if (rows.length > 0) {
      chooseRow(Math.min(highlight, rows.length - 1))
      return
    }
    if (exactMemory) void addWithMemory(exactMemory)
    else addBrandNew(trimmed)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    tryAdd()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      tryAdd()
      return
    }
    if (!open || rows.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % rows.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + rows.length) % rows.length)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (!list) return null

  const placeholder = lockedSection
    ? `Add to ${lockedSection.name}…`
    : 'Add an item…'

  return (
    <div className={`quick-add${open && rows.length > 0 ? ' is-open' : ''}`}>
      <form className="quick-add-form" autoComplete="off" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor={listIdAttr}>
          {lockedSection
            ? `Quick add to ${lockedSection.name}`
            : 'Quick add item'}
        </label>
        <input
          ref={inputRef}
          id={listIdAttr}
          className="in quick-add-in"
          value={text}
          placeholder={placeholder}
          enterKeyHint="done"
          disabled={busy}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150)
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          className="quick-add-go"
          disabled={busy || !trimmed}
          aria-label={
            rows[highlight]?.kind === 'memory'
              ? `Add ${rows[highlight].memory.text}`
              : trimmed
                ? `Add ${trimmed}`
                : 'Add item'
          }
        >
          <IconCheck />
        </button>
      </form>
      {open && rows.length > 0 ? (
        <ul className="quick-add-suggest" role="listbox">
          {rows.map((row, i) =>
            row.kind === 'memory' ? (
              <li key={`m-${row.memory.text}`}>
                <button
                  type="button"
                  className={i === highlight ? 'on' : undefined}
                  role="option"
                  aria-selected={i === highlight}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void addWithMemory(row.memory)}
                >
                  <span className="quick-add-name">{row.memory.text}</span>
                  <span className="quick-add-meta">{row.memory.sectionName}</span>
                </button>
              </li>
            ) : (
              <li key="new">
                <button
                  type="button"
                  className={i === highlight ? 'on' : undefined}
                  role="option"
                  aria-selected={i === highlight}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addBrandNew(row.text)}
                >
                  <span className="quick-add-name">Add “{row.text}”</span>
                  <span className="quick-add-meta">New item</span>
                </button>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </div>
  )
}
