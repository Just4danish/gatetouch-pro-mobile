import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCorridor, lanesOfUnit } from '../store/corridor'
import { useAuth } from '../store/auth'
import { canManageResources, canViewSystemConfig, hasPermission } from '../auth/permissions'
import { useTheme } from '../store/theme'
import { useHud } from '../store/hud'
import { useToast } from '../store/toast'
import { colors } from '../theme/tokens'
import { tap, thud, whoosh, buzz } from '../lib/feedback'
import { landscapeSideDockWidth, STAGE_CHROME_TOP } from '../lib/stageFrame'
import { apiErrorMessage } from '../api/client'
import {
  hasDistinctExitPin,
  normalizePin,
  owningServerLaneId,
  serverLaneIdFromUnitId,
  triggerLaneEntry,
  triggerLaneExit,
} from '../api/lane'
import {
  closeLaneGroupEmergency,
  closeLaneGroupFire,
  triggerLaneGroupEmergency,
  triggerLaneGroupFire,
} from '../api/laneGroup'
import { Glass } from './Glass'
import { IconEmergency, IconFire, IconGear, IconHelp, IconLogout, IconMoon, IconRedo, IconSun, IconUndo, IconUser, IconUsers } from './Icons'
import { UsersListDialog } from './UsersListDialog'
import { makeUiStyles } from './uiStyles'

const LOGO_DARK = require('../assets/logo/logo_dark.png')
const LOGO_LIGHT = require('../assets/logo/logo.png')
const GEAR = 48
const GEAR_PAD = STAGE_CHROME_TOP
const SHEET_W = 320
const SHEET_GAP = 8
const ALLOW_W = 118
const ALLOW_H = 36
const ALLOW_GAP = 8
const ALARM = 44
const ALARM_GAP = 8

type AlarmKind = 'emergency' | 'fire'
type AlarmConfirm = { kind: AlarmKind; action: 'trigger' | 'cancel' }

const SLIDE_THUMB = 44
const SLIDE_PAD = 4

function SlideToConfirm({
  label,
  accent,
  fill,
  border,
  onConfirm,
}: {
  label: string
  accent: string
  fill: string
  border: string
  onConfirm: () => void
}) {
  const widthRef = useRef(280)
  const x = useRef(new Animated.Value(0)).current
  const xNow = useRef(0)
  const dragOrigin = useRef(0)
  const onConfirmRef = useRef(onConfirm)
  onConfirmRef.current = onConfirm

  useEffect(() => {
    const id = x.addListener(({ value }) => {
      xNow.current = value
    })
    return () => x.removeListener(id)
  }, [x])

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragOrigin.current = xNow.current
        },
        onPanResponderMove: (_e, g) => {
          const max = Math.max(0, widthRef.current - SLIDE_THUMB - SLIDE_PAD * 2)
          const next = Math.max(0, Math.min(max, dragOrigin.current + g.dx))
          x.setValue(next)
        },
        onPanResponderRelease: () => {
          const max = Math.max(0, widthRef.current - SLIDE_THUMB - SLIDE_PAD * 2)
          if (max > 0 && xNow.current >= max * 0.88) {
            x.setValue(max)
            onConfirmRef.current()
          } else {
            Animated.spring(x, {
              toValue: 0,
              useNativeDriver: false,
              bounciness: 0,
              speed: 18,
            }).start()
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(x, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 0,
            speed: 18,
          }).start()
        },
      }),
    [x],
  )

  return (
    <View
      style={[styles.slide, { backgroundColor: fill, borderColor: border }]}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width
      }}
      {...pan.panHandlers}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.slideFill,
          {
            backgroundColor: accent,
            width: Animated.add(x, SLIDE_THUMB * 0.55),
          },
        ]}
      />
      <Text style={[styles.slideLabel, { color: accent }]} pointerEvents="none">
        {label}
      </Text>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.slideThumb,
          {
            left: SLIDE_PAD,
            backgroundColor: '#fff',
            transform: [{ translateX: x }],
          },
        ]}
      >
        <Text style={{ color: '#111', fontWeight: '700' }}>{'>'}</Text>
      </Animated.View>
    </View>
  )
}

