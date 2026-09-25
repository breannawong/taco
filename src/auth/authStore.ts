import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { connectHousehold, disconnectHousehold } from '../store'
import { clearMe, setMe } from '../store/session'
import type { PersonId } from '../store/types'

export type Profile = {
  id: string
  householdId: string
  personKey: PersonId
  displayName: string
  initial: string
  color: string
}

type Listener = () => void

type AuthState = {
  ready: boolean
  session: Session | null
  profile: Profile | null
  profileError: string | null
}

let state: AuthState = {
  ready: false,
  session: null,
  profile: null,
  profileError: null,
}

const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch }
  emit()
}

export function getAuthState(): AuthState {
  return state
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function applyProfile(profile: Profile | null, profileError: string | null) {
  if (profile) setMe(profile.personKey)
  else clearMe()
  setState({ profile, profileError })
}

async function loadProfile(user: User): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, household_id, person_key, display_name, initial, color')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    disconnectHousehold()
    applyProfile(null, error.message)
    return
  }

  if (!data) {
    disconnectHousehold()
    applyProfile(
      null,
      'This account is not linked to the household yet. Ask Breanna to add your profile in Supabase.',
    )
    return
  }

  const profile: Profile = {
    id: data.id,
    householdId: data.household_id,
    personKey: data.person_key,
    displayName: data.display_name,
    initial: data.initial,
    color: data.color,
  }
  applyProfile(profile, null)
  await connectHousehold(profile.householdId)
}

/** Apply session from Supabase; load profile when signed in. */
export async function applySession(session: Session | null): Promise<void> {
  if (!session?.user) {
    disconnectHousehold()
    applyProfile(null, null)
    setState({
      ready: true,
      session: null,
    })
    return
  }

  setState({ ready: true, session })
  await loadProfile(session.user)
}

let initStarted = false

/** Call once at app start. */
export function initAuth(): void {
  if (initStarted) return
  initStarted = true

  if (!supabaseConfigured) {
    setState({ ready: true, session: null, profile: null, profileError: null })
    return
  }

  void supabase.auth.getSession().then(({ data }) => applySession(data.session))

  supabase.auth.onAuthStateChange((_event, session) => {
    void applySession(session)
  })
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  return { error: null }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
