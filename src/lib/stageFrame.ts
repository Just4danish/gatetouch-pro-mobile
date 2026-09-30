/**
 * Stage frame in window coordinates — used by DragBridge to map finger -> floor.
 */
export const stageFrame = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

export function setStageFrame(x: number, y: number, width: number, height: number) {
  stageFrame.x = x
  stageFrame.y = y
  stageFrame.width = Math.max(width, 1)
  stageFrame.height = Math.max(height, 1)
}

/** Landscape build/operate side panel width (dp). */
export function landscapeSideDockWidth(windowWidth: number) {
  return Math.min(360, Math.round(windowWidth * 0.36))
}

/** Shared top inset: camera bar, gear, and landscape Lane groups card. */
export const STAGE_CHROME_TOP = 8
export const STAGE_CHROME_LEFT = 12
