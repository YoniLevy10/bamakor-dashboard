import { describe, it, expect } from 'vitest'
import { isAddressLikeText } from './whatsapp-parser'

describe('isAddressLikeText — problem descriptions must not trigger building search', () => {
  it('short two-word Hebrew problem (user report) is not address-like', () => {
    expect(isAddressLikeText('עט כחול')).toBe(false)
  })

  it('single nickname token 3–40 letters can be address-like (product rule)', () => {
    expect(isAddressLikeText('חלץ')).toBe(true)
  })

  it('street-style Hebrew phrase with sufficient length is address-like', () => {
    expect(isAddressLikeText('רחוב הרצל כהן תל אביב')).toBe(true)
  })

  it('digits imply address/building hint', () => {
    expect(isAddressLikeText('מקור חיים 12')).toBe(true)
  })

  it('address cues are address-like', () => {
    expect(isAddressLikeText('בניין 5 דירה 3')).toBe(true)
  })
})
