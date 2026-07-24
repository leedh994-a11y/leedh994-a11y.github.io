/** Free domestic bank transfer — no third-party payment fees.
 * Supports China mainland Bank of China debit + optional Visa debit receiving accounts.
 */

function trim(v) {
  return (v || "").trim();
}

function accountFromEnv(prefix, defaults = {}) {
  const accountName = trim(process.env[`${prefix}_ACCOUNT_NAME`]) || defaults.accountName || "";
  const bankName = trim(process.env[`${prefix}_NAME`]) || defaults.bankName || "";
  const accountNumber = trim(process.env[`${prefix}_ACCOUNT_NUMBER`]) || defaults.accountNumber || "";
  const branch = trim(process.env[`${prefix}_BRANCH`]) || defaults.branch || "";
  const label = trim(process.env[`${prefix}_LABEL`]) || defaults.label || "";
  const network = trim(process.env[`${prefix}_NETWORK`]) || defaults.network || "";
  const configured = Boolean(accountName && bankName && accountNumber);
  return {
    configured,
    id: defaults.id || prefix.toLowerCase(),
    label: label || bankName,
    network,
    accountName,
    bankName,
    accountNumber,
    branch,
  };
}

/** Primary China mainland receiving card (中国银行借记卡). */
export function getPrimaryBankAccount() {
  return accountFromEnv("BANK", {
    id: "boc",
    label: "中国银行借记卡",
    network: "UnionPay / 中国银行",
    bankName: "中国银行",
  });
}

/**
 * Optional Visa debit receiving card.
 * Defaults to same-as-primary when unset and primary bank is 中国银行
 * (common dual-branded 中国银行 Visa 借记卡), unless explicitly disabled.
 */
export function getVisaBankAccount() {
  const primary = getPrimaryBankAccount();
  const rawSame = process.env.BANK_VISA_SAME_AS_PRIMARY;
  const sameAsPrimary =
    rawSame === undefined || rawSame === ""
      ? /中国银行/.test(primary.bankName || "")
      : String(rawSame).toLowerCase() === "true" || rawSame === "1";

  const visa = accountFromEnv("BANK_VISA", {
    id: "visa",
    label: "Visa 借记卡",
    network: "Visa",
    accountName: sameAsPrimary ? primary.accountName : "",
    bankName: sameAsPrimary ? primary.bankName || "中国银行" : "Visa",
    accountNumber: sameAsPrimary ? primary.accountNumber : "",
    branch: sameAsPrimary ? primary.branch : "",
  });

  if (!visa.configured && sameAsPrimary && primary.configured) {
    return {
      ...primary,
      id: "visa",
      label: trim(process.env.BANK_VISA_LABEL) || "Visa 借记卡（同中国银行卡）",
      network: "Visa",
      configured: true,
    };
  }
  return visa;
}

/** All configured receiving accounts for checkout display. */
export function listReceivingBankAccounts() {
  const accounts = [];
  const primary = getPrimaryBankAccount();
  if (primary.configured) accounts.push(primary);

  const visa = getVisaBankAccount();
  if (visa.configured) {
    const duplicate =
      primary.configured &&
      visa.accountNumber === primary.accountNumber &&
      visa.accountName === primary.accountName;
    if (duplicate) {
      // One physical card that is both 中国银行 + Visa — show once with combined label
      accounts[0] = {
        ...primary,
        id: "boc-visa",
        label: "中国银行借记卡 / Visa 借记卡",
        network: "UnionPay + Visa",
      };
    } else {
      accounts.push(visa);
    }
  }
  return accounts;
}

/** @deprecated Prefer listReceivingBankAccounts — kept for existing callers */
export function getBankAccountConfig() {
  const primary = getPrimaryBankAccount();
  const accounts = listReceivingBankAccounts();
  return {
    configured: primary.configured || accounts.length > 0,
    accountName: primary.accountName,
    bankName: primary.bankName || "中国银行",
    accountNumber: primary.accountNumber,
    branch: primary.branch,
    accounts,
  };
}

export function isBankTransferConfigured() {
  return listReceivingBankAccounts().length > 0;
}

export function makeTransferCode(orderId) {
  const suffix = orderId.split("_").pop()?.toUpperCase() || "0000";
  return `PZH${suffix}`;
}

export function getAdminSecret() {
  return process.env.BILLING_ADMIN_SECRET || "";
}

export function isAdminAuthorized(key) {
  const secret = getAdminSecret();
  return Boolean(secret && key === secret);
}
