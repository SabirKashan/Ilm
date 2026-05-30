-- Compound indexes for the 3 most common multi-column query patterns.
-- These are the queries that run on every dashboard load and every cron job.

-- 1. Attendance by class + date (teacher marks attendance, cron checks today's records)
--    Query pattern: WHERE class_id = ? AND date = ?
create index if not exists attendance_class_date_idx
  on attendance(class_id, date);

-- 2. Fee vouchers by student + status (fee reminders cron, defaulters report)
--    Query pattern: WHERE student_id = ? AND status IN ('pending', 'overdue')
create index if not exists fee_vouchers_student_status_idx
  on fee_vouchers(student_id, status);

-- 3. Results by exam + subject (result entry page loads per-subject on every select)
--    Query pattern: WHERE exam_id = ? AND subject_id = ?
create index if not exists results_exam_subject_idx
  on results(exam_id, subject_id);

-- 4. WhatsApp logs by school + template (for reporting/deduplication)
--    Query pattern: WHERE school_id = ? AND template_name = ?
create index if not exists whatsapp_logs_school_template_idx
  on whatsapp_logs(school_id, template_name);

-- 5. Students by class + status (most list pages filter active students per class)
--    Query pattern: WHERE class_id = ? AND status = 'active'
create index if not exists students_class_status_idx
  on students(class_id, status);
