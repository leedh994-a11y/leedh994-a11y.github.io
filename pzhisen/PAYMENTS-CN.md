# 国内银行卡收款 + Gmail 订单通知

**完全免费银行卡收款** — 无需虎皮椒、微信、支付宝。用户直接转账到您的中国银行 / Visa 借记卡；全球订单自动邮件到您的 Gmail。

---

## 收款账户

| 账户 | 用途 |
|------|------|
| 中国银行借记卡（`BANK_*`） | 中国大陆用户手机银行 / 网银转账 |
| Visa 借记卡（`BANK_VISA_*`） | 可选第二张收款卡；若与中行是同一张双标卡，设 `BANK_VISA_SAME_AS_PRIMARY=true` |

全球 PayPal 订单仍走 PayPal；扣款成功后同样发邮件到 Gmail。

---

## 原理

```
用户选择「银行卡转账」或 PayPal
    ↓
系统创建订单 → 立刻邮件通知 LeeDh994@gmail.com
    ↓
银行卡：页面显示中国银行/Visa 卡号 + 转账备注码
PayPal：用户完成全球支付
    ↓
支付完成 / 确认到账 → 订阅开通 → 再次邮件通知 Gmail
```

---

## Render 环境变量

```env
# 中国银行借记卡（主收款账户）
BANK_ACCOUNT_NAME=肖自臻
BANK_NAME=中国银行
BANK_ACCOUNT_NUMBER=你的中行借记卡号
BANK_BRANCH=可选支行
BANK_LABEL=中国银行借记卡

# Visa 借记卡（与中行同一张双标卡时）
BANK_VISA_SAME_AS_PRIMARY=true
BANK_VISA_LABEL=Visa 借记卡（同中国银行卡）

# 或单独一张 Visa 借记卡：
# BANK_VISA_ACCOUNT_NAME=肖自臻
# BANK_VISA_NAME=中国银行
# BANK_VISA_ACCOUNT_NUMBER=你的Visa借记卡号
# BANK_VISA_BRANCH=
# BANK_VISA_LABEL=Visa 借记卡

# 管理密钥（确认收款 / 测试邮件）
BILLING_ADMIN_SECRET=你的复杂密钥

PUBLIC_URL=https://www.pzhisen.online

# ── Gmail 订单通知（必配，否则邮件只写日志）──
ORDER_NOTIFY_EMAIL=LeeDh994@gmail.com

# 用 Gmail 发信（推荐：Google 账号 → 安全性 → 应用专用密码）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=LeeDh994@gmail.com
SMTP_PASS=你的16位应用专用密码
SMTP_FROM=LeeDh994@gmail.com
```

> 若 `SMTP_USER` 已是 `@gmail.com`，即使不写 `SMTP_HOST` 也会默认使用 `smtp.gmail.com`。

## Render 免费版发信（重要）

Render **免费 Web 服务会封锁 SMTP 端口**（25/465/587）。本仓库已用 **GitHub Actions 桥接** 发信：

1. 网站通过 HTTPS 调用 `repository_dispatch`
2. Actions 在 GitHub 跑 SMTP，把邮件发到 `LeeDh994@gmail.com`

请在 **正式站** Render 服务（URL 为 `pzhisen.onrender.com`）Environment 增加：

```env
GITHUB_NOTIFY_TOKEN=<GitHub PAT，需 repo 权限>
GITHUB_NOTIFY_REPO=leedh994-a11y/leedh994-a11y.github.io
ORDER_NOTIFY_EMAIL=LeeDh994@gmail.com
```

仓库 Secrets 中已配置 `SMTP_*` / `ORDER_NOTIFY_EMAIL` 供 Actions 使用。

### 如何获取 Gmail 应用专用密码

1. 打开 https://myaccount.google.com/security  
2. 开启两步验证  
3. 搜索「应用专用密码」→ 生成（邮件 / 其他）  
4. 把 16 位密码填入 Render 的 `SMTP_PASS`（不要用登录密码）

---

## 确认收款 / 测试通知

1. 打开 https://www.pzhisen.online/admin-billing.html  
2. 输入 `BILLING_ADMIN_SECRET`  
3. 点击「查看通知状态」确认 SMTP + 收件邮箱  
4. 点击「发送测试邮件」→ 检查 `LeeDh994@gmail.com` 收件箱（含垃圾邮件）  
5. 「加载待确认订单」→ 核对银行到账与备注码 →「确认收款并开通」

---

## 用户转账说明

- 用户必须在转账备注中填写系统生成的 **备注码**（如 `PZH1A2B3C`）  
- 金额必须与订单金额完全一致  
- 您收到银行短信 / App 推送后，可在管理页确认（用户点「我已完成转账」也会即时开通）

---

海外 PayPal 配置见 [PAYMENTS.md](./PAYMENTS.md)。
