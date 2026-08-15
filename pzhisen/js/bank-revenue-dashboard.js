/* global companyId, bankRevenueStandalone */

const BANK_AUTH_SOURCE = "bank-revenue";

const api =
  typeof window !== "undefined" && window.api
    ? window.api
    : (path, options = {}) => fetch(path, { credentials: "include", ...options });

if (typeof window !== "undefined" && !window.api) {
  window.api = api;
}

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

function bankRevenueApiPath(cacheBust = false) {
  const id = window.getCompanyId?.() || window.companyId || companyId;
  let path;
  if (typeof bankRevenueStandalone !== "undefined" && bankRevenueStandalone) {
    path = "/api/revenue/bank";
  } else if (id) {
    path = `/api/companies/${id}/revenue/bank`;
  } else {
    path = "/api/revenue/bank";
  }
  return cacheBust ? `${path}?_=${Date.now()}` : path;
}

let bankRevenueRefreshing = false;
let bankRevenueMerchantView = false;

function setBankRefreshLoading(loading) {
  const refreshBtn = document.getElementById("btn-bank-revenue-refresh");
  if (!refreshBtn) return;
  refreshBtn.disabled = loading;
  refreshBtn.classList.toggle("is-refreshing", loading);
  refreshBtn.setAttribute("aria-busy", loading ? "true" : "false");
  if (loading) {
    refreshBtn.dataset.defaultLabel = refreshBtn.dataset.defaultLabel || refreshBtn.textContent;
    refreshBtn.textContent = "刷新中…";
  } else {
    refreshBtn.textContent = refreshBtn.dataset.defaultLabel || "↻ 刷新";
  }
}

function updateBankRevenueLastRefreshed(iso, statusText) {
  let el = document.getElementById("bank-revenue-last-refreshed");
  const hub = document.getElementById("bank-revenue-hub");
  if (!el && hub) {
    el = document.createElement("p");
    el.id = "bank-revenue-last-refreshed";
    el.className = "bank-revenue-last-refreshed";
    hub.querySelector(".bank-revenue-hub__header")?.appendChild(el);
  }
  if (!el) return;
  if (statusText) {
    el.hidden = false;
    el.textContent = statusText;
    el.classList.add("bank-revenue-last-refreshed--status");
    return;
  }
  el.classList.remove("bank-revenue-last-refreshed--status");
  el.hidden = !iso;
  if (iso) {
    el.textContent = `最后更新：${fmtDateTime(iso)}`;
  }
}

function showBankLoginError(msg) {
  const el = document.getElementById("bank-login-error");
  if (!el) return;
  const text = msg || "";
  el.hidden = !text;
  el.textContent = text;
  if (text) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showBankRegisterError(msg) {
  const el = document.getElementById("bank-register-error");
  if (!el) return;
  el.hidden = !msg;
  el.textContent = msg || "";
}

function showBankOtpError(msg) {
  const el = document.getElementById("bank-otp-error");
  if (!el) return;
  el.hidden = !msg;
  el.textContent = msg || "";
}

function showBankAuthStatus(msg, type = "info") {
  let el = document.getElementById("bank-auth-status");
  const access = document.getElementById("bank-revenue-access");
  if (!el && access) {
    el = document.createElement("p");
    el.id = "bank-auth-status";
    el.className = "bank-revenue-auth-status";
    access.querySelector(".bank-revenue-login")?.prepend(el);
  }
  if (!el) return;
  el.hidden = !msg;
  el.textContent = msg || "";
  el.className = `bank-revenue-auth-status bank-revenue-auth-status--${type}`;
}

function syncCompanyId(id) {
  if (!id) return;
  window.companyId = id;
  if (typeof window.setCompanyId === "function") window.setCompanyId(id);
}

function normalizeBankEmail(email) {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : null;
}

let bankAuthPending = { email: "", password: "" };

function switchBankAuthPanel(panel) {
  document.querySelectorAll(".bank-revenue-auth-panel").forEach((el) => {
    const active = el.dataset.panel === panel;
    el.hidden = !active;
    el.classList.toggle("active", active);
  });
  document.querySelectorAll(".bank-revenue-auth__tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === panel && panel !== "otp");
  });
  if (panel === "otp") {
    document.querySelectorAll(".bank-revenue-auth__tab").forEach((tab) => tab.classList.remove("active"));
  }
}

