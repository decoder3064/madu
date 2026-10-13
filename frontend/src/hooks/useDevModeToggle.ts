import { useEffect, useState } from 'react'

export function useDevModeToggle(): boolean {
  const [devMode, setDevMode] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'g' || event.key === 'G') {
        setDevMode((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return devMode
}
