import { create } from 'zustand'
import { loadInstallations, replaceInstallations } from '../lib/installationsDb'
import {
  ACCESSIBLE_MIN_MM,
  CATALOG,
  GAP_SPAN_MM,
  LANE_COLORS,
  LED_DEFAULT,
  type EnvId,
  type FinishId,
  type GlassId,
  type LedConfig,
  type UnitType,
  type WingId,
} from '../model/catalog'
import {
  DEFAULT_CLEAR_MM,
  SCHEMA_VERSION,
  formatClearCm,
  insertIndexInGroup,
  installationDisplayName,
  makeLaneGroup,
  migrateDoc,
  migrateSavedEntry,
  nextGroupName,
  unitsForRecipe,
  unitsOfGroup,
  wingOnSide,
  type LaneGroup,
  type LaneGroupRecipe,
  type WidthAnchor,
} from '../model/installation'

export type { LaneGroup, LaneGroupRecipe, WidthAnchor }
export { formatClearCm, SCHEMA_VERSION }

/* ------------------------------------------------------------------ types --- */

export interface PlacedUnit {
  id: string
  type: UnitType
  groupId: string
  /** rotated 180° so the wing sits on the other face */
  flipped?: boolean
  led?: LedConfig | null
  finish?: FinishId | null
  glass?: GlassId | null
}

export interface WingRef {
  unitId: string
  wing: WingId
}

export type LaneMode = 'badge' | 'free' | 'locked' | 'noentry'
export type LaneDirection = 'in' | 'out' | 'both'

export interface Lane {
  id: string
  name: string
  color: string
  groupId?: string
  members: WingRef[]
  /** runtime state, never part of undo history */
  open: boolean
  openedAt: number | null
  mode: LaneMode
  direction: LaneDirection
  accessible: boolean
  /** auto-close delay for badge mode (s) */
  holdSec: number
  led?: LedConfig | null
  /** Intended clear width (mm). Geometry uses the gap when the lane sits between cabinets. */
  clearMm: number
}

export type Mode = 'build' | 'operate'

/** 'off' loads no character GLBs at all; each level above fetches more. */
export type CrowdLevel = 'off' | 'few' | 'busy'

export type Selection = { kind: 'unit' | 'lane' | 'group'; id: string } | null

export interface ContextMenuState {
  unitId: string
  x: number
  y: number
}

export interface CamCmd {
  pos: [number, number, number]
  target: [number, number, number]
  n: number
}

export interface SavedCorridor {
  id: string
  name: string
  savedAt: number
  thumb: string | null
  schemaVersion?: number
  doc: Doc
}

/** Alias — saved layouts are Installations. */
export type SavedInstallation = SavedCorridor

/** The undoable document. */
export interface Doc {
  schemaVersion: number
  name: string
  laneGroups: LaneGroup[]
  activeGroupId: string | null
  units: PlacedUnit[]
  lanes: Lane[]
  /** clear gap in mm after the unit with this id (clear width between inside faces) */
  gaps: Record<string, number>
  led: LedConfig
  finish: FinishId
  glass: GlassId
}

interface State extends Doc {
  mode: Mode
  env: EnvId
  showDims: boolean
  crowd: CrowdLevel

  sel: Selection
  multi: string[]
  selectedLaneIds: string[]
  contextMenu: ContextMenuState | null
  camCmd: CamCmd | null
  placingType: UnitType | null
  multiSelectMode: boolean
  widthAnchor: WidthAnchor
  buildTab: 'groups' | 'equipment' | 'appearance'

  past: Doc[]
  future: Doc[]
  library: SavedCorridor[]

  /* view */
  setMode: (m: Mode) => void
  setEnv: (e: EnvId) => void
  toggleDims: () => void
  setCrowd: (c: CrowdLevel) => void
  setName: (n: string) => void

  /* units */
  addUnit: (t: UnitType) => void
  insertUnit: (t: UnitType, index?: number, groupId?: string) => string
  removeUnit: (id: string) => void
  removeMany: (ids: string[]) => void
  duplicateMany: (ids: string[]) => void
  flipUnit: (id: string) => void
  reorder: (from: number, to: number) => void
  nudgeUnit: (id: string, dir: -1 | 1) => void
  alignUnits: (ids: string[]) => void
  swapUnits: (a: string, b: string) => void

  /* lane groups */
  createLaneGroup: (name?: string) => string
  selectLaneGroup: (id: string | null) => void
  renameLaneGroup: (id: string, name: string) => void
  setGroupDefaultClear: (id: string, mm: number) => void
  setGroupDirection: (id: string, d: LaneDirection) => void
  moveLaneGroup: (id: string, dx: number, dz: number) => void
  rotateLaneGroup: (id: string, delta: number) => void
  duplicateLaneGroup: (id: string) => void
  deleteLaneGroup: (id: string) => void
  generateLaneGroup: (recipe: LaneGroupRecipe) => void
  setBuildTab: (t: 'groups' | 'equipment' | 'appearance') => void
  setPlacingType: (t: UnitType | null) => void
  setMultiSelectMode: (v: boolean) => void
  setWidthAnchor: (a: WidthAnchor) => void
  setClearWidthBetween: (leftId: string, rightId: string, mm: number) => void
  fitSelection: () => void

  /* selection */
  select: (s: Selection) => void
  toggleMulti: (id: string) => void
  clearMulti: () => void
  openContextMenu: (unitId: string, x: number, y: number) => void
  closeContextMenu: () => void

  /* geometry */
  setGap: (key: string, mm: number) => void
  setLaneWidth: (laneId: string, mm: number) => void

  /* lanes */
  autoLanes: () => void
  toggleLaneSelected: (id: string) => void
  mergeSelectedLanes: () => void
  mergeAdjacentLanes: (aId: string, bId: string) => void
  splitLane: (id: string) => void
  renameLane: (id: string, name: string) => void
  setLaneMode: (id: string, m: LaneMode) => void
  setLaneDirection: (id: string, d: LaneDirection) => void
  setLaneAccessible: (id: string, v: boolean) => void
  setLaneHold: (id: string, s: number) => void
  setLaneLed: (id: string, led: LedConfig | null) => void

  /* runtime control */
  requestLane: (id: string) => void
  setLaneOpen: (id: string, open: boolean) => void
  openAll: () => void
  closeAll: () => void
  emergencyRelease: () => void
  tick: () => void

