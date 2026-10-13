import { describe, it, expect } from 'vitest'
import { parseVillagerIdentities } from './parseVillagerIdentities'

describe('parseVillagerIdentities', () => {
  it('parses a single villager identity', () => {
    const raw =
      '{"agents": [{"id": "v1", "x": 1, "y": 1, "name": "Mira", "role": "Fisherwoman", "line": "Hello."}]}'
    expect(parseVillagerIdentities(raw)).toEqual([
      { id: 'v1', name: 'Mira', role: 'Fisherwoman', line: 'Hello.' },
    ])
  })

  it('parses multiple villager identities', () => {
    const raw =
      '{"agents": [' +
      '{"id": "v1", "x": 1, "y": 1, "name": "Mira", "role": "Fisherwoman", "line": "Hello."},' +
      '{"id": "v2", "x": 2, "y": 2, "name": "Tomas", "role": "Baker", "line": "Hi there."}' +
      ']}'
    expect(parseVillagerIdentities(raw)).toEqual([
      { id: 'v1', name: 'Mira', role: 'Fisherwoman', line: 'Hello.' },
      { id: 'v2', name: 'Tomas', role: 'Baker', line: 'Hi there.' },
    ])
  })

  it('throws when agents is missing', () => {
    expect(() => parseVillagerIdentities('{}')).toThrow()
  })

  it('throws when an agent entry is missing name, role, or line', () => {
    expect(() =>
      parseVillagerIdentities('{"agents": [{"id": "v1", "x": 1, "y": 1}]}'),
    ).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parseVillagerIdentities('not json')).toThrow()
  })
})
