/* global api, loadBankRevenueDashboard, setupBankRevenueDashboard, setupBankRevenueLogin */

function initBankRevenuePage() {
  setupBankRevenueDashboard();

  const logoutBtn = document.getElementById("btn-bank-logout");
  logoutBtn?.addEventListener("click", async () => {
    await window.api("/api/auth/logout", { method: "POST" });
    location.reload();
  });

  (async () => {
    try {
      const res = await window.api("/api/auth/me");
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
  })();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBankRevenuePage);
} else {
  initBankRevenuePage();
}
