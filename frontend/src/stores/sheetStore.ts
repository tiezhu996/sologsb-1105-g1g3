import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ScanItem } from '../types/scan'
import type { NeighborDirection, NeighborMap, Sheet } from '../types/sheet'
import { OPPOSITE_DIRECTION } from '../types/sheet'
import { createId, db, plain } from '../utils/db'
import { sortByYear } from '../utils/scale'
import { getNeighborMap, normalizeNeighborMap, toLegacyCodes } from '../utils/neighbors'

export type NewSheet = Omit<Sheet, 'id' | 'neighborCodes' | 'neighbors'> & {
  /** 旧制顺序图号，保留兼容入口。 */
  neighborCodes?: string[]
  /** 新制分方向登记。 */
  neighbors?: Partial<Record<NeighborDirection, string>>
}
export type NewScanItem = Omit<ScanItem, 'id'>

/** 反向补登时对侧相反方向已写着别的图号，未被覆盖的冲突。 */
export interface NeighborConflict {
  direction: NeighborDirection
  /** 本次登记的邻接图号。 */
  neighborCode: string
  oppositeDirection: NeighborDirection
  /** 对侧图幅原已登记的图号（原样保留）。 */
  existingCode: string
  /** 对侧图幅在馆藏中缺失时仅有图号。 */
  targetExists: boolean
}

export interface AddSheetResult {
  sheet: Sheet
  conflicts: NeighborConflict[]
  missingCodes: string[]
}

export const useSheetStore = defineStore('sheet', () => {
  const sheets = ref<Sheet[]>([])
  const allScans = ref<ScanItem[]>([])
  const currentSheet = ref<Sheet | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  let initialization: Promise<void> | null = null

  const currentScans = computed(() =>
    currentSheet.value
      ? allScans.value.filter((scan) => scan.sheetId === currentSheet.value?.id)
      : [],
  )

  async function init(): Promise<void> {
    if (initialized.value) {
      return
    }
    if (!initialization) {
      loading.value = true
      initialization = Promise.all([db.sheets.toArray(), db.scans.toArray()])
        .then(([sheetRows, scanRows]) => {
          sheets.value = sortByYear(sheetRows).reverse()
          allScans.value = scanRows
          initialized.value = true
        })
        .finally(() => {
          loading.value = false
        })
    }
    await initialization
  }

  async function addSheet(input: NewSheet): Promise<AddSheetResult> {
    await init()
    const code = input.code.trim()
    const ownNeighbors = normalizeNeighborMap(input.neighbors, code)
    const sheet: Sheet = {
      ...input,
      code,
      id: createId('sheet'),
      neighbors: ownNeighbors,
      neighborCodes: toLegacyCodes(ownNeighbors),
    }
    await db.sheets.add(plain(sheet))
    sheets.value = sortByYear([...sheets.value, sheet]).reverse()
    currentSheet.value = sheet

    const conflicts: NeighborConflict[] = []
    const missingCodes = new Set<string>()

    // 四至相接：逐方向为对侧图幅补登反向邻接关系。
    for (const [direction, neighborCode] of Object.entries(ownNeighbors) as [
      NeighborDirection,
      string,
    ][]) {
      const target = sheets.value.find((item) => item.code === neighborCode)
      if (!target) {
        // 对侧图幅尚未建卡：无法反向补登，仍按缺编图号提示。
        missingCodes.add(neighborCode)
        continue
      }

      const oppositeDirection = OPPOSITE_DIRECTION[direction]
      const targetNeighbors = getNeighborMap(target)
      const existingCode = targetNeighbors[oppositeDirection]

      if (existingCode && existingCode !== code) {
        // 对侧已写着别的图号：不覆盖，留下原来的记录并提示对不上。
        conflicts.push({
          direction,
          neighborCode,
          oppositeDirection,
          existingCode,
          targetExists: true,
        })
        continue
      }
      if (existingCode === code) {
        continue
      }

      const mergedNeighbors: NeighborMap = { ...targetNeighbors, [oppositeDirection]: code }
      const updated: Sheet = {
        ...target,
        neighbors: mergedNeighbors,
        neighborCodes: toLegacyCodes(mergedNeighbors),
      }
      await db.sheets.put(plain(updated))
      sheets.value = sheets.value.map((item) => (item.id === target.id ? updated : item))
      if (currentSheet.value?.id === target.id) {
        currentSheet.value = updated
      }
    }

    return { sheet, conflicts, missingCodes: [...missingCodes] }
  }

  async function loadSheet(id: string): Promise<void> {
    await init()
    currentSheet.value = sheets.value.find((sheet) => sheet.id === id) ?? (await db.sheets.get(id)) ?? null
  }

  async function addScan(input: NewScanItem): Promise<ScanItem> {
    await init()
    const scan: ScanItem = { ...input, id: createId('scan') }
    if (scan.isPrimary) {
      await db.scans.where('sheetId').equals(scan.sheetId).modify({ isPrimary: false })
      allScans.value = allScans.value.map((item) =>
        item.sheetId === scan.sheetId ? { ...item, isPrimary: false } : item,
      )
    }
    await db.scans.add(plain(scan))
    allScans.value = [...allScans.value, scan]
    return scan
  }

  async function setPrimaryScan(scanId: string): Promise<void> {
    const target = allScans.value.find((scan) => scan.id === scanId)
    if (!target) {
      return
    }
    await db.scans.where('sheetId').equals(target.sheetId).modify({ isPrimary: false })
    await db.scans.update(scanId, { isPrimary: true })
    allScans.value = allScans.value.map((scan) => {
      if (scan.sheetId !== target.sheetId) {
        return scan
      }
      return { ...scan, isPrimary: scan.id === scanId }
    })
  }

  function getSheetById(id: string): Sheet | undefined {
    return sheets.value.find((sheet) => sheet.id === id)
  }

  function getSheetByCode(code: string): Sheet | undefined {
    return sheets.value.find((sheet) => sheet.code === code)
  }

  function getScansForSheet(sheetId: string): ScanItem[] {
    return allScans.value
      .filter((scan) => scan.sheetId === sheetId)
      .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
  }

  return {
    sheets,
    allScans,
    currentSheet,
    currentScans,
    loading,
    initialized,
    init,
    addSheet,
    loadSheet,
    addScan,
    setPrimaryScan,
    getSheetById,
    getSheetByCode,
    getScansForSheet,
  }
})
