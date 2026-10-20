import { supabase } from '../lib/supabaseClient.js';

export const storage = {
  // ----------------------------------------------------
  // SCHEDULED LEARNING EVENTS (migration 18, read-only for learners)
  // ----------------------------------------------------
  async getLearningEvents() {
    if (!supabase) return null;
    const { data, error } = await supabase.from('learning_events').select('*').order('start_time', { ascending: true });
    if (error) throw new Error(`Unable to load scheduled events: ${error.message}`);
    return (data || []).map(event => ({
      id: event.id, title: event.title, category: event.category, description: event.description,
      startTime: event.start_time, endTime: event.end_time, route: event.route || '',
      xpReward: Number(event.xp_reward || 0), difficulty: event.difficulty, eligibility: event.eligibility,
    }));
  },

  // ----------------------------------------------------
  // RESEARCH NOTEBOOK (migration 18, owner-scoped by RLS)
  // ----------------------------------------------------
  async getResearchNotes(userId) {
    if (!userId || !supabase) return null;
    const { data, error } = await supabase.from('research_notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    if (error) throw new Error(`Unable to load research notes: ${error.message}`);
    return (data || []).map(note => ({ id: note.id, title: note.title, category: note.category, hypothesis: note.hypothesis, mathFormulation: note.math_formulation, observations: note.observations, circuitSnippet: note.circuit_snippet, tags: note.tags || [], updatedAt: note.updated_at }));
  },

  async saveResearchNote(userId, note) {
    if (!userId || !supabase) return null;
    const hasPersistedId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(note.id || '');
    const record = { user_id: userId, title: (note.title || 'Untitled Quantum Investigation').trim(), category: note.category || 'General', hypothesis: note.hypothesis || '', math_formulation: note.mathFormulation || '', observations: note.observations || '', circuit_snippet: note.circuitSnippet || '', tags: Array.isArray(note.tags) ? note.tags : [], updated_at: new Date().toISOString() };
    const { data, error } = hasPersistedId
      ? await supabase.from('research_notes').update(record).eq('id', note.id).select().single()
      : await supabase.from('research_notes').insert(record).select().single();
    if (error) throw new Error(`Unable to save research note: ${error.message}`);
    return { id: data.id, title: data.title, category: data.category, hypothesis: data.hypothesis, mathFormulation: data.math_formulation, observations: data.observations, circuitSnippet: data.circuit_snippet, tags: data.tags || [], updatedAt: data.updated_at };
  },

  async deleteResearchNote(userId, noteId) {
    if (!userId || !supabase) return false;
    const { error } = await supabase.from('research_notes').delete().eq('id', noteId);
    if (error) throw new Error(`Unable to delete research note: ${error.message}`);
    return true;
  },

  // ----------------------------------------------------
  // PROGRESS & SKILLS
  // ----------------------------------------------------
  async getProgress(userId) {
    if (!userId) return createDefaultProgress();
    if (!supabase) return createDefaultProgress();
    
    // Fetch progress
    const { data: progData, error: progErr } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
      
    // Fetch module progress
    const { data: modsData } = await supabase
      .from('module_progress')
      .select('module_id, score')
      .eq('user_id', userId);
      
    // Fetch topic progress
    const { data: topicsData } = await supabase
      .from('topic_progress')
      .select('topic_id, score')
      .eq('user_id', userId);

    // Fetch test attempts
    const { data: testsData } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('user_id', userId);

    if (progErr && progErr.code !== 'PGRST116') {
      console.error('Error fetching progress:', progErr);
    }

    const defaultProg = createDefaultProgress();
    const moduleScores = {};
    const completedModules = [];
    if (modsData) {
      modsData.forEach(m => {
        moduleScores[m.module_id] = m.score;
        completedModules.push(m.module_id);
      });
    }

    const topicScores = {};
    const completedTopics = [];
    if (topicsData) {
      topicsData.forEach(t => {
        topicScores[t.topic_id] = t.score;
        completedTopics.push(t.topic_id);
      });
    }
    
    const testHistory = testsData ? testsData.map(t => ({
      moduleId: t.module_id,
      score: t.score,
      details: t.details,
      date: t.created_at
    })) : [];

    return {
      ...defaultProg,
      ...(progData ? {
        lastActive: progData.last_active,
        totalTime: progData.total_time,
        questionsAnswered: progData.questions_answered,
        questionsCorrect: progData.questions_correct,
        circuitsChallengesCompleted: progData.circuits_challenges_completed,
        codeChallengesCompleted: progData.code_challenges_completed,
        currentModule: progData.current_module,
        currentTopic: progData.current_topic,
        labExperiments: progData.lab_experiments
      } : {}),
      moduleScores,
      completedModules,
      topicScores,
      completedTopics,
      testHistory
    };
  },

  async setProgress(userId, progress) {
    if (!userId || !supabase) return;
    
    // Update main progress table
    const { error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        last_active: progress.lastActive || new Date().toISOString(),
        total_time: progress.totalTime || 0,
        questions_answered: progress.questionsAnswered || 0,
        questions_correct: progress.questionsCorrect || 0,
        circuits_challenges_completed: progress.circuitsChallengesCompleted || 0,
        code_challenges_completed: progress.codeChallengesCompleted || 0,
        current_module: progress.currentModule,
        current_topic: progress.currentTopic,
        lab_experiments: progress.labExperiments || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      
    if (error) console.error('Error saving progress:', error);
  },

  async getSkills(userId) {
    if (!userId || !supabase) return createDefaultSkills();
    const { data, error } = await supabase
      .from('user_skills')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching skills:', error);
    }
    
    if (!data) return createDefaultSkills();
    
    const { user_id, updated_at, ...skills } = data;
    return { ...createDefaultSkills(), ...skills };
  },

  async setSkills(userId, skills) {
    if (!userId || !supabase) return;
    
    const dbSkills = {
      user_id: userId,
      mathematics: skills.mathematics || 0,
      qubits: skills.qubits || 0,
      gates: skills.gates || 0,
      circuits: skills.circuits || 0,
      qiskit: skills.qiskit || 0,
      algorithms: skills.algorithms || 0,
      qml: skills.qml || 0,
      noise: skills.noise || 0,
      error_correction: skills.errorCorrection || 0,
      hardware: skills.hardware || 0,
      research: skills.research || 0,
      cryptography: skills.cryptography || 0,
      optimization: skills.optimization || 0,
      simulation: skills.simulation || 0,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('user_skills')
      .upsert(dbSkills, { onConflict: 'user_id' });
      
    if (error) console.error('Error saving skills:', error);
  },

  // ----------------------------------------------------
  // COMPLETION RECORDS
  // ----------------------------------------------------
  async completeTopic(userId, topicId, score = 0) {
    if (!userId || !supabase) return;
    const { error } = await supabase
      .from('topic_progress')
      .upsert({ user_id: userId, topic_id: topicId, score }, { onConflict: 'user_id, topic_id' });
    if (error) console.error('Error completing topic:', error);
  },

  async completeModule(userId, moduleId, score = 0) {
    if (!userId || !supabase) return;
    const { error } = await supabase
      .from('module_progress')
      .upsert({ user_id: userId, module_id: moduleId, score }, { onConflict: 'user_id, module_id' });
    if (error) console.error('Error completing module:', error);
  },

  async recordTestScore(userId, moduleId, score, details) {
    if (!userId || !supabase) return;
    const { error } = await supabase
      .from('test_attempts')
      .insert({ user_id: userId, module_id: moduleId, score, details });
    if (error) console.error('Error recording test score:', error);
  },

  // ----------------------------------------------------
  // CIRCUITS & LAB
  // ----------------------------------------------------
  async getSavedCircuits(userId) {
    if (!userId || !supabase) return [];
    const { data, error } = await supabase
      .from('saved_circuits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Unable to load saved circuits: ${error.message}`);
    return (data || []).map(c => ({ id: c.id, name: c.name, nQubits: c.num_qubits, ops: c.operations, date: c.created_at }));
  },

  async insertCircuit(userId, name, nQubits, ops) {
    if (!userId || !supabase) throw new Error('Sign in with Supabase before saving a circuit.');
    const { data, error } = await supabase
      .from('saved_circuits')
      .insert({ user_id: userId, name, num_qubits: nQubits, operations: ops })
      .select()
      .single();
    if (error) throw new Error(`Unable to save circuit: ${error.message}`);
    return { id: data.id, name: data.name, nQubits: data.num_qubits, ops: data.operations, date: data.created_at };
  },

  async getLabExperiments(userId) {
    if (!userId || !supabase) return [];
    const { data, error } = await supabase
      .from('lab_experiments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Unable to load lab experiments: ${error.message}`);
    return (data || []).map(l => ({
      id: l.id,
      name: l.name,
      preset: l.preset_name,
      shots: l.num_shots,
      noiseModel: l.noise_model,
      fidelity: Number(l.fidelity),
      results: l.results,
      date: l.created_at,
    }));
  },

  async insertLabExperiment(userId, exp) {
    if (!userId || !supabase) throw new Error('Sign in with Supabase before saving a lab experiment.');
    const { data, error } = await supabase
      .from('lab_experiments')
      .insert({
        user_id: userId,
        name: exp.name,
        preset_name: exp.preset,
        num_shots: exp.shots,
        noise_model: exp.noiseModel,
        fidelity: Math.min(1, Math.max(0, Number(exp.fidelity || 0) / 100)),
        results: exp.results,
      })
      .select()
      .single();
    if (error) throw new Error(`Unable to save lab experiment: ${error.message}`);
    return { id: data.id, name: data.name, preset: data.preset_name, shots: data.num_shots, noiseModel: data.noise_model, fidelity: Number(data.fidelity), results: data.results, date: data.created_at };
  },

  async incrementLabExperiments(userId) {
    if (!userId || !supabase) return;
    const { data } = await supabase
      .from('user_progress')
      .select('lab_experiments')
      .eq('user_id', userId)
      .maybeSingle();
    const current = Number(data?.lab_experiments || 0);
    const { error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        lab_experiments: current + 1,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    if (error) console.error('Error updating lab experiment count:', error);
  },
  
  async deleteLabExperiment(expId, userId) {
    if (!expId || !userId || !supabase) throw new Error('Sign in with Supabase before deleting a lab experiment.');
    const { error } = await supabase.from('lab_experiments').delete().eq('id', expId).eq('user_id', userId);
    if (error) throw new Error(`Unable to delete lab experiment: ${error.message}`);
  },

  // ----------------------------------------------------
  // CHAT HISTORY
  // ----------------------------------------------------
  async getChatHistory(userId) {
    if (!userId || !supabase) return [];
    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) { console.error('Error fetching chat:', error); return []; }
    return data.map(c => ({ role: c.role, text: c.message_text }));
  },

  async insertChatMessage(userId, role, text) {
    if (!userId || !supabase) return;
    const { error } = await supabase
      .from('ai_chat_messages')
      .insert({ user_id: userId, role, message_text: text });
    if (error) console.error('Error saving chat:', error);
  },

  // ----------------------------------------------------
  // ANALYTICS & ADMIN
  // ----------------------------------------------------
  async getUsers() {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_admin_users');
    if (error) {
      console.warn('Error fetching admin users list:', error.message);
      return [];
    }
    return data.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar_url: u.avatar_url,
      role: u.role,
      education: u.education,
      goal: u.goal,
      isAdmin: u.role === 'admin'
    }));
  },

  async resetUserProgress(userId) {
    if (!userId || !supabase) return false;
    const { data, error } = await supabase.rpc('reset_user_progress', { target_user_id: userId });
    if (error) {
      console.error('Error resetting user progress:', error.message);
      return false;
    }
    return data;
  },

  async getActivityLog(userId) {
    if (!userId || !supabase) return {};
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', userId);
    if (error) return {};
    const log = {};
    data.forEach(a => { log[a.activity_date] = a.interaction_count; });
    return log;
  },

  async getGlobalActivitySummary() {
    if (!supabase) return {};
    const { data, error } = await supabase.rpc('get_global_activity_summary');
    if (error) {
      console.error('Error fetching global activity summary:', error.message);
      return {};
    }
    const log = {};
    if (data) {
      data.forEach(a => { log[a.activity_date] = Number(a.total_interactions); });
    }
    return log;
  },

  async logActivity(userId) {
    if (!userId || !supabase) return;
    const { error } = await supabase.rpc('log_activity');
    if (error) {
      console.error('Error logging activity:', error.message);
    }
  },

  async getGateUsage(userId) {
    if (!userId || !supabase) return {};
    const { data, error } = await supabase
      .from('gate_usage')
      .select('*')
      .eq('user_id', userId);
    if (error) return {};
    const usage = {};
    data.forEach(g => { usage[g.gate_name] = g.usage_count; });
    return usage;
  },

  async getGlobalGateUsage() {
    if (!supabase) return {};
    const { data, error } = await supabase.rpc('get_global_gate_usage');
    if (error) {
      console.error('Error fetching global gate usage:', error.message);
      return {};
    }
    const usage = {};
    if (data) {
      data.forEach(g => { usage[g.gate_name] = Number(g.total_usage); });
    }
    return usage;
  },

  async trackGateUsage(userId, gateName) {
    if (!userId || !gateName || !supabase) return;
    const { error } = await supabase.rpc('increment_gate_usage', { p_gate_name: gateName });
    if (error) {
      console.error('Error tracking gate usage:', error.message);
    }
  },

  async completePuzzle(userId, puzzleId) {
    if (!userId || !supabase) return;
    await supabase
      .from('puzzle_progress')
      .upsert({ user_id: userId, puzzle_id: puzzleId, completed: true }, { onConflict: 'user_id, puzzle_id' });
  },

  // ----------------------------------------------------
  // ASSESSMENTS & FEEDBACK
  // ----------------------------------------------------
  async getAssessments() {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_instructor_assessments');
    if (error) {
      console.error('Error fetching assessments:', error.message);
      return [];
    }
    return data || [];
  },

  async createAssessment(assessment) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('assessments')
      .insert({
        title: assessment.title,
        description: assessment.description || '',
        created_by: assessment.created_by,
        assessment_type: assessment.assessment_type || 'quiz',
        difficulty: assessment.difficulty || 'medium',
        duration_minutes: Number(assessment.duration_minutes || 30),
        status: assessment.status || 'draft',
      })
      .select()
      .single();
    if (error) {
      console.error('Error creating assessment:', error.message);
      return null;
    }
    return data;
  },

  async updateAssessment(id, updates) {
    if (!supabase || !id) return null;
    const { data, error } = await supabase
      .from('assessments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('Error updating assessment:', error.message);
      return null;
    }
    return data;
  },

  async deleteAssessment(id) {
    if (!supabase || !id) return false;
    const { error } = await supabase.from('assessments').delete().eq('id', id);
    if (error) {
      console.error('Error deleting assessment:', error.message);
      return false;
    }
    return true;
  },

  async assignAssessment(assessmentId, studentId, assignedBy, dueDate = null) {
    if (!supabase || !assessmentId || !studentId) return null;
    const { data, error } = await supabase
      .from('assessment_assignments')
      .upsert({
        assessment_id: assessmentId,
        student_id: studentId,
        assigned_by: assignedBy,
        due_date: dueDate,
      }, { onConflict: 'assessment_id,student_id' })
      .select()
      .single();
    if (error) {
      console.error('Error assigning assessment:', error.message);
      return null;
    }
    return data;
  },

  async getAssignedAssessments(studentId) {
    if (!supabase || !studentId) return [];
    const { data, error } = await supabase
      .from('assessment_assignments')
      .select('*, assessments(*)')
      .eq('student_id', studentId)
      .order('assigned_at', { ascending: false });
    if (error) {
      console.error('Error fetching assigned assessments:', error.message);
      return [];
    }
    return data || [];
  },

  async submitAssessment(assessmentId, studentId, answers) {
    if (!supabase || !assessmentId || !studentId) return null;
    const { data, error } = await supabase
      .from('assessment_submissions')
      .upsert({
        assessment_id: assessmentId,
        student_id: studentId,
        answers,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'assessment_id,student_id' })
      .select()
      .single();
    if (error) {
      console.error('Error submitting assessment:', error.message);
      return null;
    }
    return data;
  },

  async getAssessmentSubmissions(assessmentId) {
    if (!supabase || !assessmentId) return [];
    const { data, error } = await supabase
      .from('assessment_submissions')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('submitted_at', { ascending: false });
    if (error) {
      console.error('Error fetching assessment submissions:', error.message);
      return [];
    }
    return data || [];
  },

  async gradeAssessment(submissionId, score, feedback, reviewedBy) {
    if (!supabase || !submissionId) return null;
    const { data, error } = await supabase
      .from('assessment_submissions')
      .update({
        score,
        feedback,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        status: 'graded',
      })
      .eq('id', submissionId)
      .select()
      .single();
    if (error) {
      console.error('Error grading assessment:', error.message);
      return null;
    }
    return data;
  },

  async getInstructorFeedback(studentId) {
    if (!supabase || !studentId) return [];
    const { data, error } = await supabase
      .from('instructor_feedback')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching instructor feedback:', error.message);
      return [];
    }
    return data || [];
  },

  async sendInstructorFeedback({ instructorId, studentId, moduleId, message }) {
    if (!supabase || !instructorId || !studentId || !message) return null;
    const { data, error } = await supabase
      .from('instructor_feedback')
      .insert({
        instructor_id: instructorId,
        student_id: studentId,
        module_id: moduleId || null,
        message,
      })
      .select()
      .single();
    if (error) {
      console.error('Error sending instructor feedback:', error.message);
      return null;
    }
    return data;
  },

  async assignLearningPath({ instructorId, studentId, title, description = '' }) {
    if (!supabase || !instructorId || !studentId || !title?.trim()) return null;
    const { data, error } = await supabase
      .from('learning_path_assignments')
      .insert({ instructor_id: instructorId, student_id: studentId, title: title.trim(), description: description.trim() || null })
      .select()
      .single();
    if (error) {
      console.error('Error assigning learning path:', error.message);
      return null;
    }
    return data;
  },

  async getInstructorLearningPaths(instructorId) {
    if (!supabase || !instructorId) return [];
    const { data, error } = await supabase
      .from('learning_path_assignments')
      .select('*')
      .eq('instructor_id', instructorId)
      .eq('status', 'assigned')
      .order('assigned_at', { ascending: false });
    if (error) {
      console.error('Error loading learning paths:', error.message);
      return [];
    }
    return data || [];
  },

  // ----------------------------------------------------
  // AVATAR STORAGE
  // ----------------------------------------------------
  async uploadAvatar(userId, file) {
    if (!userId || !file || !supabase) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar_${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  },

  // ----------------------------------------------------
  // ADMIN TOPIC OVERRIDES
  // ----------------------------------------------------
  async getTopicOverrides() {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('admin_topics')
          .select('*')
          .eq('status', 'published');
        if (!error && data && data.length) {
          localStorage.setItem('ql_topic_overrides', JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn('Could not fetch topic overrides from Supabase:', e);
    }
    try {
      const response = await fetch('/api/content/topics').then(r => r.json()).catch(() => null);
      if (response?.topics?.length) {
        localStorage.setItem('ql_topic_overrides', JSON.stringify(response.topics));
        return response.topics;
      }
    } catch {}
    try {
      const cached = localStorage.getItem('ql_topic_overrides');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  },

  saveTopicOverrideLocally(topicRecord) {
    if (!topicRecord) return;
    try {
      const cached = JSON.parse(localStorage.getItem('ql_topic_overrides') || '[]');
      const tid = topicRecord.metadata?.topic_id;
      const filtered = cached.filter(t => 
        t.id !== topicRecord.id && 
        (!tid || t.metadata?.topic_id !== tid) &&
        t.title !== topicRecord.title
      );
      filtered.push(topicRecord);
      localStorage.setItem('ql_topic_overrides', JSON.stringify(filtered));
    } catch (e) {
      console.warn('Failed to cache topic override locally:', e);
    }
  },
};

export function createDefaultProgress() {
  return {
    completedModules: [],
    completedTopics: [],
    moduleScores: {},
    topicScores: {},
    streak: 0,
    lastActive: null,
    totalTime: 0,
    questionsAnswered: 0,
    questionsCorrect: 0,
    circuitsChallengesCompleted: 0,
    codeChallengesCompleted: 0,
    testHistory: [],
    currentModule: null,
    currentTopic: null,
    labExperiments: 0
  };
}

export function createDefaultSkills() {
  return {
    mathematics: 0, qubits: 0, gates: 0, circuits: 0,
    qiskit: 0, algorithms: 0, qml: 0, noise: 0,
    errorCorrection: 0, hardware: 0, research: 0,
    cryptography: 0, optimization: 0, simulation: 0,
  };
}

