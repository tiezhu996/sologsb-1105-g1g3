export type SheetScale = '1:5000' | '1:50000'
export type SheetStatus = '待编' | '已编' | '待核'

/** 四至八到中本系统登记的六个邻接方向。 */
export const NEIGHBOR_DIRECTIONS = ['东', '南', '西', '北', '东北', '西南'] as const
export type NeighborDirection = (typeof NEIGHBOR_DIRECTIONS)[number]

/** 分方向登记的邻接图号：键为方向，值为该方向相邻图幅的图号。 */
export type NeighborMap = Partial<Record<NeighborDirection, string>>

/** 相反方向对照：登记甲在某方向的邻图时，邻图的反向自动补登。 */
export const OPPOSITE_DIRECTION: Record<NeighborDirection, NeighborDirection> = {
  东: '西',
  南: '北',
  西: '东',
  北: '南',
  东北: '西南',
  西南: '东北',
}

export interface Sheet {
  id: string
  code: string
  title: string
  year: number
  scale: SheetScale
  projection: string
  sheetSizeCm: string
  series: string
  /** 旧制：按东、南、西、北、东北、西南顺序填存的邻接图号，仍需照旧认出。 */
  neighborCodes: string[]
  /** 新制：分方向登记的邻接图号；旧记录缺该字段时回退按 neighborCodes 顺序解析。 */
  neighbors?: NeighborMap
  status: SheetStatus
}

export const SHEET_SCALES: SheetScale[] = ['1:5000', '1:50000']
export const SHEET_STATUSES: SheetStatus[] = ['待编', '已编', '待核']
