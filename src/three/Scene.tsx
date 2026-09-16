import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { drei, fiber } from '../lib/r3f'

const { ContactShadows, Environment, OrbitControls, Text } = drei
const { useFrame, useThree } = fiber
import { CATALOG, ENVS, LED_DEFAULT, envColors } from '../model/catalog'
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
import { UnitObject } from './UnitObject'
import { Dimensions } from './Dimensions'

/** Frames the line, and flies to whatever the UI asks for. */
function CameraRig({ centerX, width, dep }: { centerX: number; width: number; dep: string }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3
    update: () => void
  } | null
  const camCmd = useCorridor((s) => s.camCmd)
  const want = useRef<{ pos: THREE.Vector3; tgt: THREE.Vector3 } | null>(null)

  useEffect(() => {
    const dist = Math.max(width * 1.25, 3.6)
    want.current = {
      pos: new THREE.Vector3(centerX + dist * 0.18, dist * 0.46, dist * 1.0),
      tgt: new THREE.Vector3(centerX, 0.7, 0),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])

  useEffect(() => {
    if (!camCmd) return
    want.current = {
      pos: new THREE.Vector3(...camCmd.pos),
      tgt: new THREE.Vector3(...camCmd.target),
    }
  }, [camCmd])

  useFrame((_, dt) => {
    const w = want.current
    if (!w) return
    const k = 1 - Math.exp(-6 * dt)
    camera.position.lerp(w.pos, k)
    if (controls) {
      controls.target.lerp(w.tgt, k)
      controls.update()
    }
    if (camera.position.distanceTo(w.pos) < 0.008) want.current = null
  })

  return null
}

/** Projects the finger onto the floor while dragging and picks an insert index. */
function DragBridge({ units, base }: { units: PlacedUnit[]; base: Layout }) {
  const dragging = useDrag((s) => s.type)
  const setIndex = useDrag((s) => s.setIndex)
  const camera = useThree((s) => s.camera)
  const ray = useRef(new THREE.Raycaster())
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const hit = useRef(new THREE.Vector3())

  useFrame(() => {
    if (!dragging) return
    const d = useDrag.getState()
    const { x: left, y: top, width, height } = stageFrame
    const inside =
      d.clientX >= left &&
      d.clientX <= left + width &&
      d.clientY >= top &&
      d.clientY <= top + height
    if (!inside) {
      setIndex(null)
      return
    }
    const ndcX = ((d.clientX - left) / width) * 2 - 1
    const ndcY = -((d.clientY - top) / height) * 2 + 1
    ray.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
    if (!ray.current.ray.intersectPlane(plane.current, hit.current)) {
      setIndex(units.length)
      return
    }
    let idx = 0
    for (const u of units) if (hit.current.x > base.x[u.id]) idx++
    setIndex(idx)
  })

  return null
}

