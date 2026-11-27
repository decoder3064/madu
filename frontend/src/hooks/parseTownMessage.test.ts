import { describe, it, expect } from 'vitest'
import { parseTownMessage } from './parseTownMessage'

const WELL = {
  id: 'well', name: 'Well', kind: 'landmark', blocks: true,
  x: 54, y: 46, width: 3, height: 3,
}

describe('parseTownMessage', () => {
  it('parses a valid town message', () => {
    expect(parseTownMessage(JSON.stringify({ town: [WELL] }))).toEqual([WELL])
  })

  it('parses an empty town', () => {
    expect(parseTownMessage('{"town": []}')).toEqual([])
  })

  it('throws when town is missing', () => {
    expect(() => parseTownMessage('{"agents": []}')).toThrow()
  })

  it('throws when an entry is missing a field', () => {
    const { blocks, ...withoutBlocks } = WELL
    void blocks
    expect(() => parseTownMessage(JSON.stringify({ town: [withoutBlocks] }))).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parseTownMessage('not json')).toThrow()
  })
})