  /* appearance */
  setLed: (led: LedConfig) => void
  setUnitLed: (id: string, led: LedConfig | null) => void
  setFinish: (f: FinishId) => void
  setGlass: (g: GlassId) => void
  setUnitFinish: (id: string, f: FinishId | null) => void
  setUnitGlass: (id: string, g: GlassId | null) => void

  /* camera */
  flyTo: (pos: [number, number, number], target: [number, number, number]) => void
  registerCapture: (fn: (() => string | null) | null) => void
  capture: () => string | null

  /* history + library */
  undo: () => void
  redo: () => void
  saveToLibrary: () => void
  loadFromLibrary: (id: string) => void
  duplicateFromLibrary: (id: string) => void
  renameLibraryEntry: (id: string, name: string) => void
  deleteFromLibrary: (id: string) => void
  reset: () => void
  /** Load library from local SQLite once at startup. */
  hydrate: () => Promise<void>
  libraryHydrated: boolean
}

/* -------------------------------------------------------------- utilities --- */

let uid = 0
const newId = (p: string) => `${p}_${Date.now().toString(36)}_${(uid++).toString(36)}`

export function effectiveReach(u: PlacedUnit): { left: number; right: number } {
  const r = CATALOG[u.type].reach
  return u.flipped ? { left: r.right, right: r.left } : r
}

/** Clear gap at which the two facing arms just touch (mm). */
export function minGapMm(left: PlacedUnit, right: PlacedUnit): number {
  return effectiveReach(left).right + effectiveReach(right).left
}
export function maxGapMm(left: PlacedUnit, right: PlacedUnit): number {
  return minGapMm(left, right) + GAP_SPAN_MM
}
export function defaultGapMm(left: PlacedUnit, right: PlacedUnit, preferredMm = DEFAULT_CLEAR_MM): number {
  const lo = minGapMm(left, right)
  const hi = maxGapMm(left, right)
  return Math.max(lo, Math.min(hi, preferredMm))
}

/** Resolved clear gap after units[i], honouring overrides and clamping. */
export function gapAt(units: PlacedUnit[], i: number, gaps: Record<string, number>): number {
  const l = units[i]
  const r = units[i + 1]
  if (!l || !r) return 0
  const lo = minGapMm(l, r)
  const hi = maxGapMm(l, r)
  const v = gaps[l.id] ?? defaultGapMm(l, r)
  return Math.max(lo, Math.min(hi, v))
}

/** Which physical face a wing sits on, after flipping. */
export function wingSide(u: PlacedUnit, wing: WingId): 'left' | 'right' {
  if (wing === 'left') return u.flipped ? 'right' : 'left'
  if (wing === 'right') return u.flipped ? 'left' : 'right'
  return effectiveReach(u).right > 0 ? 'right' : 'left'
}

export interface GapInfo {
  key: string
  index: number
  min: number
  max: number
  value: number
}

/** The passage a lane guards, or null when it faces open space. */
export function laneGap(
  lane: Lane,
  units: PlacedUnit[],
  gaps: Record<string, number>,
): GapInfo | null {
  const idxOf = new Map(units.map((u, i) => [u.id, i]))
  const info = (i: number): GapInfo | null => {
    if (i < 0 || i >= units.length - 1) return null
    return {
      key: units[i].id,
      index: i,
      min: minGapMm(units[i], units[i + 1]),
      max: maxGapMm(units[i], units[i + 1]),
      value: gapAt(units, i, gaps),
    }
  }

  const idxs = [...new Set(lane.members.map((m) => idxOf.get(m.unitId)))]
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)
  if (!idxs.length) return null
  if (idxs.length >= 2) return info(idxs[0])

  const i = idxs[0]
  const u = units[i]
  const side = wingSide(u, lane.members[0].wing)
  return side === 'right' ? info(i) : info(i - 1)
}

export function laneClearMm(
  lane: Lane,
  units: PlacedUnit[],
  gaps: Record<string, number>,
): number {
  return laneGap(lane, units, gaps)?.value ?? lane.clearMm ?? DEFAULT_CLEAR_MM
}

function wingsOf(u: PlacedUnit): WingRef[] {
  return CATALOG[u.type].wings.map((wing) => ({ unitId: u.id, wing }))
}

export function allWings(units: PlacedUnit[]): WingRef[] {
  return units.flatMap(wingsOf)
}

function baseLane(members: WingRef[], i: number, groupId?: string): Lane {
  return {
    id: newId('lane'),
    name: `Lane ${i + 1}`,
    color: LANE_COLORS[i % LANE_COLORS.length],
    groupId,
    members,
    open: false,
    openedAt: null,
    mode: 'badge',
    direction: 'both',
    accessible: false,
    holdSec: 4,
    led: null,
    clearMm: DEFAULT_CLEAR_MM,
  }
}

function orderLanes(lanes: Lane[], units: PlacedUnit[]): Lane[] {
  const idx = new Map(units.map((u, i) => [u.id, i]))
  const wingRank = (w: WingId) => (w === 'left' ? 0 : w === 'single' ? 1 : 2)
  return [...lanes].sort((a, b) => {
    const ai = Math.min(...a.members.map((m) => idx.get(m.unitId) ?? 999))
    const bi = Math.min(...b.members.map((m) => idx.get(m.unitId) ?? 999))
    if (ai !== bi) return ai - bi
    return wingRank(a.members[0]?.wing ?? 'single') - wingRank(b.members[0]?.wing ?? 'single')
  })
}

function renumber(lanes: Lane[]): Lane[] {
  return lanes.map((l, i) => ({
    ...l,
    color: LANE_COLORS[i % LANE_COLORS.length],
    name: /^Lane(\s\d+)?$/.test(l.name) ? `Lane ${i + 1}` : l.name,
  }))
}

function pruneLanes(lanes: Lane[], units: PlacedUnit[]): Lane[] {
  const live = new Set(units.map((u) => u.id))
  return lanes
    .map((l) => ({ ...l, members: l.members.filter((m) => live.has(m.unitId)) }))
    .filter((l) => l.members.length > 0)
}

