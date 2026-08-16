import { beforeEach, describe, expect, it, vi } from 'vitest'

import { initiatePaymentHandler } from './initiatePayment.js'

const createMockPayload = (overrides?: any) => ({
  findByID: vi.fn().mockImplementation(async ({ collection, id }) => {
    if (collection === 'products' || id === 'prod-1') {
      return {
        id: 'prod-1',
        inventory: 10,
        priceInUSD: 1000,
      }
    }
    if (id === 'purchased-cart-id') {
      return {
        id: 'purchased-cart-id',
        currency: 'USD',
        items: [{ product: { id: 'prod-1' }, quantity: 1 }],
        purchasedAt: '2026-01-01T00:00:00.000Z',
        subtotal: 1000,
      }
    }
    return {
      id: id || 'active-cart-id',
      currency: 'USD',
      items: [{ product: { id: 'prod-1' }, quantity: 1 }],
      purchasedAt: null,
      subtotal: 1000,
    }
  }),
  find: vi.fn().mockImplementation(async ({ collection }) => {
    if (collection === 'products') {
      return {
        docs: [{ id: 'prod-1', inventory: 10, priceInUSD: 1000 }],
        totalDocs: 1,
      }
    }
    if (collection === 'transactions') {
      return {
        docs: [{ id: 'old-pending-tx-123', status: 'pending' }],
        totalDocs: 1,
      }
    }
    return { docs: [], totalDocs: 0 }
  }),
  update: vi.fn().mockResolvedValue({}),
  logger: { error: vi.fn() },
  ...overrides,
})

const createMockReq = (payload: any, user?: any, data?: any) =>
  ({
    data: data || {},
    payload,
    user,
  }) as any

describe('initiatePaymentHandler - Cart Preservation & Retry Logic', () => {
  const currenciesConfig = {
    defaultCurrency: 'USD',
    supportedCurrencies: [{ code: 'USD', symbol: '$' }],
  }

  const mockPaymentMethod = {
    name: 'mockPayment',
    initiatePayment: vi.fn().mockResolvedValue({
      paymentIntentID: 'new-tx-456',
      status: 'success',
    }),
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reject payment initiation if the cart has already been purchased', async () => {
    const mockPayload = createMockPayload()
    const handler = initiatePaymentHandler({
      currenciesConfig,
      paymentMethod: mockPaymentMethod,
    })

    const req = createMockReq(
      mockPayload,
      { email: 'user@example.com' },
      { cartID: 'purchased-cart-id' },
    )

    const response = await handler(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.message).toBe('This cart has already been purchased.')
  })

  it('should pick active unpurchased cart from user.cart.docs when cartID is not provided', async () => {
    const mockPayload = createMockPayload()
    const handler = initiatePaymentHandler({
      currenciesConfig,
      paymentMethod: mockPaymentMethod,
    })

    const userWithCarts = {
      email: 'user@example.com',
      cart: {
        docs: [
          { id: 'purchased-cart-1', purchasedAt: '2026-01-01T00:00:00.000Z' },
          { id: 'active-cart-2', purchasedAt: null },
        ],
      },
    }

    const req = createMockReq(mockPayload, userWithCarts, {})

    const response = await handler(req)
    expect(response.status).toBe(200)
    expect(mockPayload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'active-cart-2',
      }),
    )
  })

  it('should cancel existing pending transactions for the cart when retrying payment', async () => {
    const mockPayload = createMockPayload()
    const handler = initiatePaymentHandler({
      currenciesConfig,
      paymentMethod: mockPaymentMethod,
    })

    const req = createMockReq(
      mockPayload,
      { email: 'user@example.com' },
      { cartID: 'active-cart-id' },
    )

    const response = await handler(req)
    expect(response.status).toBe(200)

    // Verify existing pending transaction was cancelled
    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'old-pending-tx-123',
        collection: 'transactions',
        data: {
          status: 'cancelled',
        },
      }),
    )

    // Verify payment initiation proceeded successfully
    expect(mockPaymentMethod.initiatePayment).toHaveBeenCalled()
  })
})
