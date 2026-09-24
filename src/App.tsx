import { useEffect } from 'react'
import { Home } from './screens/Home'
import { ListScreen } from './screens/ListScreen'
import { SignIn } from './screens/SignIn'
import { Toast } from './components/Toast'
import { SheetProvider } from './sheets/SheetProvider'
import { initAuth, signOut } from './auth/authStore'
import { useAuth } from './auth/useAuth'
import { useMe } from './store/useMe'
import { useView } from './store/useNav'
import { useStoreStatus } from './store/useStoreStatus'
import { connectHousehold } from './store'

export default function App() {
  const auth = useAuth()
  const me = useMe()
  const view = useView()
  const storeStatus = useStoreStatus()

  useEffect(() => {
    initAuth()
  }, [])

  let screen = null
  if (!auth.ready) {
    screen = (
      <main className="wrap">
        <p className="note">Loading…</p>
      </main>
    )
  } else if (!auth.session) {
    screen = <SignIn />
  } else if (auth.profileError || !auth.profile || !me) {
    screen = (
      <main className="wrap" style={{ paddingTop: 48 }}>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Almost there</h2>
        <p className="note">
          {auth.profileError ??
            'Signed in, but this account is not linked to a household profile yet.'}
        </p>
        <p className="note">
          In Supabase, run the household seed SQL (see supabase/seed_household.sql) using
          each user’s Auth UUID.
        </p>
        <p className="dev-reset">
          <button type="button" className="linkish" onClick={() => void signOut()}>
            Sign out
          </button>
        </p>
      </main>
    )
  } else if (!storeStatus.ready) {
    screen = (
      <main className="wrap">
        <p className="note">Loading your lists…</p>
      </main>
    )
  } else if (storeStatus.error) {
    screen = (
      <main className="wrap" style={{ paddingTop: 48 }}>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800 }}>Couldn’t load lists</h2>
        <p className="note">{storeStatus.error}</p>
        <p className="dev-reset">
          <button
            type="button"
            className="linkish"
            onClick={() => {
              if (auth.profile) void connectHousehold(auth.profile.householdId)
            }}
          >
            Try again
          </button>
          {' · '}
          <button type="button" className="linkish" onClick={() => void signOut()}>
            Sign out
          </button>
        </p>
      </main>
    )
  } else if (view.name === 'list') {
    screen = <ListScreen listId={view.id} me={me} />
  } else {
    screen = <Home me={me} />
  }

  return (
    <SheetProvider>
      {screen}
      <Toast />
    </SheetProvider>
  )
}
