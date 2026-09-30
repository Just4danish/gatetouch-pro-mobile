import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import {
  categoryLabel,
  enabledManufacturers,
  formatDimsMm,
  formatLaneRangeMm,
  modelsForManufacturer,
  type ManufacturerId,
  type TurnstileModel,
} from '../model/products'
import { cmToMm, nextGroupName } from '../model/installation'
import { CATALOG } from '../model/catalog'
import { apiErrorMessage } from '../api/client'
import {
  createLane,
  deleteLane,
  delayMsToSec,
  laneDelayFromApi,
  laneWidthFromApi,
  listLanes,
  owningServerLaneId,
  updateLane,
  type LaneDto,
} from '../api/lane'
import { apiTypeFromUnitType } from '../api/turnstiles'
import { createLaneGroup as postLaneGroup, deleteLaneGroup as deleteLaneGroupApi, listLaneGroups, updateLaneGroup, type LaneGroupDto } from '../api/laneGroup'
import { canMergeLanes, laneClearMm, mergePartner, useCorridor } from '../store/corridor'
import { useAuth } from '../store/auth'
import { hasPermission } from '../auth/permissions'
import { useTheme } from '../store/theme'
import { useToast } from '../store/toast'
import { colors, type ThemeColors } from '../theme/tokens'
import { makeUiStyles } from './uiStyles'
import { buzz, chime, tap } from '../lib/feedback'
import { ConfirmDialog } from './ConfirmDialog'
import { PinConfigDialog, PinDropdown } from './PinConfigDialog'
import { IconChevron, IconMore, IconPlus } from './Icons'
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

  const syncLaneGroupsFromServer = useCorridor((s) => s.syncLaneGroupsFromServer)
  const selectLaneGroup = useCorridor((s) => s.selectLaneGroup)
  const renameLaneGroup = useCorridor((s) => s.renameLaneGroup)
  const duplicateLaneGroup = useCorridor((s) => s.duplicateLaneGroup)
  const setLaneGroupPins = useCorridor((s) => s.setLaneGroupPins)
  const fitSelection = useCorridor((s) => s.fitSelection)
  const select = useCorridor((s) => s.select)
  const setMode = useCorridor((s) => s.setMode)

  const makers = enabledManufacturers()
  const [step, setStep] = useState<WizardStep>('groups')
  const [makerId, setMakerId] = useState<ManufacturerId>(makers[0]?.id ?? 'came')
  const [pendingModel, setPendingModel] = useState<UnitType | null>(null)
  const [menuGroupId, setMenuGroupId] = useState<string | null>(null)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [addingModel, setAddingModel] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [serverLanes, setServerLanes] = useState<LaneDto[]>([])
  const [serverGroups, setServerGroups] = useState<LaneGroupDto[]>([])
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [pinConfigModel, setPinConfigModel] = useState<TurnstileModel | null>(null)
  const showToast = useToast((s) => s.show)
  const authUsername = useAuth((s) => s.username)
  const role = useAuth((s) => s.role)
  const canCreate = hasPermission(role, 'CREATE_RESOURCES')
  const canUpdate = hasPermission(role, 'UPDATE_RESOURCES')
  const canDelete = hasPermission(role, 'DELETE_RESOURCES')

  const models = modelsForManufacturer(makerId)
  const active = laneGroups.find((g) => g.id === activeGroupId)
  const selectedMaker = makers.find((m) => m.id === makerId) ?? makers[0]
  const adjustServerLanes = useMemo(
    () => (active ? serverLanes.filter((l) => String(l.lane_group) === active.id) : []),
    [serverLanes, active?.id],
  )

  const refreshLaneGroups = async () => {
    const [groups, laneRows] = await Promise.all([listLaneGroups(), listLanes()])
    syncLaneGroupsFromServer(groups, laneRows)
    setServerGroups(groups)
    setServerLanes(laneRows)
  }

  useEffect(() => {
    if (step !== 'groups') return
    let alive = true
    setLoadingGroups(true)
    void refreshLaneGroups()
      .catch((err) => {
        if (!alive) return
        buzz()
        showToast(apiErrorMessage(err), 'error')
      })
      .finally(() => {
        if (alive) setLoadingGroups(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when entering groups step
  }, [step])

  const handleAddModel = async (
    model: TurnstileModel,
    entryPin: number | null,
    exitPin: number | null,
  ) => {
    if (!active || addingModel) return
    const laneGroupId = Number(active.id)
    if (!Number.isFinite(laneGroupId)) {
      buzz()
      showToast('Lane group id is invalid', 'error')
      return
    }

    const groupServerLanes = serverLanes.filter((l) => String(l.lane_group) === active.id)
    const groupUnits = units.filter((u) => u.groupId === active.id)
    const turnstileType = apiTypeFromUnitType(model.id)
    // Heuristic until placement / side is configured in the UI.
    const isLeft = turnstileType !== 'center' && groupUnits.length === 0

    setAddingModel(true)
    try {
      await createLane({
        name: `Lane ${groupServerLanes.length + 1}`,
        lane_group: laneGroupId,
        turnstyles: [
          {
            make: selectedMaker?.name ?? '',
            model: model.name,
            type: turnstileType,
            is_left: isLeft,
          },
        ],
        width: 60,
        ...(entryPin != null ? { entry_pin: entryPin } : {}),
        ...(exitPin != null ? { exit_pin: exitPin } : {}),
        created_by: authUsername?.trim() || 'unknown',
      })
      const laneRows = await listLanes()
      setServerLanes(laneRows)
      // Re-hydrate from server so reload and in-session state match.
      syncLaneGroupsFromServer(
        laneGroups.map((g) => ({
          id: g.id,
          name: g.name,
          emergency_pin: g.emergencyPin,
          fire_pin: g.firePin,
        })),
        laneRows,
      )
      setPendingModel(null)
      setPinConfigModel(null)
      chime()
    } catch (err) {
      buzz()
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setAddingModel(false)
    }
  }

  const handleCreateLaneGroup = async () => {
    if (creatingGroup) return
    tap()
    const name = nextGroupName(laneGroups)
    setCreatingGroup(true)
    try {
      const created = await postLaneGroup({ name, description: '' })
      // Clear any backend defaults — safety pins stay blank until the user Saves.
      await updateLaneGroup(created.id, { emergency_pin: null, fire_pin: null })
      await refreshLaneGroups()
      chime()
    } catch (err) {
      buzz()
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setCreatingGroup(false)
    }
  }

  const handleDeleteLaneGroup = async (id: string) => {
    try {
      await deleteLaneGroupApi(id)
      await refreshLaneGroups()
      chime()
    } catch (err) {
      buzz()
      showToast(apiErrorMessage(err), 'error')
    }
  }

  const openGroup = (id: string) => {
    tap()
    selectLaneGroup(id)
    select(null)
    fitSelection()
    setPendingModel(null)
    setMakerId(makers[0]?.id ?? 'came')
    if (!canCreate) {
      // Operators: open the group in Operate (no Build edits).
      setMode('operate')
      return
    }
    setStep('manufacturer')
  }

  const goGroups = () => {
    tap()
    setPendingModel(null)
    setPinConfigModel(null)
    setStep('groups')
  }

  const goManufacturer = () => {
    tap()
    setPendingModel(null)
    setPinConfigModel(null)
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
      <>
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={[
          styles.pageScrollContent,
          laneGroups.length === 0 && styles.pageScrollEmpty,
        ]}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <Text style={[styles.panelTitle, { color: c.text }]}>Lane groups</Text>
        <Text style={[styles.hint, { color: c.text2 }]}>
          {canCreate
            ? 'Create a group, then open it to place turnstiles.'
            : 'Select a group to open it in Operate.'}
        </Text>

        {canCreate ? (
          <Pressable
            style={[u.primaryBtn, styles.createBtn, creatingGroup && { opacity: 0.6 }]}
            testID="build.groups.create"
            accessibilityLabel="Create Lane Group"
            disabled={creatingGroup}
            onPress={() => {
              void handleCreateLaneGroup()
            }}
          >
            <Text style={u.primaryText}>{creatingGroup ? 'Creating…' : 'Create Lane Group'}</Text>
          </Pressable>
        ) : null}

        {loadingGroups && laneGroups.length === 0 ? (
          <Text style={[u.empty, { marginTop: 12 }]}>Loading lane groups…</Text>
        ) : laneGroups.length === 0 ? (
          <Text style={[u.empty, { marginTop: 12 }]}>No lane groups yet. Create one to place turnstiles.</Text>
        ) : (
          <View style={styles.groupList}>
            {laneGroups.map((g) => {
              const nUnits = units.filter((u) => u.groupId === g.id).length
              const nLanes = lanes.filter((l) => l.groupId === g.id).length
              const menuOpen = menuGroupId === g.id
              const selected = g.id === activeGroupId
              return (
                <View
                  key={g.id}
                  style={[
                    styles.groupCardWrap,
                    {
                      backgroundColor: selected || menuOpen ? c.accentTint : c.glass2,
                      borderColor: selected || menuOpen ? c.accent : c.hair,
                    },
                  ]}
                >
                  {(selected || menuOpen) && (
                    <View style={[styles.groupAccent, { backgroundColor: c.accent }]} />
                  )}
                  <View style={styles.groupRow}>
                    <Pressable
                      style={styles.groupRowMain}
                      testID={`build.group.${g.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${g.name}`}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setMenuGroupId(null)
                        openGroup(g.id)
                      }}
                    >
                      <TextInput
                        value={g.name}
                        onChangeText={(t) => renameLaneGroup(g.id, t)}
                        style={[styles.groupName, { color: c.text }]}
                        accessibilityLabel="Lane group name"
                        editable={canUpdate}
                      />
                      <Text style={[styles.groupMeta, { color: c.text3 }]}>
                        {nUnits} unit{nUnits === 1 ? '' : 's'} · {nLanes} lane{nLanes === 1 ? '' : 's'}
                      </Text>
                    </Pressable>
                    {(canUpdate || canDelete) && (
                    <Pressable
                      style={[styles.moreBtn, menuOpen && { backgroundColor: c.fill2 }]}
                      hitSlop={8}
                      testID={`build.group.menu.${g.id}`}
                      accessibilityLabel="Group actions"
                      onPress={() => {
                        tap()
                        setMenuGroupId((id) => (id === g.id ? null : g.id))
                      }}
                    >
                      <IconMore color={c.text2} />
                    </Pressable>
                    )}
                    <Pressable
                      style={styles.moreBtn}
                      accessibilityLabel={`Open ${g.name}`}
                      onPress={() => {
                        setMenuGroupId(null)
                        openGroup(g.id)
                      }}
                    >
                      <IconChevron color={selected ? c.accentFg : c.text3} />
                    </Pressable>
                  </View>

                  {menuOpen && (canUpdate || canDelete) && (
                    <View style={[styles.inlineMenu, { borderTopColor: c.hair }]}>
                      {canUpdate ? (
                      <Pressable
                        style={styles.menuItem}
                        testID={`build.group.adjust.${g.id}`}
                        onPress={() => {
                          setMenuGroupId(null)
                          openAdjust(g.id)
                        }}
                      >
                        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>Adjust lanes</Text>
                      </Pressable>
                      ) : null}
                      {/* Temporarily hidden — not backed by server yet
                      <Pressable
                        style={styles.menuItem}
                        onPress={() => {
                          tap()
                          duplicateLaneGroup(g.id)
                          setMenuGroupId(null)
                        }}
                      >
                        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>Copy</Text>
                      </Pressable>
                      */}
                      {canDelete ? (
                      <Pressable
                        style={styles.menuItem}
                        onPress={() => {
                          tap()
                          setMenuGroupId(null)
                          setConfirmDelete({ id: g.id, name: g.name })
                        }}
                      >
                        <Text style={{ color: c.redFg, fontSize: 14, fontWeight: '700' }}>Delete</Text>
                      </Pressable>
                      ) : null}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete lane group?"
        message={`Confirm to delete${confirmDelete?.name ? ` “${confirmDelete.name}”` : ''}. This cannot be undone.`}
        cancelTestID="build.group.delete.cancel"
        confirmTestID="build.group.delete.confirm"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const id = confirmDelete?.id
          setConfirmDelete(null)
          if (id) void handleDeleteLaneGroup(id)
        }}
      />
    </>
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
    const groupDto = serverGroups.find((g) => String(g.id) === active.id)
    return (
      <AdjustLanesPage
        groupName={active.name}
        groupId={active.id}
        serverLanes={adjustServerLanes}
        initialEmergencyPin={groupDto?.emergency_pin ?? null}
        initialFirePin={groupDto?.fire_pin ?? null}
        onBack={goGroups}
        onLanesChanged={async () => {
          await refreshLaneGroups()
        }}
        onGroupPinsSaved={(emergency, fire) => {
          setLaneGroupPins(active.id, emergency, fire)
          setServerGroups((rows) =>
            rows.map((g) =>
              String(g.id) === active.id
                ? {
                    ...g,
                    emergency_pin: emergency,
                    fire_pin: fire,
                  }
                : g,
            ),
          )
        }}
        onLaneSaved={(serverId, patch) => {
          setServerLanes((rows) =>
            rows.map((l) => (String(l.id) === serverId ? { ...l, ...patch } : l)),
          )
        }}
      />
    )
  }

  if (step === 'manufacturer') {
    return (
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageScrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
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
          style={[u.primaryBtn, styles.createBtn]}
          testID="build.wizard.next"
          disabled={!selectedMaker}
          onPress={() => {
            tap()
            setStep('models')
          }}
        >
          <Text style={u.primaryText}>Next</Text>
        </Pressable>
      </ScrollView>
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
      <Text style={[styles.panelTitle, { color: c.text, marginTop: 4 }]}>Models</Text>
      <Text style={[styles.hint, { color: c.text2 }]}>
        Tap a model, then Add.
      </Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
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
            adding={addingModel && pinConfigModel?.id === m.id}
            canAdd={canCreate}
            onAdd={() => {
              tap()
              setPinConfigModel(m)
            }}
          />
        ))}
      </ScrollView>

      <PinConfigDialog
        open={!!pinConfigModel && canCreate}
        modelName={pinConfigModel?.name ?? ''}
        confirming={addingModel}
        onCancel={() => {
          if (addingModel) return
          setPinConfigModel(null)
        }}
        onConfirm={(entryPin, exitPin) => {
          if (!pinConfigModel) return
          void handleAddModel(pinConfigModel, entryPin, exitPin)
        }}
      />
    </View>
  )
}

const WIDTH_PRESETS = [
  { cm: 60, label: '60' },
  { cm: 90, label: '90' },
  { cm: 100, label: '100' },
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
  serverLanes,
  initialEmergencyPin,
  initialFirePin,
  onBack,
  onLanesChanged,
  onGroupPinsSaved,
  onLaneSaved,
}: {
  groupName: string
  groupId: string
  serverLanes: LaneDto[]
  initialEmergencyPin: number | null
  initialFirePin: number | null
  onBack: () => void
  onLanesChanged: () => Promise<void>
  onGroupPinsSaved: (emergencyPin: number | null, firePin: number | null) => void
  onLaneSaved: (
    serverId: string,
    patch: {
      width?: number
      delay?: number
      entry_pin?: number | null
      exit_pin?: number | null
      keep_open?: boolean
    },
  ) => void
}) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const units = useCorridor((s) => s.units)
  const lanes = useCorridor((s) => s.lanes)
  const gaps = useCorridor((s) => s.gaps)
  const renameLane = useCorridor((s) => s.renameLane)
  const setLaneWidth = useCorridor((s) => s.setLaneWidth)
  const setLaneHold = useCorridor((s) => s.setLaneHold)
  const setLanePinsByServerId = useCorridor((s) => s.setLanePinsByServerId)
  const setLaneKeepOpenByServerId = useCorridor((s) => s.setLaneKeepOpenByServerId)
  const mergeAdjacentLanes = useCorridor((s) => s.mergeAdjacentLanes)
  const splitLane = useCorridor((s) => s.splitLane)
  const showToast = useToast((s) => s.show)
  const role = useAuth((s) => s.role)
  const canUpdate = hasPermission(role, 'UPDATE_RESOURCES')
  const canDelete = hasPermission(role, 'DELETE_RESOURCES')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [emergencyPin, setEmergencyPin] = useState<number | null>(() =>
    typeof initialEmergencyPin === 'number' && initialEmergencyPin >= 1 ? initialEmergencyPin : null,
  )
  const [fireExitPin, setFireExitPin] = useState<number | null>(() =>
    typeof initialFirePin === 'number' && initialFirePin >= 1 ? initialFirePin : null,
  )
  const [openPinMenu, setOpenPinMenu] = useState<'emergency' | 'fire' | null>(null)
  const [savingPins, setSavingPins] = useState(false)
  const [widthDrafts, setWidthDrafts] = useState<Record<string, string>>({})
  const [savedWidths, setSavedWidths] = useState<Record<string, number>>({})
  const [delayDrafts, setDelayDrafts] = useState<Record<string, string>>({})
  const [savedDelays, setSavedDelays] = useState<Record<string, number>>({})
  const [entryPinDrafts, setEntryPinDrafts] = useState<Record<string, number | null>>({})
  const [savedEntryPins, setSavedEntryPins] = useState<Record<string, number | null>>({})
  const [exitPinDrafts, setExitPinDrafts] = useState<Record<string, number | null>>({})
  const [savedExitPins, setSavedExitPins] = useState<Record<string, number | null>>({})
  const [keepOpenDrafts, setKeepOpenDrafts] = useState<Record<string, boolean>>({})
  const [savedKeepOpen, setSavedKeepOpen] = useState<Record<string, boolean>>({})
  const [openLanePinMenu, setOpenLanePinMenu] = useState<string | null>(null)
  const [savingLaneId, setSavingLaneId] = useState<string | null>(null)

  const groupLanes = lanes.filter((l) => l.groupId === groupId)
  const groupUnits = units.filter((x) => x.groupId === groupId)

  const savedEmergency =
    typeof initialEmergencyPin === 'number' && initialEmergencyPin >= 1 ? initialEmergencyPin : null
  const savedFire =
    typeof initialFirePin === 'number' && initialFirePin >= 1 ? initialFirePin : null
  const pinsDirty = emergencyPin !== savedEmergency || fireExitPin !== savedFire

  const pinValue = (n: unknown): number | null =>
    typeof n === 'number' && n >= 1 ? n : null

  useEffect(() => {
    setOpenPinMenu(null)
    setOpenLanePinMenu(null)
    setEmergencyPin(
      typeof initialEmergencyPin === 'number' && initialEmergencyPin >= 1 ? initialEmergencyPin : null,
    )
    setFireExitPin(typeof initialFirePin === 'number' && initialFirePin >= 1 ? initialFirePin : null)
  }, [groupId, initialEmergencyPin, initialFirePin])

  useEffect(() => {
    const widths: Record<string, string> = {}
    const savedW: Record<string, number> = {}
    const delays: Record<string, string> = {}
    const savedD: Record<string, number> = {}
    const entryPins: Record<string, number | null> = {}
    const savedEntry: Record<string, number | null> = {}
    const exitPins: Record<string, number | null> = {}
    const savedExit: Record<string, number | null> = {}
    const keepOpen: Record<string, boolean> = {}
    const savedKeep: Record<string, boolean> = {}
    for (const row of serverLanes) {
      const id = String(row.id)
      // Show backend width / delay exactly as returned (delay is milliseconds).
      const width = laneWidthFromApi(row.width)
      const delayMs = laneDelayFromApi(row.delay)
      if (width != null) {
        widths[id] = String(width)
        savedW[id] = width
      } else {
        widths[id] = ''
      }
      if (delayMs != null) {
        delays[id] = String(delayMs)
        savedD[id] = delayMs
      } else {
        delays[id] = ''
      }
      const entry = pinValue(row.entry_pin)
      const exit = pinValue(row.exit_pin)
      entryPins[id] = entry
      savedEntry[id] = entry
      exitPins[id] = exit
      savedExit[id] = exit
      const ko = row.keep_open === true
      keepOpen[id] = ko
      savedKeep[id] = ko
    }
    setWidthDrafts(widths)
    setSavedWidths(savedW)
    setDelayDrafts(delays)
    setSavedDelays(savedD)
    setEntryPinDrafts(entryPins)
    setSavedEntryPins(savedEntry)
    setExitPinDrafts(exitPins)
    setSavedExitPins(savedExit)
    setKeepOpenDrafts(keepOpen)
    setSavedKeepOpen(savedKeep)
  }, [serverLanes])

  const saveLaneFields = async (serverId: string, localLaneId: string) => {
    if (savingLaneId) return
    const widthRaw = widthDrafts[serverId]?.trim() ?? ''
    const delayRaw = delayDrafts[serverId]?.trim() ?? ''
    const widthN = Number(widthRaw)
    const delayN = Number(delayRaw)
    if (!Number.isFinite(widthN) || widthN <= 0) {
      buzz()
      showToast('Enter a width (greater than 0)', 'error')
      return
    }
    if (!Number.isFinite(delayN) || delayN <= 0) {
      buzz()
      showToast('Enter a delay in milliseconds (greater than 0)', 'error')
      return
    }
    const width = Math.round(widthN)
    const delayMs = Math.round(delayN)
    const entryPin = entryPinDrafts[serverId] ?? null
    const exitPin = exitPinDrafts[serverId] ?? null
    const keepOpen = keepOpenDrafts[serverId] === true
    const widthDirty = width !== savedWidths[serverId]
    const delayDirty = delayMs !== savedDelays[serverId]
    const entryDirty = entryPin !== savedEntryPins[serverId]
    const exitDirty = exitPin !== savedExitPins[serverId]
    const keepOpenDirty = keepOpen !== savedKeepOpen[serverId]
    if (!widthDirty && !delayDirty && !entryDirty && !exitDirty && !keepOpenDirty) return

    if ((entryDirty || exitDirty) && entryPin == null && exitPin == null) {
      buzz()
      showToast('Select an entry pin, an exit pin, or both', 'error')
      return
    }

    setSavingLaneId(serverId)
    setOpenLanePinMenu(null)
    try {
      const body: {
        width?: number
        delay?: number
        entry_pin?: number | null
        exit_pin?: number | null
        keep_open?: boolean
      } = {}
      if (widthDirty) body.width = width
      // Send delay to the API as milliseconds, same unit as GET.
      if (delayDirty) body.delay = delayMs
      if (entryDirty) body.entry_pin = entryPin
      if (exitDirty) body.exit_pin = exitPin
      if (keepOpenDirty) body.keep_open = keepOpen
      await updateLane(serverId, body)
      if (widthDirty) {
        setSavedWidths((prev) => ({ ...prev, [serverId]: width }))
        setWidthDrafts((prev) => ({ ...prev, [serverId]: String(width) }))
        setLaneWidth(localLaneId, cmToMm(width))
      }
      if (delayDirty) {
        setSavedDelays((prev) => ({ ...prev, [serverId]: delayMs }))
        setDelayDrafts((prev) => ({ ...prev, [serverId]: String(delayMs) }))
        // Timer uses seconds.
        const sec = delayMsToSec(delayMs)
        if (sec != null && sec > 0) setLaneHold(localLaneId, sec)
      }
      if (entryDirty) {
        setSavedEntryPins((prev) => ({ ...prev, [serverId]: entryPin }))
        setEntryPinDrafts((prev) => ({ ...prev, [serverId]: entryPin }))
      }
      if (exitDirty) {
        setSavedExitPins((prev) => ({ ...prev, [serverId]: exitPin }))
        setExitPinDrafts((prev) => ({ ...prev, [serverId]: exitPin }))
      }
      if (entryDirty || exitDirty) {
        setLanePinsByServerId(serverId, entryPin, exitPin)
      }
      if (keepOpenDirty) {
        setSavedKeepOpen((prev) => ({ ...prev, [serverId]: keepOpen }))
        setKeepOpenDrafts((prev) => ({ ...prev, [serverId]: keepOpen }))
        setLaneKeepOpenByServerId(serverId, keepOpen)
      }
      onLaneSaved(serverId, body)
      chime()
      showToast('Lane saved', 'success')
    } catch (err) {
      buzz()
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setSavingLaneId(null)
    }
  }

  const saveGroupPins = async () => {
    if (savingPins || !pinsDirty) return
    setSavingPins(true)
    setOpenPinMenu(null)
    try {
      await updateLaneGroup(groupId, {
        emergency_pin: emergencyPin != null && emergencyPin >= 1 ? emergencyPin : null,
        fire_pin: fireExitPin != null && fireExitPin >= 1 ? fireExitPin : null,
      })
      onGroupPinsSaved(emergencyPin, fireExitPin)
      chime()
      showToast('Safety pins saved', 'success')
    } catch (err) {
      buzz()
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setSavingPins(false)
    }
  }

  const handleDeleteLane = async (id: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      await deleteLane(id)
      await onLanesChanged()
      chime()
    } catch (err) {
      buzz()
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={[styles.pageScrollContent, { gap: 6 }]}
        showsVerticalScrollIndicator
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <Crumbs
          items={[
            { label: 'Lane groups', onPress: onBack },
            { label: groupName, onPress: onBack },
            { label: 'Adjust lanes' },
          ]}
          c={c}
        />
        <Text style={[styles.title, { color: c.text }]}>Adjust lanes</Text>
        <Text style={[styles.hint, { color: c.text2 }]}>
          Set width, delay, and entry/exit pins per lane. Merge only facing leaves on adjacent cabinets.
        </Text>

        <View style={[styles.safetyCard, { backgroundColor: c.glass2, borderColor: c.hair }]}>
          <View style={styles.safetyHeader}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>Safety pins</Text>
            {canUpdate ? (
              <Pressable
                style={[
                  styles.safetySave,
                  { backgroundColor: c.accent },
                  (!pinsDirty || savingPins) && { opacity: 0.45 },
                ]}
                testID="build.adjust.pins.save"
                disabled={!pinsDirty || savingPins}
                onPress={() => {
                  tap()
                  void saveGroupPins()
                }}
              >
                <Text style={{ color: c.onAccent, fontWeight: '700', fontSize: 12 }}>
                  {savingPins ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.safetyRow}>
            <PinDropdown
              label="Emergency"
              value={emergencyPin}
              placeholder="Select a pin"
              compact
              allowNone
              open={canUpdate && openPinMenu === 'emergency'}
              testID="build.adjust.pin.emergency"
              onToggle={() => {
                if (!canUpdate) return
                tap()
                setOpenPinMenu((m) => (m === 'emergency' ? null : 'emergency'))
              }}
              onSelect={(n) => {
                tap()
                setEmergencyPin(n)
                setOpenPinMenu(null)
              }}
            />
            <PinDropdown
              label="Fire exit"
              value={fireExitPin}
              placeholder="Select a pin"
              compact
              allowNone
              open={canUpdate && openPinMenu === 'fire'}
              testID="build.adjust.pin.fire"
              onToggle={() => {
                if (!canUpdate) return
                tap()
                setOpenPinMenu((m) => (m === 'fire' ? null : 'fire'))
              }}
              onSelect={(n) => {
                tap()
                setFireExitPin(n)
                setOpenPinMenu(null)
              }}
            />
          </View>
        </View>

        {groupLanes.length === 0 && serverLanes.length === 0 && (
          <Text style={u.empty}>Place equipment first. Each leaf becomes a lane automatically.</Text>
        )}
        {groupLanes.map((lane) => {
          const mm = laneClearMm(lane, units, gaps)
          const cm = Math.round(mm / 10)
          const partner = mergePartner(lane, groupLanes, units)
          const showMerge =
            partner &&
            canMergeLanes(lane, partner, units) &&
            groupLanes.indexOf(lane) < groupLanes.indexOf(partner)
          const serverId =
            owningServerLaneId(lane.members) ??
            serverLanes.find((s) => s.name === lane.name)?.id
          const serverIdStr = serverId != null ? String(serverId) : null
          const widthDraft = serverIdStr ? (widthDrafts[serverIdStr] ?? '') : String(cm)
          const delayDraft = serverIdStr ? (delayDrafts[serverIdStr] ?? '') : ''
          const entryDraft = serverIdStr ? (entryPinDrafts[serverIdStr] ?? null) : null
          const exitDraft = serverIdStr ? (exitPinDrafts[serverIdStr] ?? null) : null
          const keepOpenDraft = serverIdStr ? keepOpenDrafts[serverIdStr] === true : false
          const dirty =
            !!serverIdStr &&
            (Number(widthDraft) !== savedWidths[serverIdStr] ||
              Number(delayDraft) !== savedDelays[serverIdStr] ||
              entryDraft !== savedEntryPins[serverIdStr] ||
              exitDraft !== savedExitPins[serverIdStr] ||
              keepOpenDraft !== savedKeepOpen[serverIdStr])
          const saving = savingLaneId === serverIdStr

          return (
            <View
              key={lane.id}
              style={[
                styles.laneCard,
                {
                  backgroundColor: c.glass2,
                  borderColor: dirty ? c.accent : c.hair,
                },
              ]}
            >
              <View style={[styles.laneAccent, { backgroundColor: lane.color, opacity: 0.45 }]} />
              <View style={styles.laneMain}>
                <View style={styles.laneTitleRow}>
                  <TextInput
                    value={lane.name}
                    onChangeText={(t) => renameLane(lane.id, t)}
                    style={[styles.laneName, { color: c.text }]}
                    accessibilityLabel="Lane name"
                    editable={canUpdate}
                  />
                  {serverIdStr && canUpdate && (
                    <Pressable
                      style={[
                        styles.laneSave,
                        { backgroundColor: c.accent },
                        (!dirty || saving) && { opacity: 0.45 },
                      ]}
                      testID={`build.lane.save.${serverIdStr}`}
                      disabled={!dirty || saving}
                      onPress={() => {
                        tap()
                        void saveLaneFields(serverIdStr, lane.id)
                      }}
                    >
                      <Text style={{ color: c.onAccent, fontWeight: '700', fontSize: 11 }}>
                        {saving ? 'Saving…' : 'Save'}
                      </Text>
                    </Pressable>
                  )}
                  {serverIdStr && canDelete && (
                    <Pressable
                      style={[
                        styles.laneDelete,
                        { backgroundColor: c.tintRedBg, borderColor: c.tintRedBd },
                        deletingId === serverIdStr && { opacity: 0.6 },
                      ]}
                      testID={`build.lane.delete.${serverIdStr}`}
                      disabled={!!deletingId}
                      onPress={() => {
                        tap()
                        setConfirmDelete({ id: serverIdStr, name: lane.name })
                      }}
                    >
                      <Text style={{ color: c.redFg, fontWeight: '700', fontSize: 11 }}>
                        {deletingId === serverIdStr ? '…' : 'Delete'}
                      </Text>
                    </Pressable>
                  )}
                </View>

                <Text style={[styles.laneMeta, { color: c.text2 }]} numberOfLines={2}>
                  {lane.members.map((m) => leafLabel(m.unitId, m.wing, groupUnits)).join(' · ')}
                  {lane.members.length > 1 ? ' · merged' : ''}
                </Text>

                <View style={styles.laneFields}>
                  <View
                    style={[
                      styles.fieldBlock,
                      { backgroundColor: c.fill2, borderColor: c.hair },
                    ]}
                  >
                    <Text style={[styles.fieldBlockLabel, { color: c.text2 }]}>Width</Text>
                    <View style={styles.fieldBlockRow}>
                      <TextInput
                        value={widthDraft}
                        onChangeText={(t) => {
                          if (!serverIdStr) return
                          setWidthDrafts((prev) => ({
                            ...prev,
                            [serverIdStr]: t.replace(/[^\d]/g, ''),
                          }))
                        }}
                        editable={!!serverIdStr && canUpdate}
                        keyboardType="number-pad"
                        placeholder=""
                        placeholderTextColor={c.text3}
                        style={[
                          styles.laneInput,
                          { borderColor: c.hair, color: c.text, backgroundColor: c.glass2 },
                        ]}
                        accessibilityLabel="Lane width in centimetres"
                        testID={serverIdStr ? `build.lane.width.${serverIdStr}` : undefined}
                      />
                      <Text style={[styles.unit, { color: c.text3 }]}>cm</Text>
                    </View>
                    <View style={styles.widthChips}>
                      {WIDTH_PRESETS.map((p) => {
                        const on = Number(widthDraft) === p.cm
                        return (
                          <Pressable
                            key={p.cm}
                            style={[
                              styles.widthChip,
                              {
                                borderColor: on ? c.accent : c.hair,
                                backgroundColor: on ? c.accentTint : c.glass2,
                              },
                            ]}
                            disabled={!serverIdStr || !canUpdate}
                            onPress={() => {
                              if (!serverIdStr || !canUpdate) return
                              tap()
                              setWidthDrafts((prev) => ({ ...prev, [serverIdStr]: String(p.cm) }))
                            }}
                          >
                            <Text
                              style={{
                                color: on ? c.accentFg : c.text2,
                                fontSize: 11,
                                fontWeight: '700',
                              }}
                            >
                              {p.label}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.fieldBlock,
                      styles.delayBlock,
                      { backgroundColor: c.fill2, borderColor: c.hair },
                    ]}
                  >
                    <Text style={[styles.fieldBlockLabel, { color: c.text2 }]}>Delay</Text>
                    <View style={styles.fieldBlockRow}>
                      <TextInput
                        value={delayDraft}
                        onChangeText={(t) => {
                          if (!serverIdStr) return
                          setDelayDrafts((prev) => ({
                            ...prev,
                            [serverIdStr]: t.replace(/[^\d]/g, ''),
                          }))
                        }}
                        editable={!!serverIdStr && canUpdate}
                        keyboardType="number-pad"
                        placeholder=""
                        placeholderTextColor={c.text3}
                        style={[
                          styles.laneInput,
                          styles.delayInput,
                          { borderColor: c.hair, color: c.text, backgroundColor: c.glass2 },
                        ]}
                        accessibilityLabel="Lane delay in milliseconds"
                        testID={serverIdStr ? `build.lane.delay.${serverIdStr}` : undefined}
                      />
                    </View>
                    <Text style={[styles.fieldHint, { color: c.text3 }]}>milliseconds</Text>
                  </View>
                </View>

                {serverIdStr && (
                  <View
                    style={[
                      styles.keepOpenRow,
                      { backgroundColor: c.fill2, borderColor: c.hair },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.fieldBlockLabel, { color: c.text2, textAlign: 'left' }]}>
                        Keep open
                      </Text>
                      <Text style={{ color: c.text3, fontSize: 11, marginTop: 2 }}>
                        Stays open until Close is pressed
                      </Text>
                    </View>
                    <Switch
                      value={keepOpenDraft}
                      disabled={!canUpdate}
                      onValueChange={(v) => {
                        tap()
                        setKeepOpenDrafts((prev) => ({ ...prev, [serverIdStr]: v }))
                      }}
                      trackColor={{ false: c.hair, true: c.accent }}
                      thumbColor={c.glass2}
                      testID={`build.lane.keepOpen.${serverIdStr}`}
                    />
                  </View>
                )}

                {serverIdStr && (
                  <View style={styles.lanePinRow}>
                    <PinDropdown
                      label="Entry pin"
                      value={entryDraft}
                      placeholder="Select a pin"
                      compact
                      open={canUpdate && openLanePinMenu === `${serverIdStr}:entry`}
                      testID={`build.lane.entry.${serverIdStr}`}
                      onToggle={() => {
                        if (!canUpdate) return
                        tap()
                        setOpenLanePinMenu((m) =>
                          m === `${serverIdStr}:entry` ? null : `${serverIdStr}:entry`,
                        )
                      }}
                      onSelect={(n) => {
                        tap()
                        setEntryPinDrafts((prev) => ({ ...prev, [serverIdStr]: n }))
                        setOpenLanePinMenu(null)
                      }}
                    />
                    <PinDropdown
                      label="Exit pin"
                      value={exitDraft}
                      placeholder="Select a pin"
                      compact
                      open={canUpdate && openLanePinMenu === `${serverIdStr}:exit`}
                      testID={`build.lane.exit.${serverIdStr}`}
                      onToggle={() => {
                        if (!canUpdate) return
                        tap()
                        setOpenLanePinMenu((m) =>
                          m === `${serverIdStr}:exit` ? null : `${serverIdStr}:exit`,
                        )
                      }}
                      onSelect={(n) => {
                        tap()
                        setExitPinDrafts((prev) => ({ ...prev, [serverIdStr]: n }))
                        setOpenLanePinMenu(null)
                      }}
                    />
                  </View>
                )}

                {(showMerge || lane.members.length > 1) && (
                  <View style={styles.laneActions}>
                    {showMerge && partner && (
                      <Pressable
                        style={styles.laneActionBtn}
                        testID={`build.lane.merge.${lane.id}`}
                        onPress={() => {
                          tap()
                          mergeAdjacentLanes(lane.id, partner.id)
                        }}
                      >
                        <Text style={{ color: c.accentFg, fontWeight: '700', fontSize: 12 }}>Merge</Text>
                      </Pressable>
                    )}
                    {lane.members.length > 1 && (
                      <Pressable
                        style={styles.laneActionBtn}
                        onPress={() => {
                          tap()
                          splitLane(lane.id)
                        }}
                      >
                        <Text style={{ color: c.text2, fontWeight: '600', fontSize: 12 }}>Split</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </View>
          )
        })}
      </ScrollView>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete lane?"
        message={`Confirm to delete${confirmDelete?.name ? ` “${confirmDelete.name}”` : ''}. This cannot be undone.`}
        cancelTestID="build.lane.delete.cancel"
        confirmTestID="build.lane.delete.confirm"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const id = confirmDelete?.id
          setConfirmDelete(null)
          if (id) void handleDeleteLane(id)
        }}
      />
    </>
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

function ModelPick({
  model,
  groupName,
  open,
  onPress,
  onAdd,
  adding,
  canAdd = true,
}: {
  model: TurnstileModel
  groupName: string
  open: boolean
  onPress: () => void
  onAdd: () => void
  adding?: boolean
  canAdd?: boolean
}) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const accessible = model.capabilities.supportedLaneWidthRange.minMm >= 900

  return (
    <View
      style={[
        styles.modelCard,
        {
          backgroundColor: open ? c.accentTint : c.glass2,
          borderColor: open ? c.accent : c.hair,
        },
      ]}
    >
      {open && <View style={[styles.modelAccent, { backgroundColor: c.accent }]} />}
      <View style={styles.modelInner}>
        <Pressable
          style={styles.modelBody}
          testID={`equipment.model.${model.id}`}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={{ selected: open }}
        >
          <View style={styles.modelTitleRow}>
            <Text style={[styles.modelCode, { color: c.accentFg }]}>{model.modelCode}</Text>
            <Text style={[styles.modelCat, { color: c.text3 }]}>{categoryLabel(model.category)}</Text>
          </View>
          <Text style={[styles.modelName, { color: c.text }]} numberOfLines={1}>
            {model.name}
          </Text>
          <View style={styles.dimBlock}>
            <View style={styles.dimRow}>
              <Text style={[styles.dimKey, { color: c.text3 }]}>Cabinet</Text>
              <Text style={[styles.dimVal, { color: c.text }]}>{formatDimsMm(model)}</Text>
            </View>
            <View style={styles.dimRow}>
              <Text style={[styles.dimKey, { color: c.text3 }]}>Lane</Text>
              <Text style={[styles.dimVal, { color: c.text }]}>
                {formatLaneRangeMm(model)} clear
                {accessible ? ' · Accessible' : ''}
              </Text>
            </View>
          </View>
        </Pressable>

        {open && canAdd && (
          <View style={[styles.addRail, { borderLeftColor: c.hair }]}>
            <Pressable
              style={[styles.addBtn, { backgroundColor: c.accent }, adding && { opacity: 0.6 }]}
              testID={`equipment.add.${model.id}`}
              accessibilityLabel={`Add ${model.name} to ${groupName}`}
              disabled={adding}
              onPress={onAdd}
            >
              <IconPlus color={c.onAccent} size={15} />
              <Text style={[styles.addBtnLabel, { color: c.onAccent }]}>
                {adding ? '…' : 'Add'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: 0, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 12 },
  pageScroll: { flex: 1, minHeight: 0 },
  pageScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 20,
    flexGrow: 1,
  },
  pageScrollEmpty: { justifyContent: 'flex-start' },
  panelTitle: { fontSize: 18, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  hint: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  createBtn: { alignSelf: 'stretch', marginTop: 14 },
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
  list: { flex: 1, minHeight: 0, marginTop: 12 },
  listContent: { paddingBottom: 8, gap: 5 },
  groupList: { marginTop: 12, gap: 5, paddingBottom: 8 },
  emptyPlain: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 28,
  },
  groupCardWrap: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
  },
  groupAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    minHeight: 56,
  },
  groupRowMain: { flex: 1, minWidth: 0 },
  groupName: {
    fontWeight: '700',
    fontSize: 15,
    paddingVertical: 0,
  },
  groupMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  moreBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  inlineMenu: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
  },
  menuItem: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
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
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
  },
  modelAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  modelInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  modelBody: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  modelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modelCode: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modelCat: {
    fontSize: 10,
    fontWeight: '600',
  },
  modelName: {
    fontWeight: '700',
    fontSize: 13,
    marginTop: 1,
  },
  dimBlock: {
    marginTop: 4,
    gap: 1,
  },
  dimRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  dimKey: {
    width: 48,
    fontSize: 10,
    fontWeight: '700',
  },
  dimVal: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  addRail: {
    width: 56,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  addBtn: {
    width: 44,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
  },
  addBtnLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  laneCard: {
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 6,
    paddingLeft: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  laneAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
  },
  laneMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  laneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  laneName: {
    flex: 1,
    minWidth: 56,
    fontWeight: '700',
    fontSize: 13,
    paddingVertical: 0,
  },
  laneMeta: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  laneSave: {
    minHeight: 26,
    paddingHorizontal: 9,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laneDelete: {
    minHeight: 26,
    paddingHorizontal: 9,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laneFields: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  lanePinRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 0,
  },
  keepOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fieldBlock: {
    flex: 1.35,
    minWidth: 0,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    alignItems: 'center',
  },
  delayBlock: {
    flex: 1,
  },
  fieldBlockLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  fieldBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  fieldHint: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  unit: {
    fontSize: 10,
    fontWeight: '600',
    flexShrink: 1,
  },
  laneInput: {
    width: 44,
    minHeight: 28,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  delayInput: {
    width: 60,
  },
  widthChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 3,
  },
  widthChip: {
    minHeight: 22,
    minWidth: 26,
    paddingHorizontal: 5,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laneActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  laneActionBtn: {
    minHeight: 24,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  safetyCard: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
    gap: 6,
    overflow: 'visible',
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  safetySave: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
