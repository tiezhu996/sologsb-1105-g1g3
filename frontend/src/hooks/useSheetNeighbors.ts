import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { Sheet } from '../types/sheet'
import { NEIGHBOR_DIRECTIONS, OPPOSITE_DIRECTION, type NeighborDirection } from '../types/sheet'
import { getNeighborMap } from '../utils/neighbors'
import { useSheetStore } from '../stores/sheetStore'

export { NEIGHBOR_DIRECTIONS }
export type { NeighborDirection } from '../types/sheet'

export interface NeighborEntry {
  code: string
  direction: NeighborDirection
  sheet?: Sheet
  /** 对侧图幅在相反方向已登记了别的图号，与本记录对不上。 */
  mismatched?: boolean
  /** 对侧图幅相反方向当前已登记的图号，用于提示核对。 */
  oppositeCode?: string
}

export interface NeighborMismatch {
  /** 发起登记的图幅。 */
  source: Sheet
  direction: NeighborDirection
  /** 本侧登记的邻接图号。 */
  neighborCode: string
  /** 邻接图幅（若馆藏中存在）。 */
  neighborSheet?: Sheet
  /** 邻接图幅相反方向上原已登记的图号。 */
  existingCode: string
}

export interface NeighborStatus {
  source?: Sheet
  entries: NeighborEntry[]
  missingCodes: string[]
  mismatches: NeighborMismatch[]
  adjacentCount: number
}

export function useSheetNeighbors(sheetId: MaybeRefOrGetter<string>) {
  const sheetStore = useSheetStore()

  function getNeighborStatus(id: string): NeighborStatus {
    const source = sheetStore.getSheetById(id)
    const neighborMap = getNeighborMap(source)

    const mismatches: NeighborMismatch[] = []
    const entries: NeighborEntry[] = NEIGHBOR_DIRECTIONS.filter(
      (direction) => !!neighborMap[direction],
    ).map((direction) => {
      const code = neighborMap[direction] as string
      const sheet = sheetStore.getSheetByCode(code)
      const opposite = OPPOSITE_DIRECTION[direction]
      const oppositeCode = sheet ? getNeighborMap(sheet)[opposite] : undefined
      // 对侧相反方向已写着别的图号：对不上，保留原记录并提示。
      const mismatched = !!oppositeCode && oppositeCode !== source?.code
      if (mismatched && source) {
        mismatches.push({
          source,
          direction,
          neighborCode: code,
          ...(sheet ? { neighborSheet: sheet } : {}),
          existingCode: oppositeCode as string,
        })
      }
      return {
        code,
        direction,
        ...(sheet ? { sheet } : {}),
        ...(mismatched ? { mismatched: true, oppositeCode } : {}),
      }
    })

    const missingCodes = entries.filter((entry) => !entry.sheet).map((entry) => entry.code)

    return {
      ...(source ? { source } : {}),
      entries,
      missingCodes,
      mismatches,
      adjacentCount: entries.length,
    }
  }

  const status = computed(() => getNeighborStatus(toValue(sheetId)))

  return {
    status,
    getNeighborStatus,
  }
}
