import { getOrders } from "./billing-store.js";
import { getPlan } from "./plans.js";
import { getPrimaryBankAccount, getVisaBankAccount } from "./bank-transfer.js";
import { isMerchantUser } from "./marketing-real-metrics.js";

const PAID_STATUSES = new Set(["completed", "paid"]);

const CHINA_EMAIL_DOMAINS = new Set([
  "qq.com",
  "foxmail.com",
  "163.com",
  "126.com",
  "sina.com",
  "sina.cn",
  "yeah.net",
  "139.com",
  "189.cn",
  "sohu.com",
  "aliyun.com",
  "tom.com",
  "21cn.com",
  "vip.163.com",
  "vip.126.com",
  "vip.sina.com",
  "vip.qq.com",
  "188.com",
  "wo.cn",
  "139.cn",
]);

function maskEmail(email) {
  if (!email || !email.includes("@")) return "—";
  const [local, domain] = email.split("@");
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

function maskAccount(num) {
  if (!num || num.length <= 8) return num || "—";
  return `${num.slice(0, 4)} **** **** ${num.slice(-4)}`;
}

function isPaid(order) {
  return PAID_STATUSES.has(order.status);
}

function isBankOrder(order) {
  const p = (order.provider || "").toLowerCase();
  return p === "bankcard" || p === "bank";
}

function isChinaEmail(email) {
  if (!email?.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (CHINA_EMAIL_DOMAINS.has(domain)) return true;
  if (domain.endsWith(".cn")) return true;
  return false;
}

/** Classify which receiving card channel a bank transfer order settled to. */
export function getBankReceivingChannel(order) {
  const meta = order.meta || {};
  const stored = meta.receivingChannel || meta.receivingAccount;
  if (stored === "boc" || stored === "china" || stored === "domestic") return "boc";
  if (stored === "visa" || stored === "global" || stored === "international") return "visa";

  const segment = meta.userSegment || meta.customerSegment;
  if (segment === "china" || segment === "cn") return "boc";
  if (segment === "global" || segment === "intl") return "visa";

  return isChinaEmail(order.email) ? "boc" : "visa";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sumAmount(orders) {
  return orders.reduce((s, o) => s + Number(o.amount || 0), 0);
}

function channelMeta(id) {
  if (id === "boc") {
    return {
      id: "boc",
      label: "中国银行借记卡",
      subtitle: "中国用户订阅 · 银联入账",
      icon: "🏦",
      audience: "中国用户",
    };
  }
  return {
    id: "visa",
    label: "中国银行 VISA 借记卡",
    subtitle: "全球用户订阅 · Visa 网络入账",
    icon: "💳",
    audience: "全球用户",
  };
}

function buildAccountInfo() {
  const boc = getPrimaryBankAccount();
  const visa = getVisaBankAccount();
  const sameCard =
    boc.configured &&
    visa.configured &&
    boc.accountNumber === visa.accountNumber &&
    boc.accountName === visa.accountName;

  return {
    boc: {
      configured: boc.configured,
      label: boc.label || "中国银行借记卡",
      bankName: boc.bankName || "中国银行",
      accountName: boc.accountName,
      accountNumberMask: maskAccount(boc.accountNumber),
      network: boc.network || "UnionPay / 中国银行",
    },
    visa: {
      configured: visa.configured,
      label: sameCard ? "中国银行 VISA 借记卡（同卡双标）" : visa.label || "Visa 借记卡",
      bankName: visa.bankName || "中国银行",
      accountName: visa.accountName,
      accountNumberMask: maskAccount(visa.accountNumber),
      network: visa.network || "Visa",
    },
    samePhysicalCard: sameCard,
  };
}

export function getBankRevenueDashboard(companyId, company, userEmail) {
  const merchant = isMerchantUser(userEmail);
  const accounts = buildAccountInfo();

  if (!merchant) {
    return {
      companyId,
      isMerchant: false,
      accessMessage:
        "中国银行收账数据仅网站商户账户可见。请使用商户邮箱（ORDER_NOTIFY_EMAIL）登录后查看。",
      accounts,
      updatedAt: new Date().toISOString(),
    };
  }

  const allOrders = (getOrders().orders || []).filter(isBankOrder);
  const paidOrders = allOrders.filter(isPaid);
  const today = todayIso();
  const todayPaid = paidOrders.filter((o) => (o.paidAt || o.updatedAt || o.createdAt || "").slice(0, 10) === today);

  const channels = { boc: [], visa: [] };
  for (const o of paidOrders) {
    const ch = getBankReceivingChannel(o);
    channels[ch].push(o);
  }

  const todayChannels = { boc: [], visa: [] };
  for (const o of todayPaid) {
    const ch = getBankReceivingChannel(o);
    todayChannels[ch].push(o);
  }

  const channelSummaries = ["boc", "visa"].map((id) => {
    const meta = channelMeta(id);
    const paid = channels[id];
    const todayList = todayChannels[id];
    return {
      ...meta,
      account: accounts[id],
      todayAmount: sumAmount(todayList),
      todayCount: todayList.length,
      totalAmount: sumAmount(paid),
      totalCount: paid.length,
      customerCount: new Set(paid.map((o) => o.email)).size,
      currency: "CNY",
    };
  });

  const byDayMap = {};
  for (const o of paidOrders) {
    const date = (o.paidAt || o.updatedAt || o.createdAt || "").slice(0, 10);
    if (!date) continue;
    const ch = getBankReceivingChannel(o);
    if (!byDayMap[date]) {
      byDayMap[date] = { date, boc: 0, visa: 0, total: 0, count: 0 };
    }
    byDayMap[date][ch] += Number(o.amount || 0);
    byDayMap[date].total += Number(o.amount || 0);
    byDayMap[date].count += 1;
  }
  const byDay = Object.values(byDayMap)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const recentOrders = [...paidOrders]
    .sort(
      (a, b) =>
        new Date(b.paidAt || b.updatedAt || b.createdAt).getTime() -
        new Date(a.paidAt || a.updatedAt || a.createdAt).getTime()
    )
    .slice(0, 50)
    .map((o) => {
      const plan = getPlan(o.planId);
      const ch = getBankReceivingChannel(o);
      const meta = channelMeta(ch);
      return {
        id: o.id,
        date: o.paidAt || o.updatedAt || o.createdAt,
        customerEmailMask: maskEmail(o.email),
        amount: Number(o.amount || 0),
        currency: o.currency || "CNY",
        channel: ch,
        channelLabel: meta.label,
        planLabel: plan?.nameZh || plan?.name || o.planId,
        cycle: o.cycle,
        transferCode: o.transferCode || o.meta?.transferCode || "—",
      };
    });

  const pendingCount = allOrders.filter((o) => !isPaid(o)).length;

  return {
    companyId,
    isMerchant: true,
    merchantEmail: userEmail,
    websiteName: company?.name || "我的网站",
    isReal: true,
    source: "bank_transfer_orders",
    accounts,
    summary: {
      todayTotal: sumAmount(todayPaid),
      todayCount: todayPaid.length,
      totalAmount: sumAmount(paidOrders),
      totalCount: paidOrders.length,
      pendingCount,
      customerCount: new Set(paidOrders.map((o) => o.email)).size,
      currency: "CNY",
    },
    channels: channelSummaries,
    byDay,
    orders: recentOrders,
    updatedAt: new Date().toISOString(),
  };
}
