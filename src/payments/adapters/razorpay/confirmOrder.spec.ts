import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()

vi.mock('razorpay', () => {
  const MockRazorpay = function () {
    return {
      payments: {
        fetch: mockFetch,
      },
    }
  }

  return { default: MockRazorpay }
})

import { confirmOrder } from './confirmOrder'

const defaultCartItemsSnapshot = JSON.stringify([{ id: 'item-1', quantity: 1 }])

const createMockPaymentIntent = (status: string) => ({
  amount: 1000,
  currency: 'usd',
  notes: {
    cartID: 'cart-123',
    cartItemsSnapshot: defaultCartItemsSnapshot,
    shippingAddress: JSON.stringify({ city: 'Test City' }),
  },
  status,
})

const createMockPayload = () => ({
  create: vi.fn().mockResolvedValue({ id: 'order-123' }),
  find: vi.fn().mockResolvedValue({
    docs: [{ id: 'txn-123' }],
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

describe('confirmOrder - payment status check', () => {
  const secretKey = 'sk_test_123'
  const publishableKey = 'rzp_test_123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw when paymentIntent status is created', async () => {
    mockFetch.mockResolvedValue(createMockPaymentIntent('created'))

    const mockPayload = createMockPayload()
    const handler = confirmOrder({ publishableKey, secretKey })

    await expect(
      handler({
        data: { customerEmail: 'test@test.com', paymentIntentID: 'pi_123', razorpay_payment_id: 'pay_123' },
        req: createMockReq(mockPayload),
      }),
    ).rejects.toThrow('Payment not completed.')

    expect(mockPayload.create).not.toHaveBeenCalled()
  })

  it('should throw when paymentIntent status is failed', async () => {
    mockFetch.mockResolvedValue(createMockPaymentIntent('failed'))

    const mockPayload = createMockPayload()
    const handler = confirmOrder({ publishableKey, secretKey })

    await expect(
      handler({
        data: { customerEmail: 'test@test.com', paymentIntentID: 'pi_123', razorpay_payment_id: 'pay_123' },
        req: createMockReq(mockPayload),
      }),
    ).rejects.toThrow('Payment not completed.')

    expect(mockPayload.create).not.toHaveBeenCalled()
  })

  it('should throw when paymentIntent status is authorized', async () => {
    mockFetch.mockResolvedValue(createMockPaymentIntent('authorized'))

    const mockPayload = createMockPayload()
    const handler = confirmOrder({ publishableKey, secretKey })

    await expect(
      handler({
        data: { customerEmail: 'test@test.com', paymentIntentID: 'pi_123', razorpay_payment_id: 'pay_123' },
        req: createMockReq(mockPayload),
      }),
    ).rejects.toThrow('Payment not completed.')

    expect(mockPayload.create).not.toHaveBeenCalled()
  })

  it('should not update cart or transaction when payment has not succeeded', async () => {
    mockFetch.mockResolvedValue(createMockPaymentIntent('created'))

    const mockPayload = createMockPayload()
    const handler = confirmOrder({ publishableKey, secretKey })

    await expect(
      handler({
        data: { customerEmail: 'test@test.com', paymentIntentID: 'pi_123', razorpay_payment_id: 'pay_123' },
        req: createMockReq(mockPayload),
      }),
    ).rejects.toThrow()

    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('should create order when paymentIntent status is succeeded', async () => {
    mockFetch.mockResolvedValue(createMockPaymentIntent('captured'))

    const mockPayload = createMockPayload()
    const handler = confirmOrder({ publishableKey, secretKey })

    const result = await handler({
      data: { customerEmail: 'test@test.com', paymentIntentID: 'pi_123', razorpay_payment_id: 'pay_123' },
      req: createMockReq(mockPayload),
    })

    expect(mockPayload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        data: expect.objectContaining({
          amount: 1000,
          currency: 'USD',
          status: 'processing',
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
