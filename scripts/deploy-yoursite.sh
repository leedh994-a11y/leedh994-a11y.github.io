#!/usr/bin/env bash
set -euo pipefail

# 1. Find project directory
if [ -d /var/www/yoursite ]; then
  cd /var/www/yoursite
elif [ -d "$HOME/leedh994-a11y.github.io" ]; then
  cd "$HOME/leedh994-a11y.github.io"
elif [ -d /root/leedh994-a11y.github.io ]; then
  cd /root/leedh994-a11y.github.io
else
  echo "Project directory not found. cd manually and rerun."
  pwd
  ls -la
  exit 1
fi

echo "Project dir: $(pwd)"

# 2. Pull latest code
git pull origin cursor/yoursite-order-notify-fd54

# 3. Install dependencies
npm install

# 4. Write PayPal config to .env
cat > .env << 'EOF'
PUBLIC_URL=https://yoursite.asia
PAYPAL_CLIENT_ID=BAA_HhKZAA-3hl-Bx67hXC5snkRbipDaPzkWGBvcZKYwpYe9IQAVSrdtkHmtwTmsN2YPBZDpkVb9RHc3eU
PAYPAL_CLIENT_SECRET=EJJPnzMQ45QLd8PeMZsF4txbFUhpR_hzVbY-49TRbbYE55I_RUlZ0rGgDB2igUDJd-GFf3CkVgDDLK5-
PAYPAL_MODE=live
ORDER_NOTIFY_EMAIL=ddb1520@outlook.com
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=ddb1520@outlook.com
SMTP_PASS=CHANGE_ME_OUTLOOK_APP_PASSWORD
BILLING_ADMIN_SECRET=sitp-notify-admin-2026
PORT=3000
DATA_DIR=./server/data
EOF

# 5. Restart service
pm2 restart sitp-gpt || pm2 start server/index.js --name sitp-gpt

# 6. Verify
sleep 2
curl -s https://yoursite.asia/api/paypal/status | head -c 300
echo ""
pm2 list
