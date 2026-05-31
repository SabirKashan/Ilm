-- ============================================================
-- Migration 011: WhatsApp Inbox (two-way messaging)
-- ============================================================
-- Stores inbound messages from parents and outbound replies
-- sent from the admin inbox. WATI webhook writes to this table
-- via service role. Admins read & reply from /dashboard/inbox.

create table if not exists whatsapp_messages (
  id           uuid primary key default uuid_generate_v4(),
  school_id    uuid references schools(id) on delete cascade, -- null if phone not matched to any school
  phone        text not null,                 -- E.164 e.g. +923001234567
  direction    text not null check (direction in ('inbound', 'outbound')),
  body         text not null,
  wati_msg_id  text,                          -- WATI's own message ID (dedup)
  student_name text,                          -- resolved via parent_phone lookup
  read_at      timestamptz,                   -- null = unread (admin inbox)
  sent_at      timestamptz not null default now()
);

create index if not exists wm_school_id_idx on whatsapp_messages(school_id, sent_at desc);
create index if not exists wm_phone_idx     on whatsapp_messages(phone, sent_at desc);
create unique index if not exists wm_wati_msg_id_idx on whatsapp_messages(wati_msg_id) where wati_msg_id is not null;

-- No RLS insert — webhook writes via service role.
-- Read restricted to admin of matching school.
alter table whatsapp_messages enable row level security;

create policy "wm: admin read own school" on whatsapp_messages
  for select using (school_id = get_my_school_id() and get_my_role() = 'admin');
