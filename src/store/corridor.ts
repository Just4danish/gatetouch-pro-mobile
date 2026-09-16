import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import {
  ACCESSIBLE_MIN_MM,
  CATALOG,
  GAP_DEFAULT_CLEARANCE_MM,
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
import { TEMPLATES } from '../model/templates'

/* ------------------------------------------------------------------ types --- */

export interface PlacedUnit {
  id: string
  type: UnitType
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
}

export type Mode = 'build' | 'operate'

/** 'off' loads no character GLBs at all; each level above fetches more. */
export type CrowdLevel = 'off' | 'few' | 'busy'

export type Selection = { kind: 'unit' | 'lane'; id: string } | null

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
  doc: Doc
}

/** The undoable document. */
export interface Doc {
  name: string
  units: PlacedUnit[]
  lanes: Lane[]
  /** clear gap in mm after the unit with this id */
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
  insertUnit: (t: UnitType, index?: number) => void
  removeUnit: (id: string) => void
  removeMany: (ids: string[]) => void
  duplicateMany: (ids: string[]) => void
  flipUnit: (id: string) => void
  reorder: (from: number, to: number) => void
  nudgeUnit: (id: string, dir: -1 | 1) => void

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
  applyTemplate: (id: string) => void
  saveToLibrary: () => void
  loadFromLibrary: (id: string) => void
  deleteFromLibrary: (id: string) => void
  reset: () => void
  /** Load library from AsyncStorage once at startup. */
  hydrate: () => Promise<void>
  libraryHydrated: boolean
}

/* -------------------------------------------------------------- utilities --- */

const LIB_KEY = 'gatetouch_library_v1'
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
export function defaultGapMm(left: PlacedUnit, right: PlacedUnit): number {
  return minGapMm(left, right) + GAP_DEFAULT_CLEARANCE_MM
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
): number | null {
  return laneGap(lane, units, gaps)?.value ?? null
}

function wingsOf(u: PlacedUnit): WingRef[] {
  return CATALOG[u.type].wings.map((wing) => ({ unitId: u.id, wing }))
}

export function allWings(units: PlacedUnit[]): WingRef[] {
  return units.flatMap(wingsOf)
}

function baseLane(members: WingRef[], i: number): Lane {
  return {
    id: newId('lane'),
    name: `Lane ${i + 1}`,
    color: LANE_COLORS[i % LANE_COLORS.length],
    members,
    open: false,
    openedAt: null,
    mode: 'badge',
    direction: 'both',
    accessible: false,
    holdSec: 4,
    led: null,
  }
}

function lanesPerWing(units: PlacedUnit[]): Lane[] {
  return allWings(units).map((w, i) => baseLane([w], i))
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
  return renumber(
    lanes
      .map((l) => ({ ...l, members: l.members.filter((m) => live.has(m.unitId)) }))
      .filter((l) => l.members.length > 0),
  )
}

function coverOrphans(lanes: Lane[], units: PlacedUnit[]): Lane[] {
  const held = new Set(lanes.flatMap((l) => l.members.map((m) => `${m.unitId}:${m.wing}`)))
  const extra: Lane[] = []
  for (const w of allWings(units)) {
    if (!held.has(`${w.unitId}:${w.wing}`)) extra.push(baseLane([w], 0))
  }
  return renumber([...lanes, ...extra])
}

const takeDoc = (s: State): Doc => ({
  name: s.name,
  units: s.units,
  lanes: s.lanes,
  gaps: s.gaps,
  led: s.led,
  finish: s.finish,
  glass: s.glass,
})

async function loadLibrary(): Promise<SavedCorridor[]> {
  try {
    const raw = await AsyncStorage.getItem(LIB_KEY)
    return raw ? (JSON.parse(raw) as SavedCorridor[]) : []
  } catch {
    return []
  }
}

function persistLibrary(lib: SavedCorridor[]) {
  void AsyncStorage.setItem(LIB_KEY, JSON.stringify(lib)).catch(() => {
    /* quota / unavailable — ignore */
  })
}

