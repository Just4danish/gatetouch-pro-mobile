/**
 * Unit catalogue.
 *
 * Dimensions are the real ones, read out of the GLBs (tools/glb_extents.py):
 *   HG 02   body 305 mm across, 1000 mm deep, lid at 1020 mm.
 *           wing reaches 261 mm past the cabinet face (413.2 - 152.5).
 *   GL A1   body Ø212 mm, lid at 1020 mm.
 *           wing reaches 909 mm past the column face (1014.7 - 106).
 *
 * `reach` is what sets lane widths: two facing wings touch when the clear gap
 * equals the sum of their reaches, and the user-defined maximum is that plus
 * GAP_SPAN_MM (tips 600 mm apart).
 *
 * Clip timing:
 *   HG 02 wing -> "HG02_Wing_OpenClose*", closed t=0.4 s, open plateau t=1.2 s.
 *   GL A1 wing -> "GLA1_Wing_Swing", closed t=1.8 s, open-left t=3.6 s.
 */

export type UnitType = 'gla1' | 'hg02_single' | 'hg02_center'
export type WingId = 'single' | 'left' | 'right'

export interface WingClipMap {
  closedTime: number
  openTime: number
  stroke: number
}

export interface UnitSpec {
  type: UnitType
  label: string
  short: string
  /** Metro asset module id — use MODEL_ASSETS[type] with useGLTF */
  glb: number
  subtitle: string
  bodyMm: number
  depthMm: number
  heightMm: number
  wings: WingId[]
  /** wing overhang past each body face, un-flipped (mm) */
  reach: { left: number; right: number }
}

/** Expo asset modules for GLB models (Metro requires .glb in assetExts). */
export const MODEL_ASSETS: Record<UnitType, number> = {
  gla1: require('../../assets/models/gl_a1.glb'),
  hg02_single: require('../../assets/models/hg02_single_unit.glb'),
  hg02_center: require('../../assets/models/hg02_center_unit.glb'),
}

export const HG02_WING: WingClipMap = { closedTime: 0.4, openTime: 1.2, stroke: 0.8 }
export const GLA1_WING: WingClipMap = { closedTime: 1.8, openTime: 3.6, stroke: 1.8 }

export const CATALOG: Record<UnitType, UnitSpec> = {
  gla1: {
    type: 'gla1',
    label: 'GL A1 — Swing gate',
    short: 'GL A1',
    glb: MODEL_ASSETS.gla1,
    subtitle: 'Ø212 column · 909 mm arm',
    bodyMm: 212,
    depthMm: 212,
    heightMm: 1020,
    wings: ['single'],
    reach: { left: 0, right: 908.7 },
  },
  hg02_single: {
    type: 'hg02_single',
    label: 'HG 02 EU — Single',
    short: 'HG02 Single',
    glb: MODEL_ASSETS.hg02_single,
    subtitle: '305 mm body · 1 wing',
    bodyMm: 305,
    depthMm: 1000,
    heightMm: 1020,
    wings: ['single'],
    reach: { left: 0, right: 260.7 },
  },
  hg02_center: {
    type: 'hg02_center',
    label: 'HG 02 EU — Center',
    short: 'HG02 Center',
    glb: MODEL_ASSETS.hg02_center,
    subtitle: '305 mm body · 2 wings',
    bodyMm: 305,
    depthMm: 1000,
    heightMm: 1020,
    wings: ['left', 'right'],
    reach: { left: 260.7, right: 260.7 },
  },
}

export function wingClipMap(type: UnitType): WingClipMap {
  return type === 'gla1' ? GLA1_WING : HG02_WING
}

export const UNIT_ORDER: UnitType[] = ['gla1', 'hg02_single', 'hg02_center']

/** How much wider than "arms touching" a lane may go (mm). */
export const GAP_SPAN_MM = 600
/** A little daylight over "touching" so a closed lane still reads as sealed. */
export const GAP_DEFAULT_CLEARANCE_MM = 24
/** Clear width a lane must have to be marked accessible (mm). */
export const ACCESSIBLE_MIN_MM = 900

export const LANE_COLORS = [
  '#0a84ff',
  '#30d158',
  '#ff9f0a',
  '#ff375f',
  '#bf5af2',
  '#40c8e0',
  '#ffd60a',
]

/* ------------------------------------------------------------------ LEDs ---- */

export type LedBehavior = 'solid' | 'breathing' | 'blink' | 'chase'

export interface LedConfig {
  color: string
  /** emissive strength multiplier */
  intensity: number
  behavior: LedBehavior
}

export const LED_DEFAULT: LedConfig = { color: '#0a84ff', intensity: 2.2, behavior: 'solid' }

export const LED_SWATCHES = [
  '#0a84ff',
  '#30d158',
  '#ff375f',
  '#ff9f0a',
  '#ffd60a',
  '#bf5af2',
  '#40c8e0',
  '#ffffff',
]

