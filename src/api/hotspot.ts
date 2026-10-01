import { api } from './client'

/** Backend always expects a hidden hotspot; callers must not expose this in UI. */
export const HOTSPOT_VISIBILITY_HIDDEN = 'hidden' as const

export type HotspotVisibility = typeof HOTSPOT_VISIBILITY_HIDDEN

export type ChangeHotspotBody = {
  ssid: string
  password: string
  /** Always forced to `"hidden"` before the request is sent. */
  visibility: HotspotVisibility
}

export type ChangeHotspotInput = {
  ssid: string
  password: string
}

export type ChangeHotspotResponse = {
  message?: string
  ssid?: string
  password?: string
  visibility?: HotspotVisibility
}

const PATH = '/api/hotspot/change/'

/**
 * PATCH /api/hotspot/change/
 * Always sends `visibility: "hidden"` — never accept a caller-supplied value.
 */
export const changeHotspot = async (input: ChangeHotspotInput) => {
  const body: ChangeHotspotBody = {
    ssid: input.ssid.trim(),
    password: input.password,
    visibility: HOTSPOT_VISIBILITY_HIDDEN,
  }
  return api.patch<ChangeHotspotResponse>(PATH, body)
}
