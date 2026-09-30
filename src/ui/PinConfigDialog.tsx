import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../store/theme'
import { colors } from '../theme/tokens'
import { tap } from '../lib/feedback'

export const PIN_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1)

type PinConfigDialogProps = {
  open: boolean
  modelName: string
  confirming?: boolean
  onConfirm: (entryPin: number | null, exitPin: number | null) => void
  onCancel: () => void
}

export function PinConfigDialog({
  open,
  modelName,
  confirming,
  onConfirm,
  onCancel,
}: PinConfigDialogProps) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const [entryPin, setEntryPin] = useState<number | null>(null)
  const [exitPin, setExitPin] = useState<number | null>(null)
  const [openMenu, setOpenMenu] = useState<'entry' | 'exit' | null>(null)
  const canAdd = entryPin != null || exitPin != null

  useEffect(() => {
    if (!open) return
    setEntryPin(null)
    setExitPin(null)
    setOpenMenu(null)
  }, [open, modelName])

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          style={[
            styles.backdrop,
            { backgroundColor: theme === 'dark' ? 'rgba(8,10,14,0.55)' : 'rgba(20,24,32,0.32)' },
          ]}
          onPress={onCancel}
          accessibilityLabel="Dismiss"
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme === 'dark' ? c.panel : c.sheetBg,
              borderColor: c.hair,
              shadowColor: '#000',
            },
          ]}
        >
          <Text style={[styles.title, { color: c.text }]}>Pin configuration</Text>
          <Text style={[styles.message, { color: c.text2 }]}>
            Choose an entry pin, an exit pin, or both for {modelName}.
          </Text>

          <PinDropdown
            label="Entry pin"
            value={entryPin}
            placeholder="Select a pin"
            allowNone
            open={openMenu === 'entry'}
            testID="build.pin.entry"
            onToggle={() => {
              tap()
              setOpenMenu((m) => (m === 'entry' ? null : 'entry'))
            }}
            onSelect={(n) => {
              tap()
              setEntryPin(n)
              setOpenMenu(null)
            }}
          />

          <PinDropdown
            label="Exit pin"
            value={exitPin}
            placeholder="Select a pin"
            allowNone
            open={openMenu === 'exit'}
            testID="build.pin.exit"
            onToggle={() => {
              tap()
              setOpenMenu((m) => (m === 'exit' ? null : 'exit'))
            }}
            onSelect={(n) => {
              tap()
              setExitPin(n)
              setOpenMenu(null)
            }}
          />

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, { backgroundColor: c.fill2, borderColor: c.hair, borderWidth: StyleSheet.hairlineWidth }]}
              testID="build.pin.cancel"
              disabled={confirming}
              onPress={onCancel}
            >
              <Text style={[styles.btnText, { color: c.text2 }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                { backgroundColor: c.accent },
                (confirming || !canAdd) && { opacity: 0.6 },
              ]}
              testID="build.pin.confirm"
              disabled={confirming || !canAdd}
              onPress={() => {
                if (!canAdd) return
                onConfirm(entryPin, exitPin)
              }}
            >
              <Text style={[styles.btnText, { color: c.onAccent }]}>
                {confirming ? 'Adding…' : 'Add'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export function PinDropdown({
  label,
  value,
  placeholder,
  open,
  compact,
  allowNone,
  testID,
  onToggle,
  onSelect,
}: {
  label: string
  value: number | null
  placeholder?: string
  open: boolean
  compact?: boolean
  /** When true, show a None row so the pin can stay unset (fire / emergency). */
  allowNone?: boolean
  testID: string
  onToggle: () => void
  onSelect: (n: number | null) => void
}) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const unset = value == null
  const shown = unset ? (placeholder ?? '') : String(value)

  return (
    <View style={[compact ? styles.fieldCompact : styles.field, open && styles.fieldOpen]}>
      <Text style={[compact ? styles.labelCompact : styles.label, { color: c.text3 }]}>{label}</Text>
      <Pressable
        style={[
          compact ? styles.selectCompact : styles.select,
          {
            backgroundColor: c.glass2,
            borderColor: open ? c.accent : c.hair,
          },
        ]}
        testID={testID}
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={onToggle}
      >
        <Text
          style={[
            compact ? styles.selectValueCompact : styles.selectValue,
            unset && styles.selectPlaceholder,
            { color: unset ? c.text3 : c.text, flex: 1 },
          ]}
          numberOfLines={1}
        >
          {shown}
        </Text>
        <Text style={{ color: c.text3, fontSize: compact ? 10 : 12, fontWeight: '700' }}>
          {open ? '▲' : '▼'}
        </Text>
      </Pressable>
      {open && (
        <View style={[styles.menu, compact && styles.menuCompact, { backgroundColor: c.glass2, borderColor: c.hair }]}>
          <ScrollView
            style={compact ? styles.menuScrollCompact : styles.menuScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {allowNone && (
              <Pressable
                style={[
                  compact ? styles.optionCompact : styles.option,
                  unset && { backgroundColor: c.accentTint },
                ]}
                testID={`${testID}.none`}
                onPress={() => onSelect(null)}
              >
                <Text
                  style={[
                    compact ? styles.optionTextCompact : styles.optionText,
                    { color: unset ? c.accentFg : c.text3, fontStyle: 'italic' },
                  ]}
                >
                  None
                </Text>
              </Pressable>
            )}
            {PIN_OPTIONS.map((n) => {
              const on = value != null && n === value
              return (
                <Pressable
                  key={n}
                  style={[compact ? styles.optionCompact : styles.option, on && { backgroundColor: c.accentTint }]}
                  testID={`${testID}.${n}`}
                  onPress={() => onSelect(n)}
                >
                  <Text
                    style={[
                      compact ? styles.optionTextCompact : styles.optionText,
                      { color: on ? c.accentFg : c.text },
                    ]}
                  >
                    {n}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    elevation: 10,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
  },
  field: {
    marginTop: 14,
    zIndex: 2,
  },
  fieldCompact: {
    flex: 1,
    minWidth: 0,
    zIndex: 2,
  },
  fieldOpen: {
    zIndex: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  labelCompact: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
    letterSpacing: 0.15,
  },
  select: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectCompact: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  selectValueCompact: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  selectPlaceholder: {
    fontWeight: '600',
    fontVariant: undefined,
  },
  menu: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 160,
    overflow: 'hidden',
  },
  menuCompact: {
    marginTop: 4,
    borderRadius: 10,
    maxHeight: 132,
  },
  menuScroll: {
    maxHeight: 160,
  },
  menuScrollCompact: {
    maxHeight: 132,
  },
  option: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  optionCompact: {
    minHeight: 34,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  optionTextCompact: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
