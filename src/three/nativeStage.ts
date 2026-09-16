import * as THREE from 'three'
import { CATALOG, ENVS, FINISHES, GLASSES, LED_DEFAULT, MESH, envColors, wingClipMap } from '../model/catalog'
import type { FinishId, GlassId, LedConfig, UnitType, WingId } from '../model/catalog'
import { stageFrame } from '../lib/stageFrame'
import { useTheme } from '../store/theme'
import {
  computeLayout,
  laneOfWing,
  lanesOfUnit,
  useCorridor,
  useDrag,
  wingTargets,
  type Lane,
  type Layout,
  type PlacedUnit,
} from '../store/corridor'
import { loadGltf } from './gltfCache'

const MODEL_ASSETS: Record<UnitType, number> = {
  gla1: require('../../assets/models/gl_a1.glb'),
  hg02_single: require('../../assets/models/hg02_single_unit.glb'),
  hg02_center: require('../../assets/models/hg02_center_unit.glb'),
}

const GREEN = new THREE.Color('#30d158')
const RED = new THREE.Color('#ff375f')

type WingRig = {
  wing: WingId
  node: THREE.Object3D
  closed: THREE.Quaternion
  open: THREE.Quaternion
  stroke: number
  frac: number
}

type UnitPack = {
  root: THREE.Group
  wings: WingRig[]
  leds: THREE.MeshStandardMaterial[]
  ledBands: THREE.MeshStandardMaterial[]
  wingLedMats: Record<string, THREE.MeshStandardMaterial[]>
  bodies: THREE.MeshStandardMaterial[]
  glasses: THREE.MeshStandardMaterial[]
  arrowIn: THREE.MeshStandardMaterial[]
  arrowOut: THREE.MeshStandardMaterial[]
  ledBase: Map<THREE.Material, number>
  type: UnitType
  ring: THREE.Mesh
  access: THREE.Mesh
}

function chaseTexture(): THREE.Texture {
  const w = 256
  const data = new Uint8Array(w * 4)
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1)
    const peak = Math.max(0, 1 - Math.abs(t - 0.5) * 12)
    const v = Math.round(peak * 255)
    const o = i * 4
    data[o] = v
    data[o + 1] = v
    data[o + 2] = v
    data[o + 3] = 255
  }
  const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

let CHASE_TEX: THREE.Texture | null = null
const WING_Q = new THREE.Quaternion()

/** Closed / open local poses sampled from the GLB clips. Mixer scrubbing is unreliable on Expo GL. */
const WING_POSES: Record<string, { wing: WingId; closed: THREE.Quaternion; open: THREE.Quaternion }> = {
  GLA1_Wing_Glass: {
    wing: 'single',
    closed: new THREE.Quaternion(0, 0, 0, 1),
    open: new THREE.Quaternion(0, 0.70710678, 0, 0.70710678),
  },
  HG02_Wing_Glass: {
    wing: 'single',
    closed: new THREE.Quaternion(0, 0, 0, 1),
    open: new THREE.Quaternion(0, 0, 0.15615, 0.98773),
  },
  HG02_Wing_Glass_A: {
    wing: 'right',
    closed: new THREE.Quaternion(0, 0, 0, 1),
    open: new THREE.Quaternion(0, 0, 0.15615, 0.98773),
  },
  HG02_Wing_Glass_B: {
    wing: 'left',
    closed: new THREE.Quaternion(0, 0, 0, 1),
    open: new THREE.Quaternion(0, 0, -0.15615, 0.98773),
  },
}

function applyLed(mats: THREE.MeshStandardMaterial[], cfg: LedConfig, band: boolean, ledBase: Map<THREE.Material, number>) {
  const col = new THREE.Color(cfg.color)
  for (const m of mats) {
    m.color.copy(col).multiplyScalar(0.35)
    m.emissive.copy(col)
    m.emissiveIntensity = cfg.intensity
    ledBase.set(m, cfg.intensity)
    if (band && cfg.behavior === 'chase') {
      if (!CHASE_TEX) CHASE_TEX = chaseTexture()
      m.emissiveMap = CHASE_TEX
    } else {
      m.emissiveMap = null
    }
    m.needsUpdate = true
  }
}

