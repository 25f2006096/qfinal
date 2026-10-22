-- =============================================================================
-- Migration 19: Server-validated Repair Circuit attempts and rewards
-- =============================================================================
-- Apply after migrations 15 and 17. Learners never receive INSERT/UPDATE
-- grants; FastAPI uses the service-role-only functions below after Qiskit has
-- evaluated state-vector fidelity.

CREATE TABLE IF NOT EXISTS public.challenge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL,
  submitted_ops JSONB NOT NULL,
  score NUMERIC(8,6) NOT NULL CHECK (score >= 0 AND score <= 1),
  hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0 AND hints_used <= 4),
  mistake_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_user_created ON public.challenge_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_attempts_challenge ON public.challenge_attempts (challenge_id, created_at DESC);
ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own challenge attempts" ON public.challenge_attempts;
CREATE POLICY "Users read own challenge attempts" ON public.challenge_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON TABLE public.challenge_attempts FROM anon, authenticated;
GRANT SELECT ON TABLE public.challenge_attempts TO authenticated;
GRANT ALL ON TABLE public.challenge_attempts TO service_role;

-- Existing reward table is the single XP ledger in this codebase. Extend its
-- constrained event vocabulary instead of introducing a competing client path.
ALTER TABLE public.gamification_rewards
  DROP CONSTRAINT IF EXISTS gamification_rewards_event_type_check;
ALTER TABLE public.gamification_rewards
  ADD CONSTRAINT gamification_rewards_event_type_check
  CHECK (event_type IN ('circuit_mission', 'contest_solution', 'daily_quest', 'repair_circuit'));

CREATE OR REPLACE FUNCTION public.award_repair_circuit_reward(
  p_user_id UUID,
  p_challenge_id TEXT,
  p_tier INTEGER,
  p_hints_used INTEGER
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_xp INTEGER;
  reward_xp INTEGER;
  inserted_id UUID;
  profile_xp INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the service role may award repair rewards';
  END IF;
  base_xp := CASE p_tier WHEN 1 THEN 20 WHEN 2 THEN 30 WHEN 3 THEN 45 WHEN 4 THEN 60 ELSE NULL END;
  IF base_xp IS NULL OR p_hints_used < 0 OR p_hints_used > 4 THEN
    RAISE EXCEPTION 'Invalid repair reward parameters';
  END IF;
  reward_xp := GREATEST(CEIL(base_xp * 0.4)::INTEGER, base_xp - (p_hints_used * 10));
  INSERT INTO public.gamification_rewards (user_id, event_type, event_key, xp_awarded)
  VALUES (p_user_id, 'repair_circuit', 'repair:' || p_challenge_id, reward_xp)
  ON CONFLICT (user_id, event_key) DO NOTHING
  RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'xp_awarded', 0, 'reason', 'already_awarded');
  END IF;
  UPDATE public.profiles SET total_xp = total_xp + reward_xp, updated_at = NOW()
  WHERE id = p_user_id RETURNING total_xp INTO profile_xp;
  INSERT INTO public.gamification_achievements (user_id, achievement_id)
  VALUES (p_user_id, 'first-repair') ON CONFLICT DO NOTHING;
  IF p_hints_used = 0 THEN
    INSERT INTO public.gamification_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'clean-repair') ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('awarded', true, 'xp_awarded', reward_xp, 'total_xp', COALESCE(profile_xp, 0));
END;
$$;
REVOKE ALL ON FUNCTION public.award_repair_circuit_reward(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_repair_circuit_reward(UUID, TEXT, INTEGER, INTEGER) TO service_role;
