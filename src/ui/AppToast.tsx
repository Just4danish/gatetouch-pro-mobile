import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../store/theme'
import { useToast, type ToastKind, type ToastPayload } from '../store/toast'
import { colors, type ThemeColors } from '../theme/tokens'

const LABELS: Record<ToastKind, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
  success: 'Success',
}

const tone = (kind: ToastKind, c: ThemeColors) => {
  switch (kind) {
    case 'error':
      return { bar: c.red, label: c.redFg, border: c.tintRedBd }
    case 'warning':
      return { bar: c.orange, label: c.orangeFg, border: c.tintOrangeBd }
    case 'success':
      return { bar: c.green, label: c.greenFg, border: 'rgba(48, 209, 88, 0.35)' }
    default:
      return { bar: c.accent, label: c.accentFg, border: c.tintBlueBd }
  }
}

export function AppToast() {
  const insets = useSafeAreaInsets()
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const toast = useToast((s) => s.toast)
  const [display, setDisplay] = useState<ToastPayload | null>(null)
  const progress = useSharedValue(0)

  useEffect(() => {
    if (toast) {
      setDisplay(toast)
      progress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
      return
    }
    progress.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setDisplay)(null)
    })
  }, [toast, progress])

  const anim = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -12 }],
  }))

  if (!display) return null

  const t = tone(display.kind, c)

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        anim,
        {
          top: Math.max(12, insets.top + 10),
          backgroundColor: theme === 'dark' ? 'rgba(28, 30, 36, 0.96)' : 'rgba(255, 255, 255, 0.97)',
          borderColor: t.border,
          shadowColor: '#000',
        },
      ]}
      accessibilityLiveRegion="polite"
      testID="app.toast"
    >
      <View style={[styles.bar, { backgroundColor: t.bar }]} />
      <View style={styles.body}>
        <Text style={[styles.label, { color: t.label }]}>{LABELS[display.kind]}</Text>
        <Text style={[styles.message, { color: c.text }]} numberOfLines={3}>
          {display.message}
        </Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  bar: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
})
