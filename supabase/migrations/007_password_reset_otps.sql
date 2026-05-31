-- Migration 007: Password reset OTPs table
-- Stores short-lived OTPs for WhatsApp-based forgot-password flow.
-- Written by service role only (no RLS insert policy).
-- Auto-cleaned: rows expire after 5 minutes (enforced in app logic).

create table if not exists password_reset_otps (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  phone      text not null,
  otp        text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_otps_phone_idx on password_reset_otps(phone);

-- No RLS needed — only accessed via service role API routes.
-- Rows are deleted immediately after use or expiry check.
