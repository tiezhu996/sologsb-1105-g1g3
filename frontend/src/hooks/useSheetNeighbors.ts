import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { Sheet } from '../types/sheet'
import { NEIGHBOR_DIRECTIONS, type NeighborDirection } from '../types/sheet'
import { resolveNeighborMap } from '../utils/neighbors'
import { useSheetStore } from '../stores/sheetStore'

export { NEIGHBOR_DIRECTIONS, type NeighborDirection }

export interface NeighborEntry {
  code: string
  direction: NeighborDirection
  sheet?: Sheet
}

export interface NeighborStatus {
  source?: Sheet
  entries: NeighborEntry[]
  missingCodes: string[]
  adjacentCount: number
}

export function useSheetNeighbors(sheetId: MaybeRefOrGetter<string>) {
  const sheetStore = useSheetStore()

  function getNeighborStatus(id: string): NeighborStatus {
    const source = sheetStore.getSheetById(id)
    const resolved = source ? resolveNeighborMap(source) : {}
    const entries = NEIGHBOR_DIRECTIONS.flatMap((direction) => {
      const code = resolved[direction]
      if (!code) {
        return []
      }
      const sheet = sheetStore.getSheetByCode(code)
      return [{ code, direction, ...(sheet ? { sheet } : {}) }]
    })
    const missingCodes = entries.filter((entry) => !entry.sheet).map((entry) => entry.code)

    return {
      ...(source ? { source } : {}),
      entries,
      missingCodes,
      adjacentCount: entries.length,
    }
  }

  const status = computed(() => getNeighborStatus(toValue(sheetId)))

  return {
    status,
    getNeighborStatus,
  }
}
