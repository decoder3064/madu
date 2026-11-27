export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function landRectangles(width: number, height: number, sea: Rect[]): Rect[] {
  const isSea: boolean[][] = []
  for (let y = 0; y < height; y++) {
    isSea.push(new Array(width).fill(false))
  }
  for (const area of sea) {
    for (let y = Math.max(0, area.y); y < Math.min(height, area.y + area.height); y++) {
      for (let x = Math.max(0, area.x); x < Math.min(width, area.x + area.width); x++) {
        isSea[y][x] = true
      }
    }
  }

  const result: Rect[] = []
  // A land stretch identical to one in the row above extends that rectangle down instead of starting a new one.
  let openAbove = new Map<string, Rect>()
  for (let y = 0; y < height; y++) {
    const openHere = new Map<string, Rect>()
    let x = 0
    while (x < width) {
      if (isSea[y][x]) {
        x++
        continue
      }
      const start = x
      while (x < width && !isSea[y][x]) x++
      const key = `${start}:${x - start}`
      const continuing = openAbove.get(key)
      if (continuing) {
        continuing.height += 1
        openHere.set(key, continuing)
      } else {
        const rect = { x: start, y, width: x - start, height: 1 }
        result.push(rect)
        openHere.set(key, rect)
      }
    }
    openAbove = openHere
  }
  return result
}
