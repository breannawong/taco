import { useMemo, useState } from 'react'
import {
  archiveTrip,
  promoteItems,
  resolveTemplateIdForTripSection,
  saveTripAsNewTemplate,
} from '../store'
import { useStore } from '../store/useStore'
import { goHome } from '../store/nav'
import { useSheet } from './SheetProvider'
import { toast } from '../toast'

type Props = {
  listId: string
  /** Finish flow: copy selected items then archive and go home. */
  mode?: 'update' | 'finish'
}

/** Pick which items added on this trip to copy onto their source templates. */
export function UpdateTemplateSheet({ listId, mode = 'update' }: Props) {
  const data = useStore()
  const { closeSheet } = useSheet()
  const list = data.lists.find((l) => l.id === listId)
  const finishing = mode === 'finish'

  const tripItems = useMemo(
    () =>
      data.items
        .filter((i) => i.listId === listId && i.tripOnly)
        .sort((a, b) => a.position - b.position),
    [data.items, listId],
  )

  const destinationLabel = useMemo(() => {
    const names = new Set<string>()
    for (const item of tripItems) {
      const sec = data.sections.find((s) => s.id === item.sectionId)
      const tplId = resolveTemplateIdForTripSection(
        sec,
        data.sections,
        list?.templateId,
      )
      const tpl = tplId ? data.lists.find((l) => l.id === tplId) : undefined
      if (tpl) names.add(tpl.name)
    }
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    if (sorted.length === 0) return null
    if (sorted.length === 1) return sorted[0]!
    return 'their templates'
  }, [tripItems, data.sections, data.lists, list?.templateId])

  const canPromote = tripItems.some((item) => {
    const sec = data.sections.find((s) => s.id === item.sectionId)
    return Boolean(
      resolveTemplateIdForTripSection(sec, data.sections, list?.templateId),
    )
  })

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(tripItems.map((i) => i.id)),
  )
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState(
    () => (list ? `${list.name} template` : ''),
  )

  if (!list) return null

  const nAdded = tripItems.length
  const selectedIds = tripItems.filter((i) => selected.has(i.id)).map((i) => i.id)
  const n = selectedIds.length

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const finishTrip = async (promoteIds: string[]) => {
    let promotedLabel: string | null = null
    if (promoteIds.length > 0) {
      promotedLabel = await promoteItems(listId, promoteIds)
      if (!promotedLabel) return
    }
    let savedTemplate = false
    if (finishing && saveAsTemplate) {
      const id = await saveTripAsNewTemplate(listId, newTemplateName)
      if (!id) {
        toast('Couldn’t save as a new template — check the name')
        return
      }
      savedTemplate = true
    }
    const archived = await archiveTrip(listId)
    if (!archived) return
    closeSheet()
    goHome()
    const bits: string[] = []
    if (promotedLabel && promoteIds.length > 0) {
      bits.push(
        `Saved ${promoteIds.length === 1 ? '1 item' : `${promoteIds.length} items`}`,
      )
    }
    if (savedTemplate) bits.push('new template created')
    bits.push('trip finished')
    toast(bits.join(' · '))
  }

  if (finishing && nAdded === 0) {
    return (
      <>
        <h3>Finish trip</h3>
        <p className="note">
          You didn’t add any new items this trip. Archive {list.name}?
        </p>
        {saveAsTemplateField()}
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={closeSheet}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-wide"
            onClick={() => finishTrip([])}
          >
            Finish trip
          </button>
        </div>
      </>
    )
  }

  if (!finishing && nAdded === 0) {
    return (
      <>
        <h3>Update template</h3>
        <p className="note">No items added on this trip to copy over.</p>
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={closeSheet}>
            Close
          </button>
        </div>
      </>
    )
  }

  if (!finishing && !canPromote) {
    return (
      <>
        <h3>Update template</h3>
        <p className="note">
          These items aren’t linked to a template section yet, so there’s nowhere
          to save them back.
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={closeSheet}>
            Close
          </button>
        </div>
      </>
    )
  }

  function saveAsTemplateField() {
    if (!finishing) return null
    return (
      <div className="field" style={{ marginTop: 12 }}>
        <label className="pick-row" style={{ paddingLeft: 0 }}>
          <input
            type="checkbox"
            checked={saveAsTemplate}
            onChange={(e) => setSaveAsTemplate(e.target.checked)}
          />
          <span>Save this trip as a new template</span>
        </label>
        {saveAsTemplate ? (
          <input
            className="in"
            style={{ marginTop: 8 }}
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="New template name"
            aria-label="New template name"
          />
        ) : null}
      </div>
    )
  }

  const dest = destinationLabel ?? 'template'

  return (
    <>
      <h3>{finishing ? 'Finish trip' : 'Update template'}</h3>
      <p className="note" style={{ marginTop: 0 }}>
        {finishing ? (
          <>
            You added {nAdded} item{nAdded === 1 ? '' : 's'} this trip. Save any
            to {dest}?
          </>
        ) : (
          <>
            Items added on this trip. Uncheck any you don’t want on {dest}.
          </>
        )}
      </p>
      <ul className="pick-list">
        {tripItems.map((item) => {
          const sec = data.sections.find((s) => s.id === item.sectionId)
          const tplId = resolveTemplateIdForTripSection(
            sec,
            data.sections,
            list.templateId,
          )
          const tplName = tplId
            ? data.lists.find((l) => l.id === tplId)?.name
            : undefined
          return (
            <li key={item.id}>
              <label className="pick-row">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  disabled={!tplId}
                />
                <span>
                  {item.text}
                  {tplName ? (
                    <span className="meta-note" style={{ display: 'block' }}>
                      → {tplName}
                      {sec ? ` · ${sec.name}` : ''}
                    </span>
                  ) : (
                    <span className="meta-note" style={{ display: 'block' }}>
                      No template link
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {saveAsTemplateField()}
      <div className="sheet-actions">
        {finishing ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={closeSheet}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-wide"
              onClick={() => finishTrip(selectedIds.filter((id) => {
                const item = tripItems.find((i) => i.id === id)
                if (!item) return false
                const sec = data.sections.find((s) => s.id === item.sectionId)
                return Boolean(
                  resolveTemplateIdForTripSection(
                    sec,
                    data.sections,
                    list.templateId,
                  ),
                )
              }))}
            >
              Finish trip
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-wide"
            disabled={n === 0}
            onClick={async () => {
              const label = await promoteItems(listId, selectedIds)
              if (!label) {
                toast('Couldn’t find a template to save to')
                return
              }
              closeSheet()
              toast(
                `Added ${n === 1 ? '1 item' : `${n} items`} to ${label}`,
              )
            }}
          >
            Add {n} item{n === 1 ? '' : 's'}
            {destinationLabel && destinationLabel !== 'their templates'
              ? ` to ${destinationLabel}`
              : ''}
          </button>
        )}
      </div>
    </>
  )
}
