export interface GridSize {
  width: number
  height: number
}

export function parseGridSize(raw: string): GridSize {
  const data = JSON.parse(raw)
  if (typeof data.grid_width !== 'number' || typeof data.grid_height !== 'number') {
    throw new Error('Invalid message: "grid_width" or "grid_height" is not a number')
  }
  return { width: data.grid_width, height: data.grid_height }
}
