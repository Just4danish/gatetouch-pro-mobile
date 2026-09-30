import * as SecureStore from 'expo-secure-store'
import { isUserRole, type UserRole } from '../auth/roles'

const TOKEN_KEY = 'gatetouch_auth_token'
const USERNAME_KEY = 'gatetouch_auth_username'
const ROLE_KEY = 'gatetouch_auth_role'

let memoryToken: string | null = null
let memoryUsername: string | null = null
let memoryRole: UserRole | null = null

export async function saveToken(token: string): Promise<void> {
  memoryToken = token
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function getToken(): Promise<string | null> {
  if (memoryToken != null) return memoryToken
  try {
    memoryToken = await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    memoryToken = null
  }
  return memoryToken
}

export async function clearToken(): Promise<void> {
  memoryToken = null
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  } catch {
    // ignore
  }
}

export async function saveUsername(username: string): Promise<void> {
  memoryUsername = username
  try {
    await SecureStore.setItemAsync(USERNAME_KEY, username)
  } catch {
    // ignore
  }
}

export async function getUsername(): Promise<string | null> {
  if (memoryUsername != null) return memoryUsername
  try {
    memoryUsername = await SecureStore.getItemAsync(USERNAME_KEY)
  } catch {
    memoryUsername = null
  }
  return memoryUsername
}

export async function clearUsername(): Promise<void> {
  memoryUsername = null
  try {
    await SecureStore.deleteItemAsync(USERNAME_KEY)
  } catch {
    // ignore
  }
}

export async function saveRole(role: UserRole): Promise<void> {
  memoryRole = role
  try {
    await SecureStore.setItemAsync(ROLE_KEY, role)
  } catch {
    // ignore
  }
}

export async function getRole(): Promise<UserRole | null> {
  if (memoryRole != null) return memoryRole
  try {
    const raw = await SecureStore.getItemAsync(ROLE_KEY)
    if (isUserRole(raw)) {
      memoryRole = raw
      return memoryRole
    }
  } catch {
    memoryRole = null
  }
  return null
}

export async function clearRole(): Promise<void> {
  memoryRole = null
  try {
    await SecureStore.deleteItemAsync(ROLE_KEY)
  } catch {
    // ignore
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([clearToken(), clearUsername(), clearRole()])
}
