import { AgentPosition } from './parseAgentsMessage'

export function parsePlayerPosition(raw: string): AgentPosition {
  const data = JSON.parse(raw)
  const player = data.player as { id?: unknown; x?: unknown; y?: unknown } | undefined
  if (
    !player ||
    typeof player.id !== 'string' ||
    typeof player.x !== 'number' ||
    typeof player.y !== 'number'
  ) {
    throw new Error('Invalid player entry: missing id, x, or y')
  }
  return { id: player.id, x: player.x, y: player.y }
}