function showBankLoginPanel(message) {
  const access = document.getElementById("bank-revenue-access");
  const content = document.getElementById("bank-revenue-content");
  const refreshBtn = document.getElementById("btn-bank-revenue-refresh");
  const logoutBtn = document.getElementById("btn-bank-logout");
  const loggedAs = document.getElementById("bank-revenue-logged-as");

  bankRevenueMerchantView = false;
  if (access) access.hidden = false;
  if (content) content.hidden = true;
  if (refreshBtn) {
    refreshBtn.hidden = true;
    refreshBtn.disabled = false;
    refreshBtn.classList.remove("is-refreshing");
  }
  if (logoutBtn) logoutBtn.hidden = true;
  if (loggedAs) loggedAs.hidden = true;

  switchBankAuthPanel("login");

  const intro = access?.querySelector(".bank-revenue-login__intro p");
  if (intro && message) {
    intro.textContent = message;
  }
}

function showBankDashboardPanel(userEmail) {
  const access = document.getElementById("bank-revenue-access");
  const content = document.getElementById("bank-revenue-content");
  const refreshBtn = document.getElementById("btn-bank-revenue-refresh");
  const logoutBtn = document.getElementById("btn-bank-logout");
  const loggedAs = document.getElementById("bank-revenue-logged-as");

  bankRevenueMerchantView = true;
  if (access) access.hidden = true;
  if (content) content.hidden = false;
  if (refreshBtn) {
    refreshBtn.hidden = false;
    refreshBtn.disabled = false;
  }
  if (logoutBtn) logoutBtn.hidden = false;
  if (loggedAs && userEmail) {
    loggedAs.hidden = false;
    loggedAs.textContent = `已登录商户：${userEmail}`;
  }
  showBankLoginError("");
}

function renderBankRevenueDashboard(data) {
  const access = document.getElementById("bank-revenue-access");
  const content = document.getElementById("bank-revenue-content");

  if (!data?.isMerchant) {
    const msg =
      data?.accessMessage ||
      "请使用商户邮箱登录或注册。若已注册，请确认已完成邮箱验证码验证。";
    showBankLoginPanel(msg);
    showBankAuthStatus(
      data?.loggedInEmail
        ? `您已登录为 ${data.loggedInEmail}，但该邮箱暂无商户收账权限。请使用 ORDER_NOTIFY_EMAIL 配置的商户邮箱。`
        : "",
      "warn"
    );
    if (access) access.hidden = false;
    if (content) content.hidden = true;
    return;
  }

  showBankAuthStatus("");

  if (data.accessMessage && !data.summary) {
    showBankLoginPanel(data.accessMessage);
    return;
  }

  showBankDashboardPanel(data.merchantEmail);

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

  updateBankRevenueLastRefreshed(data.updatedAt || new Date().toISOString());
}

