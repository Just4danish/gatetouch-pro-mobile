import { api } from './client'
import type { UserRole } from '../auth/roles'

export interface LoginResponse {
  message: string
  username: string
  role: UserRole
  token: string
}

export interface LogoutResponse {
  message: string
  username: string
}

export const login = (username: string, password: string) =>
  api.post<LoginResponse>('/api/user/login/', { username, password })

export const logout = () => api.post<LogoutResponse>('/api/user/logout/', {})
