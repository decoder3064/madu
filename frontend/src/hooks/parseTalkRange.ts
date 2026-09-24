export function parseTalkRange(raw: string): number {
  const data = JSON.parse(raw)
  if (typeof data.talk_range_tiles !== 'number') {
    throw new Error('Invalid message: "talk_range_tiles" is not a number')
  }
  return data.talk_range_tiles
}
