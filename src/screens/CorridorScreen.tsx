import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { ENVS, envColors } from '../model/catalog'
import { useTheme, watchSystemTheme } from '../store/theme'
import { useHud } from '../store/hud'
import { useCorridor } from '../store/corridor'
import { setStageFrame, landscapeSideDockWidth, STAGE_CHROME_TOP } from '../lib/stageFrame'
import { BuildPanel } from '../ui/BuildPanel'
import { OperatePanel, useLaneTicker } from '../ui/OperatePanel'
import { Inspector, InspectorDock } from '../ui/Inspector'
import { Help } from '../ui/Help'
import { AppToast } from '../ui/AppToast'
import { CameraBar, ContextMenu, DragGhost, DualUnitBar, LibrarySheet } from '../ui/Overlays'
import { ChromeDrawer } from '../ui/ChromeDrawer'
import { Glass } from '../ui/Glass'
import { SceneSlot } from '../ui/SceneSlot'
import { IconChevron } from '../ui/Icons'
import { colors } from '../theme/tokens'
import { tap } from '../lib/feedback'
import { listLaneGroups } from '../api/laneGroup'
import { listLanes } from '../api/lane'
import { apiErrorMessage } from '../api/client'
import { useToast } from '../store/toast'

const SHEET_EASE = Easing.bezier(0.32, 0.72, 0, 1)

