# 结算收款账户配置指南

将 **真实款项**（用户订阅费、网站订单等）结算到您的 PayPal 与银行卡账户。  
请在 **Render 控制台 → Environment** 中设置以下变量（**不要**提交到 GitHub）。

## 您的收款账户

| 类型 | 账户 | Render 变量 |
|------|------|-------------|
| PayPal | `ddb1520@outlook.com` | 见下方 PayPal 配置 |
| Visa 借记卡 | 尾号 `0470`（请勿在聊天/代码中填写完整卡号） | 见下方银行卡配置 |

## 1. PayPal 收款（海外用户 USD）

1. 使用 **ddb1520@outlook.com** 登录 https://developer.paypal.com/
2. 创建 **Live** 应用，复制 Client ID 和 Secret
3. 在 Render 设置：

```env
PAYPAL_CLIENT_ID=你的Live_Client_ID
PAYPAL_CLIENT_SECRET=你的Live_Secret
PAYPAL_MODE=live
PAYPAL_MERCHANT_EMAIL=ddb1520@outlook.com
```

4. 保存后重新部署。Dashboard「结算收款账户」将显示 PayPal 已接入。

## 2. 银行卡 / Visa 收款（中国内地用户 CNY）

在 Render 设置（卡号仅填在 Render，不要写入 Git）：

```env
BANK_ACCOUNT_NAME=持卡人姓名
BANK_NAME=中国银行
BANK_ACCOUNT_NUMBER=你的完整卡号
BANK_BRANCH=开户行（可选）
BANK_VISA_SAME_AS_PRIMARY=true
BANK_VISA_LABEL=Visa 借记卡
```

若 Visa 与中行是同一张双标卡，设 `BANK_VISA_SAME_AS_PRIMARY=true` 即可。

## 3. 订单通知邮箱

```env
ORDER_NOTIFY_EMAIL=你的Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=你的Gmail
SMTP_PASS=应用专用密码
SMTP_FROM=你的Gmail
```

## 重要说明

- **营销推广仪表盘**上的销售数字是 **AI 进度模拟估算**，不是已到账真钱。
- **真实款项**在用户实际付款后，通过 PayPal 或银行转账进入上述账户。
- 本系统 **无法**将模拟数字直接打款；必须配置真实支付通道。
- 配置完成后，打开 https://pzhisen.online/dashboard.html 查看「🏦 结算收款账户」面板。

## 验证

部署后访问 Dashboard，应看到：

- PayPal：显示 `ddb***@outlook.com`（已接入）
- 银行卡：显示 `4002 **** **** 0470`（已接入）

若显示「未配置」，请检查 Render 环境变量是否保存并重新部署。

## 4. 真实收益仪表盘（商户可见）

Dashboard 顶部 **「💵 网站真实收益仪表盘」** 显示真实客户付款订单（非模拟数据）。

仅以下邮箱可查看：
- `ORDER_NOTIFY_EMAIL` 中的邮箱
- 或 `MERCHANT_OWNER_EMAILS` 中额外配置的邮箱

```env
ORDER_NOTIFY_EMAIL=LeeDh994@gmail.com
MERCHANT_OWNER_EMAILS=ddb1520@outlook.com
```

用商户邮箱登录 Dashboard 即可看到真实订单统计。
