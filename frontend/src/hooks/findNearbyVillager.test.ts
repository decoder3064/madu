import { describe, it, expect } from 'vitest'
import { findNearbyVillager } from './findNearbyVillager'
import { Villager } from './mergeVillagerData'

function villager(id: string, x: number, y: number): Villager {
  return { id, x, y, name: id, role: 'Villager', line: 'Hi.' }
}

describe('findNearbyVillager', () => {
  it('returns null when there is no player', () => {
    expect(findNearbyVillager(null, [villager('v1', 0, 0)], 3)).toBeNull()
  })

  it('returns null when nothing is in range', () => {
    const player = { x: 0, y: 0 }
    expect(findNearbyVillager(player, [villager('v1', 10, 10)], 3)).toBeNull()
  })

  it('returns the villager when exactly one is in range', () => {
    const player = { x: 0, y: 0 }
    const v1 = villager('v1', 1, 1)
    expect(findNearbyVillager(player, [v1], 3)).toEqual(v1)
  })

  it('returns the closest villager when multiple are in range', () => {
    const player = { x: 0, y: 0 }
    const near = villager('near', 1, 0)
    const far = villager('far', 2, 0)
    expect(findNearbyVillager(player, [far, near], 3)).toEqual(near)
  })

  it('includes a villager exactly at the range boundary', () => {
    const player = { x: 0, y: 0 }
    const v1 = villager('v1', 3, 0)
    expect(findNearbyVillager(player, [v1], 3)).toEqual(v1)
  })

  it('excludes a villager just past the range boundary', () => {
    const player = { x: 0, y: 0 }
    const v1 = villager('v1', 3.01, 0)
    expect(findNearbyVillager(player, [v1], 3)).toBeNull()
  })
})
