import { useEffect, useRef, useState } from 'react'
import { PackingAsButton } from '../components/PackingAsButton'
import { ProgressRows } from '../components/ProgressRows'
import { SortablePackingList } from '../components/SortablePackingList'
import { IconBack, IconDots, IconPlus } from '../components/Icons'
import {
  doneFor,
  getLastViewedAt,
  isDone,
  markListViewed,
  owes,
  progress,
  type Item,
  type PersonId,
} from '../store'
import {
  dismissFinishPrompt,
  isFinishPromptDismissed,
} from '../store/finishPrompt'
import { useStore } from '../store/useStore'
import { goHome, getView, setFilter } from '../store/nav'
import { useCollapsedSnapshot, useFilter } from '../store/useNav'
import { useSheet } from '../sheets/SheetProvider'
import { ItemSheet } from '../sheets/ItemSheet'
import { SectionSheet } from '../sheets/SectionSheet'
import { ListMenuSheet } from '../sheets/ListMenuSheet'
import { UpdateTemplateSheet } from '../sheets/UpdateTemplateSheet'

type Props = {
  listId: string
  me: PersonId
}

const FILTERS = [
  { id: 'all' as const, label: 'Everything' },
  { id: 'left' as const, label: 'Still to pack' },
  { id: 'mine' as const, label: 'Mine to pack' },
]

const FADE_MS = 1000

