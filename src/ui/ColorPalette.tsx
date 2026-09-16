import { Pressable, Text, View, StyleSheet } from 'react-native'
import { LED_BEHAVIORS, LED_SWATCHES, type LedConfig } from '../model/catalog'
import { colors } from '../theme/tokens'
import { useTheme } from '../store/theme'
import { tap } from '../lib/feedback'

interface Props {
  value: LedConfig
  onChange: (led: LedConfig) => void
  onClear?: () => void
  clearLabel?: string
}

export function ColorPalette({ value, onChange, onClear, clearLabel }: Props) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)

  return (
    <View style={styles.wrap}>
      <View style={styles.swatches}>
        {LED_SWATCHES.map((hex) => {
          const sel = value.color.toLowerCase() === hex.toLowerCase()
          return (
            <Pressable
              key={hex}
              onPress={() => {
                tap()
                onChange({ ...value, color: hex })
              }}
              style={[
                styles.swatch,
                { backgroundColor: hex },
                sel && { borderColor: c.text, borderWidth: 2 },
              ]}
            />
          )
        })}
      </View>

      <View style={styles.row}>
        <Text style={{ color: c.text2, fontSize: 12, width: 72 }}>Brightness</Text>
        <Pressable
          style={[styles.step, { backgroundColor: c.fill2 }]}
          onPress={() => onChange({ ...value, intensity: Math.max(0.2, +(value.intensity - 0.2).toFixed(1)) })}
        >
          <Text style={{ color: c.text }}>-</Text>
        </Pressable>
        <Text style={{ color: c.text, width: 40, textAlign: 'center' }}>{value.intensity.toFixed(1)}x</Text>
        <Pressable
          style={[styles.step, { backgroundColor: c.fill2 }]}
          onPress={() => onChange({ ...value, intensity: Math.min(4, +(value.intensity + 0.2).toFixed(1)) })}
        >
          <Text style={{ color: c.text }}>+</Text>
        </Pressable>
      </View>

      <View style={styles.behaviors}>
        {LED_BEHAVIORS.map((b) => {
          const on = value.behavior === b.id
          return (
            <Pressable
              key={b.id}
              onPress={() => {
                tap()
                onChange({ ...value, behavior: b.id })
              }}
              style={[
                styles.chip,
                { backgroundColor: on ? c.accentTint : c.surface, borderColor: on ? c.accent : 'transparent' },
              ]}
            >
              <Text style={{ color: c.text, fontSize: 13 }}>{b.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {onClear && (
        <Pressable onPress={onClear}>
          <Text style={{ color: c.accentFg, fontSize: 13, marginTop: 4 }}>
            {clearLabel ?? 'Use corridor default'}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  behaviors: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
})
