import { Villager } from './mergeVillagerData'

export function findNearbyVillager(
  player: { x: number; y: number } | null,
  villagers: Villager[],
  rangeTiles: number,
): Villager | null {
  if (!player) return null

  let closest: Villager | null = null
  let closestDistance = Infinity

  for (const villager of villagers) {
    const dx = villager.x - player.x
    const dy = villager.y - player.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance <= rangeTiles && distance < closestDistance) {
      closest = villager
      closestDistance = distance
    }
  }

  return closest
}
