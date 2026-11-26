import { useState } from 'react'
import { Villager } from './hooks/mergeVillagerData'
import { TownEntity } from './hooks/parseTownMessage'
import { RouteTile } from './hooks/parseRoutesMessage'

interface DevPanelProps {
  villagers: Villager[]
  places: TownEntity[]
  routes: Map<string, RouteTile[]>
  onGoTo: (villagerId: string, placeId: string) => void
}

const PANEL_STYLE = {
  position: 'absolute' as const,
  top: 12,
  right: 12,
  width: 200,
  padding: 10,
  background: 'rgba(0, 0, 0, 0.75)',
  color: 'white',
  borderRadius: 8,
  fontFamily: 'sans-serif',
  fontSize: 13,
}

const FIELD_STYLE = { width: '100%', marginBottom: 6 }

export function DevPanel({ villagers, places, routes, onGoTo }: DevPanelProps) {
  const [villagerId, setVillagerId] = useState('')
  const [placeId, setPlaceId] = useState('')
  const chosenVillager = villagerId || villagers[0]?.id || ''
  const chosenPlace = placeId || places[0]?.id || ''
  const stepsLeft = routes.get(chosenVillager)?.length ?? 0

  return (
    // Keys typed in the panel stay in the panel, so arrows don't also walk the player.
    <div style={PANEL_STYLE} onKeyDown={(event) => event.stopPropagation()}>
      <div style={{ fontWeight: 500, marginBottom: 6 }}>Send a villager</div>
      <select
        style={FIELD_STYLE}
        value={chosenVillager}
        onChange={(event) => setVillagerId(event.target.value)}
      >
        {villagers.map((villager) => (
          <option key={villager.id} value={villager.id}>
            {villager.name}
          </option>
        ))}
      </select>
      <select
        style={FIELD_STYLE}
        value={chosenPlace}
        onChange={(event) => setPlaceId(event.target.value)}
      >
        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name}
          </option>
        ))}
      </select>
      <button
        style={{ width: '100%' }}
        disabled={!chosenVillager || !chosenPlace}
        onClick={(event) => {
          onGoTo(chosenVillager, chosenPlace)
          event.currentTarget.blur()
        }}
      >
        Go
      </button>
      <div style={{ marginTop: 6, opacity: 0.8 }}>
        {stepsLeft > 0 ? `Walking, ${stepsLeft} steps left` : 'Not on a route'}
      </div>
    </div>
  )
}
