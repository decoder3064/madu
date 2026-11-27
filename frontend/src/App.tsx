import { useEffect, useState } from 'react'
import { useGameConnection } from './hooks/useGameConnection'
import { useKeyboardMovement } from './hooks/useKeyboardMovement'
import { useDevModeToggle } from './hooks/useDevModeToggle'
import { useTalkTrigger } from './hooks/useTalkTrigger'
import { findNearbyVillager } from './hooks/findNearbyVillager'
import { AgentScene } from './scene/AgentScene'
import { DevPanel } from './DevPanel'
import { useViewRotation } from './hooks/useViewRotation'
import { gridDirectionForKey } from './hooks/viewRotation'
import { CameraPicker, PLAYER_TARGET } from './CameraPicker'
import { useFollowMeKey } from './hooks/useFollowMeKey'
import { ZoomControls, ZOOM_MAX_LEVEL, ZOOM_MIN_LEVEL } from './ZoomControls'
import { useZoomKeys } from './hooks/useZoomKeys'

const TALK_DISMISS_MS = 4000

function App() {
  const { agents, player, town, routes, gridSize, talkRangeTiles, sendMove, sendGoTo } =
    useGameConnection('ws://localhost:8420/ws')
  const viewTurns = useViewRotation()
  const [followTarget, setFollowTarget] = useState<string | null>(PLAYER_TARGET)
  useFollowMeKey(() => setFollowTarget(PLAYER_TARGET))
  const [zoomLevel, setZoomLevel] = useState(0)
  const zoomIn = () => setZoomLevel((level) => Math.min(ZOOM_MAX_LEVEL, level + 1))
  const zoomOut = () => setZoomLevel((level) => Math.max(ZOOM_MIN_LEVEL, level - 1))
  useZoomKeys(zoomIn, zoomOut)
  useKeyboardMovement((key) => sendMove(gridDirectionForKey(key, viewTurns)))
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

  const places = [...town].sort((a, b) => a.name.localeCompare(b.name))

  if (!gridSize) return null

  return (
    <div style={{ position: 'relative' }}>
      <AgentScene
        agents={agents}
        player={player}
        town={town}
        gridWidth={gridSize.width}
        gridHeight={gridSize.height}
        showGridLines={devMode}
        nearbyVillager={talkingVillager ? null : nearbyVillager}
        talkingVillager={talkingVillager}
        routes={routes}
        showRoutes={devMode}
        viewTurns={viewTurns}
        followTarget={followTarget}
        onFollowChange={setFollowTarget}
        zoomLevel={zoomLevel}
      />
      <CameraPicker villagers={agents} followTarget={followTarget} onChange={setFollowTarget} />
      <ZoomControls level={zoomLevel} onZoomIn={zoomIn} onZoomOut={zoomOut} />
      {devMode && (
        <DevPanel villagers={agents} places={places} routes={routes} onGoTo={sendGoTo} />
      )}
    </div>
  )
}

export default App
