import type { ReactNode } from 'react'

/** Function wrapper — Expo's React compiler rejects class error boundaries. */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  return children
}
