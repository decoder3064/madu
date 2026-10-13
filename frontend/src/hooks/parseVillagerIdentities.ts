export interface VillagerIdentity {
  id: string
  name: string
  role: string
  line: string
}

export function parseVillagerIdentities(raw: string): VillagerIdentity[] {
  const data = JSON.parse(raw)
  if (!Array.isArray(data.agents)) {
    throw new Error('Invalid agents message: "agents" is not an array')
  }
  return data.agents.map((entry: unknown): VillagerIdentity => {
    const agent = entry as {
      id?: unknown
      name?: unknown
      role?: unknown
      line?: unknown
    }
    if (
      typeof agent.id !== 'string' ||
      typeof agent.name !== 'string' ||
      typeof agent.role !== 'string' ||
      typeof agent.line !== 'string'
    ) {
      throw new Error('Invalid agent entry: missing id, name, role, or line')
    }
    return { id: agent.id, name: agent.name, role: agent.role, line: agent.line }
  })
}
