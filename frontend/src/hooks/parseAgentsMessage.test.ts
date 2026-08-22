import { describe, it, expect } from 'vitest'
import { parseAgentsMessage } from './parseAgentsMessage'

describe('parseAgentsMessage', () => {
  it('parses a single-agent message', () => {
    const result = parseAgentsMessage('{"agents": [{"id": "a1", "x": 3, "y": 5}]}')
    expect(result).toEqual([{ id: 'a1', x: 3, y: 5 }])
  })

  it('parses a multi-agent message', () => {
    const raw = '{"agents": [{"id": "a1", "x": 1, "y": 1}, {"id": "a2", "x": 2, "y": 2}]}'
    const result = parseAgentsMessage(raw)
    expect(result).toEqual([
      { id: 'a1', x: 1, y: 1 },
      { id: 'a2', x: 2, y: 2 },
    ])
  })

  it('throws when agents is missing', () => {
    expect(() => parseAgentsMessage('{}')).toThrow()
  })

  it('throws when an agent entry is missing a field', () => {
    expect(() => parseAgentsMessage('{"agents": [{"id": "a1", "x": 1}]}')).toThrow()
  })

  it('throws when the value is not valid JSON', () => {
    expect(() => parseAgentsMessage('not json')).toThrow()
  })
})
