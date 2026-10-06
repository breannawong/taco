import { useMemo, useState } from 'react'
import {
  addItem,
  addSection,
  getLastWho,
  peopleForList,
  setLastWho,
  whoForListMemory,
  type Who,
} from '../store'
import { useStore } from '../store/useStore'
import { useSheet } from './SheetProvider'
import { toast } from '../toast'

type Props = {
  listId: string
  /** Item name to add. */
  text: string
  /** Remembered or default who. */
  who: Who
  /** When set, offer “Create <name>” as the first action. */
  preferredSectionName?: string
  onAdded?: () => void
}

/**
 * Pick (or create) a section for a quick-add item whose remembered
 * section is missing, or for a brand-new item name.
 */
export function QuickAddSectionSheet({
  listId,
  text,
  who,
  preferredSectionName,
  onAdded,
}: Props) {
  const data = useStore()
  const { closeSheet } = useSheet()
  const [saving, setSaving] = useState(false)

  const sections = useMemo(
    () =>
      data.sections
        .filter((s) => s.listId === listId)
        .sort((a, b) => a.position - b.position),
    [data.sections, listId],
  )

  const list = data.lists.find((l) => l.id === listId)
  const travelers = peopleForList(listId, data)
  const solo = list?.kind === 'trip' && travelers.length === 1
  const saveWho: Who = solo
    ? whoForListMemory(who, travelers.map((p) => p.id))
    : who

  const preferredExists = preferredSectionName
    ? sections.some(
        (s) =>
          s.name.trim().toLowerCase() ===
          preferredSectionName.trim().toLowerCase(),
      )
    : false

  const finish = async (sectionId: string) => {
    setSaving(true)
    if (!solo) setLastWho(saveWho)
    const added = await addItem(listId, sectionId, text.trim(), saveWho)
    setSaving(false)
    if (!added) return
    toast(`Added ${added.text}`)
    onAdded?.()
    closeSheet()
  }

  const createPreferred = async () => {
    if (!preferredSectionName?.trim()) return
    setSaving(true)
    const sectionId = await addSection(listId, preferredSectionName.trim())
    if (!sectionId) {
      setSaving(false)
      return
    }
    if (!solo) setLastWho(saveWho)
    const added = await addItem(listId, sectionId, text.trim(), saveWho)
    setSaving(false)
    if (!added) return
    toast(`Added ${added.text}`)
    onAdded?.()
    closeSheet()
  }

  return (
    <>
      <h3>Add “{text.trim()}”</h3>
      {preferredSectionName && !preferredExists ? (
        <p className="note">
          Last time this was in <strong>{preferredSectionName}</strong>, which
          isn’t on this list yet.
        </p>
      ) : (
        <p className="note">Which section should it go in?</p>
      )}

      <div className="menu-list">
        {preferredSectionName && !preferredExists ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => void createPreferred()}
          >
            Create {preferredSectionName}
          </button>
        ) : null}
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={() => void finish(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="sheet-actions">
        <button type="button" className="btn btn-ghost" onClick={closeSheet}>
          Cancel
        </button>
      </div>
    </>
  )
}

/** Default who for a brand-new quick-add on this list. */
export function defaultQuickAddWho(listId: string): Who {
  const travelers = peopleForList(listId)
  if (travelers.length <= 1) return 'each'
  return getLastWho()
}
