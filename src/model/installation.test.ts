/**
 * Self-running domain checks. `npx tsx src/model/installation.test.ts`
 */
import { migrateDoc, migrateSavedEntry, neighbourPassages, nextGroupName, syncNeighbourLanes, unitsForRecipe, formatClearCm, cmToMm, installationDisplayName, makeLaneGroup, insertIndexInGroup } from './installation'
import type { NeighbourPassage } from './installation'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(installationDisplayName('New corridor') === 'New installation', 'rename empty corridor')
assert(installationDisplayName('Main Lobby Corridor') === 'Main Lobby Installation', 'replace corridor word')
assert(formatClearCm(900) === '90 cm', '900mm → 90cm')
assert(cmToMm(90) === 900, 'cm to mm')

const v1 = migrateDoc({
  name: 'New corridor',
  units: [
    { id: 'a', type: 'hg02_single' },
    { id: 'b', type: 'hg02_center' },
    { id: 'c', type: 'hg02_single', flipped: true },
  ],
  lanes: [{ id: 'lane_old', members: [{ unitId: 'a', wing: 'single' }], name: 'Lane 1' }],
  gaps: { a: 900 },
  finish: 'steel',
  glass: 'clear',
})
assert(v1.schemaVersion === 2, 'schema v2')
assert(v1.name === 'New installation', 'migrated name')
assert(v1.laneGroups.length === 1, 'one default group')
assert(v1.units.every((u) => u.groupId === v1.laneGroups[0].id), 'units inherit group')
assert(v1.lanes[0].groupId === v1.laneGroups[0].id, 'lanes inherit group')

const saved = migrateSavedEntry({
  id: 'corr_1',
  name: 'Lobby corridor',
  savedAt: 1,
  thumb: null,
  doc: { name: 'Lobby corridor', units: [], lanes: [], gaps: {}, finish: 'steel', glass: 'clear' },
})
assert(saved.name === 'Lobby Installation', 'saved title')
assert(saved.doc.schemaVersion === 2, 'saved schema')

const g0 = makeLaneGroup('g1', 'Lane Group A', 0)
const g1 = makeLaneGroup('g2', nextGroupName([g0]), 1)
assert(g1.name === 'Lane Group B', 'next name')
assert(g1.originZ > g0.originZ, 'offset Z')

const units = [
  { id: 'u1', type: 'hg02_single' as const, groupId: 'g1' },
  { id: 'u2', type: 'hg02_center' as const, groupId: 'g1' },
  { id: 'u3', type: 'hg02_single' as const, flipped: true, groupId: 'g1' },
]
const passages = neighbourPassages(units, [{ id: 'g1' }])
assert(passages.length === 2, `two passages, got ${passages.length}`)
assert(passages[0].leftUnitId === 'u1' && passages[0].rightUnitId === 'u2', 'first pair')
assert(passages[1].members.length >= 1, 'second passage has members')

type L = { id: string; members: { unitId: string; wing: 'single' | 'left' | 'right' }[]; groupId?: string; name: string }
const emptyLanes: L[] = []
const lanes = syncNeighbourLanes(units, [{ id: 'g1' }], emptyLanes, (p: NeighbourPassage, i, reused) => ({
  id: reused?.id ?? `n${i}`,
  members: p.members,
  groupId: p.groupId,
  name: reused?.name ?? `Lane ${i + 1}`,
}))
assert(lanes.length === 2, 'auto lanes from neighbours')
const again = syncNeighbourLanes(units, [{ id: 'g1' }], lanes, (p, i, reused) => ({
  id: reused?.id ?? `x${i}`,
  members: p.members,
  groupId: p.groupId,
  name: reused?.name ?? 'new',
}))
assert(again[0].id === lanes[0].id && again[1].id === lanes[1].id, 'stable lane ids')

const recipe = unitsForRecipe({
  manufacturerId: 'came',
  modelId: 'hg02_center',
  laneCount: 4,
  standardClearMm: 900,
})
assert(recipe.length === 5, `4 lanes → 5 units, got ${recipe.length}`)
assert(recipe[0].type === 'hg02_single', 'left end')
assert(recipe[recipe.length - 1].flipped === true, 'right end flipped')

const idx = insertIndexInGroup(units, 'g1', 1)
assert(idx === 1, 'insert at local 1')
assert(insertIndexInGroup(units, 'missing', 0) === 3, 'unknown group appends')

console.log('installation domain checks ok')
