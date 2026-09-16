import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CATALOG } from '../model/catalog'
import { TEMPLATES } from '../model/templates'
import { computeLayout, useCorridor, useDrag } from '../store/corridor'
import { colors } from '../theme/tokens'
import { useTheme } from '../store/theme'
import { makeUiStyles } from './uiStyles'
import { chime, tap } from '../lib/feedback'

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
  const applyTemplate = useCorridor((s) => s.applyTemplate)
  const reset = useCorridor((s) => s.reset)

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.libSheet, { backgroundColor: c.sheetBg }]}>
        <View style={[styles.libBar, { borderBottomColor: c.hair }]}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Corridors</Text>
          <Pressable style={u.ghostBtn} onPress={onClose}>
            <Text style={u.ghostText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
          <Text style={u.label}>Start from a template</Text>
          <View style={u.wrap}>
            {TEMPLATES.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.tpl, { backgroundColor: c.card, borderColor: c.hair }]}
                onPress={() => {
                  chime()
                  applyTemplate(t.id)
                  onClose()
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>{t.label}</Text>
                <Text style={{ color: c.text3, fontSize: 12 }}>{t.desc}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={u.label}>Saved</Text>
          <View style={u.wrap}>
            <Pressable
              style={u.primaryBtn}
              onPress={() => {
                chime()
                saveToLibrary()
              }}
            >
              <Text style={u.primaryText}>Save current corridor</Text>
            </Pressable>
            <Pressable
              style={u.btn}
              onPress={() => {
                tap()
                reset()
                onClose()
              }}
            >
              <Text style={u.btnText}>New empty corridor</Text>
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
                  {entry.doc.units.length} units · {entry.doc.lanes.length} lanes
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
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

export function CameraBar() {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const units = useCorridor((s) => s.units)
  const gaps = useCorridor((s) => s.gaps)
  const flyTo = useCorridor((s) => s.flyTo)

  if (!units.length) return null

  const go = (kind: 'fit' | 'plan' | 'front' | 'eye') => {
    tap()
    const l = computeLayout(units, gaps)
    const w = Math.max(l.width, 1.2)
    if (kind === 'plan') flyTo([l.centerX, Math.max(w * 1.15, 3.2), 0.001], [l.centerX, 0, 0])
    else if (kind === 'front') flyTo([l.centerX, 1.0, Math.max(w * 0.95, 2.6)], [l.centerX, 0.55, 0])
    else if (kind === 'eye') flyTo([l.centerX, 1.62, Math.max(w * 0.5, 1.6)], [l.centerX, 1.2, -2])
    else {
      const d = Math.max(w * 1.05, 3.2)
      flyTo([l.centerX + d * 0.18, d * 0.5, d * 0.92], [l.centerX, 0.45, 0])
    }
  }

  return (
    <View style={[styles.cambar, { backgroundColor: c.chrome }]}>
      {(['fit', 'plan', 'front', 'eye'] as const).map((k) => (
        <Pressable key={k} onPress={() => go(k)} style={styles.camBtn}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>
            {k === 'eye' ? 'Eye' : k[0].toUpperCase() + k.slice(1)}
          </Text>
        </Pressable>
      ))}
    </View>
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
  cmItem: { paddingHorizontal: 16, paddingVertical: 12 },
  libSheet: { flex: 1, marginTop: 40, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  libBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tpl: {
    width: '47%',
    flexGrow: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
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
  cambar: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    gap: 2,
  },
  camBtn: { paddingHorizontal: 12, paddingVertical: 8 },
})