/** One lane per leaf by default. Merged (multi-unit) lanes are kept. */
function rebuildLanes(units: PlacedUnit[], _groups: LaneGroup[], existing: Lane[]): Lane[] {
  if (!units.length) return []
  const kept = pruneLanes(existing, units)
  const held = new Set(kept.flatMap((l) => l.members.map((m) => `${m.unitId}:${m.wing}`)))
  const extra: Lane[] = []
  for (const w of allWings(units)) {
    if (held.has(`${w.unitId}:${w.wing}`)) continue
    extra.push(baseLane([w], extra.length, units.find((u) => u.id === w.unitId)?.groupId))
  }
  return renumber(orderLanes([...kept, ...extra], units))
}

function facingPair(left: PlacedUnit, right: PlacedUnit): { left: WingId; right: WingId } | null {
  const lw = wingOnSide(left.type, left.flipped, 'right')
  const rw = wingOnSide(right.type, right.flipped, 'left')
  if (!lw || !rw) return null
  return { left: lw, right: rw }
}

/** Two lanes can merge when they are facing leaves on consecutive cabinets. */
export function canMergeLanes(a: Lane, b: Lane, units: PlacedUnit[]): boolean {
  if (a.id === b.id) return false
  const gid = a.groupId && a.groupId === b.groupId ? a.groupId : a.groupId ?? b.groupId
  const row = gid ? unitsOfGroup(units, gid) : units
  const idxOf = (id: string) => row.findIndex((u) => u.id === id)
  const aIds = [...new Set(a.members.map((m) => m.unitId))]
  const bIds = [...new Set(b.members.map((m) => m.unitId))]
  if (aIds.some((id) => bIds.includes(id))) return false
  const aIdx = aIds.map(idxOf).filter((i) => i >= 0).sort((x, y) => x - y)
  const bIdx = bIds.map(idxOf).filter((i) => i >= 0).sort((x, y) => x - y)
  if (!aIdx.length || !bIdx.length) return false
  const aFirst = aIdx[0] < bIdx[0]
  const loLane = aFirst ? a : b
  const hiLane = aFirst ? b : a
  const loMax = aFirst ? aIdx[aIdx.length - 1] : bIdx[bIdx.length - 1]
  const hiMin = aFirst ? bIdx[0] : aIdx[0]
  if (hiMin !== loMax + 1) return false
  const leftU = row[loMax]
  const rightU = row[hiMin]
  const pair = facingPair(leftU, rightU)
  if (!pair) return false
  return (
    loLane.members.some((m) => m.unitId === leftU.id && m.wing === pair.left) &&
    hiLane.members.some((m) => m.unitId === rightU.id && m.wing === pair.right)
  )
}

export function mergePartner(lane: Lane, lanes: Lane[], units: PlacedUnit[]): Lane | null {
  return lanes.find((other) => canMergeLanes(lane, other, units)) ?? null
}

function camFocusUnit(unit: PlacedUnit, world: Layout, n: number): CamCmd {
  const spec = CATALOG[unit.type]
  const cx = world.x[unit.id] ?? 0
  const cz = world.z[unit.id] ?? 0
  const h = spec.heightMm / 1000
  const reach = effectiveReach(unit)
  const spanM = Math.max(spec.bodyMm, spec.depthMm, reach.left + reach.right) / 1000
  const dist = Math.max(spanM * 1.7, 1.85)
  return {
    pos: [cx + dist * 0.42, Math.max(h * 0.72, 1.05), cz + dist * 0.9],
    target: [cx, h * 0.42, cz],
    n,
  }
}

const takeDoc = (s: State): Doc => ({
  schemaVersion: SCHEMA_VERSION,
  name: s.name,
  laneGroups: s.laneGroups,
  activeGroupId: s.activeGroupId,
  units: s.units,
  lanes: s.lanes,
  gaps: s.gaps,
  led: s.led,
  finish: s.finish,
  glass: s.glass,
})

function asDoc(raw: unknown): Doc {
  const m = migrateDoc(raw)
  const units = m.units as PlacedUnit[]
  const mapped = (m.lanes as unknown as Lane[]).map((l) => ({
    ...baseLane(l.members ?? [], 0, l.groupId),
    ...l,
    clearMm: typeof l.clearMm === 'number' ? l.clearMm : DEFAULT_CLEAR_MM,
    open: false,
    openedAt: null,
  }))
  return {
    schemaVersion: SCHEMA_VERSION,
    name: m.name,
    laneGroups: m.laneGroups,
    activeGroupId: m.activeGroupId,
    units,
    lanes: rebuildLanes(units, m.laneGroups, mapped),
    gaps: m.gaps,
    led: (m.led as LedConfig) ?? LED_DEFAULT,
    finish: (m.finish as FinishId) || 'steel',
    glass: (m.glass as GlassId) || 'clear',
  }
}

async function loadLibrary(): Promise<SavedCorridor[]> {
  try {
    const rows = await loadInstallations()
    return rows.map((e) => migrateLibraryItem(e))
  } catch {
    return []
  }
}

function migrateLibraryItem(raw: unknown): SavedCorridor {
  const e = migrateSavedEntry(raw)
  return {
    id: e.id,
    name: e.name,
    savedAt: e.savedAt,
    thumb: e.thumb,
    schemaVersion: SCHEMA_VERSION,
    doc: asDoc(e.doc),
  }
}

function persistLibrary(lib: SavedCorridor[]) {
  void replaceInstallations(
    lib.map((e) => ({
      id: e.id,
      name: e.name,
      savedAt: e.savedAt,
      thumb: e.thumb,
      schemaVersion: e.schemaVersion ?? SCHEMA_VERSION,
      doc: e.doc,
    })),
  ).catch((err) => {
    console.warn('sqlite save failed', err)
  })
}

const EMPTY: Doc = {
  schemaVersion: SCHEMA_VERSION,
  name: 'New installation',
  laneGroups: [],
  activeGroupId: null,
  units: [],
  lanes: [],
  gaps: {},
  led: LED_DEFAULT,
  finish: 'steel',
  glass: 'clear',
}

function ensureGroup(s: Pick<Doc, 'laneGroups' | 'activeGroupId'>): { laneGroups: LaneGroup[]; activeGroupId: string } {
  if (s.activeGroupId && s.laneGroups.some((g) => g.id === s.activeGroupId)) {
    return { laneGroups: s.laneGroups, activeGroupId: s.activeGroupId }
  }
  if (s.laneGroups.length) {
    return { laneGroups: s.laneGroups, activeGroupId: s.laneGroups[0].id }
  }
  const g = makeLaneGroup(newId('lg'), nextGroupName([]), 0)
  return { laneGroups: [g], activeGroupId: g.id }
}

