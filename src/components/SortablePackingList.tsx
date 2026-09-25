import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ItemChecks } from './ItemChecks'
import { IconChev, IconDots, IconGrip, IconPlus } from './Icons'
import {
  isDone,
  doneFor,
  isItemNewFor,
  setItemOrderInSection,
  setSectionOrder,
  type Check,
  type Item,
  type Person,
  type PersonId,
  type Section,
} from '../store'
import { isCollapsed, toggleCollapsed } from '../store/nav'

/** Exception meta under the item title (circles carry Shared / Each). */
function itemRowExtras(
  item: Item,
  listChecks: Check[],
  people: Person[],
  trip: boolean,
  hidePackedBy: boolean,
  me: PersonId,
  lastViewedAt: number | null,
): { packedBy: string | null; isNew: boolean } {
  const isNew = isItemNewFor(item, me, lastViewedAt)
  let packedBy: string | null = null

  if (!trip || hidePackedBy) return { packedBy, isNew }

  const itemChecks = listChecks.filter((c) => c.itemId === item.id)
  if (itemChecks.length === 0) return { packedBy, isNew }

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name

  if (item.who === 'shared') {
    const names = [
      ...new Set(
        itemChecks.map((c) => c.checkedBy ?? c.personId).filter(Boolean),
      ),
    ]
      .map((id) => nameOf(id))
      .filter(Boolean) as string[]
    if (names.length > 0) packedBy = `Packed by ${names.join(' & ')}`
  } else {
    // Helping: tapper (checkedBy) ≠ whose slot (personId)
    const helperIds = [
      ...new Set(
        itemChecks
          .filter((c) => (c.checkedBy ?? c.personId) !== c.personId)
          .map((c) => c.checkedBy!)
          .filter(Boolean),
      ),
    ]
    const names = helperIds
      .map((id) => nameOf(id))
      .filter(Boolean) as string[]
    if (names.length > 0) packedBy = `Packed by ${names.join(' & ')}`
  }

  return { packedBy, isNew }
}

function ItemMeta({
  packedBy,
  isNew,
}: {
  packedBy: string | null
  isNew: boolean
}) {
  if (!packedBy && !isNew) return null
  return (
    <span className="meta">
      {packedBy ? <span className="meta-note">{packedBy}</span> : null}
      {isNew ? <span className="tag">New</span> : null}
    </span>
  )
}

type Props = {
  listId: string
  me: PersonId
  trip: boolean
  /** Drag enabled (Everything filter, or Reorder mode). */
  canDrag: boolean
  /** Dedicated reorder UI: handles, immediate drag, checks muted. */
  reorderMode: boolean
  /** Archived trip: no checks / edits. */
  readOnly?: boolean
  showAddRow: boolean
  sections: Section[]
  /** Items to show (already filtered by the parent). */
  visibleItems: Item[]
  /** All items on the list (for section done/total counts). */
  allListItems: Item[]
  listChecks: Check[]
  people: Person[]
  /** Item ids fading out of Still/Mine filters. */
  fadingIds?: string[]
  filterMode?: 'all' | 'left' | 'mine'
  /** Frozen when the screen opened — New tags stay for the whole visit. */
  lastViewedAt: number | null
  onEditItem: (itemId: string) => void
  onEditSection: (sectionId: string) => void
  onAddItem: (sectionId: string) => void
}

function sectionDragId(id: string) {
  return `s:${id}`
}
function itemDragId(id: string) {
  return `i:${id}`
}
function parseDragId(
  id: UniqueIdentifier,
): { kind: 'section' | 'item'; id: string } | null {
  const s = String(id)
  if (s.startsWith('s:')) return { kind: 'section', id: s.slice(2) }
  if (s.startsWith('i:')) return { kind: 'item', id: s.slice(2) }
  return null
}

function buildItemsBySection(
  sections: Section[],
  items: Item[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const s of sections) {
    map[s.id] = items
      .filter((i) => i.sectionId === s.id)
      .sort((a, b) => a.position - b.position)
      .map((i) => i.id)
  }
  return map
}

/**
 * Apply a new order for the visible subset while keeping hidden items
 * (e.g. already packed in Still/Mine) in their relative slots.
 */
function applyVisibleOrder(
  fullIds: string[],
  visibleOrderedIds: string[],
): string[] {
  const visibleSet = new Set(visibleOrderedIds)
  const base = [...fullIds]
  for (const id of visibleOrderedIds) {
    if (!base.includes(id)) base.push(id)
  }
  const result: string[] = []
  let v = 0
  for (const id of base) {
    if (visibleSet.has(id)) {
      const next = visibleOrderedIds[v++]
      if (next) result.push(next)
    } else {
      result.push(id)
    }
  }
  while (v < visibleOrderedIds.length) {
    result.push(visibleOrderedIds[v++]!)
  }
  return result
}