function buildPack(type: UnitType, scene: THREE.Group, _animations: THREE.AnimationClip[]): UnitPack {
  const clone = scene.clone(true)
  const matCache = new Map<string, THREE.Material>()
  const leds: THREE.MeshStandardMaterial[] = []
  const ledBands: THREE.MeshStandardMaterial[] = []
  const wingLedMats: Record<string, THREE.MeshStandardMaterial[]> = {}
  const bodies: THREE.MeshStandardMaterial[] = []
  const glasses: THREE.MeshStandardMaterial[] = []
  const arrowIn: THREE.MeshStandardMaterial[] = []
  const arrowOut: THREE.MeshStandardMaterial[] = []

  const map = wingClipMap(type)
  const wings: WingRig[] = []

  clone.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    o.castShadow = false
    o.receiveShadow = false
    const src = Array.isArray(o.material) ? o.material[0] : o.material
    if (!src) return
    const cached = matCache.get(src.uuid)
    let mine: THREE.Material = cached ?? src.clone()
    if (!cached) {
      // Drop MeshPhysicalMaterial entirely — Expo GL warns on dispersion/transmission shaders.
      if ((mine as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
        const phys = mine as THREE.MeshPhysicalMaterial
        mine = new THREE.MeshStandardMaterial({
          color: phys.color.clone(),
          map: phys.map,
          roughness: phys.roughness,
          metalness: phys.metalness,
          emissive: phys.emissive?.clone?.() ?? new THREE.Color(0x000000),
          emissiveIntensity: phys.emissiveIntensity ?? 0,
          transparent: phys.transparent,
          opacity: phys.opacity,
          side: phys.side,
        })
      }
      matCache.set(src.uuid, mine)
    }
    o.material = mine
    const n = o.name
    const std = mine as THREE.MeshStandardMaterial
    if (MESH.led.test(n)) {
      leds.push(std)
      if (MESH.ledBand.test(n)) ledBands.push(std)
      else {
        const w: WingId = /_A$/.test(n) ? 'right' : /_B$/.test(n) ? 'left' : 'single'
        ;(wingLedMats[w] ??= []).push(std)
      }
    } else if (MESH.body.test(n)) bodies.push(std)
    else if (MESH.glass.test(n)) {
      glasses.push(std)
      const pose =
        WING_POSES[n] ??
        (/Wing_Glass_A/.test(n)
          ? WING_POSES.HG02_Wing_Glass_A
          : /Wing_Glass_B/.test(n)
            ? WING_POSES.HG02_Wing_Glass_B
            : type === 'gla1'
              ? WING_POSES.GLA1_Wing_Glass
              : WING_POSES.HG02_Wing_Glass)
      o.setRotationFromQuaternion(pose.closed)
      wings.push({
        wing: pose.wing,
        node: o,
        closed: pose.closed.clone(),
        open: pose.open.clone(),
        stroke: map.stroke,
        frac: 0,
      })
    } else if (MESH.arrowIn.test(n)) arrowIn.push(std)
    else if (MESH.arrowOut.test(n)) arrowOut.push(std)
  })

  clone.traverse((o) => {
    const pose = WING_POSES[o.name]
    if (!pose) return
    const existing = wings.find((w) => w.node === o || w.wing === pose.wing)
    if (existing) existing.node = o
    else {
      wings.push({
        wing: pose.wing,
        node: o,
        closed: pose.closed.clone(),
        open: pose.open.clone(),
        stroke: map.stroke,
        frac: 0,
      })
    }
    o.setRotationFromQuaternion(pose.closed)
  })

  const spec = CATALOG[type]
  const halfBody = spec.bodyMm / 2000
  const ringR = Math.max(halfBody + 0.06, spec.depthMm / 2000)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(ringR, ringR + 0.045, 56),
    new THREE.MeshBasicMaterial({ color: '#0a84ff', transparent: true, opacity: 0.95 }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.006
  ring.visible = false
  clone.add(ring)

  const access = new THREE.Mesh(
    new THREE.CircleGeometry(0.065, 32),
    new THREE.MeshBasicMaterial({ color: '#0a84ff', toneMapped: false }),
  )
  access.rotation.x = -Math.PI / 2
  access.position.y = spec.heightMm / 1000 + 0.004
  access.visible = false
  clone.add(access)

  const root = new THREE.Group()
  root.add(clone)
  return {
    root,
    wings,
    leds,
    ledBands,
    wingLedMats,
    bodies,
    glasses,
    arrowIn,
    arrowOut,
    ledBase: new Map(),
    type,
    ring,
    access,
  }
}

