import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { useState } from 'react'
import {
  ACCESSIBLE_MIN_MM,
  CATALOG,
  FINISHES,
  FINISH_ORDER,
  GLASSES,
  GLASS_ORDER,
  LED_DEFAULT,
  type FinishId,
  type GlassId,
  type LedConfig,
} from '../model/catalog'
import { formatClearCm } from '../model/installation'
import { modelOfUnitType } from '../model/products'
import {
  computeWorldLayout,
  laneGap,
  useCorridor,
  type Lane,
  type LaneDirection,
  type LaneMode,
  type PlacedUnit,
} from '../store/corridor'
import { ColorPalette } from './ColorPalette'
import { makeUiStyles } from './uiStyles'
import { colors } from '../theme/tokens'
import { useTheme } from '../store/theme'
import { useAuth } from '../store/auth'
import { hasPermission } from '../auth/permissions'
import { useToast } from '../store/toast'
import { apiErrorMessage } from '../api/client'
import { flipTurnstileOnServer, deleteTurnstileOnServer } from '../lib/flipTurnstile'
import { saveTurnstileAppearance } from '../lib/turnstileAppearance'
import { buzz, chime, tap } from '../lib/feedback'

const MODES: { id: LaneMode; label: string; hint: string }[] = [
  { id: 'badge', label: 'Badge', hint: 'normally closed, opens on request' },
  { id: 'free', label: 'Free pass', hint: 'stays open until closed' },
  { id: 'locked', label: 'Locked', hint: 'cannot be opened' },
  { id: 'noentry', label: 'No entry', hint: 'closed, red indication' },
]

const DIRS: { id: LaneDirection; label: string }[] = [
  { id: 'in', label: 'Entry' },
  { id: 'out', label: 'Exit' },
  { id: 'both', label: 'Bidirectional' },
]

function Stepper({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (v: number) => void
}) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  return (
    <View style={styles.stepRow}>
      <Text style={{ color: c.text2, width: 56, fontSize: 12 }}>{label}</Text>
      <Pressable
        style={[styles.stepBtn, { backgroundColor: c.fill2 }]}
        onPress={() => onChange(Math.max(min, value - step))}
      >
        <Text style={{ color: c.text }}>-</Text>
      </Pressable>
      <Text style={{ color: c.text, minWidth: 72, textAlign: 'center', fontWeight: '600' }}>
        {Math.round(value)}
        {suffix}
      </Text>
      <Pressable
        style={[styles.stepBtn, { backgroundColor: c.fill2 }]}
        onPress={() => onChange(Math.min(max, value + step))}
      >
        <Text style={{ color: c.text }}>+</Text>
      </Pressable>
    </View>
  )
}

