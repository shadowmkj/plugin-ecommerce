import type { CollectionBeforeChangeHook } from 'payload'

import crypto from 'crypto'

type Props = {
  productsSlug: string
  variantsSlug: string
}

export const beforeChangeCart: (args: Props) => CollectionBeforeChangeHook =
  ({ productsSlug, variantsSlug }) =>
  async ({ data, operation, originalDoc, req }) => {
    // Generate a secret for guest cart access on creation
    if (operation === 'create' && !data.customer && !data.secret) {
      // Generate a cryptographically secure random string
      const secret = crypto.randomBytes(20).toString('hex')
      data.secret = secret

      // Store in context so afterRead hook can include it in the creation response
      if (!req.context) {
        req.context = {}
      }
      req.context.newCartSecret = secret
    }

    // Update subtotal based on items in the cart
    const items = data.items ?? originalDoc?.items
    const rawCurrency = data.currency || originalDoc?.currency

    if (items && Array.isArray(items) && items.length > 0 && rawCurrency) {
      const currencyCode = String(rawCurrency).toUpperCase()
      const priceField = `priceIn${currencyCode}`

      let subtotal = 0

      for (const item of items) {
        const quantity = item.quantity ?? 1

        if (item.variant) {
          const id = typeof item.variant === 'object' ? item.variant.id : item.variant

          const variant = await req.payload.findByID({
            id,
            collection: variantsSlug,
            depth: 0,
            select: {
              [priceField]: true,
            },
          })

          const price = variant?.[priceField] ?? 0
          subtotal += price * quantity
        } else {
          const id = typeof item.product === 'object' ? item.product.id : item.product

          const product = await req.payload.findByID({
            id,
            collection: productsSlug,
            depth: 0,
            select: {
              [priceField]: true,
            },
          })

          const price = product?.[priceField] ?? 0
          subtotal += price * quantity
        }
      }

      data.subtotal = subtotal
    } else if (items && Array.isArray(items) && items.length === 0) {
      data.subtotal = 0
    }
  }
