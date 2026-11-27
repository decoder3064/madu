export interface RouteTile {
  x: number
  y: number
}

export function parseRoutesMessage(raw: string): Map<string, RouteTile[]> {
  const data = JSON.parse(raw)
  const routes = new Map<string, RouteTile[]>()
  if (data.routes === undefined) return routes
  if (typeof data.routes !== 'object' || data.routes === null || Array.isArray(data.routes)) {
    throw new Error('Invalid routes message: "routes" is not an object')
  }
  for (const [villagerId, tiles] of Object.entries(data.routes)) {
    if (!Array.isArray(tiles)) {
      throw new Error(`Invalid route for ${villagerId}: not an array`)
    }
    const route: RouteTile[] = []
    for (const tile of tiles) {
      if (!Array.isArray(tile) || typeof tile[0] !== 'number' || typeof tile[1] !== 'number') {
        throw new Error(`Invalid route tile for ${villagerId}`)
      }
      route.push({ x: tile[0], y: tile[1] })
    }
    routes.set(villagerId, route)
  }
  return routes
}
