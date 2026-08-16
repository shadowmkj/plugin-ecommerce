import type { CollectionSlug, Endpoint } from 'payload'

import { addDataAndFileToRequest } from 'payload'

import type {
  CartsCollection,
  CurrenciesConfig,
  PaymentAdapter,
  ProductsConfig,
} from '../types/index.js'

type Args = {
  cartsSlug: CollectionSlug
  currenciesConfig: CurrenciesConfig
  ordersSlug: CollectionSlug
  paymentMethod: PaymentAdapter
  productsSlug: CollectionSlug
  productsValidation?: NonNullable<ProductsConfig>['validation']
  transactionsSlug: CollectionSlug
  variantsSlug: CollectionSlug
}

/**
 * Creates an endpoint handler for confirming an order and processing payment.
 *
 * Route: POST /api/payments/{paymentMethodID}/confirm
 */
export const confirmOrderHandler = ({
  cartsSlug,
  customersSlug,
  ordersSlug,
  paymentMethod,
  productsSlug,
  transactionsSlug,
  variantsSlug,
}: Args & { customersSlug?: CollectionSlug }): Endpoint['handler'] => {
  return async (req) => {
    await addDataAndFileToRequest(req)

    const data = (req.data || {}) as Record<string, unknown>
    let customerEmail = data.customerEmail as string | undefined
    const cartSecret = data.secret as string | undefined

    let cart = data.cart as CartsCollection | undefined
    const cartID = data.cartID as string | undefined
    let currency: string | undefined

    if (req.user && typeof req.user === 'object' && 'email' in req.user) {
      customerEmail = req.user.email as string
    } else if (data?.customerEmail && typeof data.customerEmail === 'string') {
      customerEmail = data.customerEmail
    } else {
      return Response.json(
        {
          message: 'A customer email is required to make a purchase.',
        },
        {
          status: 400,
        },
      )
    }

    if (!cart || !cart.items || !Array.isArray(cart.items)) {
      if (cartID) {
        if (cartSecret && typeof cartSecret === 'string') {
          req.query = req.query || {}
          req.query.secret = cartSecret
        }

        cart = (await req.payload.findByID({
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
        })) as CartsCollection

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
      const paymentResponse = await paymentMethod.confirmOrder!({
        cartsSlug,
        customersSlug: customersSlug ?? 'customers',
        data: {
          ...data,
          customerEmail,
        },
        ordersSlug,
        req,
        transactionsSlug,
      })

      if (paymentResponse.transactionID) {
        const transaction = await req.payload.findByID({
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

              await req.payload.db.updateOne({
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

              await req.payload.db.updateOne({
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

          await req.payload.update({
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
      req.payload.logger.error(error, 'Error confirming order.')

      return Response.json(
        {
          message: 'Error confirming order.',
        },
        {
          status: 500,
        },
      )
    }
  }
}
