import { describe, it, expect } from 'vitest'
import { parseRoutesMessage } from './parseRoutesMessage'

describe('parseRoutesMessage', () => {
  it('parses each villager route into tiles', () => {
    const raw = '{"routes": {"villager-2": [[59, 50], [58, 50]]}}'
    expect(parseRoutesMessage(raw)).toEqual(
      new Map([['villager-2', [{ x: 59, y: 50 }, { x: 58, y: 50 }]]]),
    )
  })

  it('treats a message without routes as nobody walking', () => {
    expect(parseRoutesMessage('{"agents": []}').size).toBe(0)
  })

  it('throws when routes is not an object', () => {
    expect(() => parseRoutesMessage('{"routes": []}')).toThrow()
  })

  it('throws when a tile is malformed', () => {
    expect(() => parseRoutesMessage('{"routes": {"v": [[1]]}}')).toThrow()
  })
})
