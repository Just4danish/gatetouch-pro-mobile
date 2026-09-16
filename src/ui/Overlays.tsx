import { useMemo, useRef, useState } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CATALOG } from '../model/catalog'
import { formatClearCm, manufacturersOnDoc, groupSummary } from '../model/installation'
import { computeWorldLayout, gapAt, minGapMm, maxGapMm, useCorridor, useDrag } from '../store/corridor'
import { useHud } from '../store/hud'
import { colors } from '../theme/tokens'
import { useTheme } from '../store/theme'
import { makeUiStyles } from './uiStyles'
import { Glass } from './Glass'
import { chime, tap, thud } from '../lib/feedback'
import { IconEye, IconFit, IconFront, IconPlan } from './Icons'

export function DragGhost() {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const type = useDrag((s) => s.type)
  const x = useDrag((s) => s.clientX)
  const y = useDrag((s) => s.clientY)
  const index = useDrag((s) => s.index)
  if (!type) return null
  return (
    <View
      pointerEvents="none"
      style={[
        styles.ghost,
        {
          left: x - 60,
          top: y - 36,
          backgroundColor: c.chrome,
          borderColor: index != null ? c.accent : c.hair,
        },
      ]}
    >
      <Text style={{ color: c.text, fontWeight: '700' }}>{CATALOG[type].short}</Text>
      <Text style={{ color: c.text3, fontSize: 11 }}>
        {index != null ? 'release to place' : 'drag over the world'}
      </Text>
    </View>
  )
}

