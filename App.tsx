import { Suspense, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { fiber } from './src/lib/r3f'
import { ENVS, envColors } from './src/model/catalog'
import { useTheme, watchSystemTheme } from './src/store/theme'
import { useCorridor } from './src/store/corridor'
import { setStageFrame } from './src/lib/stageFrame'
import { Scene } from './src/three/Scene'
import { BuildPanel } from './src/ui/BuildPanel'
import { OperatePanel } from './src/ui/OperatePanel'
import { Inspector } from './src/ui/Inspector'
import { Help } from './src/ui/Help'
import { CameraBar, ContextMenu, DragGhost, LibrarySheet } from './src/ui/Overlays'
import { colors } from './src/theme/tokens'
import { tap } from './src/lib/feedback'

const { Canvas } = fiber

function AppInner() {
  const [libOpen, setLibOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const stageRef = useRef<View>(null)

  const mode = useCorridor((s) => s.mode)
  const setMode = useCorridor((s) => s.setMode)
  const name = useCorridor((s) => s.name)
  const setName = useCorridor((s) => s.setName)
  const units = useCorridor((s) => s.units)
  const env = useCorridor((s) => s.env)
  const select = useCorridor((s) => s.select)
  const undo = useCorridor((s) => s.undo)
  const redo = useCorridor((s) => s.redo)
  const canUndo = useCorridor((s) => s.past.length > 0)
  const canRedo = useCorridor((s) => s.future.length > 0)
  const hydrateLib = useCorridor((s) => s.hydrate)

  const theme = useTheme((s) => s.theme)
  const toggleTheme = useTheme((s) => s.toggle)
  const hydrateTheme = useTheme((s) => s.hydrate)
  const c = colors(theme)
  const backdrop = envColors(ENVS[env], theme).backdrop

  useEffect(() => {
    void hydrateTheme()
    void hydrateLib()
    return watchSystemTheme()
  }, [hydrateTheme, hydrateLib])

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      <View
        ref={stageRef}
        style={[styles.stage, { backgroundColor: backdrop }]}
        onLayout={() => {
          stageRef.current?.measureInWindow((x, y, width, height) => {
            setStageFrame(x, y, width, height)
          })
        }}
      >
        <Canvas
          style={StyleSheet.absoluteFill}
          shadows
          camera={{ position: [3, 2.4, 5], fov: 42, near: 0.05, far: 100 }}
          onPointerMissed={() => mode === 'build' && select(null)}
          gl={{ antialias: true }}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>

        <View style={[styles.topbar, { backgroundColor: c.chrome }]} pointerEvents="box-none">
          <View style={styles.titleBlock}>
            <Text style={[styles.brand, { color: c.text3 }]}>gatetouchpro</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={[styles.nameInput, { color: c.text, borderColor: c.hair, backgroundColor: c.surface }]}
              placeholder="Corridor name"
              placeholderTextColor={c.text3}
            />
            <Text style={{ color: c.text3, fontSize: 12 }}>
              {units.length} unit{units.length === 1 ? '' : 's'}
            </Text>
          </View>

          <View style={styles.topRight}>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: c.surface }]}
              onPress={() => {
                tap()
                toggleTheme()
              }}
            >
              <Text style={{ color: c.text }}>{theme === 'dark' ? 'L' : 'D'}</Text>
            </Pressable>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: c.surface }]}
              onPress={() => {
                tap()
                setHelpOpen(true)
              }}
            >
              <Text style={{ color: c.text }}>?</Text>
            </Pressable>
            {mode === 'build' && (
              <View style={styles.hist}>
                <Pressable
                  disabled={!canUndo}
                  style={[styles.iconBtn, { backgroundColor: c.surface, opacity: canUndo ? 1 : 0.35 }]}
                  onPress={() => {
                    tap()
                    undo()
                  }}
                >
                  <Text style={{ color: c.text }}>U</Text>
                </Pressable>
                <Pressable
                  disabled={!canRedo}
                  style={[styles.iconBtn, { backgroundColor: c.surface, opacity: canRedo ? 1 : 0.35 }]}
                  onPress={() => {
                    tap()
                    redo()
                  }}
                >
                  <Text style={{ color: c.text }}>R</Text>
                </Pressable>
              </View>
            )}
            <View style={[styles.segmented, { backgroundColor: c.fill2 }]}>
              <Pressable
                style={[styles.segBtn, mode === 'build' && { backgroundColor: c.accent }]}
                onPress={() => {
                  tap()
                  setMode('build')
                }}
              >
                <Text style={{ color: mode === 'build' ? c.onAccent : c.text, fontWeight: '700', fontSize: 13 }}>
                  Build
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segBtn, mode === 'operate' && { backgroundColor: c.accent }]}
                onPress={() => {
                  tap()
                  setMode('operate')
                }}
              >
                <Text
                  style={{ color: mode === 'operate' ? c.onAccent : c.text, fontWeight: '700', fontSize: 13 }}
                >
                  Operate
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <CameraBar />

        {units.length === 0 && mode === 'build' && (
          <View style={styles.emptyHint} pointerEvents="box-none">
            <Text style={{ color: c.labelFg, textAlign: 'center' }}>
              Tap a model below to place a turnstile
            </Text>
            <Pressable onPress={() => setHelpOpen(true)}>
              <Text style={{ color: c.accentFg, textAlign: 'center', marginTop: 6 }}>or read the guide</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={[styles.dock, { backgroundColor: c.panel, borderTopColor: c.hair }]}>
        {mode === 'build' ? <BuildPanel onOpenLibrary={() => setLibOpen(true)} /> : <OperatePanel />}
      </View>

      <Inspector />
      <ContextMenu />
      <DragGhost />
      <LibrarySheet open={libOpen} onClose={() => setLibOpen(false)} />
      <Help open={helpOpen} onClose={() => setHelpOpen(false)} />
    </SafeAreaView>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppInner />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1, minHeight: 0 },
  topbar: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleBlock: { flex: 1, gap: 2, minWidth: 0 },
  brand: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  nameInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 15,
    fontWeight: '700',
    maxWidth: 220,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hist: { flexDirection: 'row', gap: 4 },
  segmented: { flexDirection: 'row', borderRadius: 14, padding: 3, gap: 2 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  emptyHint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    paddingHorizontal: 20,
  },
  dock: {
    height: 280,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})
