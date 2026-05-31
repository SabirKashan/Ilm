-- ============================================================
-- Migration 006: Timetable slots + Activity logs
-- ============================================================

-- TIMETABLE SLOTS
create table if not exists timetable_slots (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references schools(id) on delete cascade,
  class_id    uuid not null references classes(id) on delete cascade,
  subject_id  uuid references subjects(id) on delete set null,
  teacher_id  uuid references users(id) on delete set null,
  day         text not null check (day in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  period      integer not null check (period between 1 and 10),
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  unique(class_id, day, period)
);
create index timetable_slots_school_id_idx on timetable_slots(school_id);
create index timetable_slots_class_id_idx  on timetable_slots(class_id);

alter table timetable_slots enable row level security;

create policy "timetable: read own school" on timetable_slots
  for select using (school_id = get_my_school_id());

create policy "timetable: admin write" on timetable_slots
  for insert with check (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "timetable: admin update" on timetable_slots
  for update using (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "timetable: admin delete" on timetable_slots
  for delete using (school_id = get_my_school_id() and get_my_role() = 'admin');


-- ACTIVITY LOGS (written by service role only, read by admin)
create table if not exists activity_logs (
  id           uuid primary key default uuid_generate_v4(),
  school_id    uuid not null references schools(id) on delete cascade,
  user_id      uuid references users(id) on delete set null,
  user_name    text,
  action       text not null,   -- e.g. "added_student", "marked_attendance", "generated_fees"
  entity_type  text,            -- e.g. "student", "exam", "fee_voucher"
  entity_id    uuid,
  entity_label text,            -- human-readable, e.g. student name
  created_at   timestamptz not null default now()
);
create index activity_logs_school_id_idx on activity_logs(school_id);
create index activity_logs_created_at_idx on activity_logs(school_id, created_at desc);

alter table activity_logs enable row level security;

create policy "activity_logs: read own school" on activity_logs
  for select using (school_id = get_my_school_id());

-- Only service role can write activity logs (bypasses RLS)
