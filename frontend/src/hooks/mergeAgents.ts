import { AgentPosition } from './parseAgentsMessage'

export function mergeAgents(
  prev: Map<string, AgentPosition>,
  incoming: AgentPosition[],
): Map<string, AgentPosition> {
  const next = new Map(prev)
  for (const agent of incoming) {
    next.set(agent.id, agent)
  }
  return next
}
