import { describe, it, expect } from 'vitest'
import { mergeVillagerData } from './mergeVillagerData'

describe('mergeVillagerData', () => {
  it('merges position and identity by id', () => {
    const agents = [{ id: 'v1', x: 3, y: 4 }]
    const identities = new Map([
      ['v1', { id: 'v1', name: 'Mira', role: 'Fisherwoman', line: 'Hello.' }],
    ])
    expect(mergeVillagerData(agents, identities)).toEqual([
      { id: 'v1', x: 3, y: 4, name: 'Mira', role: 'Fisherwoman', line: 'Hello.' },
    ])
  })

  it('skips an agent with no matching identity yet', () => {
    const agents = [{ id: 'v1', x: 3, y: 4 }]
    expect(mergeVillagerData(agents, new Map())).toEqual([])
  })

  it('returns an empty array when there are no agents', () => {
    expect(mergeVillagerData([], new Map())).toEqual([])
  })
})