export function ContextMenu() {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const cm = useCorridor((s) => s.contextMenu)
  const close = useCorridor((s) => s.closeContextMenu)
  const flipUnit = useCorridor((s) => s.flipUnit)
  const duplicateMany = useCorridor((s) => s.duplicateMany)
  const removeUnit = useCorridor((s) => s.removeUnit)
  const select = useCorridor((s) => s.select)
  if (!cm) return null

  const act = (fn: () => void) => () => {
    tap()
    fn()
    close()
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <Pressable style={styles.cmBackdrop} onPress={close}>
        <View
          style={[
            styles.cm,
            {
              left: Math.min(cm.x, 220),
              top: Math.min(cm.y, 400),
              backgroundColor: c.menu,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <Pressable style={styles.cmItem} onPress={act(() => select({ kind: 'unit', id: cm.unitId }))}>
            <Text style={{ color: c.text }}>Properties</Text>
          </Pressable>
          <Pressable
            style={styles.cmItem}
            onPress={act(() => {
              useCorridor.getState().setMultiSelectMode(true)
              useCorridor.getState().toggleMulti(cm.unitId)
            })}
          >
            <Text style={{ color: c.text }}>Select Multiple</Text>
          </Pressable>
          <Pressable style={styles.cmItem} onPress={act(() => flipUnit(cm.unitId))}>
            <Text style={{ color: c.text }}>Flip</Text>
          </Pressable>
          <Pressable style={styles.cmItem} onPress={act(() => duplicateMany([cm.unitId]))}>
            <Text style={{ color: c.text }}>Duplicate</Text>
          </Pressable>
          <Pressable style={styles.cmItem} onPress={act(() => removeUnit(cm.unitId))}>
            <Text style={{ color: c.redFg }}>Remove</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}

export function LibrarySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const library = useCorridor((s) => s.library)
  const saveToLibrary = useCorridor((s) => s.saveToLibrary)
  const loadFromLibrary = useCorridor((s) => s.loadFromLibrary)
  const deleteFromLibrary = useCorridor((s) => s.deleteFromLibrary)
  const duplicateFromLibrary = useCorridor((s) => s.duplicateFromLibrary)
  const reset = useCorridor((s) => s.reset)

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.libRoot}>
        <Pressable style={styles.libDim} onPress={onClose} accessibilityLabel="Close installation library" />
        <SafeAreaView edges={['bottom']} style={[styles.libSheet, { backgroundColor: c.sheetBg }]}>
          <View style={[styles.libBar, { borderBottomColor: c.hair }]}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Installation Library</Text>
            <Pressable style={u.ghostBtn} onPress={onClose} testID="library.close" accessibilityLabel="Close installation library">
              <Text style={u.ghostText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
            <Text style={u.label}>Saved</Text>
            <View style={u.wrap}>
              <Pressable
                style={u.primaryBtn}
                onPress={() => {
                  chime()
                  saveToLibrary()
                }}
              >
                <Text style={u.primaryText}>Save current installation</Text>
              </Pressable>
              <Pressable
                style={u.btn}
                onPress={() => {
                  tap()
                  reset()
                  onClose()
                }}
              >
                <Text style={u.btnText}>New installation</Text>
              </Pressable>
            </View>

            {library.length === 0 && <Text style={u.empty}>Nothing saved yet.</Text>}
            {library.map((entry) => (
              <View key={entry.id} style={[styles.libCard, { backgroundColor: c.card, borderColor: c.hair }]}>
                {entry.thumb ? (
                  <Image source={{ uri: entry.thumb }} style={styles.thumb} />
                ) : (
                  <View style={[styles.noThumb, { backgroundColor: c.surface }]}>
                    <Text style={{ color: c.text3, fontSize: 11 }}>no preview</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '700' }}>{entry.name}</Text>
                  <Text style={{ color: c.text3, fontSize: 12 }}>
                    {groupSummary(entry.doc.units, entry.doc.lanes, entry.doc.laneGroups[0]?.id ?? '').units
                      ? `${entry.doc.laneGroups?.length ?? 0} Lane Groups · ${entry.doc.lanes.length} Lanes`
                      : `${entry.doc.units.length} Units · ${entry.doc.lanes.length} Lanes`}
                    {manufacturersOnDoc(entry.doc.units).length ? ` · ${manufacturersOnDoc(entry.doc.units).join(', ')}` : ''}
                  </Text>
                  <Text style={{ color: c.text3, fontSize: 11 }}>
                    {new Date(entry.savedAt).toLocaleString()}
                  </Text>
                </View>
                <Pressable
                  style={u.btn}
                  onPress={() => {
                    tap()
                    loadFromLibrary(entry.id)
                    onClose()
                  }}
                >
                  <Text style={u.btnText}>Load</Text>
                </Pressable>
                <Pressable style={u.dangerBtn} onPress={() => deleteFromLibrary(entry.id)}>
                  <Text style={u.dangerText}>Delete</Text>
                </Pressable>
                <Pressable style={u.btn} onPress={() => duplicateFromLibrary(entry.id)}>
                  <Text style={u.btnText}>Copy</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

export function CameraBar() {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const units = useCorridor((s) => s.units)
  const gaps = useCorridor((s) => s.gaps)
  const laneGroups = useCorridor((s) => s.laneGroups)
  const flyTo = useCorridor((s) => s.flyTo)
  const fitSelection = useCorridor((s) => s.fitSelection)
  const camBarOn = useHud((s) => s.camBarOn)
  const camBarX = useHud((s) => s.camBarX)
  const camBarY = useHud((s) => s.camBarY)
  const setCamBarPos = useHud((s) => s.setCamBarPos)
  const { width: winW, height: winH } = useWindowDimensions()
  const [box, setBox] = useState({ w: 228, h: 52 })
  const [live, setLive] = useState<{ x: number; y: number } | null>(null)
  const origin = useRef({ x: camBarX, y: camBarY })
  const posRef = useRef({ x: camBarX, y: camBarY })
  const size = useRef(box)
  const win = useRef({ w: winW, h: winH })
  const persist = useRef(setCamBarPos)

  const x = live?.x ?? camBarX
  const y = live?.y ?? camBarY
  posRef.current = { x, y }
  size.current = box
  win.current = { w: winW, h: winH }
  persist.current = setCamBarPos

  const go = (kind: 'fit' | 'plan' | 'front' | 'eye') => {
    tap()
    if (kind === 'fit') {
      fitSelection()
      return
    }
    const l = computeWorldLayout(units, gaps, laneGroups)
    const w = Math.max(l.width, 1.2)
    if (kind === 'plan') flyTo([l.centerX, Math.max(w * 1.15, 3.2), l.centerZ + 0.001], [l.centerX, 0, l.centerZ])
    else if (kind === 'front') flyTo([l.centerX, 1.0, l.centerZ + Math.max(w * 0.95, 2.6)], [l.centerX, 0.55, l.centerZ])
    else flyTo([l.centerX, 1.62, l.centerZ + Math.max(w * 0.5, 1.6)], [l.centerX, 1.2, l.centerZ - 2])
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

  function onDragStart() {
    origin.current = { ...posRef.current }
    thud()
  }
  function onDragMove(tx: number, ty: number) {
    const maxX = Math.max(8, win.current.w - size.current.w - 8)
    const maxY = Math.max(8, win.current.h - size.current.h - 120)
    const next = {
      x: Math.min(Math.max(8, origin.current.x + tx), maxX),
      y: Math.min(Math.max(8, origin.current.y + ty), maxY),
    }
    posRef.current = next
    setLive(next)
  }
  function onDragEnd() {
    persist.current(posRef.current.x, posRef.current.y)
    setLive(null)
  }

  if (!camBarOn) return null

  return (
    <GestureDetector gesture={pan}>
      <View
        collapsable={false}
        style={[styles.cambarWrap, { left: x, top: y }]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          if (width > 0 && height > 0) setBox({ w: width, h: height })
        }}
        accessibilityHint="Long press and drag to move"
      >
        <Glass overlay={c.glass} style={[styles.cambar, { borderColor: c.hair }]}>
          {(
            [
              ['fit', 'Fit', IconFit],
              ['plan', 'Plan', IconPlan],
              ['front', 'Front', IconFront],
              ['eye', 'Eye', IconEye],
            ] as const
          ).map(([k, label, Icon]) => (
            <Pressable
              key={k}
              onPress={() => go(k)}
              style={styles.camBtn}
              testID={`app.cam.${k}`}
              accessibilityLabel={`${label} camera`}
            >
              <Icon color={c.text2} />
              <Text style={{ color: c.text2, fontSize: 11, fontWeight: '700' }}>{label}</Text>
            </Pressable>
          ))}
        </Glass>
      </View>
    </GestureDetector>
  )
}

export function DualUnitBar() {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const multi = useCorridor((s) => s.multi)
  const units = useCorridor((s) => s.units)
  const gaps = useCorridor((s) => s.gaps)
  const widthAnchor = useCorridor((s) => s.widthAnchor)
  const setWidthAnchor = useCorridor((s) => s.setWidthAnchor)
  const setClearWidthBetween = useCorridor((s) => s.setClearWidthBetween)
  const alignUnits = useCorridor((s) => s.alignUnits)
  const flipUnit = useCorridor((s) => s.flipUnit)
  const duplicateMany = useCorridor((s) => s.duplicateMany)
  const removeMany = useCorridor((s) => s.removeMany)
  const swapUnits = useCorridor((s) => s.swapUnits)
  const setMultiSelectMode = useCorridor((s) => s.setMultiSelectMode)
  const clearMulti = useCorridor((s) => s.clearMulti)
  const [editing, setEditing] = useState(false)
  const [typed, setTyped] = useState('')

  if (multi.length !== 2) return null
  const a = units.find((x) => x.id === multi[0])
  const b = units.find((x) => x.id === multi[1])
  if (!a || !b || a.groupId !== b.groupId) return null
  const members = units.filter((u) => u.groupId === a.groupId)
  const i = members.findIndex((u) => u.id === a.id)
  const j = members.findIndex((u) => u.id === b.id)
  if (Math.abs(i - j) !== 1) return null
  const left = i < j ? a : b
  const right = i < j ? b : a
  const idx = Math.min(i, j)
  const mm = gapAt(members, idx, gaps)
  const lo = minGapMm(left, right)
  const hi = maxGapMm(left, right)

  const apply = (next: number) => setClearWidthBetween(left.id, right.id, next)

  return (
    <Glass overlay={c.chrome} style={[styles.dual, { borderColor: c.hair }]}>
      <Text style={{ color: c.text, fontWeight: '800' }}>2 Units Selected</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <Pressable style={u.primaryBtn} onPress={() => setEditing((v) => !v)}>
          <Text style={u.primaryText}>Clear Width {formatClearCm(mm)}</Text>
        </Pressable>
        <Pressable style={u.btn} onPress={() => alignUnits([left.id, right.id])}>
          <Text style={u.btnText}>Align</Text>
        </Pressable>
        <Pressable
          style={u.btn}
          onPress={() => {
            flipUnit(left.id)
            flipUnit(right.id)
          }}
        >
          <Text style={u.btnText}>Flip</Text>
        </Pressable>
        <Pressable style={u.btn} onPress={() => swapUnits(left.id, right.id)}>
          <Text style={u.btnText}>Swap</Text>
        </Pressable>
        <Pressable style={u.btn} onPress={() => duplicateMany([left.id, right.id])}>
          <Text style={u.btnText}>Duplicate</Text>
        </Pressable>
        <Pressable style={u.dangerBtn} onPress={() => removeMany([left.id, right.id])}>
          <Text style={u.dangerText}>Delete</Text>
        </Pressable>
        <Pressable
          style={u.ghostBtn}
          onPress={() => {
            setMultiSelectMode(false)
            clearMulti()
          }}
        >
          <Text style={u.ghostText}>Done</Text>
        </Pressable>
      </View>
      {editing && (
        <View style={{ marginTop: 10, gap: 8 }}>
          <Text style={{ color: c.text3, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>CLEAR WIDTH</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable style={styles.step} onPress={() => apply(mm - 10)}>
              <Text style={{ color: c.text, fontSize: 20 }}>−</Text>
            </Pressable>
            <TextInput
              value={typed || String(Math.round(mm / 10))}
              onChangeText={setTyped}
              onEndEditing={() => {
                const cm = Number(typed)
                if (Number.isFinite(cm)) apply(cm * 10)
                setTyped('')
              }}
              keyboardType="number-pad"
              style={[styles.cmInput, { color: c.text, borderColor: c.hair }]}
            />
            <Text style={{ color: c.text2 }}>cm</Text>
            <Pressable style={styles.step} onPress={() => apply(mm + 10)}>
              <Text style={{ color: c.text, fontSize: 20 }}>+</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={u.btn} onPress={() => apply(mm - 50)}>
              <Text style={u.btnText}>−5 cm</Text>
            </Pressable>
            <Pressable style={u.btn} onPress={() => apply(mm + 50)}>
              <Text style={u.btnText}>+5 cm</Text>
            </Pressable>
            <Pressable
              style={[u.chip, widthAnchor === 'right' && u.chipOn]}
              onPress={() => setWidthAnchor('right')}
            >
              <Text style={u.chipText}>Move Right</Text>
            </Pressable>
            <Pressable
              style={[u.chip, widthAnchor === 'left' && u.chipOn]}
              onPress={() => setWidthAnchor('left')}
            >
              <Text style={u.chipText}>Move Left</Text>
            </Pressable>
            <Pressable
              style={[u.chip, widthAnchor === 'both' && u.chipOn]}
              onPress={() => setWidthAnchor('both')}
            >
              <Text style={u.chipText}>Both</Text>
            </Pressable>
          </View>
          <Text style={{ color: c.text3, fontSize: 11 }}>
            Range {formatClearCm(lo)} – {formatClearCm(hi)}
          </Text>
        </View>
      )}
    </Glass>
  )
}

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    zIndex: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 120,
  },
  cmBackdrop: { flex: 1 },
  cm: {
    position: 'absolute',
    minWidth: 160,
    borderRadius: 14,
    paddingVertical: 6,
    elevation: 8,
  },
  cmItem: { paddingHorizontal: 16, paddingVertical: 14, minHeight: 44, justifyContent: 'center' },
  libRoot: { flex: 1, justifyContent: 'flex-end' },
  libDim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  libSheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  libBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  libCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  thumb: { width: 56, height: 40, borderRadius: 8 },
  noThumb: {
    width: 56,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cambarWrap: {
    position: 'absolute',
    zIndex: 12,
  },
  cambar: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 2,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  camBtn: {
    minWidth: 52,
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 12,
  },
  dual: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 8,
  },
  step: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.18)',
  },
  cmInput: {
    minWidth: 72,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
})
