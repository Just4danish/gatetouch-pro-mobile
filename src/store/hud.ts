import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'

const HUD_KEY = 'gatetouch_hud_v1'

type HudCache = {
  camBarOn: boolean
  camBarX: number
  camBarY: number
  gearX: number
  gearY: number
}

export interface HudState extends HudCache {
  hydrated: boolean
  hydrate: () => Promise<void>
  setCamBarOn: (on: boolean) => void
  setCamBarPos: (x: number, y: number) => void
  setGearPos: (x: number, y: number) => void
}

function snapshot(s: HudState): HudCache {
  return {
    camBarOn: s.camBarOn,
    camBarX: s.camBarX,
    camBarY: s.camBarY,
    gearX: s.gearX,
    gearY: s.gearY,
  }
}

function persist(s: HudState) {
  void AsyncStorage.setItem(HUD_KEY, JSON.stringify(snapshot(s))).catch(() => {})
}

export const useHud = create<HudState>((set, get) => ({
  camBarOn: true,
  camBarX: 12,
  camBarY: 72,
  gearX: -1,
  gearY: -1,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(HUD_KEY)
      if (!raw) {
        set({ hydrated: true })
        return
      }
      const v = JSON.parse(raw) as Partial<HudCache>
      set({
        camBarOn: v.camBarOn !== false,
        camBarX: Number.isFinite(v.camBarX) ? v.camBarX! : 12,
        camBarY: Number.isFinite(v.camBarY) ? v.camBarY! : 72,
        gearX: Number.isFinite(v.gearX) ? v.gearX! : -1,
        gearY: Number.isFinite(v.gearY) ? v.gearY! : -1,
        hydrated: true,
      })
    } catch {
      set({ hydrated: true })
    }
  },

  setCamBarOn: (camBarOn) => {
    set({ camBarOn })
    persist(get())
  },

  setCamBarPos: (camBarX, camBarY) => {
    set({ camBarX, camBarY })
    persist(get())
  },

  setGearPos: (gearX, gearY) => {
    set({ gearX, gearY })
    persist(get())
  },
}))