type FakeCanvas = {
  style: Record<string, string>
  width: number
  height: number
  clientWidth: number
  clientHeight: number
  getContext: () => unknown
  addEventListener: (type: string, listener: (e: unknown) => void) => void
  removeEventListener: (type: string, listener: (e: unknown) => void) => void
  dispatchEvent: (event: Record<string, unknown>) => boolean
  setPointerCapture: () => void
  releasePointerCapture: () => void
  ownerDocument: unknown
  getRootNode: () => FakeCanvas
  getBoundingClientRect: () => { left: number; top: number; width: number; height: number; right: number; bottom: number }
}

function makeCanvas(gl: { drawingBufferWidth: number; drawingBufferHeight: number }): FakeCanvas {
  const listeners = new Map<string, Array<(e: unknown) => void>>()
  const canvas: FakeCanvas = {
    style: {},
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    clientWidth: gl.drawingBufferWidth,
    clientHeight: gl.drawingBufferHeight,
    getContext: () => gl,
    addEventListener(type, listener) {
      const list = listeners.get(type) ?? []
      list.push(listener)
      listeners.set(type, list)
    },
    removeEventListener(type, listener) {
      const list = listeners.get(type)
      if (!list) return
      const i = list.indexOf(listener)
      if (i !== -1) list.splice(i, 1)
    },
    dispatchEvent(event) {
      Object.assign(event, { target: canvas })
      const list = listeners.get(String(event.type))
      if (list) for (const cb of list) cb(event)
      return true
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    ownerDocument: null,
    getRootNode() {
      return canvas
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: canvas.clientWidth, height: canvas.clientHeight, right: canvas.clientWidth, bottom: canvas.clientHeight }
    },
  }
  canvas.ownerDocument = canvas
  return canvas
}

function dimBar(x1: number, x2: number, z: number, color: string) {
  const g = new THREE.Group()
  const w = Math.max(x2 - x1, 0.001)
  const cx = (x1 + x2) / 2
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, toneMapped: false })
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.011), mat)
  bar.rotation.x = -Math.PI / 2
  bar.position.set(cx, 0.005, z)
  g.add(bar)
  for (const tx of [x1, x2]) {
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.11), mat)
    tick.rotation.x = -Math.PI / 2
    tick.position.set(tx, 0.005, z)
    g.add(tick)
  }
  return g
}

function laneCenterX(lane: Lane, xs: Record<string, number>) {
  const pts = lane.members.map((m) => xs[m.unitId]).filter((n) => n != null)
  if (!pts.length) return 0
  return pts.reduce((a, b) => a + b, 0) / pts.length
}

export type NativeStage = {
  canvas: FakeCanvas
  setViewSize: (w: number, h: number) => void
  pick: (sx: number, sy: number) => { kind: 'unit' | 'lane'; id: string } | null
  orbitBy: (dx: number, dy: number) => void
  panBy: (dx: number, dy: number) => void
  zoomBy: (factor: number) => void
  dispose: () => void
}

