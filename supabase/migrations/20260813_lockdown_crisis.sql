-- Crisis lockdown priority + nearby flag for BLE-proximity alerts.
-- Safe to re-run if already applied in Supabase dashboard.

ALTER TABLE report_notifications
  DROP CONSTRAINT IF EXISTS report_notifications_priority_check;

ALTER TABLE report_notifications
  ADD CONSTRAINT report_notifications_priority_check
  CHECK (priority IN ('crisis', 'critical', 'high', 'normal'));

ALTER TABLE report_notifications
  ADD COLUMN IF NOT EXISTS nearby BOOLEAN NOT NULL DEFAULT false;
