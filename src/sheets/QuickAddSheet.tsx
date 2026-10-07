import { QuickAdd } from '../components/QuickAdd'
import { useStore } from '../store/useStore'

type Props = {
  listId: string
  sectionId: string
}

/** Sheet wrapper: same quick-add input, locked to one section. */
export function QuickAddSheet({ listId, sectionId }: Props) {
  const data = useStore()
  const section = data.sections.find(
    (s) => s.id === sectionId && s.listId === listId,
  )

  return (
    <>
      <h3>Add to {section?.name ?? 'section'}</h3>
      <QuickAdd listId={listId} sectionId={sectionId} autoFocus />
    </>
  )
}
