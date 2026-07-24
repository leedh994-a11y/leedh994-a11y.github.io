# Pzhisen Payments

- **China**: Free bank transfer → 中国银行借记卡 / Visa 借记卡 (no third-party fees)
- **International**: PayPal
- **Merchant alerts**: Every subscription order emails `ORDER_NOTIFY_EMAIL` (default `LeeDh994@gmail.com`)

No WeChat, Alipay, or XunhuPay required.

See [PAYMENTS-CN.md](./PAYMENTS-CN.md) for bank + Gmail SMTP setup.

```env
BANK_ACCOUNT_NAME=...
BANK_NAME=中国银行
BANK_ACCOUNT_NUMBER=...
BANK_BRANCH=...
BANK_VISA_SAME_AS_PRIMARY=true
BILLING_ADMIN_SECRET=...
PUBLIC_URL=https://www.pzhisen.online

ORDER_NOTIFY_EMAIL=LeeDh994@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=LeeDh994@gmail.com
SMTP_PASS=...
SMTP_FROM=LeeDh994@gmail.com

PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=live
```

Admin: https://www.pzhisen.online/admin-billing.html
