export const COMMAND_ZONES = [
  { id: 'academy-hub', name: 'Academy Hub', icon: '🏠', description: 'Your next action, verified progress, and active quests.', route: '/dashboard' },
  { id: 'training-grounds', name: 'Training Grounds', icon: '📚', description: 'Study modules, lessons, assessments, and practice.', route: '/modules' },
  { id: 'circuit-workshop', name: 'Circuit Workshop', icon: '⚡', description: 'Build, simulate, and submit verified circuits.', route: '/circuit' },
  { id: 'simulation-lab', name: 'Simulation Lab', icon: '🔬', description: 'Explore quantum states and run supported simulators.', route: '/lab' },
  { id: 'arena', name: 'Arena', icon: '🏁', description: 'Take on active quantum coding and circuit contests.', route: '/contests' },
  { id: 'mentor-console', name: 'Mentor Console', icon: '🧠', description: 'Ask the tutor for explanations and progressive hints.', route: '/mentor' },
  { id: 'trophy-hall', name: 'Trophy Hall', icon: '🏆', description: 'Review verified badges and course milestones.', route: '/achievements' },
  { id: 'game-master', name: 'Game Master Tools', icon: '🛠️', description: 'Manage platform content and settings.', route: '/admin', adminOnly: true },
];

export function getAvailableCommandZones(isAdmin = false) {
  return COMMAND_ZONES.filter(zone => !zone.adminOnly || isAdmin);
}