export function ChromeDrawer({
  onOpenHelp,
  onOpenLibrary,
}: {
  onOpenHelp: () => void
  onOpenLibrary: () => void
}) {
  const [open, setOpen] = useState(false)
  const [overlay, setOverlay] = useState({ w: 0, h: 0 })
  const insets = useSafeAreaInsets()
  const { width: winW, height: winH } = useWindowDimensions()
  const landscape = winW > winH
  // ChromeDrawer sits inside SafeAreaView — layout box is already inset. Do not add topInset again.
  const layoutW = overlay.w > 0 ? overlay.w : Math.max(0, winW - insets.left - insets.right)
  const layoutH = overlay.h > 0 ? overlay.h : Math.max(0, winH - insets.top)
  const panelCollapsed = useHud((s) => s.panelCollapsed)
  const setPanelCollapsed = useHud((s) => s.setPanelCollapsed)
  const sideDockW = landscape ? landscapeSideDockWidth(winW) : 0
  // Match CorridorScreen landscape dock: marginLeft 10 + width + marginRight 8
  const dockReserve = landscape && !panelCollapsed ? sideDockW + 18 : 0
  const defaultX = Math.max(GEAR_PAD, layoutW - dockReserve - GEAR - 20)
  const defaultY = STAGE_CHROME_TOP

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
  const logout = useAuth((s) => s.logout)
  const authUsername = useAuth((s) => s.username)
  const role = useAuth((s) => s.role)
  const canManage = canManageResources(role)
  const canViewUsers = canViewSystemConfig(role)
  const canTriggerLane = hasPermission(role, 'TRIGGER_LANE')
  const canTriggerEmergency = hasPermission(role, 'TRIGGER_EMERGENCY')
  const canCloseEmergency = hasPermission(role, 'CLOSE_EMERGENCY')
  const canTriggerFire = hasPermission(role, 'TRIGGER_FIRE')
  const canCloseFire = hasPermission(role, 'CLOSE_FIRE')
  const camBarOn = useHud((s) => s.camBarOn)
  const setCamBarOn = useHud((s) => s.setCamBarOn)
  const storedX = useHud((s) => s.gearX)
  const storedY = useHud((s) => s.gearY)
  const setGearPos = useHud((s) => s.setGearPos)
  const operateUnitId = useCorridor((s) => s.operateUnitId)
  const operateLaneId = useCorridor((s) => s.operateLaneId)
  const lanes = useCorridor((s) => s.lanes)
  const activeGroupId = useCorridor((s) => s.activeGroupId)
  const laneGroups = useCorridor((s) => s.laneGroups)
  const alarmKind = useCorridor((s) => s.alarmKind)
  const activateOperateUnit = useCorridor((s) => s.activateOperateUnit)
  const showToast = useToast((s) => s.show)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const [usersOpen, setUsersOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const showAllowChrome = mode === 'operate' && !!operateUnitId
  const activeGroup = laneGroups.find((g) => g.id === activeGroupId)
  const pinReady = (n: number | null | undefined) => typeof n === 'number' && n >= 1
  const emergencyPinOk = mode === 'operate' && pinReady(activeGroup?.emergencyPin)
  const firePinOk = mode === 'operate' && pinReady(activeGroup?.firePin)
  // Keep the button visible after trigger so the user can slide again to cancel/close.
  const showEmergencyAlarm =
    emergencyPinOk &&
    (alarmKind === 'emergency'
      ? canCloseEmergency || canTriggerEmergency
      : canTriggerEmergency)
  const showFireAlarm =
    firePinOk &&
    (alarmKind === 'fire' ? canCloseFire || canTriggerFire : canTriggerFire)
  const showAlarms = showEmergencyAlarm || showFireAlarm
  const alarmCount = (showEmergencyAlarm ? 1 : 0) + (showFireAlarm ? 1 : 0)
  const alarmClusterW =
    alarmCount > 0 ? alarmCount * ALARM + (alarmCount - 1) * ALARM_GAP : 0
  const [triggering, setTriggering] = useState<'entry' | 'exit' | null>(null)
  const [confirmAlarm, setConfirmAlarm] = useState<AlarmConfirm | null>(null)
  const [triggeringAlarm, setTriggeringAlarm] = useState(false)

  const focusedOperateLane = (() => {
    if (operateLaneId) return lanes.find((l) => l.id === operateLaneId) ?? null
    if (!operateUnitId) return null
    return lanesOfUnit(lanes, operateUnitId)[0] ?? null
  })()
  // Lane is mid open/hold delay — block Allow entry/exit until it closes.
  const laneTriggerBusy = !!focusedOperateLane?.open
  const entryPin = normalizePin(focusedOperateLane?.entryPin)
  const exitPin = normalizePin(focusedOperateLane?.exitPin)
  // No pin metadata → keep legacy single Allow entry. Distinct pins → both buttons.
  const showAllowEntry =
    showAllowChrome &&
    canTriggerLane &&
    (entryPin != null || (entryPin == null && exitPin == null))
  const showAllowExit =
    showAllowChrome && canTriggerLane && hasDistinctExitPin(entryPin, exitPin)

  useEffect(() => {
    if (!canManage && mode === 'build') {
      setPanelCollapsed(true)
      setMode('operate')
    }
  }, [canManage, mode, setMode, setPanelCollapsed])
  const allowCount = (showAllowEntry ? 1 : 0) + (showAllowExit ? 1 : 0)
  const allowClusterW =
    allowCount > 0 ? allowCount * ALLOW_W + (allowCount - 1) * ALLOW_GAP : 0

  // Dark translucent pill; Allow = green text + turnstile LED blue border;
  // Exit = same LED blue for text and border.
  const triggerFill = 'rgba(20, 20, 24, 0.72)'
  const triggerGreen = '#39ff14'
  const triggerBlue = '#0a84ff'

  const [live, setLive] = useState<{ x: number; y: number } | null>(null)
  const origin = useRef({ x: defaultX, y: defaultY })
  const posRef = useRef({ x: defaultX, y: defaultY })
  const win = useRef({ w: layoutW, h: layoutH, dock: dockReserve })
  const persistPos = useRef(setGearPos)

  const x = live?.x ?? (storedX >= 0 ? storedX : defaultX)
  const y = live?.y ?? (storedY >= 0 ? storedY : defaultY)
  posRef.current = { x, y }
  win.current = { w: layoutW, h: layoutH, dock: dockReserve }
  persistPos.current = setGearPos

  // Prefer edge anchors so the gear stays on the Lane groups card top row.
  const useAnchored = live == null && (storedX < 0 || storedY < 0)
  const gearRight = Math.max(GEAR_PAD, dockReserve + 12)
  const gearTop = landscape || useAnchored ? STAGE_CHROME_TOP : y
  const sheetW = Math.min(SHEET_W, Math.max(280, layoutW - GEAR - 20))
  const gearStyle = useAnchored
    ? {
        top: STAGE_CHROME_TOP,
        right: gearRight,
        backgroundColor: c.chrome,
        borderColor: c.hair,
      }
    : {
        left: x,
        top: gearTop,
        backgroundColor: c.chrome,
        borderColor: c.hair,
      }

  const sheetStyle = (() => {
    const chromeBeside = showAllowEntry || showAllowExit || showAlarms
    if (useAnchored) {
      if (chromeBeside) {
        // Hang directly under the gear so side chrome doesn't cover the menu.
        return {
          top: STAGE_CHROME_TOP + GEAR + SHEET_GAP,
          right: gearRight,
          width: sheetW,
        }
      }
      return {
        top: STAGE_CHROME_TOP,
        right: gearRight + GEAR + SHEET_GAP,
        width: sheetW,
      }
    }
    const spaceLeft = x - SHEET_GAP
    const spaceRight = layoutW - x - GEAR - SHEET_GAP
    if (chromeBeside) {
      // Drop under the gear button, right-aligned with it.
      return {
        top: gearTop + GEAR + SHEET_GAP,
        left: Math.min(Math.max(8, x + GEAR - sheetW), Math.max(8, layoutW - sheetW - 8)),
        width: sheetW,
      }
    }
    if (spaceLeft >= sheetW) {
      return { top: gearTop, left: x - sheetW - SHEET_GAP, width: sheetW }
    }
    if (spaceRight >= sheetW) {
      return { top: gearTop, left: x + GEAR + SHEET_GAP, width: sheetW }
    }
    return {
      top: gearTop + GEAR + SHEET_GAP,
      left: Math.min(Math.max(8, x + GEAR - sheetW), Math.max(8, layoutW - sheetW - 8)),
      width: sheetW,
    }
  })()

  const alarmStyle = useAnchored
    ? {
        top: STAGE_CHROME_TOP + (GEAR - ALARM) / 2,
        right: gearRight + GEAR + ALLOW_GAP,
      }
    : {
        top: gearTop + (GEAR - ALARM) / 2,
        left: Math.max(8, x - alarmClusterW - ALLOW_GAP),
      }

  const allowStyle = useAnchored
    ? {
        top: STAGE_CHROME_TOP + (GEAR - ALLOW_H) / 2,
        right:
          gearRight +
          GEAR +
          ALLOW_GAP +
          (showAlarms ? alarmClusterW + ALLOW_GAP : 0),
      }
    : {
        top: gearTop + (GEAR - ALLOW_H) / 2,
        left: Math.max(
          8,
          x -
            allowClusterW -
            ALLOW_GAP -
            (showAlarms ? alarmClusterW + ALLOW_GAP : 0),
        ),
      }

  const resolveServerLaneId = () => {
    const s = useCorridor.getState()
    if (s.operateLaneId) {
      const lane = s.lanes.find((l) => l.id === s.operateLaneId)
      if (lane) {
        const sid = owningServerLaneId(lane.members)
        if (sid) return sid
      }
    }
    if (s.operateUnitId) {
      const fromUnit = serverLaneIdFromUnitId(s.operateUnitId)
      if (fromUnit) return fromUnit
      for (const lane of lanesOfUnit(s.lanes, s.operateUnitId)) {
        const sid = owningServerLaneId(lane.members)
        if (sid) return sid
      }
    }
    return null
  }

  const onAllowTrigger = (dir: 'entry' | 'exit') => {
    if (!operateUnitId || triggering || laneTriggerBusy) return
    const serverLaneId = resolveServerLaneId()
    if (!serverLaneId) {
      buzz()
      showToast('No server lane linked to this selection', 'error')
      return
    }

    setTriggering(dir)
    const run = dir === 'exit' ? triggerLaneExit(serverLaneId) : triggerLaneEntry(serverLaneId)
    void run
      .then(() => {
        whoosh()
        activateOperateUnit(operateUnitId)
        setOpen(false)
      })
      .catch((err) => {
        buzz()
        showToast(apiErrorMessage(err), 'error')
      })
      .finally(() => {
        setTriggering(null)
      })
  }

  const orientRef = useRef(landscape)
  const layoutReady = useRef(false)
  useEffect(() => {
    // Clear stale absolute coords once so edge anchors can line up with the card.
    if (storedX >= 0 || storedY >= 0) setGearPos(-1, -1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot migrate
  }, [])
  useEffect(() => {
    if (layoutW < 8 || layoutH < 8) return
    const maxX = Math.max(GEAR_PAD, layoutW - dockReserve - GEAR - 20)
    const maxY = Math.max(GEAR_PAD, layoutH - GEAR - GEAR_PAD)
    if (orientRef.current !== landscape) {
      orientRef.current = landscape
      layoutReady.current = true
      setGearPos(-1, -1)
      return
    }
    if (storedX >= 0 && (storedX > maxX + 1 || storedY > maxY + 1 || storedY < 0)) {
      setGearPos(-1, -1)
      return
    }
    if (!layoutReady.current) {
      layoutReady.current = true
      if (storedX >= 0 && storedX > layoutW * 0.85) {
        setGearPos(-1, -1)
        return
      }
    }
    if (storedX < 0 || storedY < 0) return
    const nx = Math.min(Math.max(GEAR_PAD, storedX), maxX)
    const ny = landscape ? STAGE_CHROME_TOP : Math.min(Math.max(GEAR_PAD, storedY), maxY)
    if (nx !== storedX || ny !== storedY) setGearPos(nx, ny)
  }, [landscape, layoutW, layoutH, dockReserve, storedX, storedY, setGearPos])

  useEffect(() => {
    // Re-anchor gear when the side dock appears/disappears.
    if (landscape) setGearPos(-1, -1)
  }, [panelCollapsed, landscape, setGearPos])

  const close = () => {
    setAccountMenuOpen(false)
    setOpen(false)
  }
  const toggle = () => {
    tap()
    setOpen((v) => {
      if (v) setAccountMenuOpen(false)
      return !v
    })
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
    const maxX = Math.max(GEAR_PAD, win.current.w - win.current.dock - GEAR - 20)
    const maxY = Math.max(GEAR_PAD, win.current.h - GEAR - GEAR_PAD)
    const next = {
      x: Math.min(Math.max(GEAR_PAD, origin.current.x + tx), maxX),
      y: Math.min(Math.max(GEAR_PAD, origin.current.y + ty), maxY),
    }
    posRef.current = next
    setLive(next)
  }
  function onDragEnd() {
    persistPos.current(posRef.current.x, posRef.current.y)
    setLive(null)
  }

  return (
    <View
      style={styles.root}
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        if (width > 0 && height > 0) setOverlay({ w: width, h: height })
      }}
    >
      {open && (
        <Pressable
          style={styles.dismiss}
          onPress={close}
          accessibilityLabel="Close menu"
          testID="app.chrome.dismiss"
        />
      )}

      {open && (
        <View style={[styles.sheetWrap, sheetStyle]} pointerEvents="box-none">
          <Glass overlay={c.glass} style={[styles.sheet, { borderColor: c.hair }]}>
            {/* Installation + theme / help / account */}
            <View style={styles.row}>
              <View style={[styles.titlePill, { backgroundColor: c.glass2, borderColor: c.hair }]}>
                <View style={styles.logoWrap}>
                  <Image
                    source={theme === 'dark' ? LOGO_DARK : LOGO_LIGHT}
                    style={styles.logo}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                </View>
                <View style={styles.titleCopy}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    style={[styles.nameInput, { color: c.text }]}
                    placeholder="Installation"
                    placeholderTextColor={c.text3}
                    testID="app.installation.name"
                    accessibilityLabel="Installation name"
                  />
                  <Text style={[styles.unitMeta, { color: c.text3 }]} numberOfLines={1}>
                    {units.length} unit{units.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>

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
                    <IconUndo color={c.text} size={16} />
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
                    <IconRedo color={c.text} size={16} />
                  </Pressable>
                </View>
              )}

              <Pressable
                style={[styles.iconBtn, { backgroundColor: c.chrome, borderColor: c.hair }]}
                testID="app.theme.toggle"
                accessibilityLabel={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                onPress={() => {
                  tap()
                  toggleTheme()
                }}
              >
                {theme === 'dark' ? <IconSun color={c.text} size={15} /> : <IconMoon color={c.text} size={15} />}
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
                <IconHelp color={c.text} size={15} />
              </Pressable>
              <Pressable
                style={[
                  styles.userBtn,
                  {
                    backgroundColor: accountMenuOpen ? c.accentTint : c.chrome,
                    borderColor: accountMenuOpen ? c.accent : c.hair,
                  },
                ]}
                testID="app.account.open"
                accessibilityRole="button"
                accessibilityLabel="Account menu"
                accessibilityState={{ expanded: accountMenuOpen }}
                onPress={() => {
                  tap()
                  setAccountMenuOpen((v) => !v)
                }}
              >
                <IconUser color={accountMenuOpen ? c.accentFg : c.text} size={18} />
              </Pressable>
            </View>

            {/* Workspace */}
            <View style={styles.row}>
              {canManage ? (
                <View style={[styles.segmented, { backgroundColor: c.fill2, borderColor: c.hair }]}>
                  <Pressable
                    style={[styles.segBtn, mode === 'build' && { backgroundColor: c.accent }]}
                    testID="app.mode.build"
                    accessibilityRole="button"
                    accessibilityLabel="Build mode"
                    accessibilityState={{ selected: mode === 'build' }}
                    onPress={() => {
                      tap()
                      setPanelCollapsed(false)
                      setMode('build')
                    }}
                  >
                    <Text
                      style={{
                        color: mode === 'build' ? c.onAccent : c.text2,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      Build
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.segBtn, mode === 'operate' && { backgroundColor: c.accent }]}
                    testID="app.mode.operate"
                    accessibilityRole="button"
                    accessibilityLabel="Operate mode"
                    accessibilityState={{ selected: mode === 'operate' }}
                    onPress={() => {
                      tap()
                      setPanelCollapsed(true)
                      setMode('operate')
                    }}
                  >
                    <Text
                      style={{
                        color: mode === 'operate' ? c.onAccent : c.text2,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      Operate
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={[styles.modePill, { backgroundColor: c.fill2, borderColor: c.hair }]}>
                  <Text style={{ color: c.text2, fontSize: 13, fontWeight: '700' }}>Operate</Text>
                </View>
              )}
              <Pressable
                style={[
                  styles.toolBtn,
                  {
                    backgroundColor: camBarOn ? c.accentTint : c.chrome,
                    borderColor: camBarOn ? c.accent : c.hair,
                  },
                ]}
                testID="app.cam.toggle"
                accessibilityRole="button"
                accessibilityLabel={camBarOn ? 'Hide camera views' : 'Show camera views'}
                accessibilityState={{ selected: camBarOn }}
                onPress={() => {
                  tap()
                  setCamBarOn(!camBarOn)
                }}
              >
                <Text
                  style={{
                    color: camBarOn ? c.accentFg : c.text2,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  Views
                </Text>
              </Pressable>
            </View>

            {accountMenuOpen ? (
              <View style={[styles.accountPanel, { backgroundColor: c.glass2, borderColor: c.hair }]}>
                <View style={styles.accountHeader}>
                  <View style={[styles.avatar, { backgroundColor: c.fill2, borderColor: c.hair }]}>
                    <IconUser color={c.accentFg} size={18} />
                  </View>
                  <View style={styles.accountCopy}>
                    <Text style={[styles.accountName, { color: c.text }]} numberOfLines={1}>
                      {authUsername || 'Signed in'}
                    </Text>
                    <Text style={[styles.accountRole, { color: c.text3 }]} numberOfLines={1}>
                      {role === 'Admin'
                        ? 'Admin'
                        : role === 'Operator1'
                          ? 'Operator 1'
                          : role === 'Operator2'
                            ? 'Operator 2'
                            : 'User'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.accountDivider, { backgroundColor: c.hair }]} />

                {canViewUsers ? (
                  <Pressable
                    style={styles.accountMenuItem}
                    testID="app.users.open"
                    accessibilityRole="button"
                    accessibilityLabel="View users"
                    onPress={() => {
                      tap()
                      setAccountMenuOpen(false)
                      setOpen(false)
                      setUsersOpen(true)
                    }}
                  >
                    <IconUsers color={c.text2} size={16} />
                    <Text style={[styles.accountMenuText, { color: c.text }]}>Users</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={styles.accountMenuItem}
                  testID="app.auth.logout"
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                  onPress={() => {
                    tap()
                    setAccountMenuOpen(false)
                    setOpen(false)
                    void logout()
                  }}
                >
                  <IconLogout color={c.redFg} size={16} />
                  <Text style={[styles.accountMenuText, { color: c.redFg }]}>Sign out</Text>
                </Pressable>
              </View>
            ) : null}
          </Glass>
        </View>
      )}

      {showAlarms && (
        <View style={[styles.alarmRow, alarmStyle]}>
          {showEmergencyAlarm && (
            <Pressable
              style={[
                styles.alarmBtn,
                {
                  backgroundColor: alarmKind === 'emergency' ? c.red : c.chrome,
                  borderColor: alarmKind === 'emergency' ? c.red : c.hair,
                },
              ]}
              testID="operate.alarm.emergency"
              accessibilityRole="button"
              accessibilityLabel={
                alarmKind === 'emergency' ? 'Cancel emergency alarm' : 'Emergency alarm'
              }
              onPress={() => {
                tap()
                setOpen(false)
                setConfirmAlarm({
                  kind: 'emergency',
                  action: alarmKind === 'emergency' ? 'cancel' : 'trigger',
                })
              }}
            >
              <IconEmergency color={alarmKind === 'emergency' ? c.onAccent : c.red} size={24} />
            </Pressable>
          )}
          {showFireAlarm && (
            <Pressable
              style={[
                styles.alarmBtn,
                {
                  backgroundColor: alarmKind === 'fire' ? c.orange : c.chrome,
                  borderColor: alarmKind === 'fire' ? c.orange : c.hair,
                },
              ]}
              testID="operate.alarm.fire"
              accessibilityRole="button"
              accessibilityLabel={alarmKind === 'fire' ? 'Cancel fire alarm' : 'Fire alarm'}
              onPress={() => {
                tap()
                setOpen(false)
                setConfirmAlarm({
                  kind: 'fire',
                  action: alarmKind === 'fire' ? 'cancel' : 'trigger',
                })
              }}
            >
              <IconFire color={alarmKind === 'fire' ? c.onAccent : c.orange} size={24} />
            </Pressable>
          )}
        </View>
      )}

      {(showAllowEntry || showAllowExit) && (
        <View style={[styles.allowRow, allowStyle]}>
          {showAllowEntry && (
            <Pressable
              style={[
                styles.allowEntry,
                {
                  backgroundColor: triggerFill,
                  borderColor: triggerBlue,
                  borderWidth: 2,
                },
                (triggering === 'entry' || laneTriggerBusy) && { opacity: 0.45 },
              ]}
              testID="operate.allowEntry"
              accessibilityRole="button"
              accessibilityLabel="Allow entry"
              accessibilityState={{ disabled: !!triggering || laneTriggerBusy }}
              disabled={!!triggering || laneTriggerBusy}
              onPress={() => onAllowTrigger('entry')}
            >
              <Text
                style={{
                  color: triggerGreen,
                  fontSize: 13,
                  fontWeight: '700',
                }}
                numberOfLines={1}
              >
                {triggering === 'entry' ? '…' : 'Allow entry'}
              </Text>
            </Pressable>
          )}
          {showAllowExit && (
            <Pressable
              style={[
                styles.allowEntry,
                {
                  backgroundColor: triggerFill,
                  borderColor: triggerBlue,
                  borderWidth: 2,
                },
                (triggering === 'exit' || laneTriggerBusy) && { opacity: 0.45 },
              ]}
              testID="operate.allowExit"
              accessibilityRole="button"
              accessibilityLabel="Allow exit"
              accessibilityState={{ disabled: !!triggering || laneTriggerBusy }}
              disabled={!!triggering || laneTriggerBusy}
              onPress={() => onAllowTrigger('exit')}
            >
              <Text
                style={{
                  color: triggerBlue,
                  fontSize: 13,
                  fontWeight: '700',
                }}
                numberOfLines={1}
              >
                {triggering === 'exit' ? '…' : 'Allow exit'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <GestureDetector gesture={gearGesture}>
        <View
          style={[styles.gear, gearStyle]}
          testID="app.chrome.gear"
          accessibilityRole="button"
          accessibilityLabel={open ? 'Hide menu' : 'Show menu'}
          accessibilityHint="Long press and drag to move"
        >
          <IconGear color={c.text} />
        </View>
      </GestureDetector>

      <Modal
        transparent
        visible={confirmAlarm != null}
        animationType="fade"
        onRequestClose={() => setConfirmAlarm(null)}
        statusBarTranslucent
      >
        <View style={styles.emDim}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setConfirmAlarm(null)}
            accessibilityLabel="Dismiss"
          />
          <View style={[styles.emCard, { backgroundColor: c.sheetBg, borderColor: c.hair }]}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 18 }}>
              {confirmAlarm?.action === 'cancel'
                ? confirmAlarm.kind === 'fire'
                  ? 'Cancel fire alarm?'
                  : 'Cancel emergency alarm?'
                : confirmAlarm?.kind === 'fire'
                  ? 'Fire alarm?'
                  : 'Emergency alarm?'}
            </Text>
            <Text style={{ color: c.text2, marginTop: 8, lineHeight: 20 }}>
              {confirmAlarm?.action === 'cancel'
                ? confirmAlarm.kind === 'fire'
                  ? 'Slide to cancel the fire alarm and close the gates on this device.'
                  : 'Slide to cancel the emergency alarm and close the gates on this device.'
                : confirmAlarm?.kind === 'fire'
                  ? 'Slide to confirm the fire exit alarm for this lane group.'
                  : 'Slide to confirm the emergency alarm for this lane group.'}
            </Text>
            <View style={{ marginTop: 18, gap: 12 }}>
              <SlideToConfirm
                key={`${confirmAlarm?.kind ?? 'none'}-${confirmAlarm?.action ?? 'none'}`}
                label={
                  confirmAlarm?.action === 'cancel'
                    ? confirmAlarm.kind === 'fire'
                      ? 'Slide to cancel fire'
                      : 'Slide to cancel emergency'
                    : confirmAlarm?.kind === 'fire'
                      ? 'Slide to confirm fire'
                      : 'Slide to confirm emergency'
                }
                accent={confirmAlarm?.kind === 'fire' ? c.orange : c.red}
                fill={
                  confirmAlarm?.kind === 'fire' ? 'rgba(255, 159, 10, 0.14)' : c.tintRedBg
                }
                border={
                  confirmAlarm?.kind === 'fire' ? 'rgba(255, 159, 10, 0.4)' : c.tintRedBd
                }
                onConfirm={() => {
                  if (triggeringAlarm) return
                  const pending = confirmAlarm
                  if (!pending || (pending.kind !== 'fire' && pending.kind !== 'emergency')) {
                    setConfirmAlarm(null)
                    return
                  }

                  if (!activeGroupId) {
                    buzz()
                    showToast('No lane group selected', 'error')
                    setConfirmAlarm(null)
                    return
                  }

                  setTriggeringAlarm(true)

                  if (pending.action === 'cancel') {
                    // Close must hit the backend so the configured GPIO pin turns OFF.
                    const closeReq =
                      pending.kind === 'fire'
                        ? closeLaneGroupFire(activeGroupId)
                        : closeLaneGroupEmergency(activeGroupId)
                    void closeReq
                      .then(() => {
                        useCorridor.getState().clearAlarm()
                        thud()
                        showToast(
                          pending.kind === 'fire'
                            ? 'Fire alarm cancelled'
                            : 'Emergency alarm cancelled',
                          'success',
                        )
                      })
                      .catch((err) => {
                        buzz()
                        showToast(apiErrorMessage(err), 'error')
                      })
                      .finally(() => {
                        setTriggeringAlarm(false)
                        setConfirmAlarm(null)
                      })
                    return
                  }

                  const req =
                    pending.kind === 'fire'
                      ? triggerLaneGroupFire(activeGroupId)
                      : triggerLaneGroupEmergency(activeGroupId)
                  void req
                    .then(() => {
                      useCorridor.getState().applyAlarmOpen(pending.kind)
                      whoosh()
                      showToast(
                        pending.kind === 'fire'
                          ? 'Fire alarm triggered'
                          : 'Emergency alarm triggered',
                        'success',
                      )
                    })
                    .catch((err) => {
                      buzz()
                      showToast(apiErrorMessage(err), 'error')
                    })
                    .finally(() => {
                      setTriggeringAlarm(false)
                      setConfirmAlarm(null)
                    })
                }}
              />
              <Pressable
                style={u.btn}
                testID="operate.alarm.cancel"
                onPress={() => setConfirmAlarm(null)}
              >
                <Text style={u.btnText}>
                  {confirmAlarm?.action === 'cancel' ? 'Keep alarm' : 'Cancel'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {canViewUsers ? (
        <UsersListDialog open={usersOpen} onClose={() => setUsersOpen(false)} />
      ) : null}
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
    position: 'absolute',
    zIndex: 21,
  },
  sheet: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  titlePill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 36,
    maxHeight: 36,
  },
  logoWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logo: { width: 16, height: 16 },
  titleCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  nameInput: {
    width: '100%',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 2,
    paddingRight: 2,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  unitMeta: {
    fontSize: 8,
    fontWeight: '600',
    paddingLeft: 2,
    marginTop: 0,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  toolBtn: {
    paddingHorizontal: 10,
    minHeight: 32,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hist: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 1,
    height: 32,
    flexShrink: 0,
  },
  histBtn: {
    width: 28,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  segmented: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    height: 32,
    gap: 2,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  modePill: {
    flex: 1,
    minHeight: 32,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  accountPanel: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 6,
    gap: 2,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '700',
  },
  accountRole: {
    fontSize: 11,
    fontWeight: '600',
  },
  accountDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
    marginHorizontal: 4,
  },
  accountMenuItem: {
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountMenuText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gear: {
    position: 'absolute',
    width: GEAR,
    height: GEAR,
    borderRadius: GEAR / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    zIndex: 22,
  },
  allowRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: ALLOW_GAP,
    zIndex: 22,
  },
  allowEntry: {
    minWidth: ALLOW_W,
    height: ALLOW_H,
    paddingHorizontal: 12,
    borderRadius: ALLOW_H / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  alarmRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: ALARM_GAP,
    zIndex: 22,
  },
  alarmBtn: {
    width: ALARM,
    height: ALARM,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  slide: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  slideFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.25,
  },
  slideLabel: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  slideThumb: {
    position: 'absolute',
    top: 4,
    width: SLIDE_THUMB,
    height: SLIDE_THUMB,
    borderRadius: SLIDE_THUMB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emCard: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
})
