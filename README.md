# CRM Pipeline

Internal CRM web app that replaces the pipeline spreadsheet. Built with:

- **Next.js 14** (App Router) on **Vercel**
- **Supabase** for Postgres + Auth (magic-link login)
- Single "Pipeline" page: filterable table, add/upload companies, SQL query bar

All authenticated teammates can read, add, upload, and run read-only SQL queries.

---

## 1. Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [Vercel](https://vercel.com) account
- (Optional) A company email domain to restrict logins to

## 2. Supabase setup

1. Create a new Supabase project. Copy the **Project URL**, **anon public key**, and **service role key** from *Project Settings → API*.
2. In the Supabase SQL editor, paste the contents of `supabase/migrations/20260416_init.sql` and run it. This creates the `companies` table, RLS policies, and the `run_readonly_query` RPC.
3. In *Authentication → Providers*, enable **Email** (magic link is on by default).
4. (Optional) In *Authentication → URL Configuration*, add your production URL (Vercel) plus `http://localhost:3000` to the allowed redirect URLs.

## 3. Local setup

```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# Optional: ALLOWED_EMAIL_DOMAIN=yourcompany.com

npm install
npm run seed                 # imports the `pipeline` CSV into Supabase
npm run dev                  # http://localhost:3000
```

The seed script reads `./pipeline` by default. To point it elsewhere:
```bash
npm run seed -- /absolute/path/to/pipeline.csv
```

## 4. Deploy to Vercel

1. Push this repo to GitHub (already done if you're reading this on the feature branch).
2. In Vercel, **Import Project** from the GitHub repo.
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` (optional, e.g. `yourcompany.com`)
4. Deploy. Add the Vercel URL to Supabase *Authentication → URL Configuration* as an allowed redirect.

## 5. Using the app

- **Sign in**: magic link to your work email.
- **Filter**: use the filter bar to narrow by Owner/Status/Layer/Grade/Territory, plus free-text search. "Mine only" narrows to rows whose `Owner` field contains your email's local part (heuristic; see "Known limitations" below).
- **Add company**: click *Add company* to create a new row.
- **Upload CSV**: click *Upload CSV*; column headers must match the original pipeline schema. Unknown columns are ignored, rows without `Company Name` are skipped.
- **SQL bar**: write a `SELECT`/`WITH` query and hit Run. Only one statement at a time, capped at 5,000 rows.

## 6. Security model (v1)

- Every teammate with an allowed email can read, insert, update, delete, and run SQL.
- The SQL bar is server-validated to reject anything that isn't a single `SELECT`/`WITH` statement. Dangerous keywords (`insert`, `update`, `delete`, `drop`, `alter`, etc.) are blocked. Results capped at 5,000 rows. This is defense in depth on top of Postgres-level permissions, not a replacement for them.
- Service-role key stays on the server only (Vercel env var, never exposed to the browser).

## 7. Known limitations / next steps

- "Mine only" uses email local-part matching against the `Owner` string. To be precise, add a `user_id uuid` column to `companies` and a lookup table of owner email → display name.
- Row-level update/delete from the UI isn't built yet. It's one form away — the RLS policy already allows it.
- Multiple views (by Owner, by Layer, pivot dashboards) can be added later; for now the combined page with filters replaces them.
- No audit log yet. Add a trigger that writes to a `companies_audit` table when we need it.

## 8. File map

```
app/
  layout.tsx                    root layout
  page.tsx                      redirects to /pipeline
  login/page.tsx                magic-link login form
  auth/callback/route.ts        OAuth-style callback, exchanges code for session
  auth/signout/route.ts         POST /auth/signout
  pipeline/
    page.tsx                    server component, loads rows
    PipelineClient.tsx          client wrapper, state
    FilterBar.tsx               filter controls
    DataGrid.tsx                sortable table
    AddCompanyDialog.tsx        "Add company" modal
    UploadCsvDialog.tsx         CSV upload modal
    SqlQueryBar.tsx             read-only SQL bar
  api/
    companies/route.ts          POST create
    companies/upload/route.ts   POST CSV bulk insert
    sql/route.ts                POST read-only SQL
lib/
  supabase/server.ts            server client (cookies)
  supabase/client.ts            browser client
  schema.ts                     Company type + CSV column map
  csv.ts                        CSV row coercion + date normalization
supabase/
  migrations/20260416_init.sql  schema + RLS + RPC
  seed.ts                       bulk import script
middleware.ts                   redirect unauthenticated users to /login
```
