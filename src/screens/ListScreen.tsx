import { useEffect } from 'react'
import { PackingAsButton } from '../components/PackingAsButton'
import { ProgressRows } from '../components/ProgressRows'
import { SortablePackingList } from '../components/SortablePackingList'
import { IconBack, IconDots, IconPlus } from '../components/Icons'
import {
  doneFor,
  isDone,
  owes,
  progress,
  type PersonId,
} from '../store'
import { useStore } from '../store/useStore'
import { goHome, setFilter } from '../store/nav'
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
  const canDrag = activeFilter === 'all'
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

  const visibleItems = listItems.filter((item) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'left') return !isDone(item, listChecks, data.people)
    return owes(item, me) && !doneFor(item, listChecks, me, data.people)
  })

  const shownTotal = visibleItems.length

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

        <SortablePackingList
          listId={listId}
          me={me}
          trip={trip}
          canDrag={canDrag}
          showAddRow={activeFilter === 'all'}
          sections={sections}
          visibleItems={visibleItems}
          allListItems={listItems}
          listChecks={listChecks}
          people={data.people}
          onEditItem={(itemId) =>
            openSheet(<ItemSheet listId={listId} itemId={itemId} />)
          }
          onEditSection={(sectionId) =>
            openSheet(<SectionSheet listId={listId} sectionId={sectionId} />)
          }
          onAddItem={(sectionId) =>
            openSheet(<ItemSheet listId={listId} sectionId={sectionId} />)
          }
        />

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
