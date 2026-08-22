export interface AgentPosition {
  id: string
  x: number
  y: number
}

export function parseAgentsMessage(raw: string): AgentPosition[] {
  const data = JSON.parse(raw)
  if (!Array.isArray(data.agents)) {
    throw new Error('Invalid agents message: "agents" is not an array')
  }
  return data.agents.map((entry: unknown): AgentPosition => {
    const agent = entry as { id?: unknown; x?: unknown; y?: unknown }
    if (
      typeof agent.id !== 'string' ||
      typeof agent.x !== 'number' ||
      typeof agent.y !== 'number'
    ) {
      throw new Error('Invalid agent entry: missing id, x, or y')
    }
    return { id: agent.id, x: agent.x, y: agent.y }
  })
}
