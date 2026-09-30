import {
  apiTypeFromUnitType,
  deleteTurnstile,
  updateTurnstile,
  type ApiTurnstileType,
} from '../api/turnstiles'
import { MANUFACTURERS, modelOfUnitType } from '../model/products'
import { useCorridor, type PlacedUnit } from '../store/corridor'

function resolveApiType(unit: PlacedUnit): ApiTurnstileType {
  const raw = unit.turnstileType?.toLowerCase()
  if (raw === 'center' || raw === 'side' || raw === 'differently_abled') return raw
  return apiTypeFromUnitType(unit.type)
}

/** PATCH turnstile is_left, then flip the local unit on success. */
export async function flipTurnstileOnServer(unit: PlacedUnit): Promise<void> {
  if (!unit.turnstileId) {
    throw new Error('This turnstile is not linked to the server yet')
  }

  const product = modelOfUnitType(unit.type)
  const maker = MANUFACTURERS.find((m) => m.id === product.manufacturerId)
  const currentLeft = unit.turnstileIsLeft ?? !unit.flipped
  const nextLeft = !currentLeft

  await updateTurnstile(unit.turnstileId, {
    make: unit.turnstileMake || maker?.name || '',
    model: unit.turnstileModel || product.name,
    type: resolveApiType(unit),
    is_left: nextLeft,
  })

  useCorridor.getState().flipUnit(unit.id)
}

/** DELETE turnstile on server when linked, then remove the local unit. */
export async function deleteTurnstileOnServer(unit: PlacedUnit): Promise<void> {
  if (unit.turnstileId) {
    await deleteTurnstile(unit.turnstileId)
  }
  useCorridor.getState().removeUnit(unit.id)
}
