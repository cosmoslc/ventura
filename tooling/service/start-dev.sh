#!/usr/bin/env bash
# ventura-dev.service: faqat admin panel (3000) va deploy ishchisi. edu-crm/sawmill/pc-crm kerak bo'lsa
# qo'lda: pnpm --filter @ventura/edu-crm dev
set -e
export PATH="/home/warcassa/.local/bin:$PATH"
cd /home/warcassa/Projects/Ventura
exec /home/warcassa/.local/bin/pnpm exec turbo run dev --filter=@ventura/panel --filter=@ventura/worker
