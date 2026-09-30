import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { STAGE_CHROME_LEFT, STAGE_CHROME_TOP } from '../lib/stageFrame'

const HUD_KEY = 'gatetouch_hud_v1'

type HudCache = {
  camBarOn: boolean
  camBarX: number
  camBarY: number
  gearX: number
  gearY: number
  panelCollapsed: boolean
}

export interface HudState extends HudCache {
  hydrated: boolean
  hydrate: () => Promise<void>
  setCamBarOn: (on: boolean) => void
  setCamBarPos: (x: number, y: number) => void
  setGearPos: (x: number, y: number) => void
  setPanelCollapsed: (collapsed: boolean) => void
}

function snapshot(s: HudState): HudCache {
  return {
    camBarOn: s.camBarOn,
    camBarX: s.camBarX,
    camBarY: s.camBarY,
    gearX: s.gearX,
    gearY: s.gearY,
    panelCollapsed: s.panelCollapsed,
  }
}

function persist(s: HudState) {
  void AsyncStorage.setItem(HUD_KEY, JSON.stringify(snapshot(s))).catch(() => {})
}

export const useHud = create<HudState>((set, get) => ({
  camBarOn: true,
  camBarX: STAGE_CHROME_LEFT,
  camBarY: STAGE_CHROME_TOP,
  gearX: -1,
  gearY: -1,
  panelCollapsed: true,
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
        camBarX: Number.isFinite(v.camBarX) ? v.camBarX! : STAGE_CHROME_LEFT,
        camBarY: Number.isFinite(v.camBarY) ? v.camBarY! : STAGE_CHROME_TOP,
        gearX: Number.isFinite(v.gearX) ? v.gearX! : -1,
        gearY: Number.isFinite(v.gearY) ? v.gearY! : -1,
        panelCollapsed: v.panelCollapsed === true,
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

  setPanelCollapsed: (panelCollapsed) => {
    set({ panelCollapsed })
    persist(get())
  },
}))
