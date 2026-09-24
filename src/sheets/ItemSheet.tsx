import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ConfirmButton } from '../components/ConfirmButton'
import {
  WHO_OPTIONS,
  addItem,
  deleteItem,
  getLastWho,
  getStore,
  moveItem,
  promoteItems,
  setLastWho,
  updateItem,
  type Who,
} from '../store'
import { useStore } from '../store/useStore'
import { useSheet } from './SheetProvider'
import { toast } from '../toast'

type Props = {
  listId: string
  /** Edit existing item */
  itemId?: string
  /** Required when adding */
  sectionId?: string
}

export function ItemSheet({ listId, itemId, sectionId }: Props) {
  const data = useStore()
  const { closeSheet } = useSheet()
  const list = data.lists.find((l) => l.id === listId)
  const item = itemId ? data.items.find((i) => i.id === itemId) : undefined
  const sections = data.sections
    .filter((s) => s.listId === listId)
    .sort((a, b) => a.position - b.position)

  const addSectionId = sectionId ?? item?.sectionId ?? sections[0]?.id
  const section = sections.find((s) => s.id === addSectionId)
  const trip = list?.kind === 'trip'
  const template =
    trip && list?.templateId
      ? data.lists.find((l) => l.id === list.templateId)
      : undefined

  const [text, setText] = useState(item?.text ?? '')
  const [who, setWho] = useState<Who>(item?.who ?? getLastWho())
  const [secId, setSecId] = useState(item?.sectionId ?? addSectionId ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const whoHint = WHO_OPTIONS.find((w) => w.id === who)?.hint ?? ''
  const formId = useId()

  useEffect(() => {
    if (item) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [item])

  if (!list || !addSectionId) {
    return null
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) {
      inputRef.current?.focus()
      return
    }
    setLastWho(who)
    if (item) {
      updateItem(item.id, { text: trimmed, who, sectionId: secId })
      closeSheet()
    } else {
      addItem(listId, addSectionId, trimmed, who)
      setText('')
      toast(`Added ${trimmed}`)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  return (
    <>
      <h3>{item ? 'Edit item' : `Add to ${section?.name ?? 'section'}`}</h3>
      <form id={formId} autoComplete="off" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="f-text">Item</label>
          <input
            ref={inputRef}
            className="in"
            id="f-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Headlamp"
            enterKeyHint={item ? 'done' : 'enter'}
          />
        </div>

        <fieldset className="field">
          <legend>Who packs it?</legend>
          <div className="who-seg">
            {WHO_OPTIONS.map((w) => (
              <label key={w.id}>
                <input
                  type="radio"
                  name="who"
                  value={w.id}
                  checked={who === w.id}
                  onChange={() => setWho(w.id)}
                />
                <span className="who-ico">
                  {w.id === 'shared' ? (
                    <i className="lg-box" />
                  ) : w.id === 'each' ? (
                    <>
                      <i className="lg-dot" style={{ borderColor: 'var(--dustin)' }} />
                      <i className="lg-dot" style={{ borderColor: 'var(--brea)' }} />
                    </>
                  ) : (
                    <i
                      className="lg-dot"
                      style={{ borderColor: `var(--${w.id})` }}
                    />
                  )}
                </span>
                {w.label}
              </label>
            ))}
          </div>
          <p className="hint">{whoHint}</p>
        </fieldset>

        {item ? (
          <>
            <div className="field">
              <label htmlFor="f-sec">Section</label>
              <select
                className="in"
                id="f-sec"
                value={secId}
                onChange={(e) => setSecId(e.target.value)}
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="minor">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (!moveItem(item.id, -1)) toast('Already at the top')
                }}
              >
                Move up
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (!moveItem(item.id, 1)) toast('Already at the bottom')
                }}
              >
                Move down
              </button>
              {trip && item.tripOnly && template ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    const name = promoteItems(listId, [item.id])
                    if (name) toast(`Added 1 item to ${name}`)
                    else toast('The template for this trip was deleted')
                    closeSheet()
                  }}
                >
                  Add to {template.name}
                </button>
              ) : null}
            </div>
            {trip ? (
              <p className="hint" style={{ margin: '-4px 0 14px' }}>
                Edits here change this trip only
                {template ? ', not the template' : ''}.
              </p>
            ) : null}
          </>
        ) : null}

        <div className="sheet-actions">
          {item ? (
            <ConfirmButton
              className="btn btn-danger"
              confirmLabel="Tap again to delete"
              onConfirm={() => {
                const label = getStore().items.find((i) => i.id === item.id)?.text
                deleteItem(item.id)
                closeSheet()
                toast(`Deleted ${label ?? 'item'}`)
              }}
            >
              Delete
            </ConfirmButton>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={closeSheet}>
              Done
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-wide">
            {item ? 'Save' : 'Add item'}
          </button>
        </div>
      </form>
    </>
  )
}
