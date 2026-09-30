import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { lanesOfUnit, useCorridor } from '../store/corridor'
import { useAuth } from '../store/auth'
import { hasPermission } from '../auth/permissions'
import { colors } from '../theme/tokens'
import { useTheme } from '../store/theme'
import { makeUiStyles } from './uiStyles'
import { buzz, tap, thud, whoosh } from '../lib/feedback'
import { CATALOG } from '../model/catalog'
import { IconChevron } from './Icons'

const MODE_LABEL: Record<string, string> = {
  badge: 'Badge',
  free: 'Free pass',
  locked: 'Locked',
  noentry: 'No entry',
}

export function useLaneTicker(): number {
  const tick = useCorridor((s) => s.tick)
  const pulsing = useCorridor((s) => s.lanes.some((l) => l.openedAt != null))
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!pulsing) return
    const h = setInterval(() => {
      tick()
      setNow(Date.now())
    }, 120)
    return () => clearInterval(h)
  }, [pulsing, tick])

  return now
}

function CountdownRing({
  frac,
  seconds,
  green,
  raise,
  card,
}: {
  frac: number
  seconds: number
  green: string
  raise: string
  card: string
}) {
  const r = 11
  const c = 2 * Math.PI * r
  return (
    <View style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={30} height={30} style={StyleSheet.absoluteFill}>
        <Circle cx="15" cy="15" r={r} stroke={raise} strokeWidth={4} fill={card} />
        <Circle
          cx="15"
          cy="15"
          r={r}
          stroke={green}
          strokeWidth={4}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, frac)))}
          rotation={-90}
          origin="15,15"
        />
      </Svg>
      <Text style={{ fontSize: 11, fontWeight: '700', color: green }}>{seconds}</Text>
    </View>
  )
}

