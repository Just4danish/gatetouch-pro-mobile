import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { tap } from '../lib/feedback'
import { colors } from '../theme/tokens'
import { useTheme } from '../store/theme'

export interface RailItem {
  id: string
  label: string
  sub: string
  flipped?: boolean
}

interface Props {
  items: RailItem[]
  selectedId: string | null
  multi: string[]
  multiMode: boolean
  onSelect: (id: string) => void
  onToggleMulti: (id: string) => void
  onReorder: (from: number, to: number) => void
  onNudge: (id: string, dir: -1 | 1) => void
  onHold: (id: string, x: number, y: number) => void
}

export function Rail({
  items,
  selectedId,
  multi,
  multiMode,
  onSelect,
  onToggleMulti,
  onNudge,
  onHold,
}: Props) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)

  const clearHold = () => {
    if (hold.current) {
      clearTimeout(hold.current)
      hold.current = null
    }
  }

  if (!items.length) {
    return <Text style={[styles.empty, { color: c.text3 }]}>Tap a model above to add it.</Text>
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {items.map((it, i) => {
        const sel = it.id === selectedId && !multiMode
        const isMulti = multi.includes(it.id)
        return (
          <Pressable
            key={it.id}
            onPressIn={() => {
              setPressed(it.id)
              clearHold()
              hold.current = setTimeout(() => {
                hold.current = null
                onHold(it.id, 40 + i * 120, 200)
              }, 500)
            }}
            onPressOut={clearHold}
            onPress={() => {
              clearHold()
              tap()
              if (multiMode) onToggleMulti(it.id)
              else onSelect(it.id)
            }}
            style={[
              styles.chip,
              {
                backgroundColor: sel || isMulti ? c.accentTint : c.card,
                borderColor: sel ? c.accent : isMulti ? c.orange : c.hair,
                opacity: pressed === it.id ? 0.85 : 1,
              },
            ]}
          >
            <View style={[styles.pos, { backgroundColor: c.fill2 }]}>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>
                {multiMode && isMulti ? 'Y' : i + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>
                {it.label}
                {it.flipped ? ' (flip)' : ''}
              </Text>
              <Text style={{ color: c.text3, fontSize: 11 }}>{it.sub}</Text>
            </View>
            <View style={styles.tools}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.()
                  onNudge(it.id, -1)
                }}
                style={[styles.nudge, { backgroundColor: c.fill2 }]}
              >
                <Text style={{ color: c.text }}>{'<'}</Text>
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.()
                  onNudge(it.id, 1)
                }}
                style={[styles.nudge, { backgroundColor: c.fill2 }]}
              >
                <Text style={{ color: c.text }}>{'>'}</Text>
              </Pressable>
            </View>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  rail: { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 160,
  },
  pos: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tools: { flexDirection: 'row', gap: 4 },
  nudge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { fontSize: 13, paddingVertical: 16, textAlign: 'center' },
})
