import { AgentPosition } from './parseAgentsMessage'
import { VillagerIdentity } from './parseVillagerIdentities'

export interface Villager extends VillagerIdentity {
  x: number
  y: number
}

export function mergeVillagerData(
  agents: AgentPosition[],
  identities: Map<string, VillagerIdentity>,
): Villager[] {
  const result: Villager[] = []
  for (const agent of agents) {
    const identity = identities.get(agent.id)
    if (identity) {
      result.push({ ...identity, x: agent.x, y: agent.y })
    }
  }
  return result
}