async function claimBankMerchantAccess() {
  try {
    const res = await api("/api/revenue/bank/claim-merchant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    return data.granted === true;
  } catch (_) {
    return false;
  }
}

async function loadBankRevenueDashboard(options = {}) {
  const { refresh = false } = options;
  if (bankRevenueRefreshing) return;
  bankRevenueRefreshing = true;

  const keepDashboard = refresh && bankRevenueMerchantView;
  if (refresh) {
    setBankRefreshLoading(true);
    if (keepDashboard) updateBankRevenueLastRefreshed(null, "正在刷新收账数据…");
  }

  try {
    const res = await api(bankRevenueApiPath(refresh), {
      cache: refresh ? "no-store" : "default",
      headers: refresh ? { "Cache-Control": "no-cache", Pragma: "no-cache" } : undefined,
    });
    if (res.status === 401) {
      if (!keepDashboard) {
        showBankLoginPanel("请使用商户邮箱和密码登录，或注册新商户账户。");
        showBankAuthStatus("");
      } else {
        updateBankRevenueLastRefreshed(null, "登录已过期，请重新登录后再刷新。");
      }
      return;
    }
    const data = await res.json();
    if (!data.success || !data.bankRevenue) {
      const msg = data.error || "加载收账数据失败，请稍后重试。";
      if (keepDashboard) {
        updateBankRevenueLastRefreshed(null, msg);
      } else {
        showBankLoginPanel(msg);
      }
      return;
    }

    if (!data.bankRevenue.isMerchant) {
      const meRes = await api("/api/auth/me");
      if (meRes.ok) {
        const me = await meRes.json();
        if (me.user?.email) {
          data.bankRevenue.loggedInEmail = me.user.email;
          const granted = await claimBankMerchantAccess();
          if (granted) {
            const retry = await api(bankRevenueApiPath(refresh), {
              cache: refresh ? "no-store" : "default",
            });
            const retryData = await retry.json();
            if (retryData.success && retryData.bankRevenue?.isMerchant) {
              if (retryData.bankRevenue.companyId) syncCompanyId(retryData.bankRevenue.companyId);
              renderBankRevenueDashboard(retryData.bankRevenue);
              return;
            }
          }
        }
      }
    }
    if (data.bankRevenue.companyId) syncCompanyId(data.bankRevenue.companyId);
    renderBankRevenueDashboard(data.bankRevenue);
  } catch (_) {
    const msg = "加载收账数据失败，请稍后重试。";
    if (keepDashboard) {
      updateBankRevenueLastRefreshed(null, msg);
    } else {
      showBankLoginPanel(msg);
    }
  } finally {
    bankRevenueRefreshing = false;
    if (refresh) setBankRefreshLoading(false);
  }
}

async function refreshBankRevenueDashboard(e) {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  await loadBankRevenueDashboard({ refresh: true });
}

async function handleBankMerchantLogin(e) {
  e?.preventDefault?.();
  showBankLoginError("");
  showBankAuthStatus("正在登录…", "info");

  const email = normalizeBankEmail(document.getElementById("bank-login-email")?.value);
  const password = document.getElementById("bank-login-password")?.value;
  const btn = document.getElementById("btn-bank-login-submit");

  if (!email) {
    showBankAuthStatus("");
    showBankLoginError("请填写有效的商户邮箱");
    return;
  }
  if (!password) {
    showBankAuthStatus("");
    showBankLoginError("请填写登录密码");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.textContent = "登录中…";
  }

  try {
    const res = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, source: BANK_AUTH_SOURCE }),
    });
    const data = await res.json();
    if (!data.success) {
      if (data.needsVerification && data.email) {
        bankAuthPending = { email: data.email, password };
        const hint = document.getElementById("bank-otp-hint");
        if (hint) {
          hint.textContent = `该邮箱尚未完成验证。请查收 ${data.email} 的邮件并填写 6 位验证码。`;
        }
        switchBankAuthPanel("otp");
        showBankLoginError("");
        showBankOtpError("注册尚未完成，请在下方输入邮箱验证码");
        return;
      }
      throw new Error(data.error || "登录失败");
    }

    await claimBankMerchantAccess();

    if (data.company?.id) syncCompanyId(data.company.id);
    localStorage.setItem("pzhisen_email", email);
    if (data.company?.id) localStorage.setItem("pzhisen_company_id", data.company.id);

    await loadBankRevenueDashboard();
    showBankAuthStatus("登录成功", "info");

    if (typeof bankRevenueStandalone === "undefined" || !bankRevenueStandalone) {
      document.getElementById("bank-revenue-hub")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (err) {
    showBankAuthStatus("");
    showBankLoginError(err.message || "登录失败，请检查邮箱和密码");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      btn.textContent =
        typeof bankRevenueStandalone !== "undefined" && bankRevenueStandalone
          ? "登录查看收账数据"
          : "登录查看收账仪表盘";
    }
  }
}

function bindBankAuthForms() {
  if (window.__bankAuthFormsBound) return;
  const loginForm = document.getElementById("bank-revenue-login-form");
  if (!loginForm) return;
  window.__bankAuthFormsBound = true;

  loginForm.setAttribute("novalidate", "novalidate");
  loginForm.addEventListener("submit", handleBankMerchantLogin);

  const registerForm = document.getElementById("bank-revenue-register-form");
  if (registerForm) {
    registerForm.setAttribute("novalidate", "novalidate");
    registerForm.addEventListener("submit", handleBankMerchantRegister);
  }

  const otpForm = document.getElementById("bank-revenue-otp-form");
  if (otpForm) {
    otpForm.setAttribute("novalidate", "novalidate");
    otpForm.addEventListener("submit", handleBankOtpVerify);
  }

  document.getElementById("btn-bank-otp-resend")?.addEventListener("click", handleBankResendOtp);
  document.getElementById("btn-bank-otp-back")?.addEventListener("click", () => {
    showBankOtpError("");
    switchBankAuthPanel("register");
  });
  document.getElementById("bank-tab-login")?.addEventListener("click", () => {
    showBankLoginError("");
    showBankRegisterError("");
    switchBankAuthPanel("login");
  });
  document.getElementById("bank-tab-register")?.addEventListener("click", () => {
    showBankLoginError("");
    showBankRegisterError("");
    switchBankAuthPanel("register");
  });

  const saved = localStorage.getItem("pzhisen_email");
  const emailInput = document.getElementById("bank-login-email");
  const regEmailInput = document.getElementById("bank-register-email");
  if (saved && emailInput && !emailInput.value) emailInput.value = saved;
  if (saved && regEmailInput && !regEmailInput.value) regEmailInput.value = saved;
}

