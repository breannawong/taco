import { useState } from 'react'
import { ConfirmButton } from '../components/ConfirmButton'
import {
  clearChecks,
  deleteList,
  renameList,
  resolveTemplateIdForTripSection,
  restoreTrip,
} from '../store'
import { useStore } from '../store/useStore'
import { goHome } from '../store/nav'
import { useSheet } from './SheetProvider'
import { StartPackSheet } from './StartPackSheet'
import { TravelersSheet } from './TravelersSheet'
import { UpdateTemplateSheet } from './UpdateTemplateSheet'
import { toast } from '../toast'

type Props = {
  listId: string
  onStartReorder: () => void
}

export function ListMenuSheet({ listId, onStartReorder }: Props) {
  const data = useStore()
  const { closeSheet, openSheet } = useSheet()
  const list = data.lists.find((l) => l.id === listId)
  const [name, setName] = useState(list?.name ?? '')

  if (!list) return null

  const trip = list.kind === 'trip'
  const archived = Boolean(list.archivedAt)
  const addedOnTrip = trip
    ? data.items.filter((i) => i.listId === listId && i.tripOnly)
    : []
  const canUpdateTemplates =
    trip &&
    !archived &&
    addedOnTrip.some((item) => {
      const sec = data.sections.find((s) => s.id === item.sectionId)
      return Boolean(
        resolveTemplateIdForTripSection(sec, data.sections, list.templateId),
      )
    })

  const saveName = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      closeSheet()
      return
    }
    const ok = await renameList(listId, trimmed)
    if (ok) closeSheet()
  }

  return (
    <>
      <h3>{list.name}</h3>
      <form
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault()
          void saveName()
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
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void saveName()}
        >
          Save name
        </button>
        {archived && trip ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              const ok = await restoreTrip(listId)
              if (!ok) return
              closeSheet()
              toast(`Restored ${list.name}`)
            }}
          >
            Restore trip
          </button>
        ) : null}
        {!archived ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              closeSheet()
              onStartReorder()
            }}
          >
            Reorder
          </button>
        ) : null}
        {!trip ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openSheet(<StartPackSheet templateId={listId} />)}
          >
            Start a pack from this template
          </button>
        ) : null}
        {trip && !archived ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openSheet(<TravelersSheet listId={listId} />)}
          >
            Who’s going…
          </button>
        ) : null}
        {trip && !archived ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              openSheet(<UpdateTemplateSheet listId={listId} mode="finish" />)
            }
          >
            Finish trip
          </button>
        ) : null}
        {trip && !archived && canUpdateTemplates ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openSheet(<UpdateTemplateSheet listId={listId} />)}
          >
            Update template…
          </button>
        ) : null}
        {trip && !archived ? (
          <ConfirmButton
            className="btn btn-ghost"
            confirmLabel="Tap again to uncheck all"
            onConfirm={async () => {
              const ok = await clearChecks(listId)
              if (!ok) return
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
          onConfirm={async () => {
            const label = list.name
            const ok = await deleteList(listId)
            if (!ok) return
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
