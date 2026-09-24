import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
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
  setItemOrderInSection,
  setSectionOrder,
  whoLabel,
  type Check,
  type Item,
  type Person,
  type PersonId,
  type Section,
} from '../store'
import { isCollapsed, toggleCollapsed } from '../store/nav'

type Props = {
  listId: string
  me: PersonId
  trip: boolean
  canDrag: boolean
  showAddRow: boolean
  sections: Section[]
  /** Items to show (already filtered by the parent). */
  visibleItems: Item[]
  /** All items on the list (for section done/total counts). */
  allListItems: Item[]
  listChecks: Check[]
  people: Person[]
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

export function SortablePackingList({
  listId,
  me,
  trip,
  canDrag,
  showAddRow,
  sections,
  visibleItems,
  allListItems,
  listChecks,
  people,
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

  const sensors = useSensors(
    // Pointer covers mouse + touch. Distance (not delay) so the page
    // doesn't rubber-band-scroll while waiting to start a drag.
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
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
    for (const [secId, ordered] of Object.entries(map)) {
      setItemOrderInSection(secId, ordered)
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
      setItemOrderInSection(container, next)
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
          const done = trip && isDone(item, listChecks, people)
          const packers =
            trip && item.who === 'shared' && done
              ? people.filter((p) =>
                  listChecks.some(
                    (c) => c.itemId === item.id && c.personId === p.id,
                  ),
                )
              : []
          const by =
            packers.length > 0
              ? ` · packed by ${packers.map((p) => p.name).join(' & ')}`
              : ''

          if (withDrag) {
            return (
              <SortableItemRow
                key={item.id}
                item={item}
                done={!!done}
                by={by}
                trip={trip}
                me={me}
                people={people}
                listChecks={listChecks}
                onEdit={() => onEditItem(item.id)}
              />
            )
          }

          return (
            <li
              key={item.id}
              className={`row ${done ? 'done' : ''}`}
              data-row={item.id}
            >
              <button
                type="button"
                className="row-main"
                onClick={() => onEditItem(item.id)}
              >
                <span className="txt">{item.text}</span>
                <span className="meta">
                  {whoLabel(item, people)}
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
                  people={people}
                  me={me}
                  interactive={trip}
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
  onToggle: () => void
  onEdit: () => void
  children: ReactNode
}

function SortableSection({
  section,
  closed,
  countLabel,
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
      <div className="sec-h">
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
        <button
          type="button"
          className="sec-toggle"
          aria-expanded={!closed}
          onClick={onToggle}
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
  by: string
  trip: boolean
  me: PersonId
  people: Person[]
  listChecks: Check[]
  onEdit: () => void
}

function SortableItemRow({
  item,
  done,
  by,
  trip,
  me,
  people,
  listChecks,
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
      className={`row ${done ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}
      data-row={item.id}
    >
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
      <button type="button" className="row-main" onClick={onEdit}>
        <span className="txt">{item.text}</span>
        <span className="meta">
          {whoLabel(item, people)}
          {by}
          {trip && item.tripOnly ? <span className="tag">This trip</span> : null}
        </span>
      </button>
      <div className="checks">
        <ItemChecks
          item={item}
          checks={listChecks}
          people={people}
          me={me}
          interactive={trip}
        />
      </div>
    </li>
  )
}