const EMPTY: Doc = {
  name: 'New corridor',
  units: [],
  lanes: [],
  gaps: {},
  led: LED_DEFAULT,
  finish: 'steel',
  glass: 'clear',
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

    past: [],
    future: [],
    library: [],
    libraryHydrated: false,

    hydrate: async () => {
      const library = await loadLibrary()
      set({ library, libraryHydrated: true })
    },

    /* view */
    // drop the selection so the inspector never covers the other mode's dock
    setMode: (mode) => set({ mode, contextMenu: null, sel: null, multi: [] }),
    setEnv: (env) => set({ env }),
    toggleDims: () => set((s) => ({ showDims: !s.showDims })),
    setCrowd: (crowd) => set({ crowd }),
    setName: (name) => set({ name }),

    /* units */
    addUnit: (t) => get().insertUnit(t),

    insertUnit: (t, index) =>
      edit((s) => {
        const unit: PlacedUnit = { id: newId(t), type: t }
        const units = [...s.units]
        const at = index == null ? units.length : Math.max(0, Math.min(index, units.length))
        units.splice(at, 0, unit)
        return {
          units,
          lanes: coverOrphans(s.lanes, units),
          sel: { kind: 'unit', id: unit.id },
        }
      }),

    removeUnit: (id) => get().removeMany([id]),

    removeMany: (ids) =>
      edit((s) => {
        const kill = new Set(ids)
        const units = s.units.filter((u) => !kill.has(u.id))
        return {
          units,
          lanes: pruneLanes(s.lanes, units),
          sel: s.sel && kill.has(s.sel.id) ? null : s.sel,
          multi: s.multi.filter((m) => !kill.has(m)),
          contextMenu: null,
        }
      }),

    duplicateMany: (ids) =>
      edit((s) => {
        if (!ids.length) return null
        const units = [...s.units]
        // insert each copy right after its original, walking right-to-left
        const order = ids
          .map((id) => units.findIndex((u) => u.id === id))
          .filter((i) => i >= 0)
          .sort((a, b) => b - a)
        for (const i of order) {
          const src = units[i]
          units.splice(i + 1, 0, { ...src, id: newId(src.type) })
        }
        return { units, lanes: coverOrphans(s.lanes, units), contextMenu: null }
      }),

    flipUnit: (id) =>
      edit((s) => ({
        units: s.units.map((u) => (u.id === id ? { ...u, flipped: !u.flipped } : u)),
        contextMenu: null,
      })),

    reorder: (from, to) =>
      edit((s) => {
        if (from === to || from < 0 || to < 0 || from >= s.units.length || to >= s.units.length)
          return null
        const units = [...s.units]
        const [m] = units.splice(from, 1)
        units.splice(to, 0, m)
        return { units }
      }),

    nudgeUnit: (id, dir) =>
      edit((s) => {
        const i = s.units.findIndex((u) => u.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= s.units.length) return null
        const units = [...s.units]
        ;[units[i], units[j]] = [units[j], units[i]]
        return { units }
      }),

    /* selection */
    select: (sel) => set({ sel, contextMenu: null }),
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
        if (!g) return null
        return { gaps: { ...s.gaps, [g.key]: Math.max(g.min, Math.min(g.max, mm)) } }
      }),

    /* lanes */
    autoLanes: () => edit((s) => ({ lanes: lanesPerWing(s.units), selectedLaneIds: [] })),

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
          name: 'Lane',
          members: chosen.flatMap((l) => l.members),
          open: false,
          openedAt: null,
        }
        return { lanes: renumber([...rest, merged]), selectedLaneIds: [] }
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
        return { lanes: renumber([...rest, ...singles]), selectedLaneIds: [] }
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

    applyTemplate: (id) =>
      edit(() => {
        const t = TEMPLATES.find((x) => x.id === id)
        if (!t) return null
        const units: PlacedUnit[] = t.units.map((u) => ({
          id: newId(u.type),
          type: u.type,
          flipped: u.flipped,
        }))
        let lanes = lanesPerWing(units)
        if (t.groups) {
          const used = new Set<number>()
          const merged: Lane[] = []
          for (const g of t.groups) {
            const members = g.flatMap((wi) => lanes[wi]?.members ?? [])
            if (!members.length) continue
            g.forEach((wi) => used.add(wi))
            merged.push({ ...lanes[g[0]], id: newId('lane'), name: 'Lane', members })
          }
          const singles = lanes.filter((_, i) => !used.has(i))
          lanes = renumber([...singles, ...merged])
        }
        if (t.accessible) {
          lanes = lanes.map((l, i) => (t.accessible!.includes(i) ? { ...l, accessible: true } : l))
        }
        const gaps: Record<string, number> = {}
        lanes.forEach((l) => {
          if (!l.accessible) return
          const g = laneGap(l, units, gaps)
          if (g) gaps[g.key] = Math.min(g.max, Math.max(g.min, ACCESSIBLE_MIN_MM))
        })
        return { name: t.label, units, lanes, gaps, sel: null, multi: [], selectedLaneIds: [] }
      }),

    saveToLibrary: () => {
      const s = get()
      const entry: SavedCorridor = {
        id: newId('corr'),
        name: s.name,
        savedAt: Date.now(),
        thumb: s.capture(),
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
        return {
          ...e.doc,
          lanes: e.doc.lanes.map((l) => ({ ...l, open: false, openedAt: null })),
          sel: null,
          multi: [],
          selectedLaneIds: [],
        }
      }),

    deleteFromLibrary: (id) => {
      const library = get().library.filter((x) => x.id !== id)
      persistLibrary(library)
      set({ library })
    },

    reset: () => edit(() => ({ ...EMPTY, sel: null, multi: [], selectedLaneIds: [] })),
  }
})

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
  centerX: number
  width: number
  ghostX: number | null
  /** left edge of each unit body (m), for dimension lines */
  edges: { id: string; left: number; right: number }[]
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
  const edges: { id: string; left: number; right: number }[] = []
  let cursor = 0
  let ghostX: number | null = null

  const ghostUnit: PlacedUnit | null = ghost
    ? { id: '__ghost', type: ghost.type }
    : null

  const place = (u: PlacedUnit, isGhost: boolean) => {
    const body = CATALOG[u.type].bodyMm / 1000
    const cx = cursor + body / 2
    if (isGhost) ghostX = cx
    else {
      x[u.id] = cx
      edges.push({ id: u.id, left: cursor, right: cursor + body })
    }
    cursor += body
  }

  const seq: { u: PlacedUnit; ghost: boolean }[] = []
  units.forEach((u, i) => {
    if (ghostUnit && ghost!.index === i) seq.push({ u: ghostUnit, ghost: true })
    seq.push({ u, ghost: false })
    void i
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
  return { x, centerX: width / 2, width, ghostX, edges }
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
