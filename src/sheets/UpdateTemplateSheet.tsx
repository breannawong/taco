import { useMemo, useState } from 'react'
import { archiveTrip, promoteItems } from '../store'
import { useStore } from '../store/useStore'
import { goHome } from '../store/nav'
import { useSheet } from './SheetProvider'
import { toast } from '../toast'

type Props = {
  listId: string
  /** Finish flow: copy selected items then archive and go home. */
  mode?: 'update' | 'finish'
}

/** Pick which items added on this trip to copy onto the template. */
export function UpdateTemplateSheet({ listId, mode = 'update' }: Props) {
  const data = useStore()
  const { closeSheet } = useSheet()
  const list = data.lists.find((l) => l.id === listId)
  const template =
    list?.templateId != null
      ? data.lists.find((l) => l.id === list.templateId)
      : undefined
  const finishing = mode === 'finish'

  const tripItems = useMemo(
    () =>
      data.items
        .filter((i) => i.listId === listId && i.tripOnly)
        .sort((a, b) => a.position - b.position),
    [data.items, listId],
  )

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(tripItems.map((i) => i.id)),
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

  const finishTrip = (promoteIds: string[]) => {
    if (promoteIds.length > 0 && template) {
      promoteItems(listId, promoteIds)
    }
    archiveTrip(listId)
    closeSheet()
    goHome()
    if (promoteIds.length > 0 && template) {
      toast(
        `Saved ${promoteIds.length === 1 ? '1 item' : `${promoteIds.length} items`} · trip finished`,
      )
    } else {
      toast('Trip finished')
    }
  }

  if (!template && finishing) {
    return (
      <>
        <h3>Finish trip</h3>
        <p className="note">
          This trip’s template is gone, so there’s nothing to save back. You can still
          archive it.
        </p>
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

  if (!template) return null

  if (nAdded === 0) {
    if (finishing) {
      return (
        <>
          <h3>Finish trip</h3>
          <p className="note">
            You didn’t add any new items this trip. Archive {list.name}?
          </p>
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

  return (
    <>
      <h3>{finishing ? 'Finish trip' : 'Update template'}</h3>
      <p className="note" style={{ marginTop: 0 }}>
        {finishing ? (
          <>
            You added {nAdded} item{nAdded === 1 ? '' : 's'} this trip. Save any to{' '}
            {template.name}?
          </>
        ) : (
          <>
            Items added on this trip. Uncheck any you don’t want on {template.name}.
          </>
        )}
      </p>
      <ul className="pick-list">
        {tripItems.map((item) => (
          <li key={item.id}>
            <label className="pick-row">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="sheet-actions">
        {finishing ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={closeSheet}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-wide"
              onClick={() => finishTrip(selectedIds)}
            >
              Finish trip
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-wide"
            disabled={n === 0}
            onClick={() => {
              const name = promoteItems(listId, selectedIds)
              closeSheet()
              if (name) {
                toast(
                  `Added ${n === 1 ? '1 item' : `${n} items`} to ${name}`,
                )
              } else {
                toast('The template for this trip was deleted')
              }
            }}
          >
            Add {n} item{n === 1 ? '' : 's'} to {template.name}
          </button>
        )}
      </div>
    </>
  )
}
