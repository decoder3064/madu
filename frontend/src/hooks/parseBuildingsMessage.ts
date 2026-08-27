export interface BuildingFootprint {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export function parseBuildingsMessage(raw: string): BuildingFootprint[] {
  const data = JSON.parse(raw)
  if (!Array.isArray(data.buildings)) {
    throw new Error('Invalid buildings message: "buildings" is not an array')
  }
  return data.buildings.map((entry: unknown): BuildingFootprint => {
    const building = entry as {
      id?: unknown
      x?: unknown
      y?: unknown
      width?: unknown
      height?: unknown
    }
    if (
      typeof building.id !== 'string' ||
      typeof building.x !== 'number' ||
      typeof building.y !== 'number' ||
      typeof building.width !== 'number' ||
      typeof building.height !== 'number'
    ) {
      throw new Error('Invalid building entry: missing id, x, y, width, or height')
    }
    return {
      id: building.id,
      x: building.x,
      y: building.y,
      width: building.width,
      height: building.height,
    }
  })
}
