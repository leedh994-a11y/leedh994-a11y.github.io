import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import {
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  publicUser,
} from "./auth-store.js";
import {
  generateOtpCode,
  savePendingRegistration,
  verifyPendingOtp,
  getPending,
} from "./otp-store.js";
import { sendOtpEmail, isMailConfigured } from "./mail.js";
import { validateEmail } from "./email-validator.js";
import { isSubscriptionActive, getSubscriptionByEmail, ensureLifetimeForEmail } from "./billing-store.js";
import { isGrandfatheredLifetimeEmail } from "./lifetime-grants.js";
import { DEFAULT_PLAN_ID, DEFAULT_CYCLE } from "./plans.js";
import { upsertCompany, getCompany, appendLog, findCompanyByEmail, findCompanyByUserId } from "./store.js";
import { runCeoOnboarding } from "./agents.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "change-me-in-production";
const COOKIE_NAME = "pzhisen_token";
const TOKEN_TTL = "30d";

export function getCookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function setAuthCookie(res, user) {
  res.cookie(COOKIE_NAME, signToken(user), getCookieOptions());
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || bearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: "Login required", errorZh: "请先登录" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid session", errorZh: "登录已失效，请重新登录" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid session", errorZh: "登录已失效，请重新登录" });
  }
}

function bearerToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 8) {
    return "密码至少 8 位";
  }
  return null;
}

function inferIndustry(idea) {
  const t = (idea || "").toLowerCase();
  if (/saas|software|app|platform/.test(t)) return "SaaS";
  if (/ecommerce|shop|store|retail/.test(t)) return "E-commerce";
  if (/ai|ml|gpt|agent/.test(t)) return "AI";
  if (/health|medical/.test(t)) return "Healthcare";
  return "General";
}

async function createCompanyForUser(user, idea) {
  const sub = getSubscriptionByEmail(user.email);
  const subActive = isSubscriptionActive(user.email);
  const company = {
    id: uuidv4(),
    userId: user.id,
    email: user.email,
    name: idea ? idea.split(" ").slice(0, 3).join(" ").trim().slice(0, 80) : "My Company",
    idea: (idea || "AI-powered business").trim().slice(0, 2000),
    industry: inferIndustry(idea),
    stage: "idea",
    createdAt: new Date().toISOString(),
    status: "active",
    plan: subActive ? (sub?.cycle === "lifetime" || sub?.planId === "lifetime" ? "lifetime" : (sub?.cycle || "pro")) : "trial",
  };
  upsertCompany(company);
  appendLog(company.id, { agent: "System", message: `Company "${company.name}" created. Deploying AI team...` });
  try {
    const ceoBrief = await runCeoOnboarding(company);
    appendLog(company.id, { agent: ceoBrief.agentName, message: ceoBrief.content, ai: ceoBrief.ai });
  } catch (e) {
    console.error("CEO onboarding error:", e);
  }
  updateUser(user.id, { companyId: company.id });
  return company;
}

function authPayload(user) {
  let company = user.companyId ? getCompany(user.companyId) : null;
  if (!company) {
    company = findCompanyByUserId(user.id) || findCompanyByEmail(user.email);
    if (company) {
      if (!user.companyId) updateUser(user.id, { companyId: company.id });
      if (!company.userId) {
        company.userId = user.id;
        upsertCompany(company);
      }
    }
  }
  const fresh = getUserById(user.id);
  const subscriptionActive = isSubscriptionActive(fresh.email);
  const lifetimeMember = isGrandfatheredLifetimeEmail(fresh.email);
  return {
    user: publicUser(fresh),
    company,
    subscriptionActive,
    lifetimeMember,
    subscription: getSubscriptionByEmail(fresh.email),
    redirectUrl: company ? `/dashboard.html?company=${company.id}` : null,
    checkoutUrl: `/checkout.html?plan=${DEFAULT_PLAN_ID}&cycle=${DEFAULT_CYCLE}`,
  };
}

