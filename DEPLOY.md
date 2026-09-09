# Deploying AU Hub to Vercel

The app is a Vite static client + an Express/Prisma API that runs as **one Vercel
serverless function** (`api/index.ts`). Storage is **Neon Postgres** and
**Vercel Blob**. This whole guide is a one-time setup of ~15 minutes.

---

## 1. Create the database (Neon)

1. https://neon.tech → new project, name it `auhub` (any region near your users).
2. From the project dashboard, **Connection string** panel, copy **two** URLs:
   - **Pooled** — has `-pooler` in the host, ends `?sslmode=require`. This is `DATABASE_URL`.
   - **Direct** — no `-pooler`. This is `DIRECT_URL`.
   (Vercel's own "Postgres" storage is Neon under the hood — using Neon directly
   just keeps the free tier separate from the Vercel bill.)

## 2. Run the first migration + seed (from your machine)

```bash
cd server
cp .env.example .env          # then paste the real DATABASE_URL / DIRECT_URL / JWT_SECRET
npx prisma migrate dev --name init      # creates the Postgres migration + applies it
npm run seed                            # creates the admin (admin / admin123) + demo data
```

Commit the generated `server/prisma/migrations/` folder — Vercel replays it on deploy.
(Re-run `npx prisma migrate dev` locally whenever you change `schema.prisma`, then commit.)

## 3. Push the repo

```bash
git add -A && git commit -m "vercel: postgres + blob storage + serverless api"
git push
```

## 4. Import into Vercel

1. https://vercel.com → **Add New → Project** → import `waseem11062000-ux/AUHUB`.
2. Framework preset: **Other**. Leave build/install/output blank — `vercel.json`
   already sets them (`vercel-build`, `client/dist`, `/api/*` → the function).
3. **Environment Variables** (all environments):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** URL |
   | `DIRECT_URL` | Neon **direct** URL |
   | `JWT_SECRET` | a long random string (`node -e "console.log(crypto.randomBytes(48).toString('base64url'))"`) |
   | `NODE_ENV` | `production` |

4. **Deploy.**

## 5. Add Blob storage

1. Project → **Storage** tab → **Create → Blob** → connect it.
2. Vercel auto-adds `BLOB_READ_WRITE_TOKEN` to the project's env vars.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the function picks up the token.

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
- **File access:** `/api/files/:id` checks you're logged in, then 302-redirects to
  the Blob URL (which carries a random suffix, so it isn't guessable). It does not
  stream bytes through the function — serverless response bodies are capped at
  4.5 MB and payment slips can be larger.
- **Schema changes after go-live:** `npx prisma migrate dev` locally → commit → push.
  Vercel runs `prisma migrate deploy` is **not** automatic here; run
  `cd server && DATABASE_URL=<direct-url> npx prisma migrate deploy` against Neon
  when you ship a migration, or add it as a Vercel "Deploy Hook" / GitHub Action.
- **Backups:** Neon keeps point-in-time restore on paid tiers; on free, take a
  `pg_dump` before risky changes.

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
- **Attachment links 401** — the client must be signed in; `/api/files/:id`
  requires the JWT. If the browser blocks the redirected Blob response, check that
  the Blob store is `public` (it is by default).
- **Migrations didn't apply** — Vercel does not auto-run `prisma migrate deploy`.
  Run it once from your machine against the Neon **direct** URL:
  `cd server && DIRECT_URL=... DATABASE_URL=... npx prisma migrate deploy`.