export const LED_BEHAVIORS: { id: LedBehavior; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'breathing', label: 'Breathing' },
  { id: 'blink', label: 'Blink' },
  { id: 'chase', label: 'Chase' },
]

/* -------------------------------------------------------------- finishes ---- */

export type FinishId = 'steel' | 'black' | 'champagne' | 'white'

export interface Finish {
  id: FinishId
  label: string
  color: string
  roughness: number
  metalness: number
}

export const FINISHES: Record<FinishId, Finish> = {
  steel: { id: 'steel', label: 'Brushed steel', color: '#d3d7dd', roughness: 0.32, metalness: 0.92 },
  black: { id: 'black', label: 'Matte black', color: '#26282c', roughness: 0.55, metalness: 0.35 },
  champagne: {
    id: 'champagne',
    label: 'Champagne',
    color: '#d8c39a',
    roughness: 0.3,
    metalness: 1,
  },
  white: { id: 'white', label: 'Pure white', color: '#eceff3', roughness: 0.42, metalness: 0.1 },
}

export const FINISH_ORDER: FinishId[] = ['steel', 'black', 'champagne', 'white']

/* ----------------------------------------------------------------- glass ---- */

export type GlassId = 'clear' | 'frosted' | 'smoke' | 'bronze'

export interface Glass {
  id: GlassId
  label: string
  color: string
  transmission: number
  roughness: number
}

export const GLASSES: Record<GlassId, Glass> = {
  clear: { id: 'clear', label: 'Clear', color: '#ffffff', transmission: 0.9, roughness: 0.05 },
  frosted: { id: 'frosted', label: 'Frosted', color: '#f2f6ff', transmission: 0.66, roughness: 0.42 },
  smoke: { id: 'smoke', label: 'Smoke', color: '#8b929c', transmission: 0.62, roughness: 0.08 },
  bronze: { id: 'bronze', label: 'Bronze', color: '#b08b5e', transmission: 0.6, roughness: 0.1 },
}

export const GLASS_ORDER: GlassId[] = ['clear', 'frosted', 'smoke', 'bronze']

/* ----------------------------------------------------------- environment ---- */

export type EnvId = 'lobby' | 'night' | 'outdoor'

export interface EnvPreset {
  id: EnvId
  label: string
  /** drei <Environment preset> */
  preset: 'city' | 'night' | 'park'
  intensity: number
  key: number
  ambient: number
  floor: string
  /** solid backdrop color behind the transparent canvas (RN has no CSS gradients) */
  backdrop: string
  floorLight?: string
  backdropLight?: string
  ambientLight?: number
  intensityLight?: number
}

export const ENVS: Record<EnvId, EnvPreset> = {
  lobby: {
    id: 'lobby',
    label: 'Lobby',
    preset: 'city',
    intensity: 0.7,
    key: 1.2,
    ambient: 0.28,
    floor: '#1c1f24',
    backdrop: '#14161b',
    floorLight: '#c8ccd3',
    backdropLight: '#e8ebef',
    ambientLight: 0.62,
    intensityLight: 1.45,
  },
  night: {
    id: 'night',
    label: 'Night',
    preset: 'night',
    intensity: 0.4,
    key: 0.45,
    ambient: 0.1,
    floor: '#101216',
    backdrop: '#0b0c10',
  },
  outdoor: {
    id: 'outdoor',
    label: 'Outdoor',
    preset: 'park',
    intensity: 1.1,
    key: 1.7,
    ambient: 0.45,
    floor: '#3a3f46',
    backdrop: '#232830',
    floorLight: '#b9c0c8',
    backdropLight: '#a9c6e8',
    ambientLight: 0.7,
    intensityLight: 1.6,
  },
}

/** Resolves the theme-dependent parts of an environment. */
export function envColors(env: EnvPreset, theme: 'light' | 'dark') {
  const light = theme === 'light'
  return {
    floor: (light && env.floorLight) || env.floor,
    backdrop: (light && env.backdropLight) || env.backdrop,
    ambient: light && env.ambientLight != null ? env.ambientLight : env.ambient,
    intensity: light && env.intensityLight != null ? env.intensityLight : env.intensity,
  }
}

export const ENV_ORDER: EnvId[] = ['lobby', 'night', 'outdoor']

/* ------------------------------------------------------------ mesh naming --- */

export const MESH = {
  led: /(LED_Band|LED_Ring|Wing_EdgeLED)/,
  ledBand: /(LED_Band|LED_Ring)/,
  body: /Body_SS304/,
  glass: /Wing_Glass/,
  lid: /TopLid_BlackGlass/,
  arrowIn: /Lid_Arrow_L$/,
  arrowOut: /Lid_Arrow_R$/,
  lidGraphic: /(Lid_ArrowFrame|Lid_IndicatorLine)/,
}
