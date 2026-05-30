# Ilm — School Management SaaS

WhatsApp-first school management for Pakistani private schools (50–500 students). Parents never log in — they receive attendance, fee vouchers, and results directly on WhatsApp.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** (PostgreSQL, Auth, Storage, RLS)
- **react-i18next** — English / Urdu with RTL support
- **next-pwa** — installable on Android
- **WATI** — WhatsApp Business API

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.local` and fill in your values:

```bash
cp .env.local .env.local.bak   # keep a backup
```

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `WATI_API_TOKEN` | WATI dashboard → API |
| `WATI_BASE_URL` | WATI dashboard (e.g. `https://live-server-XXXXX.wati.io`) |
| `JAZZCASH_MERCHANT_ID` | JazzCash merchant portal |
| `JAZZCASH_PASSWORD` | JazzCash merchant portal |
| `JAZZCASH_INTEGRITY_SALT` | JazzCash merchant portal |

### 3. Run the Supabase migration

In your Supabase project → SQL Editor, run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, indexes, RLS policies, and the `ilm-assets` storage bucket.

### 4. Enable Phone Auth in Supabase

Supabase Dashboard → Authentication → Providers → Phone → Enable.

For production, connect a Twilio/Vonage account. For local testing, Supabase provides a test OTP mode.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
/app
  /auth/login          # Phone number entry
  /auth/verify         # OTP verification
  /onboarding          # First-time school setup (admin only)
  /dashboard           # Admin routes (protected)
    /students
    /classes
    /attendance
    /fees
    /exams
    /payroll
    /announcements
    /settings
  /teacher             # Teacher routes (protected)
  /api                 # API routes (webhooks, WhatsApp, payments)
/components
  /ui                  # shadcn components
  /dashboard           # Dashboard-specific components
/lib
  supabase.ts          # Supabase client (browser + server)
  utils.ts             # formatPKR, formatDate, formatPhonePK
  i18n.ts              # react-i18next init
/locales
  en.json              # English strings
  ur.json              # Urdu strings
/types
  database.ts          # TypeScript types for all DB tables
/supabase
  /migrations
    001_initial_schema.sql
```

## User Roles

| Role | Access |
|---|---|
| **Admin** | Full dashboard, all data for their school |
| **Teacher** | Limited dashboard, only their assigned classes |
| **Parent** | No login. WhatsApp only. |

## Multi-tenancy

Every table has a `school_id` column. Supabase RLS ensures users can only access their own school's data. The service role key (never exposed to the browser) is used for server-side operations like creating new school records.

## Design Tokens

| Token | Value |
|---|---|
| Primary | `#1B4332` (deep green) |
| Accent | `#F59E0B` (amber) |
| Min width | 375px (mobile-first) |
| Currency | `Rs. 12,500` format |
| Dates | `DD/MM/YYYY` format |

## Adding a New Admin

Since there's no public sign-up (prevents unauthorized school creation), new admins are created via the Supabase service role. A seed script / invite flow will be added in a future session.

## Roadmap (upcoming sessions)

- [ ] Students CRUD
- [ ] Classes & subjects management
- [ ] Daily attendance marking + WhatsApp notifications
- [ ] Fee voucher generation + JazzCash/Easypaisa payment links
- [ ] Exam results + PDF generation
- [ ] Teacher payroll + advance tracking
- [ ] Announcements → WhatsApp broadcast
- [ ] Urdu RTL mode toggle
- [ ] PWA install prompt
