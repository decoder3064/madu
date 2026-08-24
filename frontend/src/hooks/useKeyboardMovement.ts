import { useEffect } from 'react'

type Direction = 'up' | 'down' | 'left' | 'right'

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

export function useKeyboardMovement(onMove: (direction: Direction) => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const direction = KEY_TO_DIRECTION[event.key] ?? KEY_TO_DIRECTION[event.key.toLowerCase()]
      if (direction) {
        onMove(direction)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onMove])
}
