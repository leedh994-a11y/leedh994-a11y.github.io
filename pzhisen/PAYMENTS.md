# Pzhisen Payment Setup (PayPal)

Pzhisen accepts subscription payments via **PayPal** only. Funds go directly to your PayPal merchant account.

---

## Plans

| Plan | Monthly (USD) | Yearly (USD) |
|------|---------------|--------------|
| Pro | $29 | $290 |
| Team | $79 | $790 |

Page: https://pzhisen.online/pricing.html

---

## PayPal setup

1. Go to https://developer.paypal.com/dashboard/applications  
2. Create an app and copy **Client ID** and **Secret**  
3. In Render → **pzhisen** → **Environment**, add:

```env
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_secret
PAYPAL_MODE=sandbox
```

4. Use `sandbox` for testing, `live` for production  
5. Also set:

```env
PUBLIC_URL=https://pzhisen.online
```

---

## Verify

1. Open https://pzhisen.online/api/billing/config — `paypal` should be `true`  
2. Open https://pzhisen.online/pricing.html → checkout → test PayPal  
3. After payment, check `/api/billing/subscription?email=user@example.com`

---

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/billing/plans` | Subscription plans |
| `GET /api/billing/config` | PayPal status |
| `POST /api/billing/checkout` | Create PayPal order |
| `POST /api/billing/paypal/capture` | Confirm payment |
| `GET /api/billing/order/:id` | Order status |