/* ----------------------------------------------------------------- store ---- */

let captureFn: (() => string | null) | null = null

export const useCorridor = create<State>((set, get) => {
  /** Apply a document mutation and push the previous doc onto the undo stack. */
  const edit = (fn: (s: State) => Partial<State> | null) =>
    set((s) => {
      const patch = fn(s)
      if (!patch) return {}
      return { ...patch, past: [...s.past, takeDoc(s)].slice(-60), future: [] }
    })

  return {
    ...EMPTY,
    mode: 'build',
    env: 'lobby',
    showDims: false,
    crowd: 'off',

    sel: null,
    multi: [],
    selectedLaneIds: [],
    contextMenu: null,
    camCmd: null,
    placingType: null,
    multiSelectMode: false,
    widthAnchor: 'right',
    buildTab: 'groups',

    past: [],
    future: [],
    library: [],
    libraryHydrated: false,

    hydrate: async () => {
      const library = await loadLibrary()
      set((s) => {
        if (s.library.length > library.length) return { libraryHydrated: true }
        return { library, libraryHydrated: true }
      })
    },

    /* view */
    // drop the selection so the inspector never covers the other mode's dock
    setMode: (mode) => set({ mode, contextMenu: null, sel: null, multi: [], placingType: null, multiSelectMode: false }),
    setEnv: (env) => set({ env }),
    toggleDims: () => set((s) => ({ showDims: !s.showDims })),
    setCrowd: (crowd) => set({ crowd }),
    setName: (name) => set({ name }),

    /* units */
    addUnit: (t) => get().insertUnit(t),

    insertUnit: (t, index, groupId) => {
      let created = ''
      edit((s) => {
        const g = ensureGroup({
          laneGroups: s.laneGroups,
          activeGroupId: groupId ?? s.activeGroupId,
        })
        const gid = groupId && g.laneGroups.some((x) => x.id === groupId) ? groupId : g.activeGroupId
        const unit: PlacedUnit = { id: newId(t), type: t, groupId: gid }
        created = unit.id
        const units = [...s.units]
        const at = insertIndexInGroup(units, gid, index)
        units.splice(at, 0, unit)
        const group = g.laneGroups.find((x) => x.id === gid)
        const pref = group?.defaultClearMm ?? DEFAULT_CLEAR_MM
        const i = units.findIndex((u) => u.id === unit.id)
        const gaps = { ...s.gaps }
        if (i > 0 && units[i - 1].groupId === gid) {
          gaps[units[i - 1].id] = defaultGapMm(units[i - 1], unit, pref)
        }
        if (units[i + 1]?.groupId === gid) {
          gaps[unit.id] = defaultGapMm(unit, units[i + 1], pref)
        }
        const world = computeWorldLayout(units, gaps, g.laneGroups)
        return {
          laneGroups: g.laneGroups,
          activeGroupId: gid,
          units,
          lanes: rebuildLanes(units, g.laneGroups, s.lanes),
          gaps,
          placingType: null,
          camCmd: camFocusUnit(unit, world, (s.camCmd?.n ?? 0) + 1),
        }
      })
      return created
    },

    removeUnit: (id) => get().removeMany([id]),

    removeMany: (ids) =>
      edit((s) => {
        const kill = new Set(ids)
        const units = s.units.filter((u) => !kill.has(u.id))
        return {
          units,
          lanes: rebuildLanes(units, s.laneGroups, pruneLanes(s.lanes, units)),
          sel: s.sel && kill.has(s.sel.id) ? null : s.sel,
          multi: s.multi.filter((m) => !kill.has(m)),
          contextMenu: null,
        }
      }),

    duplicateMany: (ids) =>
      edit((s) => {
        if (!ids.length) return null
        const units = [...s.units]
        const order = ids
          .map((id) => units.findIndex((u) => u.id === id))
          .filter((i) => i >= 0)
          .sort((a, b) => b - a)
        for (const i of order) {
          const src = units[i]
          units.splice(i + 1, 0, { ...src, id: newId(src.type) })
        }
        return { units, lanes: rebuildLanes(units, s.laneGroups, s.lanes), contextMenu: null }
      }),

    flipUnit: (id) =>
      edit((s) => {
        const units = s.units.map((u) => (u.id === id ? { ...u, flipped: !u.flipped } : u))
        return {
          units,
          lanes: rebuildLanes(units, s.laneGroups, s.lanes),
          contextMenu: null,
        }
      }),

    reorder: (from, to) =>
      edit((s) => {
        if (from === to || from < 0 || to < 0 || from >= s.units.length || to >= s.units.length)
          return null
        const units = [...s.units]
        const [m] = units.splice(from, 1)
        units.splice(to, 0, m)
        return { units, lanes: rebuildLanes(units, s.laneGroups, s.lanes) }
      }),

    nudgeUnit: (id, dir) =>
      edit((s) => {
        const i = s.units.findIndex((u) => u.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= s.units.length) return null
        if (s.units[i].groupId !== s.units[j].groupId) return null
        const units = [...s.units]
        ;[units[i], units[j]] = [units[j], units[i]]
        return { units, lanes: rebuildLanes(units, s.laneGroups, s.lanes) }
      }),

    alignUnits: (ids) =>
      edit((s) => {
        if (ids.length < 2) return null
        const host = s.units.find((u) => u.id === ids[0])
        if (!host) return null
        const units = s.units.map((u) => (ids.includes(u.id) ? { ...u, groupId: host.groupId, flipped: host.flipped } : u))
        return { units, lanes: rebuildLanes(units, s.laneGroups, s.lanes) }
      }),

    swapUnits: (a, b) =>
      edit((s) => {
        const i = s.units.findIndex((u) => u.id === a)
        const j = s.units.findIndex((u) => u.id === b)
        if (i < 0 || j < 0) return null
        const units = [...s.units]
        ;[units[i], units[j]] = [units[j], units[i]]
        return { units, lanes: rebuildLanes(units, s.laneGroups, s.lanes) }
      }),

    createLaneGroup: (name) => {
      let created = ''
      edit((s) => {
        const g = makeLaneGroup(newId('lg'), name || nextGroupName(s.laneGroups), s.laneGroups.length)
        created = g.id
        return {
          laneGroups: [...s.laneGroups, g],
          activeGroupId: g.id,
        }
      })
      return created
    },

    selectLaneGroup: (id) => set({ activeGroupId: id }),

    renameLaneGroup: (id, name) =>
      edit((s) => ({
        laneGroups: s.laneGroups.map((g) => (g.id === id ? { ...g, name } : g)),
      })),

    setGroupDefaultClear: (id, mm) =>
      edit((s) => {
        const laneGroups = s.laneGroups.map((g) => (g.id === id ? { ...g, defaultClearMm: mm } : g))
        const members = unitsOfGroup(s.units, id)
        const gaps = { ...s.gaps }
        for (let i = 0; i < members.length - 1; i++) {
          gaps[members[i].id] = defaultGapMm(members[i], members[i + 1], mm)
        }
        return { laneGroups, gaps }
      }),

    setGroupDirection: (id, direction) =>
      edit((s) => ({
        laneGroups: s.laneGroups.map((g) => (g.id === id ? { ...g, direction } : g)),
        lanes: s.lanes.map((l) => (l.groupId === id ? { ...l, direction } : l)),
      })),

    moveLaneGroup: (id, dx, dz) =>
      edit((s) => ({
        laneGroups: s.laneGroups.map((g) =>
          g.id === id ? { ...g, originX: g.originX + dx, originZ: g.originZ + dz } : g,
        ),
      })),

    rotateLaneGroup: (id, delta) =>
      edit((s) => ({
        laneGroups: s.laneGroups.map((g) =>
          g.id === id ? { ...g, rotationY: g.rotationY + delta } : g,
        ),
      })),

    duplicateLaneGroup: (id) =>
      edit((s) => {
        const src = s.laneGroups.find((g) => g.id === id)
        if (!src) return null
        const g = makeLaneGroup(newId('lg'), `${src.name} copy`, s.laneGroups.length, {
          rotationY: src.rotationY,
          defaultClearMm: src.defaultClearMm,
          direction: src.direction,
        })
        const idMap = new Map<string, string>()
        const copies: PlacedUnit[] = unitsOfGroup(s.units, id).map((u) => {
          const nid = newId(u.type)
          idMap.set(u.id, nid)
          return { ...u, id: nid, groupId: g.id }
        })
        const gaps = { ...s.gaps }
        for (const u of unitsOfGroup(s.units, id)) {
          const nid = idMap.get(u.id)
          if (nid && s.gaps[u.id] != null) gaps[nid] = s.gaps[u.id]
        }
        const extraLanes: Lane[] = s.lanes
          .filter((l) => l.groupId === id)
          .map((l) => ({
            ...l,
            id: newId('lane'),
            groupId: g.id,
            open: false,
            openedAt: null,
            members: l.members
              .map((m) => {
                const uid = idMap.get(m.unitId)
                return uid ? { ...m, unitId: uid } : null
              })
              .filter((m): m is WingRef => m != null),
          }))
        const units = [...s.units, ...copies]
        const lanes = rebuildLanes(units, [...s.laneGroups, g], [...s.lanes, ...extraLanes])
        return {
          laneGroups: [...s.laneGroups, g],
          activeGroupId: g.id,
          units,
          lanes,
          gaps,
          sel: { kind: 'group', id: g.id },
        }
      }),

    deleteLaneGroup: (id) =>
      edit((s) => {
        const units = s.units.filter((u) => u.groupId !== id)
        const laneGroups = s.laneGroups.filter((g) => g.id !== id)
        return {
          laneGroups,
          activeGroupId: s.activeGroupId === id ? (laneGroups[0]?.id ?? null) : s.activeGroupId,
          units,
          lanes: rebuildLanes(units, laneGroups, s.lanes.filter((l) => l.groupId !== id)),
          sel: s.sel?.kind === 'group' && s.sel.id === id ? null : s.sel,
        }
      }),

    generateLaneGroup: (recipe) =>
      edit((s) => {
        const g = makeLaneGroup(newId('lg'), nextGroupName(s.laneGroups), s.laneGroups.length, {
          defaultClearMm: recipe.standardClearMm,
        })
        const units: PlacedUnit[] = [
          ...s.units,
          ...unitsForRecipe(recipe).map((u) => ({ id: newId(u.type), type: u.type, flipped: u.flipped, groupId: g.id })),
        ]
        const members = unitsOfGroup(units, g.id)
        const gaps = { ...s.gaps }
        members.forEach((u, i) => {
          if (i >= members.length - 1) return
          const acc = recipe.accessibleLanes?.find((a) => a.index === i)
          gaps[u.id] = defaultGapMm(members[i], members[i + 1], acc?.clearMm ?? recipe.standardClearMm)
        })
        const lanes = rebuildLanes(units, [...s.laneGroups, g], s.lanes).map((l, i) =>
          recipe.accessibleLanes?.some((a) => a.index === i) ? { ...l, accessible: true } : l,
        )
        return {
          laneGroups: [...s.laneGroups, g],
          activeGroupId: g.id,
          units,
          lanes,
          gaps,
          sel: { kind: 'group', id: g.id },
        }
      }),

    setBuildTab: (buildTab) => set({ buildTab, placingType: buildTab === 'equipment' ? get().placingType : null }),
    setPlacingType: (placingType) => set({ placingType }),
    setMultiSelectMode: (multiSelectMode) => set({ multiSelectMode, multi: multiSelectMode ? get().multi : [] }),
    setWidthAnchor: (widthAnchor) => set({ widthAnchor }),

    setClearWidthBetween: (leftId, rightId, mm) =>
      edit((s) => {
        const gid = s.units.find((u) => u.id === leftId)?.groupId
        const members = gid ? unitsOfGroup(s.units, gid) : s.units
        const i = members.findIndex((u) => u.id === leftId)
        const j = members.findIndex((u) => u.id === rightId)
        if (i < 0 || j < 0 || Math.abs(i - j) !== 1) return null
        const left = i < j ? members[i] : members[j]
        const right = i < j ? members[j] : members[i]
        const lo = minGapMm(left, right)
        const hi = maxGapMm(left, right)
        const next = Math.max(lo, Math.min(hi, mm))
        const prev = gapAt(members, Math.min(i, j), s.gaps)
        const deltaM = (next - prev) / 1000
        const gaps = { ...s.gaps, [left.id]: next }
        let laneGroups = s.laneGroups
        if (s.widthAnchor === 'left' || s.widthAnchor === 'both') {
          const shift = s.widthAnchor === 'both' ? deltaM / 2 : deltaM
          laneGroups = s.laneGroups.map((g) => (g.id === gid ? { ...g, originX: g.originX - shift } : g))
        }
        return { gaps, laneGroups }
      }),

    fitSelection: () => {
      const s = get()
      const world = computeWorldLayout(s.units, s.gaps, s.laneGroups)
      let ids: string[] = []
      if (s.sel?.kind === 'unit') ids = [s.sel.id]
      else if (s.sel?.kind === 'group') ids = unitsOfGroup(s.units, s.sel.id).map((u) => u.id)
      else if (s.sel?.kind === 'lane') {
        const lane = s.lanes.find((l) => l.id === s.sel?.id)
        ids = lane?.members.map((m) => m.unitId) ?? []
      }
      if (!ids.length) ids = s.units.map((u) => u.id)
      const xs = ids.map((id) => world.x[id]).filter((v): v is number => v != null)
      const zs = ids.map((id) => world.z[id]).filter((v): v is number => v != null)
      if (!xs.length) return
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2
      const cz = (Math.min(...zs) + Math.max(...zs)) / 2
      const span = Math.max(Math.max(...xs) - Math.min(...xs), 1.2)
      const d = Math.max(span * 1.55, 4.5)
      s.flyTo([cx + d * 0.22, d * 0.42, cz + d * 0.95], [cx, 0.5, cz])
    },

    /* selection */
    select: (sel) =>
      set((s) => ({
        sel,
        contextMenu: null,
        activeGroupId: sel?.kind === 'group' ? sel.id : s.activeGroupId,
      })),
    toggleMulti: (id) =>
      set((s) => ({
        multi: s.multi.includes(id) ? s.multi.filter((x) => x !== id) : [...s.multi, id],
      })),
    clearMulti: () => set({ multi: [] }),
    openContextMenu: (unitId, x, y) => set({ contextMenu: { unitId, x, y } }),
    closeContextMenu: () => set({ contextMenu: null }),

    /* geometry */
    setGap: (key, mm) => edit((s) => ({ gaps: { ...s.gaps, [key]: mm } })),

    setLaneWidth: (laneId, mm) =>
      edit((s) => {
        const lane = s.lanes.find((l) => l.id === laneId)
        if (!lane) return null
        const g = laneGap(lane, s.units, s.gaps)
        const lanes = s.lanes.map((l) => (l.id === laneId ? { ...l, clearMm: mm } : l))
        if (!g) return { lanes }
        return { lanes, gaps: { ...s.gaps, [g.key]: Math.max(g.min, Math.min(g.max, mm)) } }
      }),

    /* lanes */
    autoLanes: () =>
      edit((s) => ({ lanes: rebuildLanes(s.units, s.laneGroups, s.lanes), selectedLaneIds: [] })),

    toggleLaneSelected: (id) =>
      set((s) => ({
        selectedLaneIds: s.selectedLaneIds.includes(id)
          ? s.selectedLaneIds.filter((x) => x !== id)
          : [...s.selectedLaneIds, id],
      })),

    mergeSelectedLanes: () =>
      edit((s) => {
        const ids = s.selectedLaneIds
        if (ids.length < 2) return null
        const chosen = s.lanes.filter((l) => ids.includes(l.id))
        const rest = s.lanes.filter((l) => !ids.includes(l.id))
        const merged: Lane = {
          ...chosen[0],
          id: newId('lane'),
          name: chosen[0].name,
          members: chosen.flatMap((l) => l.members),
          open: false,
          openedAt: null,
        }
        return { lanes: renumber(orderLanes([...rest, merged], s.units)), selectedLaneIds: [] }
      }),

    mergeAdjacentLanes: (aId, bId) =>
      edit((s) => {
        const a = s.lanes.find((l) => l.id === aId)
        const b = s.lanes.find((l) => l.id === bId)
        if (!a || !b || !canMergeLanes(a, b, s.units)) return null
        const rest = s.lanes.filter((l) => l.id !== aId && l.id !== bId)
        const merged: Lane = {
          ...a,
          id: newId('lane'),
          name: a.name,
          members: [...a.members, ...b.members],
          open: false,
          openedAt: null,
          clearMm: a.clearMm ?? DEFAULT_CLEAR_MM,
        }
        const next = renumber(orderLanes([...rest, merged], s.units))
        const g = laneGap(merged, s.units, s.gaps)
        const gaps = g
          ? { ...s.gaps, [g.key]: Math.max(g.min, Math.min(g.max, merged.clearMm)) }
          : s.gaps
        return { lanes: next, gaps, selectedLaneIds: [] }
      }),

    splitLane: (id) =>
      edit((s) => {
        const lane = s.lanes.find((l) => l.id === id)
        if (!lane || lane.members.length < 2) return null
        const rest = s.lanes.filter((l) => l.id !== id)
        const singles = lane.members.map((m) => ({
          ...lane,
          id: newId('lane'),
          name: 'Lane',
          members: [m],
          open: false,
          openedAt: null,
        }))
        return { lanes: renumber(orderLanes([...rest, ...singles], s.units)), selectedLaneIds: [] }
      }),

    renameLane: (id, name) =>
      edit((s) => ({ lanes: s.lanes.map((l) => (l.id === id ? { ...l, name } : l)) })),

    setLaneMode: (id, mode) =>
      edit((s) => ({
        lanes: s.lanes.map((l) =>
          l.id === id
            ? { ...l, mode, open: mode === 'free' ? l.open : false, openedAt: null }
            : l,
        ),
      })),

    setLaneDirection: (id, direction) =>
      edit((s) => ({ lanes: s.lanes.map((l) => (l.id === id ? { ...l, direction } : l)) })),

    setLaneAccessible: (id, v) =>
      edit((s) => {
        const lane = s.lanes.find((l) => l.id === id)
        if (!lane) return null
        const lanes = s.lanes.map((l) => (l.id === id ? { ...l, accessible: v } : l))
        // widen to the accessible minimum where the geometry allows it
        let gaps = s.gaps
        if (v) {
          const g = laneGap(lane, s.units, s.gaps)
          if (g && g.value < ACCESSIBLE_MIN_MM) {
            gaps = { ...gaps, [g.key]: Math.min(g.max, Math.max(g.min, ACCESSIBLE_MIN_MM)) }
          }
        }
        return { lanes, gaps }
      }),

    setLaneHold: (id, holdSec) =>
      edit((s) => ({ lanes: s.lanes.map((l) => (l.id === id ? { ...l, holdSec } : l)) })),

    setLaneLed: (id, led) =>
      edit((s) => ({ lanes: s.lanes.map((l) => (l.id === id ? { ...l, led } : l)) })),

    /* runtime control (never undoable) */
    requestLane: (id) =>
      set((s) => ({
        lanes: s.lanes.map((l) => {
          if (l.id !== id) return l
          if (l.mode === 'locked' || l.mode === 'noentry') return l
          if (l.open) return { ...l, open: false, openedAt: null }
          return { ...l, open: true, openedAt: l.mode === 'badge' ? Date.now() : null }
        }),
      })),

    setLaneOpen: (id, open) =>
      set((s) => ({
        lanes: s.lanes.map((l) => (l.id === id ? { ...l, open, openedAt: null } : l)),
      })),

    openAll: () =>
      set((s) => ({
        lanes: s.lanes.map((l) =>
          l.mode === 'locked' || l.mode === 'noentry' ? l : { ...l, open: true, openedAt: null },
        ),
      })),

    closeAll: () =>
      set((s) => ({ lanes: s.lanes.map((l) => ({ ...l, open: false, openedAt: null })) })),

    emergencyRelease: () =>
      set((s) => ({
        lanes: s.lanes.map((l) => ({ ...l, open: true, openedAt: null, mode: 'free' as LaneMode })),
      })),

    tick: () => {
      const now = Date.now()
      const s = get()
      if (!s.lanes.some((l) => l.openedAt != null && now - l.openedAt > l.holdSec * 1000)) return
      set({
        lanes: s.lanes.map((l) =>
          l.openedAt != null && now - l.openedAt > l.holdSec * 1000
            ? { ...l, open: false, openedAt: null }
            : l,
        ),
      })
    },

    /* appearance */
    setLed: (led) => edit(() => ({ led })),
    setUnitLed: (id, led) =>
      edit((s) => ({ units: s.units.map((u) => (u.id === id ? { ...u, led } : u)) })),
    setFinish: (finish) => edit((s) => ({ finish, units: s.units.map((u) => ({ ...u, finish: null })) })),
    setGlass: (glass) => edit((s) => ({ glass, units: s.units.map((u) => ({ ...u, glass: null })) })),
    setUnitFinish: (id, finish) =>
      edit((s) => ({ units: s.units.map((u) => (u.id === id ? { ...u, finish } : u)) })),
    setUnitGlass: (id, glass) =>
      edit((s) => ({ units: s.units.map((u) => (u.id === id ? { ...u, glass } : u)) })),

    /* camera */
    flyTo: (pos, target) => set((s) => ({ camCmd: { pos, target, n: (s.camCmd?.n ?? 0) + 1 } })),
    registerCapture: (fn) => {
      captureFn = fn
    },
    capture: () => (captureFn ? captureFn() : null),

    /* history */
    undo: () =>
      set((s) => {
        if (!s.past.length) return {}
        const prev = s.past[s.past.length - 1]
        return {
          ...prev,
          past: s.past.slice(0, -1),
          future: [takeDoc(s), ...s.future].slice(0, 60),
          sel: null,
          multi: [],
        }
      }),

    redo: () =>
      set((s) => {
        if (!s.future.length) return {}
        const next = s.future[0]
        return {
          ...next,
          past: [...s.past, takeDoc(s)].slice(-60),
          future: s.future.slice(1),
          sel: null,
          multi: [],
        }
      }),

    saveToLibrary: () => {
      const s = get()
      const entry: SavedCorridor = {
        id: newId('inst'),
        name: installationDisplayName(s.name),
        savedAt: Date.now(),
        thumb: s.capture(),
        schemaVersion: SCHEMA_VERSION,
        doc: takeDoc(s),
      }
      const library = [entry, ...s.library].slice(0, 12)
      persistLibrary(library)
      set({ library })
    },

    loadFromLibrary: (id) =>
      edit((s) => {
        const e = s.library.find((x) => x.id === id)
        if (!e) return null
        const doc = asDoc(e.doc)
        return {
          ...doc,
          lanes: doc.lanes.map((l) => ({ ...l, open: false, openedAt: null })),
          sel: null,
          multi: [],
          selectedLaneIds: [],
          placingType: null,
        }
      }),

    duplicateFromLibrary: (id) => {
      const s = get()
      const e = s.library.find((x) => x.id === id)
      if (!e) return
      const entry: SavedCorridor = {
        ...e,
        id: newId('inst'),
        name: `${installationDisplayName(e.name)} copy`,
        savedAt: Date.now(),
        schemaVersion: SCHEMA_VERSION,
        doc: asDoc(e.doc),
      }
      const library = [entry, ...s.library].slice(0, 12)
      persistLibrary(library)
      set({ library })
    },

    renameLibraryEntry: (id, name) => {
      const library = get().library.map((e) => (e.id === id ? { ...e, name } : e))
      persistLibrary(library)
      set({ library })
    },

    deleteFromLibrary: (id) => {
      const library = get().library.filter((x) => x.id !== id)
      persistLibrary(library)
      set({ library })
    },

    reset: () =>
      edit(() => ({
        ...EMPTY,
        sel: null,
        multi: [],
        selectedLaneIds: [],
        placingType: null,
        multiSelectMode: false,
      })),
  }
})

