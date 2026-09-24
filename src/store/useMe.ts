import { useSyncExternalStore } from 'react'
import { getMe, subscribeMe } from './session'
import type { PersonId } from './types'

export function useMe(): PersonId | null {
  return useSyncExternalStore(subscribeMe, getMe, getMe)
}
