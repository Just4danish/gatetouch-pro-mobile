/**
 * Product library. Manufacturers and turnstile models are data, not UI.
 * CAME is the only enabled manufacturer today; more can be added without
 * changing placement or inspector code.
 */
import { CATALOG, FINISH_ORDER, GLASS_ORDER, type FinishId, type GlassId, type UnitType } from './catalog'

export type ManufacturerId = string
export type ModelId = UnitType

export type TurnstileCategory = 'swing' | 'speed' | 'tripod' | 'full_height'

export interface Manufacturer {
  id: ManufacturerId
  name: string
  logo?: string
  description: string
  enabled: boolean
}

export interface LaneAnchors {
  /** millimetres from product origin to the left passage face */
  leftLaneMm: number
  /** millimetres from product origin to the right passage face */
  rightLaneMm: number
  /** millimetres; floor contact is always y = 0 */
  originFloorMm: number
  frontDirection: 'plusZ' | 'minusZ'
  defaultRotationDeg: number
}

export interface ModelCapabilities {
  supportsLeftEnd: boolean
  supportsMiddle: boolean
  supportsRightEnd: boolean
  supportsBidirectional: boolean
  supportsAccessibleLane: boolean
  supportedLaneWidthRange: { minMm: number; maxMm: number }
}

export interface TurnstileModel {
  id: ModelId
  manufacturerId: ManufacturerId
  name: string
  modelCode: string
  category: TurnstileCategory
  description: string
  /** UnitType / GLB key used by the 3D stage */
  model3D: UnitType
  previewImage?: string
  widthMm: number
  lengthMm: number
  heightMm: number
  anchors: LaneAnchors
  capabilities: ModelCapabilities
  finishes: FinishId[]
  glasses: GlassId[]
}

export const MANUFACTURERS: Manufacturer[] = [
  {
    id: 'came',
    name: 'CAME',
    description: 'Speed gates and swing gates for lobby and transit installations.',
    enabled: true,
  },
]

export const TURNSTILE_MODELS: TurnstileModel[] = [
  {
    id: 'gla1',
    manufacturerId: 'came',
    name: 'Speed Gate X',
    modelCode: 'GL A1',
    category: 'swing',
    description: 'Column swing gate for accessible and wide lanes.',
    model3D: 'gla1',
    widthMm: CATALOG.gla1.bodyMm,
    lengthMm: CATALOG.gla1.depthMm,
    heightMm: CATALOG.gla1.heightMm,
    anchors: {
      leftLaneMm: CATALOG.gla1.bodyMm / 2,
      rightLaneMm: CATALOG.gla1.bodyMm / 2,
      originFloorMm: 0,
      frontDirection: 'plusZ',
      defaultRotationDeg: 0,
    },
    capabilities: {
      supportsLeftEnd: true,
      supportsMiddle: false,
      supportsRightEnd: true,
      supportsBidirectional: true,
      supportsAccessibleLane: true,
      supportedLaneWidthRange: { minMm: 900, maxMm: 1600 },
    },
    finishes: [...FINISH_ORDER],
    glasses: [...GLASS_ORDER],
  },
  {
    id: 'hg02_single',
    manufacturerId: 'came',
    name: 'HG 02 EU Single',
    modelCode: 'HG02-S',
    category: 'speed',
    description: 'End cabinet with one sliding wing.',
    model3D: 'hg02_single',
    widthMm: CATALOG.hg02_single.bodyMm,
    lengthMm: CATALOG.hg02_single.depthMm,
    heightMm: CATALOG.hg02_single.heightMm,
    anchors: {
      leftLaneMm: CATALOG.hg02_single.bodyMm / 2,
      rightLaneMm: CATALOG.hg02_single.bodyMm / 2,
      originFloorMm: 0,
      frontDirection: 'plusZ',
      defaultRotationDeg: 0,
    },
    capabilities: {
      supportsLeftEnd: true,
      supportsMiddle: false,
      supportsRightEnd: true,
      supportsBidirectional: true,
      supportsAccessibleLane: true,
      supportedLaneWidthRange: { minMm: 550, maxMm: 1200 },
    },
    finishes: [...FINISH_ORDER],
    glasses: [...GLASS_ORDER],
  },
  {
    id: 'hg02_center',
    manufacturerId: 'came',
    name: 'HG 02 EU Center',
    modelCode: 'HG02-C',
    category: 'speed',
    description: 'Mid-row cabinet with two sliding wings.',
    model3D: 'hg02_center',
    widthMm: CATALOG.hg02_center.bodyMm,
    lengthMm: CATALOG.hg02_center.depthMm,
    heightMm: CATALOG.hg02_center.heightMm,
    anchors: {
      leftLaneMm: CATALOG.hg02_center.bodyMm / 2,
      rightLaneMm: CATALOG.hg02_center.bodyMm / 2,
      originFloorMm: 0,
      frontDirection: 'plusZ',
      defaultRotationDeg: 0,
    },
    capabilities: {
      supportsLeftEnd: false,
      supportsMiddle: true,
      supportsRightEnd: false,
      supportsBidirectional: true,
      supportsAccessibleLane: true,
      supportedLaneWidthRange: { minMm: 550, maxMm: 1200 },
    },
    finishes: [...FINISH_ORDER],
    glasses: [...GLASS_ORDER],
  },
]

export const MODEL_BY_ID: Record<ModelId, TurnstileModel> = Object.fromEntries(
  TURNSTILE_MODELS.map((m) => [m.id, m]),
) as Record<ModelId, TurnstileModel>

export function enabledManufacturers(): Manufacturer[] {
  return MANUFACTURERS.filter((m) => m.enabled)
}

export function modelsForManufacturer(manufacturerId: ManufacturerId): TurnstileModel[] {
  return TURNSTILE_MODELS.filter((m) => m.manufacturerId === manufacturerId)
}

export function modelOfUnitType(type: UnitType): TurnstileModel {
  return MODEL_BY_ID[type]
}

export function categoryLabel(cat: TurnstileCategory): string {
  if (cat === 'swing') return 'Swing gate'
  if (cat === 'speed') return 'Speed gate'
  if (cat === 'tripod') return 'Tripod'
  return 'Full height'
}

export function formatDimsMm(m: TurnstileModel): string {
  return `${m.widthMm} × ${m.lengthMm} × ${m.heightMm} mm`
}
