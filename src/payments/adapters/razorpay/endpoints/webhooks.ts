import crypto from 'node:crypto'
import type { Endpoint } from 'payload'

import type { RazorpayAdapterArgs } from '../index.js'

type Props = {
  secretKey: RazorpayAdapterArgs['secretKey']
}

export const webhooksEndpoint: (props: Props) => Endpoint = (props) => {
  const { secretKey } = props || {}

  const handler: Endpoint['handler'] = async (req) => {
    if (!secretKey || typeof req.text !== 'function') {
      return Response.json(
        { error: 'Razorpay secret key or request body reader is not configured' },
        { status: 500 },
      )
    }

    const signature = req.headers.get('x-razorpay-signature')
    if (!signature) {
      return Response.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 })
    }

    try {
      const bodyText = await req.text()
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(bodyText)
        .digest('hex')

      if (signature !== expectedSignature) {
        return Response.json({ error: 'Invalid webhook signature' }, { status: 400 })
      }

      return Response.json({ received: true }, { status: 200 })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'Error handling Razorpay webhook' })
      return Response.json({ error: 'Error processing webhook' }, { status: 500 })
    }
  }

  return {
    handler,
    method: 'post',
    path: '/webhooks',
  }
}
