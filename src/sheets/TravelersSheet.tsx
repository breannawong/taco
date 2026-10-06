import { useState, type FormEvent } from 'react'
import { peopleForList, setTripTravelers } from '../store'
import type { PersonId } from '../store'
import { useStore } from '../store/useStore'
import { useSheet } from './SheetProvider'
import { toast } from '../toast'

type Props = { listId: string }

/** Add or remove people on an existing trip. */
export function TravelersSheet({ listId }: Props) {
  const data = useStore()
  const { closeSheet } = useSheet()
  const list = data.lists.find((l) => l.id === listId)
  const current = peopleForList(listId, data)
  const [selected, setSelected] = useState<Set<PersonId>>(
    () => new Set(current.map((p) => p.id)),
  )
  const [saving, setSaving] = useState(false)

  if (!list || list.kind !== 'trip') return null

  const toggle = (id: PersonId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (selected.size === 0) {
      toast('Pick at least one person')
      return
    }
    setSaving(true)
    const ok = await setTripTravelers(listId, [...selected])
    setSaving(false)
    if (!ok) return
    closeSheet()
    const n = selected.size
    toast(n === 1 ? 'Solo trip' : `${n} people on this trip`)
  }

  return (
    <>
      <h3>Who’s going</h3>
      <p className="note">
        Add someone to a solo trip, or remove someone from a shared trip. Progress
        and pack circles follow this list.
      </p>
      <form autoComplete="off" onSubmit={onSubmit}>
        <ul className="pick-list" style={{ maxHeight: 'none' }}>
          {data.people.map((p) => (
            <li key={p.id}>
              <label className="pick-row">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span className={`av av-sm bg-${p.id}`} aria-hidden>
                  {p.initial}
                </span>
                <span>{p.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={closeSheet}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-wide"
            disabled={selected.size === 0 || saving}
          >
            Save
          </button>
        </div>
      </form>
    </>
  )
}
