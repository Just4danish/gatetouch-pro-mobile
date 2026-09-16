import { useEffect, useRef, useState } from 'react'
import { LogBox, PanResponder, StyleSheet, Text, View } from 'react-native'
import { GLView } from 'expo-gl'
import { useCorridor } from '../store/corridor'
import { createNativeStage, type NativeStage } from './nativeStage'

// Expo GL is not a full browser WebGL2; Three logs noisy but non-fatal shader notes.
LogBox.ignoreLogs([
  'THREE.WebGLProgram: Program Info Log',
  "EXGL: gl.pixelStorei() doesn't support this parameter yet!",
  "EXGL: renderbufferStorageMultisample() isn't implemented yet!",
])

export function StageCanvas({ onMiss }: { onMiss: () => void }) {
  const stage = useRef<NativeStage | null>(null)
  const size = useRef({ width: 0, height: 0 })
  const onMissRef = useRef(onMiss)
  onMissRef.current = onMiss
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const press = useRef<{
    x: number
    y: number
    lastX: number
    lastY: number
    pageX: number
    pageY: number
    moved: boolean
    held: boolean
  } | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pinchDist = useRef<number | null>(null)
  const pinchMid = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    return () => {
      stage.current?.dispose()
      stage.current = null
      if (holdTimer.current) clearTimeout(holdTimer.current)
    }
  }, [])

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: (e) => {
        const n = e.nativeEvent
        press.current = {
          x: n.locationX,
          y: n.locationY,
          lastX: n.locationX,
          lastY: n.locationY,
          pageX: n.pageX,
          pageY: n.pageY,
          moved: false,
          held: false,
        }
        if (holdTimer.current) clearTimeout(holdTimer.current)
        holdTimer.current = setTimeout(() => {
          holdTimer.current = null
          const p = press.current
          if (!p || p.moved) return
          p.held = true
          const hit = stage.current?.pick(p.x, p.y)
          if (hit?.kind === 'unit' && useCorridor.getState().mode === 'build') {
            useCorridor.getState().openContextMenu(hit.id, p.pageX, p.pageY)
          }
        }, 500)
      },
      onPanResponderMove: (e) => {
        const n = e.nativeEvent
        const touches = n.touches
        if (touches && touches.length >= 2) {
          const a = touches[0]
          const b = touches[1]
          const d = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)
          const mx = (a.pageX + b.pageX) / 2
          const my = (a.pageY + b.pageY) / 2
          if (pinchDist.current && pinchDist.current > 8) {
            const zoom = d / pinchDist.current
            if (Number.isFinite(zoom) && Math.abs(zoom - 1) > 0.001) stage.current?.zoomBy(zoom)
          }
          if (pinchMid.current) {
            stage.current?.panBy(mx - pinchMid.current.x, my - pinchMid.current.y)
          }
          pinchDist.current = d
          pinchMid.current = { x: mx, y: my }
          const p = press.current
          if (p) p.moved = true
          if (holdTimer.current) {
            clearTimeout(holdTimer.current)
            holdTimer.current = null
          }
          return
        }
        pinchDist.current = null
        pinchMid.current = null
        const p = press.current
        if (!p) return
        const dx = n.locationX - p.lastX
        const dy = n.locationY - p.lastY
        p.lastX = n.locationX
        p.lastY = n.locationY
        if (!p.moved && Math.hypot(n.locationX - p.x, n.locationY - p.y) > 8) {
          p.moved = true
          if (holdTimer.current) {
            clearTimeout(holdTimer.current)
            holdTimer.current = null
          }
        }
        if (p.moved) stage.current?.orbitBy(dx, dy)
      },
      onPanResponderRelease: () => {
        pinchDist.current = null
        pinchMid.current = null
        if (holdTimer.current) {
          clearTimeout(holdTimer.current)
          holdTimer.current = null
        }
        const p = press.current
        press.current = null
        if (!p || p.moved || p.held) return
        const hit = stage.current?.pick(p.x, p.y)
        const st = useCorridor.getState()
        if (hit?.kind === 'unit' && st.mode === 'build') st.select({ kind: 'unit', id: hit.id })
        else if (hit?.kind === 'lane' && st.mode === 'operate') st.requestLane(hit.id)
      },
      onPanResponderTerminate: () => {
        pinchDist.current = null
        pinchMid.current = null
        if (holdTimer.current) {
          clearTimeout(holdTimer.current)
          holdTimer.current = null
        }
        press.current = null
      },
    }),
  ).current

  if (error) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.msg}>{error}</Text>
      </View>
    )
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        size.current = { width, height }
        stage.current?.setViewSize(width, height)
        if (width > 0 && !ready) setReady(true)
      }}
    >
      {ready && (
        <GLView
          key="stage-gl-v3"
          style={StyleSheet.absoluteFill}
          onContextCreate={(gl) => {
            try {
              stage.current?.dispose()
              const next = createNativeStage(gl, () => onMissRef.current())
              next.setViewSize(size.current.width, size.current.height)
              stage.current = next
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            }
          }}
        />
      )}
      <View style={StyleSheet.absoluteFill} {...responder.panHandlers} />
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { color: '#93a0b0', textAlign: 'center' },
})
