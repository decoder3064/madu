import { Villager } from './hooks/mergeVillagerData'

export const PLAYER_TARGET = 'player'
const FREE_LOOK = 'free'

interface CameraPickerProps {
  villagers: Villager[]
  followTarget: string | null
  onChange: (target: string | null) => void
}

const PICKER_STYLE = {
  position: 'absolute' as const,
  left: 12,
  bottom: 12,
  padding: '6px 10px',
  background: 'rgba(0, 0, 0, 0.75)',
  color: 'white',
  borderRadius: 8,
  fontFamily: 'sans-serif',
  fontSize: 13,
  display: 'flex',
  gap: 8,
  alignItems: 'center',
}

export function CameraPicker({ villagers, followTarget, onChange }: CameraPickerProps) {
  return (
    // Keys typed in the picker stay in the picker, so arrows don't also walk the player.
    <div style={PICKER_STYLE} onKeyDown={(event) => event.stopPropagation()}>
      <span>Camera</span>
      <select
        value={followTarget ?? FREE_LOOK}
        onChange={(event) => {
          const value = event.target.value
          onChange(value === FREE_LOOK ? null : value)
          event.currentTarget.blur()
        }}
      >
        <option value={PLAYER_TARGET}>Follow you</option>
        {villagers.map((villager) => (
          <option key={villager.id} value={villager.id}>
            Follow {villager.name}
          </option>
        ))}
        <option value={FREE_LOOK}>Free look</option>
      </select>
    </div>
  )
}
