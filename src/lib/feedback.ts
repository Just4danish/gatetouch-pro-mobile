/**
 * Touch feedback via expo-haptics (no Web Audio on native).
 */
import * as Haptics from 'expo-haptics'

let muted = false

export function setMuted(v: boolean) {
  muted = v
}
export function isMuted() {
  return muted
}

async function impact(style: Haptics.ImpactFeedbackStyle) {
  if (muted) return
  try {
    await Haptics.impactAsync(style)
  } catch {
    /* simulator / unsupported */
  }
}

async function notify(type: Haptics.NotificationFeedbackType) {
  if (muted) return
  try {
    await Haptics.notificationAsync(type)
  } catch {
    /* ignore */
  }
}

/** light UI tick */
export function tap() {
  void impact(Haptics.ImpactFeedbackStyle.Light)
}

/** gate motor starting to open */
export function whoosh() {
  void impact(Haptics.ImpactFeedbackStyle.Medium)
}

/** gate seating closed */
export function thud() {
  void impact(Haptics.ImpactFeedbackStyle.Heavy)
}

/** refused (locked / no-entry) */
export function buzz() {
  void notify(Haptics.NotificationFeedbackType.Error)
}

/** something committed / saved */
export function chime() {
  void notify(Haptics.NotificationFeedbackType.Success)
}
