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
