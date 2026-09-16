/**
 * Installation domain: saved layouts, lane groups, neighbour-derived lanes,
 * clear-width helpers, and schema migration from corridor v1 saves.
 */
import { CATALOG, type UnitType, type WingId } from './catalog'
import { enabledManufacturers, modelsForManufacturer, type ManufacturerId, type ModelId } from './products'

export const SCHEMA_VERSION = 2
export const GROUP_SPACING_M = 3.4
export const DEFAULT_CLEAR_MM = 600

export type LaneDirection = 'in' | 'out' | 'both'
export type WidthAnchor = 'left' | 'right' | 'both'

export interface LaneGroup {
  id: string
  name: string
  originX: number
  originZ: number
  rotationY: number
  defaultClearMm: number
  direction: LaneDirection
}

export interface LaneGroupRecipe {
  manufacturerId: ManufacturerId
  /** Primary cabinet used for middle units when available. */
  modelId: ModelId
  laneCount: number
  standardClearMm: number
  accessibleLanes?: { index: number; clearMm: number }[]
}

export interface WingRef {
  unitId: string
  wing: WingId
}

export interface NeighbourPassage {
  groupId: string
  leftUnitId: string
  rightUnitId: string
  members: WingRef[]
}

export interface MigratedUnit {
  id: string
  type: UnitType
  groupId: string
  flipped?: boolean
  led?: unknown
  finish?: string | null
  glass?: string | null
}

export interface MigratedDoc {
  schemaVersion: number
  name: string
  laneGroups: LaneGroup[]
  activeGroupId: string | null
  units: MigratedUnit[]
  lanes: Array<Record<string, unknown> & { id: string; members: WingRef[]; groupId?: string }>
  gaps: Record<string, number>
  led: unknown
  finish: string
  glass: string
}

export function nextGroupName(existing: LaneGroup[]): string {
  const used = new Set(existing.map((g) => g.name))
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const ch of letters) {
    const name = `Lane Group ${ch}`
    if (!used.has(name)) return name
  }
  return `Lane Group ${existing.length + 1}`
}

export function makeLaneGroup(
  id: string,
  name: string,
  index: number,
  extras?: Partial<LaneGroup>,
): LaneGroup {
  return {
    id,
    name,
    originX: 0,
    originZ: index * GROUP_SPACING_M,
    rotationY: 0,
    defaultClearMm: DEFAULT_CLEAR_MM,
    direction: 'both',
    ...extras,
  }
}

export function installationDisplayName(name: string | undefined | null): string {
  if (!name || name === 'New corridor') return 'New installation'
  return name.replace(/\b[Cc]orridor\b/g, 'Installation')
}

function defaultGroupId(): string {
  return 'lg_default'
}

