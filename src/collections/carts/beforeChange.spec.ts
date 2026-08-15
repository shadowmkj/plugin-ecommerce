import { beforeEach, describe, expect, it, vi } from 'vitest'

import { beforeChangeCart } from './beforeChange.js'

describe('beforeChangeCart - Subtotal Multi-Currency Calculation', () => {
  const productsSlug = 'products'
  const variantsSlug = 'variants'

  const mockPayload = {
    findByID: vi.fn().mockImplementation(async ({ id }) => {
      if (id === 'prod-eur') {
        return {
          id: 'prod-eur',
          priceInEUR: 900,
          priceInUSD: 1000,
        }
      }
      return null
    }),
  }

  const hook = beforeChangeCart({ productsSlug, variantsSlug })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should calculate correct subtotal when cart currency is uppercase EUR', async () => {
    const data: any = {
      currency: 'EUR',
      items: [{ product: 'prod-eur', quantity: 2 }],
    }

    await hook({
      data,
      operation: 'update',
      originalDoc: { currency: 'EUR' },
      req: { payload: mockPayload } as any,
    })

    expect(data.subtotal).toBe(1800) // 900 * 2
  })

  it('should normalize lowercase currency (eur) to uppercase priceInEUR', async () => {
    const data: any = {
      currency: 'eur',
      items: [{ product: 'prod-eur', quantity: 1 }],
    }

    await hook({
      data,
      operation: 'update',
      originalDoc: { currency: 'eur' },
      req: { payload: mockPayload } as any,
    })

    expect(data.subtotal).toBe(900)
  })

  it('should fallback to originalDoc.currency if data.currency is omitted during item operations', async () => {
    const data: any = {
      // currency is omitted when only items are updated (e.g. addItem / updateItem)
      items: [{ product: 'prod-eur', quantity: 3 }],
    }

    await hook({
      data,
      operation: 'update',
      originalDoc: { currency: 'EUR' },
      req: { payload: mockPayload } as any,
    })

    expect(data.subtotal).toBe(2700) // 900 * 3
  })
})
