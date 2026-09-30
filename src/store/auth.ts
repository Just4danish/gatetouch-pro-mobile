import { create } from 'zustand'
import { login as loginRequest, logout as logoutRequest } from '../api/auth'
import { onAuthInvalid } from '../api/authEvents'
import { isUserRole, UnauthorizedRoleError, type UserRole } from '../auth/roles'
import {
  clearSession,
  getRole,
  getToken,
  getUsername,
  saveRole,
  saveToken,
  saveUsername,
} from '../lib/authStorage'

type AuthState = {
  token: string | null
  username: string | null
  /** From login `role` — Admin | Operator1 | Operator2. */
  role: UserRole | null
  isAuthenticated: boolean
  restoringSession: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<void>
}

const clearAuthState = (): Pick<AuthState, 'token' | 'username' | 'role' | 'isAuthenticated'> => ({
  token: null,
  username: null,
  role: null,
  isAuthenticated: false,
})

export const useAuth = create<AuthState>((set) => ({
  token: null,
  username: null,
  role: null,
  isAuthenticated: false,
  restoringSession: true,

  login: async (username, password) => {
    const res = await loginRequest(username.trim(), password)
    const token = typeof res.token === 'string' ? res.token.trim() : ''
    if (!token) throw new Error('Login succeeded but no token was returned')

    if (!isUserRole(res.role)) {
      throw new UnauthorizedRoleError()
    }

    const resolvedUsername =
      (typeof res.username === 'string' && res.username.trim()) || username.trim()

    await saveToken(token)
    await saveUsername(resolvedUsername)
    await saveRole(res.role)

    set({
      token,
      username: resolvedUsername,
      role: res.role,
      isAuthenticated: true,
    })
  },

  logout: async () => {
    try {
      await logoutRequest()
    } catch {
      // 401 / network: still clear locally so the user is not left signed in.
    } finally {
      await clearSession()
      set(clearAuthState())
    }
  },

  restoreSession: async () => {
    try {
      const [token, storedUsername, storedRole] = await Promise.all([
        getToken(),
        getUsername(),
        getRole(),
      ])

      if (token && isUserRole(storedRole)) {
        set({
          token,
          username: storedUsername,
          role: storedRole,
          isAuthenticated: true,
          restoringSession: false,
        })
        return
      }

      if (token || storedUsername || storedRole) {
        await clearSession()
      }
      set({ ...clearAuthState(), restoringSession: false })
    } catch {
      try {
        await clearSession()
      } catch {
        // Ignore SecureStore failures during restore cleanup
      }
      set({ ...clearAuthState(), restoringSession: false })
    }
  },
}))

onAuthInvalid(() => {
  void clearSession()
  useAuth.setState(clearAuthState())
})
