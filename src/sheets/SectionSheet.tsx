import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ConfirmButton } from '../components/ConfirmButton'
import {
  TemplateSectionPicker,
  buildTemplateGroups,
} from '../components/TemplateSectionPicker'
import {
  addSection,
  copySectionsFromTemplate,
  deleteSection,
  moveSection,
  updateSection,
} from '../store'
import { useStore } from '../store/useStore'
import { useSheet } from './SheetProvider'
import { toast } from '../toast'

type Props = {
  listId: string
  sectionId?: string
}

type NewMode = 'blank' | 'from-template'

export function SectionSheet({ listId, sectionId }: Props) {
  const data = useStore()
  const { closeSheet } = useSheet()
  const section = sectionId
    ? data.sections.find((s) => s.id === sectionId)
    : undefined
  const itemCount = sectionId
    ? data.items.filter((i) => i.sectionId === sectionId).length
    : 0

  const templates = data.lists
    .filter((l) => l.kind === 'template' && l.id !== listId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const groups = useMemo(
    () => buildTemplateGroups(templates, data.sections),
    [templates, data.sections],
  )

  const [name, setName] = useState(section?.name ?? '')
  const [newMode, setNewMode] = useState<NewMode>('blank')
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    () => new Set(),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (section || newMode !== 'blank') return
    const t = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [section, newMode])

  const onSubmitBlank = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const ok = section
      ? await updateSection(section.id, trimmed)
      : Boolean(await addSection(listId, trimmed))
    if (ok) closeSheet()
  }

  const onAddFromTemplate = async () => {
    if (selectedSections.size === 0) {
      toast('Pick at least one section')
      return
    }
    const n = await copySectionsFromTemplate(listId, [...selectedSections])
    if (n === 0) return
    closeSheet()
    toast(n === 1 ? 'Added 1 section' : `Added ${n} sections`)
  }

  const confirmDelete =
    itemCount > 0
      ? `Delete it and ${itemCount} item${itemCount > 1 ? 's' : ''}`
      : 'Tap again to delete'

  if (section) {
    return (
      <>
        <h3>Edit section</h3>
        <form autoComplete="off" onSubmit={onSubmitBlank}>
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
          <div className="minor">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void moveSection(section.id, -1)}
            >
              Move up
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void moveSection(section.id, 1)}
            >
              Move down
            </button>
          </div>
          <div className="sheet-actions">
            <ConfirmButton
              className="btn btn-danger"
              confirmLabel={confirmDelete}
              onConfirm={async () => {
                const ok = await deleteSection(section.id)
                if (ok) closeSheet()
              }}
            >
              Delete
            </ConfirmButton>
            <button type="submit" className="btn btn-primary btn-wide">
              Save
            </button>
          </div>
        </form>
      </>
    )
  }

  return (
    <>
      <h3>New section</h3>
      <div className="seg" style={{ marginTop: 0, marginBottom: 14 }} role="tablist">
        <button
          type="button"
          className={newMode === 'blank' ? 'on' : ''}
          onClick={() => setNewMode('blank')}
        >
          Blank
        </button>
        <button
          type="button"
          className={newMode === 'from-template' ? 'on' : ''}
          onClick={() => setNewMode('from-template')}
          disabled={groups.length === 0}
        >
          From a template
        </button>
      </div>

      {newMode === 'blank' ? (
        <form autoComplete="off" onSubmit={onSubmitBlank}>
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
          <div className="sheet-actions">
            <button type="submit" className="btn btn-primary btn-wide">
              Add section
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            Copy sections and their items onto this list. On a trip, they’ll
            still save back to their original template.
          </p>
          <TemplateSectionPicker
            groups={groups}
            selected={selectedSections}
            onChange={setSelectedSections}
          />
          <div className="sheet-actions">
            <button
              type="button"
              className="btn btn-primary btn-wide"
              disabled={selectedSections.size === 0}
              onClick={onAddFromTemplate}
            >
              Add{' '}
              {selectedSections.size === 0
                ? 'sections'
                : selectedSections.size === 1
                  ? '1 section'
                  : `${selectedSections.size} sections`}
            </button>
          </div>
        </>
      )}
    </>
  )
}
