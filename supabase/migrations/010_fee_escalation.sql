-- ============================================================
-- Migration 010: Fee escalation tracking
-- ============================================================
-- Tracks how many escalation messages have been sent per overdue
-- voucher so we never send the same level twice and auto-escalate.

alter table fee_vouchers
  add column if not exists escalation_level integer not null default 0;
  -- 0 = not started
  -- 1 = gentle reminder sent (day 1+)
  -- 2 = firm notice sent (day 7+)
  -- 3 = "meet principal" sent (day 15+)
  -- 4 = admin alerted (day 30+)

create index if not exists fee_vouchers_escalation_idx
  on fee_vouchers(school_id, status, escalation_level, due_date)
  where status in ('pending', 'overdue');
