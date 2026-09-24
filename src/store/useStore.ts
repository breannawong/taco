import { useSyncExternalStore } from 'react'
import { getStore, subscribe } from './index'
import type { StoreData } from './types'

export function useStore(): StoreData {
  return useSyncExternalStore(subscribe, getStore, getStore)
}
