import { useEffect, useRef, useState } from 'react'
import { parseAgentsMessage, AgentPosition } from './parseAgentsMessage'
import { mergeAgents } from './mergeAgents'
import { parsePlayerPosition } from './parsePlayerPosition'
import { parseBuildingsMessage, BuildingFootprint } from './parseBuildingsMessage'

export interface GameConnection {
  agents: AgentPosition[]
  player: AgentPosition | null
  buildings: BuildingFootprint[]
  sendMove: (direction: 'up' | 'down' | 'left' | 'right') => void
}

export function useGameConnection(url: string): GameConnection {
  const [agents, setAgents] = useState<Map<string, AgentPosition>>(new Map())
  const [player, setPlayer] = useState<AgentPosition | null>(null)
  const [buildings, setBuildings] = useState<BuildingFootprint[]>([])
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onmessage = (event) => {
      const incomingAgents = parseAgentsMessage(event.data)
      setAgents((prev) => mergeAgents(prev, incomingAgents))
      setPlayer(parsePlayerPosition(event.data))

      const data = JSON.parse(event.data)
      if (data.buildings !== undefined) {
        setBuildings(parseBuildingsMessage(event.data))
      }
    }

    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [url])

  const sendMove = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'move', direction }))
    }
  }

  return { agents: Array.from(agents.values()), player, buildings, sendMove }
}
