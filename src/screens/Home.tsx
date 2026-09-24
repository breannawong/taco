import { TacoLogo } from '../components/TacoLogo'
import { progress, resetSampleData } from '../store'
import { useStore } from '../store/useStore'

export function Home() {
  const data = useStore()
  const templates = data.lists.filter((l) => l.kind === 'template')
  const trips = data.lists.filter((l) => l.kind === 'trip')
  const utah = trips.find((l) => l.id === 'utah26')
  const utahProgress = utah
    ? progress(utah.id, data.items, data.checks, data.people)
    : null

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand">
            <TacoLogo />
            Taco
          </div>
        </div>
      </header>
      <main className="wrap">
        <p className="note">
          Sample data is loaded and saved on this device.
          {templates[0] ? ` Template: ${templates[0].name}.` : null}
          {utah && utahProgress
            ? ` Trip: ${utah.name} (${utahProgress.done} of ${utahProgress.total} items packed).`
            : null}{' '}
          The full Home screen comes next.
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
