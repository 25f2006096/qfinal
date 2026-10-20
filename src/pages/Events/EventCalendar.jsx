import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AITutor from '../../components/ai/AITutor.jsx';
import { storage } from '../../utils/storage.js';

const SCHEDULED_EVENTS = [
  {
    id: 'weekly-sprint-superposition',
    title: 'Weekly Quantum Sprint: Superposition & Interference',
    category: 'Weekly Sprint',
    description: 'Construct minimum-depth single-qubit rotation circuits achieving target quantum state fidelity within 10 operations.',
    startTime: new Date(Date.now() - 3600000 * 5).toISOString(), // Started 5 hrs ago
    endTime: new Date(Date.now() + 3600000 * 48).toISOString(), // Ends in 2 days
    route: '/circuit?mission=build-superposition',
    xpReward: 80,
    badgeReward: 'Sprint Runner',
    difficulty: 'Beginner',
    eligibility: 'All Explorers',
    status: 'live',
  },
  {
    id: 'entanglement-cup-2026',
    title: 'The Grand Entanglement Tournament',
    category: 'Championship',
    description: 'Solve multi-qubit Bell pair generation and GHZ state entanglement problems under noise constraints on Qiskit Aer.',
    startTime: new Date(Date.now() + 3600000 * 24).toISOString(), // Starts tomorrow
    endTime: new Date(Date.now() + 3600000 * 96).toISOString(),
    route: '/contests',
    xpReward: 250,
    badgeReward: 'Entanglement Champion',
    difficulty: 'Intermediate',
    eligibility: 'Level 2+ Explorers',
    status: 'upcoming',
  },
  {
    id: 'grover-speedrun-hackathon',
    title: 'Grover Algorithm Speedrun Hackathon',
    category: 'Hackathon',
    description: 'Implement an optimal quantum diffuser and phase oracle finding a target marked item in O(√N) oracle queries.',
    startTime: new Date(Date.now() + 3600000 * 120).toISOString(),
    endTime: new Date(Date.now() + 3600000 * 240).toISOString(),
    route: '/contests',
    xpReward: 500,
    badgeReward: 'Algorithm Architect',
    difficulty: 'Advanced',
    eligibility: 'Level 3+ Explorers',
    status: 'upcoming',
  },
  {
    id: 'nisq-error-mitigation-sprint',
    title: 'NISQ Noise Mitigation Challenge',
    category: 'Community Challenge',
    description: 'Analyze depolarizing and amplitude damping noise channels in the Quantum Lab and test Richardson zero-noise extrapolation.',
    startTime: new Date(Date.now() - 3600000 * 72).toISOString(),
    endTime: new Date(Date.now() - 3600000 * 12).toISOString(),
    route: '/lab',
    xpReward: 150,
    badgeReward: 'Noise Resilience Pioneer',
    difficulty: 'Expert',
    eligibility: 'Level 4+ Explorers',
    status: 'ended',
  },
];

export default function EventCalendar() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(Date.now());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    storage.getLearningEvents()
      .then(data => {
        if (!mounted) return;
        setEvents(data || []);
        if (data === null) setLoadError('Events are unavailable until Supabase is configured.');
      })
      .catch(error => { if (mounted) setLoadError(error.message || 'Unable to load scheduled events.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const formatCountdown = (targetDate) => {
    const diff = new Date(targetDate).getTime() - now;
    if (diff <= 0) return 'Concluded';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const getEventStatus = (event) => {
    const start = new Date(event.startTime).getTime();
    const end = new Date(event.endTime).getTime();
    if (now >= start && now <= end) return 'live';
    if (now < start) return 'upcoming';
    return 'ended';
  };

  const eventsWithStatus = events.map(e => ({
    ...e,
    currentStatus: getEventStatus(e),
  }));

  const filtered = eventsWithStatus.filter(e => {
    if (filter === 'all') return true;
    return e.currentStatus === filter;
  });

  return (
    <div className="page fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">📅 Quantum Event & Contest Calendar</h1>
          <p className="page-subtitle">
            Compete in weekly circuit sprints, timed algorithmic championships, and community quantum hackathons.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'live', 'upcoming', 'ended'].map(f => (
            <button
              key={f}
              className={`tag ${filter === f ? 'tag-accent' : 'tag-info'}`}
              style={{ cursor: 'pointer', border: 'none', padding: '6px 12px', fontSize: '0.78rem', textTransform: 'capitalize' }}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All Events' : f === 'live' ? '🔴 Live Now' : f}
            </button>
          ))}
        </div>
      </div>

      {loadError && <div className="tag tag-warning" style={{ marginBottom: 16, padding: '8px 14px' }}>{loadError}</div>}
      {loading && <div style={{ padding: 28, color: 'var(--text-muted)' }}>Loading scheduled events…</div>}
      {!loading && !loadError && filtered.length === 0 && <div className="card" style={{ padding: 28, color: 'var(--text-secondary)' }}>No events match this filter yet. Check back when an instructor publishes the next learning event.</div>}
      <div className="grid grid-2" style={{ gap: 20 }}>
        {filtered.map(event => {
          const isLive = event.currentStatus === 'live';
          const isUpcoming = event.currentStatus === 'upcoming';
          return (
            <div
              key={event.id}
              className={`event-card ${isLive ? 'live-event' : isUpcoming ? 'upcoming-event' : ''}`}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="tag tag-info" style={{ fontSize: '0.72rem' }}>
                    {event.category}
                  </span>
                  {isLive ? (
                    <span className="tag tag-success" style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
                      Live Now
                    </span>
                  ) : isUpcoming ? (
                    <span className="tag tag-accent" style={{ fontSize: '0.72rem' }}>
                      Upcoming
                    </span>
                  ) : (
                    <span className="tag" style={{ fontSize: '0.72rem', background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>
                      Concluded
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: '1.1rem', marginBottom: 6 }}>{event.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 12 }}>
                  {event.description}
                </p>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                  <span>🎯 {event.difficulty}</span>
                  <span>👥 {event.eligibility}</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>⚡ +{event.xpReward} XP</span>
                  <span>🏆 {event.badgeReward}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {isLive ? 'Ends in:' : isUpcoming ? 'Starts in:' : 'Concluded:'}
                  </div>
                  <div className="event-countdown-pill" style={{ color: isLive ? 'var(--success)' : 'var(--text-primary)' }}>
                    ⏱ {isLive ? formatCountdown(event.endTime) : isUpcoming ? formatCountdown(event.startTime) : 'Ended'}
                  </div>
                </div>

                <button
                  className={`btn ${isLive ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => event.route && navigate(event.route)}
                  disabled={!event.route}
                >
                  {isLive ? 'Enter Event →' : isUpcoming ? 'View Requirements' : 'View Results'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AITutor />
    </div>
  );
}
