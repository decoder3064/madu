import { useEffect, useState } from 'react'
import { parseAgentsMessage, AgentPosition } from './parseAgentsMessage'
import { mergeAgents } from './mergeAgents'

export function useAgentPositions(url: string): AgentPosition[] {
  const [agents, setAgents] = useState<Map<string, AgentPosition>>(new Map())

  useEffect(() => {
    const socket = new WebSocket(url)
    socket.onmessage = (event) => {
      const incoming = parseAgentsMessage(event.data)
      setAgents((prev) => mergeAgents(prev, incoming))
    }
    return () => socket.close()
  }, [url])

  return Array.from(agents.values())
}
