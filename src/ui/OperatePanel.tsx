import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useCorridor } from '../store/corridor'
import { colors } from '../theme/tokens'
import { useTheme } from '../store/theme'
import { makeUiStyles } from './uiStyles'
import { buzz, chime, tap, thud, whoosh } from '../lib/feedback'

const MODE_LABEL: Record<string, string> = {
  badge: 'Badge',
  free: 'Free pass',
  locked: 'Locked',
  noentry: 'No entry',
}

export function useLaneTicker(): number {
  const tick = useCorridor((s) => s.tick)
  const pulsing = useCorridor((s) => s.lanes.some((l) => l.openedAt != null))
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!pulsing) return
    const h = setInterval(() => {
      tick()
      setNow(Date.now())
    }, 120)
    return () => clearInterval(h)
  }, [pulsing, tick])

  return now
}

function SlideToConfirm({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const [p, setP] = useState(0)
  const dragging = useRef(false)
  const trackW = useRef(280)

  const move = (x: number, left: number, width: number) => {
    const frac = Math.max(0, Math.min(1, (x - left - 28) / (width - 56)))
    setP(frac)
    if (frac > 0.985) {
      dragging.current = false
      setP(0)
      onConfirm()
    }
  }

  return (
    <View
      style={[styles.slide, { backgroundColor: c.tintRedBg, borderColor: c.tintRedBd }]}
      onLayout={(e) => {
        trackW.current = e.nativeEvent.layout.width
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        dragging.current = true
        move(e.nativeEvent.pageX, e.nativeEvent.pageX - e.nativeEvent.locationX, trackW.current)
      }}
      onResponderMove={(e) => {
        if (!dragging.current) return
        move(e.nativeEvent.pageX, e.nativeEvent.pageX - e.nativeEvent.locationX, trackW.current)
      }}
      onResponderRelease={() => {
        dragging.current = false
        setP(0)
      }}
    >
      <View style={[styles.slideFill, { width: p * trackW.current, backgroundColor: c.red }]} />
      <Text style={[styles.slideLabel, { color: c.tintRedFg }]}>{label}</Text>
      <View
        style={[
          styles.slideThumb,
          { left: 4 + p * Math.max(0, trackW.current - 56), backgroundColor: '#fff' },
        ]}
      >
        <Text style={{ color: '#111', fontWeight: '700' }}>{'>'}</Text>
      </View>
    </View>
  )
}

export function OperatePanel() {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)
  const lanes = useCorridor((s) => s.lanes)
  const requestLane = useCorridor((s) => s.requestLane)
  const openAll = useCorridor((s) => s.openAll)
  const closeAll = useCorridor((s) => s.closeAll)
  const emergencyRelease = useCorridor((s) => s.emergencyRelease)
  const select = useCorridor((s) => s.select)
  const now = useLaneTicker()

  if (!lanes.length) {
    return (
      <View style={u.panel}>
        <Text style={u.empty}>No lanes yet. Switch to Build, add turnstiles and create lanes.</Text>
      </View>
    )
  }

  return (
    <ScrollView style={u.panel} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
      <View style={u.row}>
        <Text style={[u.sectionTitle, { flex: 1 }]}>Tap a lane to open or close</Text>
        <Pressable
          style={u.ghostBtn}
          onPress={() => {
            thud()
            closeAll()
          }}
        >
          <Text style={u.ghostText}>Close all</Text>
        </Pressable>
        <Pressable
          style={u.ghostBtn}
          onPress={() => {
            whoosh()
            openAll()
          }}
        >
          <Text style={u.ghostText}>Open all</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {lanes.map((l) => {
          const blocked = l.mode === 'locked' || l.mode === 'noentry'
          const remain =
            l.openedAt != null ? Math.max(0, l.holdSec * 1000 - (now - l.openedAt)) : null
          return (
            <Pressable
              key={l.id}
              style={[
                styles.opLane,
                {
                  borderColor: l.color,
                  backgroundColor: l.open ? c.tintBlueBg : c.card,
                },
              ]}
              onPress={() => {
                if (blocked) buzz()
                else if (l.open) thud()
                else whoosh()
                requestLane(l.id)
              }}
              onLongPress={() => select({ kind: 'lane', id: l.id })}
            >
              <View style={u.row}>
                <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>
                  {l.name}
                  {l.accessible ? ' A' : ''}
                </Text>
                {remain != null && (
                  <Text style={{ color: c.accentFg, fontWeight: '700' }}>{Math.ceil(remain / 1000)}s</Text>
                )}
              </View>
              <Text
                style={{
                  color: blocked ? c.redFg : l.open ? c.greenFg : c.text2,
                  fontWeight: '800',
                  fontSize: 16,
                  marginTop: 4,
                }}
              >
                {blocked ? MODE_LABEL[l.mode].toUpperCase() : l.open ? 'OPEN' : 'CLOSED'}
              </Text>
              <Text style={{ color: c.text3, fontSize: 11, marginTop: 2 }}>
                {MODE_LABEL[l.mode]} ·{' '}
                {l.direction === 'both' ? 'both ways' : l.direction === 'in' ? 'entry' : 'exit'} ·{' '}
                {l.members.length}w
              </Text>
            </Pressable>
          )
        })}
      </View>

      <SlideToConfirm
        label="Slide to release all lanes — emergency"
        onConfirm={() => {
          chime()
          tap()
          emergencyRelease()
        }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opLane: {
    width: '48%',
    minWidth: 140,
    flexGrow: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
  },
  slide: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    marginTop: 4,
  },
  slideFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.25,
  },
  slideLabel: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  slideThumb: {
    position: 'absolute',
    top: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
