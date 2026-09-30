import { api } from './client'
import type { FinishId, GlassId, LedConfig, UnitType } from '../model/catalog'
import {
  finishFromApi,
  glassFromApi,
  ledFromApi,
  unitTypeFromTurnstile,
  type CreateTurnstileBody,
  type TurnstileDto,
} from './turnstiles'

export type { CreateTurnstileBody, TurnstileDto } from './turnstiles'

export type CreateLaneBody = {
  name: string
  lane_group: number
  turnstyles: CreateTurnstileBody[]
  width: number
  /** Omitted until the user selects an entry pin. */
  entry_pin?: number
  /** Omitted until the user selects an exit pin. */
  exit_pin?: number
  /** Who created the lane — prefer authenticated username when available. */
  created_by: string
}

export type LaneDto = {
  id: string | number
  name: string
  lane_group?: number | string
  turnstyles?: TurnstileDto[]
  width?: number
  entry_pin?: number | null
  exit_pin?: number | null
  /** Auto-close / hold delay from the API, in milliseconds. */
  delay?: number | null
  /** When true, lane stays open until manually closed (no auto-close timer). */
  keep_open?: boolean | null
  created_by?: string
}

export type UpdateLaneBody = {
  /** Delay in milliseconds (API unit). */
  delay?: number
  width?: number
  entry_pin?: number | null
  exit_pin?: number | null
  keep_open?: boolean
}

/** Convert API delay (ms) → seconds for hold timers only. */
export function delayMsToSec(ms: unknown): number | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return null
  return ms / 1000
}

/** Prefer the backend delay value as-is (milliseconds) when present. */
export function laneDelayFromApi(delay: unknown): number | null {
  if (typeof delay !== 'number' || !Number.isFinite(delay) || delay < 0) return null
  return delay
}

/** Prefer the backend width value as-is when present. */
export function laneWidthFromApi(width: unknown): number | null {
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) return null
  return width
}

export function laneKeepOpenFromApi(value: unknown): boolean {
  return value === true
}

const PATH = '/api/lanes/'

const asList = (data: unknown): LaneDto[] => {
  if (Array.isArray(data)) return data as LaneDto[]
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: LaneDto[] }).results
  }
  return []
}

export const listLanes = async () => {
  const data = await api.get<unknown>(PATH)
  return asList(data)
}

export const getLane = async (id: string | number) => {
  return api.get<LaneDto>(`${PATH}${id}/`)
}

export const createLane = async (body: CreateLaneBody) => {
  return api.post<LaneDto>(PATH, body)
}

export const deleteLane = async (id: string | number) => {
  return api.delete(`${PATH}${id}/`)
}

export const updateLane = async (id: string | number, body: UpdateLaneBody) => {
  return api.patch<LaneDto>(`${PATH}${id}/`, body)
}

export type TriggerLaneBody = {
  user?: string
  remarks?: string
}

export type TriggerLaneResponse = {
  message?: string
  lane_id?: number | string
  direction?: string
}

export const triggerLaneEntry = async (id: string | number, body: TriggerLaneBody = {}) => {
  return api.patch<TriggerLaneResponse>(`${PATH}${id}/trigger/entry/`, body)
}

export const triggerLaneExit = async (id: string | number, body: TriggerLaneBody = {}) => {
  return api.patch<TriggerLaneResponse>(`${PATH}${id}/trigger/exit/`, body)
}

/** Unit ids from hydrate look like `srv_{laneId}_{index}`. */
export function serverLaneIdFromUnitId(unitId: string): string | null {
  const m = /^srv_([^_]+)_/.exec(unitId)
  return m ? m[1] : null
}

/**
 * Server lane that owns a local passage — prefer the rightmost member.
 * Matches hydrate: that server lane's clear width is assigned to the gap.
 */
export function owningServerLaneId(
  members: Array<{ unitId: string }>,
): string | null {
  for (let i = members.length - 1; i >= 0; i--) {
    const sid = serverLaneIdFromUnitId(members[i].unitId)
    if (sid) return sid
  }
  return null
}

export function normalizePin(value: unknown): number | null {
  return typeof value === 'number' && value >= 1 ? value : null
}

/** Whether operate UI should offer separate exit vs entry triggers. */
export function hasDistinctExitPin(
  entryPin: number | null | undefined,
  exitPin: number | null | undefined,
): boolean {
  const entry = normalizePin(entryPin)
  const exit = normalizePin(exitPin)
  return entry != null && exit != null && entry !== exit
}

export type HydratedUnit = {
  id: string
  type: UnitType
  groupId: string
  flipped?: boolean
  turnstileId?: string
  turnstileMake?: string
  turnstileModel?: string
  turnstileType?: string
  turnstileIsLeft?: boolean
  finish?: FinishId | null
  glass?: GlassId | null
  led?: LedConfig | null
}

/**
 * Build local placements from GET /api/lanes/.
 * Keeps the backend order of lanes and turnstyles (no id / left-center-right re-sort).
 * `is_left` / `type` only control flip for the right-hand end cabinet.
 */
export function hydrateUnitsFromServerLanes(serverLanes: LaneDto[]): {
  units: HydratedUnit[]
  gaps: Record<string, number>
  groupClearMm: Record<string, number>
} {
  // Preserve GET order when bucketing by group (Map insertion order).
  const byGroup = new Map<string, LaneDto[]>()
  for (const lane of serverLanes) {
    if (lane.lane_group == null || lane.lane_group === '') continue
    const gid = String(lane.lane_group)
    const list = byGroup.get(gid) ?? []
    list.push(lane)
    byGroup.set(gid, list)
  }

  const units: HydratedUnit[] = []
  const gaps: Record<string, number> = {}
  const groupClearMm: Record<string, number> = {}

  for (const [gid, lanes] of byGroup) {
    let prevUnitId: string | null = null
    for (const lane of lanes) {
      const widthCm = laneWidthFromApi(lane.width) ?? 60
      const clearMm = Math.round(widthCm * 10)
      if (groupClearMm[gid] == null) groupClearMm[gid] = clearMm

      // Keep turnstile order from the API (left → center → right as the backend sends them).
      const turnstyles = lane.turnstyles ?? []
      turnstyles.forEach((ts, i) => {
        const type = unitTypeFromTurnstile(ts)
        if (!type) return
        const kind = `${ts.type ?? ''}`.toLowerCase()
        // Right-side end cabinet faces the other way; center / left stay as-is.
        const flipped = kind !== 'center' && ts.is_left === false
        const id = `srv_${lane.id}_${i}`
        units.push({
          id,
          type,
          groupId: gid,
          flipped,
          turnstileId: ts.id != null ? String(ts.id) : undefined,
          turnstileMake: ts.make,
          turnstileModel: ts.model,
          turnstileType: ts.type != null ? String(ts.type) : undefined,
          turnstileIsLeft: typeof ts.is_left === 'boolean' ? ts.is_left : undefined,
          finish: finishFromApi(ts.cabinet_finish),
          glass: glassFromApi(ts.glass_finish),
          led: ledFromApi(ts),
        })
        if (prevUnitId) gaps[prevUnitId] = clearMm
        prevUnitId = id
      })
    }
  }

  return { units, gaps, groupClearMm }
}
