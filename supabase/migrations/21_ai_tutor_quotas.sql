-- Persistent per-user AI Tutor quotas. Apply only through the approved
-- migration process; production migration reconciliation remains gated.

CREATE TABLE IF NOT EXISTS public.ai_tutor_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  daily_requests INTEGER NOT NULL DEFAULT 0 CHECK (daily_requests >= 0),
  minute_bucket TIMESTAMPTZ NOT NULL,
  minute_requests INTEGER NOT NULL DEFAULT 0 CHECK (minute_requests >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_tutor_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_tutor_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ai_tutor_usage TO service_role;

CREATE OR REPLACE FUNCTION public.consume_ai_tutor_quota(
  p_user_id UUID,
  p_daily_limit INTEGER,
  p_minute_limit INTEGER
) RETURNS TABLE(allowed BOOLEAN, daily_remaining INTEGER, minute_remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_day DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  current_minute TIMESTAMPTZ := date_trunc('minute', NOW());
  usage_row public.ai_tutor_usage%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the service role may consume AI Tutor quota';
  END IF;
  IF p_user_id IS NULL OR p_daily_limit NOT BETWEEN 1 AND 100
     OR p_minute_limit NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Invalid AI Tutor quota request';
  END IF;

  INSERT INTO public.ai_tutor_usage (
    user_id, usage_date, daily_requests, minute_bucket, minute_requests
  ) VALUES (p_user_id, current_day, 1, current_minute, 1)
  ON CONFLICT (user_id, usage_date) DO UPDATE
  SET daily_requests = LEAST(public.ai_tutor_usage.daily_requests + 1, p_daily_limit + 1),
      minute_requests = CASE
        WHEN public.ai_tutor_usage.minute_bucket < current_minute THEN 1
        ELSE LEAST(public.ai_tutor_usage.minute_requests + 1, p_minute_limit + 1)
      END,
      minute_bucket = current_minute,
      updated_at = NOW()
  RETURNING * INTO usage_row;

  RETURN QUERY SELECT
    usage_row.daily_requests <= p_daily_limit
      AND usage_row.minute_requests <= p_minute_limit,
    GREATEST(0, p_daily_limit - usage_row.daily_requests),
    GREATEST(0, p_minute_limit - usage_row.minute_requests);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_tutor_quota(UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_tutor_quota(UUID, INTEGER, INTEGER)
  TO service_role;
