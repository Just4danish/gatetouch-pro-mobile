import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  CATALOG,
  ENVS,
  ENV_ORDER,
  FINISHES,
  FINISH_ORDER,
  GLASSES,
  GLASS_ORDER,
  UNIT_ORDER,
  type UnitType,
} from '../model/catalog'
import { laneClearMm, useCorridor, useDrag, type CrowdLevel } from '../store/corridor'
import { useTheme, type ThemePref } from '../store/theme'
import { colors } from '../theme/tokens'
import { Rail, type RailItem } from './Rail'
import { ColorPalette } from './ColorPalette'
import { makeUiStyles } from './uiStyles'
import { tap } from '../lib/feedback'

type Tab = 'layout' | 'lanes' | 'look'

function PaletteCard({ type }: { type: UnitType }) {
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const start = useDrag((s) => s.start)
  const move = useDrag((s) => s.move)
  const clear = useDrag((s) => s.clear)
  const dragging = useDrag((s) => s.type === type)
  const insertUnit = useCorridor((s) => s.insertUnit)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)
  const spec = CATALOG[type]

  return (
    <Pressable
      style={[
        styles.palCard,
        {
          backgroundColor: c.card,
          borderColor: dragging ? c.accent : c.hair,
          opacity: dragging ? 0.7 : 1,
        },
      ]}
      onPressIn={(e) => {
        const { pageX, pageY } = e.nativeEvent
        origin.current = { x: pageX, y: pageY }
        moved.current = false
        start(type, pageX, pageY)
      }}
      onPressOut={() => {
        if (!origin.current) return
        const idx = useDrag.getState().index
        tap()
        if (!moved.current) insertUnit(type)
        else if (idx != null) insertUnit(type, idx)
        clear()
        origin.current = null
      }}
      onTouchMove={(e) => {
        if (!origin.current) return
        const t = e.nativeEvent.touches[0]
        if (!t) return
        if (!moved.current && Math.hypot(t.pageX - origin.current.x, t.pageY - origin.current.y) > 8) {
          moved.current = true
        }
        move(t.pageX, t.pageY)
      }}
    >
      <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{spec.short}</Text>
      <Text style={{ color: c.text3, fontSize: 11 }}>{spec.subtitle}</Text>
      <Text style={{ color: c.accentFg, fontSize: 10, marginTop: 4 }}>Tap or drag into world</Text>
    </Pressable>
  )
}

