import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { drei, fiber } from '../lib/r3f'

const { useGLTF } = drei
const { useFrame } = fiber
import {
  CATALOG,
  FINISHES,
  GLASSES,
  MESH,
  MODEL_ASSETS,
  wingClipMap,
  type FinishId,
  type GlassId,
  type LedConfig,
  type UnitType,
  type WingId,
} from '../model/catalog'
import type { LaneDirection, LaneMode } from '../store/corridor'

type Targets = Partial<Record<WingId, number>>

interface WingRig {
  wing: WingId
  action: THREE.AnimationAction
  closedTime: number
  openTime: number
  stroke: number
  frac: number
}

interface Props {
  type: UnitType
  x: number
  flipped?: boolean
  targets: Targets
  led: LedConfig
  wingLeds?: Partial<Record<WingId, LedConfig>>
  finish: FinishId
  glass: GlassId
  direction: LaneDirection
  mode: LaneMode
  accessible: boolean
  selected?: boolean
  multi?: boolean
  onTap?: () => void
  onHold?: (clientX: number, clientY: number) => void
}

const GREEN = new THREE.Color('#30d158')
const RED = new THREE.Color('#ff375f')

/** Soft gradient used to make the LED band "chase" — DataTexture (no DOM canvas). */
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

export function UnitObject({
  type,
  x,
  flipped,
  targets,
  led,
  wingLeds,
  finish,
  glass,
  direction,
  mode,
  accessible,
  selected,
  multi,
  onTap,
  onHold,
}: Props) {
  const spec = CATALOG[type]
  // Expo Metro returns a numeric asset module; drei's Path type is string-oriented.
  const gltf = useGLTF(MODEL_ASSETS[type] as unknown as string) as {
    scene: THREE.Group
    animations: THREE.AnimationClip[]
  }

  const { root, wings, leds, ledBands, wingLedMats, bodies, glasses, arrowIn, arrowOut } = useMemo(() => {
    const clone = gltf.scene.clone(true)
    const matCache = new Map<string, THREE.Material>()
    const leds: THREE.MeshStandardMaterial[] = []
    const ledBands: THREE.MeshStandardMaterial[] = []
    const wingLedMats: Record<string, THREE.MeshStandardMaterial[]> = {}
    const bodies: THREE.MeshStandardMaterial[] = []
    const glasses: THREE.MeshPhysicalMaterial[] = []
    const arrowIn: THREE.MeshStandardMaterial[] = []
    const arrowOut: THREE.MeshStandardMaterial[] = []

    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      o.castShadow = true
      o.receiveShadow = true
      const src = Array.isArray(o.material) ? o.material[0] : o.material
      if (!src) return
      const cached = matCache.get(src.uuid)
      const mine: THREE.Material = cached ?? src.clone()
      if (!cached) matCache.set(src.uuid, mine)
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
        glasses.push(mine as THREE.MeshPhysicalMaterial)
        o.castShadow = false
      } else if (MESH.arrowIn.test(n)) arrowIn.push(std)
      else if (MESH.arrowOut.test(n)) arrowOut.push(std)
    })

    const map = wingClipMap(type)
    const mixer = new THREE.AnimationMixer(clone)
    const found: { node: THREE.Object3D; action: THREE.AnimationAction }[] = []
    for (const clip of gltf.animations) {
      const nodeName = clip.tracks[0]?.name.split('.')[0]
      if (!nodeName) continue
      const node = clone.getObjectByName(nodeName)
      if (!node) continue
      found.push({ node, action: mixer.clipAction(clip, clone) })
    }
    const ordered = [...found].sort((a, b) => a.node.position.x - b.node.position.x)
    const rigs: WingRig[] = ordered.map((f, i) => ({
      wing: (ordered.length === 2 ? (i === 0 ? 'left' : 'right') : 'single') as WingId,
      action: f.action,
      closedTime: map.closedTime,
      openTime: map.openTime,
      stroke: map.stroke,
      frac: 0,
    }))

    clone.userData.mixer = mixer
    return {
      root: clone,
      wings: rigs,
      leds,
      ledBands,
      wingLedMats,
      bodies,
      glasses,
      arrowIn,
      arrowOut,
    }
  }, [gltf, type])

  const mixer = root.userData.mixer as THREE.AnimationMixer
  const group = useRef<THREE.Group>(null)

  useEffect(() => {
    for (const w of wings) {
      w.action.reset()
      w.action.play()
      w.action.paused = true
      w.action.time = w.closedTime + w.frac * (w.openTime - w.closedTime)
    }
    mixer.update(0)
    return () => {
      mixer.stopAllAction()
    }
  }, [mixer, wings])

  const ledBase = useRef(new Map<THREE.Material, number>())
  const wingLedKey = JSON.stringify(wingLeds ?? {})

  useEffect(() => {
    const apply = (mats: THREE.MeshStandardMaterial[], cfg: LedConfig, band: boolean) => {
      const col = new THREE.Color(cfg.color)
      for (const m of mats) {
        m.color.copy(col).multiplyScalar(0.35)
        m.emissive.copy(col)
        m.emissiveIntensity = cfg.intensity
        ledBase.current.set(m, cfg.intensity)
        if (band && cfg.behavior === 'chase') {
          if (!CHASE_TEX) CHASE_TEX = chaseTexture()
          m.emissiveMap = CHASE_TEX
        } else {
          m.emissiveMap = null
        }
        m.needsUpdate = true
      }
    }

    apply(ledBands, led, true)
    for (const [wing, mats] of Object.entries(wingLedMats)) {
      apply(mats, wingLeds?.[wing as WingId] ?? led, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [led, wingLedKey, ledBands, wingLedMats])

  useEffect(() => {
    const f = FINISHES[finish]
    for (const m of bodies) {
      m.color.set(f.color)
      m.roughness = f.roughness
      m.metalness = f.metalness
      m.needsUpdate = true
    }
  }, [finish, bodies])

  useEffect(() => {
    const g = GLASSES[glass]
    for (const m of glasses) {
      m.color.set(g.color)
      m.transmission = g.transmission
      m.roughness = g.roughness
      m.thickness = 0.01
      m.ior = 1.52
      m.needsUpdate = true
    }
  }, [glass, glasses])

  useEffect(() => {
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
    paint(arrowIn, inOk)
    paint(arrowOut, outOk)
  }, [direction, mode, arrowIn, arrowOut])

  const t0 = useRef(0)
  useFrame((_, dt) => {
    t0.current += dt

    if (group.current) {
      const cur = group.current.position.x
      if (Math.abs(cur - x) > 1e-4) {
        group.current.position.x = THREE.MathUtils.damp(cur, x, 9, dt)
      }
    }

    let changed = false
    for (const w of wings) {
      const target = targets[w.wing] ?? 0
      if (Math.abs(w.frac - target) > 1e-4) {
        const step = dt / w.stroke
        w.frac = target > w.frac ? Math.min(target, w.frac + step) : Math.max(target, w.frac - step)
        w.action.time = w.closedTime + w.frac * (w.openTime - w.closedTime)
        changed = true
      }
    }
    if (changed) mixer.update(0)

    if (led.behavior === 'breathing' || led.behavior === 'blink') {
      const k =
        led.behavior === 'breathing'
          ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t0.current * 2.4))
          : Math.sin(t0.current * 6) > 0
            ? 1
            : 0.12
      for (const m of leds) m.emissiveIntensity = (ledBase.current.get(m) ?? led.intensity) * k
    } else if (led.behavior === 'chase' && CHASE_TEX) {
      CHASE_TEX.offset.x = (t0.current * 0.45) % 1
    }
  })

  const halfBody = spec.bodyMm / 2000
  const ringR = Math.max(halfBody + 0.06, spec.depthMm / 2000)
  const lidY = spec.heightMm / 1000 + 0.004

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const press = useRef<{ x: number; y: number; moved: boolean; held: boolean } | null>(null)
  const cancelHold = () => {
    if (holdTimer.current != null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }
  useEffect(() => cancelHold, [])

  return (
    <group
      ref={group}
      position={[x, 0, 0]}
      onPointerDown={(e) => {
        if (!onTap && !onHold) return
        e.stopPropagation()
        const ne = e.nativeEvent as { pageX?: number; pageY?: number; clientX?: number; clientY?: number }
        const clientX = ne.pageX ?? ne.clientX ?? 0
        const clientY = ne.pageY ?? ne.clientY ?? 0
        press.current = { x: clientX, y: clientY, moved: false, held: false }
        cancelHold()
        if (onHold) {
          holdTimer.current = setTimeout(() => {
            holdTimer.current = null
            if (!press.current || press.current.moved) return
            press.current.held = true
            onHold(clientX, clientY)
          }, 500)
        }
      }}
      onPointerMove={(e) => {
        const p = press.current
        if (!p || p.moved) return
        const ne = e.nativeEvent as { pageX?: number; pageY?: number; clientX?: number; clientY?: number }
        const clientX = ne.pageX ?? ne.clientX ?? 0
        const clientY = ne.pageY ?? ne.clientY ?? 0
        if (Math.hypot(clientX - p.x, clientY - p.y) > 8) {
          p.moved = true
          cancelHold()
        }
      }}
      onPointerUp={() => {
        cancelHold()
        const p = press.current
        press.current = null
        if (p && !p.moved && !p.held) onTap?.()
      }}
      onPointerOut={() => {
        cancelHold()
        press.current = null
      }}
    >
      <group rotation={[0, flipped ? Math.PI : 0, 0]}>
        <primitive object={root} />
      </group>

      {accessible && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, lidY, 0]}>
          <circleGeometry args={[0.065, 32]} />
          <meshBasicMaterial color="#0a84ff" toneMapped={false} />
        </mesh>
      )}

      {(selected || multi) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <ringGeometry args={[ringR, ringR + 0.045, 56]} />
          <meshBasicMaterial color={multi ? '#ff9f0a' : '#0a84ff'} transparent opacity={0.95} />
        </mesh>
      )}
    </group>
  )
}

useGLTF.preload(MODEL_ASSETS.gla1 as unknown as string)
useGLTF.preload(MODEL_ASSETS.hg02_single as unknown as string)
useGLTF.preload(MODEL_ASSETS.hg02_center as unknown as string)
