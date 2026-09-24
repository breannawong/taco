import { useSyncExternalStore } from 'react'
import { getAuthState, subscribeAuth, type Profile } from './authStore'
import type { Session } from '@supabase/supabase-js'

export function useAuth(): {
  ready: boolean
  session: Session | null
  profile: Profile | null
  profileError: string | null
} {
  return useSyncExternalStore(subscribeAuth, getAuthState, getAuthState)
}
