-- ============================================================
-- ILM School Management SaaS — Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- SCHOOLS
-- ============================================================
create table schools (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  address               text,
  city                  text,
  phone                 text,
  logo_url              text,
  jazzcash_merchant_id  text,
  easypaisa_merchant_id text,
  onboarding_complete   boolean not null default false,
  created_at            timestamptz not null default now()
);

-- ============================================================
-- USERS (admin / teacher — parents never log in)
-- ============================================================
create table users (
  id         uuid primary key default uuid_generate_v4(),
  school_id  uuid not null references schools(id) on delete cascade,
  name       text not null,
  phone      text not null,
  role       text not null check (role in ('admin', 'teacher')),
  created_at timestamptz not null default now()
);
create index users_school_id_idx on users(school_id);
create index users_phone_idx      on users(phone);

-- ============================================================
-- CLASSES
-- ============================================================
create table classes (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,
  grade_level   text,
  teacher_id    uuid references users(id) on delete set null,
  academic_year text not null
);
create index classes_school_id_idx on classes(school_id);

-- ============================================================
-- STUDENTS
-- ============================================================
create table students (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,
  father_name   text,
  class_id      uuid references classes(id) on delete set null,
  roll_number   text,
  photo_url     text,
  date_of_birth date,
  parent_phone  text not null,
  address       text,
  status        text not null default 'active' check (status in ('active', 'inactive')),
  created_at    timestamptz not null default now()
);
create index students_school_id_idx  on students(school_id);
create index students_class_id_idx   on students(class_id);
create index students_status_idx     on students(status);
create index students_parent_phone_idx on students(parent_phone);

-- ============================================================
-- SUBJECTS
-- ============================================================
create table subjects (
  id         uuid primary key default uuid_generate_v4(),
  school_id  uuid not null references schools(id) on delete cascade,
  class_id   uuid not null references classes(id) on delete cascade,
  name       text not null,
  teacher_id uuid references users(id) on delete set null
);
create index subjects_school_id_idx on subjects(school_id);
create index subjects_class_id_idx  on subjects(class_id);

-- ============================================================
-- ATTENDANCE
-- ============================================================
create table attendance (
  id             uuid primary key default uuid_generate_v4(),
  school_id      uuid not null references schools(id) on delete cascade,
  student_id     uuid not null references students(id) on delete cascade,
  class_id       uuid not null references classes(id) on delete cascade,
  date           date not null,
  status         text not null check (status in ('present', 'absent', 'late')),
  marked_by      uuid not null references users(id),
  whatsapp_sent  boolean not null default false,
  created_at     timestamptz not null default now(),
  unique(student_id, date)
);
create index attendance_school_id_idx  on attendance(school_id);
create index attendance_class_id_idx   on attendance(class_id);
create index attendance_date_idx       on attendance(date);
create index attendance_student_id_idx on attendance(student_id);

-- ============================================================
-- FEE TYPES
-- ============================================================
create table fee_types (
  id         uuid primary key default uuid_generate_v4(),
  school_id  uuid not null references schools(id) on delete cascade,
  name       text not null,
  amount     numeric(10,2) not null,
  frequency  text not null check (frequency in ('monthly', 'annual', 'one-time'))
);
create index fee_types_school_id_idx on fee_types(school_id);

