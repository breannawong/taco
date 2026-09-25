import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Check } from './types'

type CheckRow = {
  household_id?: string
  list_id?: string
  item_id?: string
  person_id?: string
  checked_by?: string | null
  checked_at?: string
}

type CheckHandlers = {
  onInsert: (check: Check) => void
  onDelete: (itemId: string, personId: string) => void
}

function rowToCheck(row: CheckRow): Check | null {
  if (!row.list_id || !row.item_id || !row.person_id) return null
  return {
    listId: row.list_id,
    itemId: row.item_id,
    personId: row.person_id,
    checkedAt: row.checked_at ? new Date(row.checked_at).getTime() : Date.now(),
    ...(row.checked_by ? { checkedBy: row.checked_by } : {}),
  }
}

let channel: RealtimeChannel | null = null

/** Stop listening for live check changes. */
export function stopChecksRealtime(): void {
  if (!channel) return
  void supabase.removeChannel(channel)
  channel = null
}

/**
 * Subscribe to insert/delete on public.checks for one household.
 * Idempotent: replaces any existing subscription.
 */
export function startChecksRealtime(
  householdId: string,
  handlers: CheckHandlers,
): void {
  stopChecksRealtime()

  channel = supabase
    .channel(`checks:${householdId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'checks',
        filter: `household_id=eq.${householdId}`,
      },
      (payload: RealtimePostgresChangesPayload<CheckRow>) => {
        const check = rowToCheck(payload.new as CheckRow)
        if (check) handlers.onInsert(check)
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'checks',
        filter: `household_id=eq.${householdId}`,
      },
      (payload: RealtimePostgresChangesPayload<CheckRow>) => {
        const old = payload.old as CheckRow
        if (old.item_id && old.person_id) {
          handlers.onDelete(old.item_id, old.person_id)
        }
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('Taco realtime: checks channel error')
      }
    })
}
