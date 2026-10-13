import { describe, it, expect } from 'vitest'
import { parseTalkRange } from './parseTalkRange'

describe('parseTalkRange', () => {
  it('parses the talk range', () => {
    expect(parseTalkRange('{"talk_range_tiles": 3}')).toBe(3)
  })

  it('throws when talk_range_tiles is missing', () => {
    expect(() => parseTalkRange('{}')).toThrow()
  })

  it('throws when talk_range_tiles is not a number', () => {
    expect(() => parseTalkRange('{"talk_range_tiles": "three"}')).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parseTalkRange('not json')).toThrow()
  })
})
