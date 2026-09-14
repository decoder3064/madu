import { useEffect, useState } from 'react'
import { useGameConnection } from './hooks/useGameConnection'
import { useKeyboardMovement } from './hooks/useKeyboardMovement'
import { useDevModeToggle } from './hooks/useDevModeToggle'
import { useTalkTrigger } from './hooks/useTalkTrigger'
import { findNearbyVillager } from './hooks/findNearbyVillager'
import { AgentScene } from './scene/AgentScene'

const TALK_DISMISS_MS = 4000

function App() {
  const { agents, player, buildings, gridSize, talkRangeTiles, sendMove } =
    useGameConnection('ws://localhost:8420/ws')
  useKeyboardMovement(sendMove)
  const devMode = useDevModeToggle()

  const [talkingVillagerId, setTalkingVillagerId] = useState<string | null>(null)
  const nearbyVillager = findNearbyVillager(player, agents, talkRangeTiles)

  useTalkTrigger(() => {
    if (nearbyVillager) {
      setTalkingVillagerId(nearbyVillager.id)
    }
  })

  // Auto-dismiss after TALK_DISMISS_MS.
  useEffect(() => {
    if (!talkingVillagerId) return
    const timer = setTimeout(() => setTalkingVillagerId(null), TALK_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [talkingVillagerId])

  // Dismiss immediately on walking out of range.
  useEffect(() => {
    if (talkingVillagerId && nearbyVillager?.id !== talkingVillagerId) {
      setTalkingVillagerId(null)
    }
  }, [talkingVillagerId, nearbyVillager])

  const talkingVillager =
    agents.find((villager) => villager.id === talkingVillagerId) ?? null

  if (!gridSize) return null

  return (
    <AgentScene
      agents={agents}
      player={player}
      buildings={buildings}
      gridWidth={gridSize.width}
      gridHeight={gridSize.height}
      showGridLines={devMode}
      nearbyVillager={talkingVillager ? null : nearbyVillager}
      talkingVillager={talkingVillager}
    />
  )
}

export default App
