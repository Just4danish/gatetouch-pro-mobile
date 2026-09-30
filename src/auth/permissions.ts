import type { UserRole } from './roles'

export type Permission =
  | 'GET_RESOURCES'
  | 'CREATE_RESOURCES'
  | 'UPDATE_RESOURCES'
  | 'DELETE_RESOURCES'
  | 'TRIGGER_LANE'
  | 'CLOSE_LANE'
  | 'TRIGGER_EMERGENCY'
  | 'CLOSE_EMERGENCY'
  | 'TRIGGER_FIRE'
  | 'CLOSE_FIRE'
  | 'VIEW_SYSTEM_CONFIG'
  | 'UPDATE_SYSTEM_CONFIG'

const ADMIN_PERMISSIONS: readonly Permission[] = [
  'GET_RESOURCES',
  'CREATE_RESOURCES',
  'UPDATE_RESOURCES',
  'DELETE_RESOURCES',
  'TRIGGER_LANE',
  'CLOSE_LANE',
  'TRIGGER_EMERGENCY',
  'CLOSE_EMERGENCY',
  'TRIGGER_FIRE',
  'CLOSE_FIRE',
  'VIEW_SYSTEM_CONFIG',
  'UPDATE_SYSTEM_CONFIG',
]

const OPERATOR_PERMISSIONS: readonly Permission[] = [
  'GET_RESOURCES',
  'TRIGGER_LANE',
  'CLOSE_LANE',
  'TRIGGER_EMERGENCY',
  'CLOSE_EMERGENCY',
  'TRIGGER_FIRE',
  'CLOSE_FIRE',
]

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  Admin: ADMIN_PERMISSIONS,
  Operator1: OPERATOR_PERMISSIONS,
  Operator2: OPERATOR_PERMISSIONS,
}

export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role].includes(permission)
}

/** True when the role may create, update, or delete resources (Build management). */
export function canManageResources(role: UserRole | null | undefined): boolean {
  return (
    hasPermission(role, 'CREATE_RESOURCES') ||
    hasPermission(role, 'UPDATE_RESOURCES') ||
    hasPermission(role, 'DELETE_RESOURCES')
  )
}

export function canViewSystemConfig(role: UserRole | null | undefined): boolean {
  return hasPermission(role, 'VIEW_SYSTEM_CONFIG')
}
