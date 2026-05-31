-- ============================================================
-- Migration 009: Homework / Daily Diary
-- ============================================================
-- Teachers (and admins) post homework or a daily diary entry per class.
-- Parents receive it instantly on WhatsApp — the core daily-engagement
-- feature that keeps Ilm in front of parents every single day.

create table if not exists homework (
  id              uuid primary key default uuid_generate_v4(),
  school_id       uuid not null references schools(id) on delete cascade,
  class_id        uuid not null references classes(id) on delete cascade,
  subject         text,                       -- optional, free text e.g. "Maths"
  title           text not null,
  details         text,
  due_date        date,
  created_by      uuid references users(id) on delete set null,
  created_by_name text,
  whatsapp_sent   boolean not null default false,
  recipient_count integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists homework_school_id_idx on homework(school_id);
create index if not exists homework_class_id_idx  on homework(class_id, created_at desc);

alter table homework enable row level security;

create policy "homework: read own school" on homework
  for select using (school_id = get_my_school_id());

-- Both admins and teachers can post homework
create policy "homework: staff insert" on homework
  for insert with check (school_id = get_my_school_id());

create policy "homework: staff update" on homework
  for update using (school_id = get_my_school_id());

create policy "homework: admin delete" on homework
  for delete using (school_id = get_my_school_id() and get_my_role() = 'admin');
