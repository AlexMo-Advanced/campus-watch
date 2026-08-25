-- Add acknowledged_at to report_notifications so crisis lockdowns are not
-- re-shown after the user has dismissed them with "Got It".
-- acknowledged_at is NULL until the user explicitly taps "Got It".

ALTER TABLE report_notifications
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ DEFAULT NULL;

-- Allow authenticated users to mark their own notification rows as acknowledged.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'report_notifications'
      AND policyname = 'Users update own report notifications'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users update own report notifications"
        ON report_notifications FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;
END;
$$;
