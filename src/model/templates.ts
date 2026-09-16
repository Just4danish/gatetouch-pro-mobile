import type { UnitType } from './catalog'

export interface TemplateUnit {
  type: UnitType
  flipped?: boolean
}

export interface Template {
  id: string
  label: string
  desc: string
  units: TemplateUnit[]
  /** wing indices (left-to-right across the whole line) to merge into one lane */
  groups?: number[][]
  /** lane indices (after grouping) to mark accessible */
  accessible?: number[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'lobby3',
    label: 'Office lobby',
    desc: '3 lanes · swing gate + speed gates',
    units: [{ type: 'gla1' }, { type: 'hg02_center' }, { type: 'hg02_single', flipped: true }],
    groups: [[2, 3]],
  },
  {
    id: 'metro5',
    label: 'Metro bank',
    desc: '5 lanes · continuous speed-gate row',
    units: [
      { type: 'hg02_single' },
      { type: 'hg02_center' },
      { type: 'hg02_center' },
      { type: 'hg02_center' },
      { type: 'hg02_center' },
      { type: 'hg02_single', flipped: true },
    ],
    groups: [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [8, 9],
    ],
  },
  {
    id: 'accessible',
    label: 'Accessible pair',
    desc: '2 lanes · one wide accessible lane',
    units: [
      { type: 'hg02_single' },
      { type: 'hg02_center' },
      { type: 'hg02_single', flipped: true },
    ],
    groups: [
      [0, 1],
      [2, 3],
    ],
    accessible: [1],
  },
  {
    id: 'stadium',
    label: 'Stadium gate',
    desc: '7 lanes · high-throughput row',
    units: [
      { type: 'hg02_single' },
      { type: 'hg02_center' },
      { type: 'hg02_center' },
      { type: 'hg02_center' },
      { type: 'hg02_center' },
      { type: 'hg02_center' },
      { type: 'hg02_center' },
      { type: 'hg02_single', flipped: true },
    ],
    groups: [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [8, 9],
      [10, 11],
      [12, 13],
    ],
  },
]
