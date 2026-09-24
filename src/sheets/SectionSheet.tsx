import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ConfirmButton } from '../components/ConfirmButton'
import {
  addSection,
  deleteSection,
  moveSection,
  updateSection,
} from '../store'
import { useStore } from '../store/useStore'
import { useSheet } from './SheetProvider'

type Props = {
  listId: string
  sectionId?: string
}

export function SectionSheet({ listId, sectionId }: Props) {
  const data = useStore()
  const { closeSheet } = useSheet()
  const section = sectionId
    ? data.sections.find((s) => s.id === sectionId)
    : undefined
  const itemCount = sectionId
    ? data.items.filter((i) => i.sectionId === sectionId).length
    : 0

  const [name, setName] = useState(section?.name ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (section) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [section])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (section) updateSection(section.id, trimmed)
    else addSection(listId, trimmed)
    closeSheet()
  }

  const confirmDelete =
    itemCount > 0
      ? `Delete it and ${itemCount} item${itemCount > 1 ? 's' : ''}`
      : 'Tap again to delete'

  return (
    <>
      <h3>{section ? 'Edit section' : 'New section'}</h3>
      <form autoComplete="off" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="f-sname">Name</label>
          <input
            ref={inputRef}
            className="in"
            id="f-sname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kitchen"
          />
        </div>
        {section ? (
          <div className="minor">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => moveSection(section.id, -1)}
            >
              Move up
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => moveSection(section.id, 1)}
            >
              Move down
            </button>
          </div>
        ) : null}
        <div className="sheet-actions">
          {section ? (
            <ConfirmButton
              className="btn btn-danger"
              confirmLabel={confirmDelete}
              onConfirm={() => {
                deleteSection(section.id)
                closeSheet()
              }}
            >
              Delete
            </ConfirmButton>
          ) : null}
          <button type="submit" className="btn btn-primary btn-wide">
            {section ? 'Save' : 'Add section'}
          </button>
        </div>
      </form>
    </>
  )
}
