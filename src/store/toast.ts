import { create } from 'zustand'

export type ToastKind = 'error' | 'warning' | 'info' | 'success'

export type ToastPayload = {
  message: string
  kind: ToastKind
}

type ToastState = {
  toast: ToastPayload | null
  show: (message: string, kind?: ToastKind, ms?: number) => void
  clear: () => void
}

let timer: ReturnType<typeof setTimeout> | null = null

export const useToast = create<ToastState>((set) => ({
  toast: null,
  show: (message, kind = 'info', ms = 3200) => {
    if (timer) clearTimeout(timer)
    set({ toast: { message, kind } })
    timer = setTimeout(() => set({ toast: null }), ms)
  },
  clear: () => {
    if (timer) clearTimeout(timer)
    timer = null
    set({ toast: null })
  },
}))