-- ============================================================
-- FEE VOUCHERS
-- ============================================================
create table fee_vouchers (
  id              uuid primary key default uuid_generate_v4(),
  school_id       uuid not null references schools(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  fee_type_id     uuid not null references fee_types(id),
  amount          numeric(10,2) not null,
  due_date        date not null,
  paid_at         timestamptz,
  payment_method  text,
  transaction_id  text,
  status          text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  pdf_url         text,
  whatsapp_sent   boolean not null default false,
  created_at      timestamptz not null default now()
);
create index fee_vouchers_school_id_idx  on fee_vouchers(school_id);
create index fee_vouchers_student_id_idx on fee_vouchers(student_id);
create index fee_vouchers_status_idx     on fee_vouchers(status);
create index fee_vouchers_due_date_idx   on fee_vouchers(due_date);

-- ============================================================
-- EXAMS
-- ============================================================
create table exams (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  class_id    uuid not null references classes(id) on delete cascade,
  date        date not null,
  total_marks integer not null
);
create index exams_school_id_idx on exams(school_id);
create index exams_class_id_idx  on exams(class_id);

-- ============================================================
-- RESULTS
-- ============================================================
create table results (
  id              uuid primary key default uuid_generate_v4(),
  school_id       uuid not null references schools(id) on delete cascade,
  exam_id         uuid not null references exams(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  subject_id      uuid not null references subjects(id) on delete cascade,
  marks_obtained  numeric(6,2) not null,
  remarks         text,
  pdf_url         text,
  whatsapp_sent   boolean not null default false
);
create index results_school_id_idx  on results(school_id);
create index results_exam_id_idx    on results(exam_id);
create index results_student_id_idx on results(student_id);

-- ============================================================
-- TEACHER SALARIES
-- ============================================================
create table teacher_salaries (
  id                 uuid primary key default uuid_generate_v4(),
  school_id          uuid not null references schools(id) on delete cascade,
  user_id            uuid not null references users(id) on delete cascade,
  month              integer not null check (month between 1 and 12),
  year               integer not null,
  base_salary        numeric(10,2) not null,
  advances_deducted  numeric(10,2) not null default 0,
  bonus              numeric(10,2) not null default 0,
  net_salary         numeric(10,2) not null,
  paid_at            timestamptz,
  status             text not null default 'pending' check (status in ('pending', 'paid')),
  unique(user_id, month, year)
);
create index teacher_salaries_school_id_idx on teacher_salaries(school_id);
create index teacher_salaries_user_id_idx   on teacher_salaries(user_id);

-- ============================================================
-- ADVANCES
-- ============================================================
create table advances (
  id           uuid primary key default uuid_generate_v4(),
  school_id    uuid not null references schools(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  amount       numeric(10,2) not null,
  reason       text,
  requested_at timestamptz not null default now(),
  approved_at  timestamptz,
  repaid       boolean not null default false
);
create index advances_school_id_idx on advances(school_id);
create index advances_user_id_idx   on advances(user_id);

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
create table announcements (
  id             uuid primary key default uuid_generate_v4(),
  school_id      uuid not null references schools(id) on delete cascade,
  title          text not null,
  message        text not null,
  target         text not null default 'all' check (target in ('all', 'class')),
  class_id       uuid references classes(id) on delete set null,
  sent_at        timestamptz not null default now(),
  whatsapp_sent  boolean not null default false
);
create index announcements_school_id_idx on announcements(school_id);

-- ============================================================
-- WHATSAPP LOGS
-- ============================================================
create table whatsapp_logs (
  id             uuid primary key default uuid_generate_v4(),
  school_id      uuid not null references schools(id) on delete cascade,
  phone          text not null,
  template_name  text not null,
  status         text not null,
  sent_at        timestamptz not null default now()
);
create index whatsapp_logs_school_id_idx on whatsapp_logs(school_id);
create index whatsapp_logs_phone_idx     on whatsapp_logs(phone);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper: get the authenticated user's school_id from the users table
create or replace function get_my_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from users where id = auth.uid()
$$;

-- Helper: get the authenticated user's role
create or replace function get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from users where id = auth.uid()
$$;

-- Enable RLS on all tables
alter table schools         enable row level security;
alter table users           enable row level security;
alter table classes         enable row level security;
alter table students        enable row level security;
alter table subjects        enable row level security;
alter table attendance      enable row level security;
alter table fee_types       enable row level security;
alter table fee_vouchers    enable row level security;
alter table exams           enable row level security;
alter table results         enable row level security;
alter table teacher_salaries enable row level security;
alter table advances        enable row level security;
alter table announcements   enable row level security;
alter table whatsapp_logs   enable row level security;

-- SCHOOLS: admin can read/update their own school; insert handled by service role on signup
create policy "schools: read own" on schools
  for select using (id = get_my_school_id());

create policy "schools: admin update" on schools
  for update using (id = get_my_school_id() and get_my_role() = 'admin');

-- USERS
create policy "users: read own school" on users
  for select using (school_id = get_my_school_id());

create policy "users: admin insert" on users
  for insert with check (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "users: admin update" on users
  for update using (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "users: admin delete" on users
  for delete using (school_id = get_my_school_id() and get_my_role() = 'admin');

-- CLASSES
create policy "classes: read own school" on classes
  for select using (school_id = get_my_school_id());

create policy "classes: admin write" on classes
  for insert with check (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "classes: admin update" on classes
  for update using (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "classes: admin delete" on classes
  for delete using (school_id = get_my_school_id() and get_my_role() = 'admin');

-- STUDENTS
create policy "students: read own school" on students
  for select using (school_id = get_my_school_id());

create policy "students: admin write" on students
  for insert with check (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "students: admin update" on students
  for update using (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "students: admin delete" on students
  for delete using (school_id = get_my_school_id() and get_my_role() = 'admin');

-- SUBJECTS
create policy "subjects: read own school" on subjects
  for select using (school_id = get_my_school_id());

create policy "subjects: admin write" on subjects
  for insert with check (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "subjects: admin update" on subjects
  for update using (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "subjects: admin delete" on subjects
  for delete using (school_id = get_my_school_id() and get_my_role() = 'admin');

-- ATTENDANCE: teachers can mark, all can read
create policy "attendance: read own school" on attendance
  for select using (school_id = get_my_school_id());

create policy "attendance: write own school" on attendance
  for insert with check (school_id = get_my_school_id());

create policy "attendance: update own school" on attendance
  for update using (school_id = get_my_school_id());

-- FEE TYPES
create policy "fee_types: read own school" on fee_types
  for select using (school_id = get_my_school_id());

create policy "fee_types: admin write" on fee_types
  for insert with check (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "fee_types: admin update" on fee_types
  for update using (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "fee_types: admin delete" on fee_types
  for delete using (school_id = get_my_school_id() and get_my_role() = 'admin');

-- FEE VOUCHERS
create policy "fee_vouchers: read own school" on fee_vouchers
  for select using (school_id = get_my_school_id());

create policy "fee_vouchers: admin write" on fee_vouchers
  for insert with check (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "fee_vouchers: admin update" on fee_vouchers
  for update using (school_id = get_my_school_id() and get_my_role() = 'admin');

-- EXAMS
create policy "exams: read own school" on exams
  for select using (school_id = get_my_school_id());

create policy "exams: admin write" on exams
  for insert with check (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "exams: admin update" on exams
  for update using (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "exams: admin delete" on exams
  for delete using (school_id = get_my_school_id() and get_my_role() = 'admin');

-- RESULTS
create policy "results: read own school" on results
  for select using (school_id = get_my_school_id());

create policy "results: write own school" on results
  for insert with check (school_id = get_my_school_id());

create policy "results: update own school" on results
  for update using (school_id = get_my_school_id());

-- TEACHER SALARIES (admin only)
create policy "salaries: read own school" on teacher_salaries
  for select using (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "salaries: admin write" on teacher_salaries
  for insert with check (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "salaries: admin update" on teacher_salaries
  for update using (school_id = get_my_school_id() and get_my_role() = 'admin');

-- ADVANCES (admin only)
create policy "advances: read own school" on advances
  for select using (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "advances: admin write" on advances
  for insert with check (school_id = get_my_school_id() and get_my_role() = 'admin');

create policy "advances: admin update" on advances
  for update using (school_id = get_my_school_id() and get_my_role() = 'admin');

-- ANNOUNCEMENTS
create policy "announcements: read own school" on announcements
  for select using (school_id = get_my_school_id());

create policy "announcements: admin write" on announcements
  for insert with check (school_id = get_my_school_id() and get_my_role() = 'admin');

-- WHATSAPP LOGS (read-only for users, write via service role)
create policy "whatsapp_logs: read own school" on whatsapp_logs
  for select using (school_id = get_my_school_id());

-- ============================================================
-- STORAGE BUCKET for logos and PDFs
-- ============================================================
insert into storage.buckets (id, name, public)
values ('ilm-assets', 'ilm-assets', false)
on conflict do nothing;

create policy "ilm-assets: authenticated upload" on storage.objects
  for insert with check (
    bucket_id = 'ilm-assets'
    and auth.role() = 'authenticated'
  );

create policy "ilm-assets: authenticated read" on storage.objects
  for select using (
    bucket_id = 'ilm-assets'
    and auth.role() = 'authenticated'
  );
