import { listReceivingBankAccounts } from "./bank-transfer.js";
import { isPayPalConfigured, getPayPalPublicConfig } from "./paypal.js";

function maskAccount(num) {
  if (!num || num.length <= 8) return num || "";
  return `${num.slice(0, 4)} **** **** ${num.slice(-4)}`;
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return "";
  const [local, domain] = email.split("@");
  const visible = local.length <= 2 ? local[0] : local.slice(0, 3);
  return `${visible}***@${domain}`;
}

/** Settlement / receiving accounts for real payments (subscriptions, orders). */
export function getSettlementAccounts() {
  const paypalEmail = (process.env.PAYPAL_MERCHANT_EMAIL || "").trim();
  const paypalConfigured = isPayPalConfigured();
  const paypalMode = getPayPalPublicConfig().mode;
  const bankAccounts = listReceivingBankAccounts();
  const accounts = [];

  accounts.push({
    id: "paypal",
    type: "paypal",
    label: "PayPal 收款账户",
    configured: paypalConfigured,
    emailMask: paypalEmail ? maskEmail(paypalEmail) : null,
    mode: paypalConfigured ? paypalMode : null,
    channels: ["海外用户 PayPal 订阅", "美元 USD 收款"],
    settlementNote: paypalConfigured
      ? "用户通过 PayPal 付款后，款项自动进入您绑定的 PayPal 商户账户"
      : "未配置：请在 Render 设置 PAYPAL_CLIENT_ID、PAYPAL_CLIENT_SECRET、PAYPAL_MODE=live",
  });

  if (bankAccounts.length) {
    for (const bank of bankAccounts) {
      accounts.push({
        id: bank.id,
        type: "bank",
        label: bank.label,
        configured: true,
        bankName: bank.bankName,
        accountName: bank.accountName,
        accountNumberMask: maskAccount(bank.accountNumber),
        network: bank.network,
        channels: ["中国内地银行卡转账", "人民币 CNY 收款"],
        settlementNote: "用户转账备注码匹配后，款项入账此银行卡",
      });
    }
  } else {
    accounts.push({
      id: "bank",
      type: "bank",
      label: "中国银行 / Visa 借记卡",
      configured: false,
      channels: ["中国内地银行卡转账"],
      settlementNote: "未配置：请在 Render 设置 BANK_ACCOUNT_NAME、BANK_NAME、BANK_ACCOUNT_NUMBER",
    });
  }

  const configuredCount = accounts.filter((a) => a.configured).length;

  return {
    accounts,
    configuredCount,
    totalCount: accounts.length,
    ready: configuredCount > 0,
    disclaimerZh:
      "说明：上方销售收益为 AI 推广进度模拟估算。真实款项在用户实际付款后，自动结算至下方已配置的收款账户（订阅费、网站订单等），不会从模拟数字直接打款。",
  };
}
