-- ============================================================
-- Migration 012: Meta WhatsApp Cloud API credentials
-- ============================================================
-- Moving away from per-school WATI accounts (which caused bans)
-- to Meta Cloud API. Each school gets their own Meta credentials
-- (phone_number_id + access_token) stored here.
-- Existing wati_endpoint/wati_token columns kept as fallback.

alter table schools
  add column if not exists meta_phone_number_id text,
  add column if not exists meta_access_token    text,
  add column if not exists meta_waba_id         text;  -- WhatsApp Business Account ID (for template submission)

-- Track which provider is active per school
-- 'meta' | 'wati' | null (no WhatsApp configured)
alter table schools
  add column if not exists whatsapp_provider text
    check (whatsapp_provider in ('meta', 'wati'))
    default null;
