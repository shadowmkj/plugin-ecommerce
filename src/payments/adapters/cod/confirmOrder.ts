import type { PaymentAdapter } from '../../../types/index.js'
type Props = {}

export const confirmOrder: (props: Props) => NonNullable<PaymentAdapter>['confirmOrder'] =
  (props) =>
    async ({
      cartsSlug = 'carts',
      data,
      ordersSlug = 'orders',
      req,
      transactionsSlug = 'transactions',
    }) => {
      const payload = req.payload
      const { } = props || {}

      const customerEmail = data.customerEmail

      const paymentIntentID = data.paymentIntentID as string

      if (!paymentIntentID) {
        throw new Error('PaymentIntent ID is required')
      }

      try {
        // Find our existing transaction by the payment intent ID
        const transactionsResults = await payload.find({
          collection: transactionsSlug,
          req,
          where: {
            'id': {
              equals: paymentIntentID,
            },
          },
        })

        console.log(paymentIntentID)
        console.log(transactionsResults)

        const transaction = transactionsResults.docs[0]
        console.log(transaction?.cart)

        if (!transactionsResults.totalDocs || !transaction) {
          throw new Error('No transaction found for the provided PaymentIntent ID')
        }

        const cartID = transaction?.cart?.id

        const shippingAddress = transaction.billingAddress ?? undefined


        const order = await payload.create({
          collection: ordersSlug,
          data: {
            amount: transaction.amount,
            currency: transaction.currency.toUpperCase(),
            ...(req.user ? { customer: req.user.id } : { customerEmail }),
            items: transaction.items,
            shippingAddress,
            status: 'processing',
            transactions: [transaction.id],
          },
          req,
        })

        const timestamp = new Date().toISOString()

        await payload.update({
          id: cartID,
          collection: cartsSlug,
          data: {
            purchasedAt: timestamp,
          },
          req,
        })

        await payload.update({
          id: transaction.id,
          collection: transactionsSlug,
          data: {
            order: order.id,
            status: 'succeeded',
          },
          req,
        })

        return {
          message: 'Payment initiated successfully',
          orderID: order.id,
          transactionID: transaction.id,
          ...(order.accessToken ? { accessToken: order.accessToken } : {}),
        }
      } catch (error) {
        payload.logger.error({ err: error, msg: 'Error confirming order with Cod' })

        throw new Error(error instanceof Error ? error.message : 'Unknown error initiating payment')
      }
    }
