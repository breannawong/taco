import { useState, type FormEvent } from 'react'
import {
  defaultTripName,
  startTripFromTemplate,
} from '../store'
import { useStore } from '../store/useStore'
import { openList, setFilter } from '../store/nav'
import { useSheet } from './SheetProvider'
import { toast } from '../toast'

type Props = {
  /** Pre-select this template when opened from a template's menu. */
  templateId?: string
}

export function StartPackSheet({ templateId }: Props) {
  const data = useStore()
  const { closeSheet } = useSheet()
  const templates = data.lists
    .filter((l) => l.kind === 'template')
    .sort((a, b) => a.name.localeCompare(b.name))

  const initialId =
    (templateId && templates.some((t) => t.id === templateId)
      ? templateId
      : templates[0]?.id) ?? ''

  const [tplId, setTplId] = useState(initialId)
  const [name, setName] = useState(
    initialId ? defaultTripName(initialId) : '',
  )
  const [nameTouched, setNameTouched] = useState(false)

  if (templates.length === 0) {
    return (
      <>
        <h3>Start a pack</h3>
        <p className="hint">Make a template first.</p>
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={closeSheet}>
            Close
          </button>
        </div>
      </>
    )
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const tripId = startTripFromTemplate(tplId, name)
    if (!tripId) {
      toast("Couldn't start that pack")
      return
    }
    setFilter('all')
    closeSheet()
    openList(tripId)
  }

  return (
    <>
      <h3>Start a pack</h3>
      <form autoComplete="off" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="f-tpl">From template</label>
          <select
            className="in"
            id="f-tpl"
            value={tplId}
            onChange={(e) => {
              const id = e.target.value
              setTplId(id)
              if (!nameTouched) setName(defaultTripName(id))
            }}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-tname">Trip name</label>
          <input
            className="in"
            id="f-tname"
            value={name}
            onChange={(e) => {
              setNameTouched(true)
              setName(e.target.value)
            }}
          />
        </div>
        <p className="hint" style={{ margin: '-4px 0 16px' }}>
          Everything starts unchecked. Add one-off items to this trip without touching
          the template.
        </p>
        <div className="sheet-actions">
          <button type="submit" className="btn btn-primary btn-wide">
            Start packing
          </button>
        </div>
      </form>
    </>
  )
}
