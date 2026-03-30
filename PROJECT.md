# Airbnb Property Dashboard — Project Documentation

A single-file HTML property management dashboard for tracking Airbnb bookings, managing cleaners, tracking tenant rent payments, and maintaining a 2026 income statement. Built with vanilla HTML/CSS/JS — no frameworks, no npm, no build step.

---

## Quick Start

**Option A — Production (Netlify)**

The app is deployed at the Netlify URL. Just open it in your browser — no local server needed.

After deploy, add the Netlify URL as an authorized JavaScript origin in Google Cloud Console (see [Google Cloud Setup](#google-cloud-setup-one-time) below).

**Option B — Local dev with Netlify CLI**

```bash
# One-time install
npm install -g netlify-cli

# Run locally (serves on http://localhost:8888, runs the proxy function too)
cd /path/to/AirBnB
netlify dev
# → http://localhost:8888/airbnb-dashboard.html
```

**Option C — Legacy local server (Python)**

```bash
cd /Users/ericlee/Documents/Claude
python3 server.py
# → http://localhost:8766/airbnb-dashboard.html
```

The dashboard loads with any previously saved data from localStorage. Use **Demo Data** buttons to explore without real credentials.

---

## File Structure

```
AirBnB/
├── airbnb-dashboard.html        # Entire app (~3,100 lines, single file)
├── netlify/
│   └── functions/
│       └── proxy.js             # Netlify serverless function — CORS proxy for iCal
├── netlify.toml                 # Netlify build config
├── .gitignore
└── PROJECT.md                   # This file
```

### `netlify/functions/proxy.js`
Serverless Node.js function that proxies `GET /.netlify/functions/proxy?url=<url>` requests with CORS headers. Replaces the old `server.py`. Works both in production on Netlify and locally via `netlify dev`.

### Legacy: `server.py` (no longer required)
The original Python proxy server. Still works for pure-local dev without the Netlify CLI.

---

## Google Cloud Setup (One-Time)

The app uses two Google APIs:

### A. Google Sheets API (read tenant data)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or reuse one)
3. Enable **Google Sheets API** (APIs & Services → Library)
4. Create an **API Key**: APIs & Services → Credentials → Create Credentials → API Key
5. Copy the API key → paste into the dashboard under "Rent Tracker → API Key"
6. Your Google Sheet must be shared: "Anyone with the link can view"

### B. Gmail API (payment detection + email sending)
1. In the same project, enable **Gmail API**
2. Configure **OAuth consent screen**: External → add your Gmail as a Test User
3. Create **OAuth 2.0 Client ID**: Credentials → Create Credentials → OAuth client ID → Web application
4. Add authorized JavaScript origins:
   - `https://your-site.netlify.app` (your Netlify URL after first deploy)
   - `http://localhost:8888` (for local dev via `netlify dev`)
   - `http://localhost:8766` (for legacy Python server)
5. Copy the Client ID → paste into the dashboard under "Rent Tracker → Gmail Client ID"

**OAuth Scopes used:**
- `https://www.googleapis.com/auth/gmail.readonly` — read emails + label scanning
- `https://www.googleapis.com/auth/gmail.send` — send unpaid reminders

> Tokens are client-side only. They expire after ~1 hour and require re-authentication.

---

## Google Sheet Format

The tenant sheet must follow this column layout:

| Column | Field | Notes |
|--------|-------|-------|
| A | Property Address | e.g. `123 Main St` |
| C | Renter Name | Full name |
| G | Paid To | Must contain `"Eric"` to be included |
| H | Rent Amount | e.g. `$2,400` or `2400` |
| I | Notification Email | Tenant contact email |
| J | Sender Email | Email address to search for payments (override) |
| K | Email Subject Keyword | Subject keyword to search for (override) |
| L | Payment Method | `Venmo`, `Zelle`, `PayPal`, `Cash App`, `Bank Transfer`, etc. |

Only rows where column G contains "Eric" are loaded as tenants.

---

## Features

### 1. Airbnb Booking Manager

**How to use:**
1. Get your Airbnb iCal URL: Airbnb → Account → Hosting → Calendar → Export Calendar
2. Paste URL in the header input → click **Sync**

**What it shows:**
- Upcoming guest bookings (dates, reservation code, guest phone last-4)
- Status badges: Staying / Check-in today / Upcoming / Checkout
- Tabs: Bookings table | Cleaning Schedule | Guest Notes

**Stats bar** (top): Total upcoming bookings, next check-in, cleanings scheduled, unassigned cleanings

> Note: Airbnb hides guest real names in iCal exports — only reservation code + last-4 of phone are available.

---

### 2. Cleaning Scheduler

Assign each booking to one of two cleaners: **Karla** (indigo) or **Priscilla** (green).

- Assign from the Bookings tab dropdown or Cleaning tab buttons
- Override the default cleaning date (day of checkout) with a custom date
- Log the cleaning cost paid to each cleaner
- Totals tracked per cleaner in summary cards at the top

Data persists in localStorage under `assignments`, `cleaningDates`, `cleaningCosts`.

---

### 3. Tenant Rent Tracker

Tracks rent payment status for residential tenants loaded from Google Sheets.

**Payment statuses (click to cycle):**
- `pending` → gray — not yet confirmed
- `paid` → green — payment detected or manually confirmed
- `unpaid` → red — overdue
- `na` → muted — not applicable (vacant, etc.)

**Gmail Auto-Detection:**
Click **⚡ Sign in & Scan Now** to search Gmail for payment emails. The app builds search queries using each tenant's payment method (Venmo, Zelle, etc.) and their sender email / subject keyword from the sheet.

**Auto-scan:** On days 1–5 of each month, the dashboard automatically scans for new payments on load.

**Reminder emails:** On day 5, if tenants are still unpaid, an email is sent to the address in the "Reminders" field.

---

### 4. Income Statement (2026)

Flat ledger showing all financial activity for the year, split into two panels:

**Revenue panel** includes:
- Airbnb payouts (auto-scanned from Gmail)
- Tenant rent (all paid months for income tenants)
- Manually added revenue items
- Forwarded/auto-labeled emails

**Expense panel** includes:
- Cleaning costs (from each Airbnb booking)
- Miscellaneous expenses (from the Expense Tracker below)
- Forwarded/auto-labeled expense emails

Each row supports inline editing (✏️) and deletion (✕). YTD totals shown in summary bar.

#### Adding Revenue Manually
Use the `+ Add` form at the bottom of the Revenue panel: pick a date, enter a source name and dollar amount.

---

### 5. Email Forwarding (Manual Tags)

Log any receipt or payout without leaving Gmail:

1. Forward any email to yourself
2. Edit the subject line to include a tag + dollar amount:
   - `[REVENUE] Airbnb payout $3,200`
   - `[EXPENSE] Home Depot supplies $45.00`
3. Click **📧 Process Forwarded Emails** (or run Scan Now)

The app parses the subject, extracts the type and amount, adds it to the ledger, and uses the Gmail message ID as a dedup key — re-scanning never double-adds.

---

### 6. Gmail Auto-Rules (Label-Based, No Forwarding Needed)

Set up Gmail filters so emails are auto-labeled and processed on every scan — zero manual effort after setup.

**Setup (once per rule, ~10 seconds):**
1. Click **⚙️ Auto-Rules** in the Income Statement header
2. Click **Create in Gmail →** next to any pre-built rule
3. Gmail opens pre-filled with sender + label — click "Create filter"

**Pre-built rules:**

| Name | Sender | Type | Gmail Label |
|------|--------|------|-------------|
| Airbnb Payouts | `automated@airbnb.com` | Revenue | `dashboard-revenue` |
| VRBO / HomeAway | `noreply@homeaway.com` | Revenue | `dashboard-revenue` |
| Hipcamp | `notifications@hipcamp.com` | Revenue | `dashboard-revenue` |
| Amazon Receipts | `auto-confirm@amazon.com` | Expense | `dashboard-expense` |
| Costco | `ereceipt@costco.com` | Expense | `dashboard-expense` |
| Home Depot | `homedepot@reply.homedepot.com` | Expense | `dashboard-expense` |
| Lowe's | `lowes@email.lowes.com` | Expense | `dashboard-expense` |
| Target | `target@em.target.com` | Expense | `dashboard-expense` |

You can also enter any sender or subject keyword in the **Custom rule** row.

**How it works on scan:**
- Dashboard queries Gmail for `label:dashboard-revenue` and `label:dashboard-expense`
- Tries to extract dollar amount from email snippet using regex patterns
- If found → added to ledger automatically
- If not found → appears in a yellow **⚠️ Needs Review** banner where you type in the amount

---

### 7. Expense Tracker

Manual expense entry form at the bottom of the page.

Fields: Date | Description | Vendor | Amount | Paid With

**Paid With options:** Amazon CC, Sapphire CC, Business CC, Cash, Venmo, Fidelity Checking, Chase Checking

Expenses appear in both the Expense Tracker table and the Income Statement's Expense panel.

---

## Data Model (localStorage)

All data persists in the browser's localStorage. **Clearing browser data = data loss.** There is no cloud backup.

### Booking Data
```js
icalUrl         // string: Airbnb iCal URL
assignments     // { [bookingUid]: "Karla" | "Priscilla" }
notes           // { [bookingUid]: "note text" }
cleaningDates   // { [bookingUid]: "YYYY-MM-DD" }  (custom override)
cleaningCosts   // { [bookingUid]: number }
```

### Rent Tracker
```js
rentSheetId       // string: Google Sheets document ID
rentApiKey        // string: Google Sheets API Key
gmailClientId     // string: Gmail OAuth 2.0 Client ID
reminderEmail     // string: email to send unpaid reminders to
rentTenants       // array: cached tenant list from sheet
rentPayments      // { "tenantId-YYYY-MM": "paid"|"pending"|"unpaid"|"na" }
rentLastScan-YYYY-MM    // number: day of month last scanned
rentReminderSent-YYYY-MM // bool: reminder already sent this month
```

### Income Statement
```js
revenueItems    // [{ id, date: "YYYY-MM-DD", source: string, amount: number }]
pendingReview   // [{ id, date, subject, from, snippet, isRevenue: bool }]
airbnbRevenue   // legacy (auto-migrated to revenueItems on first load)
```

### Revenue Item ID Prefixes
| Prefix | Source |
|--------|--------|
| `ab-{msgId}` | Airbnb payout auto-scan |
| `rev-fwd-{msgId}` | `[REVENUE]` forwarded email |
| `lbl-rev-{msgId}` | `dashboard-revenue` auto-label |
| `{timestamp}` | Manually added |

### Expenses
```js
expenses  // [{ id, date: "YYYY-MM-DD", name, vendor, amount, payment }]
```

### Expense Item ID Prefixes
| Prefix | Source |
|--------|--------|
| `exp-fwd-{msgId}` | `[EXPENSE]` forwarded email |
| `lbl-exp-{msgId}` | `dashboard-expense` auto-label |
| `{timestamp}` | Manually added via form |

---

## Hardcoded Values to Know

These values are hardcoded in `airbnb-dashboard.html` and may need updating:

```js
// Line ~2630: Only these 3 tenants' rent counts as YOUR income in the statement.
// Matched by first + last name (case-insensitive partial match).
const INCOME_TENANTS = [
  'Michael Christian Tsuchida',
  'Jinna Isabella Brim',
  'Madison Corinne Williams',
];

// Line ~2633: These months are always shown as "paid" regardless of actual status
// (Jan + Feb 2026 were pre-paid at signing).
const PREPAID_MONTHS = ['2026-01', '2026-02'];

// Gmail label names (must match what Gmail creates — no slashes, use hyphens)
'dashboard-revenue'   // auto-rules: revenue emails
'dashboard-expense'   // auto-rules: expense emails

// Proxy server port
PORT = 8766           // server.py
```

---

## Gotchas & Known Limitations

| Issue | Details |
|-------|---------|
| **iCal requires proxy** | Browsers block cross-origin fetches. `server.py` must be running. |
| **Guest names hidden** | Airbnb iCal exports only show reservation code + phone last-4, not real names. |
| **Gmail token expires** | OAuth tokens last ~1 hour. Dashboard prompts re-auth silently if possible, or shows a warning. |
| **Max 50 emails per scan** | All Gmail API searches are capped at 50 results. |
| **localStorage only** | All data stored in browser. Clearing site data = losing all history. No cloud sync. |
| **Income tenants hardcoded** | `INCOME_TENANTS` must be updated by hand if tenants change. |
| **Prepaid months hardcoded** | `PREPAID_MONTHS` must be updated each year. |
| **Amount extraction via regex** | Auto-label scanning tries to parse dollar amounts from email snippets. Unusual email formats may fail → goes to Pending Review queue. |
| **Single-file architecture** | All 3,100+ lines in one HTML file. No modules. Ctrl+F is your friend. |

---

## Key Functions Reference

### Booking
| Function | Description |
|----------|-------------|
| `loadIcal(silent)` | Fetch + parse Airbnb iCal |
| `renderBookingsTab()` | Render booking table |
| `assign(uid, cleaner)` | Toggle Karla / Priscilla |
| `cleaningDate(b)` | Returns custom or checkout date |
| `saveCleaningCost(uid, val)` | Save cleaner payment |

### Rent Tracker
| Function | Description |
|----------|-------------|
| `rentLoadSheet()` | Fetch Google Sheet via API |
| `renderRentTracker()` | Render tenant payment grid |
| `cyclePayment(tenantId, monthKey)` | Cycle payment status |
| `gmailScanAll()` | Scan Gmail for all tenant payments |
| `gmailScanOne(tenantId)` | Scan a single tenant |
| `sendUnpaidReminders(monthKey)` | Email reminders for unpaid |

### Income / Emails
| Function | Description |
|----------|-------------|
| `gmailFetchAirbnbPayouts()` | Auto-scan for Airbnb payout emails |
| `gmailScanForwardedEmails()` | Scan for `[REVENUE]`/`[EXPENSE]` tagged forwards |
| `gmailScanByLabels()` | Scan `dashboard-revenue` / `dashboard-expense` labels |
| `extractAmountFromSnippet(snippet)` | Regex extract $ amount from email body |
| `parseForwardedSubject(subject)` | Parse tag + amount from subject line |
| `renderIncomeStatement()` | Render full revenue + expense ledger |
| `approvePendingReview(id)` | Move pending item to ledger |

### Expenses
| Function | Description |
|----------|-------------|
| `addExpense()` | Add expense from form |
| `deleteExpense(id)` | Remove expense |
| `renderExpenseTracker()` | Render expense table |

---

## Payment Method Detection Logic

For each tenant, the app builds a Gmail search query based on their payment method:

| Payment Method | Gmail search strategy |
|---------------|----------------------|
| Venmo | From: `venmo@venmo.com`, subject contains tenant name |
| Zelle | From bank notification email, subject contains "sent you" or tenant name |
| PayPal | From: `service@paypal.com`, subject contains amount or tenant |
| Cash App | From: `cash@square.com` |
| Bank Transfer | Uses tenant's custom `senderEmail` + `emailSubj` from sheet |

Custom `senderEmail` (column J) and `emailSubj` (column K) in the sheet override the default detection for any tenant.

---

*Last updated: March 2026*
