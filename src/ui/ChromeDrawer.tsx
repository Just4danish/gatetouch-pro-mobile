import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
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
import {
  canManageResources,
  canUpdateSystemConfig,
  canViewSystemConfig,
  hasPermission,
} from '../auth/permissions'
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
import {
  IconEdit,
  IconEmergency,
  IconEye,
  IconEyeOff,
  IconFire,
  IconGear,
  IconHelp,
  IconLogout,
  IconMoon,
  IconRedo,
  IconSun,
  IconUndo,
  IconUser,
  IconUsers,
  IconWifi,
} from './Icons'
import { UsersListDialog } from './UsersListDialog'
import { makeUiStyles } from './uiStyles'
import { changeHotspot } from '../api/hotspot'
import { getSystemConfig, updateSystemConfig } from '../api/systemConfig'

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
  const canEditHotspot = canUpdateSystemConfig(role)
  const canEditSiteName = canUpdateSystemConfig(role)
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
  const setLaneOpen = useCorridor((s) => s.setLaneOpen)
  const showToast = useToast((s) => s.show)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const [usersOpen, setUsersOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [adminPwOpen, setAdminPwOpen] = useState(false)
  const [adminPwNew, setAdminPwNew] = useState('')
  const [adminPwConfirm, setAdminPwConfirm] = useState('')
  const [adminPwError, setAdminPwError] = useState<string | null>(null)
  const [adminPwSaving, setAdminPwSaving] = useState(false)
  const [adminConfigId, setAdminConfigId] = useState<number | null>(null)
  const [siteNameEditing, setSiteNameEditing] = useState(false)
  const [siteNameDraft, setSiteNameDraft] = useState('')
  const [siteNameSaving, setSiteNameSaving] = useState(false)
  const [hotspotOpen, setHotspotOpen] = useState(false)
  const [hotspotSsid, setHotspotSsid] = useState('')
  const [hotspotPassword, setHotspotPassword] = useState('')
  const [hotspotConfirm, setHotspotConfirm] = useState('')
  const [hotspotShowPassword, setHotspotShowPassword] = useState(false)
  const [hotspotShowConfirm, setHotspotShowConfirm] = useState(false)
  const [hotspotError, setHotspotError] = useState<string | null>(null)
  const [hotspotSaving, setHotspotSaving] = useState(false)
  const [hotspotLoading, setHotspotLoading] = useState(false)
  const hotspotLoadGen = useRef(0)
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
  // keep_open lanes stay open until Close; show Close instead of Allow while open.
  const keepOpenHeld = !!focusedOperateLane?.keepOpen && !!focusedOperateLane?.open
  const laneTriggerBusy = !!focusedOperateLane?.open && !keepOpenHeld
  const entryPin = normalizePin(focusedOperateLane?.entryPin)
  const exitPin = normalizePin(focusedOperateLane?.exitPin)
  // No pin metadata → keep legacy single Allow entry. Distinct pins → both buttons.
  const showAllowEntry =
    showAllowChrome &&
    canTriggerLane &&
    !keepOpenHeld &&
    (entryPin != null || (entryPin == null && exitPin == null))
  const showAllowExit =
    showAllowChrome &&
    canTriggerLane &&
    !keepOpenHeld &&
    hasDistinctExitPin(entryPin, exitPin)
  const showCloseLane = showAllowChrome && keepOpenHeld

  useEffect(() => {
    if (!canManage && mode === 'build') {
      setPanelCollapsed(true)
      setMode('operate')
    }
  }, [canManage, mode, setMode, setPanelCollapsed])

  // Gear heading: prefer backend site_name over the local "New installation" default.
  useEffect(() => {
    let alive = true
    void getSystemConfig()
      .then((config) => {
        if (!alive) return
        setAdminConfigId(config.id)
        const site = config.site_name != null ? String(config.site_name).trim() : ''
        if (site) setName(site)
      })
      .catch(() => {
        // Operators / offline: keep the local installation name.
      })
    return () => {
      alive = false
    }
  }, [role, setName])

  const beginSiteNameEdit = () => {
    tap()
    if (!canEditSiteName || siteNameSaving) return
    setSiteNameDraft(name?.trim() && name !== 'New installation' ? name.trim() : '')
    setSiteNameEditing(true)
  }

  const cancelSiteNameEdit = () => {
    setSiteNameEditing(false)
    setSiteNameDraft('')
  }

  const saveSiteName = () => {
    if (siteNameSaving) return
    const next = siteNameDraft.trim()
    if (!next) {
      buzz()
      showToast('Enter a site name.', 'error')
      return
    }
    if (adminConfigId == null) {
      buzz()
      showToast('System configuration is not ready yet.', 'error')
      return
    }

    setSiteNameSaving(true)
    void updateSystemConfig(adminConfigId, { site_name: next })
      .then((updated) => {
        whoosh()
        const saved =
          updated?.site_name != null && String(updated.site_name).trim()
            ? String(updated.site_name).trim()
            : next
        setName(saved)
        setSiteNameEditing(false)
        setSiteNameDraft('')
        showToast('Site name updated', 'success')
      })
      .catch((err) => {
        buzz()
        showToast(apiErrorMessage(err), 'error')
      })
      .finally(() => {
        setSiteNameSaving(false)
      })
  }

  const allowCount =
    (showAllowEntry ? 1 : 0) + (showAllowExit ? 1 : 0) + (showCloseLane ? 1 : 0)
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
    const chromeBeside = showAllowEntry || showAllowExit || showCloseLane || showAlarms
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

  // Landscape: keep the gear card within the viewport and scroll expanded account/hotspot forms.
  const sheetMaxHeight = landscape
    ? Math.max(140, layoutH - (sheetStyle.top ?? STAGE_CHROME_TOP) - 12)
    : undefined

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

  const onCloseKeepOpenLane = () => {
    if (!focusedOperateLane?.open || !focusedOperateLane.keepOpen) return
    whoosh()
    setLaneOpen(focusedOperateLane.id, false)
    setOpen(false)
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
    setAdminPwOpen(false)
    setHotspotOpen(false)
    setSiteNameEditing(false)
    setOpen(false)
  }
  const toggle = () => {
    tap()
    setOpen((v) => {
      if (v) {
        setAccountMenuOpen(false)
        setAdminPwOpen(false)
        setHotspotOpen(false)
        setSiteNameEditing(false)
      }
      return !v
    })
  }

  const resetHotspotForm = () => {
    hotspotLoadGen.current += 1
    setHotspotSsid('')
    setHotspotPassword('')
    setHotspotConfirm('')
    setHotspotShowPassword(false)
    setHotspotShowConfirm(false)
    setHotspotError(null)
    setHotspotLoading(false)
  }

  const toggleAdminPasswordEdit = () => {
    tap()
    if (adminPwSaving) return
    setHotspotOpen(false)
    setAdminPwOpen((open) => {
      const next = !open
      if (next) {
        setAdminPwNew('')
        setAdminPwConfirm('')
        setAdminPwError(null)
        if (adminConfigId == null) {
          void getSystemConfig()
            .then((config) => setAdminConfigId(config.id))
            .catch((err) => {
              buzz()
              setAdminPwError(apiErrorMessage(err))
            })
        }
      } else {
        setAdminPwNew('')
        setAdminPwConfirm('')
        setAdminPwError(null)
      }
      return next
    })
  }

  const saveAdminPassword = () => {
    if (adminPwSaving) return
    const next = adminPwNew.trim()
    if (!next) {
      setAdminPwError('Enter a new password.')
      buzz()
      return
    }
    if (next !== adminPwConfirm.trim()) {
      setAdminPwError('Passwords do not match.')
      buzz()
      return
    }
    if (adminConfigId == null) {
      setAdminPwError('System configuration is not ready yet.')
      buzz()
      return
    }

    setAdminPwSaving(true)
    setAdminPwError(null)
    void updateSystemConfig(adminConfigId, { admin_password: next })
      .then(() => {
        whoosh()
        setAdminPwOpen(false)
        setAdminPwNew('')
        setAdminPwConfirm('')
        setAdminPwError(null)
        showToast('Admin password updated', 'success')
      })
      .catch((err) => {
        buzz()
        const message = apiErrorMessage(err)
        showToast(message, 'error')
        setAdminPwError(message)
      })
      .finally(() => {
        setAdminPwSaving(false)
      })
  }

  const toggleHotspotEdit = () => {
    tap()
    if (hotspotSaving || hotspotLoading) return
    setAdminPwOpen(false)

    if (hotspotOpen) {
      setHotspotOpen(false)
      resetHotspotForm()
      return
    }

    const loadId = hotspotLoadGen.current + 1
    hotspotLoadGen.current = loadId
    setHotspotOpen(true)
    setHotspotShowPassword(false)
    setHotspotShowConfirm(false)
    setHotspotError(null)
    setHotspotLoading(true)
    setHotspotSsid('')
    setHotspotPassword('')
    setHotspotConfirm('')

    void getSystemConfig()
      .then((config) => {
        if (hotspotLoadGen.current !== loadId) return
        const ssid = config.wifi_ssid != null ? String(config.wifi_ssid).trim() : ''
        const password = config.wifi_password != null ? String(config.wifi_password) : ''
        setHotspotSsid(ssid)
        setHotspotPassword(password)
        setHotspotConfirm(password)
      })
      .catch((err) => {
        if (hotspotLoadGen.current !== loadId) return
        buzz()
        setHotspotError(apiErrorMessage(err))
      })
      .finally(() => {
        if (hotspotLoadGen.current === loadId) setHotspotLoading(false)
      })
  }

  const saveHotspot = () => {
    if (hotspotSaving) return
    const ssid = hotspotSsid.trim()
    const password = hotspotPassword
    if (!ssid) {
      setHotspotError('Enter an SSID.')
      buzz()
      return
    }
    if (!password) {
      setHotspotError('Enter a password.')
      buzz()
      return
    }
    if (password !== hotspotConfirm) {
      setHotspotError('Passwords do not match.')
      buzz()
      return
    }

    setHotspotSaving(true)
    setHotspotError(null)
    // visibility is always forced to "hidden" inside changeHotspot — never shown or editable here.
    void changeHotspot({ ssid, password })
      .then(() => {
        whoosh()
        setHotspotOpen(false)
        resetHotspotForm()
        showToast('Hotspot credentials updated', 'success')
      })
      .catch((err) => {
        buzz()
        const message = apiErrorMessage(err)
        showToast(message, 'error')
        setHotspotError(message)
      })
      .finally(() => {
        setHotspotSaving(false)
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
        <View
          style={[styles.sheetWrap, sheetStyle, sheetMaxHeight != null && { maxHeight: sheetMaxHeight }]}
          pointerEvents="box-none"
        >
          <Glass
            overlay={c.glass}
            style={[
              styles.sheet,
              { borderColor: c.hair },
              sheetMaxHeight != null && { maxHeight: sheetMaxHeight },
            ]}
          >
            <ScrollView
              scrollEnabled={landscape}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={landscape}
              style={sheetMaxHeight != null ? { maxHeight: sheetMaxHeight - 16 } : undefined}
              contentContainerStyle={styles.sheetScrollContent}
            >
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
                  {siteNameEditing ? (
                    <TextInput
                      value={siteNameDraft}
                      onChangeText={setSiteNameDraft}
                      style={[styles.nameInput, { color: c.text }]}
                      placeholder="Site name"
                      placeholderTextColor={c.text3}
                      autoCapitalize="words"
                      autoCorrect={false}
                      editable={!siteNameSaving}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={saveSiteName}
                      testID="app.site.name.input"
                      accessibilityLabel="Site name"
                    />
                  ) : (
                    <Text
                      style={[styles.nameInput, { color: c.text }]}
                      numberOfLines={1}
                      testID="app.installation.name"
                      accessibilityLabel="Site name"
                    >
                      {name?.trim() || 'Site'}
                    </Text>
                  )}
                  <Text style={[styles.unitMeta, { color: c.text3 }]} numberOfLines={1}>
                    {units.length} unit{units.length === 1 ? '' : 's'}
                  </Text>
                </View>
                {canEditSiteName ? (
                  siteNameEditing ? (
                    <Pressable
                      style={[
                        styles.adminEditBtn,
                        {
                          backgroundColor: c.accent,
                          borderColor: c.accent,
                          opacity: siteNameSaving ? 0.65 : 1,
                        },
                      ]}
                      testID="app.site.name.save"
                      accessibilityRole="button"
                      accessibilityLabel="Save site name"
                      disabled={siteNameSaving}
                      hitSlop={8}
                      onPress={() => {
                        tap()
                        saveSiteName()
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                        {siteNameSaving ? '…' : '✓'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[
                        styles.adminEditBtn,
                        { backgroundColor: c.chrome, borderColor: c.hair },
                      ]}
                      testID="app.site.name.edit"
                      accessibilityRole="button"
                      accessibilityLabel="Edit site name"
                      hitSlop={8}
                      onPress={beginSiteNameEdit}
                    >
                      <IconEdit color={c.accentFg} size={12} />
                    </Pressable>
                  )
                ) : null}
                {canEditSiteName && siteNameEditing ? (
                  <Pressable
                    style={[styles.adminEditBtn, { backgroundColor: c.chrome, borderColor: c.hair }]}
                    testID="app.site.name.cancel"
                    accessibilityRole="button"
                    accessibilityLabel="Cancel site name edit"
                    disabled={siteNameSaving}
                    hitSlop={8}
                    onPress={() => {
                      tap()
                      cancelSiteNameEdit()
                    }}
                  >
                    <Text style={{ color: c.text2, fontSize: 12, fontWeight: '700' }}>×</Text>
                  </Pressable>
                ) : null}
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
                  setAccountMenuOpen((v) => {
                    if (v) {
                      setAdminPwOpen(false)
                      setHotspotOpen(false)
                    }
                    return !v
                  })
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
                {canViewUsers ? (
                  <>
                    <Pressable
                      style={styles.accountHeader}
                      testID="app.account.admin"
                      accessibilityRole="button"
                      accessibilityLabel="Change admin password"
                      accessibilityState={{ expanded: adminPwOpen }}
                      onPress={toggleAdminPasswordEdit}
                    >
                      <View style={[styles.avatar, { backgroundColor: c.fill2, borderColor: c.hair }]}>
                        <IconUser color={c.accentFg} size={15} />
                      </View>
                      <View style={styles.accountCopy}>
                        <Text style={[styles.accountName, { color: c.text }]} numberOfLines={1}>
                          Admin
                        </Text>
                      </View>
                      <Pressable
                        style={[
                          styles.adminEditBtn,
                          {
                            backgroundColor: adminPwOpen ? c.accentTint : c.chrome,
                            borderColor: adminPwOpen ? c.accent : c.hair,
                          },
                        ]}
                        testID="app.account.admin.password.edit"
                        accessibilityRole="button"
                        accessibilityLabel="Edit admin password"
                        onPress={toggleAdminPasswordEdit}
                        hitSlop={8}
                      >
                        <IconEdit color={c.accentFg} size={12} />
                      </Pressable>
                    </Pressable>

                    {adminPwOpen ? (
                      <View style={[styles.adminPwExpand, { borderTopColor: c.hair }]}>
                        <TextInput
                          value={adminPwNew}
                          onChangeText={setAdminPwNew}
                          style={[
                            styles.adminPwInput,
                            {
                              color: c.text,
                              backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.92)',
                              borderColor: c.hair,
                            },
                          ]}
                          placeholder="New password"
                          placeholderTextColor={c.text3}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!adminPwSaving}
                          testID="app.account.admin.password.new"
                        />
                        <TextInput
                          value={adminPwConfirm}
                          onChangeText={setAdminPwConfirm}
                          style={[
                            styles.adminPwInput,
                            {
                              color: c.text,
                              backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.92)',
                              borderColor: c.hair,
                            },
                          ]}
                          placeholder="Confirm password"
                          placeholderTextColor={c.text3}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!adminPwSaving}
                          testID="app.account.admin.password.confirm"
                        />

                        {adminPwError ? (
                          <Text
                            style={[styles.adminPwError, { color: c.redFg }]}
                            testID="app.account.admin.password.error"
                          >
                            {adminPwError}
                          </Text>
                        ) : null}

                        <Pressable
                          style={[
                            styles.adminPwSave,
                            { backgroundColor: c.accent },
                            adminPwSaving && { opacity: 0.65 },
                          ]}
                          testID="app.account.admin.password.save"
                          disabled={adminPwSaving}
                          onPress={() => {
                            tap()
                            saveAdminPassword()
                          }}
                        >
                          <Text style={styles.adminPwSaveText}>
                            {adminPwSaving ? 'Saving…' : 'Save'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}

                    {canEditHotspot ? (
                      <>
                        <View style={[styles.accountDivider, { backgroundColor: c.hair }]} />
                        <Pressable
                          style={styles.accountMenuItem}
                          testID="app.account.hotspot"
                          accessibilityRole="button"
                          accessibilityLabel="Change hotspot credentials"
                          accessibilityState={{ expanded: hotspotOpen }}
                          onPress={toggleHotspotEdit}
                        >
                          <IconWifi color={c.text2} size={16} />
                          <Text style={[styles.accountMenuText, { color: c.text }]}>Hotspot</Text>
                          <View
                            style={[
                              styles.adminEditBtn,
                              {
                                marginLeft: 'auto',
                                backgroundColor: hotspotOpen ? c.accentTint : c.chrome,
                                borderColor: hotspotOpen ? c.accent : c.hair,
                              },
                            ]}
                            testID="app.account.hotspot.edit"
                          >
                            <IconEdit color={c.accentFg} size={12} />
                          </View>
                        </Pressable>

                        {hotspotOpen ? (
                          <View style={[styles.adminPwExpand, { borderTopColor: c.hair }]}>
                            <TextInput
                              value={hotspotSsid}
                              onChangeText={setHotspotSsid}
                              style={[
                                styles.adminPwInput,
                                {
                                  color: c.text,
                                  backgroundColor:
                                    theme === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.92)',
                                  borderColor: c.hair,
                                },
                              ]}
                              placeholder={hotspotLoading ? 'Loading SSID…' : 'SSID'}
                              placeholderTextColor={c.text3}
                              autoCapitalize="none"
                              autoCorrect={false}
                              editable={!hotspotSaving && !hotspotLoading}
                              testID="app.account.hotspot.ssid"
                            />
                            <View
                              style={[
                                styles.hotspotPwRow,
                                {
                                  backgroundColor:
                                    theme === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.92)',
                                  borderColor: c.hair,
                                },
                              ]}
                            >
                              <TextInput
                                value={hotspotPassword}
                                onChangeText={setHotspotPassword}
                                style={[styles.hotspotPwInput, { color: c.text }]}
                                placeholder={hotspotLoading ? 'Loading password…' : 'Password'}
                                placeholderTextColor={c.text3}
                                secureTextEntry={!hotspotShowPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!hotspotSaving && !hotspotLoading}
                                testID="app.account.hotspot.password"
                              />
                              <Pressable
                                style={styles.hotspotEyeBtn}
                                testID="app.account.hotspot.password.toggle"
                                accessibilityRole="button"
                                accessibilityLabel={
                                  hotspotShowPassword ? 'Hide hotspot password' : 'Show hotspot password'
                                }
                                hitSlop={8}
                                onPress={() => {
                                  tap()
                                  setHotspotShowPassword((v) => !v)
                                }}
                              >
                                {hotspotShowPassword ? (
                                  <IconEyeOff color={c.text2} size={16} />
                                ) : (
                                  <IconEye color={c.text2} size={16} />
                                )}
                              </Pressable>
                            </View>
                            <View
                              style={[
                                styles.hotspotPwRow,
                                {
                                  backgroundColor:
                                    theme === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.92)',
                                  borderColor: c.hair,
                                },
                              ]}
                            >
                              <TextInput
                                value={hotspotConfirm}
                                onChangeText={setHotspotConfirm}
                                style={[styles.hotspotPwInput, { color: c.text }]}
                                placeholder="Confirm password"
                                placeholderTextColor={c.text3}
                                secureTextEntry={!hotspotShowConfirm}
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!hotspotSaving && !hotspotLoading}
                                testID="app.account.hotspot.password.confirm"
                              />
                              <Pressable
                                style={styles.hotspotEyeBtn}
                                testID="app.account.hotspot.password.confirm.toggle"
                                accessibilityRole="button"
                                accessibilityLabel={
                                  hotspotShowConfirm ? 'Hide confirm password' : 'Show confirm password'
                                }
                                hitSlop={8}
                                onPress={() => {
                                  tap()
                                  setHotspotShowConfirm((v) => !v)
                                }}
                              >
                                {hotspotShowConfirm ? (
                                  <IconEyeOff color={c.text2} size={16} />
                                ) : (
                                  <IconEye color={c.text2} size={16} />
                                )}
                              </Pressable>
                            </View>

                            {hotspotError ? (
                              <Text
                                style={[styles.adminPwError, { color: c.redFg }]}
                                testID="app.account.hotspot.error"
                              >
                                {hotspotError}
                              </Text>
                            ) : null}

                            <Pressable
                              style={[
                                styles.adminPwSave,
                                { backgroundColor: c.accent },
                                (hotspotSaving || hotspotLoading) && { opacity: 0.65 },
                              ]}
                              testID="app.account.hotspot.save"
                              disabled={hotspotSaving || hotspotLoading}
                              onPress={() => {
                                tap()
                                saveHotspot()
                              }}
                            >
                              <Text style={styles.adminPwSaveText}>
                                {hotspotSaving ? 'Saving…' : hotspotLoading ? 'Loading…' : 'Save'}
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.accountHeader}>
                    <View style={[styles.avatar, { backgroundColor: c.fill2, borderColor: c.hair }]}>
                      <IconUser color={c.accentFg} size={18} />
                    </View>
                    <View style={styles.accountCopy}>
                      <Text style={[styles.accountName, { color: c.text }]} numberOfLines={1}>
                        {authUsername || 'Signed in'}
                      </Text>
                      <Text style={[styles.accountRole, { color: c.text3 }]} numberOfLines={1}>
                        {role === 'Operator1'
                          ? 'Operator 1'
                          : role === 'Operator2'
                            ? 'Operator 2'
                            : 'User'}
                      </Text>
                    </View>
                  </View>
                )}

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
            </ScrollView>
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

      {(showAllowEntry || showAllowExit || showCloseLane) && (
        <View style={[styles.allowRow, allowStyle]}>
          {showCloseLane && (
            <Pressable
              style={[
                styles.allowEntry,
                {
                  backgroundColor: triggerFill,
                  borderColor: c.red,
                  borderWidth: 2,
                },
              ]}
              testID="operate.closeLane"
              accessibilityRole="button"
              accessibilityLabel="Close lane"
              onPress={() => {
                tap()
                onCloseKeepOpenLane()
              }}
            >
              <Text
                style={{
                  color: c.redFg,
                  fontSize: 13,
                  fontWeight: '700',
                }}
                numberOfLines={1}
              >
                Close
              </Text>
            </Pressable>
          )}
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
  },
  sheetScrollContent: {
    gap: 6,
    paddingBottom: 2,
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
    padding: 4,
    gap: 1,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    fontSize: 13,
    fontWeight: '700',
  },
  accountRole: {
    fontSize: 10,
    fontWeight: '600',
  },
  accountDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
    marginHorizontal: 4,
  },
  accountMenuItem: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountMenuText: {
    fontSize: 13,
    fontWeight: '600',
  },
  adminEditBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  adminPwExpand: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 6,
  },
  adminPwInput: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 12,
    fontWeight: '600',
    includeFontPadding: false,
  },
  hotspotPwRow: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 4,
  },
  hotspotPwInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 32,
    paddingVertical: 0,
    paddingRight: 6,
    fontSize: 12,
    fontWeight: '600',
    includeFontPadding: false,
  },
  hotspotEyeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  adminPwError: {
    fontSize: 11,
    fontWeight: '600',
  },
  adminPwSave: {
    minHeight: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminPwSaveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
