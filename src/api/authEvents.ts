/**
 * Tiny pub/sub so the API client can signal rejected auth without importing
 * the Zustand store (avoids client ↔ store cycles).
 */

type AuthInvalidListener = () => void

const listeners = new Set<AuthInvalidListener>()

export function onAuthInvalid(listener: AuthInvalidListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyAuthInvalid(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // Listeners must not break request error propagation
    }
  }
}
