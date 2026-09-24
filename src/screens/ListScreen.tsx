import { useEffect } from 'react'
import { PackingAsButton } from '../components/PackingAsButton'
import { ProgressRows } from '../components/ProgressRows'
import { ItemChecks } from '../components/ItemChecks'
import { IconBack, IconChev, IconDots, IconPlus } from '../components/Icons'
import {
  doneFor,
  isDone,
  owes,
  progress,
  whoLabel,
  type PersonId,
} from '../store'
import { useStore } from '../store/useStore'
import { goHome, isCollapsed, setFilter, toggleCollapsed } from '../store/nav'
import { useCollapsedSnapshot, useFilter } from '../store/useNav'
import { useSheet } from '../sheets/SheetProvider'
import { ItemSheet } from '../sheets/ItemSheet'
import { SectionSheet } from '../sheets/SectionSheet'
import { ListMenuSheet } from '../sheets/ListMenuSheet'

type Props = {
  listId: string
  me: PersonId
}

const FILTERS = [
  { id: 'all' as const, label: 'Everything' },
  { id: 'left' as const, label: 'Still to pack' },
  { id: 'mine' as const, label: 'Mine to pack' },
]

export function ListScreen({ listId, me }: Props) {
  const data = useStore()
  const filter = useFilter()
  useCollapsedSnapshot()
  const { openSheet } = useSheet()

  const list = data.lists.find((l) => l.id === listId)

  useEffect(() => {
    if (!list) goHome()
  }, [list])

  if (!list) return null

  const trip = list.kind === 'trip'
  const activeFilter = trip ? filter : 'all'
  const fromName =
    trip && list.templateId
      ? data.lists.find((l) => l.id === list.templateId)?.name
      : undefined

  const sections = data.sections
    .filter((s) => s.listId === listId)
    .sort((a, b) => a.position - b.position)

  const listItems = data.items.filter((i) => i.listId === listId)
  const listChecks = data.checks.filter((c) => c.listId === listId)
  const st = trip ? progress(listId, data.items, data.checks, data.people) : null

  let shownTotal = 0

  const sectionBlocks = sections.map((section) => {
    const allInSection = listItems
      .filter((i) => i.sectionId === section.id)
      .sort((a, b) => a.position - b.position)

    const visible = allInSection.filter((item) => {
      if (activeFilter === 'all') return true
      if (activeFilter === 'left') return !isDone(item, listChecks, data.people)
      return owes(item, me) && !doneFor(item, listChecks, me, data.people)
    })

    shownTotal += visible.length
    if (activeFilter !== 'all' && visible.length === 0) return null

    const doneN = allInSection.filter((item) =>
      isDone(item, listChecks, data.people),
    ).length
    const closed = isCollapsed(listId, section.id)

    return (
      <section key={section.id} className={`sec ${closed ? 'closed' : ''}`}>
        <div className="sec-h">
          <button
            type="button"
            className="sec-toggle"
            aria-expanded={!closed}
            onClick={() => toggleCollapsed(listId, section.id)}
          >
            <IconChev />
            <h2>{section.name}</h2>
          </button>
          <span className="count">
            {trip ? `${doneN}/${allInSection.length}` : allInSection.length}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Edit section ${section.name}`}
            onClick={() =>
              openSheet(<SectionSheet listId={listId} sectionId={section.id} />)
            }
          >
            <IconDots />
          </button>
        </div>
        <ul className="items">
          {visible.map((item) => {
            const done = trip && isDone(item, listChecks, data.people)
            const packers =
              trip && item.who === 'shared' && done
                ? data.people.filter((p) =>
                    listChecks.some(
                      (c) => c.itemId === item.id && c.personId === p.id,
                    ),
                  )
                : []
            const by =
              packers.length > 0
                ? ` · packed by ${packers.map((p) => p.name).join(' & ')}`
                : ''

            return (
              <li
                key={item.id}
                className={`row ${done ? 'done' : ''}`}
                data-row={item.id}
              >
                <button
                  type="button"
                  className="row-main"
                  onClick={() =>
                    openSheet(<ItemSheet listId={listId} itemId={item.id} />)
                  }
                >
                  <span className="txt">{item.text}</span>
                  <span className="meta">
                    {whoLabel(item, data.people)}
                    {by}
                    {trip && item.tripOnly ? (
                      <span className="tag">This trip</span>
                    ) : null}
                  </span>
                </button>
                <div className="checks">
                  <ItemChecks
                    item={item}
                    checks={listChecks}
                    people={data.people}
                    me={me}
                    interactive={trip}
                  />
                </div>
              </li>
            )
          })}
        </ul>
        {activeFilter === 'all' ? (
          <button
            type="button"
            className="add-row"
            onClick={() =>
              openSheet(
                <ItemSheet listId={listId} sectionId={section.id} />,
              )
            }
          >
            <IconPlus size={18} />
            Add to {section.name}
          </button>
        ) : null}
      </section>
    )
  })

  return (
    <>
      <header className="top">
        <div className="top-in">
          <button
            type="button"
            className="icon-btn"
            aria-label="Back to all lists"
            onClick={() => goHome()}
          >
            <IconBack />
          </button>
          <div className="ttl">
            <div className="eyebrow">
              {trip ? 'Trip' : 'Template'}
              {fromName ? ` · from ${fromName}` : ''}
            </div>
            <h1>{list.name}</h1>
          </div>
          <PackingAsButton personId={me} solo />
          <button
            type="button"
            className="icon-btn"
            aria-label="List options"
            onClick={() => openSheet(<ListMenuSheet listId={listId} />)}
          >
            <IconDots />
          </button>
        </div>
      </header>
      <main className="wrap">
        {trip && st ? (
          <>
            <div className="summary">
              <div className="big tnum">
                <b>{st.done}</b> of {st.total} items fully packed
              </div>
              <ProgressRows progress={st} people={data.people} />
            </div>
            <div className="seg" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  aria-pressed={activeFilter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="note" style={{ marginTop: 12 }}>
            This is the master list. Edit it anytime; start a pack to get a fresh,
            unchecked copy.
          </p>
        )}

        <div className="legend">
          <span>
            <i className="lg-box" />
            Shared: one check
          </span>
          <span>
            <i className="lg-dot" />
            <i className="lg-dot" style={{ marginLeft: -4 }} />
            Each: both check
          </span>
          <span>
            <i className="lg-dot" />
            One person
          </span>
        </div>

        {sectionBlocks}

        {activeFilter !== 'all' && shownTotal === 0 ? (
          <div className="allpacked">
            {activeFilter === 'mine' ? (
              <>
                <h2>You're packed</h2>
                <p>Everything you need to bring is checked off.</p>
              </>
            ) : (
              <>
                <h2>All packed</h2>
                <p>Every item on this trip is checked off.</p>
              </>
            )}
          </div>
        ) : null}

        {activeFilter === 'all' ? (
          <div className="add-sec">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => openSheet(<SectionSheet listId={listId} />)}
            >
              <IconPlus size={18} />
              New section
            </button>
          </div>
        ) : null}
      </main>
    </>
  )
}