function laneCenterX(lane: Lane, x: Record<string, number>): number {
  const xs = lane.members.map((m) => x[m.unitId]).filter((v) => v != null)
  if (!xs.length) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function Scene() {
  const units = useCorridor((s) => s.units)
  const lanes = useCorridor((s) => s.lanes)
  const gaps = useCorridor((s) => s.gaps)
  const mode = useCorridor((s) => s.mode)
  const envId = useCorridor((s) => s.env)
  const showDims = useCorridor((s) => s.showDims)
  const globalLed = useCorridor((s) => s.led)
  const globalFinish = useCorridor((s) => s.finish)
  const globalGlass = useCorridor((s) => s.glass)
  const sel = useCorridor((s) => s.sel)
  const multi = useCorridor((s) => s.multi)
  const select = useCorridor((s) => s.select)
  const openContextMenu = useCorridor((s) => s.openContextMenu)
  const requestLane = useCorridor((s) => s.requestLane)

  const dragType = useDrag((s) => s.type)
  const dragIndex = useDrag((s) => s.index)

  const env = ENVS[envId]
  const theme = useTheme((s) => s.theme)
  const look = envColors(env, theme)
  const base = useMemo(() => computeLayout(units, gaps), [units, gaps])
  const showGhost = dragType != null && dragIndex != null
  const layout = useMemo(
    () => (showGhost ? computeLayout(units, gaps, { index: dragIndex!, type: dragType! }) : base),
    [units, gaps, base, showGhost, dragIndex, dragType],
  )

  const targets = useMemo(() => wingTargets(lanes), [lanes])
  const dep = units.map((u) => `${u.id}${u.flipped ? 'f' : ''}`).join('|')
  const maxDepth = units.reduce((m, u) => Math.max(m, CATALOG[u.type].depthMm / 1000), 1)

  return (
    <>
      <ambientLight intensity={look.ambient} />
      <hemisphereLight
        args={['#cfe0ff', theme === 'light' ? '#b6bcc5' : '#2a2d33', look.ambient * 1.6]}
      />
      <directionalLight
        castShadow
        intensity={env.key}
        position={[layout.centerX + 3, 5, 3]}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0008}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <directionalLight
        intensity={env.key * 0.35}
        position={[layout.centerX - 3, 2, -3]}
        color="#9fc4ff"
      />
      <Environment preset={env.preset} environmentIntensity={look.intensity} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[layout.centerX, -0.001, 0]} receiveShadow>
        <planeGeometry args={[Math.max(layout.width + 30, 34), 40]} />
        <meshStandardMaterial color={look.floor} roughness={0.72} metalness={0} />
      </mesh>
      <ContactShadows
        position={[layout.centerX, 0.003, 0]}
        opacity={theme === 'light' ? 0.38 : 0.55}
        scale={Math.max(layout.width + 6, 10)}
        blur={2.6}
        far={5}
      />

      {units.map((u) => {
        const wings = CATALOG[u.type].wings
        const firstLane = laneOfWing(lanes, u.id, wings[0])
        const unitLanes = lanesOfUnit(lanes, u.id)
        const t: Record<string, number> = {}
        const wl: Record<string, typeof globalLed> = {}
        for (const w of wings) {
          t[w] = targets[`${u.id}:${w}`] ?? 0
          const wingLane = laneOfWing(lanes, u.id, w)
          wl[w] = u.led ?? wingLane?.led ?? globalLed ?? LED_DEFAULT
        }
        return (
          <UnitObject
            key={u.id}
            type={u.type}
            x={layout.x[u.id]}
            flipped={u.flipped}
            targets={t}
            led={u.led ?? firstLane?.led ?? globalLed ?? LED_DEFAULT}
            wingLeds={wl}
            finish={u.finish ?? globalFinish}
            glass={u.glass ?? globalGlass}
            direction={firstLane?.direction ?? 'both'}
            mode={firstLane?.mode ?? 'badge'}
            accessible={unitLanes.some((l) => l.accessible)}
            selected={mode === 'build' && sel?.kind === 'unit' && sel.id === u.id}
            multi={multi.includes(u.id)}
            onTap={mode === 'build' ? () => select({ kind: 'unit', id: u.id }) : undefined}
            onHold={mode === 'build' ? (cx, cy) => openContextMenu(u.id, cx, cy) : undefined}
          />
        )
      })}

      {showGhost && layout.ghostX != null && (
        <group position={[layout.ghostX, 0, 0]}>
          <mesh position={[0, 0.58, 0]}>
            <boxGeometry args={[CATALOG[dragType!].bodyMm / 1000, 1.16, 0.42]} />
            <meshStandardMaterial
              color="#0a84ff"
              emissive="#0a84ff"
              emissiveIntensity={0.5}
              transparent
              opacity={0.18}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
            <ringGeometry args={[0.24, 0.28, 48]} />
            <meshBasicMaterial color="#0a84ff" transparent opacity={0.9} />
          </mesh>
          <Text
            position={[0, 1.42, 0]}
            fontSize={0.12}
            color="#cfe3ff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.006}
            outlineColor="#000000"
          >
            {`Drop ${CATALOG[dragType!].short}`}
          </Text>
        </group>
      )}

      {(showDims || showGhost) && <Dimensions layout={layout} depth={maxDepth} />}

      {lanes.map((lane, i) => {
        const lx = laneCenterX(lane, layout.x)
        const blocked = lane.mode === 'locked' || lane.mode === 'noentry'
        const state = blocked ? lane.mode.toUpperCase() : lane.open ? 'OPEN' : 'CLOSED'
        const label = `${lane.name}${lane.accessible ? ' A' : ''}  ${state}`
        return (
          <Text
            key={lane.id}
            position={[lx, 1.24 + (i % 2) * 0.26, 0]}
            fontSize={0.1}
            color={lane.open ? '#30d158' : '#cfe3ff'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.005}
            outlineColor="#000000"
            onClick={(e) => {
              if (mode !== 'operate') return
              e.stopPropagation()
              requestLane(lane.id)
            }}
          >
            {label}
          </Text>
        )
      })}

      <OrbitControls
        makeDefault
        enableDamping
        maxPolarAngle={Math.PI * 0.495}
        minDistance={1.2}
        maxDistance={30}
        target={[layout.centerX, 0.8, 0]}
      />
      <CameraRig centerX={base.centerX} width={base.width} dep={dep} />
      <DragBridge units={units} base={base} />
    </>
  )
}
