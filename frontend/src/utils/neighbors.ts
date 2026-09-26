import {
  NEIGHBOR_DIRECTIONS,
  type NeighborDirection,
  type NeighborMap,
} from '../types/sheet'
import type { Sheet } from '../types/sheet'

/** 方向是否为本系统登记的六个方向之一。 */
export function isNeighborDirection(value: string): value is NeighborDirection {
  return (NEIGHBOR_DIRECTIONS as readonly string[]).includes(value)
}

/**
 * 把任意来源的方向输入整理为邻接图号映射：
 * 去除空白，丢弃空值与自身图号。
 */
export function normalizeNeighborMap(
  input: Partial<Record<NeighborDirection, string>> | null | undefined,
  selfCode?: string,
): NeighborMap {
  const result: NeighborMap = {}
  if (!input) {
    return result
  }
  for (const direction of NEIGHBOR_DIRECTIONS) {
    const code = input[direction]?.trim()
    if (code && code !== selfCode) {
      result[direction] = code
    }
  }
  return result
}

/**
 * 读取图幅分方向邻接关系。
 * 新制 neighbors 字段优先；旧制 neighborCodes 仍按
 * 东、南、西、北、东北、西南的固定顺序照旧认出。
 */
export function getNeighborMap(sheet: Pick<Sheet, 'neighbors' | 'neighborCodes'> | undefined): NeighborMap {
  if (!sheet) {
    return {}
  }
  if (sheet.neighbors && Object.values(sheet.neighbors).some((code) => !!code)) {
    return normalizeNeighborMap(sheet.neighbors)
  }
  const legacy: NeighborMap = {}
  sheet.neighborCodes.forEach((code, index) => {
    const direction = NEIGHBOR_DIRECTIONS[index]
    const trimmed = code?.trim()
    if (direction && trimmed) {
      legacy[direction] = trimmed
    }
  })
  return legacy
}

/** 把分方向邻接关系按固定顺序还原为旧制图号数组，保持两套数据同步。 */
export function toLegacyCodes(neighbors: NeighborMap): string[] {
  return NEIGHBOR_DIRECTIONS.map((direction) => neighbors[direction]).filter(
    (code): code is string => !!code,
  )
}
