import { describe, it, expect } from 'vitest'
import { Direction, gridDirectionForKey } from './viewRotation'

const KEYS: Direction[] = ['up', 'right', 'down', 'left']

function mappingFor(turns: number): Direction[] {
  return KEYS.map((key) => gridDirectionForKey(key, turns))
}

describe('gridDirectionForKey', () => {
  it('leaves controls unchanged before any turn', () => {
    expect(mappingFor(0)).toEqual(['up', 'right', 'down', 'left'])
  })

  it('gives every key its own grid direction after each turn', () => {
    for (let turns = -4; turns <= 4; turns++) {
      expect(new Set(mappingFor(turns)).size).toBe(4)
    }
  })

  it('changes the mapping after a quarter turn', () => {
    expect(mappingFor(1)).not.toEqual(mappingFor(0))
  })

  it('comes back around after four turns either way', () => {
    expect(mappingFor(4)).toEqual(mappingFor(0))
    expect(mappingFor(-1)).toEqual(mappingFor(3))
  })
})
