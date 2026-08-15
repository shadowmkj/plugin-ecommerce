import type { CollectionSlug, Endpoint } from 'payload'

import { addDataAndFileToRequest } from 'payload'

import type { CartsCollection, PaymentAdapter } from '../types/index.js'

type Args = {
  cartsSlug: CollectionSlug
  customersSlug: CollectionSlug
  ordersSlug: CollectionSlug
  paymentMethods: PaymentAdapter[]
  productsSlug: CollectionSlug
  transactionsSlug: CollectionSlug
  variantsSlug: CollectionSlug
}

/**
 * Creates an endpoint handler for confirming an order and processing payment.
 *
 * Route: POST /api/payments/{paymentMethodID}/confirm
 *
 * Request body:
 * - cartID: string (required if cart is not populated)
 * - cart: object (optional, cart document)
 * - customerEmail: string (optional, for guest checkout)
 * - ... payment-specific data (e.g., paymentIntentID, paymentMethodID)
 *
 * @example
 * ```ts
 * fetch('/api/payments/stripe/confirm', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     cartID: '123',
 *     paymentIntentID: 'pi_xxx'
 *   })
 * })
 * ```
 */
export const confirmOrderEndpoint = ({
  cartsSlug,
  customersSlug,
  ordersSlug,
  paymentMethods,
  productsSlug,
  transactionsSlug,
  variantsSlug,
}: Args): Endpoint => ({
  handler: async (req) => {
    await addDataAndFileToRequest(req)

    const paymentMethodID = req.routeParams?.paymentMethod as string | undefined

    if (!paymentMethodID) {
      return Response.json(
        {
          message: 'Payment method is required.',
        },
        {
          status: 400,
        },
      )
    }

    const paymentMethod = paymentMethods.find((method) => method.name === paymentMethodID)

    if (!paymentMethod) {
      return Response.json(
        {
          message: `Payment method with name "${paymentMethodID}" not found.`,
        },
        {
          status: 404,
        },
      )
    }

    if (!paymentMethod.confirmOrder) {
      return Response.json(
        {
          message: `Payment method "${paymentMethodID}" does not support confirming orders.`,
        },
        {
          status: 400,
        },
      )
    }

    const data = (req.data || {}) as Record<string, unknown>
    const customerEmail = data.customerEmail as string | undefined

    let cart = data.cart as CartsCollection | undefined
    const cartID = data.cartID as string | undefined
    let currency: string | undefined

    if (!cart) {
      if (cartID) {
        cart = await req.payload.findByID({
          id: cartID,
          collection: cartsSlug,
          depth: 2,
          overrideAccess: false,
          req,
          select: {
            id: true,
            currency: true,
            customerEmail: true,
            items: true,
            purchasedAt: true,
            subtotal: true,
          },
        })

        if (!cart) {
          return Response.json(
            {
              message: `Cart with ID ${cartID} not found.`,
            },
            {
              status: 404,
            },
          )
        }
      } else {
        return Response.json(
          {
            message: 'Cart ID is required.',
          },
          {
            status: 400,
          },
        )
      }
    }

    if (cart.purchasedAt) {
      return Response.json(
        {
          message: 'This cart has already been purchased.',
        },
        {
          status: 400,
        },
      )
    }

    if (cart.currency && typeof cart.currency === 'string') {
      currency = cart.currency
    }

    // Ensure the currency is provided or inferred in some way
    if (!currency) {
      return Response.json(
        {
          message: 'Currency is required.',
        },
        {
          status: 400,
        },
      )
    }

    try {
      const paymentResponse = await paymentMethod.confirmOrder({
        cartsSlug,
        customersSlug,
        data: {
          ...data,
          customerEmail,
        },
        ordersSlug,
        req,
        transactionsSlug,
      })

      if (paymentResponse.transactionID) {
        const transaction = await payload.findByID({
          id: paymentResponse.transactionID,
          collection: transactionsSlug,
          depth: 0,
          select: {
            id: true,
            inventoryDecremented: true,
            items: true,
            status: true,
          },
        })

        // Only decrement inventory if transaction succeeded and inventory hasn't been decremented yet
        if (
          transaction &&
          transaction.status === 'succeeded' &&
          !transaction.inventoryDecremented &&
          Array.isArray(transaction.items) &&
          transaction.items.length > 0
        ) {
          for (const item of transaction.items) {
            if (item.variant) {
              const id = typeof item.variant === 'object' ? item.variant.id : item.variant

              await payload.db.updateOne({
                id,
                collection: variantsSlug,
                data: {
                  inventory: {
                    $inc: item.quantity * -1,
                  },
                },
              })
            } else if (item.product) {
              const id = typeof item.product === 'object' ? item.product.id : item.product

              await payload.db.updateOne({
                id,
                collection: productsSlug,
                data: {
                  inventory: {
                    $inc: item.quantity * -1,
                  },
                },
              })
            }
          }

          // Mark inventory as decremented to prevent duplicate decrements
          await payload.update({
            id: transaction.id,
            collection: transactionsSlug,
            data: {
              inventoryDecremented: true,
            },
          })
        }
      }

      if ('paymentResponse.transactionID' in paymentResponse && paymentResponse.transactionID) {
        delete (paymentResponse as Partial<typeof paymentResponse>).transactionID
      }

      return Response.json(paymentResponse)
    } catch (error) {
      payload.logger.error(error, 'Error confirming order.')

      return Response.json(
        {
          message: 'Error confirming order.',
        },
        {
          status: 500,
        },
      )
    }
  },
  method: 'post',
  path: '/payments/:paymentMethod/confirm',
})
