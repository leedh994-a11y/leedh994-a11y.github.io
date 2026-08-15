/* global loadMarketingDashboard, loadRealRevenueDashboard, loadBankRevenueDashboard, loadContentMarketingDashboard, loadMarketingAnalytics, refreshBankRevenueDashboard, refreshAllDashboards, runPanelRefresh, showDashboardRefreshToast */

(function initDashboardRefreshHubStandalone() {
  if (window.__dashboardRefreshHubBound) return;
  window.__dashboardRefreshHubBound = true;

  function toast(msg, type) {
    if (typeof showDashboardRefreshToast === "function") {
      showDashboardRefreshToast(msg, type);
      return;
    }
    const el = document.getElementById("dashboard-refresh-toast");
    if (el) {
      el.hidden = false;
      el.textContent = msg;
      el.className = `dashboard-refresh-toast dashboard-refresh-toast--${type || "info"}`;
    }
  }

  function setBtnLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle("is-refreshing", loading);
    if (loading) {
      btn.dataset.defaultLabel = btn.dataset.defaultLabel || btn.textContent;
      btn.textContent = "刷新中…";
    } else {
      btn.textContent = btn.dataset.defaultLabel || "↻ 刷新";
    }
  }

  function resolveCompanyId() {
    if (typeof window.getCompanyId === "function") {
      try {
        const id = window.getCompanyId();
        if (id) return id;
      } catch (_) {
        /* ignore */
      }
    }
    const fromUrl = new URLSearchParams(location.search).get("company");
    if (fromUrl) return fromUrl;
    if (window.companyId) return window.companyId;
    try {
      return localStorage.getItem("pzhisen_company_id") || null;
    } catch (_) {
      return null;
    }
  }

  async function run(btn, label, loader) {
    if (!btn || btn.disabled) return;
    const id = resolveCompanyId();
    if (!id) {
      toast("缺少公司 ID，无法刷新", "error");
      return;
    }
    setBtnLoading(btn, true);
    toast(`正在刷新${label}…`, "loading");
    try {
      if (typeof loader === "function") await loader();
      toast(`${label}已刷新`, "success");
    } catch (err) {
      toast(err?.message || `${label}刷新失败`, "error");
    } finally {
      setBtnLoading(btn, false);
    }
  }

  const handlers = {
    "btn-dashboard-refresh": async (btn) => {
      if (typeof refreshAllDashboards === "function") {
        await refreshAllDashboards();
        return;
      }
      await run(btn, "全部仪表盘", async () => {
        await Promise.all([
          window.loadMarketingDashboard?.({ refresh: true }),
          window.loadDailySalesHero?.({ refresh: true }),
          window.loadRealRevenueDashboard?.({ refresh: true }),
          window.loadBankRevenueDashboard?.({ refresh: true }),
          window.loadContentMarketingDashboard?.({ refresh: true }),
          window.loadMarketingAnalytics?.({ refresh: true }),
        ]);
      });
    },
    "btn-real-revenue-refresh": (btn) =>
      run(btn, "真实收益", () => window.loadRealRevenueDashboard?.({ refresh: true })),
    "btn-bank-revenue-refresh": async (btn) => {
      if (typeof refreshBankRevenueDashboard === "function") {
        setBtnLoading(btn, true);
        toast("正在刷新中国银行收账…", "loading");
        try {
          await refreshBankRevenueDashboard();
          toast("中国银行收账已刷新", "success");
        } catch (err) {
          toast(err?.message || "刷新失败", "error");
        } finally {
          setBtnLoading(btn, false);
        }
        return;
      }
      run(btn, "中国银行收账", () => window.loadBankRevenueDashboard?.({ refresh: true }));
    },
    "btn-cm-refresh": (btn) =>
      run(btn, "内容营销", () => window.loadContentMarketingDashboard?.({ refresh: true })),
    "btn-analytics-refresh": (btn) =>
      run(btn, "推广数据分析", () => window.loadMarketingAnalytics?.({ refresh: true })),
    "btn-dsh-refresh": (btn) =>
      run(btn, "每日销售收益", () => window.loadDailySalesHero?.({ refresh: true })),
    "btn-marketing-refresh": (btn) =>
      run(btn, "AI 推广营销", () => window.loadMarketingDashboard?.({ refresh: true })),
  };

  function bind(btn) {
    if (!btn || btn.dataset.refreshHubBound) return;
    btn.dataset.refreshHubBound = "1";
    btn.type = "button";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const handler = handlers[btn.id];
      if (handler) handler(btn);
    });
  }

  function bindAll() {
    Object.keys(handlers).forEach((id) => bind(document.getElementById(id)));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAll);
  } else {
    bindAll();
  }
})();
