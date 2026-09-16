import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
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

function CountdownRing({ frac, seconds, green, raise, card }: { frac: number; seconds: number; green: string; raise: string; card: string }) {
  const r = 11
  const c = 2 * Math.PI * r
  return (
    <View style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={30} height={30} style={StyleSheet.absoluteFill}>
        <Circle cx={15} cy={15} r={r} stroke={raise} strokeWidth={4} fill={card} />
        <Circle
          cx={15}
          cy={15}
          r={r}
          stroke={green}
          strokeWidth={4}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, frac)))}
          rotation={-90}
          origin="15,15"
        />
      </Svg>
      <Text style={{ fontSize: 11, fontWeight: '700', color: green }}>{seconds}</Text>
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
  const setMode = useCorridor((s) => s.setMode)
  const now = useLaneTicker()
  const [confirmEmergency, setConfirmEmergency] = useState(false)

  if (!lanes.length) {
    return (
      <View style={[u.panel, { gap: 12 }]}>
        <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
          No lanes yet
        </Text>
        <Text style={[u.empty, { borderStyle: 'dashed' }]}>
          Switch to Build, create a lane group, then place turnstile equipment. Lanes are created automatically.
        </Text>
        <Pressable
          style={u.primaryBtn}
          testID="operate.empty.build"
          accessibilityLabel="Switch to Build"
          onPress={() => {
            tap()
            setMode('build')
          }}
        >
          <Text style={u.primaryText}>Switch to Build</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={[u.panel, { gap: 16 }]}>
      <View style={u.row}>
        <Text style={[u.sectionTitle, { flex: 1 }]}>Lanes</Text>
        <Pressable
          style={u.ghostBtn}
          testID="operate.lanes.closeAll"
          accessibilityLabel="Close all lanes"
          onPress={() => {
            thud()
            closeAll()
          }}
        >
          <Text style={u.ghostText}>Close all</Text>
        </Pressable>
        <Pressable
          style={u.ghostBtn}
          testID="operate.lanes.openAll"
          accessibilityLabel="Open all lanes"
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
          const frac = remain != null ? remain / (l.holdSec * 1000) : 0
          return (
            <Pressable
              key={l.id}
              style={[
                styles.opLane,
                {
                  borderColor: blocked ? c.tintOrangeBd : l.open ? c.green : c.tintRedBd,
                  backgroundColor: blocked ? c.tintOrangeBg : l.open ? 'rgba(48, 209, 88, 0.15)' : c.tintRedBg,
                },
              ]}
              testID={`operate.lane.${l.id}`}
              accessibilityLabel={l.name}
              onPress={() => {
                if (blocked) buzz()
                else if (l.open) thud()
                else whoosh()
                requestLane(l.id)
              }}
              onLongPress={() => select({ kind: 'lane', id: l.id })}
            >
              <View style={[styles.laneDot, { backgroundColor: l.color }]} />
              <View style={u.row}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 19, flex: 1 }}>
                  {l.name}
                  {l.accessible ? <Text style={{ color: c.accentFg }}> ♿</Text> : ''}
                </Text>
                {remain != null && (
                  <CountdownRing
                    frac={frac}
                    seconds={Math.ceil(remain / 1000)}
                    green={c.green}
                    raise={c.raise}
                    card={c.card}
                  />
                )}
              </View>
              <Text
                style={{
                  color: blocked ? c.orangeFg : l.open ? c.greenFg : c.redFg,
                  fontWeight: '700',
                  fontSize: 15,
                  letterSpacing: 0.8,
                }}
              >
                {blocked ? MODE_LABEL[l.mode].toUpperCase() : l.open ? 'OPEN' : 'CLOSED'}
              </Text>
              <Text style={{ color: c.text2, fontSize: 12, marginTop: 4 }}>
                {MODE_LABEL[l.mode]} ·{' '}
                {l.direction === 'both' ? '↔ bidirectional' : l.direction === 'in' ? 'Entry →' : '← Exit'}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Pressable
        style={[u.dangerBtn, { alignSelf: 'stretch', minHeight: 48 }]}
        testID="operate.emergency"
        accessibilityLabel="Emergency release"
        onPress={() => {
          tap()
          setConfirmEmergency(true)
        }}
      >
        <Text style={u.dangerText}>Emergency release…</Text>
      </Pressable>

      <Modal transparent visible={confirmEmergency} animationType="fade" onRequestClose={() => setConfirmEmergency(false)}>
        <Pressable style={styles.emDim} onPress={() => setConfirmEmergency(false)}>
          <View style={[styles.emCard, { backgroundColor: c.sheetBg, borderColor: c.hair }]}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 18 }}>Release all lanes?</Text>
            <Text style={{ color: c.text2, marginTop: 8, lineHeight: 20 }}>
              Every lane will open and switch to free passage. This cannot be undone from Operate.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable style={u.btn} onPress={() => setConfirmEmergency(false)}>
                <Text style={u.btnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={u.dangerBtn}
                testID="operate.emergency.confirm"
                onPress={() => {
                  chime()
                  emergencyRelease()
                  setConfirmEmergency(false)
                }}
              >
                <Text style={u.dangerText}>Confirm release</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  opLane: {
    width: '48%',
    minWidth: 160,
    flexGrow: 1,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 108,
    gap: 5,
  },
  laneDot: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  slide: {
    height: 56,
    borderRadius: 28,
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
  emDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emCard: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