export const useInstallation = useCorridor

/* ------------------------------------------------------- drag (transient) --- */
// Kept separate from the document so dragging never touches undo history.
export const useDrag = create<{
  type: UnitType | null
  clientX: number
  clientY: number
  index: number | null
  start: (t: UnitType, x: number, y: number) => void
  move: (x: number, y: number) => void
  setIndex: (i: number | null) => void
  clear: () => void
}>((set) => ({
  type: null,
  clientX: 0,
  clientY: 0,
  index: null,
  start: (type, clientX, clientY) => set({ type, clientX, clientY, index: null }),
  move: (clientX, clientY) => set({ clientX, clientY }),
  setIndex: (index) => set((s) => (s.index === index ? {} : { index })),
  clear: () => set({ type: null, index: null }),
}))

/* ---------------------------------------------------------------- layout ---- */

export interface Layout {
  /** world X of each unit centre (m) */
  x: Record<string, number>
  z: Record<string, number>
  rotY: Record<string, number>
  centerX: number
  centerZ: number
  width: number
  ghostX: number | null
  ghostZ: number | null
  /** left edge of each unit body (m), for dimension lines */
  edges: { id: string; left: number; right: number; z: number }[]
  slots: { index: number; x: number; z: number; groupId: string }[]
}

/**
 * Pack units left -> right using real body widths and the resolved clear gaps.
 * `ghost` reserves a slot so the line opens up where a dragged model will land.
 */
