# Tack Room

A small, shared back-office for a horse-lesson business: waivers, contracts (lesson packages and horse leases), offerings, email/text/YouTube scripts, and homework & worksheets. Built with React + Vite + TypeScript on the front, Supabase (Postgres, Storage, Auth) behind it, deployed as a static site on Netlify.

## What's inside

| Area | What it holds |
| --- | --- |
| **Overview** | Documents expiring in the next 30 days, documents awaiting signature, recent activity |
| **Waivers** | Liability / photo / medical / minor-consent waivers per rider, with status, signed and expiry dates, and the signed PDF attached |
| **Contracts** | Lesson-package agreements (linked to an offering) and horse leases (linked to a horse), with status, dates, amount, billing, key terms, and the signed PDF |
| **Offerings** | Lesson package levels, private/group lessons, workshops, clinics, camps: price, lessons included, lesson length, validity, description |
| **Scripts** | Email, text and YouTube scripts with a one-click **Copy**. Write `{{first_name}}`-style placeholders and they're highlighted |
| **Homework** | Homework, worksheets, reading and quizzes per course, written in Markdown (with a live preview) and/or attached as a PDF |
| **Riders / Horses** | The people and horses the documents link to |

Every table is live: when one instructor edits a record, everyone else's screen updates.

Everything is driven by `src/lib/modules.ts`. To add a field, add a column to the table and one line to the module's `fields` array; the list, filters, and form pick it up.

## Setup (about 15 minutes)

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), create a project, and pick a region near you.
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it. It creates the tables, row-level-security policies, audit triggers, the private `documents` storage bucket, and enables live updates.
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.

### 2. Create staff accounts

Sign-ups are closed; the owner creates accounts.

1. **Authentication → Providers → Email**: leave Email enabled. You can turn off "Confirm email" so new accounts work immediately.
2. **Authentication → Users → Add user → Create new user**: enter the email and a starting password. A `profiles` row is created automatically.
3. Optionally in **Table Editor → profiles**, set `full_name`, and set `role` to `owner` for the business owner.

Staff can use "Forgot your password?" on the login screen to set their own password. (For that email to work, set the Site URL under **Authentication → URL Configuration** to your Netlify URL.)

### 3. Run locally

```bash
npm install
cp .env.example .env.local   # then paste the URL and anon key
npm run dev
```

### 4. Deploy on Netlify

1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project**, pick the repo. `netlify.toml` already sets the build command (`npm run build`) and publish directory (`dist`) and adds the SPA redirect.
3. **Site configuration → Environment variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. If the site loads with an "Almost there" screen, the variables aren't set for that build; add them and trigger a new deploy.
5. Back in Supabase, **Authentication → URL Configuration**: set Site URL to your Netlify URL so password-reset links point at the live site.

## Security model

- Only signed-in users can read or write anything (RLS policies on every table and on the storage bucket).
- The anon key in the browser is designed to be public; RLS is what protects the data.
- Any staff member has full access to all records. If you later need read-only staff, tighten the policies in `schema.sql` using the `profiles.role` column.
- PDFs live in a **private** bucket and are opened through 10-minute signed URLs.

## Project layout

```
src/
  lib/modules.ts       Module + field definitions (the app's schema)
  lib/api.ts           Supabase queries, uploads, signed URLs
  lib/store.tsx        Loads all tables once, subscribes to live changes
  components/
    RecordsModule.tsx  Generic list (table or cards), search, filters
    RecordForm.tsx     Generic create/edit modal
    fields.tsx         Field editors: text, select, date, money, tags, markdown, file upload
    Dashboard.tsx      Overview page
    Shell.tsx          Navigation, theme toggle, sign-out
supabase/schema.sql    Run once in the Supabase SQL editor
netlify.toml           Build + SPA redirect
```