export function CorridorScreen() {
  const [libOpen, setLibOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const stageRef = useRef<View>(null)
  const insets = useSafeAreaInsets()
  const { width: windowW, height: windowH } = useWindowDimensions()
  const landscape = windowW > windowH
  const bodyH = Math.max(0, windowH - insets.top)
  const edgePad = Math.max(10, landscape ? Math.max(insets.right, 10) : insets.bottom || 10)
  // Portrait bottom card (Build + Operate): roomy list (~42%), still leaves a clear 3D stage.
  const portraitDockH = Math.min(440, Math.max(280, Math.round(bodyH * 0.42)))
  const sideDockW = landscapeSideDockWidth(windowW)

  const mode = useCorridor((s) => s.mode)
  const env = useCorridor((s) => s.env)
  const alarmKind = useCorridor((s) => s.alarmKind)
  const select = useCorridor((s) => s.select)
  const sel = useCorridor((s) => s.sel)
  const multi = useCorridor((s) => s.multi)
  const hydrateLib = useCorridor((s) => s.hydrate)
  const syncLaneGroupsFromServer = useCorridor((s) => s.syncLaneGroupsFromServer)
  // Keep lane auto-close running in Operate even when the side panel is collapsed.
  useLaneTicker()

  const theme = useTheme((s) => s.theme)
  const hydrateTheme = useTheme((s) => s.hydrate)
  const hydrateHud = useHud((s) => s.hydrate)
  const panelCollapsed = useHud((s) => s.panelCollapsed)
  const setPanelCollapsed = useHud((s) => s.setPanelCollapsed)
  const showToast = useToast((s) => s.show)
  const c = colors(theme)
  const backdrop = envColors(ENVS[env], theme).backdrop
  const panelLabel = mode === 'build' ? 'Lane groups' : 'Operate'
  const showDockInspector =
    landscape &&
    mode === 'build' &&
    !!sel &&
    multi.length !== 2 &&
    (sel.kind === 'unit' || sel.kind === 'lane' || sel.kind === 'group')

  const dragY = useSharedValue(0)
  const dockHSv = useSharedValue(portraitDockH)
  const collapsing = useRef(false)

  useEffect(() => {
    dockHSv.value = portraitDockH
  }, [portraitDockH, dockHSv])

  const collapsePortraitDock = () => {
    if (collapsing.current) return
    collapsing.current = true
    tap()
    setPanelCollapsed(true)
    dragY.value = 0
    collapsing.current = false
  }

  const portraitSheetGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetY(6)
      .failOffsetX([-24, 24])
      .onUpdate((e) => {
        dragY.value = Math.max(0, e.translationY)
      })
      .onEnd((e) => {
        const h = Math.max(160, dockHSv.value)
        const shouldCollapse = e.translationY > h * 0.22 || e.velocityY > 900
        if (shouldCollapse) {
          dragY.value = withTiming(
            h + 48,
            { duration: 240, easing: SHEET_EASE },
            (finished) => {
              if (finished) runOnJS(collapsePortraitDock)()
            },
          )
        } else {
          dragY.value = withSpring(0, {
            duration: 400,
            dampingRatio: 0.8,
            velocity: e.velocityY,
          })
        }
      })

    const tapG = Gesture.Tap().onEnd(() => {
      runOnJS(collapsePortraitDock)()
    })

    return Gesture.Exclusive(tapG, pan)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worklets close over shared values
  }, [])

  const portraitDockAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
    opacity: 1 - Math.min(0.35, dragY.value / Math.max(160, dockHSv.value)) * 0.9,
  }))

  useEffect(() => {
    if (!panelCollapsed) dragY.value = 0
  }, [panelCollapsed, dragY])

  useEffect(() => {
    void hydrateTheme()
    void hydrateLib()
    void hydrateHud().then(() => {
      useHud.getState().setPanelCollapsed(useCorridor.getState().mode === 'operate')
    })
    const hide = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {})
      setSceneReady(true)
    }, 50)
    return () => clearTimeout(hide)
  }, [hydrateTheme, hydrateLib, hydrateHud])

  // Operate: start collapsed. Build: start expanded.
  useEffect(() => {
    setPanelCollapsed(mode === 'operate')
  }, [mode, setPanelCollapsed])

  // Load lane groups on launch so Operate opens with the first group in 3D.
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [groups, laneRows] = await Promise.all([listLaneGroups(), listLanes()])
        if (!alive) return
        syncLaneGroupsFromServer(groups, laneRows)
      } catch (err) {
        if (!alive) return
        showToast(apiErrorMessage(err), 'error')
      }
    })()
    return () => {
      alive = false
    }
  }, [syncLaneGroupsFromServer, showToast])

  useEffect(() => watchSystemTheme(), [])

  // Landscape: selected unit/lane details live in the side card — expand it.
  useEffect(() => {
    if (showDockInspector && panelCollapsed) setPanelCollapsed(false)
  }, [showDockInspector, panelCollapsed, setPanelCollapsed])

  const dockStyle = landscape
    ? {
        width: sideDockW,
        marginLeft: 10,
        marginRight: 8,
        marginTop: STAGE_CHROME_TOP,
        marginBottom: Math.max(STAGE_CHROME_TOP, insets.bottom || STAGE_CHROME_TOP),
        alignSelf: 'stretch' as const,
      }
    : {
        height: portraitDockH,
      }

  const expandTabStyle = landscape
    ? {
        top: STAGE_CHROME_TOP + 56,
        right: Math.max(8, insets.right || 8),
        width: 40,
        height: 72,
      }
    : {
        height: 48,
      }

  const portraitChrome = !landscape
    ? {
        paddingTop: 20,
        paddingHorizontal: 12,
        paddingBottom: edgePad,
        backgroundColor: c.sheetBg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.hair,
      }
    : null

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      <View
        style={[
          styles.body,
          landscape && styles.bodyLandscape,
          !landscape && { backgroundColor: c.sheetBg },
        ]}
      >
        <View
          ref={stageRef}
          style={[
            styles.stage,
            { backgroundColor: backdrop },
            !landscape && styles.stagePortrait,
          ]}
          onLayout={() => {
            stageRef.current?.measureInWindow((x, y, width, height) => {
              setStageFrame(x, y, width, height)
            })
          }}
        >
          {sceneReady && (
            <SceneSlot
              onMiss={() => {
                if (mode === 'build') select(null)
                else useCorridor.getState().clearOperateFocus()
              }}
            />
          )}

          <CameraBar />
          <DualUnitBar />
        </View>

        {panelCollapsed ? (
          landscape ? (
            <Glass
              overlay={c.glass}
              style={[
                styles.expandTab,
                styles.expandTabLand,
                expandTabStyle,
                { borderColor: c.hair },
              ]}
            >
              <Pressable
                style={[styles.expandHit, styles.expandHitLand]}
                testID="app.panel.expand"
                accessibilityRole="button"
                accessibilityLabel={`Expand ${panelLabel}`}
                onPress={() => {
                  tap()
                  setPanelCollapsed(false)
                }}
              >
                <View style={styles.chevLandExpand}>
                  <IconChevron color={c.text2} size={16} />
                </View>
              </Pressable>
            </Glass>
          ) : (
            <View style={portraitChrome}>
              <Glass
                overlay={c.glass}
                style={[
                  styles.expandTabPort,
                  expandTabStyle,
                  { borderColor: c.hair, backgroundColor: c.panel },
                ]}
              >
                <Pressable
                  style={styles.expandHit}
                  testID="app.panel.expand"
                  accessibilityRole="button"
                  accessibilityLabel={`Expand ${panelLabel}`}
                  onPress={() => {
                    tap()
                    setPanelCollapsed(false)
                  }}
                >
                  <Text style={[styles.expandLabel, { color: c.text }]} numberOfLines={1}>
                    {panelLabel}
                  </Text>
                  <View style={styles.chevPortExpand}>
                    <IconChevron color={c.text2} size={16} />
                  </View>
                </Pressable>
              </Glass>
            </View>
          )
        ) : landscape ? (
          <Glass overlay={c.glass} style={[styles.dock, dockStyle, { borderColor: c.hair }]}>
            <View style={styles.dockInner}>
              <Pressable
                style={[
                  styles.collapseCtrl,
                  styles.collapseEdge,
                  { backgroundColor: c.glass, borderColor: c.hair },
                ]}
                testID="app.panel.collapse"
                accessibilityRole="button"
                accessibilityLabel={`Collapse ${panelLabel}`}
                hitSlop={8}
                onPress={() => {
                  tap()
                  setPanelCollapsed(true)
                }}
              >
                <View style={styles.chevLandCollapse}>
                  <IconChevron color={c.text2} size={14} />
                </View>
              </Pressable>
              <View style={styles.dockBody}>
                {showDockInspector ? (
                  <InspectorDock compact />
                ) : mode === 'build' ? (
                  <BuildPanel />
                ) : (
                  <OperatePanel />
                )}
              </View>
            </View>
          </Glass>
        ) : (
          <View style={portraitChrome}>
            <Animated.View
              style={[
                styles.dockPortShell,
                dockStyle,
                styles.dockPortLift,
                portraitDockAnim,
                { backgroundColor: c.panel, borderColor: c.hair },
              ]}
              onLayout={(e) => {
                dockHSv.value = e.nativeEvent.layout.height
              }}
            >
              <View style={styles.dockInner}>
                <GestureDetector gesture={portraitSheetGesture}>
                  <Animated.View
                    style={styles.collapseGrabAbs}
                    testID="app.panel.collapse"
                    accessibilityRole="button"
                    accessibilityLabel={`Collapse ${panelLabel}`}
                  >
                    <View style={[styles.grabBar, { backgroundColor: c.text3 }]} />
                  </Animated.View>
                </GestureDetector>
                <View style={styles.dockBody}>
                  {mode === 'build' ? <BuildPanel /> : <OperatePanel />}
                </View>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Same parent as stage + dock so gear Y matches the Lane groups card top. */}
        <ChromeDrawer onOpenHelp={() => setHelpOpen(true)} onOpenLibrary={() => setLibOpen(true)} />
      </View>

      <Inspector />
      <ContextMenu />
      <DragGhost />
      <LibrarySheet open={libOpen} onClose={() => setLibOpen(false)} />
      <Help open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AppToast />

      {/* Screen-share style rim while fire / emergency alarm is active.
          Keep below ChromeDrawer (gear / alarm buttons) — Android elevation on this
          layer was covering those controls after trigger. */}
      {alarmKind != null && (
        <View
          pointerEvents="none"
          testID="operate.alarm.frame"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            StyleSheet.absoluteFill,
            styles.alarmFrame,
            { borderColor: alarmKind === 'fire' ? c.orange : c.red },
          ]}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, position: 'relative' },
  bodyLandscape: { flexDirection: 'row', alignItems: 'stretch' },
  stage: { flex: 1, minWidth: 0, minHeight: 0 },
  /** Full-bleed colored rim — same idea as a screen-share recording border. */
  alarmFrame: {
    borderWidth: 3,
    // Above stage/dock chrome, below gear + fire/emergency buttons (ChromeDrawer zIndex 20).
    zIndex: 18,
  },
  /** Portrait: clip the GL stage so it ends above the bottom chrome strip. */
  stagePortrait: {
    overflow: 'hidden',
  },
  dock: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  /** Portrait: opaque shell (elevation + translucent Glass was painting a white band). */
  dockPortShell: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  dockPortLift: {
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -1 },
  },
  dockInner: { flex: 1, minHeight: 0, position: 'relative' },
  dockBody: { flex: 1, minHeight: 0, overflow: 'visible' },
  collapseCtrl: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  /** Landscape: tab on the stage-facing edge of the card. */
  collapseEdge: {
    position: 'absolute',
    left: -12,
    top: '42%',
    width: 22,
    height: 56,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  /** Portrait: grab overlays the card so it doesn’t leave an empty row. */
  collapseGrabAbs: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    elevation: 4,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 14,
  },
  grabBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.45,
  },
  chevLandCollapse: { transform: [{ rotate: '0deg' }] },
  /** Landscape only: floats on the stage edge. Portrait sits in normal column flow. */
  expandTab: {
    position: 'absolute',
    zIndex: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  expandTabPort: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  expandTabLand: {},
  expandHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  expandHitLand: {
    flexDirection: 'column',
    paddingHorizontal: 0,
  },
  expandLabel: { fontSize: 13, fontWeight: '700' },
  chevPortExpand: { transform: [{ rotate: '-90deg' }] },
  chevLandExpand: { transform: [{ rotate: '180deg' }] },
})
