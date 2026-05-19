# ZsuzsiCRM

Travel agency CRM for **UtazóFotós** (utazofotos.com).  
Manages clients, trips, bookings, invoices, emails, and notifications.

**Stack:** Next.js 14 (App Router) · TypeScript (strict) · Supabase (Postgres + Auth + Storage + Realtime) · shadcn/ui · Tailwind CSS · Resend · Recharts · React-PDF · Vercel

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local development — quick start](#local-development--quick-start)
3. [Supabase setup](#supabase-setup)
4. [Environment variables](#environment-variables)
5. [Storage bucket setup](#storage-bucket-setup)
6. [Creating the first (admin) user](#creating-the-first-admin-user)
7. [Deploy to Vercel](#deploy-to-vercel)
8. [Custom domain](#custom-domain)
9. [Cron job setup on Vercel](#cron-job-setup-on-vercel)
10. [Website booking form integration](#website-booking-form-integration)
11. [Updating the application](#updating-the-application)

---

## Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Node.js | 18.17 | [nodejs.org](https://nodejs.org) |
| npm | 9.x (bundled with Node) | — |
| Git | any | [git-scm.com](https://git-scm.com) |

You also need free accounts at:
- **Supabase** — [supabase.com](https://supabase.com) (database + auth + storage)
- **Resend** — [resend.com](https://resend.com) (transactional email)
- **Vercel** — [vercel.com](https://vercel.com) (hosting, optional for local dev)

---

## Local development — quick start

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_ORG/zsuzsicrm.git
cd zsuzsicrm

# 2. Install dependencies
npm install

# 3. Copy the example environment file
cp .env.local.example .env.local
# → Edit .env.local and fill in all values (see Environment variables section)

# 4. Start the dev server
npm run dev
# → Open http://localhost:3000
```

> The app will redirect unauthenticated visitors to `/login`.  
> Complete [Supabase setup](#supabase-setup) and [create the admin user](#creating-the-first-admin-user) before logging in.

---

## Supabase setup

### 1. Create a project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose an organisation, enter a project name (e.g. `zsuzsicrm`), set a **strong database password** (save it somewhere safe), and pick the `eu-central-1` region (Frankfurt — lowest latency from Austria).
4. Wait ~2 minutes for the project to be ready.

### 2. Get your API keys

1. In the Supabase dashboard, go to **Project Settings → API**.
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret key** → `SUPABASE_SERVICE_ROLE_KEY`
3. Paste them into `.env.local`.

### 3. Run the database migrations

The migrations live in `supabase/migrations/`. Run them **in order** using the Supabase SQL editor:

1. In the Supabase dashboard, go to **SQL Editor**.
2. Click **New query**.
3. Open `supabase/migrations/20260513000000_initial_schema.sql` in a text editor, copy the entire contents, paste into the SQL editor, and click **Run**.
4. Repeat for each migration file **in numerical order**:
   - `20260513000001_realtime_and_settings.sql`
   - `20260513000002_website_integration.sql`
   - `20260513000003_storage_and_settings.sql`

> **Tip:** You can run all migrations at once by concatenating the files, but running them one at a time makes it easier to spot errors.

After running the migrations:
- All tables, triggers, indexes, and RLS policies are created.
- Default settings are seeded (agency name, discount levels, notification toggles, etc.).
- The `company` storage bucket is created.

### 4. Enable Realtime for the notifications table

1. In the Supabase dashboard, go to **Database → Replication**.
2. Find the `notifications` table in the list.
3. Enable the **INSERT** and **UPDATE** events.

> Migration `000001` attempts this via SQL (`ALTER PUBLICATION supabase_realtime ADD TABLE notifications`). If it fails in your environment, do it manually as described above.

### 5. Enable email confirmation (optional)

Since this is a single-admin system, you may want to **disable** email confirmation so the admin can log in immediately after creation:

1. Go to **Authentication → Providers → Email**.
2. Turn off **Confirm email**.

---

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in every value.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only) |
| `RESEND_API_KEY` | ✅ | Resend API key for transactional email |
| `RESEND_FROM_EMAIL` | ✅ | Sender address (must be a verified Resend domain) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public URL of this deployment (no trailing slash) |
| `CRON_SECRET` | ✅ | Random secret for securing the cron endpoint |
| `CORS_EXTRA_ORIGIN` | ☐ | Extra CORS origin for the booking-form API |
| `BOOKING_FORM_TEST_KEY` | ☐ | Enables test endpoint in production when set |

**Generating a strong `CRON_SECRET`:**
```bash
# macOS / Linux
openssl rand -hex 32

# Windows PowerShell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

## Storage bucket setup

The `company` storage bucket is created by migration `000003`. If the migration ran successfully, no manual steps are needed.

To verify:
1. Go to **Storage** in the Supabase dashboard.
2. You should see a `company` bucket.
3. The bucket should be **public** (logos on invoices are publicly readable).

**To upload a company logo:**  
Go to **Settings → Céges adatok** in the CRM and use the logo upload widget.

---

## Creating the first (admin) user

The CRM is a single-user system. Create the admin account through the Supabase dashboard:

1. Go to **Authentication → Users**.
2. Click **Invite user** (or **Add user** depending on your Supabase version).
3. Enter the admin email address and a strong password (minimum 12 characters).
4. Click **Create user**.
5. If email confirmation is enabled, check the inbox and confirm the address.

> There is no self-registration on the CRM — only this manually created user can log in.

---

## Deploy to Vercel

### 1. Push to GitHub (or GitLab / Bitbucket)

```bash
git remote add origin https://github.com/YOUR_ORG/zsuzsicrm.git
git push -u origin main
```

### 2. Import into Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project**.
3. Select your repository and click **Import**.
4. Under **Framework Preset**, Vercel should auto-detect **Next.js**.
5. Open **Environment Variables** and add every variable from your `.env.local` file.
   - Do **not** add `NEXT_PUBLIC_APP_URL` for localhost — set it to `https://YOUR_DOMAIN` instead.
6. Click **Deploy**.

### 3. Verify the deployment

- Visit the Vercel-provided URL (e.g. `https://zsuzsicrm.vercel.app`).
- You should be redirected to `/login`.
- Log in with the credentials you created in Supabase.

---

## Custom domain

### Setting up `crm.utazofotos.com`

1. In Vercel, go to your project → **Settings → Domains**.
2. Add `crm.utazofotos.com`.
3. Vercel will show you a DNS record to add. Log into your domain registrar and add it:

   | Type | Name | Value |
   |------|------|-------|
   | `CNAME` | `crm` | `cname.vercel-dns.com` |

   (Exact values shown in Vercel — use those.)

4. Wait for DNS propagation (usually < 5 minutes with Cloudflare, up to 24 h for other registrars).
5. Vercel will automatically provision an SSL certificate.

6. Update `NEXT_PUBLIC_APP_URL` in Vercel's environment variables to `https://crm.utazofotos.com` and **redeploy**.

---

## Cron job setup on Vercel

The daily notification check runs at **08:00 UTC** via `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "0 8 * * *"
    }
  ]
}
```

This file is already committed to the repository. Vercel will automatically register the cron when you deploy.

**To verify the cron is registered:**
1. In Vercel, go to your project → **Settings → Crons**.
2. You should see `/api/cron/notifications` listed with a daily schedule.

**To test the cron manually:**
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://crm.utazofotos.com/api/cron/notifications
```
Expected response: `{"success":true,"date":"...","created":0,"summary":{...}}`

**What the cron does:**
- Checks for expiring passports (60-day warning)
- Checks for upcoming payment deadlines (3-day warning)
- Checks for overdue payments
- Checks for trips departing in 14 days
- Checks for trips with ≤ 2 spots remaining
- Creates notifications in the database (deduplication prevents duplicates)
- Notifications appear in the bell icon in real-time via Supabase Realtime

---

## Website booking form integration

The CRM exposes a public endpoint that the utazofotos.com booking form can POST to:

```
POST https://crm.utazofotos.com/api/booking-form
```

**To add the integration to utazofotos.com:**

1. Make sure your booking form has inputs with these `name` attributes:
   - `name` — full name
   - `email` — email address
   - `phone` — phone number
   - `trip` — name of the requested trip
   - `message` — optional message (textarea)

2. Add the script **before `</body>`**:

```html
<script>
  window.ZsuzsiCRMConfig = {
    apiUrl: 'https://crm.utazofotos.com/api/booking-form',
    formSelector: '#your-form-id',  // CSS selector for your form
  };
</script>
<script src="https://crm.utazofotos.com/booking-form.js" defer></script>
```

3. The script will:
   - Automatically add a hidden honeypot field (spam protection)
   - Show a loading spinner on submit
   - Display a success message on submission
   - Show field-level validation errors
   - Handle rate limiting gracefully

**To test without a live website:**
```bash
# Check what would happen (no DB writes):
curl -X GET https://crm.utazofotos.com/api/booking-form/test

# Dry-run a submission:
curl -X POST https://crm.utazofotos.com/api/booking-form/test \
  -H "Content-Type: application/json" \
  -d '{"name":"Kiss Mariann","email":"test@test.com","phone":"+36301234567","trip":"Toszkán körutazás","message":"","honeypot":""}'
```

> The test endpoint returns a detailed JSON showing exactly what the real endpoint would do, without writing anything to the database.

---

## Updating the application

### Pull latest changes

```bash
git pull origin main
npm install          # in case dependencies changed
npm run dev          # verify locally
```

### Running new migrations

When new migration files appear in `supabase/migrations/`, run them in the Supabase SQL editor in order (same as initial setup).

### Deploying updates

```bash
git push origin main
# Vercel will automatically detect the push and redeploy
```

Monitor the deployment in Vercel's dashboard. The deployment typically takes 1–2 minutes.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Redirected to `/login` on every page | Session cookie not set | Check Supabase URL/keys in env vars |
| "Hitelesítés szükséges" on API calls | Middleware blocking unauthenticated API access | Log in first; API routes require a valid session |
| Emails not sent | `RESEND_API_KEY` invalid or domain not verified | Check Resend dashboard; verify sender domain |
| Notifications don't appear in real-time | Realtime not enabled for `notifications` table | Enable in Supabase Dashboard → Database → Replication |
| Logo upload fails | `company` storage bucket missing | Run migration `000003` or create bucket manually |
| Cron job shows 401 | `CRON_SECRET` not set in Vercel env vars | Add `CRON_SECRET` in Vercel → Settings → Environment Variables |
| "Túl sok kérés" on booking form | Rate limit hit (5 req/IP/hour) | Wait 1 hour; adjust limit in `src/app/api/booking-form/route.ts` |

---

*Built with ❤ for ZsuzsiTravel.*
