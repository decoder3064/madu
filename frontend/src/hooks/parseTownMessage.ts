export interface TownEntity {
  id: string
  name: string
  kind: string
  blocks: boolean
  x: number
  y: number
  width: number
  height: number
}

export function parseTownMessage(raw: string): TownEntity[] {
  const data = JSON.parse(raw)
  if (!Array.isArray(data.town)) {
    throw new Error('Invalid town message: "town" is not an array')
  }
  return data.town.map((entry: unknown): TownEntity => {
    const entity = entry as Record<string, unknown>
    if (
      typeof entity.id !== 'string' ||
      typeof entity.name !== 'string' ||
      typeof entity.kind !== 'string' ||
      typeof entity.blocks !== 'boolean' ||
      typeof entity.x !== 'number' ||
      typeof entity.y !== 'number' ||
      typeof entity.width !== 'number' ||
      typeof entity.height !== 'number'
    ) {
      throw new Error('Invalid town entry: missing or mistyped field')
    }
    return {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      blocks: entity.blocks,
      x: entity.x,
      y: entity.y,
      width: entity.width,
      height: entity.height,
    }
  })
}