function UnitBody({ unit, compact }: { unit: PlacedUnit; compact?: boolean }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const spec = CATALOG[unit.type]
  const product = modelOfUnitType(unit.type)
  const group = useCorridor((s) => s.laneGroups.find((g) => g.id === unit.groupId))
  const globalLed = useCorridor((s) => s.led)
  const globalFinish = useCorridor((s) => s.finish)
  const globalGlass = useCorridor((s) => s.glass)
  const duplicateMany = useCorridor((s) => s.duplicateMany)
  const showToast = useToast((s) => s.show)
  const role = useAuth((s) => s.role)
  const canUpdate = hasPermission(role, 'UPDATE_RESOURCES')
  const canDelete = hasPermission(role, 'DELETE_RESOURCES')
  const [flipping, setFlipping] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [savingAppearance, setSavingAppearance] = useState(false)

  const led = unit.led ?? globalLed ?? LED_DEFAULT
  const finish = unit.finish ?? globalFinish
  const glass = unit.glass ?? globalGlass

  const onFlip = async () => {
    if (flipping) return
    tap()
    setFlipping(true)
    try {
      await flipTurnstileOnServer(unit)
      chime()
      showToast('Turnstile flipped', 'success')
    } catch (err) {
      buzz()
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setFlipping(false)
    }
  }

  const onRemove = async () => {
    if (removing) return
    tap()
    setRemoving(true)
    try {
      await deleteTurnstileOnServer(unit)
      chime()
      showToast('Turnstile removed', 'success')
    } catch (err) {
      buzz()
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setRemoving(false)
    }
  }

  const onAppearance = async (patch: {
    finish?: FinishId | null
    glass?: GlassId | null
    led?: LedConfig | null
  }) => {
    if (!canUpdate || savingAppearance) return
    tap()
    setSavingAppearance(true)
    try {
      await saveTurnstileAppearance(unit, patch)
      chime()
    } catch (err) {
      buzz()
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setSavingAppearance(false)
    }
  }

  return (
    <>
      <Text style={{ color: c.text3, fontSize: compact ? 10 : 12, fontWeight: '700', letterSpacing: 0.8 }}>
        {product.manufacturerId.toUpperCase()}
      </Text>
      <Text style={{ color: c.text, fontSize: compact ? 15 : 18, fontWeight: '800' }}>{product.name}</Text>
      <Text style={{ color: c.text3, marginBottom: compact ? 4 : 8, fontSize: compact ? 11 : 13 }}>
        {product.modelCode} · {product.widthMm} × {product.lengthMm} × {product.heightMm} mm
        {unit.flipped ? ' · flipped' : ''}
        {group ? ` · ${group.name}` : ''}
      </Text>
      {!compact && (
        <>
          <Text style={u.label}>Product</Text>
          <Text style={{ color: c.text2, marginBottom: 8 }}>{spec.label}</Text>
        </>
      )}
      <Text style={[u.label, compact && { marginTop: 4, marginBottom: 4 }]}>Placement</Text>
      <View style={u.wrap}>
        {canUpdate ? (
          <Pressable
            style={[
              u.btn,
              compact && styles.compactBtn,
              (unit.flipped || flipping) && {
                backgroundColor: c.accent,
                borderColor: c.accent,
              },
              flipping && { opacity: 0.7 },
            ]}
            testID="build.unit.flip"
            disabled={flipping}
            onPress={() => {
              void onFlip()
            }}
          >
            <Text
              style={[
                u.btnText,
                compact && styles.compactBtnText,
                (unit.flipped || flipping) && { color: c.onAccent },
              ]}
            >
              {flipping ? 'Flipping…' : 'Flip'}
            </Text>
          </Pressable>
        ) : null}
        {/* Temporarily hidden — not backed by server yet
        <Pressable
          style={[u.btn, compact && styles.compactBtn]}
          onPress={() => {
            tap()
            duplicateMany([unit.id])
          }}
        >
          <Text style={[u.btnText, compact && styles.compactBtnText]}>Duplicate</Text>
        </Pressable>
        <Pressable
          style={[u.btn, compact && styles.compactBtn]}
          onPress={() => {
            tap()
            useCorridor.getState().setMultiSelectMode(true)
            useCorridor.getState().toggleMulti(unit.id)
            useCorridor.getState().select(null)
          }}
        >
          <Text style={[u.btnText, compact && styles.compactBtnText]}>Multi</Text>
        </Pressable>
        */}
        {canDelete ? (
          <Pressable
            style={[u.dangerBtn, compact && styles.compactBtn, removing && { opacity: 0.7 }]}
            disabled={removing}
            onPress={() => {
              void onRemove()
            }}
          >
            <Text style={[u.dangerText, compact && styles.compactBtnText]}>
              {removing ? 'Removing…' : 'Remove'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[u.label, compact && { marginTop: 6, marginBottom: 4 }]}>Cabinet finish</Text>
      <View style={[u.wrap, savingAppearance && { opacity: 0.7 }]}>
        {FINISH_ORDER.map((f) => (
          <Pressable
            key={f}
            style={[u.chip, compact && styles.compactChip, finish === f && u.chipOn]}
            disabled={!canUpdate || savingAppearance}
            onPress={() => {
              void onAppearance({ finish: f })
            }}
          >
            <View style={[styles.dot, { backgroundColor: FINISHES[f].color }]} />
            <Text style={[u.chipText, compact && styles.compactBtnText]}>{FINISHES[f].label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[u.label, compact && { marginTop: 6, marginBottom: 4 }]}>Glass</Text>
      <View style={[u.wrap, savingAppearance && { opacity: 0.7 }]}>
        {GLASS_ORDER.map((g) => (
          <Pressable
            key={g}
            style={[u.chip, compact && styles.compactChip, glass === g && u.chipOn]}
            disabled={!canUpdate || savingAppearance}
            onPress={() => {
              void onAppearance({ glass: g })
            }}
          >
            <View style={[styles.dot, { backgroundColor: GLASSES[g].color }]} />
            <Text style={[u.chipText, compact && styles.compactBtnText]}>{GLASSES[g].label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[u.label, compact && { marginTop: 6, marginBottom: 4 }]}>LED</Text>
      <ColorPalette
        value={led}
        onChange={(l) => {
          if (!canUpdate) return
          void onAppearance({ led: l })
        }}
        onClear={
          canUpdate && unit.led
            ? () => {
                void onAppearance({ led: null })
              }
            : undefined
        }
      />
    </>
  )
}

function LaneBody({ lane }: { lane: Lane }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const units = useCorridor((s) => s.units)
  const gaps = useCorridor((s) => s.gaps)
  const globalLed = useCorridor((s) => s.led)
  const renameLane = useCorridor((s) => s.renameLane)
  const setLaneWidth = useCorridor((s) => s.setLaneWidth)
  const setLaneMode = useCorridor((s) => s.setLaneMode)
  const setLaneDirection = useCorridor((s) => s.setLaneDirection)
  const setLaneAccessible = useCorridor((s) => s.setLaneAccessible)
  const setLaneHold = useCorridor((s) => s.setLaneHold)
  const setLaneLed = useCorridor((s) => s.setLaneLed)
  const splitLane = useCorridor((s) => s.splitLane)
  const flyTo = useCorridor((s) => s.flyTo)
  const role = useAuth((s) => s.role)
  const canUpdate = hasPermission(role, 'UPDATE_RESOURCES')

  const g = laneGap(lane, units, gaps)
  const led = lane.led ?? globalLed ?? LED_DEFAULT
  const tooNarrow = lane.accessible && g != null && g.value < ACCESSIBLE_MIN_MM

  const focus = () => {
    const layout = computeWorldLayout(units, gaps, useCorridor.getState().laneGroups)
    const xs = lane.members.map((m) => layout.x[m.unitId]).filter((v) => v != null)
    const zs = lane.members.map((m) => layout.z[m.unitId]).filter((v) => v != null)
    const cx = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : layout.centerX
    const cz = zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : layout.centerZ
    flyTo([cx + 0.5, 1.35, cz + 2.3], [cx, 0.55, cz])
  }

  return (
    <>
      <View style={u.row}>
        <TextInput
          value={lane.name}
          onChangeText={(t) => renameLane(lane.id, t)}
          style={[styles.nameInput, { color: c.text, borderColor: c.hair, backgroundColor: c.surface }]}
          editable={canUpdate}
        />
        <View style={[styles.dotLg, { backgroundColor: lane.color }]} />
      </View>
      <Text style={{ color: c.text3, marginBottom: 8 }}>
        {lane.members.length} wing{lane.members.length > 1 ? 's' : ''}
        {g ? ` · clear width ${formatClearCm(g.value)}` : ' · faces open space'}
      </Text>
      <Text style={u.label}>Associated units</Text>
      <Text style={{ color: c.text2, marginBottom: 8 }}>
        {lane.members
          .map((m) => {
            const u = units.find((x) => x.id === m.unitId)
            return u ? CATALOG[u.type].short : m.unitId
          })
          .join('  ·  ') || '—'}
      </Text>

      <View style={u.wrap}>
        <Pressable
          style={u.btn}
          onPress={() => {
            tap()
            focus()
          }}
        >
          <Text style={u.btnText}>Focus</Text>
        </Pressable>
        {lane.members.length > 1 && (
          <Pressable
            style={u.btn}
            onPress={() => {
              tap()
              splitLane(lane.id)
            }}
          >
            <Text style={u.btnText}>Ungroup</Text>
          </Pressable>
        )}
        <Pressable
          style={[u.btn, lane.accessible && u.primaryBtn]}
          onPress={() => {
            tap()
            setLaneAccessible(lane.id, !lane.accessible)
          }}
        >
          <Text style={lane.accessible ? u.primaryText : u.btnText}>Accessible</Text>
        </Pressable>
      </View>

      <Text style={u.label}>Clear Width</Text>
      {g ? (
        <>
          <Stepper
            label="Clear"
            value={g.value / 10}
            min={g.min / 10}
            max={g.max / 10}
            step={1}
            suffix=" cm"
            onChange={(v) => setLaneWidth(lane.id, v * 10)}
          />
          <Text style={u.hint}>
            Range {formatClearCm(g.min)} – {formatClearCm(g.max)}
          </Text>
          {tooNarrow && (
            <Text style={{ color: c.orangeFg, fontSize: 12, marginTop: 4 }}>
              Below the {ACCESSIBLE_MIN_MM} mm accessible minimum.
            </Text>
          )}
        </>
      ) : (
        <Text style={u.hint}>This lane has no facing cabinet.</Text>
      )}

      <Text style={u.label}>Mode</Text>
      <View style={u.wrap}>
        {MODES.map((m) => (
          <Pressable
            key={m.id}
            style={[u.chip, lane.mode === m.id && u.chipOn]}
            onPress={() => {
              if (m.id === 'locked' || m.id === 'noentry') buzz()
              else tap()
              setLaneMode(lane.id, m.id)
            }}
          >
            <Text style={u.chipText}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={u.hint}>{MODES.find((m) => m.id === lane.mode)?.hint}</Text>

      <Text style={u.label}>Direction</Text>
      <View style={u.wrap}>
        {DIRS.map((d) => (
          <Pressable
            key={d.id}
            style={[u.chip, lane.direction === d.id && u.chipOn]}
            onPress={() => {
              tap()
              setLaneDirection(lane.id, d.id)
            }}
          >
            <Text style={u.chipText}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={u.label}>Auto-close after</Text>
      <Stepper
        label="Hold"
        value={lane.holdSec}
        min={1}
        max={20}
        step={1}
        suffix="s"
        onChange={(v) => setLaneHold(lane.id, v)}
      />

      <Text style={u.label}>LED for this lane</Text>
      <ColorPalette
        value={led}
        onChange={(l) => setLaneLed(lane.id, l)}
        onClear={lane.led ? () => setLaneLed(lane.id, null) : undefined}
      />
    </>
  )
}

function GroupBody({ groupId }: { groupId: string }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const group = useCorridor((s) => s.laneGroups.find((g) => g.id === groupId))
  const units = useCorridor((s) => s.units)
  const lanes = useCorridor((s) => s.lanes)
  const renameLaneGroup = useCorridor((s) => s.renameLaneGroup)
  const setGroupDefaultClear = useCorridor((s) => s.setGroupDefaultClear)
  const rotateLaneGroup = useCorridor((s) => s.rotateLaneGroup)
  const duplicateLaneGroup = useCorridor((s) => s.duplicateLaneGroup)
  const deleteLaneGroup = useCorridor((s) => s.deleteLaneGroup)
  const fitSelection = useCorridor((s) => s.fitSelection)
  const role = useAuth((s) => s.role)
  const canUpdate = hasPermission(role, 'UPDATE_RESOURCES')
  const canCreate = hasPermission(role, 'CREATE_RESOURCES')
  const canDelete = hasPermission(role, 'DELETE_RESOURCES')
  if (!group) return null
  const nUnits = units.filter((x) => x.groupId === group.id).length
  const nLanes = lanes.filter((l) => l.groupId === group.id).length

  return (
    <>
      <TextInput
        value={group.name}
        onChangeText={(t) => renameLaneGroup(group.id, t)}
        style={[styles.nameInput, { color: c.text, borderColor: c.hair, backgroundColor: c.surface }]}
        editable={canUpdate}
      />
      <Text style={{ color: c.text3, marginBottom: 8 }}>
        {nUnits} Turnstile Units · {nLanes} Lanes · default {formatClearCm(group.defaultClearMm)}
      </Text>
      <View style={u.wrap}>
        <Pressable style={u.btn} onPress={() => fitSelection()}>
          <Text style={u.btnText}>Fit</Text>
        </Pressable>
        {canUpdate ? (
          <Pressable style={u.btn} onPress={() => rotateLaneGroup(group.id, Math.PI / 2)}>
            <Text style={u.btnText}>Rotate</Text>
          </Pressable>
        ) : null}
        {canCreate ? (
          <Pressable style={u.btn} onPress={() => duplicateLaneGroup(group.id)}>
            <Text style={u.btnText}>Duplicate</Text>
          </Pressable>
        ) : null}
        {canDelete ? (
          <Pressable style={u.dangerBtn} onPress={() => deleteLaneGroup(group.id)}>
            <Text style={u.dangerText}>Delete</Text>
          </Pressable>
        ) : null}
      </View>
      {canUpdate ? (
        <>
          <Text style={u.label}>Default lane width</Text>
          <View style={u.wrap}>
            {[600, 900, 1000].map((mm) => (
              <Pressable
                key={mm}
                style={[u.chip, group.defaultClearMm === mm && u.chipOn]}
                onPress={() => setGroupDefaultClear(group.id, mm)}
              >
                <Text style={u.chipText}>{formatClearCm(mm)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </>
  )
}

export function InspectorDock({ compact }: { compact?: boolean }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const sel = useCorridor((s) => s.sel)
  const multi = useCorridor((s) => s.multi)
  const units = useCorridor((s) => s.units)
  const lanes = useCorridor((s) => s.lanes)
  const select = useCorridor((s) => s.select)

  const unit = sel?.kind === 'unit' ? units.find((x) => x.id === sel.id) : undefined
  const lane = sel?.kind === 'lane' ? lanes.find((x) => x.id === sel.id) : undefined
  const groupSel = sel?.kind === 'group' ? sel.id : undefined
  if ((!unit && !lane && !groupSel) || multi.length === 2) return null

  return (
    <View style={styles.dockRoot}>
      <View style={[styles.dockBar, { borderBottomColor: c.hair }]}>
        <Text style={{ color: c.text, fontSize: compact ? 14 : 16, fontWeight: '800', flex: 1 }} numberOfLines={1}>
          {unit ? 'Unit' : lane ? 'Lane' : 'Group'}
        </Text>
        <Pressable
          onPress={() => {
            tap()
            select(null)
          }}
          style={styles.dockClose}
          hitSlop={8}
          testID="inspector.close"
          accessibilityLabel="Close properties"
        >
          <Text style={{ color: c.accentFg, fontSize: 13, fontWeight: '700' }}>Done</Text>
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: compact ? 12 : 16,
          paddingTop: compact ? 10 : 14,
          paddingBottom: 28,
          gap: compact ? 4 : 6,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {unit && <UnitBody unit={unit} compact={compact} />}
        {lane && <LaneBody lane={lane} />}
        {groupSel && <GroupBody groupId={groupSel} />}
      </ScrollView>
    </View>
  )
}

export function Inspector({ sheetOnly }: { sheetOnly?: boolean }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const sel = useCorridor((s) => s.sel)
  const multi = useCorridor((s) => s.multi)
  const units = useCorridor((s) => s.units)
  const lanes = useCorridor((s) => s.lanes)
  const select = useCorridor((s) => s.select)
  const { width, height } = useWindowDimensions()
  const landscape = width > height

  const unit = sel?.kind === 'unit' ? units.find((x) => x.id === sel.id) : undefined
  const lane = sel?.kind === 'lane' ? lanes.find((x) => x.id === sel.id) : undefined
  const groupSel = sel?.kind === 'group' ? sel.id : undefined
  const open = Boolean((unit || lane || groupSel) && multi.length !== 2)
  // Landscape uses the side card; bottom sheet is portrait-only (or when sheetOnly).
  if (landscape && !sheetOnly) return null

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={() => select(null)}>
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={() => select(null)}
          accessibilityLabel="Dismiss properties"
        />
        <View style={[styles.sheet, { backgroundColor: c.inspBg }]}>
          <View style={styles.grabRow}>
            <View style={styles.headerSide} />
            <View style={[styles.grab, { backgroundColor: c.raise }]} />
            <Pressable
              onPress={() => {
                tap()
                select(null)
              }}
              style={styles.close}
              hitSlop={8}
              testID="inspector.close"
              accessibilityLabel="Close properties"
            >
              <Text style={{ color: c.text2, fontSize: 22, fontWeight: '600' }}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 6, paddingBottom: 40 }}>
            {unit && <UnitBody unit={unit} />}
            {lane && <LaneBody lane={lane} />}
            {groupSel && <GroupBody groupId={groupSel} />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 1,
  },
  grabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 8,
  },
  headerSide: { width: 44, height: 44 },
  grab: { width: 40, height: 5, borderRadius: 3 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    fontSize: 16,
    fontWeight: '700',
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockRoot: { flex: 1, minHeight: 0 },
  dockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
  },
  dockClose: {
    minHeight: 36,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBtn: {
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  compactChip: {
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  compactBtnText: { fontSize: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotLg: { width: 16, height: 16, borderRadius: 8 },
})
