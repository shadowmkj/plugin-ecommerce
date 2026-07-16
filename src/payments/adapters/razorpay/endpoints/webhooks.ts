import type { Endpoint } from 'payload'
import type { RazorpayAdapterArgs } from '../index.js'

type Props = {
  secretKey: RazorpayAdapterArgs['secretKey']
}

export const webhooksEndpoint: (props: Props) => Endpoint = (props) => {

  const handler: Endpoint['handler'] = async (_req) => {
    let returnStatus = 200
    return Response.json({ received: true }, { status: returnStatus })
  }

  return {
    handler,
    method: 'post',
    path: '/webhooks',
  }
}
