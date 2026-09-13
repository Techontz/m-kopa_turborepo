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

Open http://127.0.0.1:3000 and log in with one of the demo accounts below.

### Demo accounts (local/demo only)

Created by `php artisan migrate:fresh --seed` (`MasterDataSeeder::seedDemoAccounts`, values from
`api/config/demo.php`, overridable with the `DEMO_*` variables in `api/.env`). These are fixed test
credentials for local development — never use them on a shared or production deployment.

| Role | Login (phone) | Password | Employee ID | Placement |
|---|---|---|---|---|
| Super Admin | 0700000000 | password | MK-0012024 | Head office, all branches |
| Admin | 0700000008 | password | MK-9082024 | Head office, all branches |
| Teller | 0700000001 | password | MK-9012024 | Kakonko branch |
| Finance | 0700000002 | password | MK-9022024 | Head office, all branches |
| Zone Manager | 0700000003 | password | MK-9032024 | KANDA YA ZIWA zone (Head office, Kakonko, Missenyi) |
| Branch Manager | 0700000004 | password | MK-9042024 | Kakonko branch |
| Loan Officer | 0700000005 | password | MK-9052024 | Kakonko branch |
| Credit Officer | 0700000006 | password | MK-9062024 | Head office, all branches |
| HR | 0700000007 | password | MK-9072024 | Head office, all branches |

The demo seeder also adds extra staff with random names/phones in the other branches and zone (password
`password`) to populate lists. The live system's test login is not used by this project.

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
