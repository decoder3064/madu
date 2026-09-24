import { useEffect, useRef, useState } from 'react'
import { parseAgentsMessage, AgentPosition } from './parseAgentsMessage'
import { mergeAgents } from './mergeAgents'
import { parsePlayerPosition } from './parsePlayerPosition'
import { parseBuildingsMessage, BuildingFootprint } from './parseBuildingsMessage'
import { parseGridSize, GridSize } from './parseGridSize'
import { parseVillagerIdentities, VillagerIdentity } from './parseVillagerIdentities'
import { parseTalkRange } from './parseTalkRange'
import { mergeVillagerData, Villager } from './mergeVillagerData'

export interface GameConnection {
  agents: Villager[]
  player: AgentPosition | null
  buildings: BuildingFootprint[]
  gridSize: GridSize | null
  talkRangeTiles: number
  sendMove: (direction: 'up' | 'down' | 'left' | 'right') => void
}

export function useGameConnection(url: string): GameConnection {
  const [agents, setAgents] = useState<Map<string, AgentPosition>>(new Map())
  const [player, setPlayer] = useState<AgentPosition | null>(null)
  const [buildings, setBuildings] = useState<BuildingFootprint[]>([])
  const [gridSize, setGridSize] = useState<GridSize | null>(null)
  const [villagerIdentities, setVillagerIdentities] = useState<
    Map<string, VillagerIdentity>
  >(new Map())
  const [talkRangeTiles, setTalkRangeTiles] = useState<number>(0)
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
        setGridSize(parseGridSize(event.data))
        setVillagerIdentities(
          new Map(
            parseVillagerIdentities(event.data).map((identity) => [
              identity.id,
              identity,
            ]),
          ),
        )
        setTalkRangeTiles(parseTalkRange(event.data))
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

  return {
    agents: mergeVillagerData(Array.from(agents.values()), villagerIdentities),
    player,
    buildings,
    gridSize,
    talkRangeTiles,
    sendMove,
  }
}
