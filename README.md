# AU Hub — Gold Trading CRM

*(internal project/repo name: CRMgold — kept as-is on disk; the product shown
to the client is branded "AU Hub" throughout the app UI)*

A CRM for a gold trading business: track investors, expenses, gold purchases &
sales, and the profit / loss for each day and for the whole book — then split the
profit between investors by their percentage share.

Built from the handwritten brief in `1.jpeg`.

---

## 1. The stack (and why)

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | React 18 + Vite + TypeScript | Fast dev server, tiny build, familiar component model |
| **Styling / UI** | Tailwind CSS v4 + `lucide-react` icons + Recharts | Clean, consistent look with almost no custom CSS; Recharts for the profit trend chart |
| **Backend** | Node.js + Express + TypeScript (`tsx` locally; one serverless function on Vercel) | Small, explicit REST API; easy to read and extend |
| **Database** | **PostgreSQL** via **Prisma ORM** | A managed Postgres (Supabase's free tier, used for both local dev and production) |
| **File uploads** | `multer` (in-memory) → **Vercel Blob** | Payment slips / invoices as image or PDF, up to 15 MB each |
| **Auth** | JWT (12 h) + bcrypt password hashing | Stateless, role-based (`ADMIN` / `INVESTOR`) |

### Local database
Local dev needs a Postgres URL. Create a free [Supabase](https://supabase.com)
project and take the **transaction pooler** URI (port 6543, add
`?pgbouncer=true&connection_limit=1`) as `DATABASE_URL` and the **session pooler**
URI (port 5432) as `DIRECT_URL`. File uploads need a `BLOB_READ_WRITE_TOKEN`
(Vercel dashboard → Storage → Blob → tokens). See `server/.env.example`.

### Hosting
See **[DEPLOY.md](DEPLOY.md)** for the full Vercel + Supabase + Blob setup.

---

## 2. How it works (the process)

### Roles
- **Admin** (`admin`; password printed once by the seed) — full control of everything.
- **Investor** — a **read-only** portal. Auto-created when the admin adds an
  investor. Sees the whole book's totals and *all* losses, but for **profit**
  only sees the aggregate total **and their own share** — never another
  investor's share, never the investor list.

### 1. Investors
Admin → **Investors** → *Add investor*. Enter name, contact, **profit share %**
and capital.
On save the system **auto-generates a username + password** and shows them
**once** in a copy-to-clipboard dialog to hand over. After you click
*"I've shared these"* the password is wiped from the database (you can always
**Regenerate** — which instantly invalidates the old one).
Admin can **edit**, **regenerate credentials**, **make the login invalid**
(investor keeps existing, just can't sign in), re-activate, or **delete**.
Setting an investor **Inactive** also invalidates their login and drops them from
the profit split.

### 2. Expenses
Admin → **Expense Headers** manages the categories. Four are built in —
**Flight, Total Travel, Visa, Hotel Bookings** — and you can add / rename /
delete your own (e.g. *Customs Duty*, *Logistics*).
Admin → **Expenses** → *Add expense*: pick a header, amount, date, description,
and **drag in payment slips / invoices** (images or PDF). Attachments can be
added or removed later. Files open in a new tab (auth-protected).

**Investor attribution (hybrid).** Each expense can optionally be tied to an
investor, with a checkbox *"Charge this expense to that investor only"*:
- **off (tagged)** — recorded against that investor for reference, but still
  paid from the shared pool and split across all investors by %.
- **on (charged)** — deducted from **that investor's profit share only**.

The book's **Total Expenses** and **Net Profit** are identical either way — only
the split between investors changes:
```
commonNetProfit    = grossProfit − sharedExpenses
investor net share = commonNetProfit × (their %) − (expenses charged to them)
```
An investor can end up with a Net Loss from charged expenses even when the book
is in profit. Shown on **Profit & Loss** (extra columns in the split + an
"Expenses tied to investors" table) and in each investor's portal ("Expenses
Charged To Me").

### 3. Gold trades
Admin → **Gold Trades** → *Add trade*: **BUY** or **SELL**, date,
**quality / purity** (24K, 22K, 999, 916…), weight in grams, and rate per gram.
The transaction total is computed for you.

### 4. Profit / Loss — how the numbers are calculated
Cost model: **Weighted Average Cost (WAC)**.

```
avgBuyRate      = total value of all purchases ÷ total grams purchased
COGS (a period) = grams sold in that period × avgBuyRate
Gross profit    = sale value − COGS                     ← "profit without expenses"
Total expenses  = sum of expenses in that period
Net profit      = Gross profit − Total expenses         ← "profit after expenses"
Stock left      = every gram bought − every gram sold (cumulative), valued at avgBuyRate
Total loss      = the gross figure when it is negative (shown as a positive magnitude)
Net loss        = the net figure when it is negative
```

These are produced **per day** (daily accounts) and for the **whole book**
(overall). A date range filter is available on the Profit & Loss page and the
investor portal.

### 5. Profit split
For any summary, each active investor's share is
`figure × (their share % ÷ 100)` — applied to gross profit, net profit and net
loss. Shown on the admin **Dashboard**, on **Profit & Loss** (overall + click any
day for that day's split), and privately to each investor in their portal.
The admin UI warns if the active shares don't add up to 100%.

---

## 3. Running it locally

**Prerequisites:** Node.js 18+ (built and tested on Node 22).

```bash
cd D:\Claude-Projects\CRMgold

# 1. install everything (root + server + client)
npm run install:all

# 2. copy the server env file, then fill in DATABASE_URL / DIRECT_URL / JWT_SECRET
#    / BLOB_READ_WRITE_TOKEN  (see server/.env.example)
copy server\.env.example server\.env      # PowerShell: cp server\.env.example server\.env

# 3. create the schema + seed admin, headers and demo data
#    first time:            npm --prefix server exec -- prisma migrate dev --name init
#    after that / on a peer machine:
npm run setup

# 4. start API (:4000) and web app (:5173) together
npm run dev
```

Open **http://localhost:5173**.

| Account | Username | Password |
|---|---|---|
| Admin | `admin` | printed once by `npm run setup` (random, or set `SEED_ADMIN_PASSWORD`) |
| Demo investor (60%) | printed by `npm run setup` | printed by `npm run setup` |
| Demo investor (40%) | printed by `npm run setup` | printed by `npm run setup` |

Change the admin password from inside the app (icon rail → **Change password**).
Re-running the seed never overwrites an existing password.

> The seed also loads a few sample gold trades and expenses so the dashboards
> aren't empty. Real use: delete the demo investors and start adding your own
> data. Re-running `npm run setup` keeps existing data (demo data is only
> inserted when there are no investors yet).

### Handy commands
| Command | What |
|---|---|
| `npm run dev` | Run API + web app with hot reload |
| `npm run setup` | Migrate DB + seed (safe to re-run) |
| `npm --prefix server run seed` | Re-seed only |
| `npm --prefix server run studio` | Prisma Studio — browse the DB in a GUI |
| `npm run build` | Production build of the web app (`client/dist`) |

---

## 4. Project layout

```
CRMgold/
├─ server/                 Express + Prisma API
│  ├─ prisma/
│  │  ├─ schema.prisma     data model (SQLite)
│  │  └─ seed.ts           admin + default headers + demo data
│  ├─ src/
│  │  ├─ index.ts          app entry, route wiring, error handler
│  │  ├─ lib/
│  │  │  ├─ accounting.ts  the WAC profit/loss + split engine
│  │  │  ├─ auth.ts        JWT sign/verify + role guards
│  │  │  ├─ credentials.ts investor username/password generator
│  │  │  ├─ upload.ts      multer config (images + PDF)
│  │  │  └─ prisma.ts
│  │  └─ routes/           auth, investors, expenseCategories,
│  │                       expenses, gold, reports, portal, files
│  └─ uploads/             stored payment slips / invoices
└─ client/                 React + Vite web app
   └─ src/
      ├─ api.ts            axios instance + token handling
      ├─ auth.tsx          AuthProvider, useAuth, RequireRole
      ├─ format.ts         money / grams / date formatting
      ├─ components/       AppShell, ui primitives, ProfitChart, AttachmentLink
      └─ pages/
         ├─ Login.tsx
         ├─ admin/         Dashboard, Investors, Gold, Expenses,
         │                 Categories, Reports
         └─ portal/        PortalDashboard  (investor read-only view)
```

---

## 5. API reference (all under `/api`, JWT `Authorization: Bearer <token>`)

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/login` | – | Get token |
| GET | `/auth/me` | any | Current user |
| POST | `/auth/change-password` | any | Change own password |
| GET/POST | `/investors` | admin | List / create (returns generated credentials) |
| GET/PUT/DELETE | `/investors/:id` | admin | Read / update / delete |
| POST | `/investors/:id/regenerate-credentials` | admin | New username + password |
| POST | `/investors/:id/login-status` | admin | `{status: "ACTIVE"\|"INVALID"}` |
| POST | `/investors/:id/ack-credentials` | admin | Mark password as delivered (hides it) |
| GET/POST/PUT/DELETE | `/expense-categories` | admin | Manage headers |
| GET/POST | `/expenses` | admin | List (filters: `from,to,categoryId`) / create (multipart `files`) |
| PUT/DELETE | `/expenses/:id` | admin | Update / delete |
| POST | `/expenses/:id/attachments` | admin | Add files |
| DELETE | `/expenses/:id/attachments/:attId` | admin | Remove a file |
| GET/POST/PUT/DELETE | `/gold` `/gold/:id` | admin | Gold trades (filters: `from,to,type`) |
| GET | `/reports/summary` | admin | Overall + daily + investor split (filters: `from,to`) |
| GET | `/portal/summary` | investor | Own restricted view (filters: `from,to`) |
| GET | `/files/:id` | any | Stream a payment slip / invoice |

---

## 6. Notes & assumptions

- **Responsive / mobile:** below 1024px the sidebar collapses into a slide-in
  drawer (hamburger in the top bar), stat cards stack to one column, modal form
  fields go single-column, and every wide table scrolls horizontally inside its
  card. Works down to ~360px width.
- **Currency** is displayed as AED; change the locale/currency in
  `client/src/format.ts` (`money()`).
- **Weighted-average cost** was chosen over FIFO/LIFO because the brief talks
  about "quality of gold bought & its rate" vs "sold & its rate" and a single
  stock pool — WAC is the natural fit and keeps daily numbers stable. The
  average buy rate shown on every report is the cost basis used.
- The generated investor password is stored in plain text **only** between
  creation and the admin confirming delivery, so it can be re-shown once. After
  that only the bcrypt hash remains. Regenerating is always available.
- `JWT_SECRET` in `server/.env` is a dev placeholder — change it before any real
  deployment.
- This is a local-first build. For production you'd add HTTPS, a real secret,
  PostgreSQL, and object storage for uploads.
