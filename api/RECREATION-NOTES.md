# MikopoFasta recreation notes

This project is an independent recreation of the MikopoFasta microfinance admin system (live at https://mikopofasta.co.tz).
It was built by auditing the live system through an authorised test account and rebuilding it in Laravel.
It does not share code, a database or a repository with any other MikopoFasta project.

The live system is a CodeIgniter 3 application using the Lucid Bootstrap 4 admin template.
This project uses Laravel 13 with Blade, Bootstrap 4.6, jQuery DataTables, Select2, SweetAlert and Cropper.js, which reproduces the same server-rendered pages.

## How the audit was done

- The live system was used read-only. Nothing was submitted to it apart from the login form.
- Only page views (GET) and the read-only dropdown lookups (`fetch_*`) were requested.
- Many live actions are plain GET links (for example `delete_*`, `reject_*`, `block_allEmployee`, `reset_panel`), so none of those links were opened.
- For each page the audit captured a full screenshot, the HTML, every form (fields, placeholders, required flags, dropdown options), every table (columns, row actions), every modal, the inline JavaScript and the computed styles.
- The audit files are not in this repository. They contained real customer data from the live system.

## 1. Directly observed from the live system

- **Navigation:** three sidebar tabs.
  - Menu: 18 groups.
  - Report: 13 pages.
  - HRM: 11 pages.
  - Top bar with a global "Select customer" search.
- **Pages:** 110 pages were opened, including detail pages:
  - customer profile
  - loan approval (`view_Dataloan`)
  - edit loan
  - employee profile
  - privileges
  - loan category branch assignment
  - customer sub-categories
  - group members
  - teller customer ledger
  - company settings
- **Labels:** all labels, breadcrumbs, table columns, button icons and modal fields, including the live spellings ("Penarty", "Aditinal Detail", "Insurelance", "Transfor", "Aprove").
- **Visual design:**
  - Source Sans Pro 14px on `#f4f7f6`.
  - White cards with 0.55rem radius.
  - `#3C89DA` table headers.
  - AdminLTE button colours.
  - `#01b2c6` wizard pills.
  - Orange 5px frame on the dashboard and teller customer page only.
- **Registration wizard:** Basic information → Aditinal Detail → Passport size & Bank Detail, with all fields.
- **Dependent dropdowns** (response contents observed):
  - Branch → Employee.
  - Loan Type → Types of customer: Watumishi gives BINAFSI / WASTAFU / VIP; Wajasiliamali gives VIKUNDI / BINAFSI / VIP.
  - Loan category → Duration (e.g. "Weekly / 1 - 3"), Interest Formular and Deducted Fee.
- **Client-side behaviour:**
  - Date of birth fills Year (age).
  - Passport photo cropper (1:1 ratio, 160×160).
  - SweetAlert flash messages.
  - The KYC block message "Please wait for the customer`s KYC to be Verfied!".
  - The PDF error message "PDF file is Allowed please change Your file".
- **Resuming registration:** "Loan application" for a customer opens the next incomplete registration step (`basic_info_data`, `aditinal_detail`, `pass_port_document`, `loan_applicationForm`).
- **Master data:**
  - 32 regions and 6 branches.
  - Main loan categories and customer types.
  - Loan products with their ranges, rates, durations, fees and insurance.
  - Interest formulas.
  - Penalty and reserve settings.
  - Staff privileges and positions.
  - Bank accounts, expense types and account names.
- **Loan figures confirmed against live data:**
  - SIMPLE interest is charged once on the principal: 100,000 at 30% gives 130,000.
  - Restoration = (principal + interest + insurance) ÷ repayments: 600,000 at 20% plus 100,000 insurance over 5 weeks gives 164,000.
  - A repayment splits into principal, interest and reserve (reserve = interest × reserve %): 130,000 splits into 100,000 / 30,000 / 6,000.
  - The loan fee is deducted from the cash paid out ("Remain Cash").

## 2. Recreated from observation

- Every page listed in `config/menu.php`, at the same URL paths under `/admin`.
- Detail pages at matching paths:
  - `customer_profile/{id}`
  - `view_Dataloan/{id}`
  - `edit_loan/{id}`
  - `view_employee/{id}`
  - `privillage/{id}`
  - `loan_category_blanch/{id}`
- Forms, filter modals, edit modals and tables use the observed field names, options and column order.
- Dependent dropdowns go through `LookupController`, which returns `<option>` HTML like the live `fetch_*` endpoints.
- The shared shell (layout, sidebar, top bar, cards, modals) was rebuilt from measured styles in `public/assets/css/app.css`. No template CSS was copied.

## 3. Could not be observed

- **Guarantor and collateral entry after the loan form's "Next" button.** Reaching it would have created a loan in production.
- **Server-side calculations and postings:**
  - how account balances are stored
  - penalty calculation
  - when a loan becomes default
  - daily report opening and closing balances
  - how bank, float, HQ and expense transactions affect accounts
- **Interest formulas other than SIMPLE.** No live data used FLAT RATE or REDUCING.
- **Generated PDFs:** loan agreement, statements, salary slips, branch-wise print. These are downloads, so their layout was not captured.
- **SMS sending.** This covers the withdrawal code, reminders and "Send SMS".
- **Views for other roles.** Officer, HQ and zone-manager screens were not visible to the test account.
- **Face verification.** It does not exist on the live system; KYC is only a Pending/Approved status.
- **`admin/loan_type`**, which returns HTTP 500 on the live site.

## 4. Implemented conventionally (live behaviour unverified)

Methods with inferred behaviour are marked in PHPDoc in the code.

- **Accounting:** all balances are derived from the `ledger_entries` table through `App\Services\Ledger`. Nothing stores a balance directly.
- **Loan lifecycle** (`App\Services\LoanService`):
  1. pending → approve → disbursed, which generates a withdrawal code.
  2. Teller withdrawal with that code → active. The repayment schedule is generated, Principal is debited and the Loan Fee account is credited.
  3. Deposits → done.
  4. Loans past their end date with a balance → default.
  5. Default → written off.
- **Formulas:** FLAT RATE = rate × repayments; REDUCING = declining balance.
- **Penalties:** charged per overdue instalment, using the company's percentage or fixed amount.
- **Guarantors and collateral:** entered on a "securities" step after the loan form (`/admin/loan_sponser/{loan}`), with fields taken from the tables shown on the approval and edit screens.
- **Withdrawal code:** created at approval and written to `sms_logs`. No SMS provider is connected. Messages from "Send SMS" are also only logged.
- **Money movements** are all posted to the ledger:
  - float transfers
  - bank transfers and charges
  - HQ transfers
  - expense approvals
  - salary advances
  - savings
  - agent transactions
  - payroll
  - staff loans
- **Daily report:** figures come from the ledger and the source tables.
- **Printable loan agreement:** an HTML print page replaces the live PDF.
- **Staff defaults:** new employees get their phone number as the default password. Employee IDs follow the pattern `MK-<sequence><year>`.

## 5. Known differences from the live system

- **Destructive actions:** delete, approve, reject, block and reset are POST/DELETE forms with a confirm prompt, not GET links.
- **Filter modals** submit with GET query parameters instead of POST. The fields are the same.
- **Sidebar:** the group containing the current page is expanded on page load.
- **Behaviour or pages added:**
  - Approve buttons that are commented out on live: bank transactions, HQ requests.
  - Working create forms where the live modal is broken or hidden: HQ expense request, HQ transaction request.
  - The guarantor/collateral step described in section 4.
- **Not implemented (no route yet):**
  - block/unblock all staff
  - salary sheet print and xlsx export
  - delete a single salary-advance payment
  - delete a capital entry
  - bad debit page
  - branch-wise and new-loan PDF prints
  - leave approval
- **Broken live markup is not reproduced:** the live site has TOTAL rows with too few cells, an empty Date column on "Today Received", and PHP warnings inside some modals.
- **Seed data:** configuration comes from live, but all customers, staff and loans are invented demo data. The seeded company keeps the live test account's name so the sidebar matches.

## Running locally

Requirements: PHP 8.3+ with `pdo_sqlite` (or MySQL), and Composer. Node is not needed; front-end libraries are in `public/vendor`.

```bash
composer install
cp .env.example .env
php artisan key:generate
```

In `.env`, set the demo admin login that the seeders will create:

```dotenv
DEMO_ADMIN_PHONE=0700000000
DEMO_ADMIN_PASSWORD=choose-a-local-password
DEMO_ADMIN_EMAIL=admin@example.com
```

Then create the database and start the app:

```bash
touch database/database.sqlite   # when using the default SQLite connection
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

Open http://127.0.0.1:8000 and log in with `DEMO_ADMIN_PHONE` / `DEMO_ADMIN_PASSWORD`.

Run the tests with `php artisan test`. They use an in-memory SQLite database.

## Database migrations and seeding

- **Migrations** are in `database/migrations`, grouped by domain: organization, master data, customers, loans, finance, HRM. There is also a later migration that adds `loans.withdrawal_code`. They work on SQLite and MySQL.
- **`MasterDataSeeder`** loads the configuration observed on live: regions, company, branches, loan products, categories, formulas, settings, bank accounts and expense types. It also creates the demo admin from the `DEMO_ADMIN_*` values.
- **`DemoDataSeeder`** creates invented staff, customers and guarantors, plus loans in every status (created through `LoanService`, so ledger entries are correct). It also adds penalties, salary advances, savings, agent transactions, expenses and transfers.
- **Commands:**
  - `php artisan migrate:fresh --seed` rebuilds everything and deletes all local data.
  - `php artisan db:seed --class=MasterDataSeeder` loads configuration only.
  - To use MySQL, set `DB_CONNECTION=mysql` and the `DB_*` variables in `.env`, then run `php artisan migrate --seed`.
