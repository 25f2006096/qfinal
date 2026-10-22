import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProgress } from '../../context/ProgressContext.jsx';
import { getWorldMap } from '../../utils/worldMap.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getAvailableCommandZones } from '../../utils/commandZones.js';
import { getCampaignMissions } from '../../services/quantumApi.js';

export default function WorldMap() {
  const navigate = useNavigate();
  const { progress } = useProgress();
  const { user } = useAuth();
  const regions = getWorldMap(progress);
  const zones = getAvailableCommandZones(user?.isAdmin);
  const available = regions.find(region => region.state === 'available');
  const [sectors, setSectors] = useState([]);
  const [missionError, setMissionError] = useState('');

  useEffect(() => {
    let active = true;
    getCampaignMissions()
      .then(response => {
        if (active) setSectors(response.sectors || []);
      })
      .catch(error => {
        if (active) setMissionError(error.message || 'Campaign missions could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">🗺️ Quantum Command Hub</h1>
        <p className="page-subtitle">Choose a learning zone, then continue through curriculum chapters unlocked by demonstrated progress.</p>
      </div>

      <section aria-labelledby="command-zones-heading" style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 12 }}>
          <h2 id="command-zones-heading" style={{ fontSize: '1.1rem', margin: 0 }}>Eight learning zones</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.84rem', marginTop: 5 }}>Study mode keeps every existing learning surface reachable.</p>
        </div>
        <div className="command-zone-grid">
          {zones.map(zone => (
            <button
              key={zone.id}
              className="card command-zone-card"
              type="button"
              onClick={() => navigate(zone.route)}
              aria-label={`Open ${zone.name}`}
            >
              <span aria-hidden="true" style={{ fontSize: '1.6rem' }}>{zone.icon}</span>
              <span style={{ fontWeight: 750 }}>{zone.name}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '.8rem', lineHeight: 1.4 }}>{zone.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="campaign-missions-heading" style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 12 }}>
          <h2 id="campaign-missions-heading" style={{ fontSize: '1.1rem', margin: 0 }}>📜 Campaign missions</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.84rem', marginTop: 5 }}>Ordered missions and completion state come from the server-backed catalog.</p>
        </div>
        {missionError && <p role="alert" style={{ color: 'var(--danger)' }}>{missionError}</p>}
        {sectors.map(sector => (
          <div className="card" key={sector.id} style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 4 }}>{sector.title}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.84rem', marginBottom: 12 }}>{sector.description}</p>
            <ol style={{ paddingLeft: 22, margin: 0 }}>
              {sector.missions.map(mission => (
                <li key={mission.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{mission.status === 'completed' ? '✓ ' : ''}{mission.title}</strong>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '.82rem', margin: '3px 0 0' }}>{mission.description}</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => navigate(mission.route)}>
                      {mission.status === 'completed' ? 'Review' : 'Start mission'}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      {available && (
        <section className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--accent)' }} aria-labelledby="next-region-heading">
          <div style={{ fontSize: '.72rem', color: 'var(--accent)', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>Next learning region</div>
          <h2 id="next-region-heading" style={{ margin: '5px 0 8px' }}>{available.icon} {available.name}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 14 }}>{available.description}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '.82rem', marginBottom: 14 }}><strong>Learning objective:</strong> {available.objective}</p>
          {available.nextModule && <button className="btn btn-primary" onClick={() => navigate(`/modules/${available.nextModule.id}`)}>Start Module {available.nextModule.id} →</button>}
        </section>
      )}

      <section className="world-map-grid" aria-label="Quantum learning regions">
        {regions.map((region, index) => {
          const locked = region.state === 'locked';
          return (
            <article key={region.id} className={`world-region ${region.state}`}>
              <div className="world-region-index">Region {index + 1}</div>
              <div className="world-region-icon" aria-hidden="true">{locked ? '🔒' : region.icon}</div>
              <div>
                <div style={{ color: 'var(--accent)', fontSize: '.73rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 5 }}>{region.chapter}</div>
                <h2>{region.name}</h2>
                <p>{region.description}</p>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '.8rem', margin: 0 }}><strong>Objective:</strong> {region.objective}</p>
              <div className="world-region-progress">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginBottom: 6 }}>
                  <span>{locked ? 'Complete earlier regions to unlock' : `${region.completedCount} of ${region.totalCount} modules`}</span>
                  <strong>{locked ? 'Locked' : `${region.progress}%`}</strong>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${locked ? 0 : region.progress}%` }} /></div>
              </div>
              {!locked && region.nextModule && <button className="text-action" onClick={() => navigate(`/modules/${region.nextModule.id}`)}>Continue {region.nextModule.title} →</button>}
              {region.state === 'complete' && <span className="tag tag-success">✓ Region complete</span>}
            </article>
          );
        })}
      </section>
    </div>
  );
}
