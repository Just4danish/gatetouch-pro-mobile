import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  categoryLabel,
  enabledManufacturers,
  formatDimsMm,
  modelsForManufacturer,
  type ManufacturerId,
  type TurnstileModel,
} from '../model/products'
import { formatClearCm, cmToMm, groupSummary } from '../model/installation'
import { CATALOG } from '../model/catalog'
import { canMergeLanes, laneClearMm, mergePartner, useCorridor } from '../store/corridor'
import { useTheme } from '../store/theme'
import { colors, type ThemeColors } from '../theme/tokens'
import { makeUiStyles } from './uiStyles'
import { chime, tap } from '../lib/feedback'
import type { UnitType } from '../model/catalog'

type WizardStep = 'groups' | 'manufacturer' | 'models' | 'adjust'

type Crumb = { label: string; onPress?: () => void }

export function BuildPanel() {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)

  const units = useCorridor((s) => s.units)
  const lanes = useCorridor((s) => s.lanes)
  const laneGroups = useCorridor((s) => s.laneGroups)
  const activeGroupId = useCorridor((s) => s.activeGroupId)

  const createLaneGroup = useCorridor((s) => s.createLaneGroup)
  const selectLaneGroup = useCorridor((s) => s.selectLaneGroup)
  const renameLaneGroup = useCorridor((s) => s.renameLaneGroup)
  const duplicateLaneGroup = useCorridor((s) => s.duplicateLaneGroup)
  const deleteLaneGroup = useCorridor((s) => s.deleteLaneGroup)
  const insertUnit = useCorridor((s) => s.insertUnit)
  const fitSelection = useCorridor((s) => s.fitSelection)
  const select = useCorridor((s) => s.select)
  const saveToLibrary = useCorridor((s) => s.saveToLibrary)

  const makers = enabledManufacturers()
  const [step, setStep] = useState<WizardStep>('groups')
  const [makerId, setMakerId] = useState<ManufacturerId>(makers[0]?.id ?? 'came')
  const [pendingModel, setPendingModel] = useState<UnitType | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  const models = modelsForManufacturer(makerId)
  const active = laneGroups.find((g) => g.id === activeGroupId)
  const selectedMaker = makers.find((m) => m.id === makerId) ?? makers[0]
  const groupUnitCount = active ? units.filter((x) => x.groupId === active.id).length : 0
  const canSave = units.length > 0

  const saveInstallation = () => {
    if (!canSave) return
    tap()
    chime()
    saveToLibrary()
    setSavedNote('Saved on this device')
  }

  const openGroup = (id: string) => {
    tap()
    selectLaneGroup(id)
    select(null)
    fitSelection()
    setPendingModel(null)
    setMakerId(makers[0]?.id ?? 'came')
    setSavedNote(null)
    setStep('manufacturer')
  }

  const goGroups = () => {
    tap()
    setPendingModel(null)
    setStep('groups')
  }

  const goManufacturer = () => {
    tap()
    setPendingModel(null)
    setStep('manufacturer')
  }

  const openAdjust = (id: string) => {
    tap()
    selectLaneGroup(id)
    select(null)
    setStep('adjust')
  }

  if (step === 'groups') {
    return (
      <View style={styles.page}>
        <Crumbs items={[{ label: 'Lane groups' }]} c={c} />
        <Text style={[styles.hint, { color: c.text2 }]}>Create a group, then open it to place turnstiles.</Text>

        <Pressable
          style={[u.primaryBtn, { alignSelf: 'flex-start', marginTop: 12 }]}
          testID="build.groups.create"
          accessibilityLabel="Create Lane Group"
          onPress={() => {
            tap()
            createLaneGroup()
          }}
        >
          <Text style={u.primaryText}>Create Lane Group</Text>
        </Pressable>

        <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 12, gap: 10 }}>
          {laneGroups.length === 0 && (
            <Text style={u.empty}>No lane groups yet. Create one to start placing equipment.</Text>
          )}
          {laneGroups.map((g) => {
            const sum = groupSummary(units, lanes, g.id)
            return (
              <View
                key={g.id}
                style={[styles.groupCard, { backgroundColor: c.glass2, borderColor: c.hair }]}
              >
                <TextInput
                  value={g.name}
                  onChangeText={(t) => renameLaneGroup(g.id, t)}
                  style={{ color: c.text, fontWeight: '700', fontSize: 16, paddingVertical: 0 }}
                  accessibilityLabel="Lane group name"
                />
                <Text style={{ color: c.text2, fontSize: 13, marginTop: 4 }}>
                  {sum.units} units · {sum.lanes} lanes
                </Text>
                <View style={styles.crudRow}>
                  <Pressable
                    style={u.primaryBtn}
                    testID={`build.group.${g.id}`}
                    onPress={() => openGroup(g.id)}
                  >
                    <Text style={u.primaryText}>Open</Text>
                  </Pressable>
                  <Pressable
                    style={u.btn}
                    testID={`build.group.adjust.${g.id}`}
                    accessibilityLabel="Adjust lanes"
                    onPress={() => openAdjust(g.id)}
                  >
                    <Text style={u.btnText}>Adjust lanes</Text>
                  </Pressable>
                  <Pressable
                    style={u.btn}
                    onPress={() => {
                      tap()
                      duplicateLaneGroup(g.id)
                    }}
                  >
                    <Text style={u.btnText}>Copy</Text>
                  </Pressable>
                  <Pressable
                    style={u.dangerBtn}
                    onPress={() => {
                      tap()
                      deleteLaneGroup(g.id)
                    }}
                  >
                    <Text style={u.dangerText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
        </ScrollView>
        {canSave && <SaveBar note={savedNote} onSave={saveInstallation} />}
      </View>
    )
  }

  if (!active) {
    return (
      <View style={styles.page}>
        <Crumbs items={[{ label: 'Lane groups', onPress: goGroups }, { label: 'Select a group' }]} c={c} />
        <Text style={u.empty}>Select a lane group first.</Text>
      </View>
    )
  }

  if (step === 'adjust') {
    return (
      <AdjustLanesPage
        groupName={active.name}
        groupId={active.id}
        onBack={goGroups}
      />
    )
  }

  if (step === 'manufacturer') {
    return (
      <View style={styles.page}>
        <Crumbs
          items={[
            { label: 'Lane groups', onPress: goGroups },
            { label: active.name, onPress: goGroups },
            { label: selectedMaker?.name ?? 'Manufacturer' },
          ]}
          c={c}
        />
        <Text style={[styles.title, { color: c.text }]}>Manufacturer</Text>
        <Text style={[styles.hint, { color: c.text2 }]}>Select a manufacturer, then continue to models.</Text>

        <Text style={u.label}>Manufacturer</Text>
        <View style={{ gap: 8 }}>
          {makers.map((m) => {
            const on = m.id === makerId
            return (
              <Pressable
                key={m.id}
                style={[
                  styles.makerCard,
                  { backgroundColor: on ? c.thumb2 : c.glass2, borderColor: on ? c.accent : c.hair },
                ]}
                testID={`equipment.maker.${m.id}`}
                onPress={() => {
                  tap()
                  setMakerId(m.id)
                }}
              >
                <Text style={{ color: on ? c.onThumb : c.text, fontWeight: '800', fontSize: 18 }}>{m.name}</Text>
                <Text style={{ color: on ? c.onThumb : c.text3, marginTop: 4 }}>{m.description}</Text>
                {on && (
                  <Text style={{ color: c.accentFg, fontWeight: '700', marginTop: 8 }}>Selected</Text>
                )}
              </Pressable>
            )
          })}
        </View>

        <Pressable
          style={[u.primaryBtn, { marginTop: 16, alignSelf: 'flex-end' }]}
          testID="build.wizard.next"
          disabled={!selectedMaker}
          onPress={() => {
            tap()
            setStep('models')
          }}
        >
          <Text style={u.primaryText}>Next</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      <Crumbs
        items={[
          { label: 'Lane groups', onPress: goGroups },
          { label: active.name, onPress: goManufacturer },
          { label: selectedMaker?.name ?? 'Manufacturer', onPress: goManufacturer },
          { label: 'Models' },
        ]}
        c={c}
      />
      <Text style={[styles.title, { color: c.text }]}>Models</Text>
      <Text style={[styles.hint, { color: c.text2 }]}>
        Tap a model, then add it to {active.name}.
      </Text>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 12, gap: 10 }}>
        {models.map((m) => (
          <ModelPick
            key={m.id}
            model={m}
            groupName={active.name}
            open={pendingModel === m.id}
            onPress={() => {
              tap()
              setPendingModel(pendingModel === m.id ? null : m.id)
            }}
            onAdd={() => {
              tap()
              insertUnit(m.id, undefined, active.id)
              setPendingModel(null)
              setSavedNote(null)
            }}
          />
        ))}
      </ScrollView>
      <SaveBar
        note={savedNote ?? (groupUnitCount === 0 ? 'Add at least one model to save' : null)}
        disabled={!canSave}
        onSave={saveInstallation}
      />
    </View>
  )
}

const WIDTH_PRESETS = [
  { cm: 60, label: '60 cm' },
  { cm: 90, label: '90 cm' },
  { cm: 100, label: '1 m' },
]

function leafLabel(unitId: string, wing: string, units: Array<{ id: string; type: UnitType }>) {
  const u = units.find((x) => x.id === unitId)
  const short = u ? CATALOG[u.type].short : 'Unit'
  const leaves = u ? CATALOG[u.type].wings.length : 1
  if (leaves < 2) return short
  return `${short} ${wing}`
}

function AdjustLanesPage({
  groupName,
  groupId,
  onBack,
}: {
  groupName: string
  groupId: string
  onBack: () => void
}) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const units = useCorridor((s) => s.units)
  const lanes = useCorridor((s) => s.lanes)
  const gaps = useCorridor((s) => s.gaps)
  const renameLane = useCorridor((s) => s.renameLane)
  const setLaneWidth = useCorridor((s) => s.setLaneWidth)
  const mergeAdjacentLanes = useCorridor((s) => s.mergeAdjacentLanes)
  const splitLane = useCorridor((s) => s.splitLane)
  const [customFor, setCustomFor] = useState<string | null>(null)
  const [customCm, setCustomCm] = useState('')

  const groupLanes = lanes.filter((l) => l.groupId === groupId)
  const groupUnits = units.filter((x) => x.groupId === groupId)

  const applyCm = (laneId: string, cm: number) => {
    const n = Math.max(20, Math.min(200, Math.round(cm)))
    setLaneWidth(laneId, cmToMm(n))
  }

  return (
    <View style={styles.page}>
      <Crumbs
        items={[{ label: 'Lane groups', onPress: onBack }, { label: groupName, onPress: onBack }, { label: 'Adjust lanes' }]}
        c={c}
      />
      <Text style={[styles.title, { color: c.text }]}>Adjust lanes</Text>
      <Text style={[styles.hint, { color: c.text2 }]}>
        Each leaf is its own 60 cm lane. Merge only facing leaves on adjacent cabinets. Opening a merged lane opens both.
      </Text>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: 12, gap: 10 }}>
        {groupLanes.length === 0 && (
          <Text style={u.empty}>Place equipment first. Each leaf becomes a lane automatically.</Text>
        )}
        {groupLanes.map((lane) => {
          const mm = laneClearMm(lane, units, gaps)
          const cm = Math.round(mm / 10)
          const partner = mergePartner(lane, groupLanes, units)
          const showMerge = partner && canMergeLanes(lane, partner, units) && groupLanes.indexOf(lane) < groupLanes.indexOf(partner)
          return (
            <View
              key={lane.id}
              style={[styles.laneCard, { backgroundColor: c.glass2, borderColor: c.hair }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.swatch, { backgroundColor: lane.color }]} />
                <TextInput
                  value={lane.name}
                  onChangeText={(t) => renameLane(lane.id, t)}
                  style={{ flex: 1, color: c.text, fontWeight: '700', fontSize: 16, paddingVertical: 0 }}
                  accessibilityLabel="Lane name"
                />
              </View>
              <Text style={{ color: c.text2, fontSize: 13, marginTop: 6 }}>
                {lane.members.map((m) => leafLabel(m.unitId, m.wing, groupUnits)).join('  ·  ')}
                {lane.members.length > 1 ? '  ·  merged' : ''}
              </Text>
              <Text style={u.label}>Width</Text>
              <View style={styles.crudRow}>
                {WIDTH_PRESETS.map((p) => {
                  const on = cm === p.cm
                  return (
                    <Pressable
                      key={p.cm}
                      style={[u.btn, on && { borderColor: c.accent, borderWidth: 1.5 }]}
                      onPress={() => {
                        tap()
                        setCustomFor(null)
                        applyCm(lane.id, p.cm)
                      }}
                    >
                      <Text style={u.btnText}>{p.label}</Text>
                    </Pressable>
                  )
                })}
                <Pressable
                  style={[u.btn, customFor === lane.id && { borderColor: c.accent, borderWidth: 1.5 }]}
                  onPress={() => {
                    tap()
                    setCustomFor(lane.id)
                    setCustomCm(String(cm))
                  }}
                >
                  <Text style={u.btnText}>Custom</Text>
                </Pressable>
              </View>
              {customFor === lane.id && (
                <View style={[styles.crudRow, { marginTop: 8 }]}>
                  <TextInput
                    value={customCm}
                    onChangeText={setCustomCm}
                    keyboardType="number-pad"
                    placeholder="cm"
                    placeholderTextColor={c.text3}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: c.hair,
                      color: c.text,
                      paddingHorizontal: 12,
                    }}
                    accessibilityLabel="Custom width in centimetres"
                  />
                  <Pressable
                    style={u.primaryBtn}
                    onPress={() => {
                      tap()
                      const n = Number(customCm)
                      if (!Number.isFinite(n)) return
                      applyCm(lane.id, n)
                    }}
                  >
                    <Text style={u.primaryText}>Set cm</Text>
                  </Pressable>
                </View>
              )}
              <Text style={{ color: c.text3, fontSize: 12, marginTop: 6 }}>Now {formatClearCm(mm)}</Text>
              <View style={[styles.crudRow, { marginTop: 10 }]}>
                {showMerge && partner && (
                  <Pressable
                    style={u.primaryBtn}
                    testID={`build.lane.merge.${lane.id}`}
                    onPress={() => {
                      tap()
                      mergeAdjacentLanes(lane.id, partner.id)
                    }}
                  >
                    <Text style={u.primaryText}>Merge with {partner.name}</Text>
                  </Pressable>
                )}
                {lane.members.length > 1 && (
                  <Pressable
                    style={u.btn}
                    onPress={() => {
                      tap()
                      splitLane(lane.id)
                    }}
                  >
                    <Text style={u.btnText}>Split</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

function Crumbs({ items, c }: { items: Crumb[]; c: ThemeColors }) {
  return (
    <View style={styles.crumbs} accessibilityRole="header">
      {items.map((it, i) => (
        <View key={`${it.label}-${i}`} style={styles.crumbItem}>
          {i > 0 && (
            <Text style={[styles.sep, { color: c.text3 }]} accessibilityElementsHidden>
              ›
            </Text>
          )}
          {it.onPress ? (
            <Pressable
              onPress={it.onPress}
              hitSlop={8}
              accessibilityLabel={`Back to ${it.label}`}
              testID={`build.crumb.${i}`}
            >
              <Text style={[styles.crumbLink, { color: c.accentFg }]} numberOfLines={1}>
                {it.label}
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.crumbHere, { color: c.text }]} numberOfLines={1}>
              {it.label}
            </Text>
          )}
        </View>
      ))}
    </View>
  )
}

function SaveBar({
  note,
  disabled,
  onSave,
}: {
  note: string | null
  disabled?: boolean
  onSave: () => void
}) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  return (
    <View style={styles.saveBar}>
      {note ? <Text style={{ color: c.text3, fontSize: 12, marginBottom: 8 }}>{note}</Text> : null}
      <Pressable
        style={[u.primaryBtn, disabled && u.btnDisabled]}
        testID="build.save"
        accessibilityLabel="Save installation"
        disabled={disabled}
        onPress={onSave}
      >
        <Text style={u.primaryText}>Save installation</Text>
      </Pressable>
    </View>
  )
}

function ModelPick({
  model,
  groupName,
  open,
  onPress,
  onAdd,
}: {
  model: TurnstileModel
  groupName: string
  open: boolean
  onPress: () => void
  onAdd: () => void
}) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  return (
    <View style={[styles.modelCard, { backgroundColor: c.glass2, borderColor: open ? c.accent : c.hair }]}>
      <Pressable testID={`equipment.model.${model.id}`} onPress={onPress}>
        <Text style={{ color: c.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
          {model.modelCode}
        </Text>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 16, marginTop: 4 }}>{model.name}</Text>
        <Text style={{ color: c.text2, fontSize: 13, marginTop: 2 }}>{categoryLabel(model.category)}</Text>
        <Text style={{ color: c.text3, fontSize: 12, marginTop: 6 }}>{formatDimsMm(model)}</Text>
      </Pressable>
      {open && (
        <Pressable
          style={[u.primaryBtn, { marginTop: 12 }]}
          testID={`equipment.add.${model.id}`}
          onPress={onAdd}
        >
          <Text style={u.primaryText}>Add to {groupName}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  hint: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  crumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: 36,
    rowGap: 4,
  },
  crumbItem: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  sep: { fontSize: 15, fontWeight: '600', marginHorizontal: 6 },
  crumbLink: { fontSize: 13, fontWeight: '700' },
  crumbHere: { fontSize: 13, fontWeight: '800' },
  list: { flex: 1 },
  groupCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  crudRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  makerCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  modelCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  laneCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  saveBar: { paddingTop: 8 },
})