export function createNativeStage(
  gl: {
    drawingBufferWidth: number
    drawingBufferHeight: number
    endFrameEXP: () => void
  },
  onMiss: () => void,
): NativeStage {
  const g = globalThis as { document?: { addEventListener?: unknown } }
  if (typeof g.document?.addEventListener !== 'function') {
    const noop = () => {}
    g.document = {
      addEventListener: noop,
      removeEventListener: noop,
      hidden: false,
      createElementNS: () => ({ style: {}, addEventListener: noop, removeEventListener: noop }),
      createElement: () => ({ style: {}, addEventListener: noop, removeEventListener: noop }),
    } as never
  }

  const canvas = makeCanvas(gl)

  // Expo GL is incomplete vs full WebGL2. Three r163+ still probes these APIs.
  const glAny = gl as {
    drawingBufferWidth: number
    drawingBufferHeight: number
    endFrameEXP: () => void
    renderbufferStorageMultisample?: (...args: unknown[]) => void
    getParameter?: (pname: number) => unknown
  }
  // Expo GL often exposes these as throwing stubs. Always no-op them.
  glAny.renderbufferStorageMultisample = () => {}
  const glMs = glAny as { framebufferTextureMultisample?: (...args: unknown[]) => void }
  glMs.framebufferTextureMultisample = () => {}
  const GL_MAX_SAMPLES = 0x8d57
  if (typeof glAny.getParameter === 'function') {
    const origGetParameter = glAny.getParameter.bind(glAny)
    glAny.getParameter = (pname: number) => (pname === GL_MAX_SAMPLES ? 0 : origGetParameter(pname))
  }

  // Expo GL contexts inherit WebGLRenderingContext. Three.js r163+ rejects that
  // instanceof check even though Expo provides a usable WebGL2-capable context.
  const WebGL1 = (globalThis as { WebGLRenderingContext?: unknown }).WebGLRenderingContext
  let renderer: THREE.WebGLRenderer
  try {
    ;(globalThis as { WebGLRenderingContext?: unknown }).WebGLRenderingContext = undefined
    renderer = new THREE.WebGLRenderer({
      canvas: canvas as unknown as HTMLCanvasElement,
      context: glAny as unknown as WebGLRenderingContext,
      antialias: false,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
    })
  } finally {
    ;(globalThis as { WebGLRenderingContext?: unknown }).WebGLRenderingContext = WebGL1
  }
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false)
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.autoClear = true
  renderer.capabilities.maxSamples = 0
  try {
    ;(renderer as unknown as { setSamples?: (n: number) => void }).setSamples?.(0)
  } catch {
    /* older three */
  }

  const scene = new THREE.Scene()
  const bg = new THREE.Color('#14161b')
  scene.background = bg
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100)
  camera.position.set(3, 2.4, 5)
  const orbitTarget = new THREE.Vector3(0, 0.8, 0)
  const spherical = new THREE.Spherical()
  const offset = new THREE.Vector3()
  const panRight = new THREE.Vector3()
  const panUp = new THREE.Vector3()

  const ambient = new THREE.AmbientLight('#ffffff', 0.28)
  const hemi = new THREE.HemisphereLight('#cfe0ff', '#2a2d33', 0.45)
  const key = new THREE.DirectionalLight('#ffffff', 1.2)
  const fill = new THREE.DirectionalLight('#9fc4ff', 0.42)
  scene.add(ambient, hemi, key, fill)

  const floorMat = new THREE.MeshStandardMaterial({ color: '#1c1f24', roughness: 0.72, metalness: 0 })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 40), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.001
  scene.add(floor)

  const unitsRoot = new THREE.Group()
  const extras = new THREE.Group()
  scene.add(unitsRoot, extras)

  const packs = new Map<string, UnitPack>()
  const pending = new Set<string>()
  const placeholders = new Map<string, THREE.Mesh>()
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = new THREE.Vector3()
  let lastT = performance.now()
  const want = { pos: new THREE.Vector3(3, 2.4, 5), tgt: new THREE.Vector3(0, 0.7, 0), active: true }
  let lastCamN = -1
  let viewW = 1
  let viewH = 1
  let t0 = 0
  let dimSig = ''
  let extraSig = ''
  let alive = true
  let raf = 0

  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 1.16, 0.42),
    new THREE.MeshStandardMaterial({
      color: '#0a84ff',
      emissive: '#0a84ff',
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.18,
    }),
  )
  ghost.position.y = 0.58
  ghost.visible = false
  scene.add(ghost)

  function setViewSize(w: number, h: number) {
    viewW = Math.max(w, 1)
    viewH = Math.max(h, 1)
    canvas.clientWidth = viewW
    canvas.clientHeight = viewH
    camera.aspect = viewW / viewH
    camera.updateProjectionMatrix()
  }

  function screenRay(sx: number, sy: number) {
    ndc.set((sx / viewW) * 2 - 1, -(sy / viewH) * 2 + 1)
    ray.setFromCamera(ndc, camera)
  }

  function pick(sx: number, sy: number) {
    screenRay(sx, sy)
    const hits = ray.intersectObjects(scene.children, true)
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object
      while (o) {
        const p = o.userData.pick as { kind: 'unit' | 'lane'; id: string } | undefined
        if (p) return p
        o = o.parent
      }
    }
    onMiss()
    return null
  }

  function ensureUnit(u: PlacedUnit) {
    if (packs.has(u.id) || pending.has(u.id)) return
    pending.add(u.id)
    const spec = CATALOG[u.type]
    const ph = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(spec.bodyMm / 1000, 0.18), 1.12, Math.max(spec.depthMm / 1000, 0.28)),
      new THREE.MeshStandardMaterial({ color: '#2a2e36', roughness: 0.78, metalness: 0.08 }),
    )
    ph.position.y = 0.56
    ph.userData.pick = { kind: 'unit', id: u.id }
    placeholders.set(u.id, ph)
    unitsRoot.add(ph)
    loadGltf(MODEL_ASSETS[u.type])
      .then((gltf) => {
        const hold = placeholders.get(u.id)
        if (hold) {
          unitsRoot.remove(hold)
          hold.geometry.dispose()
          ;(hold.material as THREE.Material).dispose()
          placeholders.delete(u.id)
        }
        if (!alive || !useCorridor.getState().units.some((x) => x.id === u.id)) return
        const pack = buildPack(u.type, gltf.scene, gltf.animations)
        pack.root.userData.pick = { kind: 'unit', id: u.id }
        packs.set(u.id, pack)
        unitsRoot.add(pack.root)
      })
      .catch((err) => console.warn('GLB load failed', err))
      .finally(() => pending.delete(u.id))
  }

  function paintUnit(u: PlacedUnit, pack: UnitPack, lanes: Lane[], globalLed: LedConfig, globalFinish: FinishId, globalGlass: GlassId, selId: string | null, multi: string[]) {
    const wings = CATALOG[u.type].wings
    const firstLane = laneOfWing(lanes, u.id, wings[0])
    const unitLanes = lanesOfUnit(lanes, u.id)
    const led = u.led ?? firstLane?.led ?? globalLed ?? LED_DEFAULT
    applyLed(pack.ledBands, led, true, pack.ledBase)
    for (const w of wings) {
      const wingLane = laneOfWing(lanes, u.id, w)
      applyLed(pack.wingLedMats[w] ?? [], u.led ?? wingLane?.led ?? globalLed ?? LED_DEFAULT, false, pack.ledBase)
    }
    const f = FINISHES[u.finish ?? globalFinish]
    for (const m of pack.bodies) {
      m.color.set(f.color)
      m.roughness = f.roughness
      m.metalness = f.metalness
      m.needsUpdate = true
    }
    const g = GLASSES[u.glass ?? globalGlass]
    for (const m of pack.glasses) {
      m.color.set(g.color)
      m.roughness = g.roughness
      m.metalness = 0
      m.transparent = true
      m.depthWrite = false
      m.opacity = Math.min(0.92, Math.max(0.18, 1 - g.transmission * 0.75))
      m.needsUpdate = true
    }
    const mode = firstLane?.mode ?? 'badge'
    const direction = firstLane?.direction ?? 'both'
    const blocked = mode === 'locked' || mode === 'noentry'
    const inOk = !blocked && (direction === 'in' || direction === 'both')
    const outOk = !blocked && (direction === 'out' || direction === 'both')
    const paint = (mats: THREE.MeshStandardMaterial[], ok: boolean) => {
      for (const m of mats) {
        m.color.copy(ok ? GREEN : RED)
        m.emissive.copy(ok ? GREEN : RED)
        m.emissiveIntensity = 1.4
        m.needsUpdate = true
      }
    }
    paint(pack.arrowIn, inOk)
    paint(pack.arrowOut, outOk)
    const selected = selId === u.id
    const isMulti = multi.includes(u.id)
    pack.ring.visible = selected || isMulti
    if (pack.ring.material instanceof THREE.MeshBasicMaterial) {
      pack.ring.material.color.set(isMulti ? '#ff9f0a' : '#0a84ff')
    }
    pack.access.visible = unitLanes.some((l) => l.accessible)
  }

  function rebuildExtras(layout: Layout, lanes: Lane[], showDims: boolean, showGhost: boolean, maxDepth: number, mode: string) {
    const sig = `${showDims}|${showGhost}|${layout.edges.map((e) => e.id).join(',')}|${lanes.map((l) => l.id + l.open + l.mode).join(',')}|${mode}`
    if (sig === extraSig) {
      for (const child of extras.children) {
        const lane = lanes.find((l) => l.id === child.userData.laneId)
        if (!lane) continue
        child.position.x = laneCenterX(lane, layout.x)
        const blocked = lane.mode === 'locked' || lane.mode === 'noentry'
        const color = blocked ? '#ff9f0a' : lane.open ? '#30d158' : '#ff453a'
        const mat = (child as THREE.Mesh).material
        if (mat instanceof THREE.MeshBasicMaterial) mat.color.set(color)
      }
      return
    }
    extraSig = sig
    for (const child of [...extras.children]) extras.remove(child)

    if (showDims || showGhost) {
      const z = maxDepth / 2 + 0.15
      const edges = layout.edges
      for (let i = 0; i < edges.length - 1; i++) {
        extras.add(dimBar(edges[i].right, edges[i + 1].left, z, '#0a84ff'))
      }
      if (edges.length > 0) {
        extras.add(dimBar(edges[0].left, edges[edges.length - 1].right, z + 0.38, '#ff9f0a'))
      }
    }

    if (mode === 'operate') {
      for (const lane of lanes) {
        const mesh = new THREE.Mesh(
          new THREE.RingGeometry(0.1, 0.16, 28),
          new THREE.MeshBasicMaterial({ color: '#ff453a', transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
        )
        mesh.rotation.x = -Math.PI / 2
        mesh.position.set(laneCenterX(lane, layout.x), 0.02, 0)
        mesh.userData.pick = { kind: 'lane', id: lane.id }
        mesh.userData.laneId = lane.id
        extras.add(mesh)
      }
    }
  }

  function sync(dt: number) {
    const s = useCorridor.getState()
    const theme = useTheme.getState().theme
    const env = ENVS[s.env]
    const look = envColors(env, theme)
    ambient.intensity = look.ambient
    hemi.intensity = look.ambient * 1.6
    hemi.groundColor.set(theme === 'light' ? '#b6bcc5' : '#2a2d33')
    key.intensity = env.key
    fill.intensity = env.key * 0.35
    floorMat.color.set(look.floor)
    bg.set(look.backdrop)

    const drag = useDrag.getState()
    const showGhost = drag.type != null && drag.index != null
    const base = computeLayout(s.units, s.gaps)
    const layout = showGhost ? computeLayout(s.units, s.gaps, { index: drag.index!, type: drag.type! }) : base
    const targets = wingTargets(s.lanes)
    const maxDepth = s.units.reduce((m, u) => Math.max(m, CATALOG[u.type].depthMm / 1000), 1)

    const fw = Math.max(layout.width + 30, 34)
    floor.position.x = layout.centerX
    if (Math.abs((floor.geometry as THREE.PlaneGeometry).parameters.width - fw) > 0.5) {
      floor.geometry.dispose()
      floor.geometry = new THREE.PlaneGeometry(fw, 40)
    }

    key.position.set(layout.centerX + 3, 5, 3)
    fill.position.set(layout.centerX - 3, 2, -3)

    const live = new Set(s.units.map((u) => u.id))
    for (const [id, pack] of packs) {
      if (live.has(id)) continue
      unitsRoot.remove(pack.root)
      packs.delete(id)
    }
    for (const [id, ph] of placeholders) {
      if (live.has(id)) continue
      unitsRoot.remove(ph)
      ph.geometry.dispose()
      ;(ph.material as THREE.Material).dispose()
      placeholders.delete(id)
    }
    for (const u of s.units) ensureUnit(u)
    for (const u of s.units) {
      const ph = placeholders.get(u.id)
      if (ph) ph.position.x = layout.x[u.id] ?? 0
    }

    const selId = s.mode === 'build' && s.sel?.kind === 'unit' ? s.sel.id : null
    for (const u of s.units) {
      const pack = packs.get(u.id)
      if (!pack) continue
      const x = layout.x[u.id] ?? 0
      pack.root.position.x = THREE.MathUtils.damp(pack.root.position.x || x, x, 9, dt)
      pack.root.rotation.y = u.flipped ? Math.PI : 0
      paintUnit(u, pack, s.lanes, s.led, s.finish, s.glass, selId, s.multi)

      for (const w of pack.wings) {
        const target = targets[`${u.id}:${w.wing}`] ?? 0
        if (Math.abs(w.frac - target) > 1e-4) {
          const step = dt / w.stroke
          w.frac = target > w.frac ? Math.min(target, w.frac + step) : Math.max(target, w.frac - step)
        }
        WING_Q.slerpQuaternions(w.closed, w.open, w.frac)
        w.node.setRotationFromQuaternion(WING_Q)
      }

      if (s.led.behavior === 'breathing' || s.led.behavior === 'blink') {
        const k =
          s.led.behavior === 'breathing'
            ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t0 * 2.4))
            : Math.sin(t0 * 6) > 0
              ? 1
              : 0.12
        for (const m of pack.leds) m.emissiveIntensity = (pack.ledBase.get(m) ?? s.led.intensity) * k
      }
    }

    if (s.led.behavior === 'chase' && CHASE_TEX) CHASE_TEX.offset.x = (t0 * 0.45) % 1

    ghost.visible = showGhost && layout.ghostX != null
    if (ghost.visible && layout.ghostX != null) {
      ghost.position.x = layout.ghostX
      const body = CATALOG[drag.type!].bodyMm / 1000
      ghost.scale.set(body / 0.3, 1, 1)
    }

    if (drag.type) {
      const { x: left, y: top, width, height } = stageFrame
      const inside =
        drag.clientX >= left && drag.clientY >= top && drag.clientX <= left + width && drag.clientY <= top + height
      if (!inside || width < 8 || height < 8) {
        useDrag.getState().setIndex(null)
      } else {
        screenRay(drag.clientX - left, drag.clientY - top)
        if (ray.ray.intersectPlane(plane, hit)) {
          const xs = s.units.map((u) => base.x[u.id])
          let idx = s.units.length
          for (let i = 0; i < xs.length; i++) {
            if (hit.x < xs[i]) {
              idx = i
              break
            }
          }
          useDrag.getState().setIndex(idx)
        } else useDrag.getState().setIndex(null)
      }
    }

    rebuildExtras(layout, s.lanes, s.showDims, showGhost, maxDepth, s.mode)

    const dep = s.units.map((u) => `${u.id}${u.flipped ? 'f' : ''}`).join('|')
    if (dimSig !== dep) {
      dimSig = dep
      const dist = Math.max(base.width * 1.55, 5.2)
      want.pos.set(base.centerX + dist * 0.22, dist * 0.42, dist * 0.95)
      want.tgt.set(base.centerX, 0.55, 0)
      want.active = true
    }
    if (s.camCmd && s.camCmd.n !== lastCamN) {
      lastCamN = s.camCmd.n
      want.pos.set(...s.camCmd.pos)
      want.tgt.set(...s.camCmd.target)
      want.active = true
    }
    if (want.active) {
      const k = 1 - Math.exp(-6 * dt)
      camera.position.lerp(want.pos, k)
      orbitTarget.lerp(want.tgt, k)
      camera.lookAt(orbitTarget)
      if (camera.position.distanceTo(want.pos) < 0.008) want.active = false
    } else {
      camera.lookAt(orbitTarget)
    }
  }

  const loop = () => {
    if (!alive) return
    try {
      const now = performance.now()
      const dt = Math.min((now - lastT) / 1000, 0.05)
      lastT = now
      t0 += dt
      sync(dt)
      renderer.render(scene, camera)
      gl.endFrameEXP()
    } catch (err) {
      console.warn('stage frame failed', err)
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  return {
    canvas,
    setViewSize,
    pick,
    orbitBy(dx: number, dy: number) {
      want.active = false
      offset.copy(camera.position).sub(orbitTarget)
      spherical.setFromVector3(offset)
      spherical.theta -= dx * 0.005
      spherical.phi = Math.max(0.05, Math.min(Math.PI * 0.495, spherical.phi - dy * 0.005))
      spherical.radius = Math.max(1.2, Math.min(30, spherical.radius))
      offset.setFromSpherical(spherical)
      camera.position.copy(orbitTarget).add(offset)
      camera.lookAt(orbitTarget)
    },
    panBy(dx: number, dy: number) {
      if (!dx && !dy) return
      want.active = false
      camera.updateMatrixWorld()
      const dist = Math.max(camera.position.distanceTo(orbitTarget), 1.2)
      const k = dist * 0.0018
      panRight.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(-dx * k)
      panUp.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(dy * k)
      camera.position.add(panRight).add(panUp)
      orbitTarget.add(panRight).add(panUp)
      camera.lookAt(orbitTarget)
    },
    zoomBy(factor: number) {
      if (!Number.isFinite(factor) || factor <= 0) return
      want.active = false
      offset.copy(camera.position).sub(orbitTarget)
      spherical.setFromVector3(offset)
      spherical.radius = Math.max(1.2, Math.min(30, spherical.radius / factor))
      offset.setFromSpherical(spherical)
      camera.position.copy(orbitTarget).add(offset)
      camera.lookAt(orbitTarget)
    },
    dispose() {
      alive = false
      cancelAnimationFrame(raf)
      renderer.dispose()
      packs.clear()
    },
  }
}
