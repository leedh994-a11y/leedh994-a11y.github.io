# 恢复注册验证码邮件（几个月前的工作配置）

注册验证码通过 **GitHub Actions → Gmail SMTP** 发送（Render 免费版无法直连 SMTP）。

## 一、GitHub Secrets（必须）

打开：https://github.com/leedh994-a11y/leedh994-a11y.github.io/settings/secrets/actions

设置或更新：

| Secret | 值 |
|--------|-----|
| `SMTP_USER` | `LeeDh994@gmail.com` |
| `SMTP_PASS` | Gmail 应用专用密码（16 位，无空格） |
| `SMTP_FROM` | `LeeDh994@gmail.com` |
| `ORDER_NOTIFY_EMAIL` | `leedh994@gmail.com` |

Gmail 应用专用密码：https://myaccount.google.com/apppasswords

## 二、Render 环境变量（pzhisen 服务）

打开：https://dashboard.render.com → pzhisen → Environment

**必须设置：**

| 变量 | 值 |
|------|-----|
| `GITHUB_NOTIFY_TOKEN` | GitHub PAT（权限：Actions Read & Write） |
| `GITHUB_NOTIFY_REPO` | `leedh994-a11y/leedh994-a11y.github.io` |

**删除或覆盖错误的 QQ 邮箱变量**（会导致验证码发不出去）：

- 删除 `OTP_SMTP_USER=768204575@qq.com`
- 删除 `OTP_SMTP_PASS=...`
- 或改为 Gmail：
  - `OTP_SMTP_USER=LeeDh994@gmail.com`
  - `OTP_SMTP_PASS=<Gmail应用专用密码>`
  - `SMTP_USER=LeeDh994@gmail.com`
  - `SMTP_PASS=<Gmail应用专用密码>`

保存后 Render 会自动重新部署。

## 三、验证

1. 打开 https://pzhisen.online/login.html
2. 用真实邮箱注册
3. 应收到主题为 **「Pzhisen 注册验证码」** 的邮件
4. GitHub Actions 应显示绿色成功：
   https://github.com/leedh994-a11y/leedh994-a11y.github.io/actions/workflows/order-notify-email.yml

## 四、故障排查

| 现象 | 原因 | 处理 |
|------|------|------|
| API 返回成功但收不到邮件 | GitHub `SMTP_PASS` 过期 | 更新 Secret |
| Actions 报 `SMTPAuthenticationError` | QQ 邮箱配在 Gmail SMTP 上 | 删除 Render 的 QQ 变量，用 Gmail |
| `mailSent: false` | `GITHUB_NOTIFY_TOKEN` 未配置 | 在 Render 添加 PAT |
| 注册页显示「邮件服务未配置」 | 缺少 `GITHUB_NOTIFY_TOKEN` | 同上 |