/** Wrap a v1 corridor document (or a partial v2 doc) into a v2 Installation. */
export function migrateDoc(raw: unknown): MigratedDoc {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const unitsIn = Array.isArray(src.units) ? (src.units as MigratedUnit[]) : []
  const lanesIn = Array.isArray(src.lanes) ? (src.lanes as MigratedDoc['lanes']) : []
  const gaps = src.gaps && typeof src.gaps === 'object' ? (src.gaps as Record<string, number>) : {}

  const existingGroups = Array.isArray(src.laneGroups) ? (src.laneGroups as LaneGroup[]) : []
  const laneGroups =
    existingGroups.length > 0
      ? existingGroups.map((g, i) => ({
          id: g.id || `lg_${i}`,
          name: g.name || nextGroupName([]),
          originX: g.originX ?? 0,
          originZ: g.originZ ?? iZ(i),
          rotationY: g.rotationY ?? 0,
          defaultClearMm: g.defaultClearMm ?? DEFAULT_CLEAR_MM,
          direction: g.direction ?? 'both',
        }))
      : unitsIn.length || src.name
        ? [makeLaneGroup(defaultGroupId(), 'Lane Group A', 0)]
        : []

  const fallbackId = laneGroups[0]?.id ?? null
  const units = unitsIn.map((u) => ({
    ...u,
    groupId: u.groupId && laneGroups.some((g) => g.id === u.groupId) ? u.groupId : fallbackId ?? defaultGroupId(),
  }))

  const lanes = lanesIn.map((l) => {
    const first = l.members?.[0]?.unitId
    const host = units.find((u) => u.id === first)?.groupId ?? fallbackId ?? undefined
    return { ...l, groupId: (l as { groupId?: string }).groupId ?? host }
  })

  const active =
    typeof src.activeGroupId === 'string' && laneGroups.some((g) => g.id === src.activeGroupId)
      ? src.activeGroupId
      : (fallbackId ?? null)

  return {
    schemaVersion: SCHEMA_VERSION,
    name: installationDisplayName(typeof src.name === 'string' ? src.name : 'New installation'),
    laneGroups,
    activeGroupId: active,
    units,
    lanes,
    gaps,
    led: src.led,
    finish: typeof src.finish === 'string' ? src.finish : 'steel',
    glass: typeof src.glass === 'string' ? src.glass : 'clear',
  }
}

function iZ(i: number) {
  return i * GROUP_SPACING_M
}

export function migrateSavedEntry(raw: unknown): {
  id: string
  name: string
  savedAt: number
  thumb: string | null
  schemaVersion: number
  doc: MigratedDoc
} {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const doc = migrateDoc(src.doc ?? src)
  return {
    id: typeof src.id === 'string' ? src.id : `inst_${Date.now().toString(36)}`,
    name: installationDisplayName(typeof src.name === 'string' ? src.name : doc.name),
    savedAt: typeof src.savedAt === 'number' ? src.savedAt : Date.now(),
    thumb: typeof src.thumb === 'string' ? src.thumb : null,
    schemaVersion: SCHEMA_VERSION,
    doc,
  }
}

export function unitsOfGroup<T extends { groupId?: string }>(units: T[], groupId: string): T[] {
  return units.filter((u) => (u.groupId ?? '') === groupId)
}

export function insertIndexInGroup<T extends { groupId?: string }>(
  units: T[],
  groupId: string,
  localIndex?: number,
): number {
  const members = unitsOfGroup(units, groupId)
  const first = units.findIndex((u) => u.groupId === groupId)
  const count = members.length
  const local = localIndex == null ? count : Math.max(0, Math.min(localIndex, count))
  if (first < 0) return units.length
  return first + local
}

/** Facing wing on a cabinet side, honouring flip. */
export function wingOnSide(
  type: UnitType,
  flipped: boolean | undefined,
  side: 'left' | 'right',
): WingId | null {
  const spec = CATALOG[type]
  for (const wing of spec.wings) {
    const physical =
      wing === 'left' ? (flipped ? 'right' : 'left') : wing === 'right' ? (flipped ? 'left' : 'right') : flipped ? 'left' : 'right'
    if (physical === side) return wing
  }
  return null
}

export function neighbourPassages<T extends { id: string; type: UnitType; flipped?: boolean; groupId?: string }>(
  units: T[],
  groups: { id: string }[],
): NeighbourPassage[] {
  const out: NeighbourPassage[] = []
  const list = groups.length ? groups : [{ id: units[0]?.groupId || 'lg_default' }]
  for (const g of list) {
    const members = unitsOfGroup(units, g.id)
    for (let i = 0; i < members.length - 1; i++) {
      const left = members[i]
      const right = members[i + 1]
      const lw = wingOnSide(left.type, left.flipped, 'right')
      const rw = wingOnSide(right.type, right.flipped, 'left')
      const membersRefs: WingRef[] = []
      if (lw) membersRefs.push({ unitId: left.id, wing: lw })
      if (rw) membersRefs.push({ unitId: right.id, wing: rw })
      if (!membersRefs.length) continue
      out.push({
        groupId: g.id,
        leftUnitId: left.id,
        rightUnitId: right.id,
        members: membersRefs,
      })
    }
  }
  return out
}

