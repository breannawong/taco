import { TacoLogo } from '../components/TacoLogo'

export function Home() {
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
          Your packing lists will show up here. Next up: sample data and the real Home screen.
        </p>
      </main>
    </>
  )
}
