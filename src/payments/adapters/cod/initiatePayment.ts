import type { PaymentAdapter } from '../../../types/index.js'
import type { InitiatePaymentReturnType, CodAdapterArgs } from './index.js'

type Props = {}

export const initiatePayment: (props: Props) => NonNullable<PaymentAdapter>['initiatePayment'] =
  (props) =>
    async ({ data, req, transactionsSlug }) => {
      const payload = req.payload
      const { } = props || {}

      const customerEmail = data.customerEmail
      const currency = data.currency
      const cart = data.cart
      const amount = cart.subtotal
      const billingAddressFromData = data.billingAddress
      const shippingAddressFromData = data.shippingAddress

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


      try {

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

        //NOTE: Dummy customer
        const customer = {
          id: "1",

        }

        //NOTE: Dummy payment intent
        const paymentIntent = {
          id: "19",
          status: 'succeeded',
          amount,
          currency: "USD",
          client_secret: "secret",
          metadata: {
            cartID: "10",
            cartItemsSnapshot: JSON.stringify(flattenedCart),
            shippingAddress: ""
          }
        }

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
            paymentMethod: 'cod',
            status: 'pending',
          },
          req,
        })

        const returnData: InitiatePaymentReturnType = {
          clientSecret: paymentIntent.client_secret || '',
          message: 'Payment initiated successfully',
          paymentIntentID: String(transaction.id),
          method: 'cod'
        }
        return returnData
      } catch (error) {
        payload.logger.error({ err: error, msg: 'Error initiating payment with Cod' })

        throw new Error(error instanceof Error ? error.message : 'Unknown error initiating payment')
      }
    }
