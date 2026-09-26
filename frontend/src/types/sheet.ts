export type SheetScale = '1:5000' | '1:50000'
export type SheetStatus = '待编' | '已编' | '待核'

/** 四至登记方向，顺序即旧版邻接图号在 neighborCodes 数组中的位次 */
export const NEIGHBOR_DIRECTIONS = ['东', '南', '西', '北', '东北', '西南'] as const
export type NeighborDirection = (typeof NEIGHBOR_DIRECTIONS)[number]

/** 各方向的对向：甲的南邻即乙的北邻 */
export const OPPOSITE_DIRECTION: Record<NeighborDirection, NeighborDirection> = {
  东: '西',
  南: '北',
  西: '东',
  北: '南',
  东北: '西南',
  西南: '东北',
}

/** 按方向登记的邻接图号，只填写已登记的方向 */
export type NeighborMap = Partial<Record<NeighborDirection, string>>

export interface Sheet {
  id: string
  code: string
  title: string
  year: number
  scale: SheetScale
  projection: string
  sheetSizeCm: string
  series: string
  /** 旧版格式：按东、南、西、北、东北、西南顺序填写的邻接图号，仍照旧识别 */
  neighborCodes: string[]
  /** 新版格式：按方向分开登记的邻接图号，优先于 neighborCodes */
  neighborMap?: NeighborMap
  status: SheetStatus
}

export const SHEET_SCALES: SheetScale[] = ['1:5000', '1:50000']
export const SHEET_STATUSES: SheetStatus[] = ['待编', '已编', '待核']
