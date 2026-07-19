const api = (path, options = {}) =>
  fetch(path, { credentials: "include", ...options });

function showError(el, msg) {
  el.hidden = !msg;
  el.textContent = msg || "";
}

function afterAuth(data) {
  if (data.company?.id) {
    localStorage.setItem("pzhisen_company_id", data.company.id);
  }
  if (data.user?.email) {
    localStorage.setItem("pzhisen_email", data.user.email);
  }
  if (data.subscriptionActive && data.redirectUrl) {
    location.href = data.redirectUrl;
  } else {
    location.href = data.checkoutUrl || "/checkout.html?plan=lifetime&cycle=lifetime";
  }
}

// Tabs
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const otpForm = document.getElementById("otp-form");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");

function showStep(step) {
  [loginForm, registerForm, otpForm].forEach((f) => f.classList.remove("active"));
  step.classList.add("active");
}

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  showStep(loginForm);
});

tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  showStep(registerForm);
});

let pendingEmail = "";
let pendingIdea = "";
let pendingPassword = "";

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("register-error");
  showError(errEl, "");

  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const password2 = document.getElementById("reg-password2").value;
  const idea = document.getElementById("reg-idea").value.trim();

  if (password !== password2) {
    showError(errEl, "两次密码不一致");
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "发送中…";

  try {
    const res = await api("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, idea }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    pendingEmail = email;
    pendingIdea = idea;
    pendingPassword = password;
    document.getElementById("otp-hint").textContent =
      `验证码已发送至 ${email}，请查收邮件并填写 6 位数字。`;
    if (data.devCode) {
      document.getElementById("otp-hint").textContent += `（开发模式验证码：${data.devCode}）`;
    }
    showStep(otpForm);
  } catch (err) {
    showError(errEl, err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "发送验证码";
  }
});

otpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("otp-error");
  showError(errEl, "");

  const code = document.getElementById("otp-code").value.trim();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    const res = await api("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pendingEmail, code }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    afterAuth(data);
  } catch (err) {
    showError(errEl, err.message);
    btn.disabled = false;
  }
});

document.getElementById("btn-resend").addEventListener("click", async () => {
  const errEl = document.getElementById("otp-error");
  showError(errEl, "");
  try {
    const res = await api("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pendingEmail, password: pendingPassword, idea: pendingIdea }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    document.getElementById("otp-hint").textContent = `验证码已重新发送至 ${pendingEmail}`;
  } catch (err) {
    showError(errEl, err.message);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("login-error");
  showError(errEl, "");

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "登录中…";

  try {
    const res = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    afterAuth(data);
  } catch (err) {
    showError(errEl, err.message);
    btn.disabled = false;
    btn.textContent = "登录";
  }
});

// Already logged in?
api("/api/auth/me").then(async (res) => {
  if (!res.ok) return;
  const data = await res.json();
  if (data.success && data.user) {
    afterAuth(data);
  }
});

const params = new URLSearchParams(location.search);
if (params.get("register") === "1") tabRegister.click();
