import { describe, it, expect } from 'vitest'
import { mergeAgents } from './mergeAgents'

describe('mergeAgents', () => {
  it('adds new agents to an empty map', () => {
    const result = mergeAgents(new Map(), [{ id: 'a1', x: 1, y: 1 }])
    expect(result.get('a1')).toEqual({ id: 'a1', x: 1, y: 1 })
  })

  it('updates an existing agent position in place', () => {
    const prev = new Map([['a1', { id: 'a1', x: 1, y: 1 }]])
    const result = mergeAgents(prev, [{ id: 'a1', x: 2, y: 1 }])
    expect(result.get('a1')).toEqual({ id: 'a1', x: 2, y: 1 })
  })

  it('does not drop an agent that is absent from the incoming list', () => {
    // This is the regression test for the delta-broadcast trap: an agent
    // missing from one message must not disappear from state.
    const prev = new Map([
      ['a1', { id: 'a1', x: 1, y: 1 }],
      ['a2', { id: 'a2', x: 5, y: 5 }],
    ])
    const result = mergeAgents(prev, [{ id: 'a1', x: 2, y: 1 }])
    expect(result.get('a2')).toEqual({ id: 'a2', x: 5, y: 5 })
  })
})