export function computeLayout(
  units: PlacedUnit[],
  gaps: Record<string, number>,
  ghost?: { index: number; type: UnitType },
): Layout {
  const x: Record<string, number> = {}
  const z: Record<string, number> = {}
  const rotY: Record<string, number> = {}
  const edges: { id: string; left: number; right: number; z: number }[] = []
  let cursor = 0
  let ghostX: number | null = null

  const ghostUnit: PlacedUnit | null = ghost
    ? { id: '__ghost', type: ghost.type, groupId: units[0]?.groupId ?? '' }
    : null

  const place = (u: PlacedUnit, isGhost: boolean) => {
    const body = CATALOG[u.type].bodyMm / 1000
    const cx = cursor + body / 2
    if (isGhost) ghostX = cx
    else {
      x[u.id] = cx
      z[u.id] = 0
      rotY[u.id] = 0
      edges.push({ id: u.id, left: cursor, right: cursor + body, z: 0 })
    }
    cursor += body
  }

  const seq: { u: PlacedUnit; ghost: boolean }[] = []
  units.forEach((u, i) => {
    if (ghostUnit && ghost!.index === i) seq.push({ u: ghostUnit, ghost: true })
    seq.push({ u, ghost: false })
  })
  if (ghostUnit && ghost!.index >= units.length) seq.push({ u: ghostUnit, ghost: true })

  seq.forEach((item, i) => {
    if (i > 0) {
      const prev = seq[i - 1].u
      cursor += defaultOrResolvedGap(prev, item.u, units, gaps) / 1000
    }
    place(item.u, item.ghost)
  })

  const width = cursor || 1
  return {
    x,
    z,
    rotY,
    centerX: width / 2,
    centerZ: 0,
    width,
    ghostX,
    ghostZ: ghostX != null ? 0 : null,
    edges,
    slots: [],
  }
}

