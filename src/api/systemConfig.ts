import { api } from './client'

export type SystemConfigDto = {
  id: number
  operator1_username: string
  operator1_cardno?: string | null
  operator1_password?: string | null
  operator2_username: string
  operator2_cardno?: string | null
  operator2_password?: string | null
  admin_username: string
  admin_cardno?: string | null
  admin_password?: string | null
  wifi_ssid?: string | null
  wifi_password?: string | null
  trigger_delay?: number | null
  site_name?: string | null
}

export type UpdateSystemConfigBody = Partial<{
  operator1_password: string
  operator2_password: string
  admin_password: string
  site_name: string
}>

const PATH = '/api/system-config/'

const asConfig = (data: unknown): SystemConfigDto | null => {
  if (!data || typeof data !== 'object') return null
  if (Array.isArray(data)) {
    const first = data[0]
    return first && typeof first === 'object' ? (first as SystemConfigDto) : null
  }
  const obj = data as Record<string, unknown>
  if (obj.results && Array.isArray(obj.results)) {
    const first = obj.results[0]
    return first && typeof first === 'object' ? (first as SystemConfigDto) : null
  }
  return data as SystemConfigDto
}

/** GET /api/system-config/ — Admin-only. */
export const getSystemConfig = async (): Promise<SystemConfigDto> => {
  const data = await api.get<unknown>(PATH)
  const config = asConfig(data)
  if (!config) throw new Error('System configuration response was empty or invalid')
  return config
}

/** PATCH /api/system-config/{id}/ */
export const updateSystemConfig = async (id: string | number, body: UpdateSystemConfigBody) => {
  const data = await api.patch<unknown>(`${PATH}${id}/`, body)
  return asConfig(data)
}