export function SortablePackingList({
  listId,
  me,
  trip,
  canDrag,
  reorderMode,
  readOnly = false,
  showAddRow,
  sections,
  visibleItems,
  allListItems,
  listChecks,
  people,
  fadingIds = [],
  filterMode = 'all',
  lastViewedAt,
  onEditItem,
  onEditSection,
  onAddItem,
}: Props) {
  const [sectionOrder, setSectionOrderLocal] = useState(() =>
    sections.map((s) => s.id),
  )
  const [itemsBySection, setItemsBySection] = useState(() =>
    buildItemsBySection(sections, visibleItems),
  )
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const itemsBySectionRef = useRef(itemsBySection)
  itemsBySectionRef.current = itemsBySection
  const sectionOrderRef = useRef(sectionOrder)
  sectionOrderRef.current = sectionOrder

  useEffect(() => {
    if (activeId) return
    setSectionOrderLocal(sections.map((s) => s.id))
    setItemsBySection(buildItemsBySection(sections, visibleItems))
  }, [sections, visibleItems, activeId])

  // Mouse for desktop; TouchSensor for iPhone (PointerSensor activates but
  // often won't track finger movement after a long-press on iOS Safari).
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: reorderMode ? { distance: 4 } : { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: reorderMode
        ? { distance: 6 }
        : { delay: 500, tolerance: 8 },
    }),
  )

  const lockScroll = () => {
    document.documentElement.classList.add('is-dragging')
  }
  const unlockScroll = () => {
    document.documentElement.classList.remove('is-dragging')
  }

  useEffect(() => {
    return () => unlockScroll()
  }, [])

  const itemById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of visibleItems) m.set(i.id, i)
    // Keep all items for overlay / lookup when dragging across
    for (const i of allListItems) if (!m.has(i.id)) m.set(i.id, i)
    return m
  }, [visibleItems, allListItems])

  const sectionById = useMemo(() => {
    const m = new Map<string, Section>()
    for (const s of sections) m.set(s.id, s)
    return m
  }, [sections])

  const findItemContainer = (
    itemId: string,
    map: Record<string, string[]> = itemsBySection,
  ): string | undefined => {
    for (const [secId, ids] of Object.entries(map)) {
      if (ids.includes(itemId)) return secId
    }
    return undefined
  }

  const persistItemsBySection = (map: Record<string, string[]>) => {
    const claimedElsewhere = (secId: string, itemId: string) => {
      for (const [other, ids] of Object.entries(map)) {
        if (other !== secId && ids.includes(itemId)) return true
      }
      return false
    }

    for (const section of sections) {
      const secId = section.id
      const visibleOrdered = map[secId] ?? []
      const fullIds = allListItems
        .filter((i) => i.sectionId === secId && !claimedElsewhere(secId, i.id))
        .sort((a, b) => a.position - b.position)
        .map((i) => i.id)

      for (const id of visibleOrdered) {
        if (!fullIds.includes(id)) fullIds.push(id)
      }

      setItemOrderInSection(secId, applyVisibleOrder(fullIds, visibleOrdered))
    }
  }

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id)
    lockScroll()
  }

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const a = parseDragId(active.id)
    const o = parseDragId(over.id)
    if (!a || !o || a.kind !== 'item') return

    setItemsBySection((prev) => {
      const activeContainer = findItemContainer(a.id, prev)
      const overContainer =
        o.kind === 'item'
          ? findItemContainer(o.id, prev)
          : o.kind === 'section'
            ? o.id
            : undefined
      if (!activeContainer || !overContainer) return prev
      if (activeContainer === overContainer) return prev

      const activeItems = [...(prev[activeContainer] ?? [])]
      const overItems = [...(prev[overContainer] ?? [])]
      const activeIndex = activeItems.indexOf(a.id)
      if (activeIndex < 0) return prev
      activeItems.splice(activeIndex, 1)

      let newIndex: number
      if (o.kind === 'section') {
        newIndex = overItems.length
      } else {
        newIndex = overItems.indexOf(o.id)
        if (newIndex < 0) newIndex = overItems.length
      }
      overItems.splice(newIndex, 0, a.id)

      return {
        ...prev,
        [activeContainer]: activeItems,
        [overContainer]: overItems,
      }
    })
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const currentMap = itemsBySectionRef.current
    const currentSections = sectionOrderRef.current
    setActiveId(null)
    unlockScroll()
    if (!over) return

    const a = parseDragId(active.id)
    const o = parseDragId(over.id)
    if (!a || !o) return

    if (a.kind === 'section' && o.kind === 'section') {
      const oldIndex = currentSections.indexOf(a.id)
      const newIndex = currentSections.indexOf(o.id)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      const next = arrayMove(currentSections, oldIndex, newIndex)
      setSectionOrderLocal(next)
      setSectionOrder(listId, next)
      return
    }

    if (a.kind !== 'item') return

    const container = findItemContainer(a.id, currentMap)
    if (!container) {
      persistItemsBySection(currentMap)
      return
    }

    if (o.kind === 'item') {
      const overContainer = findItemContainer(o.id, currentMap)
      if (overContainer && overContainer !== container) {
        persistItemsBySection(currentMap)
        return
      }
      const ids = currentMap[container] ?? []
      const oldIndex = ids.indexOf(a.id)
      const newIndex = ids.indexOf(o.id)
      if (oldIndex < 0 || newIndex < 0) {
        persistItemsBySection(currentMap)
        return
      }
      if (oldIndex === newIndex) return
      const next = arrayMove(ids, oldIndex, newIndex)
      const nextMap = { ...currentMap, [container]: next }
      setItemsBySection(nextMap)
      persistItemsBySection(nextMap)
      return
    }

    if (o.kind === 'section') {
      persistItemsBySection(currentMap)
    }
  }

  const onDragCancel = () => {
    setActiveId(null)
    unlockScroll()
    setSectionOrderLocal(sections.map((s) => s.id))
    setItemsBySection(buildItemsBySection(sections, visibleItems))
  }

  const orderedSections = sectionOrder
    .map((id) => sectionById.get(id))
    .filter(Boolean) as Section[]

  const activeParsed = activeId ? parseDragId(activeId) : null
  let overlay: ReactNode = null
  if (activeParsed?.kind === 'section') {
    const s = sectionById.get(activeParsed.id)
    if (s) overlay = <div className="drag-overlay">{s.name}</div>
  } else if (activeParsed?.kind === 'item') {
    const item = itemById.get(activeParsed.id)
    if (item) {
      overlay = (
        <div className="drag-overlay">
          <span className="txt">{item.text}</span>
        </div>
      )
    }
  }

  const renderSection = (section: Section, withDrag: boolean) => {
    const itemIds = itemsBySection[section.id] ?? []
    const rows = itemIds
      .map((id) => itemById.get(id))
      .filter(Boolean) as Item[]

    if (!withDrag && rows.length === 0) return null

    const totalInSection = allListItems.filter(
      (i) => i.sectionId === section.id,
    ).length
    const doneN = allListItems
      .filter((i) => i.sectionId === section.id)
      .filter((item) => isDone(item, listChecks, people)).length
    const closed = isCollapsed(listId, section.id)
    const countLabel = trip ? `${doneN}/${totalInSection}` : String(totalInSection)

    const list = (
      <ul className="items">
        {rows.map((item) => {
          const fading = fadingIds.includes(item.id)
          const fullyDone = trip && isDone(item, listChecks, people)
          const mineDone =
            trip &&
            filterMode === 'mine' &&
            doneFor(item, listChecks, me, people)
          const done = fullyDone || mineDone || fading
          const extras = itemRowExtras(
            item,
            listChecks,
            people,
            trip,
            filterMode === 'mine',
            me,
            lastViewedAt,
          )

          if (withDrag) {
            return (
              <SortableItemRow
                key={item.id}
                item={item}
                done={!!done}
                fading={fading}
                packedBy={extras.packedBy}
                isNew={extras.isNew}
                trip={trip}
                me={me}
                people={people}
                listChecks={listChecks}
                reorderMode={reorderMode}
                mineOnly={filterMode === 'mine'}
                checksInteractive={trip && !reorderMode && !readOnly}
                onEdit={() => onEditItem(item.id)}
              />
            )
          }

          return (
            <li
              key={item.id}
              className={`row ${done ? 'done' : ''} ${fading ? 'fade-out' : ''}`}
              data-row={item.id}
            >
              <button
                type="button"
                className="row-main"
                onClick={() => onEditItem(item.id)}
              >
                <span className="txt">{item.text}</span>
                <ItemMeta packedBy={extras.packedBy} isNew={extras.isNew} />
              </button>
              <div className={`checks ${reorderMode || readOnly ? 'checks-muted' : ''}`}>
                <ItemChecks
                  item={item}
                  checks={listChecks}
                  people={people}
                  me={me}
                  interactive={trip && !reorderMode && !readOnly}
                  mineOnly={filterMode === 'mine'}
                />
              </div>
            </li>
          )
        })}
      </ul>
    )

    if (!withDrag) {
      return (
        <section
          key={section.id}
          className={`sec ${closed ? 'closed' : ''}`}
        >
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
            <span className="count">{countLabel}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Edit section ${section.name}`}
              onClick={() => onEditSection(section.id)}
            >
              <IconDots />
            </button>
          </div>
          {list}
        </section>
      )
    }

    return (
      <SortableSection
        key={section.id}
        section={section}
        closed={closed}
        countLabel={countLabel}
        reorderMode={reorderMode}
        onToggle={() => toggleCollapsed(listId, section.id)}
        onEdit={() => onEditSection(section.id)}
      >
        <SortableContext
          items={itemIds.map(itemDragId)}
          strategy={verticalListSortingStrategy}
        >
          {list}
        </SortableContext>
        {showAddRow ? (
          <button
            type="button"
            className="add-row"
            onClick={() => onAddItem(section.id)}
          >
            <IconPlus size={18} />
            Add to {section.name}
          </button>
        ) : null}
      </SortableSection>
    )
  }

  if (!canDrag) {
    return (
      <div className="pack-list">
        {orderedSections.map((s) => renderSection(s, false))}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext
        items={sectionOrder.map(sectionDragId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="pack-list">
          {orderedSections.map((s) => renderSection(s, true))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
    </DndContext>
  )
}

type SectionProps = {
  section: Section
  closed: boolean
  countLabel: string
  reorderMode: boolean
  onToggle: () => void
  onEdit: () => void
  children: ReactNode
}

function SortableSection({
  section,
  closed,
  countLabel,
  reorderMode,
  onToggle,
  onEdit,
  children,
}: SectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sectionDragId(section.id),
    data: { type: 'section', sectionId: section.id },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`sec ${closed ? 'closed' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      <div
        className="sec-h"
        ref={reorderMode ? undefined : setActivatorNodeRef}
        {...(reorderMode ? {} : { ...attributes, ...listeners })}
      >
        {reorderMode ? (
          <button
            type="button"
            className="drag-handle"
            ref={setActivatorNodeRef}
            aria-label={`Drag section ${section.name}`}
            {...attributes}
            {...listeners}
          >
            <IconGrip />
          </button>
        ) : null}
        <button
          type="button"
          className="sec-toggle"
          aria-expanded={!closed}
          onClick={onToggle}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <IconChev />
          <h2>{section.name}</h2>
        </button>
        <span className="count">{countLabel}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Edit section ${section.name}`}
          onClick={onEdit}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <IconDots />
        </button>
      </div>
      {children}
    </section>
  )
}

type ItemRowProps = {
  item: Item
  done: boolean
  fading: boolean
  packedBy: string | null
  isNew: boolean
  trip: boolean
  me: PersonId
  people: Person[]
  listChecks: Check[]
  reorderMode: boolean
  mineOnly: boolean
  checksInteractive: boolean
  onEdit: () => void
}

function SortableItemRow({
  item,
  done,
  fading,
  packedBy,
  isNew,
  me,
  people,
  listChecks,
  reorderMode,
  mineOnly,
  checksInteractive,
  onEdit,
}: ItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: itemDragId(item.id),
    data: { type: 'item', itemId: item.id, sectionId: item.sectionId },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`row ${done ? 'done' : ''} ${fading ? 'fade-out' : ''} ${isDragging ? 'dragging' : ''}`}
      data-row={item.id}
    >
      {reorderMode ? (
        <button
          type="button"
          className="drag-handle"
          ref={setActivatorNodeRef}
          aria-label={`Drag ${item.text}`}
          {...attributes}
          {...listeners}
        >
          <IconGrip />
        </button>
      ) : null}
      <div
        className="row-main"
        ref={reorderMode ? undefined : setActivatorNodeRef}
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onEdit()
          }
        }}
        {...(reorderMode ? {} : { ...attributes, ...listeners })}
      >
        <span className="txt">{item.text}</span>
        <ItemMeta packedBy={packedBy} isNew={isNew} />
      </div>
      <div className={`checks ${reorderMode || !checksInteractive ? 'checks-muted' : ''}`}>
        <ItemChecks
          item={item}
          checks={listChecks}
          people={people}
          me={me}
          interactive={checksInteractive}
          mineOnly={mineOnly}
        />
      </div>
    </li>
  )
}