export function BuildPanel({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const [tab, setTab] = useState<Tab>('layout')
  const [multiMode, setMultiMode] = useState(false)
  const theme = useTheme((s) => s.theme)
  const c = colors(theme)
  const u = makeUiStyles(c)

  const units = useCorridor((s) => s.units)
  const lanes = useCorridor((s) => s.lanes)
  const gaps = useCorridor((s) => s.gaps)
  const sel = useCorridor((s) => s.sel)
  const multi = useCorridor((s) => s.multi)
  const selectedLaneIds = useCorridor((s) => s.selectedLaneIds)

  const select = useCorridor((s) => s.select)
  const toggleMulti = useCorridor((s) => s.toggleMulti)
  const clearMulti = useCorridor((s) => s.clearMulti)
  const reorder = useCorridor((s) => s.reorder)
  const nudgeUnit = useCorridor((s) => s.nudgeUnit)
  const removeMany = useCorridor((s) => s.removeMany)
  const duplicateMany = useCorridor((s) => s.duplicateMany)
  const openContextMenu = useCorridor((s) => s.openContextMenu)

  const autoLanes = useCorridor((s) => s.autoLanes)
  const toggleLaneSelected = useCorridor((s) => s.toggleLaneSelected)
  const mergeSelectedLanes = useCorridor((s) => s.mergeSelectedLanes)

  const led = useCorridor((s) => s.led)
  const setLed = useCorridor((s) => s.setLed)
  const finish = useCorridor((s) => s.finish)
  const glass = useCorridor((s) => s.glass)
  const setFinish = useCorridor((s) => s.setFinish)
  const setGlass = useCorridor((s) => s.setGlass)
  const env = useCorridor((s) => s.env)
  const setEnv = useCorridor((s) => s.setEnv)
  const showDims = useCorridor((s) => s.showDims)
  const toggleDims = useCorridor((s) => s.toggleDims)
  const crowd = useCorridor((s) => s.crowd)
  const setCrowd = useCorridor((s) => s.setCrowd)
  const themePref = useTheme((s) => s.pref)
  const setThemePref = useTheme((s) => s.setPref)

  const railItems: RailItem[] = units.map((unit) => ({
    id: unit.id,
    label: CATALOG[unit.type].short,
    sub: `${CATALOG[unit.type].bodyMm} mm`,
    flipped: unit.flipped,
  }))

  return (
    <ScrollView style={u.panel} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
      <View style={u.subtabs}>
        {(['layout', 'lanes', 'look'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[u.tabBtn, tab === t && u.tabBtnOn]}
            onPress={() => {
              tap()
              setTab(t)
            }}
          >
            <Text style={[u.tabText, tab === t && u.tabTextOn]}>
              {t === 'layout' ? 'Layout' : t === 'lanes' ? 'Lanes' : 'Look'}
            </Text>
          </Pressable>
        ))}
        <View style={u.spacer} />
        <Pressable style={u.ghostBtn} onPress={onOpenLibrary}>
          <Text style={u.ghostText}>Corridors</Text>
        </Pressable>
      </View>

      {tab === 'layout' && (
        <>
          <View style={styles.palette}>
            {UNIT_ORDER.map((t) => (
              <PaletteCard key={t} type={t} />
            ))}
          </View>
          <Text style={u.sectionTitle}>The line</Text>
          <Text style={u.hint}>Tap to select · long-press for options · use arrows to reorder</Text>
          <Rail
            items={railItems}
            selectedId={sel?.kind === 'unit' ? sel.id : null}
            multi={multi}
            multiMode={multiMode}
            onSelect={(id) => select({ kind: 'unit', id })}
            onToggleMulti={toggleMulti}
            onReorder={reorder}
            onNudge={nudgeUnit}
            onHold={(id, x, y) => openContextMenu(id, x, y)}
          />
          <View style={u.wrap}>
            <Pressable
              style={[u.btn, multiMode && u.primaryBtn]}
              onPress={() => {
                tap()
                setMultiMode(!multiMode)
                clearMulti()
              }}
            >
              <Text style={multiMode ? u.primaryText : u.btnText}>
                {multiMode ? 'Done selecting' : 'Select multiple'}
              </Text>
            </Pressable>
            {multiMode && (
              <>
                <Pressable
                  style={[u.btn, !multi.length && u.btnDisabled]}
                  disabled={!multi.length}
                  onPress={() => duplicateMany(multi)}
                >
                  <Text style={u.btnText}>Duplicate ({multi.length})</Text>
                </Pressable>
                <Pressable
                  style={[u.dangerBtn, !multi.length && u.btnDisabled]}
                  disabled={!multi.length}
                  onPress={() => removeMany(multi)}
                >
                  <Text style={u.dangerText}>Remove ({multi.length})</Text>
                </Pressable>
              </>
            )}
            <Pressable style={[u.btn, showDims && u.primaryBtn]} onPress={toggleDims}>
              <Text style={showDims ? u.primaryText : u.btnText}>Dimensions</Text>
            </Pressable>
          </View>
        </>
      )}

      {tab === 'lanes' && (
        <>
          <View style={u.wrap}>
            <Pressable style={u.btn} onPress={autoLanes}>
              <Text style={u.btnText}>Auto (one per wing)</Text>
            </Pressable>
            <Pressable
              style={[u.primaryBtn, selectedLaneIds.length < 2 && u.btnDisabled]}
              disabled={selectedLaneIds.length < 2}
              onPress={mergeSelectedLanes}
            >
              <Text style={u.primaryText}>Group selected ({selectedLaneIds.length})</Text>
            </Pressable>
          </View>
          <Text style={u.hint}>Tap a lane to edit · tick two and Group to pair them</Text>
          {lanes.length === 0 && <Text style={u.empty}>Add turnstiles, then tap Auto.</Text>}
          <View style={u.wrap}>
            {lanes.map((l) => {
              const clear = laneClearMm(l, units, gaps)
              const isSel = selectedLaneIds.includes(l.id)
              return (
                <View
                  key={l.id}
                  style={[
                    styles.laneChip,
                    { borderColor: l.color, backgroundColor: isSel ? c.accentTint : c.card },
                  ]}
                >
                  <Pressable
                    style={[styles.tick, { backgroundColor: c.fill2 }]}
                    onPress={() => {
                      tap()
                      toggleLaneSelected(l.id)
                    }}
                  >
                    <Text style={{ color: c.text }}>{isSel ? 'Y' : ''}</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                      tap()
                      select({ kind: 'lane', id: l.id })
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>
                      {l.name}
                      {l.accessible ? ' A' : ''}
                    </Text>
                    <Text style={{ color: c.text3, fontSize: 11 }}>
                      {l.members.length}w{clear != null ? ` · ${Math.round(clear)}mm` : ''}
                    </Text>
                  </Pressable>
                </View>
              )
            })}
          </View>
        </>
      )}

      {tab === 'look' && (
        <>
          <Text style={u.label}>Cabinet finish</Text>
          <View style={u.wrap}>
            {FINISH_ORDER.map((f) => (
              <Pressable
                key={f}
                style={[u.chip, finish === f && u.chipOn]}
                onPress={() => {
                  tap()
                  setFinish(f)
                }}
              >
                <View style={[styles.dot, { backgroundColor: FINISHES[f].color }]} />
                <Text style={u.chipText}>{FINISHES[f].label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={u.label}>Glass</Text>
          <View style={u.wrap}>
            {GLASS_ORDER.map((g) => (
              <Pressable
                key={g}
                style={[u.chip, glass === g && u.chipOn]}
                onPress={() => {
                  tap()
                  setGlass(g)
                }}
              >
                <View style={[styles.dot, { backgroundColor: GLASSES[g].color }]} />
                <Text style={u.chipText}>{GLASSES[g].label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={u.label}>LED — whole corridor</Text>
          <ColorPalette value={led} onChange={setLed} />

          <Text style={u.label}>Appearance</Text>
          <View style={u.wrap}>
            {(
              [
                ['auto', 'Auto'],
                ['light', 'Light'],
                ['dark', 'Dark'],
              ] as [ThemePref, string][]
            ).map(([p, label]) => (
              <Pressable
                key={p}
                style={[u.chip, themePref === p && u.chipOn]}
                onPress={() => {
                  tap()
                  setThemePref(p)
                }}
              >
                <Text style={u.chipText}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={u.label}>Environment</Text>
          <View style={u.wrap}>
            {ENV_ORDER.map((e) => (
              <Pressable
                key={e}
                style={[u.chip, env === e && u.chipOn]}
                onPress={() => {
                  tap()
                  setEnv(e)
                }}
              >
                <Text style={u.chipText}>{ENVS[e].label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={u.label}>People (v1 stub)</Text>
          <View style={u.wrap}>
            {(['off', 'few', 'busy'] as CrowdLevel[]).map((cl) => (
              <Pressable
                key={cl}
                style={[u.chip, crowd === cl && u.chipOn]}
                onPress={() => {
                  tap()
                  setCrowd(cl)
                }}
              >
                <Text style={u.chipText}>{cl === 'off' ? 'Off' : cl === 'few' ? 'A few' : 'Busy'}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={u.hint}>Crowd characters are not loaded in this build.</Text>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  palette: { flexDirection: 'row', gap: 8 },
  palCard: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 100,
  },
  laneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: 2,
    minWidth: 140,
  },
  tick: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
})
