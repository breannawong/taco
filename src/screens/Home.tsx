import { TacoLogo } from '../components/TacoLogo'
import { PackingAsButton } from '../components/PackingAsButton'
import { ProgressRows } from '../components/ProgressRows'
import { IconGo, IconPlus } from '../components/Icons'
import { progress, resetSampleData } from '../store'
import { useStore } from '../store/useStore'
import { openList } from '../store/nav'
import type { PersonId } from '../store'
import { useSheet } from '../sheets/SheetProvider'
import { StartPackSheet } from '../sheets/StartPackSheet'
import { NewTemplateSheet } from '../sheets/NewTemplateSheet'
import { toast } from '../toast'

type Props = {
  me: PersonId
}

export function Home({ me }: Props) {
  const data = useStore()
  const { openSheet } = useSheet()

  const trips = data.lists
    .filter((l) => l.kind === 'trip')
    .sort((a, b) => b.createdAt - a.createdAt)

  const templates = data.lists
    .filter((l) => l.kind === 'template')
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand">
            <TacoLogo />
            Taco
          </div>
          <PackingAsButton personId={me} />
        </div>
      </header>
      <main className="wrap">
        <h2 className="label">Packing now</h2>
        <div className="cards">
          {trips.length === 0 ? (
            <div className="empty">
              No trips yet. Start a pack from a template and everything begins unchecked.
            </div>
          ) : (
            trips.map((list) => {
              const st = progress(list.id, data.items, data.checks, data.people)
              const from = list.templateId
                ? data.lists.find((l) => l.id === list.templateId)?.name
                : undefined
              const packed = st.total > 0 && st.done === st.total
              const sub = packed
                ? 'All packed'
                : `${st.done} of ${st.total} items packed`
              return (
                <button
                  type="button"
                  className="card"
                  key={list.id}
                  onClick={() => openList(list.id)}
                >
                  <h3>{list.name}</h3>
                  <div className="sub tnum">
                    {sub}
                    {from ? ` · from ${from}` : ''}
                  </div>
                  <ProgressRows progress={st} people={data.people} />
                </button>
              )
            })
          )}
        </div>

        <h2 className="label">Templates</h2>
        {templates.length === 0 ? (
          <div className="empty">
            No templates yet. A template is your master list. Each trip starts as a fresh
            copy.
          </div>
        ) : (
          <div className="tlist">
            {templates.map((list) => {
              const itemCount = data.items.filter((i) => i.listId === list.id).length
              const sectionCount = data.sections.filter((s) => s.listId === list.id)
                .length
              return (
                <button
                  type="button"
                  className="trow"
                  key={list.id}
                  onClick={() => openList(list.id)}
                >
                  <div>
                    <h3>{list.name}</h3>
                    <div className="sub tnum">
                      {itemCount} items · {sectionCount} sections
                    </div>
                  </div>
                  <IconGo />
                </button>
              )
            })}
          </div>
        )}

        <div className="btns">
          <button
            type="button"
            className="btn btn-primary btn-wide"
            onClick={() => {
              if (templates.length === 0) {
                toast('Make a template first')
                return
              }
              openSheet(<StartPackSheet />)
            }}
          >
            <IconPlus />
            Start a pack
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openSheet(<NewTemplateSheet />)}
          >
            New template
          </button>
        </div>

        <p className="note">
          Templates never get checked off. Each trip is a fresh copy, so there's nothing to
          uncheck before you pack.
        </p>

        <p className="dev-reset">
          <button type="button" className="linkish" onClick={() => resetSampleData()}>
            Reset sample data
          </button>
        </p>
      </main>
    </>
  )
}
