import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProgress } from '../../context/ProgressContext.jsx';
import { MODULES } from '../../data/modules.js';
import { ALL_TOPICS } from '../../data/allTopics.js';
import { MODULE_QUESTIONS, getModuleAssessmentQuestions } from '../../data/questions.js';
import { getTopicQuestions } from '../../data/topicQuestions.js';
import { getTopicCircuit } from '../../data/topicCircuits.js';
import { getTopicFormula } from '../../data/topicFormulas.js';
import { checkPrerequisites, updateSkillsFromScore } from '../../utils/adaptive.js';
import { simulateCircuit } from '../../utils/quantum.js';
import { storage } from '../../utils/storage.js';
import AITutor from '../../components/ai/AITutor.jsx';

const MODULE_NOTES = {
  default: (mod) => `## ${mod.title}\n\n**Overview**\n${mod.desc}`,
};

/* ── Mini Circuit Builder for topic challenges ── */
function TopicCircuitChallenge({ challenge, topicId }) {
  const [gates, setGates] = useState([]);
  const [result, setResult] = useState(null);
  const [passed, setPassed] = useState(false);
  const nQ = challenge.qubits || 2;
  const steps = 5;
  const palette = ['H','X','Y','Z','S','T','CNOT'];

  const placeGate = (gName, q, s) => {
    setGates(prev => [...prev.filter(g => !(g.qubit === q && g.step === s)), { gate: gName, qubit: q, step: s }]);
    setResult(null); setPassed(false);
  };
  const clearCell = (q, s) => {
    setGates(prev => prev.filter(g => !(g.qubit === q && g.step === s)));
    setResult(null); setPassed(false);
  };
  const clearAll = () => { setGates([]); setResult(null); setPassed(false); };

  const runSim = () => {
    try {
      const grid = Array.from({ length: nQ }, () => Array(steps).fill(null));
      gates.forEach(g => { if (g.qubit < nQ && g.step < steps) grid[g.qubit][g.step] = g.gate === 'CNOT' ? { gate: 'CNOT', target: (g.qubit + 1) % nQ } : g.gate; });
      const sv = simulateCircuit(grid, nQ);
      const probs = {};
      sv.forEach((amp, i) => {
        const p = amp[0] * amp[0] + amp[1] * amp[1];
        if (p > 0.001) probs[i.toString(2).padStart(nQ, '0')] = Math.round(p * 1000) / 10;
      });
      setResult(probs);
      const ok = challenge.verify(gates);
      setPassed(ok);
    } catch { setResult({ error: 'Simulation error' }); }
  };

  const gateAt = (q, s) => gates.find(g => g.qubit === q && g.step === s);
  const [dragGate, setDragGate] = useState(null);

  return (
    <div className="card" style={{ border: passed ? '2px solid var(--success)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3>⚡ {challenge.title}</h3>
        {passed && <span className="tag tag-success">✅ Passed!</span>}
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: '0.9rem' }}>{challenge.desc}</p>
      
      {/* Input and Output State Specifications */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {challenge.inputState && (
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-glass)', padding: '6px 10px', borderRadius: 6, fontSize: '0.8rem' }}>
            <strong>Input state:</strong> <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{challenge.inputState}</code>
          </div>
        )}
        {challenge.outputState && (
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-glass)', padding: '6px 10px', borderRadius: 6, fontSize: '0.8rem' }}>
            <strong>Target output state:</strong> <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{challenge.outputState}</code>
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-glass)', padding: 8, borderRadius: 6, marginBottom: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>💡 Hint: {challenge.hint}</div>

      {/* Gate palette */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {palette.map(g => (
          <div key={g} draggable onDragStart={() => setDragGate(g)}
            style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 6, cursor: 'grab', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
            {g}
          </div>
        ))}
      </div>

      {/* Circuit grid */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        {Array.from({ length: nQ }, (_, q) => (
          <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', width: 30, color: 'var(--text-muted)' }}>q[{q}]</span>
            {Array.from({ length: steps }, (_, s) => {
              const g = gateAt(q, s);
              return (
                <div key={s}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { if (dragGate) { placeGate(dragGate, q, s); setDragGate(null); } }}
                  onClick={() => g ? clearCell(q, s) : null}
                  style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px ${g ? 'solid var(--accent)' : 'dashed var(--border-glass)'}`, borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 600, background: g ? 'rgba(37,99,235,0.06)' : 'transparent', color: g ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {g ? g.gate : '·'}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={runSim}>▶ Simulate & Check</button>
        <button className="btn btn-secondary btn-sm" onClick={clearAll}>🗑 Clear</button>
      </div>

      {/* Results */}
      {result && !result.error && (
        <div style={{ background: 'var(--bg-glass)', borderRadius: 6, padding: 12 }}>
          <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 8 }}>Measurement Probabilities:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(result).map(([state, prob]) => (
              <div key={state} style={{ textAlign: 'center' }}>
                <div style={{ background: 'var(--accent)', borderRadius: 4, width: 40, height: Math.max(8, prob * 0.8), marginBottom: 4 }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>|{state}⟩</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{prob}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Topic Quiz (after-topic assessment) ── */
function TopicQuiz({ topicId, topicName, customQuestions }) {
  const questions = (Array.isArray(customQuestions) && customQuestions.length)
    ? customQuestions
    : getTopicQuestions(topicId, topicName);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (!questions.length) return null;
  const q = questions[current];

  const checkAnswer = () => {
    if (selected === q.answer) setScore(s => s + 1);
    setAnswered(true);
  };

  const next = () => {
    setSelected(null); setAnswered(false);
    if (current + 1 >= questions.length) setDone(true);
    else setCurrent(c => c + 1);
  };

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>{pct >= 70 ? '🎉' : '📈'}</div>
        <h3 style={{ marginBottom: 8 }}>Topic Quiz Complete!</h3>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>{pct}%</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 12 }}>
          {score}/{questions.length} correct — {pct >= 70 ? 'Great understanding!' : 'Review and try again.'}
        </p>
        <button className="btn btn-secondary btn-sm" onClick={() => { setCurrent(0); setScore(0); setDone(false); setSelected(null); setAnswered(false); }}>🔄 Retry Quiz</button>
      </div>
    );
  }

  return (
    <div className="card fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <span>Question {current + 1} of {questions.length}</span>
        <span>Topic: {topicName}</span>
      </div>
      <div className="progress-bar" style={{ marginBottom: 16 }}>
        <div className="progress-fill" style={{ width: `${((current + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>
      <h3 style={{ marginBottom: 16, lineHeight: 1.5, fontSize: '1rem' }}>{q.q}</h3>
      {q.options.map((opt, i) => {
        let cls = 'quiz-option';
        if (answered && i === q.answer) cls += ' correct';
        else if (answered && i === selected && i !== q.answer) cls += ' wrong';
        else if (!answered && i === selected) cls += ' selected';
        return (
          <div key={i} className={cls} onClick={() => { if (!answered) setSelected(i); }}>
            <div className="option-marker" style={{ background: (!answered && i === selected) ? 'var(--accent)' : answered && i === q.answer ? 'var(--success)' : answered && i === selected ? 'var(--danger)' : 'transparent', color: (i === selected || (answered && i === q.answer)) ? 'white' : undefined }}>
              {String.fromCharCode(65 + i)}
            </div>
            <span style={{ fontSize: '0.85rem' }}>{opt}</span>
          </div>
        );
      })}
      {!answered ? (
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} disabled={selected === null} onClick={checkAnswer}>Check Answer</button>
      ) : (
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={next}>
          {current + 1 === questions.length ? 'See Results' : 'Next →'}
        </button>
      )}
    </div>
  );
}

/* ── Main Topic View with 6 tabs ── */
function TopicView({ topic, modId }) {
  const [tab, setTab] = useState('learn');
  const { completeTopic } = useProgress();
  const circuit = getTopicCircuit(topic.id);

  const handleComplete = () => { completeTopic(modId, topic.id); };

  const tabs = [
    { key: 'learn', label: '📖 Learn' },
    { key: 'watch', label: '🎬 Watch' },
    { key: 'docs', label: '📄 Docs' },
    { key: 'practice', label: '✏️ Practice' },
    { key: 'quiz', label: '📝 Quiz' },
  ];
  if (circuit) tabs.push({ key: 'circuit', label: '⚡ Circuit' });

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.3rem' }}>{topic.t}</h2>
        <button className="btn btn-success btn-sm" onClick={handleComplete}>✓ Mark Complete</button>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <div key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>
        ))}
      </div>

      {tab === 'learn' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>About: {topic.t}</h3>
          <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 16 }}>
            This topic covers the key concepts of <strong>{topic.t}</strong> in quantum computing. Understanding this topic is essential for building a solid foundation.
          </p>
          <div style={{ background: 'var(--bg-glass)', borderRadius: 8, padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', lineHeight: 1.8, marginBottom: 16, border: '1px solid var(--border-glass)' }}>
            <div style={{ color: 'var(--accent-light)', fontWeight: 600, marginBottom: 4 }}>// Key Formula — {topic.t}</div>
            {getTopicFormula(topic, modId).map((line, idx) => (
              <div key={idx} style={{ color: 'var(--text-primary)' }}>{line}</div>
            ))}
          </div>
          <div className="tag tag-info">💡 Tip: Complete the Quiz and Circuit tabs after learning</div>
        </div>
      )}

      {tab === 'watch' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>🎬 Video: {topic.t}</h3>
          {topic.v ? (
            <div style={{ background: 'var(--bg-glass)', borderRadius: 8, padding: 24, textAlign: 'center', marginBottom: 16, border: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>▶️</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Watch the verified video lecture for this topic</p>
              <a href={topic.v} target="_blank" rel="noopener noreferrer" className="btn btn-primary">🎬 Watch Video Lecture</a>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-glass)', borderRadius: 8, padding: 24, textAlign: 'center', marginBottom: 16, border: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📄</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>No direct video lecture available for this topic. Please refer to the official documentation course link.</p>
              {topic.d && <a href={topic.d} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">📄 Open Official Course Docs →</a>}
            </div>
          )}
        </div>
      )}

      {tab === 'docs' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>📄 Official Documentation</h3>
          <div style={{ background: 'var(--bg-glass)', borderRadius: 8, padding: 24, marginBottom: 16, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>Refer to the official documentation for detailed technical information about this topic.</div>
            <a href={topic.d} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">📄 Open Official Docs →</a>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Source: {topic.d?.includes('microsoft') ? 'Microsoft Azure Quantum' : topic.d?.includes('pennylane') ? 'PennyLane' : topic.d?.includes('cirq') ? 'Google Cirq' : 'IBM Quantum'}
          </div>
        </div>
      )}

      {tab === 'practice' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>✏️ Practice</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Test your understanding with practice exercises for <strong>{topic.t}</strong>.</p>
          <div style={{ background: 'var(--bg-glass)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Quick Check:</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Can you explain the key concept of {topic.t} in your own words? Try the Quiz tab and Circuit tab next.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setTab('quiz')}>📝 Take Topic Quiz</button>
            {circuit && <button className="btn btn-secondary btn-sm" onClick={() => setTab('circuit')}>⚡ Circuit Challenge</button>}
          </div>
        </div>
      )}

      {tab === 'quiz' && <TopicQuiz topicId={topic.id} topicName={topic.t} customQuestions={topic.questions} />}

      {tab === 'circuit' && circuit && <TopicCircuitChallenge challenge={circuit} topicId={topic.id} />}
    </div>
  );
}

function ModuleAssessment({ mod, onComplete }) {
  const questions = getModuleAssessmentQuestions(mod.id);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const { updateSkills, skills, completeModule, recordTestScore } = useProgress();

  if (questions.length === 0) return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>📝</div>
      <h3 style={{ marginBottom: 8 }}>Assessment</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Practice the topics in this module then complete the module.</p>
      <button className="btn btn-primary" onClick={() => onComplete(85)}>Complete Module ✓</button>
    </div>
  );

  const q = questions[current];

  const next = () => {
    const upd = { ...answers, [q.id]: selected };
    setAnswers(upd);
    setSelected(null);
    if (current + 1 >= questions.length) {
      const correct = questions.filter(q => upd[q.id] === q.answer).length;
      const sc = Math.round((correct / questions.length) * 100);
      setScore(sc);
      const updSkills = updateSkillsFromScore(skills || {}, mod.skills, sc);
      updateSkills(updSkills);
      recordTestScore(mod.id, sc, { answers: upd });
      completeModule(mod.id, sc);
      setDone(true);
    } else setCurrent(c => c + 1);
  };

  if (done) return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: 12 }}>{score >= 70 ? '🎉' : '📈'}</div>
      <h2 style={{ marginBottom: 8 }}>Module {mod.id} Complete!</h2>
      <div style={{ fontSize: '3rem', fontWeight: 900, background: 'var(--gradient-1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>{score}%</div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
        {score >= 70 ? 'Excellent work! Skills updated.' : 'Good effort! Review weak areas and try again.'}
      </p>
      <button className="btn btn-primary" onClick={() => onComplete(score)}>Continue →</button>
    </div>
  );

  return (
    <div className="card fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <span>Question {current + 1} of {questions.length}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {q.isCircuit ? (
            <span className="tag tag-accent" style={{ background: 'rgba(124, 77, 255, 0.15)', color: '#7c4dff' }}>⚡ Circuit Question</span>
          ) : (
            <span className="tag tag-info">📖 Conceptual Question</span>
          )}
          <span>Module Assessment</span>
        </div>
      </div>
      <div className="progress-bar" style={{ marginBottom: 20 }}>
        <div className="progress-fill" style={{ width: `${(current / questions.length) * 100}%` }} />
      </div>

      {q.isCircuit && q.circuitDiagram && (
        <div style={{ background: '#0f172a', color: '#38bdf8', borderRadius: 8, padding: '14px 18px', fontFamily: 'var(--font-mono)', fontSize: '0.88rem', whiteSpace: 'pre-wrap', marginBottom: 16, border: '1px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>⚡ Quantum Circuit Setup:</div>
          {q.circuitDiagram}
        </div>
      )}

      <h3 style={{ marginBottom: 20, lineHeight: 1.5 }}>{q.q}</h3>
      {q.options.map((opt, i) => (
        <div key={i} className={`quiz-option ${selected === i ? 'selected' : ''}`} onClick={() => setSelected(i)}>
          <div className="option-marker" style={{ background: selected === i ? 'var(--accent)' : 'transparent' }}>{String.fromCharCode(65 + i)}</div>
          <span style={{ fontSize: '0.9rem' }}>{opt}</span>
        </div>
      ))}
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={selected === null} onClick={next}>
        {current + 1 === questions.length ? 'Submit Assessment' : 'Next Question →'}
      </button>
    </div>
  );
}

export default function ModuleDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const modId = parseInt(id);
  const mod = MODULES.find(m => m.id === modId);
  const [topics, setTopics] = useState(() => ALL_TOPICS[modId] || []);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const { progress, skills } = useProgress();

  useEffect(() => {
    let isMounted = true;
    const baseTopics = ALL_TOPICS[modId] || [];

    const applyOverrides = (overrides) => {
      if (!overrides || !overrides.length) return baseTopics;
      const overrideMap = new Map();
      overrides.forEach(row => {
        const tid = row.metadata?.topic_id;
        if (tid) overrideMap.set(String(tid), row);
        if (row.title) overrideMap.set(row.title.toLowerCase().trim(), row);
      });

      const merged = baseTopics.map(bt => {
        const match = overrideMap.get(String(bt.id)) || overrideMap.get(bt.t?.toLowerCase().trim());
        if (!match) return bt;
        return {
          ...bt,
          t: match.title || bt.t,
          v: match.metadata?.video_url !== undefined && match.metadata?.video_url !== '' ? match.metadata.video_url : bt.v,
          d: match.metadata?.doc_url !== undefined && match.metadata?.doc_url !== '' ? match.metadata.doc_url : bt.d,
          formula: match.metadata?.formula || bt.formula,
          questions: match.metadata?.questions || bt.questions,
        };
      });

      overrides.forEach(row => {
        const modName = (row.metadata?.module_name || '').toLowerCase();
        if (modName.includes(`module ${modId}`) || modName.includes(`m${modId}`)) {
          const tid = row.metadata?.topic_id;
          const alreadyExists = merged.some(m => (tid && m.id === tid) || m.t.toLowerCase().trim() === row.title.toLowerCase().trim());
          if (!alreadyExists) {
            merged.push({
              id: tid || `admin-${row.id}`,
              t: row.title,
              v: row.metadata?.video_url || '',
              d: row.metadata?.doc_url || '',
              formula: row.metadata?.formula || '',
              questions: row.metadata?.questions || [],
            });
          }
        }
      });

      return merged;
    };

    try {
      const cached = localStorage.getItem('ql_topic_overrides');
      if (cached) {
        setTopics(applyOverrides(JSON.parse(cached)));
      }
    } catch {}

    storage.getTopicOverrides().then(overrides => {
      if (isMounted && overrides) {
        setTopics(applyOverrides(overrides));
      }
    }).catch(err => {
      console.warn('Error loading topic overrides:', err);
    });

    return () => { isMounted = false; };
  }, [modId]);

  useEffect(() => {
    if (selectedTopic && topics.length) {
      const updated = topics.find(t => t.id === selectedTopic.id || t.t === selectedTopic.t);
      if (updated && (updated.v !== selectedTopic.v || updated.d !== selectedTopic.d || updated.t !== selectedTopic.t || updated.formula !== selectedTopic.formula)) {
        setSelectedTopic(updated);
      }
    }
  }, [topics]);

  useEffect(() => {
    if (!progress || !skills) return;
    const prerequisiteState = checkPrerequisites(modId, skills, progress.completedModules || []);
    if (!prerequisiteState.ok) nav('/modules', { replace: true });
  }, [modId, nav, progress, skills]);

  if (!mod) return <div className="page"><h1>Module not found</h1></div>;

  const isCompleted = progress?.completedModules?.includes(modId);

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => nav('/modules')}>← Training Chambers</button>
          <span className="tag tag-accent">{mod.category}</span>
          {isCompleted && <span className="tag tag-success">✅ Mission Mastered</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => nav('/circuit')} title="Launch Circuit Forge">
            ⚡ Circuit Forge
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => nav('/notebook')} title="Log research notes">
            📓 Notebook
          </button>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 }}>
        Explorer Training Mission {mod.id}
      </div>
      <h1 className="page-title">{mod.title}</h1>
      <p className="page-subtitle">{mod.desc}</p>

      <div className="tabs" style={{ marginTop: 24 }}>
        {['overview', 'topics', 'test'].map(t => (
          <div key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => { setActiveTab(t); setSelectedTopic(null); }}>
            {t === 'overview' ? '📋 Overview' : t === 'topics' ? `📚 Topics (${topics.length})` : '📝 Assessment'}
          </div>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-2">
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>About This Module</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>{mod.desc}</p>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.85rem' }}>Skills covered:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {mod.skills.map(s => <span key={s} className="tag tag-accent">{s}</span>)}
              </div>
            </div>
            {mod.prereqs.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.85rem' }}>Prerequisites:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {mod.prereqs.map(p => {
                    const pm = MODULES.find(m => m.id === p);
                    return <span key={p} className={`tag ${progress?.completedModules?.includes(p) ? 'tag-success' : 'tag-warning'}`}>{pm ? `M${p}: ${pm.title.slice(0,20)}...` : `M${p}`}</span>;
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Learning Path</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['📖 Study notes & explanations', '🎬 Watch video resources', '📄 Read official documentation', '✏️ Practice exercises', '⚡ Build circuits', '📝 Take assessment', '🤖 Ask AI tutor'].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: 16 }}>{i + 1}</span>
                  <span style={{ fontSize: '0.85rem' }}>{step}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={() => setActiveTab('topics')}>
              Start Learning →
            </button>
          </div>
        </div>
      )}

      {activeTab === 'topics' && (
        <div className="grid grid-2">
          <div>
            <h3 style={{ marginBottom: 16 }}>Topics ({topics.length})</h3>
            {topics.map(topic => {
              const done = progress?.completedTopics?.includes(topic.id);
              return (
                <div key={topic.id} className={`topic-item ${selectedTopic?.id === topic.id ? 'active' : ''}`} onClick={() => setSelectedTopic(topic)} style={{ background: selectedTopic?.id === topic.id ? 'var(--bg-glass)' : '', borderColor: selectedTopic?.id === topic.id ? 'var(--accent)' : '' }}>
                  <div className={`topic-status ${done ? 'done' : 'locked'}`}>{done ? '✓' : '○'}</div>
                  <div className="topic-name">{topic.t}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {topic.v && <a href={topic.v} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(255,0,0,0.15)', color: '#ff4444', borderRadius: 4 }}>▶ YT</a>}
                    {topic.d && <a href={topic.d} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(64,196,255,0.15)', color: 'var(--info)', borderRadius: 4 }}>📄</a>}
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            {selectedTopic ? (
              <TopicView topic={selectedTopic} modId={modId} />
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>👈</div>
                <p style={{ color: 'var(--text-secondary)' }}>Select a topic from the list to start learning</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'test' && (
        <ModuleAssessment mod={mod} onComplete={(score) => { nav('/modules'); }} />
      )}

      <AITutor moduleId={modId} topicName={selectedTopic?.t} />
    </div>
  );
}