export async function registerHandler(req, res) {
  try {
    const { email, password, idea } = req.body || {};
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      return res.status(400).json({ success: false, error: emailCheck.error });
    }
    const pwdErr = validatePassword(password);
    if (pwdErr) return res.status(400).json({ success: false, error: pwdErr });

    const normalized = emailCheck.email;
    if (getUserByEmail(normalized)) {
      return res.status(400).json({ success: false, error: "该邮箱已注册，请直接登录" });
    }

    const code = generateOtpCode();
    const passwordHash = await bcrypt.hash(password, 10);
    savePendingRegistration({ email: normalized, passwordHash, idea, code });

    const mailResult = await sendOtpEmail(normalized, code);
    const body = {
      success: true,
      needsVerification: true,
      email: normalized,
      message: "验证码已发送至您的邮箱，请查收并填写 6 位验证码",
      mailConfigured: isMailConfigured(),
    };
    if (mailResult.devMode && process.env.OTP_DEV_EXPOSE === "true") {
      body.devCode = code;
    }
    res.json(body);
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function resendOtpHandler(req, res) {
  try {
    const { email, password, idea } = req.body || {};
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      return res.status(400).json({ success: false, error: emailCheck.error });
    }
    const normalized = emailCheck.email;
    const pending = getPending(normalized);
    if (!pending) {
      return res.status(400).json({ success: false, error: "请重新填写注册信息" });
    }
    const code = generateOtpCode();
    savePendingRegistration({
      email: normalized,
      passwordHash: pending.passwordHash,
      idea: idea || pending.idea,
      code,
    });
    await sendOtpEmail(normalized, code);
    res.json({ success: true, message: "验证码已重新发送" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function verifyOtpHandler(req, res) {
  try {
    const { email, code } = req.body || {};
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok || !code) {
      return res.status(400).json({ success: false, error: "请填写邮箱和验证码" });
    }
    const normalized = emailCheck.email;

    const result = verifyPendingOtp(normalized, String(code).trim());
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const { entry } = result;
    const user = createUser({
      id: uuidv4(),
      email: normalized,
      passwordHash: entry.passwordHash,
    });

    const company = await createCompanyForUser(user, entry.idea);
    ensureLifetimeForEmail(normalized);
    const freshUser = getUserById(user.id);
    setAuthCookie(res, freshUser);

    res.json({
      success: true,
      message: "注册成功",
      ...authPayload(freshUser),
    });
  } catch (err) {
    console.error("verify otp error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function loginHandler(req, res) {
  try {
    const { email, password } = req.body || {};
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok || !password) {
      return res.status(400).json({ success: false, error: "请填写邮箱和密码" });
    }
    const normalized = emailCheck.email;

    const user = getUserByEmail(normalized);
    if (!user) {
      return res.status(401).json({ success: false, error: "邮箱或密码错误" });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, error: "邮箱或密码错误" });
    }

    ensureLifetimeForEmail(normalized);

    setAuthCookie(res, user);
    res.json({ success: true, message: "登录成功", ...authPayload(user) });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export function logoutHandler(_req, res) {
  clearAuthCookie(res);
  res.json({ success: true });
}

export function meHandler(req, res) {
  ensureLifetimeForEmail(req.user.email);
  res.json({ success: true, ...authPayload(req.user) });
}

export function requireCompanyAccess(req, res, next) {
  const company = getCompany(req.params.id);
  if (!company) {
    return res.status(404).json({ success: false, error: "Company not found" });
  }
  if (company.userId && company.userId !== req.user.id) {
    return res.status(403).json({ success: false, error: "Access denied", errorZh: "无权访问" });
  }
  if (!company.userId && company.email !== req.user.email) {
    return res.status(403).json({ success: false, error: "Access denied", errorZh: "无权访问" });
  }
  req.company = company;
  next();
}