export function OperatePanel() {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const lanes = useCorridor((s) => s.lanes)
  const units = useCorridor((s) => s.units)
  const activeGroupId = useCorridor((s) => s.activeGroupId)
  const laneGroups = useCorridor((s) => s.laneGroups)
  const requestLane = useCorridor((s) => s.requestLane)
  const openAll = useCorridor((s) => s.openAll)
  const closeAll = useCorridor((s) => s.closeAll)
  const select = useCorridor((s) => s.select)
  const setMode = useCorridor((s) => s.setMode)
  const selectLaneGroup = useCorridor((s) => s.selectLaneGroup)
  const fitSelection = useCorridor((s) => s.fitSelection)
  const clearOperateFocus = useCorridor((s) => s.clearOperateFocus)
  const operateActiveUnitId = useCorridor((s) => s.operateActiveUnitId)
  const operateLaneId = useCorridor((s) => s.operateLaneId)
  const setOperateLaneFocus = useCorridor((s) => s.setOperateLaneFocus)
  const setLaneMode = useCorridor((s) => s.setLaneMode)
  const setLaneDirection = useCorridor((s) => s.setLaneDirection)
  const role = useAuth((s) => s.role)
  const canTriggerLane = hasPermission(role, 'TRIGGER_LANE')
  const canCloseLane = hasPermission(role, 'CLOSE_LANE')
  const canManageBuild = hasPermission(role, 'CREATE_RESOURCES')
  const now = useLaneTicker()
  const [pickingGroup, setPickingGroup] = useState(false)
  const pickerBooted = useRef(false)

  const activeGroup = laneGroups.find((g) => g.id === activeGroupId)
  const groupLanes = activeGroupId ? lanes.filter((l) => l.groupId === activeGroupId) : []
  const focusUnit = operateActiveUnitId ? units.find((x) => x.id === operateActiveUnitId) : undefined
  const focusedLanes = operateActiveUnitId ? lanesOfUnit(groupLanes, operateActiveUnitId) : []
  const shownLanes = focusUnit ? focusedLanes : groupLanes

  useEffect(() => {
    if (!activeGroupId) setPickingGroup(true)
  }, [activeGroupId])

  // Operators: open on the lane-group list so they can choose what to operate.
  useEffect(() => {
    if (pickerBooted.current) return
    if (role == null) return
    pickerBooted.current = true
    if (!canManageBuild) setPickingGroup(true)
  }, [role, canManageBuild])

  const openOperateGroup = (id: string) => {
    tap()
    selectLaneGroup(id)
    clearOperateFocus()
    select(null)
    fitSelection()
    setMode('operate')
    setPickingGroup(false)
  }

  const openGroupPicker = () => {
    tap()
    setPickingGroup(true)
  }

  if (pickingGroup || !activeGroupId) {
    return (
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={[u.panel, { gap: 12, paddingTop: 18 }]}
        showsVerticalScrollIndicator
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>Lane groups</Text>
        <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18 }}>
          {canManageBuild
            ? 'Select a group to operate, or switch to Build to create and edit groups.'
            : 'Select a group to open it in Operate. Editing is Admin-only.'}
        </Text>

        {laneGroups.length === 0 ? (
          <Text style={[u.empty, { borderStyle: 'dashed' }]}>
            {canManageBuild
              ? 'No lane groups yet. Switch to Build to create one.'
              : 'No lane groups available yet. Ask an Admin to create one.'}
          </Text>
        ) : (
          <View style={styles.groupList}>
            {laneGroups.map((g) => {
              const nUnits = units.filter((u) => u.groupId === g.id).length
              const nLanes = lanes.filter((l) => l.groupId === g.id).length
              const selected = g.id === activeGroupId
              return (
                <Pressable
                  key={g.id}
                  style={[
                    styles.groupCard,
                    {
                      backgroundColor: selected ? c.accentTint : c.glass2,
                      borderColor: selected ? c.accent : c.hair,
                    },
                  ]}
                  testID={`operate.group.${g.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Operate ${g.name}`}
                  accessibilityState={{ selected }}
                  onPress={() => openOperateGroup(g.id)}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={{ color: c.text3, fontSize: 12, marginTop: 2 }}>
                      {nUnits} unit{nUnits === 1 ? '' : 's'} · {nLanes} lane{nLanes === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <IconChevron color={selected ? c.accentFg : c.text3} />
                </Pressable>
              )
            })}
          </View>
        )}

        {canManageBuild ? (
          <Pressable
            style={u.primaryBtn}
            testID="operate.empty.build"
            accessibilityLabel="Switch to Build"
            onPress={() => {
              tap()
              setPickingGroup(false)
              setMode('build')
            }}
          >
            <Text style={u.primaryText}>Switch to Build</Text>
          </Pressable>
        ) : null}

        {activeGroupId ? (
          <Pressable
            style={u.ghostBtn}
            testID="operate.groups.cancel"
            accessibilityLabel="Cancel group change"
            onPress={() => {
              tap()
              setPickingGroup(false)
            }}
          >
            <Text style={u.ghostText}>Cancel</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    )
  }

  if (!groupLanes.length) {
    return (
      <View style={[u.panel, { gap: 12 }]}>
        <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
          No lanes yet
        </Text>
        <Text style={[u.empty, { borderStyle: 'dashed' }]}>
          {canManageBuild
            ? 'Switch to Build, create a lane group, then place turnstile equipment. Lanes are created automatically.'
            : 'No lanes are available for this group yet. Choose another group or ask an Admin.'}
        </Text>
        <Pressable
          style={u.ghostBtn}
          testID="operate.groups.change"
          accessibilityLabel="Change lane group"
          onPress={openGroupPicker}
        >
          <Text style={u.ghostText}>Change group</Text>
        </Pressable>
        {canManageBuild ? (
          <Pressable
            style={u.primaryBtn}
            testID="operate.empty.build"
            accessibilityLabel="Switch to Build"
            onPress={() => {
              tap()
              setMode('build')
            }}
          >
            <Text style={u.primaryText}>Switch to Build</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={[u.panel, { gap: 16, paddingTop: 22 }]}
      showsVerticalScrollIndicator
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <View style={u.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: c.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
            LANE GROUP
          </Text>
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
            {activeGroup?.name ?? 'Selected group'}
          </Text>
        </View>
        <Pressable
          style={u.ghostBtn}
          testID="operate.groups.change"
          accessibilityLabel="Change lane group"
          onPress={openGroupPicker}
        >
          <Text style={u.ghostText}>Change</Text>
        </Pressable>
      </View>

      {focusUnit ? (
        <View style={{ gap: 8 }}>
          <View style={u.row}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: c.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
                SELECTED UNIT
              </Text>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
                {CATALOG[focusUnit.type]?.short ?? 'Turnstile'}
              </Text>
              <Text style={{ color: c.text2, fontSize: 12 }}>
                {focusedLanes.length
                  ? `${focusedLanes.length} lane${focusedLanes.length === 1 ? '' : 's'} · entry allowed`
                  : 'No lanes on this unit'}
              </Text>
            </View>
            <Pressable
              style={u.ghostBtn}
              testID="operate.focus.clear"
              accessibilityLabel="Show all lanes"
              onPress={() => {
                tap()
                clearOperateFocus()
              }}
            >
              <Text style={u.ghostText}>All lanes</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={u.row}>
          <Text style={[u.sectionTitle, { flex: 1 }]}>Lanes</Text>
          {canCloseLane ? (
            <Pressable
              style={u.ghostBtn}
              testID="operate.lanes.closeAll"
              accessibilityLabel="Close all lanes"
              onPress={() => {
                thud()
                closeAll()
              }}
            >
              <Text style={u.ghostText}>Close all</Text>
            </Pressable>
          ) : null}
          {canTriggerLane ? (
            <Pressable
              style={u.ghostBtn}
              testID="operate.lanes.openAll"
              accessibilityLabel="Open all lanes"
              onPress={() => {
                whoosh()
                openAll()
              }}
            >
              <Text style={u.ghostText}>Open all</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.grid}>
        {shownLanes.map((l) => {
          const blocked = l.mode === 'locked' || l.mode === 'noentry'
          const remain =
            l.openedAt != null ? Math.max(0, l.holdSec * 1000 - (now - l.openedAt)) : null
          const frac = remain != null ? remain / (l.holdSec * 1000) : 0
          const selected = operateLaneId === l.id
          return (
            <Pressable
              key={l.id}
              style={[
                styles.opLane,
                {
                  borderColor: selected
                    ? c.accent
                    : blocked
                      ? c.tintOrangeBd
                      : l.open
                        ? c.green
                        : c.tintRedBd,
                  backgroundColor: blocked
                    ? c.tintOrangeBg
                    : l.open
                      ? 'rgba(48, 209, 88, 0.15)'
                      : c.tintRedBg,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
              testID={`operate.lane.${l.id}`}
              accessibilityLabel={l.name}
              accessibilityState={{ selected }}
              onPress={() => {
                setOperateLaneFocus(l.id)
                if (!canTriggerLane) {
                  buzz()
                  return
                }
                if (blocked) buzz()
                else if (l.open) thud()
                else whoosh()
                requestLane(l.id)
              }}
              onLongPress={() => select({ kind: 'lane', id: l.id })}
            >
              <View style={[styles.laneDot, { backgroundColor: l.color }]} />
              <View style={u.row}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 19, flex: 1 }}>
                  {l.name}
                  {l.accessible ? <Text style={{ color: c.accentFg }}> ♿</Text> : ''}
                </Text>
                {remain != null && (
                  <CountdownRing
                    frac={frac}
                    seconds={Math.ceil(remain / 1000)}
                    green={c.green}
                    raise={c.raise}
                    card={c.card}
                  />
                )}
              </View>
              <Text
                style={{
                  color: blocked ? c.orangeFg : l.open ? c.greenFg : c.redFg,
                  fontWeight: '700',
                  fontSize: 15,
                  letterSpacing: 0.8,
                }}
              >
                {blocked ? MODE_LABEL[l.mode].toUpperCase() : l.open ? 'OPEN' : 'CLOSED'}
              </Text>
              <Text style={{ color: c.text2, fontSize: 12, marginTop: 4 }}>
                {MODE_LABEL[l.mode]} ·{' '}
                {l.direction === 'both' ? '↔ bidirectional' : l.direction === 'in' ? 'Entry →' : '← Exit'}
              </Text>

              {focusUnit && (
                <View style={{ marginTop: 10, gap: 8 }}>
                  <Text style={{ color: c.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
                    MODE
                  </Text>
                  <View style={styles.chipRow}>
                    {(['badge', 'free', 'locked', 'noentry'] as const).map((m) => (
                      <Pressable
                        key={m}
                        style={[
                          styles.miniChip,
                          l.mode === m && { backgroundColor: c.accentTint, borderColor: c.accent },
                        ]}
                        onPress={() => {
                          if (m === 'locked' || m === 'noentry') buzz()
                          else tap()
                          setLaneMode(l.id, m)
                        }}
                      >
                        <Text style={{ color: c.text, fontSize: 11, fontWeight: '600' }}>{MODE_LABEL[m]}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={{ color: c.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
                    DIRECTION
                  </Text>
                  <View style={styles.chipRow}>
                    {(
                      [
                        ['in', 'Entry'],
                        ['out', 'Exit'],
                        ['both', 'Both'],
                      ] as const
                    ).map(([d, label]) => (
                      <Pressable
                        key={d}
                        style={[
                          styles.miniChip,
                          l.direction === d && { backgroundColor: c.accentTint, borderColor: c.accent },
                        ]}
                        onPress={() => {
                          tap()
                          setLaneDirection(l.id, d)
                        }}
                      >
                        <Text style={{ color: c.text, fontSize: 11, fontWeight: '600' }}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  groupList: {
    gap: 8,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  opLane: {
    width: '48%',
    minWidth: 160,
    flexGrow: 1,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 108,
    gap: 5,
  },
  laneDot: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(127,127,127,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
