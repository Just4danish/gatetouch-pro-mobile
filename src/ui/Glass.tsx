import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

/** Opaque glass-style chrome. BlurView is skipped — it breaks Expo Go Android. */
export function Glass({
  children,
  style,
  overlay,
}: {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  theme?: unknown
  overlay: string
  intensity?: number
}) {
  return <View style={[styles.clip, { backgroundColor: overlay }, style]}>{children}</View>
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
})