export function computeWorldLayout(
  units: PlacedUnit[],
  gaps: Record<string, number>,
  groups: LaneGroup[],
  ghost?: { index: number; type: UnitType; groupId: string },
): Layout {
  const list = groups.length ? groups : [{ id: 'lg_implicit', originX: 0, originZ: 0, rotationY: 0 } as LaneGroup]
  const x: Record<string, number> = {}
  const z: Record<string, number> = {}
  const rotY: Record<string, number> = {}
  const edges: Layout['edges'] = []
  const slots: Layout['slots'] = []
  let ghostX: number | null = null
  let ghostZ: number | null = null
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (const g of list) {
    const members = units.filter((u) => (u.groupId || g.id) === g.id)
    const gGhost = ghost && ghost.groupId === g.id ? { index: ghost.index, type: ghost.type } : undefined
    const local = computeLayout(members, gaps, gGhost)
    const cos = Math.cos(g.rotationY ?? 0)
    const sin = Math.sin(g.rotationY ?? 0)
    for (const u of members) {
      const lx = (local.x[u.id] ?? 0) - local.centerX
      const wx = g.originX + lx * cos
      const wz = g.originZ + lx * sin
      x[u.id] = wx
      z[u.id] = wz
      rotY[u.id] = (g.rotationY ?? 0) + (u.flipped ? Math.PI : 0)
      minX = Math.min(minX, wx)
      maxX = Math.max(maxX, wx)
      minZ = Math.min(minZ, wz)
      maxZ = Math.max(maxZ, wz)
    }
    for (const e of local.edges) {
      const lx = (e.left + e.right) / 2 - local.centerX
      edges.push({
        id: e.id,
        left: g.originX + (e.left - local.centerX) * cos,
        right: g.originX + (e.right - local.centerX) * cos,
        z: g.originZ + lx * sin,
      })
    }
    if (local.ghostX != null && gGhost) {
      const lx = local.ghostX - local.centerX
      ghostX = g.originX + lx * cos
      ghostZ = g.originZ + lx * sin
    }
    const slotType = ghost?.type ?? 'hg02_center'
    for (let i = 0; i <= members.length; i++) {
      const sl = computeLayout(members, gaps, { index: i, type: slotType })
      if (sl.ghostX == null) continue
      const lx = sl.ghostX - sl.centerX
      slots.push({
        index: i,
        x: g.originX + lx * cos,
        z: g.originZ + lx * sin,
        groupId: g.id,
      })
    }
  }

  if (!Number.isFinite(minX)) {
    minX = 0
    maxX = 1
    minZ = 0
    maxZ = 0
  }
  return {
    x,
    z,
    rotY,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: Math.max(maxX - minX, 1),
    ghostX,
    ghostZ,
    edges,
    slots,
  }
}

function defaultOrResolvedGap(
  left: PlacedUnit,
  right: PlacedUnit,
  units: PlacedUnit[],
  gaps: Record<string, number>,
): number {
  const i = units.findIndex((u) => u.id === left.id)
  if (i >= 0 && units[i + 1] && units[i + 1].id === right.id) return gapAt(units, i, gaps)
  const lo = minGapMm(left, right)
  return Math.max(lo, Math.min(maxGapMm(left, right), defaultGapMm(left, right)))
}

/** open fraction target per wing key `${unitId}:${wing}` */
export function wingTargets(lanes: Lane[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const lane of lanes) {
    for (const m of lane.members) map[`${m.unitId}:${m.wing}`] = lane.open ? 1 : 0
  }
  return map
}

/** the lane a given wing belongs to */
export function laneOfWing(lanes: Lane[], unitId: string, wing: WingId): Lane | null {
  return lanes.find((l) => l.members.some((m) => m.unitId === unitId && m.wing === wing)) ?? null
}

/** lanes a unit participates in */
export function lanesOfUnit(lanes: Lane[], unitId: string): Lane[] {
  return lanes.filter((l) => l.members.some((m) => m.unitId === unitId))
}
