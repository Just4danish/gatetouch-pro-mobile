import { api } from './client'
import { TURNSTILE_MODELS, type TurnstileModel } from '../model/products'
import {
  FINISH_ORDER,
  FINISHES,
  GLASS_ORDER,
  GLASSES,
  LED_BEHAVIORS,
  LED_DEFAULT,
  type FinishId,
  type GlassId,
  type LedBehavior,
  type LedConfig,
  type UnitType,
} from '../model/catalog'

/**
 * Backend turnstile `type` values (GET /api/turnstyles/):
 * - center → center cabinet
 * - side → single end cabinet
 * - differently_abled → speedgatex / accessible
 */
export type ApiTurnstileType = 'center' | 'side' | 'differently_abled'

export type CreateTurnstileBody = {
  make: string
  model: string
  type: ApiTurnstileType
  is_left: boolean
}

/** Appearance fields on lane.turnstyles[] / turnstile detail. */
export type TurnstileAppearanceDto = {
  cabinet_finish?: string | null
  glass_finish?: string | null
  led_colour?: string | null
  led_brightness?: number | null
  led_pattern?: string | null
}

export type TurnstileDto = {
  id?: string | number
  make?: string
  model?: string
  type?: ApiTurnstileType | string
  is_left?: boolean
  entry_pin?: number | null
  exit_pin?: number | null
} & TurnstileAppearanceDto

export type UpdateTurnstileBody = {
  make?: string
  model?: string
  type?: ApiTurnstileType
  is_left?: boolean
} & TurnstileAppearanceDto

const PATH = '/api/turnstyles/'

const asList = (data: unknown): TurnstileDto[] => {
  if (Array.isArray(data)) return data as TurnstileDto[]
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: TurnstileDto[] }).results
  }
  return []
}

const normalizeModelKey = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, '')

const normalizeChoiceKey = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, '')

/** Map local UnitType → backend turnstile type. */
export function apiTypeFromUnitType(type: UnitType): ApiTurnstileType {
  if (type === 'hg02_center') return 'center'
  if (type === 'gla1') return 'differently_abled'
  return 'side'
}

/** Map backend turnstile type → local UnitType. */
export function unitTypeFromApiType(type: string): UnitType | null {
  const t = type.toLowerCase()
  if (t === 'center') return 'hg02_center'
  if (t === 'side') return 'hg02_single'
  if (t === 'differently_abled') return 'gla1'
  return null
}

/** Map API turnstile onto local UnitType.
 * Prefer model name — GET often stores Speed Gate X as type "side".
 * Then use backend type (center / side / differently_abled).
 */
export function unitTypeFromTurnstile(ts: TurnstileDto): UnitType | null {
  const raw = `${ts.model ?? ''}`
  const key = normalizeModelKey(raw)

  for (const m of TURNSTILE_MODELS) {
    if (key === normalizeModelKey(m.name) || key === normalizeModelKey(m.modelCode) || key === m.id) {
      return m.id
    }
  }

  if (key.includes('speedgatex') || key.includes('speedgate') || (key.includes('gla') && !key.includes('hg'))) {
    return 'gla1'
  }
  if (key.includes('hg02c') || (key.includes('center') && key.includes('hg'))) return 'hg02_center'
  if (key.includes('hg02') || key.includes('single')) return 'hg02_single'

  // Fallback when model is UNKNOWN / missing — use backend type.
  const apiType = `${ts.type ?? ''}`.toLowerCase()
  if (apiType === 'differently_abled') return 'gla1'
  if (apiType === 'center') return 'hg02_center'
  if (apiType === 'side') return 'hg02_single'
  return null
}

export function modelLabel(type: UnitType): string {
  const m: TurnstileModel | undefined = TURNSTILE_MODELS.find((x) => x.id === type)
  return m?.name ?? type
}

export function finishFromApi(value: unknown): FinishId | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const key = normalizeChoiceKey(value)
  for (const id of FINISH_ORDER) {
    if (normalizeChoiceKey(id) === key || normalizeChoiceKey(FINISHES[id].label) === key) return id
  }
  if (key.includes('steel') || key.includes('brush')) return 'steel'
  if (key.includes('black') || key.includes('matte')) return 'black'
  if (key.includes('champagn') || key.includes('gold')) return 'champagne'
  if (key.includes('white') || key.includes('pure')) return 'white'
  return null
}

export function glassFromApi(value: unknown): GlassId | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const key = normalizeChoiceKey(value)
  for (const id of GLASS_ORDER) {
    if (normalizeChoiceKey(id) === key || normalizeChoiceKey(GLASSES[id].label) === key) return id
  }
  if (key.includes('frost')) return 'frosted'
  if (key.includes('smoke')) return 'smoke'
  if (key.includes('bronz')) return 'bronze'
  if (key.includes('clear')) return 'clear'
  return null
}

function behaviorFromApi(value: unknown): LedBehavior {
  if (typeof value !== 'string' || !value.trim()) return LED_DEFAULT.behavior
  const key = normalizeChoiceKey(value)
  for (const b of LED_BEHAVIORS) {
    if (normalizeChoiceKey(b.id) === key || normalizeChoiceKey(b.label) === key) return b.id
  }
  return LED_DEFAULT.behavior
}

function brightnessFromApi(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return LED_DEFAULT.intensity
  // Backend may store 0–100 percent; our UI uses ~0.2–4.0×.
  if (value > 10) return Math.min(4, Math.max(0.2, +(value / 25).toFixed(1)))
  return Math.min(4, Math.max(0.2, value))
}

export function ledFromApi(ts: TurnstileAppearanceDto): LedConfig | null {
  const colour =
    typeof ts.led_colour === 'string' && ts.led_colour.trim() ? ts.led_colour.trim() : null
  const hasBrightness = typeof ts.led_brightness === 'number' && Number.isFinite(ts.led_brightness)
  const hasPattern = typeof ts.led_pattern === 'string' && ts.led_pattern.trim().length > 0
  if (!colour && !hasBrightness && !hasPattern) return null
  return {
    color: colour ?? LED_DEFAULT.color,
    intensity: brightnessFromApi(ts.led_brightness),
    behavior: behaviorFromApi(ts.led_pattern),
  }
}

export function appearanceBodyFromLocal(opts: {
  finish?: FinishId | null
  glass?: GlassId | null
  led?: LedConfig | null
}): TurnstileAppearanceDto {
  const body: TurnstileAppearanceDto = {}
  if (opts.finish !== undefined) body.cabinet_finish = opts.finish
  if (opts.glass !== undefined) body.glass_finish = opts.glass
  if (opts.led !== undefined) {
    if (opts.led == null) {
      body.led_colour = null
      body.led_brightness = null
      body.led_pattern = null
    } else {
      body.led_colour = opts.led.color
      body.led_brightness = opts.led.intensity
      body.led_pattern = opts.led.behavior
    }
  }
  return body
}

export const listTurnstiles = async () => {
  const data = await api.get<unknown>(PATH)
  return asList(data)
}

export const updateTurnstile = async (id: string | number, body: UpdateTurnstileBody) => {
  return api.patch<TurnstileDto>(`${PATH}${id}/`, body)
}

export const deleteTurnstile = async (id: string | number) => {
  return api.delete(`${PATH}${id}/`)
}
