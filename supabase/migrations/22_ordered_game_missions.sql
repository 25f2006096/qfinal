-- Persistent, ordered sector and mission catalog for the game-first campaign.
-- Rewards remain server-authoritative through the verified XP pipeline.

CREATE TABLE IF NOT EXISTS public.game_sectors (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) BETWEEN 1 AND 80),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL UNIQUE CHECK (order_index >= 0),
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.game_missions (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) BETWEEN 1 AND 100),
  sector_id TEXT NOT NULL REFERENCES public.game_sectors(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '',
  mission_type TEXT NOT NULL CHECK (mission_type IN ('lesson', 'quiz', 'circuit', 'repair')),
  route TEXT NOT NULL CHECK (route LIKE '/%'),
  reward_source_type TEXT,
  reward_source_id TEXT,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  progress_module_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sector_id, sequence),
  CHECK ((reward_source_type IS NULL) = (reward_source_id IS NULL)),
  CHECK (progress_module_id IS NULL OR mission_type = 'lesson')
);

CREATE TABLE IF NOT EXISTS public.game_mission_steps (
  mission_id TEXT NOT NULL REFERENCES public.game_missions(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '',
  route TEXT NOT NULL CHECK (route LIKE '/%'),
  PRIMARY KEY (mission_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_game_missions_sector_order
  ON public.game_missions (sector_id, sequence) WHERE published;

ALTER TABLE public.game_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_mission_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_sectors_published_read ON public.game_sectors;
CREATE POLICY game_sectors_published_read ON public.game_sectors
  FOR SELECT TO authenticated USING (published);

DROP POLICY IF EXISTS game_missions_published_read ON public.game_missions;
CREATE POLICY game_missions_published_read ON public.game_missions
  FOR SELECT TO authenticated USING (published);

DROP POLICY IF EXISTS game_mission_steps_published_read ON public.game_mission_steps;
CREATE POLICY game_mission_steps_published_read ON public.game_mission_steps
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.game_missions m
      WHERE m.id = game_mission_steps.mission_id AND m.published
    )
  );

REVOKE ALL ON TABLE public.game_sectors, public.game_missions, public.game_mission_steps
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_sectors, public.game_missions, public.game_mission_steps TO authenticated;
GRANT ALL ON public.game_sectors, public.game_missions, public.game_mission_steps TO service_role;

INSERT INTO public.game_sectors (id, title, description, order_index, published)
VALUES
  ('foundations', 'Quantum Foundations', 'Build intuition through verified learning actions.', 1, TRUE),
  ('entanglement', 'Entanglement Lab', 'Progress from single-qubit states to entangled systems.', 2, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.game_missions
  (id, sector_id, sequence, title, description, mission_type, route, reward_source_type, reward_source_id, published)
VALUES
  ('module-foundations', 'foundations', 1, 'Study the foundations', 'Learn the language of qubits and quantum states.', 'lesson', '/modules/1', NULL, NULL, TRUE),
  ('build-superposition', 'foundations', 2, 'Create a superposition', 'Apply a Hadamard gate to q0 and verify the result.', 'circuit', '/circuit?mission=build-superposition', 'circuit_mission', 'build-superposition', TRUE),
  ('daily-repair', 'foundations', 3, 'Repair today’s circuit', 'Restore the daily quantum system with a server-checked circuit.', 'repair', '/repair', 'repair_circuit', 'daily', TRUE),
  ('build-bell-state', 'entanglement', 1, 'Build a Bell state', 'Entangle q0 and q1 using H followed by CNOT.', 'circuit', '/circuit?mission=build-bell-state', 'circuit_mission', 'build-bell-state', TRUE),
  ('build-ghz-state', 'entanglement', 2, 'Assemble a GHZ state', 'Extend entanglement to three qubits and verify the state.', 'circuit', '/circuit?mission=build-ghz-state', 'circuit_mission', 'build-ghz-state', TRUE),
  ('module-entanglement', 'entanglement', 3, 'Study entanglement', 'Explore correlations and measurement outcomes.', 'lesson', '/modules/2', NULL, NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

UPDATE public.game_missions SET progress_module_id = 1 WHERE id = 'module-foundations';
UPDATE public.game_missions SET progress_module_id = 2 WHERE id = 'module-entanglement';

INSERT INTO public.game_mission_steps (mission_id, sequence, title, description, route)
VALUES
  ('module-foundations', 1, 'Read the lesson', 'Complete the foundational quantum concepts lesson.', '/modules/1'),
  ('build-superposition', 1, 'Open the circuit workshop', 'Build and simulate the required one-qubit circuit.', '/circuit?mission=build-superposition'),
  ('daily-repair', 1, 'Load the daily challenge', 'The challenge and its solution are served separately.', '/repair'),
  ('build-bell-state', 1, 'Prepare q0', 'Apply H to q0.', '/circuit?mission=build-bell-state'),
  ('build-bell-state', 2, 'Entangle q1', 'Apply CNOT from q0 to q1 and verify the circuit.', '/circuit?mission=build-bell-state'),
  ('build-ghz-state', 1, 'Prepare and entangle three qubits', 'Use H(q0), CNOT(q0,q1), and CNOT(q0,q2).', '/circuit?mission=build-ghz-state'),
  ('module-entanglement', 1, 'Read the entanglement lesson', 'Complete the entanglement concepts lesson.', '/modules/2')
ON CONFLICT (mission_id, sequence) DO NOTHING;
