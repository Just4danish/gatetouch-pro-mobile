import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  ACCESSIBLE_MIN_MM,
  CATALOG,
  FINISHES,
  FINISH_ORDER,
  GLASSES,
  GLASS_ORDER,
  LED_DEFAULT,
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
import { buzz, tap } from '../lib/feedback'

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

function UnitBody({ unit }: { unit: PlacedUnit }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const spec = CATALOG[unit.type]
  const product = modelOfUnitType(unit.type)
  const group = useCorridor((s) => s.laneGroups.find((g) => g.id === unit.groupId))
  const globalLed = useCorridor((s) => s.led)
  const globalFinish = useCorridor((s) => s.finish)
  const globalGlass = useCorridor((s) => s.glass)
  const flipUnit = useCorridor((s) => s.flipUnit)
  const duplicateMany = useCorridor((s) => s.duplicateMany)
  const removeUnit = useCorridor((s) => s.removeUnit)
  const setUnitLed = useCorridor((s) => s.setUnitLed)
  const setUnitFinish = useCorridor((s) => s.setUnitFinish)
  const setUnitGlass = useCorridor((s) => s.setUnitGlass)

  const led = unit.led ?? globalLed ?? LED_DEFAULT
  const finish = unit.finish ?? globalFinish
  const glass = unit.glass ?? globalGlass

  return (
    <>
      <Text style={{ color: c.text3, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>
        {product.manufacturerId.toUpperCase()}
      </Text>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{product.name}</Text>
      <Text style={{ color: c.text3, marginBottom: 8 }}>
        {product.modelCode} · {product.widthMm} × {product.lengthMm} × {product.heightMm} mm
        {unit.flipped ? ' · flipped' : ''}
        {group ? ` · ${group.name}` : ''}
      </Text>
      <Text style={u.label}>Product</Text>
      <Text style={{ color: c.text2, marginBottom: 8 }}>{spec.label}</Text>
      <Text style={u.label}>Placement</Text>
      <View style={u.wrap}>
        <Pressable
          style={u.btn}
          onPress={() => {
            tap()
            flipUnit(unit.id)
          }}
        >
          <Text style={u.btnText}>Flip</Text>
        </Pressable>
        <Pressable
          style={u.btn}
          onPress={() => {
            tap()
            duplicateMany([unit.id])
          }}
        >
          <Text style={u.btnText}>Duplicate</Text>
        </Pressable>
        <Pressable
          style={u.btn}
          onPress={() => {
            tap()
            useCorridor.getState().setMultiSelectMode(true)
            useCorridor.getState().toggleMulti(unit.id)
            useCorridor.getState().select(null)
          }}
        >
          <Text style={u.btnText}>Select Multiple</Text>
        </Pressable>
        <Pressable
          style={u.dangerBtn}
          onPress={() => {
            tap()
            removeUnit(unit.id)
          }}
        >
          <Text style={u.dangerText}>Remove</Text>
        </Pressable>
      </View>

      <Text style={u.label}>Appearance</Text>
      <Text style={u.label}>Cabinet finish</Text>
      <View style={u.wrap}>
        {FINISH_ORDER.map((f) => (
          <Pressable
            key={f}
            style={[u.chip, finish === f && u.chipOn]}
            onPress={() => {
              tap()
              setUnitFinish(unit.id, f)
            }}
          >
            <View style={[styles.dot, { backgroundColor: FINISHES[f].color }]} />
            <Text style={u.chipText}>{FINISHES[f].label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={u.label}>Glass</Text>
      <View style={u.wrap}>
        {GLASS_ORDER.map((g) => (
          <Pressable
            key={g}
            style={[u.chip, glass === g && u.chipOn]}
            onPress={() => {
              tap()
              setUnitGlass(unit.id, g)
            }}
          >
            <View style={[styles.dot, { backgroundColor: GLASSES[g].color }]} />
            <Text style={u.chipText}>{GLASSES[g].label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={u.label}>LED for this unit</Text>
      <ColorPalette
        value={led}
        onChange={(l) => setUnitLed(unit.id, l)}
        onClear={unit.led ? () => setUnitLed(unit.id, null) : undefined}
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
  if (!group) return null
  const nUnits = units.filter((x) => x.groupId === group.id).length
  const nLanes = lanes.filter((l) => l.groupId === group.id).length

  return (
    <>
      <TextInput
        value={group.name}
        onChangeText={(t) => renameLaneGroup(group.id, t)}
        style={[styles.nameInput, { color: c.text, borderColor: c.hair, backgroundColor: c.surface }]}
      />
      <Text style={{ color: c.text3, marginBottom: 8 }}>
        {nUnits} Turnstile Units · {nLanes} Lanes · default {formatClearCm(group.defaultClearMm)}
      </Text>
      <View style={u.wrap}>
        <Pressable style={u.btn} onPress={() => fitSelection()}>
          <Text style={u.btnText}>Fit</Text>
        </Pressable>
        <Pressable style={u.btn} onPress={() => rotateLaneGroup(group.id, Math.PI / 2)}>
          <Text style={u.btnText}>Rotate</Text>
        </Pressable>
        <Pressable style={u.btn} onPress={() => duplicateLaneGroup(group.id)}>
          <Text style={u.btnText}>Duplicate</Text>
        </Pressable>
        <Pressable style={u.dangerBtn} onPress={() => deleteLaneGroup(group.id)}>
          <Text style={u.dangerText}>Delete</Text>
        </Pressable>
      </View>
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
  )
}

export function Inspector() {
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
  const open = Boolean((unit || lane || groupSel) && multi.length !== 2)

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
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotLg: { width: 16, height: 16, borderRadius: 8 },
})
