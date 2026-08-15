/* global companyId, api */

function fmtCny(amount) {
  return `¥${Number(amount || 0).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function renderBankRevenueDashboard(data) {
  const access = document.getElementById("bank-revenue-access");
  const content = document.getElementById("bank-revenue-content");

  if (!data?.isMerchant) {
    if (access) {
      access.hidden = false;
      access.textContent = data?.accessMessage || "暂无权限查看中国银行收账数据。";
    }
    if (content) content.hidden = true;
    return;
  }

  if (access) access.hidden = true;
  if (content) content.hidden = false;

  const s = data.summary || {};
  const todayEl = document.getElementById("bank-today-total");
  const allEl = document.getElementById("bank-all-total");
  if (todayEl) todayEl.textContent = fmtCny(s.todayTotal);
  if (allEl) allEl.textContent = fmtCny(s.totalAmount);

  const todayCount = document.getElementById("bank-today-count");
  if (todayCount) todayCount.textContent = `${s.todayCount || 0} 笔今日结算`;
  const allMeta = document.getElementById("bank-all-meta");
  if (allMeta) {
    allMeta.textContent = `${s.totalCount || 0} 笔 · ${s.customerCount || 0} 位客户${
      s.pendingCount ? ` · ${s.pendingCount} 笔待确认` : ""
    }`;
  }

  const channelsEl = document.getElementById("bank-revenue-channels");
  if (channelsEl) {
    channelsEl.innerHTML = (data.channels || [])
      .map((ch) => {
        const acc = ch.account || {};
        const cls = ch.id === "boc" ? "bank-channel-card--boc" : "bank-channel-card--visa";
        return `
        <article class="bank-channel-card ${cls}">
          <div class="bank-channel-card__head">
            <span class="bank-channel-card__icon">${ch.icon || "🏦"}</span>
            <div>
              <h3 class="bank-channel-card__title">${ch.label}</h3>
              <p class="bank-channel-card__subtitle">${ch.subtitle} · ${ch.audience}</p>
            </div>
          </div>
          <div class="bank-channel-card__account">
            ${acc.configured
              ? `<strong>${acc.label}</strong><br>
                 ${acc.bankName} · ${acc.accountName}<br>
                 卡号 ${acc.accountNumberMask} · ${acc.network}`
              : "收款账户未配置，请在 Render 设置 BANK_* 环境变量"}
          </div>
          <div class="bank-channel-card__stats">
            <div class="bank-channel-stat">
              <span class="bank-channel-stat__label">今日进账</span>
              <strong class="bank-channel-stat__value">${fmtCny(ch.todayAmount)}</strong>
              <span class="bank-channel-stat__meta">${ch.todayCount || 0} 笔</span>
            </div>
            <div class="bank-channel-stat">
              <span class="bank-channel-stat__label">累计收益</span>
              <strong class="bank-channel-stat__value">${fmtCny(ch.totalAmount)}</strong>
              <span class="bank-channel-stat__meta">${ch.totalCount || 0} 笔 · ${ch.customerCount || 0} 客户</span>
            </div>
          </div>
        </article>`;
      })
      .join("");
  }

  const dailyBody = document.getElementById("bank-daily-tbody");
  if (dailyBody) {
    dailyBody.innerHTML = (data.byDay || [])
      .map(
        (d) => `
      <tr>
        <td>${fmtDate(d.date)}</td>
        <td class="bank-amount">${d.boc > 0 ? fmtCny(d.boc) : "—"}</td>
        <td class="bank-amount" style="color:#1d4ed8">${d.visa > 0 ? fmtCny(d.visa) : "—"}</td>
        <td><strong>${fmtCny(d.total)}</strong></td>
        <td>${d.count}</td>
      </tr>`
      )
      .join("") || '<tr><td colspan="5" class="bank-revenue-empty">暂无银行卡结算记录</td></tr>';
  }

  const ordersBody = document.getElementById("bank-orders-tbody");
  if (ordersBody) {
    ordersBody.innerHTML = (data.orders || [])
      .map((o) => {
        const tagCls = o.channel === "boc" ? "bank-channel-tag--boc" : "bank-channel-tag--visa";
        return `
      <tr>
        <td>${fmtDateTime(o.date)}</td>
        <td>${o.customerEmailMask}</td>
        <td><span class="bank-channel-tag ${tagCls}">${o.channelLabel}</span></td>
        <td>${o.planLabel} · ${o.cycle || "—"}</td>
        <td class="bank-amount">${fmtCny(o.amount)}</td>
        <td><code>${o.transferCode}</code></td>
      </tr>`;
      })
      .join("") || '<tr><td colspan="6" class="bank-revenue-empty">暂无已结算银行卡订单</td></tr>';
  }

  const footnote = document.getElementById("bank-revenue-footnote");
  if (footnote) {
    const same = data.accounts?.samePhysicalCard;
    footnote.textContent = same
      ? "数据来源：真实银行卡转账订单（orders.json）。中国用户与全球用户可能共用同一张双标卡入账，系统按用户类型分账统计。新订单在结账时会记录入账通道；历史订单按邮箱域名自动归类。"
      : "数据来源：真实银行卡转账订单（orders.json）。中国用户入账至中国银行借记卡，全球用户入账至 VISA 借记卡。新订单在结账时记录入账通道；历史订单按邮箱域名自动归类。";
  }
}

async function loadBankRevenueDashboard() {
  if (!companyId) return;
  try {
    const res = await api(`/api/companies/${companyId}/revenue/bank`);
    const data = await res.json();
    if (data.success && data.bankRevenue) renderBankRevenueDashboard(data.bankRevenue);
  } catch (_) {
    /* ignore */
  }
}

function setupBankRevenueDashboard() {
  document.getElementById("btn-bank-revenue-refresh")?.addEventListener("click", loadBankRevenueDashboard);
}

window.loadBankRevenueDashboard = loadBankRevenueDashboard;
window.renderBankRevenueDashboard = renderBankRevenueDashboard;
window.setupBankRevenueDashboard = setupBankRevenueDashboard;
