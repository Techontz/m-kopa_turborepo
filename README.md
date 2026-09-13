# MikopoFasta (recreation)

Microfinance management system recreated from the live MikopoFasta system, with the modifications
specified in the project Documents applied. See [RECREATION-NOTES.md](RECREATION-NOTES.md) for what was
observed, what was changed and why.

| Part | Stack | Folder |
|---|---|---|
| Frontend | Next.js 16 (App Router, TypeScript, TanStack Query, Bootstrap 4 live theme) | [web/](web/) |
| Backend API | Laravel 13 (PHP 8.4), Sanctum tokens, `/api/v1` | [api/](api/) |
| Database | MySQL 8+ | — |

The browser only talks to Next.js. Next.js keeps the API token in an httpOnly cookie (`mf_token`) and
forwards requests to Laravel through `/api/backend/*` (see `web/src/app/api`).

## Run locally

Requirements: PHP 8.4 + Composer, Node 20+, MySQL.

```bash
# API
cd api
composer install
cp .env.example .env            # set DB_* and DEMO_ADMIN_* values
php artisan key:generate
mysql -uroot -e "CREATE DATABASE mikopofasta_recreation"
php artisan migrate --seed
php artisan storage:link
php artisan serve --port=8000

# Frontend (second terminal)
cd web
npm install
cp .env.example .env.local      # API_URL=http://127.0.0.1:8000
npm run dev -- --port 3000
```

Open http://127.0.0.1:3000 and log in with `DEMO_ADMIN_PHONE` / `DEMO_ADMIN_PASSWORD`.
The demo seeder also creates one user per role (branch manager, loan officer, teller per branch; admin,
finance, HR, credit officer at HQ; zone managers) with the same password.

Scheduled jobs (overdue/penalty processing) need the scheduler: `php artisan schedule:work`.

## Tests and checks

```bash
cd api && php artisan test --compact      # uses DB mikopofasta_recreation_test (phpunit.xml)
cd api && vendor/bin/pint --format agent
cd web && npx tsc --noEmit && npx eslint src && npm run build
```

## Integrations

NIDA, face liveness, SMS, Vodacom (KYC verification and disbursement), bank e-mandate and payment webhooks
are connectors with a deterministic `test` driver, selected in `api/config/integrations.php` via `.env`.
Test mode: OTP `123456`; any 20-digit NIDA number returns a fictional person (numbers starting `0000` are
"not found"); `VODACOM_TEST_OUTCOME=success|failed|callback`.

Public webhooks (HMAC-SHA256 of the body in `X-Signature`):
- `POST /api/webhooks/payments` — repayments (`PAYMENTS_WEBHOOK_SECRET`)
- `POST /api/webhooks/vodacom/disbursement-status` — disbursement callbacks (`VODACOM_CALLBACK_SECRET`)
