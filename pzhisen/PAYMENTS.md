# Pzhisen 支付接入指南

支持 **微信支付、支付宝（含银行卡）、PayPal**，款项结算到您自己的商户收款账户。

---

## 定价方案

| 方案 | 月付 (CNY) | 年付 (CNY) | 月付 (USD) |
|------|-----------|-----------|-----------|
| Pro 专业版 | ¥199 | ¥1990 | $29 |
| Team 团队版 | ¥499 | ¥4990 | $79 |

页面：`https://pzhisen.online/pricing.html`

---

## 一、PayPal（海外用户）

1. 登录 https://developer.paypal.com/dashboard/applications  
2. 创建 App，获取 **Client ID** 和 **Secret**  
3. 在 Render → Environment 添加：

```env
PAYPAL_CLIENT_ID=你的ClientID
PAYPAL_CLIENT_SECRET=你的Secret
PAYPAL_MODE=live
```

4. 测试时用 `PAYPAL_MODE=sandbox`，使用 Sandbox 测试账号  
5. 款项进入您的 **PayPal 商户账户**

---

## 二、微信 + 支付宝 + 银行卡（国内用户）

推荐使用 **虎皮椒 XunhuPay**（个人/企业均可申请，无需自建支付证书）：

1. 注册 https://www.xunhupay.com/  
2. 完成实名认证，绑定您的 **微信收款** 和 **支付宝收款**  
3. 在虎皮椒后台创建应用，获取 **APPID** 和 **APPSECRET**  
4. 在 Render → Environment 添加：

```env
XUNHU_APP_ID=你的APPID
XUNHU_APP_SECRET=你的APPSECRET
```

5. 在虎皮椒后台设置 **异步通知地址**：

```
https://pzhisen.online/api/billing/webhook/xunhu
```

6. 用户付款后，资金进入您的虎皮椒账户，可提现到微信/支付宝/银行卡

### 银行卡说明

国内用户选择 **支付宝** 付款时，可使用：
- 支付宝余额
- 储蓄卡 / 信用卡
- 花呗

无需单独接入银联。

---

## 三、Render 环境变量完整清单

```env
PUBLIC_URL=https://pzhisen.online
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_SITE_URL=https://pzhisen.online

PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=live

XUNHU_APP_ID=...
XUNHU_APP_SECRET=...
```

保存后 Render 自动重新部署。

---

## 四、验证支付

1. 打开 https://pzhisen.online/pricing.html  
2. 选择方案 → 结账  
3. 测试各支付方式：
   - 支付宝 / 微信（需配置虎皮椒）
   - PayPal（需配置 PayPal，sandbox 可先测）
4. 支付成功后跳转 `/checkout-success.html`  
5. 检查 API：`GET /api/billing/subscription?email=用户邮箱`

---

## 五、API 端点

| 端点 | 说明 |
|------|------|
| `GET /api/billing/plans` | 定价方案 |
| `GET /api/billing/config` | 已启用的支付方式 |
| `POST /api/billing/checkout` | 创建订单 |
| `POST /api/billing/paypal/capture` | PayPal 扣款确认 |
| `POST /api/billing/webhook/xunhu` | 虎皮椒异步通知 |
| `GET /api/billing/order/:id` | 订单状态 |

---

## 六、正式上线前检查

- [ ] `PAYPAL_MODE=live`（正式收款）
- [ ] 虎皮椒应用已审核通过
- [ ] 虎皮椒通知 URL 已配置
- [ ] `PUBLIC_URL=https://pzhisen.online`
- [ ] 用小额真实付款测试一遍

---

款项直接进入您配置的 **PayPal 账户** 和 **虎皮椒绑定的微信/支付宝账户**，不经过第三方平台扣留。
