export const MODULES = [
  { id: 1, title: 'Computing, Mathematics & Quantum Foundations', desc: 'Classical computing, probability, linear algebra, and Dirac notation.', category: 'Foundations', prereqs: [], skills: ['mathematics'] },
  { id: 2, title: 'Qubits & Quantum States', desc: 'Qubits, superposition, Bloch sphere, and measurement basics.', category: 'Foundations', prereqs: [1], skills: ['qubits'] },
  { id: 3, title: 'Single-Qubit Quantum Gates', desc: 'Pauli gates, Hadamard, phase gates, and rotation gates.', category: 'Foundations', prereqs: [2], skills: ['gates'] },
  { id: 4, title: 'Multi-Qubit Systems & Entanglement', desc: 'Tensor products, CNOT, entanglement, and Bell states.', category: 'Foundations', prereqs: [3], skills: ['gates', 'qubits'] },
  { id: 5, title: 'Quantum Circuit Design', desc: 'Circuit structure, depth, width, composition, and optimization basics.', category: 'Foundations', prereqs: [4], skills: ['circuits'] },
  { id: 6, title: 'Measurement & Quantum Information', desc: 'Measurement bases, observables, expectation values, and statistics.', category: 'Foundations', prereqs: [5], skills: ['circuits', 'qubits'] },
  { id: 7, title: 'Quantum Programming with Qiskit', desc: 'Qiskit circuits, simulators, transpilation, and execution.', category: 'Intermediate', prereqs: [6], skills: ['qiskit'] },
  { id: 8, title: 'Quantum SDK Ecosystem', desc: 'Qiskit, PennyLane, Cirq comparison and hybrid programming.', category: 'Intermediate', prereqs: [7], skills: ['qiskit'] },
  { id: 9, title: 'Fundamental Quantum Algorithms', desc: 'Deutsch, Deutsch-Jozsa, Bernstein-Vazirani, Simon, teleportation, superdense coding.', category: 'Intermediate', prereqs: [7], skills: ['algorithms'] },
  { id: 10, title: 'Advanced Quantum Algorithms', desc: "Grover's search, QFT, Shor's algorithm, and amplitude amplification.", category: 'Intermediate', prereqs: [9], skills: ['algorithms'] },
  { id: 11, title: 'Quantum Machine Learning', desc: 'Data encoding, parameterized circuits, VQC, and hybrid QML.', category: 'Advanced', prereqs: [10], skills: ['qml'] },
  { id: 12, title: 'Quantum Noise & NISQ', desc: 'Decoherence, error types, noise models, and fidelity.', category: 'Advanced', prereqs: [7], skills: ['noise'] },
  { id: 13, title: 'Quantum Error Correction', desc: 'Repetition codes, Shor code, Steane code, and surface codes.', category: 'Advanced', prereqs: [12], skills: ['errorCorrection'] },
  { id: 14, title: 'Quantum Circuit Optimization', desc: 'Gate cancellation, decomposition, transpilation, and resource estimation.', category: 'Advanced', prereqs: [7, 5], skills: ['circuits'] },
  { id: 15, title: 'Quantum Hardware & Real-World Computing', desc: 'Superconducting, trapped ion, photonic qubits, and NISQ era.', category: 'Advanced', prereqs: [12], skills: ['hardware'] },
  { id: 16, title: 'Capstone Projects', desc: 'Bell state, teleportation, Grover, classifier, and noise analysis projects.', category: 'Advanced', prereqs: [10], skills: ['algorithms', 'circuits'] },
  { id: 17, title: 'Quantum Research, Industry & Careers', desc: 'Research landscape, companies, career paths, papers, and portfolios.', category: 'Expert', prereqs: [10], skills: ['research'] },
  { id: 18, title: 'Quantum Cryptography & Communication', desc: 'BB84, QKD, E91, post-quantum cryptography, and quantum signatures.', category: 'Expert', prereqs: [9], skills: ['cryptography'] },
  { id: 19, title: 'Variational Quantum & Optimization', desc: 'QAOA, VQE, QUBO, Ising model, and quantum annealing.', category: 'Expert', prereqs: [10], skills: ['optimization'] },
  { id: 20, title: 'Quantum Networking & Distributed QC', desc: 'Quantum internet, repeaters, entanglement distribution, and cloud QC.', category: 'Expert', prereqs: [9, 18], skills: ['cryptography', 'research'] },
  { id: 21, title: 'Applications, Industry & Careers', desc: 'Healthcare, finance, AI, sensing, and quantum workforce.', category: 'Expert', prereqs: [10], skills: ['research'] },
  { id: 22, title: 'Research Methodology & Projects', desc: 'Reading papers, reproducing experiments, benchmarking, and publishing.', category: 'Expert', prereqs: [17], skills: ['research'] },
  { id: 23, title: 'Real Quantum Hardware & Cloud', desc: 'IBM Quantum, Amazon Braket, Azure Quantum, and hardware experiments.', category: 'Expert', prereqs: [12, 14], skills: ['hardware', 'qiskit'] },
  { id: 24, title: 'Quantum Simulation', desc: 'Hamiltonian simulation, Trotterization, VQE, and molecular simulation.', category: 'Expert', prereqs: [10, 19], skills: ['simulation'] },
];

