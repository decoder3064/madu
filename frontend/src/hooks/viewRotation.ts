export type Direction = 'up' | 'down' | 'left' | 'right'

const BASE_YAW = Math.PI / 4

const GRID_STEPS: Record<Direction, [number, number]> = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
}

// Where each arrow should point on screen as (right, up); isometric arrows run along the diagonals.
const KEY_ON_SCREEN: Record<Direction, [number, number]> = {
  up: [1, 1],
  right: [1, -1],
  down: [-1, -1],
  left: [-1, 1],
}

export function viewYaw(turns: number): number {
  return BASE_YAW + turns * (Math.PI / 2)
}

export function gridDirectionForKey(key: Direction, turns: number): Direction {
  const yaw = viewYaw(turns)
  const [wantRight, wantUp] = KEY_ON_SCREEN[key]
  let best: Direction = key
  let bestScore = -Infinity
  for (const direction of Object.keys(GRID_STEPS) as Direction[]) {
    const [dx, dz] = GRID_STEPS[direction]
    const onScreenRight = dx * Math.cos(yaw) - dz * Math.sin(yaw)
    const onScreenUp = -dx * Math.sin(yaw) - dz * Math.cos(yaw)
    const score = onScreenRight * wantRight + onScreenUp * wantUp
    if (score > bestScore) {
      best = direction
      bestScore = score
    }
  }
  return best
}
