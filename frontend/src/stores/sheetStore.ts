import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ScanItem } from '../types/scan'
import type { NeighborDirection, NeighborMap, Sheet } from '../types/sheet'
import { createId, db, plain } from '../utils/db'
import { sortByYear } from '../utils/scale'
import {
  reciprocalOf,
  recordedNeighborAt,
  type NeighborRegistration,
} from '../utils/neighbors'

export type NewSheet = Omit<Sheet, 'id' | 'neighborCodes' | 'neighborMap'> & {
  neighborCodes?: string[]
  neighborMap?: NeighborMap
}
export type NewScanItem = Omit<ScanItem, 'id'>

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

  async function addSheet(input: NewSheet): Promise<Sheet> {
    await init()
    const sheet: Sheet = {
      ...input,
      id: createId('sheet'),
      neighborCodes: input.neighborCodes ?? [],
    }
    await db.sheets.add(plain(sheet))
    sheets.value = sortByYear([...sheets.value, sheet]).reverse()
    currentSheet.value = sheet
    return sheet
  }

  async function persistNeighborMap(sheetId: string, neighborMap: NeighborMap): Promise<void> {
    await db.sheets.update(sheetId, { neighborMap: plain(neighborMap) })
    sheets.value = sheets.value.map((sheet) =>
      sheet.id === sheetId ? { ...sheet, neighborMap } : sheet,
    )
    if (currentSheet.value?.id === sheetId) {
      currentSheet.value = { ...currentSheet.value, neighborMap }
    }
  }

  /**
   * 按方向登记邻接图号：本幅该方向按整理员的显式填写记录，
   * 同时在对家图幅的相反方向自动补登本幅；对家该方向若已写着
   * 别的图号，则不覆盖、保留原记录并返回 conflict 提示核对。
   */
  async function registerNeighbor(
    sheetId: string,
    direction: NeighborDirection,
    rawCode: string,
  ): Promise<NeighborRegistration | null> {
    await init()
    const code = rawCode.trim()
    const source = getSheetById(sheetId)
    if (!source || !code || code === source.code) {
      return null
    }
    const reciprocalDirection = reciprocalOf(direction)

    const sourceMap: NeighborMap = { ...(source.neighborMap ?? {}), [direction]: code }
    await persistNeighborMap(source.id, sourceMap)

    const target = getSheetByCode(code)
    if (!target) {
      return { direction, code, reciprocalDirection, outcome: 'missing' }
    }

    const existing = recordedNeighborAt(target, reciprocalDirection)
    if (!existing) {
      const targetMap: NeighborMap = {
        ...(target.neighborMap ?? {}),
        [reciprocalDirection]: source.code,
      }
      await persistNeighborMap(target.id, targetMap)
      return { direction, code, reciprocalDirection, outcome: 'linked' }
    }
    if (existing === source.code) {
      return { direction, code, reciprocalDirection, outcome: 'already-linked' }
    }
    return { direction, code, reciprocalDirection, outcome: 'conflict', keptCode: existing }
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
    registerNeighbor,
    loadSheet,
    addScan,
    setPrimaryScan,
    getSheetById,
    getSheetByCode,
    getScansForSheet,
  }
})
