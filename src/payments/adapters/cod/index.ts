import type { Field, GroupField, PayloadRequest } from 'payload'

import type {
  PaymentAdapter,
  PaymentAdapterArgs,
  PaymentAdapterClient,
  PaymentAdapterClientArgs,
} from '../../../types/index.js'

import { confirmOrder } from './confirmOrder.js'
import { webhooksEndpoint } from './endpoints/webhooks.js'
import { initiatePayment } from './initiatePayment.js'



export type CodAdapterArgs = {} & PaymentAdapterArgs

export const codAdapter: (props: CodAdapterArgs) => PaymentAdapter = (props) => {
  const { groupOverrides } = props
  const label = props?.label || 'Cod'

  const baseFields: Field[] = [
    {
      name: 'customerID',
      type: 'text',
      label: 'COD Customer ID',
    },
    {
      name: 'paymentIntentID',
      type: 'text',
      label: 'COD PaymentIntent ID',
    },
    {
      name: 'codStatus',
      type: 'select',
      defaultValue: "Pending",
      options: [
        "Pending",
        "Paid"
      ],
      label: "COD Status"
    }
  ]

  const groupField: GroupField = {
    name: 'cod',
    type: 'group',
    ...groupOverrides,
    admin: {
      condition: (data) => {
        const path = 'paymentMethod'

        return data?.[path] === 'cod'
      },
      ...groupOverrides?.admin,
    },
    fields:
      groupOverrides?.fields && typeof groupOverrides?.fields === 'function'
        ? groupOverrides.fields({ defaultFields: baseFields })
        : baseFields,
  }

  return {
    name: 'cod',
    confirmOrder: confirmOrder({}),
    endpoints: [webhooksEndpoint({})],
    group: groupField,
    initiatePayment: initiatePayment({}),
    label,
  }
}

export type CodAdapterClientArgs = {} & PaymentAdapterClientArgs

export const codAdapterClient: (props: CodAdapterClientArgs) => PaymentAdapterClient = (
  props,
) => {
  return {
    name: 'cod',
    confirmOrder: true,
    initiatePayment: true,
    label: 'Cash on Delivery',
  }
}

export type InitiatePaymentReturnType = {
  clientSecret: string
  message: string
  paymentIntentID: string
  method: string
}
