import { useEffect, useState } from 'react';
import { getDailyRepairChallenge, getRepairChallenge, submitRepairAttempt } from '../../services/quantumApi.js';
import { useProgress } from '../../context/ProgressContext.jsx';

const CHALLENGES = [
  { id: 'repair-hadamard-phase', label: 'Restore the phase calibrator' },
  { id: 'repair-bell-link', label: 'Restore the entanglement link' },
];
const GATES = ['H', 'X', 'Y', 'Z', 'S', 'T', 'CNOT', 'CZ', 'SWAP'];
const TWO_QUBIT_GATES = new Set(['CNOT', 'CZ', 'SWAP']);
const MAX_HINTS = 4;

export default function RepairCircuit() {
  const { refreshGamification } = useProgress();
  const [challengeId, setChallengeId] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [operations, setOperations] = useState([]);
  const [gate, setGate] = useState('H');
  const [target, setTarget] = useState(0);
  const [control, setControl] = useState(1);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setChallenge(null);
    setOperations([]);
    setHintsUsed(0);
    setShowHint(false);
    setResult(null);
    const loadChallenge = challengeId
      ? getRepairChallenge(challengeId).then(response => response.challenge)
      : getDailyRepairChallenge().then(response => response.challenge);
    loadChallenge
      .then(response => {
        if (active) {
          setChallenge(response);
          if (!challengeId) setChallengeId(response.id);
        }
      })
      .catch(loadError => {
        if (active) setError(loadError.message || 'Unable to load this repair challenge.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [challengeId]);

  const addOperation = () => {
    if (TWO_QUBIT_GATES.has(gate) && control === target) {
      setError('Choose different control and target qubits for a two-qubit gate.');
      return;
    }
    const operation = { gate, target, col: operations.length };
    if (TWO_QUBIT_GATES.has(gate)) operation.control = control;
    setOperations(current => [...current, operation]);
    setResult(null);
    setError('');
  };

  const removeOperation = (index) => {
    setOperations(current => current
      .filter((_, operationIndex) => operationIndex !== index)
      .map((operation, col) => ({ ...operation, col })));
    setResult(null);
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const response = await submitRepairAttempt(challengeId, { operations, hints_used: hintsUsed });
      setResult(response);
      if (response.result?.passed && response.reward?.awarded) {
        await refreshGamification();
      }
    } catch (submitError) {
      setError(submitError.message || 'The repair attempt could not be checked.');
    } finally {
      setSubmitting(false);
    }
  };

  const revealHint = () => {
    setHintsUsed(count => Math.min(count + 1, MAX_HINTS));
    setShowHint(true);
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">🧩 Repair Circuit</h1>
        <p className="page-subtitle">Restore the quantum system. Your circuit is checked by the server; the repair solution stays private.</p>
      </div>

      <section className="card" aria-labelledby="repair-challenge-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 id="repair-challenge-heading" style={{ fontSize: '1.05rem' }}>
              {challenge?.title || 'Choose a repair challenge'}
            </h2>
            {challenge?.briefing && <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>{challenge.briefing}</p>}
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Challenge</span>
            <select className="form-input" value={challengeId} onChange={event => setChallengeId(event.target.value)}>
              {CHALLENGES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>

        {loading && <p role="status" style={{ marginTop: 16 }}>Loading challenge…</p>}
        {error && <p role="alert" style={{ color: 'var(--danger, #dc2626)', marginTop: 16 }}>{error}</p>}

        {challenge && !loading && (
          <>
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: '.95rem' }}>Target measurement probabilities</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                {Object.entries(challenge.target_probabilities || {})
                  .map(([state, probability]) => `${state}: ${(probability * 100).toFixed(1)}%`)
                  .join(' · ')}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '.8rem', marginTop: 6 }}>
                Matching probabilities alone may not restore the correct quantum phase.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap', marginTop: 20 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Gate</span>
                <select className="form-input" value={gate} onChange={event => setGate(event.target.value)}>
                  {GATES.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              {TWO_QUBIT_GATES.has(gate) && (
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Control qubit</span>
                  <select className="form-input" value={control} onChange={event => setControl(Number(event.target.value))}>
                    {Array.from({ length: challenge.qubits }, (_, qubit) => <option key={qubit} value={qubit}>q{qubit}</option>)}
                  </select>
                </label>
              )}
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Target qubit</span>
                <select className="form-input" value={target} onChange={event => setTarget(Number(event.target.value))}>
                  {Array.from({ length: challenge.qubits }, (_, qubit) => <option key={qubit} value={qubit}>q{qubit}</option>)}
                </select>
              </label>
              <button className="btn btn-secondary" type="button" onClick={addOperation}>Add gate</button>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: '.95rem' }}>Your sequence</h3>
              {operations.length === 0
                ? <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>No gates added yet.</p>
                : <ol style={{ paddingLeft: 22, marginTop: 8 }}>
                  {operations.map((operation, index) => (
                    <li key={`${operation.col}-${operation.gate}`} style={{ marginBottom: 8 }}>
                      {operation.gate}{TWO_QUBIT_GATES.has(operation.gate)
                        ? ` (q${operation.control} → q${operation.target})`
                        : ` (q${operation.target})`}
                      {' '}
                      <button className="text-action" type="button" onClick={() => removeOperation(index)} aria-label={`Remove gate ${index + 1}`}>Remove</button>
                    </li>
                  ))}
                </ol>}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
              <button className="btn btn-primary" type="button" onClick={submit} disabled={submitting}>
                {submitting ? 'Checking…' : 'Submit for server check'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={revealHint} disabled={hintsUsed >= MAX_HINTS}>
                {hintsUsed >= MAX_HINTS ? 'Hint limit reached' : 'Show hint'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => { setOperations([]); setResult(null); setError(''); }}>
                Clear sequence
              </button>
            </div>

            {showHint && (
              <p role="note" style={{ marginTop: 14, color: 'var(--text-secondary)' }}>
                Hint: pay attention to gate order and phase, not only the final measurement percentages.
              </p>
            )}
            {result?.result && (
              <div role="status" style={{ marginTop: 16, color: result.result.passed ? 'var(--success, #15803d)' : 'var(--text-secondary)' }}>
                <strong>{result.result.passed ? 'System restored.' : 'Not aligned yet.'}</strong>
                {' '}Verified fidelity: {(result.result.fidelity * 100).toFixed(1)}%.
                {result.reward?.awarded && ` Reward: +${result.reward.xp_awarded} XP.`}
                {result.reward && !result.reward.awarded && ' This attempt was already rewarded; XP was not duplicated.'}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
