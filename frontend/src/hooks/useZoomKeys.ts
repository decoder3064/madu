import { useEffect } from 'react'

export function useZoomKeys(onZoomIn: () => void, onZoomOut: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === '=' || event.key === '+') onZoomIn()
      if (event.key === '-' || event.key === '_') onZoomOut()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onZoomIn, onZoomOut])
}
