import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { storage } from '../../utils/storage.js';
import AITutor from '../../components/ai/AITutor.jsx';

const DEFAULT_NOTES = [
  {
    id: 'default-bell-state',
    title: 'Bell State |Φ⁺⟩ Entanglement Investigation',
    category: 'Entanglement',
    hypothesis: 'Applying H on q0 followed by CNOT(q0, q1) will generate equal 50/50 probabilities for |00⟩ and |11⟩ with zero probability of |01⟩ or |10⟩.',
    mathFormulation: '|Φ⁺⟩ = (|00⟩ + |11⟩) / √2',
    observations: 'Simulated 1024 shots: measured |00⟩ 518 times (~50.6%) and |11⟩ 506 times (~49.4%). Cross-qubit parity is strictly even, confirming maximal Bell-state correlation.',
    circuitSnippet: 'qc.h(0)\nqc.cx(0, 1)\nqc.measure_all()',
    tags: ['BellState', 'Entanglement', 'EPRPair'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'default-superposition',
    title: 'Single-Qubit Hadamard Phase and Superposition',
    category: 'Superposition',
    hypothesis: 'Hadamard matrix transforms the computational basis state |0⟩ into equal superposition |+⟩ = (|0⟩ + |1⟩)/√2 on the equator of the Bloch sphere.',
    mathFormulation: 'H = (1/√2) [[1, 1], [1, -1]]; H|0⟩ = |+⟩',
    observations: 'Bloch vector coordinates rotated to (x=1, y=0, z=0). Consecutive Hadamard operations HH return the state back to |0⟩ due to unitary involution.',
    circuitSnippet: 'qc.h(0)\nqc.measure_all()',
    tags: ['Hadamard', 'BlochSphere', 'Phase'],
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const NOTEBOOK_STORAGE_KEY = 'quantumlearn_research_notes';
const CATEGORIES = ['All', 'Superposition', 'Entanglement', 'Algorithms', 'Hardware', 'Error Correction', 'General'];

export default function ResearchNotebook() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedCircuits, setSavedCircuits] = useState([]);
  const [savedExperiments, setSavedExperiments] = useState([]);
  const [message, setMessage] = useState('');
  const [persistenceState, setPersistenceState] = useState('loading');

  // Note editor form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [hypothesis, setHypothesis] = useState('');
  const [mathFormulation, setMathFormulation] = useState('');
  const [observations, setObservations] = useState('');
  const [circuitSnippet, setCircuitSnippet] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const storageKey = `${NOTEBOOK_STORAGE_KEY}_${user?.id || 'guest'}`;

  // Load notes on mount
  useEffect(() => {
    let mounted = true;
    const loadNotes = async () => {
      try {
        const remoteNotes = await storage.getResearchNotes(user?.id);
        if (!mounted) return;
        if (remoteNotes !== null) {
          const initial = remoteNotes.length ? remoteNotes : DEFAULT_NOTES;
          setNotes(initial);
          setPersistenceState('cloud');
          if (initial.length) selectNote(initial[0]);
          return;
        }
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setNotes(parsed);
        setPersistenceState('local');
        if (parsed.length > 0) selectNote(parsed[0]);
      } else {
        setNotes(DEFAULT_NOTES);
        setPersistenceState('local');
        selectNote(DEFAULT_NOTES[0]);
      }
      } catch (error) {
        if (!mounted) return;
      setNotes(DEFAULT_NOTES);
      selectNote(DEFAULT_NOTES[0]);
        setPersistenceState('error');
        setMessage(error.message || 'Research notes could not be loaded.');
      }
    };
    loadNotes();
    return () => { mounted = false; };
  }, [storageKey]);

  // Load user saved circuits and lab experiments for quick import
  useEffect(() => {
    if (user?.id) {
      storage.getSavedCircuits(user.id).then(setSavedCircuits).catch(() => {});
      storage.getLabExperiments(user.id).then(setSavedExperiments).catch(() => {});
    }
  }, [user?.id]);

  const selectNote = (note) => {
    setActiveNoteId(note.id);
    setTitle(note.title || '');
    setCategory(note.category || 'General');
    setHypothesis(note.hypothesis || '');
    setMathFormulation(note.mathFormulation || '');
    setObservations(note.observations || '');
    setCircuitSnippet(note.circuitSnippet || '');
    setTagsInput((note.tags || []).join(', '));
  };

  const handleCreateNew = () => {
    const newNote = {
      id: `note-${Date.now()}`,
      title: 'Untitled Quantum Investigation',
      category: 'General',
      hypothesis: '',
      mathFormulation: '',
      observations: '',
      circuitSnippet: '',
      tags: ['QuantumNote'],
      updatedAt: new Date().toISOString(),
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    selectNote(newNote);
    saveToStorage(updated);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!activeNoteId) return;

    const parsedTags = tagsInput
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const updated = notes.map(n => {
      if (n.id === activeNoteId) {
        return {
          ...n,
          title: title.trim() || 'Untitled Quantum Investigation',
          category,
          hypothesis,
          mathFormulation,
          observations,
          circuitSnippet,
          tags: parsedTags,
          updatedAt: new Date().toISOString(),
        };
      }
      return n;
    });

    const current = updated.find(n => n.id === activeNoteId);
    try {
      const saved = await storage.saveResearchNote(user?.id, current);
      const finalNotes = saved ? updated.map(n => n.id === activeNoteId ? saved : n) : updated;
      setNotes(finalNotes);
      if (saved) selectNote(saved);
      saveToStorage(finalNotes);
      setMessage(saved ? 'Research note saved to your account.' : 'Research note saved locally on this device.');
    } catch (error) {
      setMessage(error.message || 'Unable to save research note.');
      return;
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this research note?')) return;
    try {
      await storage.deleteResearchNote(user?.id, id);
    } catch (error) {
      setMessage(error.message || 'Unable to delete research note.');
      return;
    }
    const remaining = notes.filter(n => n.id !== id);
    setNotes(remaining);
    saveToStorage(remaining);
    if (activeNoteId === id) {
      if (remaining.length > 0) selectNote(remaining[0]);
      else {
        setActiveNoteId(null);
        setTitle('');
        setHypothesis('');
        setMathFormulation('');
        setObservations('');
        setCircuitSnippet('');
        setTagsInput('');
      }
    }
  };

  const saveToStorage = (notesList) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notesList));
    } catch (err) {
      console.warn('Storage save error:', err);
    }
  };

  const importCircuit = (c) => {
    const note = { id: `note-${Date.now()}`, title: `Circuit Analysis: ${c.name}`, category: 'Algorithms', hypothesis: '', mathFormulation: '', circuitSnippet: JSON.stringify(c.ops, null, 2), tags: ['Circuit'], observations: `Imported circuit "${c.name}" with ${c.nQubits} qubits and ${c.ops?.length || 0} operations.`, updatedAt: new Date().toISOString() };
    setNotes(current => [note, ...current]);
    selectNote(note);
  };

  const importExperiment = (exp) => {
    const note = { id: `note-${Date.now()}`, title: `Lab Experiment: ${exp.name || exp.preset}`, category: 'Superposition', mathFormulation: '', circuitSnippet: '', tags: ['Lab'], hypothesis: `Testing ${exp.preset || 'circuit'} under ${exp.noiseModel || 'ideal'} noise channel with ${exp.shots} shots.`, observations: `Fidelity achieved: ${((exp.fidelity || 1) * 100).toFixed(1)}%. Results: ${JSON.stringify(exp.results || {})}`, updatedAt: new Date().toISOString() };
    setNotes(current => [note, ...current]);
    selectNote(note);
  };

  const exportAsMarkdown = () => {
    if (!activeNoteId) return;
    const current = notes.find(n => n.id === activeNoteId);
    if (!current) return;

    const md = `# ${current.title}
**Category**: ${current.category}
**Date**: ${new Date(current.updatedAt).toLocaleString()}
**Tags**: ${(current.tags || []).map(t => `#${t}`).join(' ')}

---

## 🎯 Hypothesis / Problem Statement
${current.hypothesis || 'None recorded.'}

## 📐 Mathematical Formulation
\`\`\`latex
${current.mathFormulation || 'N/A'}
\`\`\`

## 🔬 Experimental Observations & Simulation Findings
${current.observations || 'None recorded.'}

## ⚡ Quantum Circuit Specification
\`\`\`python
${current.circuitSnippet || '# No circuit code provided'}
\`\`\`

*Exported from QuantumLearn AI Research Notebook*
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${current.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAllJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(notes, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `quantum-research-notebook-${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
  };

  const filteredNotes = notes.filter(n => {
    const matchesCat = activeCategory === 'All' || n.category === activeCategory;
    const matchesSearch = !searchQuery ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      n.hypothesis.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="page fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">📓 Quantum Research Notebook</h1>
          <p className="page-subtitle">
            Document quantum hypotheses, record simulation findings, import circuit artifacts, and export experimental records.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={exportAllJSON} title="Backup entire notebook">
            Export All (JSON)
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleCreateNew}>
            + New Investigation
          </button>
        </div>
      </div>

      {persistenceState === 'local' && <div className="tag tag-info" style={{ marginBottom: 16, padding: '8px 14px' }}>Local-only notebook mode. Connect Supabase to sync investigations across devices.</div>}
      {persistenceState === 'error' && <div className="tag tag-warning" style={{ marginBottom: 16, padding: '8px 14px' }}>Cloud notebook is unavailable. Your cloud notes were not changed.</div>}
      {message && <div className="tag tag-success" style={{ marginBottom: 16, padding: '8px 14px' }}>{message}</div>}

      <div className="notebook-container">
        {/* Left Sidebar: Filters & Notes List */}
        <aside className="notebook-sidebar">
          <div>
            <input
              className="form-input"
              type="text"
              placeholder="Search investigations or #tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.82rem', marginBottom: 10 }}
            />

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`tag ${activeCategory === cat ? 'tag-accent' : 'tag-info'}`}
                  style={{ cursor: 'pointer', border: 'none', fontSize: '0.72rem' }}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
            {filteredNotes.map(n => (
              <div
                key={n.id}
                className={`notebook-note-item ${activeNoteId === n.id ? 'active' : ''}`}
                onClick={() => selectNote(n)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {n.title}
                  </strong>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: '0 4px' }}
                    title="Delete note"
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="tag tag-info" style={{ fontSize: '0.65rem' }}>{n.category}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {new Date(n.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {filteredNotes.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No matching research notes found.
              </div>
            )}
          </div>

          {/* Quick Artifact Importers */}
          {(savedCircuits.length > 0 || savedExperiments.length > 0) && (
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12, marginTop: 'auto' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Quick Import Artifacts
              </div>
              {savedCircuits.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Saved Circuits:</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {savedCircuits.slice(0, 3).map(c => (
                      <button key={c.id} className="tag tag-accent" style={{ cursor: 'pointer', border: 'none', fontSize: '0.68rem' }} onClick={() => importCircuit(c)}>
                        ⚡ {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {savedExperiments.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Lab Runs:</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {savedExperiments.slice(0, 3).map(exp => (
                      <button key={exp.id} className="tag tag-info" style={{ cursor: 'pointer', border: 'none', fontSize: '0.68rem' }} onClick={() => importExperiment(exp)}>
                        🔬 {exp.name || exp.preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Right Area: Active Note Editor */}
        <main className="notebook-editor-card">
          {activeNoteId ? (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <input
                  className="form-input"
                  style={{ fontSize: '1.25rem', fontWeight: 800, flex: 1, minWidth: 260 }}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Investigation Title"
                  required
                />
                <select
                  className="form-select"
                  style={{ width: 170 }}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Hypothesis */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  🎯 Hypothesis / Research Problem
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  placeholder="What quantum phenomenon or algorithm behavior are you predicting or investigating?"
                />
              </div>

              {/* Mathematical Formulation */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  📐 Dirac State / Mathematical Model
                </label>
                <input
                  className="form-input"
                  value={mathFormulation}
                  onChange={(e) => setMathFormulation(e.target.value)}
                  placeholder="e.g. |ψ⟩ = α|00⟩ + β|11⟩, or H = 1/√2 [[1, 1], [1, -1]]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>

              {/* Experimental Observations */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  🔬 Simulation Observations & Analysis
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Record your measurement frequencies, statevector amplitudes, fidelity metrics, or noise impact..."
                />
              </div>

              {/* Circuit Code / Configuration */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  ⚡ Circuit Code (Qiskit / OpenQASM)
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={circuitSnippet}
                  onChange={(e) => setCircuitSnippet(e.target.value)}
                  placeholder="qc.h(0)&#10;qc.cx(0, 1)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                />
              </div>

              {/* Tags & Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                <input
                  className="form-input"
                  style={{ maxWidth: 300, fontSize: '0.82rem' }}
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Tags: BellState, Grover, Noise..."
                />

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={exportAsMarkdown}>
                    Export (.MD)
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <h3>No Note Selected</h3>
              <p style={{ marginTop: 8 }}>Select an existing investigation from the sidebar or create a new one.</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={handleCreateNew}>
                + New Investigation
              </button>
            </div>
          )}
        </main>
      </div>

      <AITutor />
    </div>
  );
}
