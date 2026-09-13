# MikopoFasta recreation notes

This project is an independent recreation of the MikopoFasta microfinance system (live at
https://mikopofasta.co.tz). It shares no code, database or repository with any other MikopoFasta project.

Two sources were used:

1. **The live system** — audited read-only with an authorised test account. It defines the modules,
   navigation, labels (including live spellings such as "Penarty", "Aprove", "Transfor", "Insurelance"),
   page layouts, form fields, dropdowns, table columns and the observable workflows and calculations.
2. **The Documents folder** — the business owner's requirements (ACCOUNT OVERVIEW, CUSTOMER REGISTRATION
   OVERVIEW, LOAN PROCESS OVERVIEW, REPAYMENT OVERVIEW, OVERVIEW ALL REPORT, OVERVIEW STAFF COMMISSION, the
   registration form prototypes, customer-types.json, all-ward.json and handwritten notes). Where the
   Documents and the live system differ, the Documents win.

Anything neither source specifies was implemented conventionally and is marked `Inferred:` in the PHPDoc
of the method concerned.

## Architecture

- `web/` — Next.js frontend. Every screen was rebuilt in React; the live look (Lucid/Bootstrap 4 theme,
  cards, blue table headers, DataTables-style lists, SweetAlert messages, orange frame on dashboard and
  teller) is reproduced with shared components in `web/src/components/ui`. Menu: `web/src/lib/menu.ts`.
- `api/` — Laravel API. Controllers in `app/Http/Controllers/Api/V1/<Module>`, one route file per module in
  `routes/api/*.php`, business logic in `app/Services`, connectors in `app/Integrations`.
- The earlier Laravel Blade recreation was removed; its behaviour was ported into the API and covered by
  API feature tests.

## Security model

- Login by phone + password (`POST /api/v1/auth/login`, rate-limited), Sanctum token held server-side by
  Next.js in an httpOnly cookie.
- Roles with permission keys (`api/config/permissions.php`), editable under Settings → Roles & Permissions.
  Data scope per role: company (Super Admin, Admin, Finance, HR, Credit Officer), zone (Zone Manager),
  branch (Branch Manager, Loan Officer, Teller).
- Every endpoint checks a permission and limits data to the user's scope. Capital is visible only with
  `capital.view`.
- Audit trail (`audit_logs`) for configuration, customers, loans, money records and every workflow transition.

## Business rules applied everywhere

- **Repayment allocation: Principal → Penalty → Interest** (then insurance). This is the one allocation in
  `LoanService::allocate()` / `outstanding()`, used by teller payments, webhooks, suspense allocation,
  savings "clear loan", statements and reports.
- **Double-entry ledger** (`App\Services\Ledger`, chart of accounts `App\Enums\Account`): every money
  movement is a balanced journal entry. Entries are never edited or deleted; corrections are reversals
  with a reason. Closed accounting periods are locked.
- Reserve = configurable % of interest, cut on every repayment.
- Branch expenses and branch salaries are paid from the branch Interest account; HQ expenses from HQ accounts.

## Modules

| Module | Live system | Documents modifications |
|---|---|---|
| Dashboard | Recreated | Account cards follow permissions |
| Settings | Branch, formulas, loan categories, fees, penalty, reserve, company profile | Zones; roles & permissions; customer categories as rule engine (risk, limits, documents, allowed products); product `requires_mandate`; loan freeze period |
| Capital | Share holders, capital, floats | Dividends (70% reinvested / 30% to shareholders by share of capital); no deleting capital entries |
| Bank / Expenses / HQ | Recreated | Expense approval tiers (Finance up to a company limit, Admin above and for HQ); expense tagging |
| Customers | List, profile, groups, guarantors | NIDA lookup + OTP (NIDA data read-only), live face capture instead of passport photo, next of kin, Mkoa → Wilaya → Kata → Mtaa residence, bank details, 5 categories with dynamic forms, required documents, KYC checklist |
| Loans | Application, pending, disbursed, withdrawal, rejected | Manager approve/reject/modify → e-mandate + OTP when required → credit review with Vodacom name check and reference number → Finance batch → Vodacom disbursement with 3 retries → escalation (cancel / suspense / other channel); no ledger entry until success; overdue + penalty job, DPD, default, top-up, closure and freeze |
| Teller & Payments | Teller dashboard, penalties | Cash → pending verification → bank deposit slip → Finance reconciliation → confirm + SMS; payment webhook with matching, suspense queue, duplicates, overpayment and partial payments |
| Accounting | — | Chart of accounts, journal with reversal, month-end profit per branch (loss carry-forward, 2% HQ hold, distributable profit), period close, audit trail |
| Salary Advance, Agent, Insurelance, VISA | Recreated | Reversal instead of delete; repayments Principal first |
| HRM | Staff, leave, allowances, deductions, salary sheet, staff loans and advances | Salary structures, commission pool from branch distributable profit, zone manager override, staff fund, HR approves / Finance pays payroll, payslips, attendance, performance |
| CRM, Messages, Goals | — | From handwritten notes: call/SMS log, follow-ups, customer reports; chat by position (staff → own head, HQ → anyone, groups and broadcasts); goals with progress charts |
| Reports | 13 live reports | Portfolio & Risk (portfolio, expected vs actual, arrears & PAR, recovery, DPD behaviour and A–D rating, segmentation, age analysis) and Financial (master cash flow, branch P&L, ranking, expenses, HQ 2% hold, loss carry forward, consolidated P&L, balance sheet, suspense, reversals, daily position) |

## Decisions not fixed by the sources (defaults, configurable where noted)

- Expense approval limit: 500,000 (company setting).
- Commission pool 10% of distributable profit, zone manager override 5%, staff fund contribution 20% of
  base salary, work start 08:00 (HRM settings).
- Loan freeze period: 0 days (Settings → Penalty page).
- Overpayments are held in suspense as customer credit for Finance to allocate or refund.
- Shareholder percentage = share of total capital contributed (live stores no percentage).
- Mtaa: `all-ward.json` stops at Kata, so streets are captured once per ward and reused.
- Customers registered before KYC (demo data) keep the live manual KYC approval and have no category limits.
- Manual journal entries are not offered (Documents allow corrections by reversal only).
- Zone "different accounts" in the chat note is unclear; zone managers use their normal account.

## Known differences from the live system

- Destructive actions are confirmed API calls, never GET links. Filters are query parameters.
- Money records are reversed, not deleted (capital, cash transactions, approved advances, transfers).
- Added columns/cards where the Documents require them (KYC status, E-Mandate, commission, staff fund,
  outstanding breakdown on the teller page).
- PDFs (agreement, statements, payslips) are printable HTML pages.
- The live `admin/loan_type` page (HTTP 500) and the uncaptured `admin/new_bad_debit` page are not reproduced.

## What could not be observed on the live system

Server-side postings, penalty and default timing, PDF layouts, SMS sending, other roles' screens and the
guarantor/collateral step after submitting a loan (which would have created production data). These follow
the Documents where they cover them, otherwise conventional behaviour.

## Logins

- The live system was audited with an authorised test login (phone `0755`). That credential belongs to the
  production system and is deliberately **not** seeded here, so it does not work on the recreation.
- The recreation seeds its own demo-only accounts, one per role, with fixed phones and passwords from
  `api/config/demo.php` / `DEMO_*` variables. The list is in README.md → "Demo accounts".

## Data

Configuration seeded from live observation (regions, branches, zones, products, formulas, settings) plus
the Documents' customer categories and Tanzania wards. All customers, staff and loans are invented demo
data. No live customer data, credentials or audit screenshots are in this repository.
