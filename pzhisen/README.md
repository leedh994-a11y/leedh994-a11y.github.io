# Pzhisen — AI Employee Team Platform

Full-stack app: landing page + AI agent dashboard + OpenRouter backend.

## Quick start (local)

```bash
cd pzhisen
cp .env.example .env
# Add OPENROUTER_API_KEY to .env (https://openrouter.ai/keys)
npm install
npm start
```

Open http://localhost:3000

## Features

- **6 AI Agents**: CEO, Engineering, Marketing, Ads, Support, Ops
- **OpenRouter** integration (live AI when `OPENROUTER_API_KEY` is set)
- **Template fallback** when no API key (demo mode)
- **Dashboard**: run daily standup, chat with agents, live logs
- **Persistent storage**: JSON files in `data/` (mount volume in production)

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/config` | GET | AI status + agent list |
| `/api/signup` | POST | `{ email, idea }` → create company + CEO brief |
| `/api/companies/:id` | GET | Company + logs |
| `/api/companies/:id/run-daily` | POST | Run all agents |
| `/api/companies/:id/agents/:agentId` | POST | `{ message }` → agent reply |
| `/api/logs/global` | GET | Public activity feed for homepage |
| `/api/billing/plans` | GET | Subscription plans |
| `/api/billing/checkout` | POST | Create payment order |
| `/api/billing/subscription` | GET | `?email=` subscription status |

See [PAYMENTS.md](./PAYMENTS.md) for WeChat, Alipay, PayPal setup.

## Independent domain deployment

### Option A: Render (recommended)

1. Push repo to GitHub
2. [Render](https://render.com) → New **Blueprint** → connect repo, select `pzhisen/render.yaml`
3. Set environment variables:
   - `PUBLIC_URL` = `https://pzhisen.com`
   - `OPENROUTER_API_KEY` = your key
4. **Custom domain**: Render dashboard → Settings → Custom Domains → add `pzhisen.com`
5. DNS at your registrar:
   - `CNAME` `@` or `www` → `pzhisen.onrender.com` (or A record per Render docs)

### Option B: Fly.io

```bash
cd pzhisen
fly launch
fly secrets set OPENROUTER_API_KEY=sk-or-...
fly secrets set PUBLIC_URL=https://pzhisen.com
fly volumes create pzhisen_data --size 1
fly deploy
fly certs add pzhisen.com
```

### Option C: Docker (any VPS)

```bash
docker build -t pzhisen .
docker run -d -p 3000:3000 \
  -e OPENROUTER_API_KEY=sk-or-... \
  -e PUBLIC_URL=https://pzhisen.com \
  -v pzhisen-data:/app/data \
  pzhisen
```

Point `pzhisen.com` A record to your server IP. Use Caddy/Nginx reverse proxy with TLS.

### Option D: GitHub Pages (static only — no AI backend)

GitHub Pages serves static files only. Use for marketing mirror; point API subdomain to Render:

- `pzhisen.com` → GitHub Pages (static `index.html`)
- `app.pzhisen.com` → Render (full stack)

## Environment variables

See `.env.example`.

## License

Original work — not affiliated with Polsia or any third party.
