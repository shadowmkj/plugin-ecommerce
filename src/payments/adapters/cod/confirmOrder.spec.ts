import { beforeEach, describe, expect, it, vi } from 'vitest'

import { confirmOrder } from './confirmOrder.js'

const sampleTransaction = {
  id: 'txn-123',
  amount: 2500,
  billingAddress: { line1: '123 Main St' },
  cart: { id: 'cart-123' },
  currency: 'USD',
  items: [{ product: 'prod-1', quantity: 2 }],
}

const createMockPayload = () => ({
  create: vi.fn().mockResolvedValue({ id: 'order-123' }),
  find: vi.fn().mockResolvedValue({
    docs: [sampleTransaction],
    totalDocs: 1,
  }),
  logger: { error: vi.fn() },
  update: vi.fn().mockResolvedValue({}),
})

const createMockReq = (payload: ReturnType<typeof createMockPayload>) =>
  ({
    payload,
    user: { id: 'user-123' },
  }) as any

describe('COD confirmOrder adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw an error when paymentIntentID is missing', async () => {
    const mockPayload = createMockPayload()
    const handler = confirmOrder({})

    await expect(
      handler({
        data: { customerEmail: 'test@example.com', paymentIntentID: '' },
        req: createMockReq(mockPayload),
      }),
    ).rejects.toThrow('PaymentIntent ID is required')

    expect(mockPayload.find).not.toHaveBeenCalled()
  })

  it('should throw an error when no matching transaction is found in database', async () => {
    const mockPayload = createMockPayload()
    mockPayload.find.mockResolvedValueOnce({ docs: [], totalDocs: 0 })

    const handler = confirmOrder({})

    await expect(
      handler({
        data: { customerEmail: 'test@example.com', paymentIntentID: 'txn-nonexistent' },
        req: createMockReq(mockPayload),
      }),
    ).rejects.toThrow('No transaction found for the provided PaymentIntent ID')

    expect(mockPayload.create).not.toHaveBeenCalled()
  })

  it('should create order and update cart/transaction status upon successful COD order confirmation', async () => {
    const mockPayload = createMockPayload()
    const handler = confirmOrder({})

    const result = await handler({
      data: { customerEmail: 'test@example.com', paymentIntentID: 'txn-123' },
      req: createMockReq(mockPayload),
    })

    expect(mockPayload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        where: {
          id: { equals: 'txn-123' },
        },
      }),
    )

    expect(mockPayload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        data: expect.objectContaining({
          amount: 2500,
          currency: 'USD',
          customer: 'user-123',
          items: sampleTransaction.items,
          status: 'processing',
          transactions: ['txn-123'],
        }),
      }),
    )

    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'carts',
        id: 'cart-123',
        data: expect.objectContaining({
          purchasedAt: expect.any(String),
        }),
      }),
    )

    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        id: 'txn-123',
        data: expect.objectContaining({
          order: 'order-123',
          status: 'succeeded',
        }),
      }),
    )

    expect(result).toEqual(
      expect.objectContaining({
        orderID: 'order-123',
        transactionID: 'txn-123',
      }),
    )
  })
})