function passageSignature(members: WingRef[]): string {
  return members
    .map((m) => `${m.unitId}:${m.wing}`)
    .sort()
    .join('|')
}

export function syncNeighbourLanes<TLane extends { id: string; members: WingRef[]; groupId?: string }>(
  units: Array<{ id: string; type: UnitType; flipped?: boolean; groupId?: string }>,
  groups: { id: string }[],
  existing: TLane[],
  makeLane: (passage: NeighbourPassage, index: number, reused: TLane | null) => TLane,
): TLane[] {
  const passages = neighbourPassages(units, groups)
  const unused = [...existing]
  const next: TLane[] = []
  for (const p of passages) {
    const sig = passageSignature(p.members)
    const unitPair = new Set([p.leftUnitId, p.rightUnitId])
    const idx = unused.findIndex((l) => {
      const ids = new Set(l.members.map((m) => m.unitId))
      if (ids.size === unitPair.size && [...unitPair].every((id) => ids.has(id))) return true
      return passageSignature(l.members) === sig
    })
    const reused = idx >= 0 ? unused.splice(idx, 1)[0] : null
    next.push(makeLane(p, next.length, reused))
  }
  return next
}

export function formatClearCm(mm: number): string {
  return `${Math.round(mm / 10)} cm`
}

export function cmToMm(cm: number): number {
  return Math.round(cm * 10)
}

export function manufacturersOnDoc(units: Array<{ type: UnitType }>): string[] {
  const names = new Set<string>()
  for (const u of units) {
    const mid = modelsForManufacturer('came').find((m) => m.id === u.type)?.manufacturerId ?? 'came'
    const name = enabledManufacturers().find((m) => m.id === mid)?.name ?? mid
    names.add(name)
  }
  return [...names]
}

/** Future auto-generate: N lanes → end + middles + flipped end. */
export function unitsForRecipe(recipe: LaneGroupRecipe): Array<{ type: UnitType; flipped?: boolean }> {
  const models = modelsForManufacturer(recipe.manufacturerId)
  const primary = models.find((m) => m.id === recipe.modelId) ?? models[0]
  if (!primary) return []
  const n = Math.max(1, Math.floor(recipe.laneCount))
  const family = models.filter((m) => m.category === primary.category)
  const pool = family.length ? family : models
  const mid = pool.find((m) => m.capabilities.supportsMiddle) ?? primary
  const end =
    pool.find((m) => m.id !== mid.id && m.capabilities.supportsLeftEnd) ??
    pool.find((m) => m.capabilities.supportsLeftEnd) ??
    primary
  const units: Array<{ type: UnitType; flipped?: boolean }> = [{ type: end.id }]
  for (let i = 0; i < n - 1; i++) units.push({ type: mid.id })
  units.push({ type: end.id, flipped: true })
  return units
}

export function groupSummary(units: Array<{ groupId?: string }>, lanes: Array<{ groupId?: string }>, groupId: string) {
  const nUnits = unitsOfGroup(units, groupId).length
  const nLanes = lanes.filter((l) => l.groupId === groupId).length
  return { units: nUnits, lanes: nLanes }
}

export function overallWidthMm(
  units: Array<{ id: string; type: UnitType; groupId?: string }>,
  gaps: Record<string, number>,
  groupId: string,
  gapAt: (units: Array<{ id: string; type: UnitType; flipped?: boolean }>, i: number, gaps: Record<string, number>) => number,
): number {
  const members = unitsOfGroup(units, groupId)
  if (!members.length) return 0
  let mm = 0
  members.forEach((u, i) => {
    mm += CATALOG[u.type].bodyMm
    if (i < members.length - 1) mm += gapAt(members, i, gaps)
  })
  return mm
}
