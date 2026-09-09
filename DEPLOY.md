# Deploying AU Hub to Vercel

The app is a Vite static client + an Express/Prisma API that runs as **one Vercel
serverless function** (`api/index.ts`). Storage is **Supabase Postgres** and
**Vercel Blob**. This whole guide is a one-time setup of ~15 minutes.

---

## 1. Create the database (Supabase)

1. https://supabase.com → new project, name it `auhub`. Set a **database password**
   and save it (Settings → Database → *Database password* — you can reset it here later).
2. **Settings → Database → Connection string → URI**. Supabase shows three modes;
   you need **two**:

   | Env var | Which one | Port | Notes |
   |---|---|---|---|
   | `DATABASE_URL` | **Transaction pooler** | `6543` | append `?pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | **Session pooler** | `5432` | same `…pooler.supabase.com` host, no query string needed |

   They look like:
   ```
   DATABASE_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   ```

   Use the **session pooler** (port 5432, pooler host) for `DIRECT_URL` — **not** the
   raw `db.<ref>.supabase.co:5432` "direct" string. The raw one is IPv6-only on the
   free tier, so `prisma migrate` from your machine and from Vercel can't reach it.

   `?pgbouncer=true` is required (the transaction pooler has no prepared statements);
   `connection_limit=1` keeps the serverless functions from exhausting Supabase's
   shared pool. If your password has `@ : / ? # [ ]`, URL-encode those characters.

   Prisma only touches the `public` schema (plus its own `_prisma_migrations`
   table) — it won't collide with Supabase's `auth` / `storage` schemas.

## 2. Run the first migration + seed (from your machine)

```bash
cd server
cp .env.example .env          # then paste the real DATABASE_URL / DIRECT_URL / JWT_SECRET
npx prisma migrate dev --name init      # creates the Postgres migration + applies it to Supabase
npm run seed                            # creates the admin (admin / admin123) + demo data
```

Commit the generated `server/prisma/migrations/` folder — Vercel replays it on deploy.
(Re-run `npx prisma migrate dev` locally whenever you change `schema.prisma`, then commit.)

## 3. Push the repo

```bash
git add -A && git commit -m "db: initial postgres migration"
git push
```

## 4. Import into Vercel

1. https://vercel.com → **Add New → Project** → import `muhdwaseem/AUHUB`.
2. Framework preset: **Other**. Leave build/install/output blank — `vercel.json`
   already sets them (`vercel-build`, `client/dist`, `/api/*` → the function).
3. **Environment Variables** (all environments):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Supabase **transaction pooler** URL (port 6543, `?pgbouncer=true&connection_limit=1`) |
   | `DIRECT_URL` | Supabase **session pooler** URL (port 5432) |
   | `JWT_SECRET` | a long random string (`node -e "console.log(crypto.randomBytes(48).toString('base64url'))"`) |
   | `NODE_ENV` | `production` |

4. **Deploy.**

## 5. Add Blob storage (file uploads)

1. Project → **Storage** tab → **Create → Blob** → connect it.
2. Vercel auto-adds `BLOB_READ_WRITE_TOKEN` to the project's env vars.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the function picks up the token.

> Uploads use Vercel Blob, not Supabase Storage — the code depends on `@vercel/blob`.
> Moving them to Supabase Storage is a small change to `server/src/lib/upload.ts`
> if you'd rather keep one storage vendor.

## 6. Verify

- `https://<project>.vercel.app/api/health` → `{"ok":true,"service":"crmgold-api"}`
- Open the site, sign in `admin` / `admin123`, add an expense with a file attachment,
  reopen it — the attachment link should show the file (served from Blob).
- **Change the admin password** immediately (or edit the seed and re-run before going live).

## 7. Custom domain (optional)

Project → **Settings → Domains** → add your domain, then create the DNS record
Vercel shows (a `CNAME` to `cname.vercel-dns.com`, or an `A` record). TLS is automatic.
The domain itself is bought separately (~$10–15/yr, any registrar).

---

## Notes / limits

- **Vercel Hobby is non-commercial only.** A client CRM is commercial use — deploy
  under a **Pro** plan ($20/mo), ideally on the client's own Vercel account.
- **Cold start:** the first request after a few minutes idle takes ~1–2 s (Prisma
  spin-up). Fine for an internal desk tool.
- **Supabase free tier pauses** a project after ~1 week of no activity — the first
  request after that wakes it (a few seconds). A paid Supabase plan removes this.
- **File access:** `/api/files/:id` checks you're logged in, then 302-redirects to
  the Blob URL (which carries a random suffix, so it isn't guessable). It does not
  stream bytes through the function — serverless response bodies are capped at
  4.5 MB and payment slips can be larger.
- **Schema changes after go-live:** `npx prisma migrate dev` locally → commit → push.
  Vercel does **not** run `prisma migrate deploy` automatically — run
  `cd server && npx prisma migrate deploy` against the `DIRECT_URL` when you ship a
  migration, or add it as a Vercel "Deploy Hook" / GitHub Action.
- **Backups:** Supabase → Database → Backups (daily on paid; free tier keeps none,
  so take a `pg_dump` before risky changes).

## Troubleshooting

- **`/api/health` returns 500 "Cannot find module 'express'" (or `@prisma/client`)** —
  the function bundler didn't pick up `server/node_modules`. Confirm the build log
  ran `npm --prefix server install`. If it still fails, add `express`,
  `@prisma/client`, `@vercel/blob` (same versions as `server/package.json`) to the
  **root** `package.json` `dependencies` so they also land in the root
  `node_modules`, and redeploy.
- **`PrismaClientInitializationError` about the query engine** — the
  `binaryTargets` in `schema.prisma` already includes `rhel-openssl-3.0.x`
  (Vercel's runtime). Make sure `prisma generate` ran in the build (it does via
  `vercel-build` → `npm --prefix server run generate`).
- **`prisma migrate` hangs or "can't reach database server"** — you're using the
  raw `db.<ref>.supabase.co` direct string (IPv6-only). Switch `DIRECT_URL` to the
  **session pooler** string (port 5432 on the `…pooler.supabase.com` host).
- **`prepared statement "s0" already exists`** at runtime — `DATABASE_URL` is
  missing `?pgbouncer=true`. Add it.
- **Attachment links 401** — the client must be signed in; `/api/files/:id`
  requires the JWT. If the browser blocks the redirected Blob response, check that
  the Blob store is `public` (it is by default).
- **Migrations didn't apply** — Vercel does not auto-run `prisma migrate deploy`.
  Run it once from your machine against the `DIRECT_URL`:
  `cd server && npx prisma migrate deploy`.
