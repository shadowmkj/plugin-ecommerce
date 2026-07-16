import Razorpay from 'razorpay'

import type { PaymentAdapter } from '../../../types/index.js'
import { RazorpayAdapterArgs } from './index.js'

type Props = {
  secretKey: RazorpayAdapterArgs['secretKey']
  publishableKey: RazorpayAdapterArgs['publishableKey']
}

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
      const { secretKey, publishableKey } = props || {}

      const customerEmail = data.customerEmail

      const paymentIntentID = data.paymentIntentID as string
      const razorpayId = data.razorpay_payment_id as string

      if (!secretKey) {
        throw new Error('Razorpay secret key is required')
      }

      if (!paymentIntentID) {
        throw new Error('PaymentIntent ID is required')
      }

      const razorpay = new Razorpay({
        key_id: publishableKey,
        key_secret: secretKey
      })

      try {
        // let customer = (
        //   await razorpay.customers.list({
        //     email: customerEmail,
        //   })
        // ).data[0]
        //
        // if (!customer?.id) {
        //   customer = await razorpay.customers.create({
        //     email: customerEmail,
        //   })
        // }

        const transactionsResults = await payload.find({
          collection: transactionsSlug,
          req,
          where: {
            'razorpay.paymentIntentID': {
              equals: paymentIntentID,
            },
          },
        })

        const transaction = transactionsResults.docs[0]

        if (!transactionsResults.totalDocs || !transaction) {
          throw new Error('No transaction found for the provided PaymentIntent ID')
        }

        const paymentIntent = await razorpay.payments.fetch(razorpayId)

        if (paymentIntent.status !== 'captured') {
          throw new Error(`Payment not completed.`)
        }

        const cartID = paymentIntent.notes.cartID
        const cartItemsSnapshot = paymentIntent.notes.cartItemsSnapshot
          ? JSON.parse(paymentIntent.notes.cartItemsSnapshot)
          : undefined

        const shippingAddress = paymentIntent.notes.shippingAddress
          ? JSON.parse(paymentIntent.notes.shippingAddress)
          : undefined

        if (!cartID) {
          throw new Error('Cart ID not found in the PaymentIntent metadata')
        }

        if (!cartItemsSnapshot || !Array.isArray(cartItemsSnapshot)) {
          throw new Error('Cart items snapshot not found or invalid in the PaymentIntent metadata')
        }

        const order = await payload.create({
          collection: ordersSlug,
          data: {
            amount: paymentIntent.amount,
            currency: paymentIntent.currency.toUpperCase(),
            ...(req.user ? { customer: req.user.id } : { customerEmail }),
            items: cartItemsSnapshot,
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
        payload.logger.error({ err: error, msg: 'Error confirming order with Razorpay' })

        throw new Error(error instanceof Error ? error.message : 'Unknown error initiating payment')
      }
    }
