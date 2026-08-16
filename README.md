# @shadowmkj/plugin-ecommerce

A full-featured, modular E-commerce plugin for [Payload CMS 3](https://payloadcms.com). Effortlessly manage multi-currency products, variants, carts, addresses, transactions, orders, and payment integrations within Payload CMS.

---

## ⚡ Features

- **🛍️ Complete E-Commerce Infrastructure**: Auto-generated collections for Products, Product Variants, Variant Types, Variant Options, Carts, Addresses, Transactions, and Orders.
- **💳 Plug-and-Play Payment Adapters**:
  - **Stripe**: Built-in support for PaymentIntents and Webhooks.
  - **Razorpay**: Full order creation, payment capture confirmation, and HMAC SHA256 webhook validation.
  - **Cash on Delivery (COD)**: Complete offline/cash-on-delivery workflow.
- **💱 Multi-Currency Support**: Configurable default and supported currencies (USD, EUR, GBP, INR, etc.) with automatic price formatting and admin input controls.
- **⚛️ React Client SDK & Hooks**: Modular client-side context provider (`EcommerceProvider`) and focused hooks (`useCart`, `useCurrency`, `useAddresses`, `usePayments`).
- **🎨 Custom Admin Components**: Includes `PriceInput`, `FormattedInput`, `PriceCell`, and `VariantOptionsSelector` for Payload Admin UI.
- **🌐 Built-in i18n**: Multilingual support with built-in translations across 30+ languages.
- **🔒 Granular Access Control**: Customizable access functions per collection for guest and authenticated user workflows.

---

## 📦 Installation

```bash
# Using pnpm
pnpm add @shadowmkj/plugin-ecommerce

# Using npm
npm install @shadowmkj/plugin-ecommerce

# Using yarn
yarn add @shadowmkj/plugin-ecommerce
```

---

## 🚀 Quick Start

Add `ecommercePlugin` to your `payload.config.ts`:

```typescript
import { buildConfig } from 'payload'
import { ecommercePlugin } from '@shadowmkj/plugin-ecommerce'
import { stripeAdapter } from '@shadowmkj/plugin-ecommerce/payments/stripe'
import { razorpayAdapter } from '@shadowmkj/plugin-ecommerce/payments/razorpay'
import { codAdapter } from '@shadowmkj/plugin-ecommerce/payments/cod'

export default buildConfig({
  // ... your Payload config
  plugins: [
    ecommercePlugin({
      currencies: {
        defaultCurrency: 'USD',
        supportedCurrencies: [
          { code: 'USD', symbol: '$', label: 'US Dollar', decimals: 2 },
          { code: 'EUR', symbol: '€', label: 'Euro', decimals: 2 },
          { code: 'INR', symbol: '₹', label: 'Indian Rupee', decimals: 2 },
        ],
      },
      products: {
        variants: true,
      },
      payments: {
        paymentMethods: [
          stripeAdapter({
            secretKey: process.env.STRIPE_SECRET_KEY!,
          }),
          razorpayAdapter({
            publishableKey: process.env.RAZORPAY_KEY_ID!,
            secretKey: process.env.RAZORPAY_KEY_SECRET!,
          }),
          codAdapter({}),
        ],
      },
    }),
  ],
})
```

---

## ⚙️ Configuration Options

The `ecommercePlugin` function accepts an `EcommercePluginConfig` object with the following properties:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `currencies` | `CurrenciesConfig` | `{ defaultCurrency: 'USD', supportedCurrencies: [USD] }` | Configures allowed currencies, symbols, and decimal precision. |
| `products` | `boolean \| ProductsConfig` | `{ variants: true }` | Enables product management and optional variant options/types collections. |
| `payments` | `PaymentsConfig` | `{ paymentMethods: [] }` | List of backend payment adapters (`stripeAdapter`, `razorpayAdapter`, `codAdapter`). |
| `addresses` | `boolean \| AddressesConfig` | `true` | Enables customer address management collection and supported country definitions. |
| `carts` | `boolean \| CartsConfig` | `true` | Configures shopping cart collection options and item matching logic. |
| `orders` | `boolean \| OrdersConfig` | `true` | Configures order fulfillment and transaction history collections. |
| `access` | `AccessConfig` | Default access rules | Override collection-level access permissions. |

---

## 🔌 Payment Adapters

### 1. Stripe Adapter
```typescript
import { stripeAdapter, stripeAdapterClient } from '@shadowmkj/plugin-ecommerce/payments/stripe'

// Server-side (Payload Plugin Config)
stripeAdapter({
  secretKey: process.env.STRIPE_SECRET_KEY!,
})

// Client-side (React Provider)
stripeAdapterClient()
```

### 2. Razorpay Adapter
```typescript
import { razorpayAdapter, razorpayAdapterClient } from '@shadowmkj/plugin-ecommerce/payments/razorpay'

// Server-side (Payload Plugin Config)
razorpayAdapter({
  publishableKey: process.env.RAZORPAY_KEY_ID!,
  secretKey: process.env.RAZORPAY_KEY_SECRET!,
})

// Client-side (React Provider)
razorpayAdapterClient({
  publishableKey: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
})
```

### 3. Cash on Delivery (COD) Adapter
```typescript
import { codAdapter, codAdapterClient } from '@shadowmkj/plugin-ecommerce/payments/cod'

// Server-side
codAdapter({})

// Client-side
codAdapterClient({})
```

---

## ⚛️ Client SDK (React Provider & Hooks)

Wrap your frontend application with `EcommerceProvider` to access stateful cart management, currency switching, address creation, and checkout initiation.

```tsx
'use client'
import React from 'react'
import { EcommerceProvider, useCart, useCurrency, usePayments } from '@shadowmkj/plugin-ecommerce/client/react'
import { stripeAdapterClient } from '@shadowmkj/plugin-ecommerce/payments/stripe'
import { razorpayAdapterClient } from '@shadowmkj/plugin-ecommerce/payments/razorpay'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <EcommerceProvider
      paymentMethods={[
        stripeAdapterClient(),
        razorpayAdapterClient({ publishableKey: 'rzp_test_xxx' }),
      ]}
    >
      {children}
    </EcommerceProvider>
  )
}

function CartSummary() {
  const { cart, addItem, removeItem, clearCart } = useCart()
  const { currency, setCurrency } = useCurrency()
  const { initiatePayment } = usePayments()

  return (
    <div>
      <h2>Shopping Cart ({cart?.items?.length || 0} items)</h2>
      <button onClick={() => setCurrency('EUR')}>Switch to EUR</button>
      <button onClick={() => initiatePayment({ paymentMethod: 'stripe' })}>
        Checkout
      </button>
    </div>
  )
}
```

### Exported Hooks

- `useEcommerce()`: Access full context including user, cart, config, and payment methods.
- `useCart()`: Methods to `addItem`, `removeItem`, `incrementItem`, `decrementItem`, and `clearCart`.
- `useCurrency()`: Access active currency context (`code`, `symbol`, `decimals`) and `setCurrency`.
- `useAddresses()`: Create and update user billing/shipping addresses.
- `usePayments()`: `initiatePayment` and `confirmOrder` flow handlers.

---

## 💱 Multi-Currency Usage & Configuration

`@shadowmkj/plugin-ecommerce` provides end-to-end multi-currency support, from backend schema generation and subtotal calculation to client-side state synchronization.

### 1. Server-Side Configuration

In your `payload.config.ts`, define your default currency and supported currencies:

```typescript
ecommercePlugin({
  currencies: {
    defaultCurrency: 'USD',
    supportedCurrencies: [
      { code: 'USD', symbol: '$', label: 'US Dollar', decimals: 2 },
      { code: 'EUR', symbol: '€', label: 'Euro', decimals: 2 },
      { code: 'INR', symbol: '₹', label: 'Indian Rupee', decimals: 2 },
    ],
  },
})
```

#### Auto-Generated Product & Variant Price Fields
For each supported currency defined in `supportedCurrencies`, the plugin automatically generates dedicated price input fields on the `products` and `variants` collections in Payload Admin (e.g. `priceInUSD`, `priceInEUR`, `priceInINR`).

### 2. Client-Side Currency Switching (`useCurrency`)

Use the `useCurrency()` hook in Client Components to read the active currency and switch currencies dynamically:

```tsx
'use client'
import React from 'react'
import { useCurrency } from '@shadowmkj/plugin-ecommerce/client/react'

export function CurrencySelector() {
  const { currency, setCurrency, supportedCurrencies } = useCurrency()

  return (
    <select
      value={currency.code}
      onChange={(e) => setCurrency(e.target.value)}
    >
      {supportedCurrencies.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label} ({c.symbol})
        </option>
      ))}
    </select>
  )
}
```

### 3. Rendering Product Prices Dynamically

Access the corresponding price field on product objects based on the active currency:

```tsx
'use client'
import React from 'react'
import { useCurrency } from '@shadowmkj/plugin-ecommerce/client/react'

export function ProductPrice({ product }: { product: any }) {
  const { currency } = useCurrency()

  // Dynamically resolve price field (e.g., 'priceInUSD', 'priceInEUR', 'priceInINR')
  const priceField = `priceIn${currency.code}`
  const price = product[priceField] ?? 0

  return (
    <span>
      {currency.symbol}
      {price.toFixed(currency.decimals)}
    </span>
  )
}
```

### 4. Automatic Cart Subtotal Recalculation

When a user selects a new currency via `setCurrency('EUR')`:
1. The client issues a `PATCH` request updating `cart.currency` in the database.
2. The backend `beforeChangeCart` hook recalculates `cart.subtotal` using `priceInEUR` for all items in the cart.
3. Subsequent cart modifications (`addItem`, `updateItem`, `removeItem`) send the active currency code and calculate subtotals in the user's active currency.

---

## 🖥️ Development & Scripts

```bash
# Build TypeScript declarations and SWC bundle
pnpm build

# Run unit tests with Vitest
npx vitest

# Run linter
pnpm lint
```

---

## 📜 License

Distributed under the [MIT License](LICENSE.md).

Developed by [shadowmkj](https://github.com/shadowmkj)
