/** Free domestic bank transfer — no third-party payment fees. */

export function getBankAccountConfig() {
  const accountName = process.env.BANK_ACCOUNT_NAME || "";
  const bankName = process.env.BANK_NAME || "";
  const accountNumber = process.env.BANK_ACCOUNT_NUMBER || "";
  const branch = process.env.BANK_BRANCH || "";

  return {
    configured: Boolean(accountName && bankName && accountNumber),
    accountName,
    bankName,
    accountNumber,
    branch,
  };
}

export function isBankTransferConfigured() {
  return getBankAccountConfig().configured;
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
