import { describe, it, expect } from 'vitest'
import { parseGridSize } from './parseGridSize'

describe('parseGridSize', () => {
  it('parses the grid size', () => {
    expect(parseGridSize('{"grid_width": 50, "grid_height": 30}')).toEqual({
      width: 50,
      height: 30,
    })
  })

  it('throws when grid_width is missing', () => {
    expect(() => parseGridSize('{"grid_height": 30}')).toThrow()
  })

  it('throws when grid_height is missing', () => {
    expect(() => parseGridSize('{"grid_width": 50}')).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parseGridSize('not json')).toThrow()
  })
})
