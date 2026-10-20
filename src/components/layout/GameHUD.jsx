import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useProgress } from '../../context/ProgressContext.jsx';
import { getProgressToNextLevel } from '../../utils/gamification.js';
import { getNotifications } from '../../services/quantumApi.js';
import { COSMETIC_FRAMES, getEquippedCosmetics } from '../../utils/cosmetics.js';

export default function GameHUD() {
  const { user } = useAuth();
  const { gamification, progress } = useProgress();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  const totalXP = gamification?.total_xp ?? user?.total_xp ?? 0;
  const level = gamification?.level?.number ?? user?.level ?? 1;
  const rank = gamification?.level?.name || 'Quantum Initiate';
  const levelProgress = getProgressToNextLevel(totalXP);

  const activeMission = gamification?.next_mission || (gamification?.missions || [])[0] || null;
  const dailyQuests = gamification?.daily_quests || [];
  const completedDailyCount = dailyQuests.filter(q => q.completed).length;
  const totalDailyCount = dailyQuests.length || 1;
  const streak = user?.current_streak ?? progress?.streak ?? 0;

  const equipped = getEquippedCosmetics(user?.id);
  const activeFrame = COSMETIC_FRAMES.find(f => f.id === equipped.frameId) || COSMETIC_FRAMES[0];

  useEffect(() => {
    let mounted = true;
    if (user) {
      getNotifications().then(res => {
        if (mounted && res?.unread_count !== undefined) {
          setUnreadCount(res.unread_count);
        }
      }).catch(() => {});
    }
    return () => { mounted = false; };
  }, [user]);

  const getInitials = (n) => {
    if (!n) return 'Q';
    return n.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header className="game-hud" aria-label="Quantum Explorer Academy HUD">
      {/* Left Section: Level, Rank & XP */}
      <div className="game-hud-left">
        <div className="game-hud-rank-pill" title={`Level ${level} · ${rank}`}>
          <span className="game-hud-level-badge">LVL {level}</span>
          <span className="game-hud-rank-name">{rank}</span>
        </div>

        <div className="game-hud-xp-bar" title={`${levelProgress.current} / ${levelProgress.total} XP to Level ${level + 1}`}>
          <div className="game-hud-xp-label">
            <span>XP</span>
            <span>{totalXP}</span>
          </div>
          <div className="progress-bar" style={{ height: 6, margin: 0 }}>
            <div
              className="progress-fill success"
              style={{ width: `${levelProgress.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Center Section: Active Mission, Daily Quests & Streak */}
      <div className="game-hud-center">
        {activeMission && (
          <Link
            to={activeMission.route || '/circuit'}
            className="game-hud-mission-chip"
            title={`Active Mission: ${activeMission.title}`}
          >
            <span>🎯</span>
            <span style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeMission.title}
            </span>
          </Link>
        )}

        <Link
          to="/dashboard"
          className="game-hud-quest-chip"
          title={`Daily Quests: ${completedDailyCount} of ${totalDailyCount} Completed`}
        >
          <span>📋</span>
          <span>{completedDailyCount}/{totalDailyCount} Quests</span>
        </Link>

        <div className="game-hud-streak-chip" title={`${streak} consecutive days of quantum learning`}>
          <span>🔥</span>
          <span>{streak} Days</span>
        </div>
      </div>

      {/* Right Section: Quick Launchers, Notifications & Profile Avatar */}
      <div className="game-hud-right">
        <Link to="/circuit" className="game-hud-btn" title="Circuit Forge (Builder)">
          <span>⚡</span>
          <span>Forge</span>
        </Link>

        <Link to="/lab" className="game-hud-btn" title="Quantum Laboratory">
          <span>🔬</span>
          <span>Lab</span>
        </Link>

        <Link to="/notebook" className="game-hud-btn" title="Research Notebook & Artifacts">
          <span>📓</span>
          <span>Notes</span>
        </Link>

        <Link to="/world-map" className="game-hud-btn" title="Quantum World Map">
          <span>🧭</span>
          <span>Map</span>
        </Link>

        {/* Notifications */}
        <button
          className="game-hud-notif-btn"
          onClick={() => navigate('/notifications')}
          title="Notifications"
          aria-label={`Notifications, ${unreadCount} unread`}
        >
          <span>🔔</span>
          {unreadCount > 0 && <span className="game-hud-notif-badge">{unreadCount}</span>}
        </button>

        {/* Avatar with Equipped Cosmetic Frame */}
        <div
          className={`avatar-frame ${activeFrame.className}`}
          onClick={() => navigate('/profile')}
          style={{ cursor: 'pointer', width: 38, height: 38 }}
          title={`Explorer Profile: ${user?.name}`}
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: 'var(--gradient-1)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', fontWeight: 800,
            }}>
              {getInitials(user?.name)}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
