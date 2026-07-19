# Server billing — installation plan ($599)

The live site API (`/api/billing/checkout`) must accept `planId: "installation"` for PayPal checkout to work end-to-end.

## Quick integration

In your existing billing checkout handler, add:

```js
import {
  isInstallationPlan,
  handleInstallationCheckout,
  handleInstallationActivate,
} from "./server/billing-installation.js";

// POST /api/billing/checkout
if (isInstallationPlan(planId)) {
  if (mode === "trial") {
    return res.json({ success: false, error: "安装套餐不支持试用，请使用 PayPal 付款" });
  }
  const result = await handleInstallationCheckout({
    email,
    createPayPalOrder: yourCreatePayPalOrderFn,
    savePendingOrder: yourSavePendingOrderFn,
  });
  return res.json(result);
}

// POST /api/billing/activate
if (isInstallationPlan(planId)) {
  const result = await handleInstallationActivate({
    orderId,
    email,
    captureOrder: yourCaptureOrderFn,
    savePurchase: yourSavePurchaseFn,
  });
  return res.json(result);
}
```

## Frontend (already wired)

- Pricing CTA → `/checkout.html?plan=installation`
- `js/checkout.js` calls `/api/billing/checkout` with `planId: "installation"`, `cycle: "onetime"`
- Falls back to `/api/paypal/create-order` ($599) if billing API returns「无效套餐」
- After PayPal capture → `/api/billing/activate` with `planId: "installation"`

## Deploy checklist

1. Merge `server/billing-installation.js` into your Node server
2. Register installation plan in checkout + activate handlers
3. Deploy static files from this repo (`checkout.js`, `pricing.html`)
4. Restart server (`npm start`)
