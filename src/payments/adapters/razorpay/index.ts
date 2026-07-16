import type { Field, GroupField } from 'payload'

import type {
  PaymentAdapter,
  PaymentAdapterArgs,
  PaymentAdapterClient,
  PaymentAdapterClientArgs,
} from '../../../types/index.js'

import { confirmOrder } from './confirmOrder.js'
import { webhooksEndpoint } from './endpoints/webhooks.js'
import { initiatePayment } from './initiatePayment.js'

export type RazorpayAdapterArgs = {
  publishableKey: string
  secretKey: string
} & PaymentAdapterArgs

export const razorpayAdapter: (props: RazorpayAdapterArgs) => PaymentAdapter = (props) => {
  const { secretKey, publishableKey, groupOverrides } = props
  const label = props?.label || 'Razorpay'

  const baseFields: Field[] = [
    {
      name: 'customerID',
      type: 'text',
      label: 'Razorpay Customer ID',
    },
    {
      name: 'paymentIntentID',
      type: 'text',
      label: 'Razorpay PaymentIntent ID',
    },
  ]

  const groupField: GroupField = {
    name: 'razorpay',
    type: 'group',
    ...groupOverrides,
    admin: {
      condition: (data) => {
        const path = 'paymentMethod'

        return data?.[path] === 'razorpay'
      },
      ...groupOverrides?.admin,
    },
    fields:
      groupOverrides?.fields && typeof groupOverrides?.fields === 'function'
        ? groupOverrides.fields({ defaultFields: baseFields })
        : baseFields,
  }

  return {
    name: 'razorpay',
    confirmOrder: confirmOrder({
      publishableKey,
      secretKey,
    }),
    endpoints: [webhooksEndpoint({ secretKey })],
    group: groupField,
    initiatePayment: initiatePayment({
      publishableKey,
      secretKey,
    }),
    label,
  }
}

export type RazorpayAdapterClientArgs = {
  publishableKey: string
} & PaymentAdapterClientArgs

export const razorpayAdapterClient: (props: RazorpayAdapterClientArgs) => PaymentAdapterClient = (
  _props,
) => {
  return {
    name: 'razorpay',
    confirmOrder: true,
    initiatePayment: true,
    label: 'Card',
  }
}

export type InitiatePaymentReturnType = {
  clientSecret: string
  message: string
  paymentIntentID: string
  method: string
  amount: number | string
}
