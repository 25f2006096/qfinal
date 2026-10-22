-- Migration 20: canonical, server-owned XP event ledger and trusted streaks.
-- Apply only through the approved migration/reconciliation process. This
-- migration has not been applied to production.

ALTER TABLE public.gamification_rewards RENAME TO xp_events;
ALTER TABLE public.xp_events RENAME COLUMN event_type TO source_type;
ALTER TABLE public.xp_events RENAME COLUMN event_key TO source_id;

ALTER TABLE public.xp_events
  DROP CONSTRAINT IF EXISTS gamification_rewards_event_type_check;
ALTER TABLE public.xp_events
  DROP CONSTRAINT IF EXISTS xp_events_source_type_check;
ALTER TABLE public.xp_events
  ADD CONSTRAINT xp_events_source_type_check CHECK (
    source_type IN (
      'lesson_checkpoint', 'quiz_pass', 'challenge_solve', 'circuit_challenge',
      'mastery_assessment', 'major_milestone', 'topic_complete', 'module_complete',
      'puzzle_solve', 'lab_experiment', 'circuit_mission', 'contest_solution',
      'daily_quest', 'repair_circuit'
    )
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_events_user_source
  ON public.xp_events (user_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_user_created
  ON public.xp_events (user_id, created_at DESC);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.xp_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.xp_events TO service_role;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_gamification_activity_date DATE;

CREATE OR REPLACE FUNCTION public._unlock_gamification_achievement(
  p_user_id UUID,
  p_achievement_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inserted_id TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the service role may unlock achievements';
  END IF;
  INSERT INTO public.gamification_achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING
  RETURNING achievement_id INTO inserted_id;
  RETURN inserted_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public._unlock_gamification_achievement(UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._record_verified_xp(
  p_user_id UUID,
  p_source_type TEXT,
  p_source_id TEXT,
  p_xp INTEGER,
  p_daily_circuit BOOLEAN DEFAULT FALSE,
  p_hints_used INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inserted_id UUID;
  daily_xp INTEGER := 0;
  profile_xp INTEGER;
  active_streak INTEGER;
  best_streak INTEGER;
  previous_activity DATE;
  today_utc DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  earned_badges TEXT[] := ARRAY[]::TEXT[];
  badge_id TEXT;
  new_achievements JSONB := '[]'::JSONB;
  event_count INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the service role may record XP';
  END IF;
  IF p_user_id IS NULL OR p_source_id IS NULL OR length(trim(p_source_id)) = 0
     OR length(p_source_id) > 200 OR p_xp IS NULL OR p_xp <= 0
     OR p_source_type IS NULL OR p_source_type NOT IN (
       'lesson_checkpoint', 'quiz_pass', 'challenge_solve', 'circuit_challenge',
       'mastery_assessment', 'major_milestone', 'topic_complete', 'module_complete',
       'puzzle_solve', 'lab_experiment', 'circuit_mission', 'contest_solution',
       'repair_circuit'
     ) THEN
    RAISE EXCEPTION 'Invalid or unknown XP event';
  END IF;
  IF p_daily_circuit AND p_source_type <> 'circuit_mission' THEN
    RAISE EXCEPTION 'Daily circuit bonus is valid only for verified circuit missions';
  END IF;
  IF p_hints_used IS NOT NULL AND (p_hints_used < 0 OR p_hints_used > 4) THEN
    RAISE EXCEPTION 'Invalid hint count';
  END IF;

  SELECT total_xp, current_streak, longest_streak, last_gamification_activity_date
    INTO profile_xp, active_streak, best_streak, previous_activity
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Learner profile does not exist';
  END IF;

  INSERT INTO public.xp_events (user_id, source_type, source_id, xp_awarded)
  VALUES (p_user_id, p_source_type, p_source_id, p_xp)
  ON CONFLICT (user_id, source_type, source_id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    RETURN jsonb_build_object(
      'awarded', FALSE, 'xp_awarded', 0, 'daily_quest_xp', 0,
      'total_xp', COALESCE(profile_xp, 0), 'current_streak', COALESCE(active_streak, 0),
      'longest_streak', COALESCE(best_streak, 0), 'new_achievements', '[]'::JSONB
    );
  END IF;

  IF p_daily_circuit THEN
    INSERT INTO public.xp_events (user_id, source_type, source_id, xp_awarded)
    VALUES (p_user_id, 'daily_quest', 'daily:circuit:' || today_utc::TEXT, 20)
    ON CONFLICT (user_id, source_type, source_id) DO NOTHING
    RETURNING xp_awarded INTO daily_xp;
    daily_xp := COALESCE(daily_xp, 0);
  END IF;

  IF previous_activity IS NULL OR previous_activity < today_utc - 1 THEN
    active_streak := 1;
  ELSIF previous_activity = today_utc - 1 THEN
    active_streak := COALESCE(active_streak, 0) + 1;
  ELSE
    active_streak := COALESCE(active_streak, 1);
  END IF;
  best_streak := GREATEST(COALESCE(best_streak, 0), active_streak);

  UPDATE public.profiles
  SET total_xp = COALESCE(total_xp, 0) + p_xp + daily_xp,
      current_streak = active_streak,
      longest_streak = best_streak,
      last_gamification_activity_date = today_utc,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING total_xp INTO profile_xp;

  IF p_source_type IN ('circuit_mission', 'repair_circuit') THEN
    earned_badges := array_append(earned_badges, 'first-circuit');
    INSERT INTO public.gamification_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'first-circuit') ON CONFLICT (user_id, achievement_id) DO NOTHING;
    SELECT count(*) INTO event_count
    FROM public.xp_events
    WHERE user_id = p_user_id AND source_type IN ('circuit_mission', 'repair_circuit');
    IF event_count >= 5 THEN
      earned_badges := array_append(earned_badges, 'circuit_builder');
    END IF;
    IF p_source_type = 'repair_circuit' THEN
      earned_badges := array_append(earned_badges, 'first-repair');
      IF p_hints_used = 0 THEN
        earned_badges := array_append(earned_badges, 'clean-repair');
      END IF;
    ELSIF p_source_id = 'build-bell-state' THEN
      earned_badges := array_append(earned_badges, 'bell-state');
    END IF;
    IF p_source_type = 'circuit_mission' THEN
      SELECT count(DISTINCT source_id) INTO event_count
      FROM public.xp_events WHERE user_id = p_user_id AND source_type = 'circuit_mission';
      IF event_count >= 3 THEN
        earned_badges := array_append(earned_badges, 'all-missions');
      END IF;
    END IF;
  ELSIF p_source_type = 'contest_solution' THEN
    earned_badges := array_append(earned_badges, 'first-contest');
  END IF;

  IF active_streak >= 3 THEN
    earned_badges := array_append(earned_badges, 'streak-3');
  END IF;
  IF active_streak >= 7 THEN
    earned_badges := array_append(earned_badges, 'streak_7');
  END IF;
  IF profile_xp >= 100 THEN
    earned_badges := array_append(earned_badges, 'xp-100');
  END IF;
  IF profile_xp >= 500 THEN
    earned_badges := array_append(earned_badges, 'xp-500');
  END IF;
  IF profile_xp >= 1000 THEN
    earned_badges := array_append(earned_badges, 'xp-1000');
  END IF;

  SELECT count(*) INTO event_count
  FROM public.xp_events WHERE user_id = p_user_id AND source_type = 'daily_quest';
  IF event_count >= 5 THEN
    earned_badges := array_append(earned_badges, 'daily-quest-5');
  END IF;

  FOREACH badge_id IN ARRAY earned_badges LOOP
    IF public._unlock_gamification_achievement(p_user_id, badge_id) THEN
      new_achievements := new_achievements || jsonb_build_array(jsonb_build_object('id', badge_id));
    END IF;
  END LOOP;

  IF p_source_type IN ('circuit_mission', 'contest_solution') THEN
    INSERT INTO public.notifications (user_id, category, title, body, route)
    VALUES (
      p_user_id, 'mission',
      'Verified learning: +' || (p_xp + daily_xp)::TEXT || ' XP',
      'You completed a verified learning activity and earned XP.',
      CASE WHEN p_source_type = 'circuit_mission' THEN '/circuit' ELSE '/contests' END
    );
  END IF;

  RETURN jsonb_build_object(
    'awarded', TRUE, 'xp_awarded', p_xp, 'daily_quest_xp', daily_xp,
    'total_xp', profile_xp, 'current_streak', active_streak,
    'longest_streak', best_streak, 'new_achievements', new_achievements
  );
END;
$$;
REVOKE ALL ON FUNCTION public._record_verified_xp(UUID, TEXT, TEXT, INTEGER, BOOLEAN, INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_gamification_reward(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reward_xp INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the service role may award XP';
  END IF;
  reward_xp := CASE
    WHEN p_event_type = 'lesson_checkpoint' THEN 10
    WHEN p_event_type = 'quiz_pass' THEN 20
    WHEN p_event_type = 'challenge_solve' THEN 30
    WHEN p_event_type = 'circuit_challenge' THEN 50
    WHEN p_event_type = 'mastery_assessment' THEN 75
    WHEN p_event_type = 'major_milestone' THEN 100
    WHEN p_event_type = 'topic_complete' THEN 15
    WHEN p_event_type = 'module_complete' THEN 100
    WHEN p_event_type = 'puzzle_solve' THEN 25
    WHEN p_event_type = 'lab_experiment' THEN 20
    WHEN p_event_type = 'contest_solution' AND p_event_key ~ '^contest:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:problem:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN 75
    WHEN p_event_type = 'circuit_mission' AND p_event_key = 'build-superposition' THEN 30
    WHEN p_event_type = 'circuit_mission' AND p_event_key = 'build-bell-state' THEN 50
    WHEN p_event_type = 'circuit_mission' AND p_event_key = 'build-ghz-state' THEN 60
    ELSE NULL
  END;
  IF reward_xp IS NULL THEN
    RAISE EXCEPTION 'Unknown or invalid XP source';
  END IF;
  RETURN public._record_verified_xp(
    p_user_id, p_event_type, p_event_key, reward_xp,
    p_event_type = 'circuit_mission', NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION public.award_gamification_reward(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_gamification_reward(UUID, TEXT, TEXT) TO service_role;

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
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the service role may award repair rewards';
  END IF;
  base_xp := CASE p_tier WHEN 1 THEN 20 WHEN 2 THEN 30 WHEN 3 THEN 45 WHEN 4 THEN 60 ELSE NULL END;
  IF base_xp IS NULL OR p_challenge_id IS NULL OR length(trim(p_challenge_id)) = 0
     OR length(p_challenge_id) > 100 OR p_hints_used < 0 OR p_hints_used > 4 THEN
    RAISE EXCEPTION 'Invalid repair reward parameters';
  END IF;
  reward_xp := GREATEST(CEIL(base_xp * 0.4)::INTEGER, base_xp - (p_hints_used * 10));
  RETURN public._record_verified_xp(
    p_user_id, 'repair_circuit', 'repair:' || p_challenge_id,
    reward_xp, FALSE, p_hints_used
  );
END;
$$;
REVOKE ALL ON FUNCTION public.award_repair_circuit_reward(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_repair_circuit_reward(UUID, TEXT, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.learning_weekly_leaderboard(p_viewer_id UUID)
RETURNS TABLE(rank BIGINT, user_id UUID, display_name TEXT, weekly_xp BIGINT, is_viewer BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH weekly AS (
    SELECT user_id, SUM(xp_awarded)::BIGINT AS weekly_xp
    FROM public.xp_events
    WHERE created_at >= date_trunc('week', timezone('UTC', now())) AT TIME ZONE 'UTC'
    GROUP BY user_id
  )
  SELECT
    rank() OVER (ORDER BY weekly.weekly_xp DESC, weekly.user_id),
    weekly.user_id,
    COALESCE(NULLIF(trim(profiles.full_name), ''), 'Quantum learner') AS display_name,
    weekly.weekly_xp,
    weekly.user_id = p_viewer_id
  FROM weekly
  JOIN public.profiles ON profiles.id = weekly.user_id
  ORDER BY weekly.weekly_xp DESC, weekly.user_id
  LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.learning_weekly_leaderboard(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_weekly_leaderboard(UUID) TO service_role;
