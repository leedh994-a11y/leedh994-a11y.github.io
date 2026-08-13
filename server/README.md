# Sitp GPT Server (yoursite.asia)

Node.js backend for global PayPal subscriptions and **order email notifications** to `ddb1520@outlook.com`.

## Features

- PayPal checkout for Starter / Growth / Scale plans + $599 installation
- 7-day free trial (`POST /api/billing/checkout` with `mode: "trial"`)
- Email alerts on: trial start, order created, payment completed
- GitHub Actions email bridge (when SMTP is blocked on host)

## Quick start

```bash
cp .env.example .env
# Fill PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, GITHUB_NOTIFY_TOKEN (or SMTP)
npm install
npm start
```

Open http://localhost:3000

## Order notification setup

### Recipient (default)

`ORDER_NOTIFY_EMAIL=ddb1520@outlook.com` — already the default in `server/mail.js`.

### Option A — GitHub Actions bridge (recommended)

1. GitHub repo → **Settings → Secrets and variables → Actions**:
   - `SMTP_HOST` = `smtp.gmail.com` (sender Gmail)
   - `SMTP_USER` / `SMTP_PASS` = Gmail app password
   - `ORDER_NOTIFY_EMAIL` = `ddb1520@outlook.com`
2. Server `.env`:
   - `GITHUB_NOTIFY_TOKEN` = fine-grained PAT with `Actions: Write`
   - `GITHUB_NOTIFY_REPO` = `leedh994-a11y/leedh994-a11y.github.io`
3. Test: `POST /api/billing/admin/notify-test` with header `x-admin-key: YOUR_SECRET`

### Option B — Direct SMTP (Outlook)

```env
ORDER_NOTIFY_EMAIL=ddb1520@outlook.com
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=ddb1520@outlook.com
SMTP_PASS=your-outlook-app-password
```

## Deploy to yoursite.asia (nginx + PM2)

```bash
git pull
npm install --omit=dev
# Update .env on server
pm2 restart sitp-gpt || pm2 start server/index.js --name sitp-gpt
```

Nginx should proxy `/api/*` to `http://127.0.0.1:3000`.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/paypal/config` | PayPal SDK config |
| POST | `/api/billing/checkout` | Create order or start trial |
| POST | `/api/billing/activate` | Capture PayPal + activate subscription |
| POST | `/api/paypal/capture-order` | Capture only |
| GET | `/api/billing/subscription?email=` | Lookup subscription |
| POST | `/api/billing/admin/notify-test` | Send test email (admin key) |

## Installation plan

See `billing-installation.js` — wired into checkout for `plan=installation`.
