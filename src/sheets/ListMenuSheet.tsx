import { useState } from 'react'
import { ConfirmButton } from '../components/ConfirmButton'
import {
  clearChecks,
  deleteList,
  promoteItems,
  renameList,
} from '../store'
import { useStore } from '../store/useStore'
import { goHome } from '../store/nav'
import { useSheet } from './SheetProvider'
import { StartPackSheet } from './StartPackSheet'
import { toast } from '../toast'

type Props = {
  listId: string
}

export function ListMenuSheet({ listId }: Props) {
  const data = useStore()
  const { closeSheet, openSheet } = useSheet()
  const list = data.lists.find((l) => l.id === listId)
  const [name, setName] = useState(list?.name ?? '')

  if (!list) return null

  const trip = list.kind === 'trip'
  const template =
    trip && list.templateId
      ? data.lists.find((l) => l.id === list.templateId)
      : undefined
  const tripOnlyIds = trip
    ? data.items
        .filter((i) => i.listId === listId && i.tripOnly)
        .map((i) => i.id)
    : []

  const saveName = () => {
    const trimmed = name.trim()
    if (trimmed) renameList(listId, trimmed)
    closeSheet()
  }

  return (
    <>
      <h3>{list.name}</h3>
      <form
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault()
          saveName()
        }}
      >
        <div className="field">
          <label htmlFor="f-ren">Rename</label>
          <input
            className="in"
            id="f-ren"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </form>
      <div className="menu-list">
        <button type="button" className="btn btn-primary" onClick={saveName}>
          Save name
        </button>
        {!trip ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openSheet(<StartPackSheet templateId={listId} />)}
          >
            Start a pack from this template
          </button>
        ) : null}
        {trip && template && tripOnlyIds.length > 0 ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const tplName = promoteItems(listId, tripOnlyIds)
              closeSheet()
              if (tplName) {
                toast(
                  `Added ${
                    tripOnlyIds.length === 1
                      ? '1 item'
                      : `${tripOnlyIds.length} items`
                  } to ${tplName}`,
                )
              }
            }}
          >
            Add {tripOnlyIds.length} trip-only item
            {tripOnlyIds.length > 1 ? 's' : ''} to {template.name}
          </button>
        ) : null}
        {trip ? (
          <ConfirmButton
            className="btn btn-ghost"
            confirmLabel="Tap again to uncheck all"
            onConfirm={() => {
              clearChecks(listId)
              closeSheet()
              toast('Unchecked everything')
            }}
          >
            Uncheck everything on this trip
          </ConfirmButton>
        ) : null}
        <ConfirmButton
          className="btn btn-danger"
          confirmLabel={`Tap again to delete ${trip ? 'this trip' : 'this template'}`}
          onConfirm={() => {
            const label = list.name
            deleteList(listId)
            closeSheet()
            goHome()
            toast(`Deleted ${label}`)
          }}
        >
          Delete {trip ? 'trip' : 'template'}
        </ConfirmButton>
      </div>
    </>
  )
}
