import { useMemo, useRef, useState } from 'react'
import {
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCorridor } from '../store/corridor'
import { useTheme } from '../store/theme'
import { useHud } from '../store/hud'
import { colors } from '../theme/tokens'
import { tap, thud } from '../lib/feedback'
import { Glass } from './Glass'
import { IconGear, IconHelp, IconMoon, IconRedo, IconSun, IconUndo } from './Icons'

const LOGO_DARK = require('../assets/logo/logo_dark.png')
const LOGO_LIGHT = require('../assets/logo/logo.png')
const GEAR = 48

export function ChromeDrawer({
  onOpenHelp,
  onOpenLibrary,
}: {
  onOpenHelp: () => void
  onOpenLibrary: () => void
}) {
  const [open, setOpen] = useState(false)
  const [segW, setSegW] = useState(220)
  const insets = useSafeAreaInsets()
  const { width: winW, height: winH } = useWindowDimensions()
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0)
  const defaultX = Math.max(8, winW - GEAR - 12)
  const defaultY = topInset + 12

  const mode = useCorridor((s) => s.mode)
  const setMode = useCorridor((s) => s.setMode)
  const name = useCorridor((s) => s.name)
  const setName = useCorridor((s) => s.setName)
  const units = useCorridor((s) => s.units)
  const undo = useCorridor((s) => s.undo)
  const redo = useCorridor((s) => s.redo)
  const canUndo = useCorridor((s) => s.past.length > 0)
  const canRedo = useCorridor((s) => s.future.length > 0)

  const theme = useTheme((s) => s.theme)
  const toggleTheme = useTheme((s) => s.toggle)
  const camBarOn = useHud((s) => s.camBarOn)
  const setCamBarOn = useHud((s) => s.setCamBarOn)
  const storedX = useHud((s) => s.gearX)
  const storedY = useHud((s) => s.gearY)
  const setGearPos = useHud((s) => s.setGearPos)
  const c = colors(theme)
  const thumbW = Math.max(72, (segW - 8) / 2)

  const [live, setLive] = useState<{ x: number; y: number } | null>(null)
  const origin = useRef({ x: defaultX, y: defaultY })
  const posRef = useRef({ x: defaultX, y: defaultY })
  const win = useRef({ w: winW, h: winH, top: topInset })
  const persistPos = useRef(setGearPos)

  const x = live?.x ?? (storedX >= 0 ? storedX : defaultX)
  const y = live?.y ?? (storedY >= 0 ? storedY : defaultY)
  posRef.current = { x, y }
  win.current = { w: winW, h: winH, top: topInset }
  persistPos.current = setGearPos

  const close = () => setOpen(false)
  const toggle = () => {
    tap()
    setOpen((v) => !v)
  }

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(320)
        .onStart(() => {
          runOnJS(onDragStart)()
        })
        .onUpdate((e) => {
          runOnJS(onDragMove)(e.translationX, e.translationY)
        })
        .onFinalize(() => {
          runOnJS(onDragEnd)()
        }),
    [],
  )
  const tapG = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        runOnJS(toggle)()
      }),
    [],
  )
  const gearGesture = useMemo(() => Gesture.Exclusive(tapG, pan), [pan, tapG])

  function onDragStart() {
    origin.current = { ...posRef.current }
    thud()
  }
  function onDragMove(tx: number, ty: number) {
    const maxX = Math.max(8, win.current.w - GEAR - 8)
    const maxY = Math.max(win.current.top + 8, win.current.h - GEAR - 24)
    const next = {
      x: Math.min(Math.max(8, origin.current.x + tx), maxX),
      y: Math.min(Math.max(win.current.top + 8, origin.current.y + ty), maxY),
    }
    posRef.current = next
    setLive(next)
  }
  function onDragEnd() {
    persistPos.current(posRef.current.x, posRef.current.y)
    setLive(null)
  }

  return (
    <View style={styles.root} pointerEvents="box-none">
      {open && (
        <Pressable
          style={styles.dismiss}
          onPress={close}
          accessibilityLabel="Close menu"
          testID="app.chrome.dismiss"
        />
      )}

      {open && (
        <View style={[styles.sheetWrap, { paddingTop: topInset + 8 }]} pointerEvents="box-none">
          <Glass overlay={c.glass} style={[styles.sheet, { borderColor: c.hair }]}>
            <View style={styles.row}>
              <View style={[styles.titlePill, { backgroundColor: c.glass2, borderColor: c.hair }]}>
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
                    placeholder="Installation name"
                    placeholderTextColor={c.text3}
                    testID="app.installation.name"
                    accessibilityLabel="Installation name"
                  />
                  <Text style={{ color: c.text3, fontSize: 11, fontWeight: '600' }}>
                    {units.length} unit{units.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>

              <Pressable
                style={[styles.iconBtn, { backgroundColor: c.chrome, borderColor: c.hair }]}
                testID="app.theme.toggle"
                accessibilityLabel={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                onPress={() => {
                  tap()
                  toggleTheme()
                }}
              >
                {theme === 'dark' ? <IconSun color={c.text} /> : <IconMoon color={c.text} />}
              </Pressable>
              <Pressable
                style={[styles.iconBtn, { backgroundColor: c.chrome, borderColor: c.hair }]}
                testID="app.help.open"
                accessibilityLabel="Open guide"
                onPress={() => {
                  tap()
                  onOpenHelp()
                }}
              >
                <IconHelp color={c.text} />
              </Pressable>
            </View>

            <View style={styles.row}>
              {mode === 'build' && (canUndo || canRedo) && (
                <View style={[styles.hist, { backgroundColor: c.chrome, borderColor: c.hair }]}>
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
                </View>
              )}

              <View style={[styles.segmented, { backgroundColor: c.chrome, borderColor: c.hair }]}>
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
              </View>
              <Pressable
                style={[styles.libraryBtn, camBarOn && { backgroundColor: c.thumb2, borderRadius: 14 }]}
                testID="app.cam.toggle"
                accessibilityLabel={camBarOn ? 'Hide camera views' : 'Show camera views'}
                onPress={() => {
                  tap()
                  setCamBarOn(!camBarOn)
                }}
              >
                <Text style={{ color: camBarOn ? c.onThumb : c.text2, fontSize: 14, fontWeight: '600' }}>
                  Views {camBarOn ? 'On' : 'Off'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.libraryBtn}
                testID="build.installations.open"
                accessibilityLabel="Open installation library"
                onPress={() => {
                  tap()
                  onOpenLibrary()
                }}
              >
                <Text style={{ color: c.accentFg, fontSize: 14, fontWeight: '600' }}>Library</Text>
              </Pressable>
            </View>
          </Glass>
        </View>
      )}

      <GestureDetector gesture={gearGesture}>
        <View
          style={[
            styles.gear,
            {
              left: x,
              top: y,
              backgroundColor: c.chrome,
              borderColor: c.hair,
            },
          ]}
          testID="app.chrome.gear"
          accessibilityRole="button"
          accessibilityLabel={open ? 'Hide menu' : 'Show menu'}
          accessibilityHint="Long press and drag to move"
        >
          <IconGear color={c.text} />
        </View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  dismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetWrap: {
    paddingHorizontal: 12,
  },
  sheet: {
    width: '100%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titlePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
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
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    overflow: 'hidden',
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
  libraryBtn: {
    paddingHorizontal: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gear: {
    position: 'absolute',
    width: GEAR,
    height: GEAR,
    borderRadius: GEAR / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 22,
  },
})
