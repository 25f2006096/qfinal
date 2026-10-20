// =============================================================================
// QUANTUM EXPLORER ACADEMY — COSMETICS & INVENTORY CATALOG
// =============================================================================

export const COSMETIC_FRAMES = [
  {
    id: 'frame-default',
    name: 'Initiate Core',
    description: 'Standard quantum explorer containment frame.',
    className: 'avatar-frame-default',
    color: '#2563eb',
    req: 'Unlocked by default',
    isUnlocked: () => true,
  },
  {
    id: 'frame-cyan',
    name: 'Neon Quantum Cyan',
    description: 'Resonates with cryogenic qubit state coherence.',
    className: 'avatar-frame-cyan',
    color: '#06b6d4',
    req: 'Reach Level 2 or 100 XP',
    isUnlocked: (xp = 0, lvl = 1) => lvl >= 2 || xp >= 100,
  },
  {
    id: 'frame-violet',
    name: 'Plasma Entanglement',
    description: 'Woven from Bell-state non-local quantum correlations.',
    className: 'avatar-frame-violet',
    color: '#8b5cf6',
    req: 'Reach Level 3 or complete a verified circuit mission',
    isUnlocked: (xp = 0, lvl = 1, missions = []) => lvl >= 3 || (missions || []).some(m => m.status === 'completed'),
  },
  {
    id: 'frame-gold',
    name: 'Solar Corona Gold',
    description: 'Awarded to quantum masters achieving high harmonic resonance.',
    className: 'avatar-frame-gold',
    color: '#f59e0b',
    req: 'Reach Level 4 or 300 XP',
    isUnlocked: (xp = 0, lvl = 1) => lvl >= 4 || xp >= 300,
  },
  {
    id: 'frame-void',
    name: 'Cosmic Singularity',
    description: 'Transcendent multiversal particle stream for top pioneers.',
    className: 'avatar-frame-void',
    color: '#ec4899',
    req: 'Reach Level 5 or earn a Boss Battle victory',
    isUnlocked: (xp = 0, lvl = 1) => lvl >= 5 || xp >= 500,
  },
];

export const COSMETIC_TITLES = [
  { id: 'title-initiate', title: 'Quantum Initiate', req: 'Default rank', isUnlocked: () => true },
  { id: 'title-explorer', title: 'Qubit Explorer', req: 'Reach Level 2', isUnlocked: (xp, lvl) => lvl >= 2 || xp >= 100 },
  { id: 'title-superposition', title: 'Superposition Specialist', req: 'Complete Mission 1', isUnlocked: (xp, lvl, missions = []) => (missions || []).some(m => m.id === 'build-superposition' && m.status === 'completed') || xp >= 150 },
  { id: 'title-entanglement', title: 'Entanglement Pioneer', req: 'Complete Bell State Mission', isUnlocked: (xp, lvl, missions = []) => (missions || []).some(m => m.id === 'build-bell-state' && m.status === 'completed') || xp >= 250 },
  { id: 'title-architect', title: 'Circuit Architect', req: 'Reach Level 4', isUnlocked: (xp, lvl) => lvl >= 4 || xp >= 300 },
  { id: 'title-overlord', title: 'Quantum Master', req: 'Reach 500 XP or Level 5', isUnlocked: (xp, lvl) => lvl >= 5 || xp >= 500 },
];

const COSMETICS_STORAGE_KEY = 'quantumlearn_equipped_cosmetics';

export function getEquippedCosmetics(userId = 'default') {
  try {
    const raw = localStorage.getItem(`${COSMETICS_STORAGE_KEY}_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    frameId: 'frame-default',
    titleId: 'title-initiate',
  };
}

export function saveEquippedCosmetics(userId = 'default', cosmetics) {
  try {
    localStorage.setItem(`${COSMETICS_STORAGE_KEY}_${userId}`, JSON.stringify(cosmetics));
  } catch {}
}
