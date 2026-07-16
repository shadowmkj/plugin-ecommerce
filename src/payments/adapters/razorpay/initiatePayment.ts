import Razorpay from 'razorpay'

import type { PaymentAdapter } from '../../../types/index.js'
import type { InitiatePaymentReturnType, RazorpayAdapterArgs } from './index.js'
import { ca } from 'payload/i18n/ca'

type Props = {
  publishableKey: RazorpayAdapterArgs['publishableKey']
  secretKey: RazorpayAdapterArgs['secretKey']
}

export const initiatePayment: (props: Props) => NonNullable<PaymentAdapter>['initiatePayment'] =
  (props) =>
    async ({ data, req, transactionsSlug }) => {
      const payload = req.payload
      const { secretKey, publishableKey } = props || {}

      const customerEmail = data.customerEmail
      const currency = data.currency
      const cart = data.cart
      const amount = cart.subtotal
      const billingAddressFromData = data.billingAddress
      const shippingAddressFromData = data.shippingAddress

      if (!secretKey) {
        throw new Error('Razorpay secret key is required.')
      }

      if (!currency) {
        throw new Error('Currency is required.')
      }

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error('Cart is empty or not provided.')
      }

      if (!customerEmail || typeof customerEmail !== 'string') {
        throw new Error('A valid customer email is required to make a purchase.')
      }

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new Error('A valid amount is required to initiate a payment.')
      }

      const razorpay = new Razorpay({
        key_id: publishableKey,
        key_secret: secretKey
      })

      try {
        // let customer = await razorpay.customers.all({
        //   count: 1
        // });


        // if (!customer?.id) {
        //   customer = await razorpay.customers.create({
        //     email: customerEmail,
        //   })
        // }

        const flattenedCart = cart.items.map((item) => {
          const productID = typeof item.product === 'object' ? item.product.id : item.product
          const variantID = item.variant
            ? typeof item.variant === 'object'
              ? item.variant.id
              : item.variant
            : undefined

          // Preserve any additional custom properties (e.g., deliveryOption, customizations)
          // that may have been added via cartItemMatcher
          const { product: _product, variant: _variant, ...customProperties } = item

          return {
            ...customProperties,
            product: productID,
            quantity: item.quantity,
            ...(variantID ? { variant: variantID } : {}),
          }
        })

        const shippingAddressAsString = JSON.stringify(shippingAddressFromData)

        const paymentIntent = await razorpay.orders.create({
          amount,
          currency,
          notes: {
            cartID: cart.id,
            cartItemsSnapshot: JSON.stringify(flattenedCart),
            shippingAddress: shippingAddressAsString
          }
        })

        // Create a transaction for the payment intent in the database
        const transaction = await payload.create({
          collection: transactionsSlug,
          data: {
            ...(req.user ? { customer: req.user.id } : { customerEmail }),
            amount: paymentIntent.amount,
            billingAddress: billingAddressFromData,
            cart: cart.id,
            currency: paymentIntent.currency.toUpperCase(),
            items: flattenedCart,
            paymentMethod: 'razorpay',
            status: 'pending',
            razorpay: {
              paymentIntentID: paymentIntent.id,
            },
          },
          req,
        })

        const returnData: InitiatePaymentReturnType = {
          clientSecret: paymentIntent.id || '',
          message: 'Payment initiated successfully',
          paymentIntentID: paymentIntent.id,
          amount: paymentIntent.amount,
          method: 'razorpay'
        }

        return returnData
      } catch (error) {
        payload.logger.error({ err: error, msg: 'Error initiating payment with Razorpay' })

        throw new Error(error instanceof Error ? error.message : 'Unknown error initiating payment')
      }
    }