export function ListScreen({ listId, me }: Props) {
  const data = useStore()
  const filter = useFilter()
  useCollapsedSnapshot()
  const { openSheet } = useSheet()
  const [reordering, setReordering] = useState(false)
  const [finishDismissed, setFinishDismissed] = useState(() =>
    isFinishPromptDismissed(listId),
  )
  /** Items kept visible while fading out of Still/Mine filters. */
  const [fadingIds, setFadingIds] = useState<string[]>([])
  const prevMatchRef = useRef<Map<string, boolean>>(new Map())
  const fadeTimersRef = useRef<Map<string, number>>(new Map())
  /** Snapshot at enter so New tags don't clear mid-visit. */
  const [visitLastViewedAt, setVisitLastViewedAt] = useState<number | null>(
    () => getLastViewedAt(listId, me),
  )

  const list = data.lists.find((l) => l.id === listId)
  const trip = list?.kind === 'trip'
  const archived = Boolean(list?.archivedAt)
  const activeFilter = reordering || archived ? 'all' : trip ? filter : 'all'

  useEffect(() => {
    setFinishDismissed(isFinishPromptDismissed(listId))
  }, [listId])

  useEffect(() => {
    setVisitLastViewedAt(getLastViewedAt(listId, me))
    return () => {
      // Defer so React Strict Mode remount (same list) does not clear New tags.
      const leftId = listId
      const leftMe = me
      queueMicrotask(() => {
        const v = getView()
        if (v.name === 'list' && v.id === leftId) return
        markListViewed(leftId, leftMe)
      })
    }
  }, [listId, me])

  const listItems = data.items.filter((i) => i.listId === listId)
  const listChecks = data.checks.filter((c) => c.listId === listId)

  const matchesFilter = (item: Item) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'left') return !isDone(item, listChecks, data.people)
    return owes(item, me) && !doneFor(item, listChecks, me, data.people)
  }

  const clearFades = () => {
    for (const t of fadeTimersRef.current.values()) window.clearTimeout(t)
    fadeTimersRef.current.clear()
    setFadingIds([])
  }

  const cancelFade = (itemId: string) => {
    const t = fadeTimersRef.current.get(itemId)
    if (t != null) {
      window.clearTimeout(t)
      fadeTimersRef.current.delete(itemId)
    }
    setFadingIds((ids) => ids.filter((id) => id !== itemId))
  }

  const startFade = (itemId: string) => {
    const existing = fadeTimersRef.current.get(itemId)
    if (existing != null) window.clearTimeout(existing)
    setFadingIds((ids) => (ids.includes(itemId) ? ids : [...ids, itemId]))
    const t = window.setTimeout(() => {
      fadeTimersRef.current.delete(itemId)
      setFadingIds((ids) => ids.filter((id) => id !== itemId))
    }, FADE_MS)
    fadeTimersRef.current.set(itemId, t)
  }

  useEffect(() => {
    if (!list) goHome()
  }, [list])

  useEffect(() => {
    return () => {
      for (const t of fadeTimersRef.current.values()) window.clearTimeout(t)
      fadeTimersRef.current.clear()
    }
  }, [])

  // Reset match tracking when filter / list / reorder mode changes.
  useEffect(() => {
    clearFades()
    const map = new Map<string, boolean>()
    for (const item of listItems) {
      map.set(item.id, matchesFilter(item))
    }
    prevMatchRef.current = map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, listId, reordering])

  // When checks change, fade items that just left the current filter.
  useEffect(() => {
    if (!list || activeFilter === 'all') return

    for (const item of listItems) {
      const matches = matchesFilter(item)
      const wasMatching = prevMatchRef.current.get(item.id)

      if (matches) {
        cancelFade(item.id)
      } else if (wasMatching === true) {
        startFade(item.id)
      }
      prevMatchRef.current.set(item.id, matches)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listChecks, listItems, activeFilter, me, data.people, list])

  if (!list) return null

  const fromName =
    trip && list.templateId
      ? data.lists.find((l) => l.id === list.templateId)?.name
      : undefined

  const sections = data.sections
    .filter((s) => s.listId === listId)
    .sort((a, b) => a.position - b.position)

  const st = trip ? progress(listId, data.items, data.checks, data.people) : null

  const visibleItems = listItems.filter(
    (item) => matchesFilter(item) || fadingIds.includes(item.id),
  )

  const shownTotal = visibleItems.filter((item) => matchesFilter(item)).length

  const enterReorder = () => {
    if (archived) return
    clearFades()
    if (trip && filter !== 'all') setFilter('all')
    setReordering(true)
  }

  const allPacked =
    trip && st != null && st.total > 0 && st.done === st.total && !archived
  const showFinishPrompt = allPacked && !finishDismissed && !reordering

  return (
    <>
      <header className="top">
        <div className="top-in">
          <button
            type="button"
            className="icon-btn"
            aria-label="Back to all lists"
            onClick={() => {
              setReordering(false)
              goHome()
            }}
          >
            <IconBack />
          </button>
          <div className="ttl">
            <div className="eyebrow">
              {reordering
                ? 'Reordering'
                : archived
                  ? `Past trip${fromName ? ` · from ${fromName}` : ''}`
                  : `${trip ? 'Trip' : 'Template'}${fromName ? ` · from ${fromName}` : ''}`}
            </div>
            <h1>{list.name}</h1>
          </div>
          {reordering ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ height: 40, padding: '0 14px', flex: 'none' }}
              onClick={() => setReordering(false)}
            >
              Done
            </button>
          ) : (
            <>
              <PackingAsButton personId={me} solo />
              <button
                type="button"
                className="icon-btn"
                aria-label="List options"
                onClick={() =>
                  openSheet(
                    <ListMenuSheet listId={listId} onStartReorder={enterReorder} />,
                  )
                }
              >
                <IconDots />
              </button>
            </>
          )}
        </div>
      </header>
      <main className="wrap">
        {archived ? (
          <p className="note" style={{ marginTop: 8 }}>
            This trip is finished. It’s read-only — restore it from Home to pack again.
          </p>
        ) : null}

        {showFinishPrompt ? (
          <div className="finish-prompt" role="status">
            <p>
              Everything’s packed. Ready to <strong>Finish trip</strong>?
            </p>
            <div className="finish-prompt-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  openSheet(<UpdateTemplateSheet listId={listId} mode="finish" />)
                }
              >
                Finish trip
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  dismissFinishPrompt(listId)
                  setFinishDismissed(true)
                }}
              >
                Not now
              </button>
            </div>
          </div>
        ) : null}

        {reordering ? (
          <p className="note" style={{ marginTop: 8 }}>
            Hold a handle, then drag. Checking is paused until you tap Done.
          </p>
        ) : null}

        {trip && st && !reordering ? (
          <>
            <div className="summary">
              <div className="big tnum">
                <b>{st.done}</b> of {st.total} items fully packed
              </div>
              <ProgressRows progress={st} people={data.people} />
            </div>
            {!archived ? (
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
            ) : null}
          </>
        ) : null}

        {!trip && !reordering ? (
          <p className="note" style={{ marginTop: 12 }}>
            This is the master list. Edit it anytime; start a pack to get a fresh,
            unchecked copy.
          </p>
        ) : null}

        <SortablePackingList
          listId={listId}
          me={me}
          trip={Boolean(trip)}
          canDrag={!archived}
          reorderMode={reordering}
          readOnly={archived}
          showAddRow={activeFilter === 'all' && !reordering && !archived}
          sections={sections}
          visibleItems={visibleItems}
          allListItems={listItems}
          listChecks={listChecks}
          people={data.people}
          fadingIds={fadingIds}
          filterMode={activeFilter}
          lastViewedAt={visitLastViewedAt}
          onEditItem={(itemId) => {
            if (reordering || archived) return
            openSheet(<ItemSheet listId={listId} itemId={itemId} />)
          }}
          onEditSection={(sectionId) => {
            if (reordering || archived) return
            openSheet(<SectionSheet listId={listId} sectionId={sectionId} />)
          }}
          onAddItem={(sectionId) =>
            openSheet(<ItemSheet listId={listId} sectionId={sectionId} />)
          }
        />

        {activeFilter !== 'all' && shownTotal === 0 && fadingIds.length === 0 ? (
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

        {activeFilter === 'all' && !reordering && !archived ? (
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