export const MODULE_CATEGORIES = ['Foundations', 'Intermediate', 'Advanced', 'Expert'];

export const GOALS = [
  'Learn quantum computing',
  'Become a quantum programmer',
  'Learn quantum algorithms',
  'Learn quantum machine learning',
  'Prepare for research',
  'Prepare for a hackathon/project',
];

export const EDUCATION_LEVELS = [
  'High School', 'Undergraduate', 'Graduate', 'PhD', 'Professional', 'Self-learner'
];

export const SKILL_LABELS = {
  mathematics: 'Mathematics', qubits: 'Qubits', gates: 'Quantum Gates',
  circuits: 'Circuits', qiskit: 'Qiskit', algorithms: 'Algorithms',
  qml: 'QML', noise: 'Noise & NISQ', errorCorrection: 'Error Correction',
  hardware: 'Hardware', research: 'Research', cryptography: 'Cryptography',
  optimization: 'Optimization', simulation: 'Simulation',
};

export const ACHIEVEMENTS = [
  { id: 'qubit_explorer', name: 'Qubit Explorer', icon: '⚛️', desc: 'Complete Module 2', condition: (p) => p.completedModules?.includes(2) },
  { id: 'gate_master', name: 'Gate Master', icon: '🚪', desc: 'Complete Module 3 & 4', condition: (p) => p.completedModules?.includes(3) && p.completedModules?.includes(4) },
  { id: 'bell_builder', name: 'Bell State Builder', icon: '🔔', desc: 'Build a Bell state in Circuit Builder', condition: (p) => p.completedTopics?.includes('4-14') },
  { id: 'programmer', name: 'Quantum Programmer', icon: '💻', desc: 'Complete Module 7', condition: (p) => p.completedModules?.includes(7) },
  { id: 'algo_explorer', name: 'Algorithm Explorer', icon: '🧮', desc: 'Complete Module 9', condition: (p) => p.completedModules?.includes(9) },
  { id: 'lab_scientist', name: 'Quantum Lab Scientist', icon: '🔬', desc: 'Run 10 lab experiments', condition: (p) => (p.labExperiments || 0) >= 10 },
  { id: 'qml_practitioner', name: 'QML Practitioner', icon: '🤖', desc: 'Complete Module 11', condition: (p) => p.completedModules?.includes(11) },
  { id: 'researcher', name: 'Quantum Researcher', icon: '📚', desc: 'Complete Module 22', condition: (p) => p.completedModules?.includes(22) },
  { id: 'error_expert', name: 'Error Correction Expert', icon: '🛡️', desc: 'Complete Module 13', condition: (p) => p.completedModules?.includes(13) },
  { id: 'architect', name: 'Quantum Architect', icon: '🏛️', desc: 'Complete all 24 modules', condition: (p) => p.completedModules?.length >= 24 },
];
