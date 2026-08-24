import { describe, it, expect } from 'vitest'
import { parsePlayerPosition } from './parsePlayerPosition'

describe('parsePlayerPosition', () => {
  it('parses a valid player message', () => {
    const raw = '{"agents": [], "player": {"id": "player-1", "x": 5, "y": 5}}'
    expect(parsePlayerPosition(raw)).toEqual({ id: 'player-1', x: 5, y: 5 })
  })

  it('throws when player is missing', () => {
    expect(() => parsePlayerPosition('{"agents": []}')).toThrow()
  })

  it('throws when the player entry is missing a field', () => {
    const raw = '{"agents": [], "player": {"id": "player-1", "x": 5}}'
    expect(() => parsePlayerPosition(raw)).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parsePlayerPosition('not json')).toThrow()
  })
})
