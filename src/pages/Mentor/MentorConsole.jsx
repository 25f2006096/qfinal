import AITutor from '../../components/ai/AITutor.jsx';

export default function MentorConsole() {
  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">🧠 Mentor Console</h1>
        <p className="page-subtitle">Get explanations and progressive hints while you study. The tutor cannot validate missions or award XP.</p>
      </div>
      <section className="card" aria-labelledby="mentor-guidance-heading">
        <h2 id="mentor-guidance-heading" style={{ fontSize: '1rem' }}>Use the tutor to understand, not to submit</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
          Ask a concept question, request a hint, or discuss a circuit. Only the learning app’s trusted validators can confirm a mission, repair, or reward.
        </p>
      </section>
      <AITutor />
    </div>
  );
}
