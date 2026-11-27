import { describe, it, expect } from 'vitest'
import { landRectangles, Rect } from './landRectangles'

function area(rects: Rect[]): number {
  let total = 0
  for (const rect of rects) total += rect.width * rect.height
  return total
}

describe('landRectangles', () => {
  it('is one rectangle when there is no sea', () => {
    expect(landRectangles(10, 8, [])).toEqual([{ x: 0, y: 0, width: 10, height: 8 }])
  })

  it('stops where a sea strip runs along the bottom', () => {
    const sea = [{ x: 0, y: 6, width: 10, height: 2 }]
    expect(landRectangles(10, 8, sea)).toEqual([{ x: 0, y: 0, width: 10, height: 6 }])
  })

  it('covers exactly the land around a lake in the middle', () => {
    const sea = [{ x: 3, y: 3, width: 4, height: 2 }]
    const rects = landRectangles(10, 8, sea)
    expect(area(rects)).toBe(10 * 8 - 4 * 2)
  })

  it('leaves no land under a gap that is marked as sea', () => {
    const sea = [
      { x: 0, y: 6, width: 4, height: 2 },
      { x: 4, y: 6, width: 2, height: 2 },
      { x: 6, y: 6, width: 4, height: 2 },
    ]
    expect(landRectangles(10, 8, sea)).toEqual([{ x: 0, y: 0, width: 10, height: 6 }])
  })

  it('ignores sea that hangs off the edge of the map', () => {
    const sea = [{ x: -5, y: 7, width: 30, height: 5 }]
    expect(landRectangles(10, 8, sea)).toEqual([{ x: 0, y: 0, width: 10, height: 7 }])
  })
})
