/* global companyId, api */

let realRevenueData = null;

function fmtMoney(amount, currency = "USD") {
  const sym = currency === "CNY" ? "¥" : "$";
  return `${sym}${Number(amount || 0).toLocaleString()}`;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderRealRevenueDashboard(data) {
  realRevenueData = data;
  const access = document.getElementById("real-revenue-access");
  const content = document.getElementById("real-revenue-content");

  if (!data?.isMerchant) {
    if (access) {
      access.hidden = false;
      access.textContent = data?.accessMessage || "暂无权限查看真实收益数据。";
    }
    if (content) content.hidden = true;
    return;
  }

  if (access) access.hidden = true;
  if (content) content.hidden = false;

  const s = data.summary;
  const goal = s.goal;
  const cur = goal.currency || "USD";

  setText("real-today-primary", fmtMoney(s.primaryToday, cur));
  setText("real-total-primary", fmtMoney(s.primaryTotal, cur));
  setText(
    "real-today-secondary",
    cur === "USD" && s.todayCny > 0 ? `另 ¥${s.todayCny.toLocaleString()} CNY` : cur === "CNY" && s.todayUsd > 0 ? `另 $${s.todayUsd.toLocaleString()} USD` : ""
  );
  setText(
    "real-total-secondary",
    cur === "USD" && s.totalCny > 0 ? `另 ¥${s.totalCny.toLocaleString()} CNY 累计` : cur === "CNY" && s.totalUsd > 0 ? `另 $${s.totalUsd.toLocaleString()} USD 累计` : ""
  );

  setText("real-goal-target", fmtMoney(goal.revenueTarget, cur));
  setText("real-goal-pct", `${goal.progress}%`);
  setText("real-goal-remaining", fmtMoney(goal.remaining, cur));
  const bar = document.getElementById("real-goal-bar");
  if (bar) bar.style.width = `${goal.progress}%`;

  setText("real-count-paid", s.orderCountPaid);
  setText("real-count-pending", s.orderCountPending);
  setText("real-count-today", s.orderCountToday);
  setText("real-count-customers", s.customerCount);
  setText("real-count-total", s.orderCountTotal);

  const provEl = document.getElementById("real-provider-breakdown");
  if (provEl) {
    provEl.innerHTML = (data.byProvider || [])
      .map(
        (p) => `
      <div class="real-prov-item">
        <strong>${p.label}</strong>
        <span>${p.count} 笔</span>
        <span>${p.totalUsd ? fmtMoney(p.totalUsd, "USD") : ""}${p.totalCny ? ` · ${fmtMoney(p.totalCny, "CNY")}` : ""}</span>
      </div>`
      )
      .join("") || '<p class="real-empty">暂无已付款订单</p>';
  }

  const tbody = document.getElementById("real-orders-tbody");
  if (tbody) {
    tbody.innerHTML = (data.orders || [])
      .map(
        (o) => `
      <tr class="${o.paid ? "real-row--paid" : "real-row--pending"}">
        <td>${fmtDateTime(o.date)}</td>
        <td>${o.customerEmailMask}</td>
        <td>${o.planLabel} · ${o.cycle || "—"}</td>
        <td><strong>${fmtMoney(o.amount, o.currency)}</strong></td>
        <td>${o.providerLabel}</td>
        <td><span class="real-status ${o.paid ? "real-status--paid" : "real-status--pending"}">${o.statusLabel}</span></td>
      </tr>`
      )
      .join("") || '<tr><td colspan="6" class="real-empty">暂无订单记录</td></tr>';
  }
}

async function loadRealRevenueDashboard(options = {}) {
  const id = window.getCompanyId?.() || window.companyId || companyId;
  if (!id) return false;
  try {
    const suffix = options.refresh ? `?_=${Date.now()}` : "";
    const res = await api(`/api/companies/${id}/revenue/real${suffix}`, {
      cache: options.refresh ? "no-store" : "default",
      headers: options.refresh ? { "Cache-Control": "no-cache", Pragma: "no-cache" } : undefined,
    });
    const data = await res.json();
    if (data.success && data.revenue) {
      renderRealRevenueDashboard(data.revenue);
      return true;
    }
    throw new Error(data.errorZh || data.error || "加载失败");
  } catch (err) {
    if (options.refresh) throw err;
    return false;
  }
}

function setupRealRevenueDashboard() {
  const dialog = document.getElementById("real-goal-dialog");
  const form = document.getElementById("real-goal-form");

  document.getElementById("btn-real-goal-edit")?.addEventListener("click", () => {
    if (!realRevenueData?.summary?.goal) return;
    const g = realRevenueData.summary.goal;
    document.getElementById("real-goal-amount").value = g.revenueTarget || 10000;
    document.getElementById("real-goal-days").value = g.targetDays || 90;
    document.getElementById("real-goal-currency").value = g.currency || "USD";
    dialog?.showModal();
  });

  document.getElementById("btn-real-goal-cancel")?.addEventListener("click", () => dialog?.close());

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/revenue/goal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revenueTarget: Number(document.getElementById("real-goal-amount").value),
          targetDays: Number(document.getElementById("real-goal-days").value),
          currency: document.getElementById("real-goal-currency").value,
        }),
      });
      const data = await res.json();
      if (data.success) {
        renderRealRevenueDashboard(data.revenue);
        dialog?.close();
      }
    } catch (_) {
      /* ignore */
    }
  });
}

window.loadRealRevenueDashboard = loadRealRevenueDashboard;
window.renderRealRevenueDashboard = renderRealRevenueDashboard;
window.setupRealRevenueDashboard = setupRealRevenueDashboard;
