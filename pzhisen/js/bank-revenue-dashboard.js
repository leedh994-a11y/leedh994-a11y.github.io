/* global companyId, api, bankRevenueStandalone */

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

function bankRevenueApiPath() {
  if (typeof bankRevenueStandalone !== "undefined" && bankRevenueStandalone) {
    return "/api/revenue/bank";
  }
  if (companyId) return `/api/companies/${companyId}/revenue/bank`;
  return "/api/revenue/bank";
}

function showBankLoginError(msg) {
  const el = document.getElementById("bank-login-error");
  if (!el) return;
  el.hidden = !msg;
  el.textContent = msg || "";
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

  if (access) access.hidden = false;
  if (content) content.hidden = true;
  if (refreshBtn) refreshBtn.hidden = true;
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

  if (access) access.hidden = true;
  if (content) content.hidden = false;
  if (refreshBtn) refreshBtn.hidden = false;
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
    showBankLoginPanel(data?.accessMessage || "请使用商户邮箱登录后查看中国银行收账数据。");
    if (access) access.hidden = false;
    if (content) content.hidden = true;
    return;
  }

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
}

async function loadBankRevenueDashboard() {
  try {
    const res = await api(bankRevenueApiPath());
    if (res.status === 401) {
      showBankLoginPanel("请使用商户邮箱和密码登录，查看中国银行收账数据。");
      return;
    }
    const data = await res.json();
    if (data.success && data.bankRevenue) {
      if (data.bankRevenue.companyId) window.companyId = data.bankRevenue.companyId;
      renderBankRevenueDashboard(data.bankRevenue);
    }
  } catch (_) {
    showBankLoginPanel("加载收账数据失败，请稍后重试。");
  }
}

async function handleBankMerchantLogin(e) {
  e.preventDefault();
  showBankLoginError("");

  const email = document.getElementById("bank-login-email")?.value.trim();
  const password = document.getElementById("bank-login-password")?.value;
  const btn = document.getElementById("btn-bank-login-submit");

  if (!email?.includes("@") || !password) {
    showBankLoginError("请填写商户邮箱和密码");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "登录中…";
  }

  try {
    const res = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "登录失败");

    if (data.company?.id) window.companyId = data.company.id;
    localStorage.setItem("pzhisen_email", email);
    if (data.company?.id) localStorage.setItem("pzhisen_company_id", data.company.id);

    await loadBankRevenueDashboard();

    if (typeof bankRevenueStandalone === "undefined" || !bankRevenueStandalone) {
      document.getElementById("bank-revenue-hub")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (err) {
    showBankLoginError(err.message || "登录失败，请检查邮箱和密码");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent =
        typeof bankRevenueStandalone !== "undefined" && bankRevenueStandalone
          ? "登录查看收账数据"
          : "登录查看收账仪表盘";
    }
  }
}

function setupBankRevenueLogin() {
  const loginForm = document.getElementById("bank-revenue-login-form");
  if (!loginForm || loginForm.dataset.bound === "1") return;
  loginForm.dataset.bound = "1";
  loginForm.addEventListener("submit", handleBankMerchantLogin);

  document.getElementById("bank-revenue-register-form")?.addEventListener("submit", handleBankMerchantRegister);
  document.getElementById("bank-revenue-otp-form")?.addEventListener("submit", handleBankOtpVerify);
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
      body: JSON.stringify({ email, password, idea: "商户收账仪表盘" }),
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
  document.getElementById("btn-bank-revenue-refresh")?.addEventListener("click", loadBankRevenueDashboard);
  setupBankRevenueLogin();
}

window.loadBankRevenueDashboard = loadBankRevenueDashboard;
window.renderBankRevenueDashboard = renderBankRevenueDashboard;
window.setupBankRevenueDashboard = setupBankRevenueDashboard;
window.setupBankRevenueLogin = setupBankRevenueLogin;
