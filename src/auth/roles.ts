export const ALLOWED_ROLES = ['Admin', 'Operator1', 'Operator2'] as const

export type UserRole = (typeof ALLOWED_ROLES)[number]

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ALLOWED_ROLES as readonly string[]).includes(value)
}

export class UnauthorizedRoleError extends Error {
  constructor() {
    super('This user is not authorized to use the Gatetouch Pro application.')
    this.name = 'UnauthorizedRoleError'
  }
}
