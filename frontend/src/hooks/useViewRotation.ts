import { useEffect, useState } from 'react'

export function useViewRotation(): number {
  const [turns, setTurns] = useState(0)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'q' || event.key === 'Q') setTurns((current) => current - 1)
      if (event.key === 'r' || event.key === 'R') setTurns((current) => current + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return turns
}
