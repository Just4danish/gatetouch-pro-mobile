import { useEffect, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { ENVS, envColors } from './src/model/catalog'
import { useTheme, watchSystemTheme } from './src/store/theme'
import { useHud } from './src/store/hud'
import { useCorridor } from './src/store/corridor'
import { setStageFrame } from './src/lib/stageFrame'
import { BuildPanel } from './src/ui/BuildPanel'
import { OperatePanel } from './src/ui/OperatePanel'
import { Inspector } from './src/ui/Inspector'
import { Help } from './src/ui/Help'
import { CameraBar, ContextMenu, DragGhost, DualUnitBar, LibrarySheet } from './src/ui/Overlays'
import { ChromeDrawer } from './src/ui/ChromeDrawer'
import { Glass } from './src/ui/Glass'
import { SceneSlot } from './src/ui/SceneSlot'
import { colors } from './src/theme/tokens'

function AppInner() {
  const [libOpen, setLibOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const stageRef = useRef<View>(null)
  const insets = useSafeAreaInsets()
  const { height: windowH } = useWindowDimensions()
  const bodyH = Math.max(0, windowH - insets.top)
  const buildDockH = Math.round(bodyH * 0.5)

  const mode = useCorridor((s) => s.mode)
  const env = useCorridor((s) => s.env)
  const select = useCorridor((s) => s.select)
  const hydrateLib = useCorridor((s) => s.hydrate)

  const theme = useTheme((s) => s.theme)
  const hydrateTheme = useTheme((s) => s.hydrate)
  const hydrateHud = useHud((s) => s.hydrate)
  const c = colors(theme)
  const backdrop = envColors(ENVS[env], theme).backdrop

  useEffect(() => {
    void hydrateTheme()
    void hydrateLib()
    void hydrateHud()
    const hide = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {})
      setSceneReady(true)
    }, 50)
    return () => clearTimeout(hide)
  }, [hydrateTheme, hydrateLib, hydrateHud])

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

        <CameraBar />
        <DualUnitBar />
      </View>

      <Glass
        overlay={c.glass}
        style={[
          styles.dock,
          mode === 'build' ? { height: buildDockH } : styles.dockOperate,
          { borderColor: c.hair, marginBottom: Math.max(10, insets.bottom || 10) },
        ]}
      >
        {mode === 'build' ? <BuildPanel /> : <OperatePanel />}
      </Glass>

      <Inspector />
      <ContextMenu />
      <DragGhost />
      <ChromeDrawer onOpenHelp={() => setHelpOpen(true)} onOpenLibrary={() => setLibOpen(true)} />
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
  stage: { flex: 1 },
  dock: {
    marginHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dockOperate: { minHeight: 176, maxHeight: '32%' },
})
