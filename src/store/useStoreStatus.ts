import { useSyncExternalStore } from 'react'
import { getStoreStatus, subscribe } from './index'

/** True once household lists have finished loading from Supabase. */
export function useStoreStatus() {
  return useSyncExternalStore(subscribe, getStoreStatus, getStoreStatus)
}
