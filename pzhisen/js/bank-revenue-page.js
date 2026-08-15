/* global api, loadBankRevenueDashboard, setupBankRevenueDashboard */

async function initBankRevenuePage() {
  setupBankRevenueDashboard();
  setupBankRevenueLogin();

  const logoutBtn = document.getElementById("btn-bank-logout");
  logoutBtn?.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    location.reload();
  });

  try {
    const res = await api("/api/auth/me");
    if (res.ok) {
      const me = await res.json();
      if (me.user?.email) {
        const emailInput = document.getElementById("bank-login-email");
        if (emailInput && !emailInput.value) emailInput.value = me.user.email;
      }
      if (me.company?.id) window.companyId = me.company.id;
    }
  } catch (_) {
    /* ignore */
  }

  await loadBankRevenueDashboard();
}

initBankRevenuePage();
