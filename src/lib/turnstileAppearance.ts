import {
  appearanceBodyFromLocal,
  apiTypeFromUnitType,
  updateTurnstile,
  type ApiTurnstileType,
} from '../api/turnstiles'
import type { FinishId, GlassId, LedConfig } from '../model/catalog'
import { MANUFACTURERS, modelOfUnitType } from '../model/products'
import { useCorridor, type PlacedUnit } from '../store/corridor'

function resolveApiType(unit: PlacedUnit): ApiTurnstileType {
  const raw = unit.turnstileType?.toLowerCase()
  if (raw === 'center' || raw === 'side' || raw === 'differently_abled') return raw
  return apiTypeFromUnitType(unit.type)
}

function identityBody(unit: PlacedUnit) {
  const product = modelOfUnitType(unit.type)
  const maker = MANUFACTURERS.find((m) => m.id === product.manufacturerId)
  return {
    make: unit.turnstileMake || maker?.name || '',
    model: unit.turnstileModel || product.name,
    type: resolveApiType(unit),
    is_left: unit.turnstileIsLeft ?? !unit.flipped,
  }
}

/** PATCH turnstile appearance fields, then apply locally on success. */
export async function saveTurnstileAppearance(
  unit: PlacedUnit,
  patch: {
    finish?: FinishId | null
    glass?: GlassId | null
    led?: LedConfig | null
  },
): Promise<void> {
  if (!unit.turnstileId) {
    throw new Error('This turnstile is not linked to the server yet')
  }

  const body = {
    ...identityBody(unit),
    ...appearanceBodyFromLocal(patch),
  }

  await updateTurnstile(unit.turnstileId, body)

  const store = useCorridor.getState()
  if (patch.finish !== undefined) store.setUnitFinish(unit.id, patch.finish)
  if (patch.glass !== undefined) store.setUnitGlass(unit.id, patch.glass)
  if (patch.led !== undefined) store.setUnitLed(unit.id, patch.led)
}
