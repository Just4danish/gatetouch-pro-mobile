import { api } from './client'

export type CreateLaneGroupBody = {
  name: string
  description: string
}

export type UpdateLaneGroupBody = {
  name?: string
  description?: string
  /** null / omit keeps unset — do not send a placeholder default. */
  emergency_pin?: number | null
  fire_pin?: number | null
}

export type LaneGroupDto = {
  id: string | number
  name: string
  description?: string
  emergency_pin?: number | null
  fire_pin?: number | null
}

const PATH = '/api/lane-groups/'

const asList = (data: unknown): LaneGroupDto[] => {
  if (Array.isArray(data)) return data as LaneGroupDto[]
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: LaneGroupDto[] }).results
  }
  return []
}

export const listLaneGroups = async () => {
  const data = await api.get<unknown>(PATH)
  return asList(data)
}

export const createLaneGroup = async (body: CreateLaneGroupBody) => {
  return api.post<LaneGroupDto>(PATH, body)
}

export const updateLaneGroup = async (id: string | number, body: UpdateLaneGroupBody) => {
  return api.patch<LaneGroupDto>(`${PATH}${id}/`, body)
}

export const deleteLaneGroup = async (id: string | number) => {
  return api.delete(`${PATH}${id}/`)
}

export type TriggerLaneGroupBody = {
  /** Optional note for AccessLog; user comes from the auth token. */
  remarks?: string
}

export type CloseLaneGroupAlarmResult = {
  message?: string
  lane_group_id?: number
  pin?: number
}

/** Turns fire_pin ON continuously; AccessLog is created on the backend. */
export const triggerLaneGroupFire = async (
  id: string | number,
  body: TriggerLaneGroupBody = { remarks: 'Fire activation' },
) => {
  return api.patch(`${PATH}${id}/trigger/fire/`, body)
}

/** Turns the configured fire_pin OFF. */
export const closeLaneGroupFire = async (id: string | number) => {
  return api.patch<CloseLaneGroupAlarmResult>(`${PATH}${id}/close/fire/`, {})
}

/** Turns emergency_pin ON continuously; AccessLog is created on the backend. */
export const triggerLaneGroupEmergency = async (
  id: string | number,
  body: TriggerLaneGroupBody = { remarks: 'Emergency activation' },
) => {
  return api.patch(`${PATH}${id}/trigger/emergency/`, body)
}

/** Turns the configured emergency_pin OFF. */
export const closeLaneGroupEmergency = async (id: string | number) => {
  return api.patch<CloseLaneGroupAlarmResult>(`${PATH}${id}/close/emergency/`, {})
}
