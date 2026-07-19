# Pzhisen 支付接入指南

- **国内用户**：银行卡支付（全国银行）→ 您的国内银行卡
- **海外用户**：PayPal → 您的 PayPal 账户

**不含微信支付、支付宝。**

---

## 定价

| 方案 | 月付 (CNY) | 年付 (CNY) | 月付 (USD) |
|------|-----------|-----------|-----------|
| Pro | ¥199 | ¥1990 | $29 |
| Team | ¥499 | ¥4990 | $79 |

---

## 国内银行卡收款

详见 **[PAYMENTS-CN.md](./PAYMENTS-CN.md)**

```env
XUNHU_APP_ID=...
XUNHU_APP_SECRET=...
PUBLIC_URL=https://pzhisen.online
```

---

## PayPal（海外）

```env
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=live
```

---

## 验证

- https://pzhisen.online/pricing.html
- https://pzhisen.online/api/billing/config → `bankCard: true`, `paypal: true`
