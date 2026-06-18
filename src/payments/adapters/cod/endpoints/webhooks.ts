import type { Endpoint } from 'payload'

type Props = {}

export const webhooksEndpoint: (props: Props) => Endpoint = (props) => {
  const { } = props || {}

  const handler: Endpoint['handler'] = async (req) => {
    let returnStatus = 200
    return Response.json({ received: true }, { status: returnStatus })
  }

  return {
    handler,
    method: 'post',
    path: '/webhooks',
  }
}
