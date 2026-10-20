-- =============================================================================
-- Migration 18: Research Notes, Cosmetic Inventory & Scheduled Learning Events
-- =============================================================================
-- Supports persistent research notebooks, customizable cosmetics/frames,
-- and community event schedules.
--
-- Apply through Supabase Dashboard -> SQL Editor in an approved environment.
-- =============================================================================

-- 1. RESEARCH NOTES TABLE
CREATE TABLE IF NOT EXISTS public.research_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  hypothesis TEXT DEFAULT '',
  math_formulation TEXT DEFAULT '',
  observations TEXT DEFAULT '',
  circuit_snippet TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_notes_user ON public.research_notes (user_id, updated_at DESC);

ALTER TABLE public.research_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own research notes" ON public.research_notes;
CREATE POLICY "Users can manage own research notes"
  ON public.research_notes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON TABLE public.research_notes TO service_role, authenticated;


-- 2. USER COSMETICS & INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.user_cosmetics (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  equipped_frame TEXT NOT NULL DEFAULT 'frame-default',
  equipped_title TEXT NOT NULL DEFAULT 'title-initiate',
  unlocked_items TEXT[] NOT NULL DEFAULT ARRAY['frame-default', 'title-initiate']::text[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and update own cosmetics" ON public.user_cosmetics;
CREATE POLICY "Users can view and update own cosmetics"
  ON public.user_cosmetics FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON TABLE public.user_cosmetics TO service_role, authenticated;


-- 3. SCHEDULED LEARNING EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Weekly Sprint',
  description TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  route TEXT DEFAULT '',
  xp_reward INTEGER NOT NULL DEFAULT 50 CHECK (xp_reward > 0),
  difficulty TEXT NOT NULL DEFAULT 'Intermediate',
  eligibility TEXT NOT NULL DEFAULT 'All Explorers',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read learning events" ON public.learning_events;
CREATE POLICY "Anyone can read learning events"
  ON public.learning_events FOR SELECT
  TO authenticated
  USING (TRUE);

GRANT SELECT ON TABLE public.learning_events TO authenticated;
GRANT ALL ON TABLE public.learning_events TO service_role;
