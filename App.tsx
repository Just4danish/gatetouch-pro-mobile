import { useEffect, useRef, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { ENVS, envColors } from './src/model/catalog'
import { useTheme, watchSystemTheme } from './src/store/theme'
import { useCorridor } from './src/store/corridor'
import { setStageFrame } from './src/lib/stageFrame'
import { BuildPanel } from './src/ui/BuildPanel'
import { OperatePanel } from './src/ui/OperatePanel'
import { Inspector } from './src/ui/Inspector'
import { Help } from './src/ui/Help'
import { CameraBar, ContextMenu, DragGhost, LibrarySheet } from './src/ui/Overlays'
import { Glass } from './src/ui/Glass'
import { SceneSlot } from './src/ui/SceneSlot'
import { colors } from './src/theme/tokens'
import { tap } from './src/lib/feedback'
import { IconHelp, IconMoon, IconRedo, IconSun, IconUndo } from './src/ui/Icons'

const LOGO_DARK = require('./src/assets/logo/logo_dark.png')
const LOGO_LIGHT = require('./src/assets/logo/logo.png')

function AppInner() {
  const [libOpen, setLibOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [segW, setSegW] = useState(220)
  const stageRef = useRef<View>(null)
  const insets = useSafeAreaInsets()

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
  const thumbW = Math.max(72, (segW - 8) / 2)

  useEffect(() => {
    void hydrateTheme()
    void hydrateLib()
    const hide = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {})
      setSceneReady(true)
    }, 50)
    return () => clearTimeout(hide)
  }, [hydrateTheme, hydrateLib])

  useEffect(() => watchSystemTheme(), [])

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
        {sceneReady && <SceneSlot onMiss={() => mode === 'build' && select(null)} />}

        <View style={styles.topbar} pointerEvents="box-none">
          <View style={styles.chromeRow}>
            <Glass overlay={c.glass} style={[styles.titlePill, { borderColor: c.hair }]}>
              <Image
                source={theme === 'dark' ? LOGO_DARK : LOGO_LIGHT}
                style={styles.logo}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <View style={styles.titleCopy}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={[styles.nameInput, { color: c.text }]}
                  placeholder="Corridor"
                  placeholderTextColor={c.text3}
                  testID="app.corridor.name"
                  accessibilityLabel="Corridor name"
                />
                <Text style={{ color: c.text3, fontSize: 11, fontWeight: '600' }}>
                  {units.length} unit{units.length === 1 ? '' : 's'}
                </Text>
              </View>
            </Glass>

            <View style={styles.iconRow}>
              <Glass overlay={c.chrome} style={[styles.iconBtn, { borderColor: c.hair }]}>
                <Pressable
                  style={styles.iconHit}
                  testID="app.theme.toggle"
                  accessibilityLabel={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                  onPress={() => {
                    tap()
                    toggleTheme()
                  }}
                >
                  {theme === 'dark' ? <IconSun color={c.text} /> : <IconMoon color={c.text} />}
                </Pressable>
              </Glass>
              <Glass overlay={c.chrome} style={[styles.iconBtn, { borderColor: c.hair }]}>
                <Pressable
                  style={styles.iconHit}
                  testID="app.help.open"
                  accessibilityLabel="Open guide"
                  onPress={() => {
                    tap()
                    setHelpOpen(true)
                  }}
                >
                  <IconHelp color={c.text} />
                </Pressable>
              </Glass>
            </View>
          </View>

          <View style={[styles.chromeRow, styles.modeRow]}>
            {mode === 'build' && (canUndo || canRedo) && (
              <Glass overlay={c.chrome} style={[styles.hist, { borderColor: c.hair }]}>
                <Pressable
                  disabled={!canUndo}
                  style={[styles.histBtn, { opacity: canUndo ? 1 : 0.35 }]}
                  testID="app.undo"
                  accessibilityLabel="Undo"
                  onPress={() => {
                    tap()
                    undo()
                  }}
                >
                  <IconUndo color={c.text} />
                </Pressable>
                <Pressable
                  disabled={!canRedo}
                  style={[styles.histBtn, { opacity: canRedo ? 1 : 0.35 }]}
                  testID="app.redo"
                  accessibilityLabel="Redo"
                  onPress={() => {
                    tap()
                    redo()
                  }}
                >
                  <IconRedo color={c.text} />
                </Pressable>
              </Glass>
            )}
            <Glass overlay={c.chrome} style={[styles.segmented, { borderColor: c.hair }]}>
              <View
                style={StyleSheet.absoluteFill}
                onLayout={(e) => setSegW(e.nativeEvent.layout.width)}
                pointerEvents="none"
              />
              <View
                pointerEvents="none"
                style={[
                  styles.segThumb,
                  {
                    width: thumbW,
                    backgroundColor: c.thumb,
                    transform: [{ translateX: mode === 'operate' ? thumbW : 0 }],
                  },
                ]}
              />
              <Pressable
                style={styles.segBtn}
                testID="app.mode.build"
                accessibilityLabel="Build mode"
                onPress={() => {
                  tap()
                  setMode('build')
                }}
              >
                <Text style={{ color: mode === 'build' ? c.onThumb : c.text2, fontWeight: '700', fontSize: 15 }}>
                  Build
                </Text>
              </Pressable>
              <Pressable
                style={styles.segBtn}
                testID="app.mode.operate"
                accessibilityLabel="Operate mode"
                onPress={() => {
                  tap()
                  setMode('operate')
                }}
              >
                <Text
                  style={{ color: mode === 'operate' ? c.onThumb : c.text2, fontWeight: '700', fontSize: 15 }}
                >
                  Operate
                </Text>
              </Pressable>
            </Glass>
          </View>
        </View>

        <CameraBar />

        {units.length === 0 && mode === 'build' && (
          <Glass overlay={c.glass} style={[styles.emptyHint, { borderColor: c.hair }]}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
              Start a corridor
            </Text>
            <Text style={{ color: c.text2, textAlign: 'center', marginTop: 4, lineHeight: 20 }}>
              Tap a model below, or open a ready-made layout.
            </Text>
            <View style={styles.emptyActions}>
              <Pressable
                style={[styles.emptyBtn, { backgroundColor: c.accent }]}
                testID="app.empty.library"
                accessibilityLabel="Open corridors library"
                onPress={() => {
                  tap()
                  setLibOpen(true)
                }}
              >
                <Text style={{ color: c.onAccent, fontWeight: '700' }}>Corridors</Text>
              </Pressable>
              <Pressable
                style={[styles.emptyBtn, { backgroundColor: c.glass2, borderColor: c.hair, borderWidth: 1 }]}
                testID="app.empty.help"
                accessibilityLabel="Open guide"
                onPress={() => {
                  tap()
                  setHelpOpen(true)
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>Guide</Text>
              </Pressable>
            </View>
          </Glass>
        )}
      </View>

      <Glass
        overlay={c.glass}
        style={[
          styles.dock,
          { borderColor: c.hair, marginBottom: Math.max(10, insets.bottom || 10) },
        ]}
      >
        {mode === 'build' ? <BuildPanel onOpenLibrary={() => setLibOpen(true)} /> : <OperatePanel />}
      </Glass>

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
  stage: { flex: 1, minHeight: 240 },
  topbar: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 4,
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeRow: { paddingRight: 48 },
  titlePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  logo: { width: 28, height: 28 },
  titleCopy: { flex: 1, minWidth: 0 },
  nameInput: {
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 0,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hist: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    height: 44,
  },
  histBtn: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  segmented: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    height: 44,
  },
  segThumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  emptyHint: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 3,
  },
  emptyActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  emptyBtn: {
    minHeight: 44,
    minWidth: 108,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dock: {
    marginHorizontal: 12,
    minHeight: 176,
    maxHeight: '34%',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
