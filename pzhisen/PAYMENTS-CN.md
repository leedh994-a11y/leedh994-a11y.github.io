# Pzhisen 国内银行卡收款配置

仅支持 **国内银行卡支付**（不含微信、支付宝）。全国用户可使用储蓄卡/信用卡付款，款项进入 **您绑定的国内银行卡**。

---

## 支持的银行

工行、建行、农行、中行、招商、交通、浦发、民生、兴业、光大、平安、邮储等全国银行储蓄卡及信用卡。

---

## 配置步骤

### 1. 注册支付网关

1. 打开 https://www.xunhupay.com/ 注册  
2. 完成实名认证  
3. **绑定您的国内银行卡**（用于接收款项和提现）  
4. 创建应用，获取 **APPID** 和 **APPSECRET**

> 无需绑定微信或支付宝收款，只需绑定银行卡即可。

### 2. Render 环境变量

```env
XUNHU_APP_ID=你的APPID
XUNHU_APP_SECRET=你的APPSECRET
PUBLIC_URL=https://pzhisen.online
```

### 3. 异步通知地址

```
https://pzhisen.online/api/billing/webhook/xunhu
```

### 4. 验证

访问 https://pzhisen.online/api/billing/config

应显示：`"bankCard": true`（无 wechat、alipay）

结账页仅显示：**银行卡支付** 和 **PayPal（海外）**

---

## 收款流程

```
国内用户选择银行卡支付
        ↓
   支付网关处理
        ↓
  结算至您绑定的国内银行卡
```

---

海外 PayPal 配置见 [PAYMENTS.md](./PAYMENTS.md)。
