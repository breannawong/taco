import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  TemplateSectionPicker,
  buildTemplateGroups,
} from '../components/TemplateSectionPicker'
import {
  defaultTripNameFromTemplates,
  startTrip,
  type PersonId,
} from '../store'
import { useStore } from '../store/useStore'
import { openList, setFilter } from '../store/nav'
import { useSheet } from './SheetProvider'
import { toast } from '../toast'

type Props = {
  /** Pre-select all sections from this template (e.g. opened from template menu). */
  templateId?: string
}

export function StartPackSheet({ templateId }: Props) {
  const data = useStore()
  const { closeSheet } = useSheet()
  const nameRef = useRef<HTMLInputElement>(null)
  const templates = data.lists
    .filter((l) => l.kind === 'template')
    .sort((a, b) => a.name.localeCompare(b.name))

  const groups = useMemo(
    () => buildTemplateGroups(templates, data.sections),
    [templates, data.sections],
  )

  const initialSections = useMemo(() => {
    const set = new Set<string>()
    if (templateId) {
      for (const s of data.sections.filter((sec) => sec.listId === templateId)) {
        set.add(s.id)
      }
    } else if (groups.length === 1) {
      for (const s of groups[0]!.sections) set.add(s.id)
    }
    return set
  }, [templateId, data.sections, groups])

  const [name, setName] = useState('')
  const [selectedSections, setSelectedSections] = useState<Set<string>>(initialSections)
  const [travelers, setTravelers] = useState<Set<PersonId>>(
    () => new Set(data.people.map((p) => p.id)),
  )

  useEffect(() => {
    const t = window.setTimeout(() => nameRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [])

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

  const selectedTemplateIds = [
    ...new Set(
      [...selectedSections]
        .map((id) => data.sections.find((s) => s.id === id)?.listId)
        .filter(Boolean) as string[],
    ),
  ]

  const toggleTraveler = (id: PersonId) => {
    setTravelers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size <= 1) return prev
        next.delete(id)
      } else next.add(id)
      return next
    })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (selectedSections.size === 0) {
      toast('Pick at least one section to bring')
      return
    }
    if (travelers.size === 0) {
      toast('Pick who’s going')
      return
    }
    const tripName = name.trim() || defaultTripNameFromTemplates([])
    const tripId = await startTrip({
      name: tripName,
      sectionIds: [...selectedSections],
      travelerIds: [...travelers],
    })
    if (!tripId) return
    setFilter('all')
    closeSheet()
    openList(tripId)
  }

  return (
    <>
      <h3>Start a pack</h3>
      <form autoComplete="off" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="f-tname">Trip name</label>
          <input
            ref={nameRef}
            className="in"
            id="f-tname"
            value={name}
            placeholder="Where to?"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <fieldset className="field">
          <legend>Who’s going</legend>
          <ul className="pick-list" style={{ maxHeight: 'none' }}>
            {data.people.map((p) => (
              <li key={p.id}>
                <label className="pick-row">
                  <input
                    type="checkbox"
                    checked={travelers.has(p.id)}
                    onChange={() => toggleTraveler(p.id)}
                  />
                  <span className={`av av-sm bg-${p.id}`} aria-hidden>
                    {p.initial}
                  </span>
                  <span>{p.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="field">
          <legend>What to bring</legend>
          <p className="hint" style={{ marginTop: 0 }}>
            Tap a template name to select all its sections. Mix sections from
            several templates.
            {selectedTemplateIds.length > 1
              ? ` · ${selectedTemplateIds.length} templates`
              : ''}
          </p>
          <TemplateSectionPicker
            groups={groups}
            selected={selectedSections}
            onChange={setSelectedSections}
          />
        </fieldset>

        <p className="hint" style={{ margin: '-4px 0 16px' }}>
          Everything starts unchecked. Add one-off items on the trip without
          touching the templates.
        </p>
        <div className="sheet-actions">
          <button
            type="submit"
            className="btn btn-primary btn-wide"
            disabled={selectedSections.size === 0 || travelers.size === 0}
          >
            Start packing
          </button>
        </div>
      </form>
    </>
  )
}
