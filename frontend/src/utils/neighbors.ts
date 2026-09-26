import {
  NEIGHBOR_DIRECTIONS,
  OPPOSITE_DIRECTION,
  type NeighborDirection,
  type NeighborMap,
  type Sheet,
} from '../types/sheet'

/**
 * 展示用的邻接解析：新版 neighborMap 按方向直接采用；
 * 旧版 neighborCodes 仍按「东、南、西、北、东北、西南」的原顺序认出，
 * 若原方位已被新版记录占用，则顺次放入下一个空位，保证旧记录不丢失。
 */
export function resolveNeighborMap(sheet: Sheet): NeighborMap {
  const resolved: NeighborMap = { ...(sheet.neighborMap ?? {}) }
  const placed = new Set(Object.values(resolved).filter(Boolean) as string[])

  sheet.neighborCodes.forEach((code, index) => {
    if (!code || placed.has(code)) {
      return
    }
    const natural = NEIGHBOR_DIRECTIONS[index]
    const target =
      natural && !resolved[natural]
        ? natural
        : NEIGHBOR_DIRECTIONS.find((direction) => !resolved[direction])
    if (target) {
      resolved[target] = code
      placed.add(code)
    }
  })

  return resolved
}

/**
 * 档案原貌查询：该方向上已明确登记的图号。
 * 先查新版 neighborMap，再查旧版 neighborCodes 中该方向的原位（不做位移），
 * 用于互登时判断对家是否早已写着别的图号。
 */
export function recordedNeighborAt(
  sheet: Sheet,
  direction: NeighborDirection,
): string | undefined {
  const explicit = sheet.neighborMap?.[direction]
  if (explicit) {
    return explicit
  }
  const index = NEIGHBOR_DIRECTIONS.indexOf(direction)
  return sheet.neighborCodes[index] || undefined
}

/**
 * 按方向登记一次邻接关系后的结果：
 * - linked：本幅已登记，并在对家反向自动补登
 * - already-linked：对家该方向此前已互登本幅，无需重复补登
 * - conflict：对家该方向已写着别的图号，未覆盖，原记录保留
 * - missing：对家图号尚未建卡（缺编），本幅先登记，补卡后再核对
 */
export interface NeighborRegistration {
  direction: NeighborDirection
  code: string
  reciprocalDirection: NeighborDirection
  outcome: 'linked' | 'already-linked' | 'conflict' | 'missing'
  /** outcome 为 conflict 时，对家该方向保留的原图号 */
  keptCode?: string
}

export function reciprocalOf(direction: NeighborDirection): NeighborDirection {
  return OPPOSITE_DIRECTION[direction]
}

/** 把登记结果整理成给整理员看的中文提示。 */
export function describeRegistration(result: NeighborRegistration): string {
  const { direction, code, reciprocalDirection } = result
  switch (result.outcome) {
    case 'linked':
      return `${direction}邻 ${code} 已登记，${code} 的${reciprocalDirection}邻已自动补登本幅。`
    case 'already-linked':
      return `${direction}邻 ${code} 已登记，${code} 的${reciprocalDirection}邻此前已互登本幅，无需重复补登。`
    case 'conflict':
      return (
        `${direction}邻 ${code} 已登记；但 ${code} 的${reciprocalDirection}邻原已登记为 ` +
        `${result.keptCode}，与本次登记对不上，未覆盖原记录，请人工核对。`
      )
    case 'missing':
      return (
        `${direction}邻 ${code} 已登记；${code} 尚未建卡（缺编），已列入缺编提示，` +
        `补卡后再核对${reciprocalDirection}邻互登。`
      )
  }
}
