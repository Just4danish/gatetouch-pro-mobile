import { useEffect, useMemo, useRef, useState } from 'react'
import { LogBox, Platform, StyleSheet, Text, View } from 'react-native'
import {
  Gesture,
  GestureDetector,
  MouseButton,
  PointerType,
  ScrollView as GHScrollView,
} from 'react-native-gesture-handler'
import { GLView } from 'expo-gl'
import { useCorridor } from '../store/corridor'
import { createNativeStage, type CameraInfo, type NativeStage } from './nativeStage'

// Expo GL is not a full browser WebGL2; Three logs noisy but non-fatal shader notes.
LogBox.ignoreLogs([
  'THREE.WebGLProgram: Program Info Log',
  "EXGL: gl.pixelStorei() doesn't support this parameter yet!",
  "EXGL: renderbufferStorageMultisample() isn't implemented yet!",
])

function wheelFactor(dy: number) {
  if (!dy || !Number.isFinite(dy)) return 1
  const clamped = Math.max(-320, Math.min(320, dy))
  return Math.exp(-clamped * 0.0016)
}

function fmtHud(info: CameraInfo) {
  return `${info.action} r${info.radius.toFixed(2)}`
}

export function StageCanvas({ onMiss }: { onMiss: () => void }) {
  const stage = useRef<NativeStage | null>(null)
  const size = useRef({ width: 0, height: 0 })
  const onMissRef = useRef(onMiss)
  onMissRef.current = onMiss
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stageH, setStageH] = useState(0)
  const [hud, setHud] = useState('idle r0.00')
  const scrollRef = useRef<GHScrollView>(null)
  const scrollMid = useRef(0)
  const ignoreScroll = useRef(false)
  const orbitLast = useRef({ x: 0, y: 0 })
  const panLast = useRef({ x: 0, y: 0 })
  const pinchLast = useRef(1)
  const dragLock = useRef(0)

  const applyWheel = (dy: number) => {
    const factor = wheelFactor(dy)
    if (Math.abs(factor - 1) > 0.001) stage.current?.zoomBy(factor)
  }

  const hitAt = (x: number, y: number, pageX: number, pageY: number, kind: 'tap' | 'hold') => {
    const s = stage.current
    const st = useCorridor.getState()
    const hit = s?.pick(x, y)
    if (kind === 'hold') {
      if (hit?.kind === 'unit' && st.mode === 'build') st.openContextMenu(hit.id, pageX, pageY)
      return
    }
    if (hit?.kind === 'slot' && st.placingType) {
      const [gid, idx] = hit.id.split(':')
      st.insertUnit(st.placingType, Number(idx), gid)
      return
    }
    if (hit?.kind === 'unit' && st.mode === 'build') {
      if (st.multiSelectMode) st.toggleMulti(hit.id)
      else st.select({ kind: 'unit', id: hit.id })
    } else if (hit?.kind === 'lane' && st.mode === 'operate') st.requestLane(hit.id)
    else if (st.placingType) st.insertUnit(st.placingType)
    else onMissRef.current()
  }

  const composed = useMemo(() => {
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => {
        dragLock.current += 1
        pinchLast.current = 1
      })
      .onFinalize(() => {
        dragLock.current = Math.max(0, dragLock.current - 1)
      })
      .onUpdate((e) => {
        const prev = pinchLast.current || 1
        const factor = e.scale / prev
        pinchLast.current = e.scale
        if (Number.isFinite(factor) && Math.abs(factor - 1) > 0.001) stage.current?.zoomBy(factor)
      })

    const twoFingerPan = Gesture.Pan()
      .minPointers(2)
      .maxPointers(2)
      .averageTouches(true)
      .minDistance(2)
      .runOnJS(true)
      .onBegin((e) => {
        dragLock.current += 1
        panLast.current = { x: e.translationX, y: e.translationY }
      })
      .onFinalize(() => {
        dragLock.current = Math.max(0, dragLock.current - 1)
      })
      .onUpdate((e) => {
        const dx = e.translationX - panLast.current.x
        const dy = e.translationY - panLast.current.y
        panLast.current = { x: e.translationX, y: e.translationY }
        stage.current?.panBy(dx, dy)
      })

    const mousePan = Gesture.Pan()
      .mouseButton(MouseButton.MIDDLE | MouseButton.RIGHT)
      .minDistance(12)
      .runOnJS(true)
      .onBegin(() => {
        dragLock.current += 1
        panLast.current = { x: 0, y: 0 }
      })
      .onFinalize(() => {
        dragLock.current = Math.max(0, dragLock.current - 1)
      })
      .onUpdate((e) => {
        const dx = e.translationX - panLast.current.x
        const dy = e.translationY - panLast.current.y
        panLast.current = { x: e.translationX, y: e.translationY }
        stage.current?.panBy(dx, dy)
      })

    const orbit = Gesture.Pan()
      .minPointers(1)
      .maxPointers(1)
      .mouseButton(MouseButton.LEFT)
      .minDistance(4)
      .runOnJS(true)
      .onBegin(() => {
        dragLock.current += 1
        orbitLast.current = { x: 0, y: 0 }
      })
      .onFinalize(() => {
        dragLock.current = Math.max(0, dragLock.current - 1)
      })
      .onUpdate((e) => {
        const dx = e.translationX - orbitLast.current.x
        const dy = e.translationY - orbitLast.current.y
        orbitLast.current = { x: e.translationX, y: e.translationY }
        // Host mouse wheels on Android emulators are injected as vertical mouse
        // motion, not ACTION_SCROLL. Keep finger pitch as orbit.
        if (e.pointerType === PointerType.MOUSE && Math.abs(dy) > Math.abs(dx) * 2 + 1) {
          stage.current?.zoomBy(wheelFactor(dy))
          return
        }
        stage.current?.orbitBy(dx, dy)
      })

    const tap = Gesture.Tap()
      .maxDuration(280)
      .maxDistance(10)
      .runOnJS(true)
      .onEnd((e) => {
        hitAt(e.x, e.y, e.absoluteX, e.absoluteY, 'tap')
      })

    const hold = Gesture.LongPress()
      .minDuration(480)
      .maxDistance(12)
      .runOnJS(true)
      .onStart((e) => {
        hitAt(e.x, e.y, e.absoluteX, e.absoluteY, 'hold')
      })

    const nativeWheel = Gesture.Native()
      .requireExternalGestureToFail(orbit)
      .requireExternalGestureToFail(mousePan)
      .requireExternalGestureToFail(twoFingerPan)
      .requireExternalGestureToFail(pinch)
      .requireExternalGestureToFail(hold)
      .requireExternalGestureToFail(tap)

    return Gesture.Simultaneous(
      pinch,
      twoFingerPan,
      Gesture.Exclusive(orbit, mousePan, hold, tap),
      nativeWheel,
    )
  }, [])

  useEffect(() => {
    return () => {
      stage.current?.dispose()
      stage.current = null
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const info = stage.current?.cameraInfo()
      if (!info) return
      const next = fmtHud(info)
      setHud((prev) => (prev === next ? prev : next))
    }, 180)
    return () => clearInterval(id)
  }, [])

  const wheelProps = {
    onWheel: (e: { nativeEvent?: { deltaY?: number }; preventDefault?: () => void }) => {
      e.preventDefault?.()
      applyWheel(e.nativeEvent?.deltaY ?? 0)
    },
  } as object

  if (error) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.msg}>{error}</Text>
      </View>
    )
  }

  const hitChild =
    Platform.OS !== 'web' && stageH > 8 ? (
      <GHScrollView
        ref={scrollRef}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ height: stageH * 3 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        overScrollMode="never"
        bounces={false}
        nestedScrollEnabled
        disableIntervalMomentum
        keyboardShouldPersistTaps="always"
        testID="stage.wheel"
        accessibilityLabel="Mouse wheel zoom"
        collapsable={false}
        {...wheelProps}
        onScroll={(e) => {
          if (ignoreScroll.current || dragLock.current > 0) return
          const y = e.nativeEvent.contentOffset.y
          const dy = y - scrollMid.current
          if (Math.abs(dy) < 0.5) return
          applyWheel(dy)
          ignoreScroll.current = true
          scrollRef.current?.scrollTo({ y: scrollMid.current, animated: false })
          requestAnimationFrame(() => {
            ignoreScroll.current = false
          })
        }}
      >
        <View
          style={{ height: stageH * 3 }}
          collapsable={false}
          testID="stage.hit"
          accessibilityLabel="3D stage"
        />
      </GHScrollView>
    ) : (
      <View
        style={StyleSheet.absoluteFill}
        collapsable={false}
        testID="stage.hit"
        accessibilityLabel="3D stage"
        {...wheelProps}
      />
    )

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        size.current = { width, height }
        stage.current?.setViewSize(width, height)
        scrollMid.current = height
        setStageH(height)
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: height, animated: false })
        })
        if (width > 0 && !ready) setReady(true)
      }}
    >
      {ready && (
        <GLView
          key="stage-gl-v5"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
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
      <GestureDetector key="stage-gestures-v5" gesture={composed} userSelect="none">
        {hitChild}
      </GestureDetector>
      <View pointerEvents="none" style={styles.hudWrap}>
        <Text testID="stage.camera.hud" accessibilityLabel={`camera ${hud}`} style={styles.hud}>
          {hud}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { color: '#93a0b0', textAlign: 'center' },
  hudWrap: { position: 'absolute', left: 10, bottom: 10 },
  hud: {
    color: 'rgba(245,245,247,0.72)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
})
