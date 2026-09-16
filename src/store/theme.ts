import AsyncStorage from '@react-native-async-storage/async-storage'
import { Appearance, type ColorSchemeName } from 'react-native'
import { create } from 'zustand'

export type ThemePref = 'auto' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

export const THEME_KEY = 'gatetouch_theme_v1'

function systemTheme(scheme?: ColorSchemeName | null): Theme {
  return scheme === 'light' ? 'light' : 'dark'
}

export function resolveTheme(pref: ThemePref, scheme?: ColorSchemeName | null): Theme {
  return pref === 'auto' ? systemTheme(scheme ?? Appearance.getColorScheme()) : pref
}

interface ThemeState {
  pref: ThemePref
  theme: Theme
  hydrated: boolean
  hydrate: () => Promise<void>
  setPref: (pref: ThemePref) => void
  toggle: () => void
}

export const useTheme = create<ThemeState>((set, get) => ({
  pref: 'auto',
  theme: resolveTheme('auto'),
  hydrated: false,

  hydrate: async () => {
    try {
      const v = await AsyncStorage.getItem(THEME_KEY)
      const pref: ThemePref = v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto'
      set({ pref, theme: resolveTheme(pref), hydrated: true })
    } catch {
      set({ hydrated: true })
    }
  },

  setPref: (pref) => {
    void AsyncStorage.setItem(THEME_KEY, pref).catch(() => {})
    set({ pref, theme: resolveTheme(pref) })
  },

  toggle: () => get().setPref(get().theme === 'dark' ? 'light' : 'dark'),
}))

/** Follows the OS while the preference is Auto. Call once at startup. */
export function watchSystemTheme(): () => void {
  const sub = Appearance.addChangeListener(({ colorScheme }) => {
    const { pref } = useTheme.getState()
    if (pref !== 'auto') return
    useTheme.setState({ theme: resolveTheme('auto', colorScheme) })
  })
  return () => sub.remove()
}
