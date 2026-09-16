import type { Theme } from '../store/theme'

export interface ThemeColors {
  bg: string
  text: string
  text2: string
  text3: string
  onAccent: string
  onThumb: string
  accent: string
  accentFg: string
  accentTint: string
  accentTint2: string
  green: string
  greenFg: string
  red: string
  redFg: string
  orange: string
  orangeFg: string
  glass: string
  glass2: string
  panel: string
  menu: string
  sheetBg: string
  inspBg: string
  card: string
  surface: string
  raise: string
  raise2: string
  fill2: string
  chrome: string
  thumb: string
  thumb2: string
  knob: string
  hair: string
  labelBg: string
  labelFg: string
  tintBlueBg: string
  tintBlueBd: string
  tintBlueFg: string
  tintOrangeBg: string
  tintOrangeBd: string
  tintOrangeFg: string
  tintRedBg: string
  tintRedBd: string
  tintRedFg: string
  stageDark: string
  stageLight: string
}

export const DARK: ThemeColors = {
  bg: '#0a0b0e',
  text: '#f5f5f7',
  text2: 'rgba(235, 235, 245, 0.74)',
  text3: 'rgba(235, 235, 245, 0.52)',
  onAccent: '#fff',
  onThumb: '#fff',
  accent: '#0a84ff',
  accentFg: '#0a84ff',
  accentTint: 'rgba(10, 132, 255, 0.14)',
  accentTint2: 'rgba(10, 132, 255, 0.22)',
  green: '#30d158',
  greenFg: '#30d158',
  red: '#ff453a',
  redFg: '#ff453a',
  orange: '#ff9f0a',
  orangeFg: '#ff9f0a',
  glass: 'rgba(28, 28, 32, 0.72)',
  glass2: 'rgba(255, 255, 255, 0.06)',
  panel: 'rgba(28, 28, 32, 0.9)',
  menu: 'rgba(34, 34, 38, 0.94)',
  sheetBg: '#0e0f12',
  inspBg: '#18181c',
  card: 'rgba(18, 20, 24, 0.92)',
  surface: 'rgba(255, 255, 255, 0.04)',
  raise: 'rgba(255, 255, 255, 0.16)',
  raise2: 'rgba(255, 255, 255, 0.28)',
  fill2: 'rgba(118, 118, 128, 0.2)',
  chrome: 'rgba(44, 44, 50, 0.82)',
  thumb: 'rgba(120, 120, 128, 0.55)',
  thumb2: 'rgba(120, 120, 128, 0.5)',
  knob: '#fff',
  hair: 'rgba(255, 255, 255, 0.09)',
  labelBg: 'rgba(10, 12, 16, 0.88)',
  labelFg: '#cfe3ff',
  tintBlueBg: 'rgba(10, 132, 255, 0.12)',
  tintBlueBd: 'rgba(10, 132, 255, 0.32)',
  tintBlueFg: '#cbe3ff',
  tintOrangeBg: 'rgba(255, 159, 10, 0.12)',
  tintOrangeBd: 'rgba(255, 159, 10, 0.36)',
  tintOrangeFg: '#ffdca8',
  tintRedBg: 'rgba(255, 69, 58, 0.13)',
  tintRedBd: 'rgba(255, 69, 58, 0.4)',
  tintRedFg: '#ffb4ae',
  stageDark: '#0a0b0e',
  stageLight: '#e9ebef',
}

export const LIGHT: ThemeColors = {
  bg: '#e9ebef',
  text: '#1c1c1e',
  text2: 'rgba(60, 60, 67, 0.86)',
  text3: 'rgba(60, 60, 67, 0.66)',
  onAccent: '#fff',
  onThumb: '#1c1c1e',
  accent: '#007aff',
  accentFg: '#0063cc',
  accentTint: 'rgba(0, 122, 255, 0.12)',
  accentTint2: 'rgba(0, 122, 255, 0.18)',
  green: '#34c759',
  greenFg: '#1c7c33',
  red: '#ff3b30',
  redFg: '#c4271d',
  orange: '#ff9500',
  orangeFg: '#8f5100',
  glass: 'rgba(255, 255, 255, 0.85)',
  glass2: 'rgba(0, 0, 0, 0.05)',
  panel: 'rgba(255, 255, 255, 0.92)',
  menu: 'rgba(255, 255, 255, 0.96)',
  sheetBg: '#f5f6f9',
  inspBg: '#fcfcfd',
  card: 'rgba(255, 255, 255, 0.96)',
  surface: 'rgba(0, 0, 0, 0.035)',
  raise: 'rgba(0, 0, 0, 0.12)',
  raise2: 'rgba(0, 0, 0, 0.22)',
  fill2: 'rgba(118, 118, 128, 0.1)',
  chrome: 'rgba(252, 252, 253, 0.9)',
  thumb: '#ffffff',
  thumb2: '#ffffff',
  knob: '#fff',
  hair: 'rgba(0, 0, 0, 0.12)',
  labelBg: 'rgba(255, 255, 255, 0.92)',
  labelFg: '#0f4c92',
  tintBlueBg: 'rgba(0, 122, 255, 0.1)',
  tintBlueBd: 'rgba(0, 122, 255, 0.28)',
  tintBlueFg: '#0d4a8f',
  tintOrangeBg: 'rgba(255, 149, 0, 0.14)',
  tintOrangeBd: 'rgba(255, 149, 0, 0.4)',
  tintOrangeFg: '#7d4700',
  tintRedBg: 'rgba(255, 59, 48, 0.1)',
  tintRedBd: 'rgba(255, 59, 48, 0.32)',
  tintRedFg: '#9d1d15',
  stageDark: '#0a0b0e',
  stageLight: '#e9ebef',
}

export function colors(theme: Theme): ThemeColors {
  return theme === 'light' ? LIGHT : DARK
}
