import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initiatePayment } from './initiatePayment.js'

const createMockPayload = () => ({
  create: vi.fn().mockImplementation(async ({ data }) => ({
    id: 'txn-123',
    ...data,
  })),
  logger: { error: vi.fn() },
})

const createMockReq = (payload: ReturnType<typeof createMockPayload>) =>
  ({
    payload,
    user: { id: 'user-123' },
  }) as any

const sampleCart = {
  id: 'cart-999',
  subtotal: 2500,
  items: [
    {
      product: { id: 'prod-1' },
      quantity: 2,
    },
  ],
}

describe('COD initiatePayment adapter', () => {
  let mockPayload: ReturnType<typeof createMockPayload>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPayload = createMockPayload()
  })

  it('should successfully initiate payment with dynamic currency normalized to uppercase', async () => {
    const handler = initiatePayment({})

    const result = await handler({
      data: {
        customerEmail: 'customer@example.com',
        currency: 'eur',
        cart: sampleCart,
        billingAddress: { line1: '123 Main St' } as any,
        shippingAddress: { line1: '456 Ship Ave' } as any,
      },
      req: createMockReq(mockPayload),
      transactionsSlug: 'transactions',
    })

    expect(result).toEqual({
      clientSecret: 'secret',
      message: 'Payment initiated successfully',
      paymentIntentID: 'txn-123',
      method: 'cod',
    })

    expect(mockPayload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        data: expect.objectContaining({
          amount: 2500,
          currency: 'EUR',
          cart: 'cart-999',
          paymentMethod: 'cod',
          status: 'pending',
          customer: 'user-123',
        }),
      }),
    )
  })

  it('should throw an error when currency is missing or not a string', async () => {
    const handler = initiatePayment({})

    await expect(
      handler({
        data: {
          customerEmail: 'customer@example.com',
          currency: '' as any,
          cart: sampleCart,
        },
        req: createMockReq(mockPayload),
        transactionsSlug: 'transactions',
      }),
    ).rejects.toThrow('Currency is required.')
  })

  it('should throw an error when cart is empty or missing', async () => {
    const handler = initiatePayment({})

    await expect(
      handler({
        data: {
          customerEmail: 'customer@example.com',
          currency: 'USD',
          cart: { id: 'cart-1', subtotal: 100, items: [] },
        },
        req: createMockReq(mockPayload),
        transactionsSlug: 'transactions',
      }),
    ).rejects.toThrow('Cart is empty or not provided.')
  })

  it('should throw an error when customer email is missing', async () => {
    const handler = initiatePayment({})

    await expect(
      handler({
        data: {
          customerEmail: '',
          currency: 'USD',
          cart: sampleCart,
        },
        req: createMockReq(mockPayload),
        transactionsSlug: 'transactions',
      }),
    ).rejects.toThrow('A valid customer email is required to make a purchase.')
  })

  it('should throw an error when amount is invalid or non-positive', async () => {
    const handler = initiatePayment({})

    await expect(
      handler({
        data: {
          customerEmail: 'customer@example.com',
          currency: 'USD',
          cart: { id: 'cart-1', subtotal: 0, items: [{ product: 'p1', quantity: 1 }] },
        },
        req: createMockReq(mockPayload),
        transactionsSlug: 'transactions',
      }),
    ).rejects.toThrow('A valid amount is required to initiate a payment.')
  })
})
