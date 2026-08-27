import { describe, it, expect } from 'vitest'
import { parseBuildingsMessage } from './parseBuildingsMessage'

describe('parseBuildingsMessage', () => {
  it('parses a valid buildings message', () => {
    const raw =
      '{"agents": [], "player": {"id": "p1", "x": 0, "y": 0}, "buildings": [{"id": "building-1", "x": 15, "y": 15, "width": 5, "height": 5}]}'
    expect(parseBuildingsMessage(raw)).toEqual([
      { id: 'building-1', x: 15, y: 15, width: 5, height: 5 },
    ])
  })

  it('parses an empty buildings array', () => {
    const raw = '{"agents": [], "player": {"id": "p1", "x": 0, "y": 0}, "buildings": []}'
    expect(parseBuildingsMessage(raw)).toEqual([])
  })

  it('throws when buildings is missing', () => {
    expect(() =>
      parseBuildingsMessage('{"agents": [], "player": {"id": "p1", "x": 0, "y": 0}}'),
    ).toThrow()
  })

  it('throws when a building entry is missing a field', () => {
    const raw = '{"buildings": [{"id": "building-1", "x": 15, "y": 15, "width": 5}]}'
    expect(() => parseBuildingsMessage(raw)).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parseBuildingsMessage('not json')).toThrow()
  })
})
