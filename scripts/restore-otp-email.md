# 恢复注册验证码邮件（QQ 邮箱 + GitHub Actions 配置）

几个月前的配置：Render 将 **QQ 邮箱** 凭据传给 GitHub Actions 发送验证码。

## Render 环境变量（pzhisen 服务）

https://dashboard.render.com → pzhisen → Environment

| 变量 | 值 |
|------|-----|
| `SMTP_HOST` | `smtp.qq.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `768204575@qq.com` |
| `SMTP_PASS` | QQ 邮箱授权码 |
| `SMTP_FROM` | `768204575@qq.com` |
| `OTP_SMTP_USER` | `768204575@qq.com` |
| `OTP_SMTP_PASS` | QQ 邮箱授权码（与 SMTP_PASS 相同） |
| `OTP_SMTP_HOST` | `smtp.qq.com`（可选，代码会自动识别） |
| `GITHUB_NOTIFY_TOKEN` | GitHub PAT（Actions Read & Write） |
| `GITHUB_NOTIFY_REPO` | `leedh994-a11y/leedh994-a11y.github.io` |

QQ 邮箱授权码获取：QQ 邮箱 → 设置 → 账户 → POP3/SMTP → 开启服务 → 生成授权码

## GitHub Secrets（备用，Render 会优先传 QQ 凭据）

https://github.com/leedh994-a11y/leedh994-a11y.github.io/settings/secrets/actions

可与 Render 保持一致，或留空（OTP 使用 Render 传入的 QQ 凭据）：

| Secret | 值 |
|--------|-----|
| `SMTP_HOST` | `smtp.qq.com` |
| `SMTP_USER` | `768204575@qq.com` |
| `SMTP_PASS` | QQ 邮箱授权码 |

## 验证

1. 打开 https://pzhisen.online/login.html 注册
2. 收到主题为 **「Pzhisen 注册验证码」** 的邮件
3. GitHub Actions 日志应显示 `SMTP host=smtp.qq.com user=***@qq.com`
