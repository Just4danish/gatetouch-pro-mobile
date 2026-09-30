import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../store/theme'
import { colors } from '../theme/tokens'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmTestID?: string
  cancelTestID?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmTestID,
  cancelTestID,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)

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
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          <Text style={[styles.message, { color: c.text2 }]}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, { backgroundColor: c.fill2, borderColor: c.hair, borderWidth: StyleSheet.hairlineWidth }]}
              testID={cancelTestID}
              onPress={onCancel}
            >
              <Text style={[styles.btnText, { color: c.text2 }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: c.accent }]}
              testID={confirmTestID}
              onPress={onConfirm}
            >
              <Text style={[styles.btnText, { color: c.onAccent }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