function setupBankRevenueLogin() {
  bindBankAuthForms();
}

async function handleBankMerchantRegister(e) {
  e.preventDefault();
  showBankRegisterError("");

  const email = normalizeBankEmail(document.getElementById("bank-register-email")?.value);
  const password = document.getElementById("bank-register-password")?.value;
  const password2 = document.getElementById("bank-register-password2")?.value;
  const btn = document.getElementById("btn-bank-register-submit");

  if (!email) {
    showBankRegisterError("请填写有效的商户邮箱");
    return;
  }
  if (!password || password.length < 8) {
    showBankRegisterError("密码至少 8 位");
    return;
  }
  if (password !== password2) {
    showBankRegisterError("两次输入的密码不一致");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "发送验证码中…";
  }

  try {
    const res = await api("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, idea: "商户收账仪表盘", source: BANK_AUTH_SOURCE }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "注册失败");

    bankAuthPending = { email, password };
    const hint = document.getElementById("bank-otp-hint");
    if (hint) hint.textContent = `验证码已发送至 ${email}，请填写 6 位数字。`;
    switchBankAuthPanel("otp");
    document.getElementById("bank-otp-code")?.focus();
  } catch (err) {
    showBankRegisterError(err.message || "注册失败，请稍后重试");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "注册商户账户";
    }
  }
}

async function handleBankOtpVerify(e) {
  e.preventDefault();
  showBankOtpError("");

  const code = document.getElementById("bank-otp-code")?.value.trim();
  const btn = document.getElementById("btn-bank-otp-submit");

  if (!bankAuthPending.email || !code || code.length !== 6) {
    showBankOtpError("请填写 6 位邮箱验证码");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "验证中…";
  }

  try {
    const res = await api("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: bankAuthPending.email, code }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "验证失败");

    await claimBankMerchantAccess();

    localStorage.setItem("pzhisen_email", bankAuthPending.email);
    if (data.company?.id) {
      window.companyId = data.company.id;
      localStorage.setItem("pzhisen_company_id", data.company.id);
    }

    bankAuthPending = { email: "", password: "" };
    await loadBankRevenueDashboard();
  } catch (err) {
    showBankOtpError(err.message || "验证码错误或已过期");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "完成注册并查看收账";
    }
  }
}

async function handleBankResendOtp() {
  showBankOtpError("");
  if (!bankAuthPending.email || !bankAuthPending.password) {
    showBankOtpError("请返回注册页重新填写信息");
    return;
  }

  const btn = document.getElementById("btn-bank-otp-resend");
  if (btn) btn.disabled = true;

  try {
    const res = await api("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: bankAuthPending.email,
        password: bankAuthPending.password,
        idea: "商户收账仪表盘",
        source: BANK_AUTH_SOURCE,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "发送失败");
    const hint = document.getElementById("bank-otp-hint");
    if (hint) hint.textContent = `验证码已重新发送至 ${bankAuthPending.email}`;
  } catch (err) {
    showBankOtpError(err.message || "重新发送失败");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function setupBankRevenueDashboard() {
  const refreshBtn = document.getElementById("btn-bank-revenue-refresh");
  const isStandalone = typeof bankRevenueStandalone !== "undefined" && bankRevenueStandalone;
  if (isStandalone && refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = "1";
    refreshBtn.type = "button";
    refreshBtn.addEventListener("click", refreshBankRevenueDashboard);
  }
  setupBankRevenueLogin();
}

window.loadBankRevenueDashboard = loadBankRevenueDashboard;
window.refreshBankRevenueDashboard = refreshBankRevenueDashboard;
window.renderBankRevenueDashboard = renderBankRevenueDashboard;
window.setupBankRevenueDashboard = setupBankRevenueDashboard;
window.setupBankRevenueLogin = setupBankRevenueLogin;
