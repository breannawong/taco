import { useSyncExternalStore } from 'react'
import {
  getCollapsed,
  getFilter,
  getView,
  subscribeNav,
  type FilterId,
  type View,
} from './nav'

export function useView(): View {
  return useSyncExternalStore(subscribeNav, getView, getView)
}

export function useFilter(): FilterId {
  return useSyncExternalStore(subscribeNav, getFilter, getFilter)
}

/** Snapshot string so collapse toggles always re-render. */
export function useCollapsedSnapshot(): string {
  return useSyncExternalStore(
    subscribeNav,
    () => [...getCollapsed()].sort().join('|'),
    () => [...getCollapsed()].sort().join('|'),
  )
}
