# Pzhisen 部署上线指南（Render + 独立域名）

按本文操作后，全球用户可通过 `https://pzhisen.com`（或你的域名）访问网站并使用 AI Agent 功能。

---

## 前置条件

- GitHub 仓库：`leedh994-a11y/leedh994-a11y.github.io`（代码在 `pzhisen/` 目录）
- [Render](https://render.com) 账号（可用 GitHub 登录）
- 已注册的域名（如 `pzhisen.com`）
- （推荐）[OpenRouter](https://openrouter.ai/keys) API Key，用于真实 AI Agent

---

## 第一步：合并代码到 main 分支

在 GitHub 合并 PR：`cursor/pzhisen-landing-fd54` → `main`

或本地执行：

```bash
git checkout main
git merge cursor/pzhisen-landing-fd54
git push origin main
```

---

## 第二步：在 Render 创建 Web 服务

### 方式 A — Blueprint（推荐，一键）

1. 打开 https://dashboard.render.com/blueprints
2. 点击 **New Blueprint Instance**
3. 连接 GitHub 仓库 `leedh994-a11y.github.io`
4. Render 会自动读取仓库根目录的 **`render.yaml`**
5. 点击 **Apply**

### 方式 B — 手动创建 Docker 服务

1. https://dashboard.render.com → **New +** → **Web Service**
2. 连接同一 GitHub 仓库
3. 配置：

| 项 | 值 |
|----|-----|
| Name | `pzhisen` |
| Region | Oregon (US West) 或离用户最近的区域 |
| Branch | `main` |
| Root Directory | `pzhisen` |
| Runtime | **Docker** |
| Plan | Free（或 Starter 获得常驻实例） |

4. **Create Web Service**

---

## 第三步：配置环境变量

在 Render → 你的服务 → **Environment** 中添加：

| 变量 | 值 | 必填 |
|------|-----|------|
| `PUBLIC_URL` | `https://pzhisen.com` | ✅ 绑域名后填写 |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | 推荐（无则模板模式） |
| `OPENROUTER_SITE_URL` | `https://pzhisen.com` | 推荐 |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | 可选 |
| `OPENROUTER_CEO_MODEL` | `anthropic/claude-sonnet-4` | 可选 |
| `NODE_ENV` | `production` | 已默认 |
| `DATA_DIR` | `/tmp/pzhisen-data` | 已默认 |

保存后 Render 会自动重新部署。

> **Free 套餐说明**：免费实例会在 15 分钟无访问后休眠，首次打开需等待约 30–60 秒唤醒。数据存在临时目录，重启可能清空；升级 Starter + Disk 可持久化。

---

## 第四步：验证 Render 默认域名

部署成功后，Render 会分配类似：

```
https://pzhisen.onrender.com
```

在浏览器打开并检查：

- 首页 4 个 Hero 区块正常显示
- https://pzhisen.onrender.com/api/health 返回 `{"ok":true,"service":"pzhisen",...}`
- 注册表单提交后跳转到 `/dashboard.html?company=...`

---

## 第五步：绑定独立域名 pzhisen.com

### 5.1 在 Render 添加域名

1. Render 服务 → **Settings** → **Custom Domains**
2. 点击 **Add Custom Domain**
3. 添加：
   - `pzhisen.com`
   - `www.pzhisen.com`（建议同时添加）

Render 会显示需要配置的 **DNS 记录**。

### 5.2 在域名注册商配置 DNS

以下为常见配置（以 Render 控制台显示为准）：

#### 根域名 `pzhisen.com`

| 类型 | 名称 | 值 |
|------|------|-----|
| **A** | `@` | `216.24.57.1`（Render 当前 Anycast IP，以控制台为准） |

或部分注册商支持：

| 类型 | 名称 | 值 |
|------|------|-----|
| **ALIAS / ANAME** | `@` | `pzhisen.onrender.com` |

#### 子域名 `www.pzhisen.com`

| 类型 | 名称 | 值 |
|------|------|-----|
| **CNAME** | `www` | `pzhisen.onrender.com` |

### 5.3 常见注册商示例

**Cloudflare**

1. DNS → Add record
2. `A` / `@` → `216.24.57.1`，Proxy 可先关闭（灰云）完成验证
3. `CNAME` / `www` → `pzhisen.onrender.com`
4. SSL/TLS → Full

**GoDaddy / Namecheap / 阿里云 / 腾讯云**

1. 进入域名 DNS 管理
2. 添加上述 A 记录和 CNAME
3. 删除冲突的旧 A/CNAME 记录
4. 等待传播（通常 5 分钟–48 小时）

### 5.4 验证与 HTTPS

- DNS 生效后，Render 自动签发 **Let's Encrypt** 证书
- 状态变为 **Verified** 且证书 **Active**
- 更新环境变量：`PUBLIC_URL=https://pzhisen.com`

---

## 第六步：全球访问检查清单

| 检查项 | 预期结果 |
|--------|----------|
| `https://pzhisen.com` | 首页加载 |
| `https://www.pzhisen.com` | 跳转或同样可访问 |
| `/api/health` | JSON `ok: true` |
| 注册 + Dashboard | 可创建公司、运行 Agent |
| 手机浏览器 | 页面响应式正常 |

可用工具检测 DNS：https://www.whatsmydns.net

---

## 故障排查

### 部署失败

```bash
# 本地测试
cd pzhisen && npm install && npm start
curl http://localhost:3000/api/health
```

查看 Render → **Logs** 中的构建/运行错误。

### 域名无法访问

- 确认 DNS 记录与 Render 控制台一致
- `dig pzhisen.com` / `dig www.pzhisen.com` 检查解析
- 证书未签发：确保 DNS 已指向 Render，等待最多 24h

### 免费实例很慢

- 首次访问需唤醒休眠实例（正常现象）
- 升级 **Starter ($7/mo)** 可避免休眠

### AI 无真实回复

- 确认已设置 `OPENROUTER_API_KEY`
- `/api/config` 中 `aiEnabled` 应为 `true`

---

## 架构示意

```
用户浏览器 (全球)
       ↓ HTTPS
  pzhisen.com  (DNS → Render)
       ↓
  Render Web Service (Docker)
  ├── 静态页面 (index, dashboard)
  └── API (/api/signup, /api/agents/...)
       ↓
  OpenRouter API (AI Agents)
```

---

## 下一步（可选）

- [ ] 升级 Starter 计划 + 持久化磁盘
- [ ] 接入 Stripe/PayPal 订阅付费
- [ ] 配置 `RENDER_DEPLOY_HOOK_URL` 实现 Git push 自动部署

---

**完成后你的站点即可对全球用户开放浏览。** 支付订阅需另行开发，见项目 README。
