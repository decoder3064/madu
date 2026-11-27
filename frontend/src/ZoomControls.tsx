export const ZOOM_MIN_LEVEL = -3
export const ZOOM_MAX_LEVEL = 8

interface ZoomControlsProps {
  level: number
  onZoomIn: () => void
  onZoomOut: () => void
}

const CONTROLS_STYLE = {
  position: 'absolute' as const,
  right: 12,
  bottom: 12,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
}

const BUTTON_STYLE = {
  width: 36,
  height: 36,
  fontSize: 20,
  borderRadius: 8,
  border: 'none',
  background: 'rgba(0, 0, 0, 0.75)',
  color: 'white',
  cursor: 'pointer',
}

export function ZoomControls({ level, onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div style={CONTROLS_STYLE}>
      <button
        style={BUTTON_STYLE}
        aria-label="Zoom in"
        disabled={level >= ZOOM_MAX_LEVEL}
        onClick={(event) => {
          onZoomIn()
          event.currentTarget.blur()
        }}
      >
        +
      </button>
      <button
        style={BUTTON_STYLE}
        aria-label="Zoom out"
        disabled={level <= ZOOM_MIN_LEVEL}
        onClick={(event) => {
          onZoomOut()
          event.currentTarget.blur()
        }}
      >
        −
      </button>
    </div>
  )
}
