(function () {
  "use strict";

  const config = window.EXAM_ATLAS_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !window.supabase) {
    window.EXAM_ATLAS_STARTUP_ERROR = "The Supabase browser library did not load. Check your internet connection, disable any blocker for unpkg.com/jsdelivr.net, then reload.";
    return;
  }

  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let realtimeChannel = null;

  function normalizeNote(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title || "",
      question_id: row.question_id || "",
      exam: row.exam || "",
      year: row.year || null,
      topics: Array.isArray(row.topics) ? row.topics : [],
      difficulty: row.difficulty || "medium",
      status: row.status || "understood",
      body: row.body || "",
      key_insight: row.key_insight || "",
      traps: row.traps || "",
      formulas: row.formulas || "",
      refs: row.refs || "",
      related_note_ids: Array.isArray(row.related_note_ids) ? row.related_note_ids : [],
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  function normalizeProgress(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      log_date: row.log_date,
      questions_solved: Number(row.questions_solved || 0),
      study_minutes: Number(row.study_minutes || 0),
      reflection: row.reflection || "",
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  const API = {
    client,

    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    onAuthChange(callback) {
      return client.auth.onAuthStateChange((event, session) => callback(event, session));
    },

    async signUp(email, password) {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      return data;
    },

    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    async resetPassword(email) {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    },

    async updatePassword(password) {
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw error;
      return data;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    async loadAll() {
      const [notesResult, progressResult] = await Promise.all([
        client.from("notes").select("*").order("updated_at", { ascending: false }).limit(3000),
        client.from("study_logs").select("*").order("log_date", { ascending: false }).limit(1000)
      ]);
      if (notesResult.error) throw notesResult.error;
      if (progressResult.error) throw progressResult.error;
      return {
        notes: (notesResult.data || []).map(normalizeNote),
        progress: (progressResult.data || []).map(normalizeProgress)
      };
    },

    async saveNote(note, userId) {
      const payload = {
        id: note.id || `note_${crypto.randomUUID()}`,
        user_id: userId,
        title: note.title,
        question_id: note.question_id,
        exam: note.exam,
        year: note.year || null,
        topics: note.topics,
        difficulty: note.difficulty,
        status: note.status,
        body: note.body,
        key_insight: note.key_insight,
        traps: note.traps,
        formulas: note.formulas,
        refs: note.refs,
        related_note_ids: note.related_note_ids
      };
      const { data, error } = await client.from("notes").upsert(payload, { onConflict: "id" }).select().single();
      if (error) throw error;
      return normalizeNote(data);
    },

    async deleteNote(id) {
      const { error } = await client.from("notes").delete().eq("id", id);
      if (error) throw error;
    },

    async saveProgress(entry, userId) {
      const payload = {
        user_id: userId,
        log_date: entry.log_date,
        questions_solved: Number(entry.questions_solved || 0),
        study_minutes: Number(entry.study_minutes || 0),
        reflection: entry.reflection || ""
      };
      const { data, error } = await client.from("study_logs")
        .upsert(payload, { onConflict: "user_id,log_date" })
        .select().single();
      if (error) throw error;
      return normalizeProgress(data);
    },

    async deleteProgress(id) {
      const { error } = await client.from("study_logs").delete().eq("id", id);
      if (error) throw error;
    },

    async importBackup(backup, userId) {
      const notes = (backup.notes || []).filter(n => n?.id && n?.title).map(n => ({
        id: String(n.id), user_id: userId, title: n.title || "", question_id: n.question_id || "",
        exam: n.exam || "", year: n.year || null, topics: Array.isArray(n.topics) ? n.topics : [],
        difficulty: n.difficulty || "medium", status: n.status || "understood", body: n.body || "",
        key_insight: n.key_insight || "", traps: n.traps || "", formulas: n.formulas || "",
        refs: n.refs || "", related_note_ids: Array.isArray(n.related_note_ids) ? n.related_note_ids : []
      }));
      const progress = (backup.progress || backup.study_logs || []).filter(p => p?.log_date).map(p => ({
        user_id: userId, log_date: p.log_date, questions_solved: Number(p.questions_solved || 0),
        study_minutes: Number(p.study_minutes || 0), reflection: p.reflection || ""
      }));

      if (notes.length) {
        const { error } = await client.from("notes").upsert(notes, { onConflict: "id" });
        if (error) throw error;
      }
      if (progress.length) {
        const { error } = await client.from("study_logs").upsert(progress, { onConflict: "user_id,log_date" });
        if (error) throw error;
      }
      return { notes: notes.length, progress: progress.length };
    },

    async deleteEverything(userId) {
      const progressResult = await client.from("study_logs").delete().eq("user_id", userId);
      if (progressResult.error) throw progressResult.error;
      const notesResult = await client.from("notes").delete().eq("user_id", userId);
      if (notesResult.error) throw notesResult.error;
    },

    subscribe(userId, onChange) {
      this.unsubscribe();
      realtimeChannel = client.channel(`exam-atlas-${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `user_id=eq.${userId}` }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "study_logs", filter: `user_id=eq.${userId}` }, onChange)
        .subscribe();
    },

    unsubscribe() {
      if (realtimeChannel) client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };

  window.ExamAPI = API;
})();
