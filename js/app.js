(function () {
  "use strict";

  const API = window.ExamAPI;
  const state = {
    user: null,
    notes: [],
    progress: [],
    activeView: "dashboard",
    authMode: "login",
    selectedRelated: new Set(),
    currentDialogNote: null,
    recoveryUser: null,
    realtimeTimer: null
  };

  const viewMeta = {
    dashboard: ["Workspace / Overview", "Your study cockpit"],
    "add-note": ["Workspace / Notes", "Capture a solution pattern"],
    library: ["Workspace / Library", "Your note library"],
    graph: ["Insights / Connections", "Knowledge graph"],
    progress: ["Insights / Tracking", "Daily progress"],
    data: ["Workspace / Settings", "Data & backup"]
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const todayKey = () => window.ExamCharts.localDateKey(new Date());
  const parseTopics = value => [...new Set(String(value || "").split(",").map(v => v.trim()).filter(Boolean))];
  const formatDate = value => value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
  const formatShortDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";
  const relativeDate = value => {
    if (!value) return "";
    const diff = Math.max(0, Date.now() - new Date(value).getTime());
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return formatDate(value);
  };
  const truncate = (value, length = 130) => {
    const text = String(value || "").trim();
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
  };

  function toast(message, type = "success") {
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.innerHTML = `<i data-lucide="${type === "error" ? "circle-alert" : "circle-check"}"></i><span>${escapeHtml(message)}</span>`;
    $("#toast-region").append(item);
    window.lucide?.createIcons();
    setTimeout(() => item.remove(), 4200);
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.original = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="spinner" style="width:16px;height:16px"></span><span>${escapeHtml(label || "Working…")}</span>`;
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.original || button.innerHTML;
      window.lucide?.createIcons();
    }
  }

  function initials(email) {
    const name = (email || "Exam Atlas").split("@")[0].replace(/[._-]+/g, " ");
    return name.split(" ").filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase() || "EA";
  }

  function friendlyName(email) {
    const raw = (email || "Scholar").split("@")[0].replace(/[._-]+/g, " ");
    return raw.replace(/\b\w/g, char => char.toUpperCase());
  }

  function showAuth() {
    API.unsubscribe();
    state.user = null;
    state.notes = [];
    state.progress = [];
    $("#auth-screen").classList.remove("hidden");
    $("#app-shell").classList.add("hidden");
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const signup = mode === "signup";
    const recovery = mode === "recovery";
    $$(".auth-tab").forEach(item => item.classList.toggle("active", item.dataset.authMode === mode));
    $(".auth-tabs").classList.toggle("hidden", recovery);
    $("#auth-heading").innerHTML = recovery
      ? `<h2>Choose a new password</h2><p>Enter a secure password for your Exam Atlas account.</p>`
      : signup
        ? `<h2>Create your atlas</h2><p>One private workspace, available on every device.</p>`
        : `<h2>Welcome back</h2><p>Pick up exactly where you left off.</p>`;
    $("#auth-submit").innerHTML = `${recovery ? "Save new password" : signup ? "Create account" : "Sign in"} <i data-lucide="arrow-right"></i>`;
    $("#auth-password").autocomplete = signup || recovery ? "new-password" : "current-password";
    $("#auth-email").closest(".field").classList.toggle("hidden", recovery);
    $("#forgot-password").classList.toggle("hidden", signup || recovery);
    window.lucide?.createIcons();
  }

  async function showApp(user) {
    if (!user || state.user?.id === user.id && !$("#app-shell").classList.contains("hidden")) return;
    state.user = user;
    $("#auth-screen").classList.add("hidden");
    $("#app-shell").classList.remove("hidden");
    $("#user-email").textContent = user.email || "";
    $("#user-name").textContent = friendlyName(user.email);
    $("#user-avatar").textContent = initials(user.email);
    $("#progress-date").value = todayKey();
    updateGreeting();
    window.lucide?.createIcons();
    await loadData();
    API.subscribe(user.id, () => {
      clearTimeout(state.realtimeTimer);
      state.realtimeTimer = setTimeout(loadData, 450);
    });
  }

  async function loadData() {
    $("#loading-state").classList.remove("hidden");
    $("#view-container").classList.add("hidden");
    try {
      const data = await API.loadAll();
      state.notes = data.notes;
      state.progress = data.progress;
      renderAll();
      $("#loading-state").classList.add("hidden");
      $("#view-container").classList.remove("hidden");
    } catch (error) {
      console.error(error);
      $("#loading-state").innerHTML = `<div class="notes-empty"><i data-lucide="database-zap"></i><h3>Database setup needed</h3><p>${escapeHtml(error.message || "Could not load your workspace.")}<br>Run <strong>supabase/schema.sql</strong> in the Supabase SQL editor, then refresh this page.</p><button class="button ghost" onclick="location.reload()">Try again</button></div>`;
      window.lucide?.createIcons();
    }
  }

  function updateGreeting() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    $("#greeting").textContent = `${greeting}, ${friendlyName(state.user?.email).split(" ")[0]}.`;
    $("#today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  }

  function switchView(view, options = {}) {
    if (!viewMeta[view]) return;
    state.activeView = view;
    $$(".app-view").forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === view));
    $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
    $("#view-kicker").textContent = viewMeta[view][0];
    $("#view-title").textContent = viewMeta[view][1];
    $(".sidebar").classList.remove("open");
    $("#sidebar-scrim").classList.remove("open");
    if (!options.keepScroll) window.scrollTo({ top: 0, behavior: "smooth" });
    window.location.hash = view;
    if (view === "graph") setTimeout(() => window.ExamGraph.render(state.notes, $("#graph-mode").value), 40);
    if (view === "progress") setTimeout(renderProgressCharts, 30);
    if (view === "dashboard") setTimeout(renderDashboardChart, 30);
  }

  function renderAll() {
    $("#nav-note-count").textContent = state.notes.length;
    renderDashboard();
    renderLibrary();
    renderRelatedOptions();
    renderProgress();
    if (state.activeView === "graph") window.ExamGraph.render(state.notes, $("#graph-mode").value);
    window.lucide?.createIcons();
  }

  function noteCountsByDate() {
    const map = new Map();
    state.notes.forEach(note => {
      if (!note.created_at) return;
      const key = window.ExamCharts.localDateKey(new Date(note.created_at));
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }

  function calculateStreak() {
    const active = new Set();
    state.notes.forEach(note => note.created_at && active.add(window.ExamCharts.localDateKey(new Date(note.created_at))));
    state.progress.forEach(entry => active.add(entry.log_date));
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!active.has(window.ExamCharts.localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (active.has(window.ExamCharts.localDateKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  function renderDashboard() {
    const today = todayKey();
    const todayProgress = state.progress.find(p => p.log_date === today);
    const counts = noteCountsByDate();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);
    const weeklyNotes = state.notes.filter(n => new Date(n.created_at) >= weekAgo).length;
    const streak = calculateStreak();

    $("#metric-notes").textContent = state.notes.length;
    $("#notes-delta").textContent = `+${weeklyNotes} this week`;
    $("#metric-notes-caption").textContent = state.notes.length ? `${counts.get(today) || 0} added today` : "Start your atlas with one note";
    $("#metric-questions").textContent = todayProgress?.questions_solved || 0;
    $("#metric-questions-caption").textContent = todayProgress ? "Progress logged for today" : "No progress logged yet";
    $("#metric-time").textContent = formatMinutes(todayProgress?.study_minutes || 0);
    $("#metric-time-caption").textContent = todayProgress ? "Focused time recorded" : "Log time to track consistency";
    $("#metric-streak").textContent = streak;
    $("#metric-streak-caption").textContent = streak ? `${streak} day${streak === 1 ? "" : "s"} of momentum` : "A note or log keeps it alive";
    renderTopicBreakdown();
    renderRecentNotes();
    renderHeatmap();
    renderDashboardChart();
  }

  function renderDashboardChart() {
    window.ExamCharts.renderDashboard(state.notes, state.progress, $("#dashboard-chart-metric").value);
  }

  function renderTopicBreakdown() {
    const counts = new Map();
    state.notes.forEach(note => (note.topics || []).forEach(topic => counts.set(topic, (counts.get(topic) || 0) + 1)));
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const target = $("#topic-breakdown");
    if (!rows.length) {
      target.className = "topic-breakdown empty-state-mini";
      target.textContent = "Add notes to see your topic balance.";
      return;
    }
    target.className = "topic-breakdown";
    const max = rows[0][1];
    target.innerHTML = rows.map(([topic, count]) => `<div class="topic-row"><span title="${escapeHtml(topic)}">${escapeHtml(topic)}</span><span class="topic-bar"><i style="width:${Math.round(count / max * 100)}%"></i></span><strong>${count}</strong></div>`).join("");
  }

  function renderRecentNotes() {
    const target = $("#recent-notes");
    const notes = state.notes.slice(0, 4);
    if (!notes.length) {
      target.innerHTML = `<div class="empty-state-mini">Your newest notes will appear here.</div>`;
      return;
    }
    target.innerHTML = notes.map(note => `<div class="recent-item" data-note-id="${escapeHtml(note.id)}"><span class="recent-symbol">${escapeHtml((note.topics?.[0] || note.title || "N")[0].toUpperCase())}</span><span class="recent-copy"><strong>${escapeHtml(note.title || "Untitled")}</strong><small>${escapeHtml(note.question_id || note.topics?.[0] || "Uncategorised")} · ${relativeDate(note.updated_at)}</small></span><i data-lucide="chevron-right"></i></div>`).join("");
  }

  function renderHeatmap() {
    const activity = new Map();
    state.notes.forEach(note => {
      const key = window.ExamCharts.localDateKey(new Date(note.created_at));
      activity.set(key, (activity.get(key) || 0) + 2);
    });
    state.progress.forEach(entry => {
      const amount = Number(entry.questions_solved || 0) + Math.ceil(Number(entry.study_minutes || 0) / 30);
      activity.set(entry.log_date, (activity.get(entry.log_date) || 0) + amount);
    });
    const cells = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 83; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = window.ExamCharts.localDateKey(date);
      const value = activity.get(key) || 0;
      const level = value === 0 ? 0 : value < 3 ? 1 : value < 6 ? 2 : value < 11 ? 3 : 4;
      cells.push(`<span class="heat-cell" data-level="${level}" data-label="${escapeHtml(date.toLocaleDateString(undefined, { month: "short", day: "numeric" }))}: ${value} activity points"></span>`);
    }
    $("#activity-heatmap").innerHTML = cells.join("");
  }

  function collectNoteForm() {
    return {
      id: $("#note-id").value || null,
      title: $("#note-title").value.trim(),
      question_id: $("#note-question-id").value.trim(),
      exam: $("#note-exam").value.trim(),
      year: $("#note-year").value ? Number($("#note-year").value) : null,
      topics: parseTopics($("#note-topics").value),
      difficulty: $("#note-difficulty").value,
      status: $("#note-status").value,
      body: $("#note-body").value.trim(),
      key_insight: $("#note-insight").value.trim(),
      traps: $("#note-traps").value.trim(),
      formulas: $("#note-formulas").value.trim(),
      refs: $("#note-references").value.trim(),
      related_note_ids: [...state.selectedRelated]
    };
  }

  function clearNoteForm() {
    $("#note-form").reset();
    $("#note-id").value = "";
    $("#note-difficulty").value = "medium";
    $("#note-status").value = "understood";
    $("#note-form-title").textContent = "Add a question note";
    $("#save-note-button").innerHTML = `<i data-lucide="save"></i> Save note`;
    state.selectedRelated.clear();
    renderRelatedOptions();
    window.lucide?.createIcons();
  }

  function editNote(id) {
    const note = state.notes.find(item => item.id === id);
    if (!note) return;
    $("#note-id").value = note.id;
    $("#note-title").value = note.title;
    $("#note-question-id").value = note.question_id;
    $("#note-exam").value = note.exam;
    $("#note-year").value = note.year || "";
    $("#note-topics").value = note.topics.join(", ");
    $("#note-difficulty").value = note.difficulty;
    $("#note-status").value = note.status;
    $("#note-body").value = note.body;
    $("#note-insight").value = note.key_insight;
    $("#note-traps").value = note.traps;
    $("#note-formulas").value = note.formulas;
    $("#note-references").value = note.refs;
    state.selectedRelated = new Set(note.related_note_ids || []);
    $("#note-form-title").textContent = "Edit question note";
    $("#save-note-button").innerHTML = `<i data-lucide="save"></i> Update note`;
    renderRelatedOptions();
    $("#note-dialog").close();
    switchView("add-note");
    window.lucide?.createIcons();
  }

  function renderRelatedOptions() {
    const query = ($("#related-note-search")?.value || "").toLowerCase();
    const currentId = $("#note-id")?.value;
    const available = state.notes.filter(note => note.id !== currentId && `${note.title} ${note.question_id} ${note.topics.join(" ")}`.toLowerCase().includes(query)).slice(0, 30);
    const target = $("#related-note-options");
    if (!target) return;
    target.innerHTML = available.length ? available.map(note => `<label class="related-option"><input type="checkbox" value="${escapeHtml(note.id)}" ${state.selectedRelated.has(note.id) ? "checked" : ""} /><span>${escapeHtml(note.title || "Untitled")}</span></label>`).join("") : `<span class="subtle">No matching notes yet.</span>`;
  }

  function filteredNotes() {
    const rawQuery = $("#library-search").value.trim().toLowerCase();
    const query = { topic: "", qid: "", title: "", exam: "", plain: [] };
    rawQuery.split(/\s+/).filter(Boolean).forEach(token => {
      const separator = token.indexOf(":");
      const key = separator > 0 ? token.slice(0, separator) : "";
      const value = separator > 0 ? token.slice(separator + 1) : "";
      if (["topic", "qid", "title", "exam"].includes(key) && value) query[key] = value;
      else query.plain.push(token);
    });
    const term = query.plain.join(" ");
    const topic = $("#filter-topic").value.toLowerCase();
    const status = $("#filter-status").value;
    const sorted = state.notes.filter(note => {
      const haystack = [note.title, note.question_id, note.exam, note.body, note.key_insight, note.traps, note.formulas, ...(note.topics || [])].join(" ").toLowerCase();
      return (!term || haystack.includes(term))
        && (!query.topic || note.topics.some(t => t.toLowerCase().includes(query.topic)))
        && (!query.qid || note.question_id.toLowerCase().includes(query.qid))
        && (!query.title || note.title.toLowerCase().includes(query.title))
        && (!query.exam || note.exam.toLowerCase().includes(query.exam))
        && (!topic || note.topics.some(t => t.toLowerCase() === topic))
        && (!status || note.status === status);
    });
    const sort = $("#sort-notes").value;
    sorted.sort((a, b) => sort === "oldest" ? new Date(a.updated_at) - new Date(b.updated_at) : sort === "title" ? a.title.localeCompare(b.title) : new Date(b.updated_at) - new Date(a.updated_at));
    return sorted;
  }

  function renderLibrary() {
    const topicSelect = $("#filter-topic");
    const previous = topicSelect.value;
    const topics = [...new Set(state.notes.flatMap(n => n.topics || []))].sort((a, b) => a.localeCompare(b));
    topicSelect.innerHTML = `<option value="">All topics</option>${topics.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}`;
    topicSelect.value = topics.includes(previous) ? previous : "";
    renderNotesGrid();
  }

  function renderNotesGrid() {
    const notes = filteredNotes();
    $("#library-count").textContent = `${notes.length} note${notes.length === 1 ? "" : "s"}`;
    const filters = [];
    if ($("#library-search").value) filters.push(`Search: ${$("#library-search").value}`);
    if ($("#filter-topic").value) filters.push($("#filter-topic").value);
    if ($("#filter-status").value) filters.push($("#filter-status").selectedOptions[0].textContent);
    $("#active-filters").innerHTML = filters.map(f => `<span class="filter-chip">${escapeHtml(f)}</span>`).join("");
    const target = $("#notes-grid");
    if (!notes.length) {
      target.innerHTML = `<div class="notes-empty"><i data-lucide="book-dashed"></i><h3>${state.notes.length ? "No notes match" : "Build your first connection"}</h3><p>${state.notes.length ? "Try a wider search or remove a filter." : "Capture an approach, tag its topics, and watch your atlas grow."}</p>${state.notes.length ? "" : `<button class="button primary" data-go="add-note"><i data-lucide="plus"></i> Add a note</button>`}</div>`;
      bindGoButtons();
      window.lucide?.createIcons();
      return;
    }
    target.innerHTML = notes.map(note => `<article class="note-card" data-note-id="${escapeHtml(note.id)}"><div class="note-card-top"><span class="status-dot ${escapeHtml(note.status)}"></span><small>${escapeHtml(note.status === "review" ? "Needs review" : note.status)}</small><button class="icon-btn note-menu" aria-label="Open note"><i data-lucide="more-horizontal"></i></button></div><h3>${escapeHtml(note.title || "Untitled")}</h3><p>${escapeHtml(note.key_insight || note.body || "No approach added yet.")}</p><div class="chip-row">${(note.topics || []).slice(0, 3).map(t => `<span class="topic-chip">${escapeHtml(t)}</span>`).join("")}${note.topics.length > 3 ? `<span class="topic-chip">+${note.topics.length - 3}</span>` : ""}</div><div class="note-card-footer"><span>${escapeHtml(note.question_id || note.exam || "No question ID")}</span><span>${relativeDate(note.updated_at)}</span></div></article>`).join("");
    window.lucide?.createIcons();
  }

  function showNote(id) {
    const note = state.notes.find(item => item.id === id);
    if (!note) return;
    state.currentDialogNote = note;
    $("#dialog-meta").textContent = [note.question_id, note.exam, note.year].filter(Boolean).join(" · ") || "Question note";
    $("#dialog-title").textContent = note.title || "Untitled";
    const sections = [
      ["Topics", `<div class="chip-row">${note.topics.map(t => `<span class="topic-chip">${escapeHtml(t)}</span>`).join("") || `<span class="subtle">No topics</span>`}</div>`],
      ["Approach / solution path", `<p>${escapeHtml(note.body || "No approach recorded.")}</p>`],
      ["Key insight", `<p>${escapeHtml(note.key_insight || "—")}</p>`],
      ["Traps & mistakes", `<p>${escapeHtml(note.traps || "—")}</p>`],
      ["Formulae / shortcuts", `<p>${escapeHtml(note.formulas || "—")}</p>`],
      ["References", `<p>${linkify(note.refs || "—")}</p>`]
    ];
    $("#dialog-content").innerHTML = sections.map(([title, content]) => `<section class="dialog-section"><h4>${title}</h4>${content}</section>`).join("");
    $("#note-dialog").showModal();
  }

  function linkify(value) {
    const safe = escapeHtml(value);
    return safe.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--teal)">$1</a>');
  }

  function formatMinutes(minutes) {
    const total = Number(minutes || 0);
    if (total < 60) return `${total}m`;
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return `${hours}h${mins ? ` ${mins}m` : ""}`;
  }

  function recentWindow(days) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (days - 1));
    const logs = state.progress.filter(p => new Date(`${p.log_date}T12:00:00`) >= cutoff);
    const notes = state.notes.filter(n => new Date(n.created_at) >= cutoff);
    return { logs, notes };
  }

  function renderProgress() {
    const week = recentWindow(7);
    $("#progress-total-questions").textContent = week.logs.reduce((sum, item) => sum + item.questions_solved, 0);
    $("#progress-total-hours").textContent = formatMinutes(week.logs.reduce((sum, item) => sum + item.study_minutes, 0));
    $("#progress-total-notes").textContent = week.notes.length;
    renderProgressHistory();
    renderProgressCharts();
  }

  function renderProgressCharts() {
    window.ExamCharts.renderProgress(state.notes, state.progress, Number($("#progress-range").value));
  }

  function renderProgressHistory() {
    const target = $("#progress-history");
    if (!state.progress.length) {
      target.innerHTML = `<div class="empty-state-mini">No daily check-ins yet. Log today to begin the trend.</div>`;
      return;
    }
    target.innerHTML = `<table class="data-table"><thead><tr><th>Date</th><th>Questions</th><th>Study time</th><th>Reflection</th><th></th></tr></thead><tbody>${state.progress.slice(0, 20).map(item => `<tr><td>${formatShortDate(item.log_date)}</td><td>${item.questions_solved}</td><td>${formatMinutes(item.study_minutes)}</td><td>${escapeHtml(item.reflection || "—")}</td><td><button class="table-action" data-delete-progress="${item.id}" aria-label="Delete log"><i data-lucide="trash-2"></i></button></td></tr>`).join("")}</tbody></table>`;
    window.lucide?.createIcons();
  }

  function downloadBackup(onlyNotes = false) {
    const payload = {
      format: "exam-atlas-backup",
      version: 1,
      exported_at: new Date().toISOString(),
      notes: state.notes,
      ...(onlyNotes ? {} : { progress: state.progress })
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `exam-atlas-${onlyNotes ? "notes" : "backup"}-${todayKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast(`${onlyNotes ? "Notes" : "Complete backup"} exported.`);
  }

  function confirmAction(title, message, acceptLabel = "Delete") {
    return new Promise(resolve => {
      const dialog = $("#confirm-dialog");
      $("#confirm-title").textContent = title;
      $("#confirm-message").textContent = message;
      $("#confirm-accept").textContent = acceptLabel;
      dialog.showModal();
      const finish = value => { dialog.close(); cleanup(); resolve(value); };
      const accept = () => finish(true);
      const cancel = () => finish(false);
      const escapeCancel = event => { event.preventDefault(); finish(false); };
      const cleanup = () => {
        $("#confirm-accept").removeEventListener("click", accept);
        $("#confirm-cancel").removeEventListener("click", cancel);
        dialog.removeEventListener("cancel", escapeCancel);
      };
      $("#confirm-accept").addEventListener("click", accept);
      $("#confirm-cancel").addEventListener("click", cancel);
      dialog.addEventListener("cancel", escapeCancel);
    });
  }

  function bindGoButtons() {
    $$('[data-go]').forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        const target = button.dataset.go;
        if (target === "add-note") clearNoteForm();
        switchView(target);
      });
    });
  }

  function bindEvents() {
    $$(".auth-tab").forEach(tab => tab.addEventListener("click", () => {
      setAuthMode(tab.dataset.authMode);
    }));

    $("#toggle-password").addEventListener("click", () => {
      const input = $("#auth-password");
      input.type = input.type === "password" ? "text" : "password";
    });

    $("#auth-form").addEventListener("submit", async event => {
      event.preventDefault();
      const button = $("#auth-submit");
      const email = $("#auth-email").value.trim();
      const password = $("#auth-password").value;
      setBusy(button, true, state.authMode === "signup" ? "Creating…" : state.authMode === "recovery" ? "Updating…" : "Signing in…");
      try {
        if (state.authMode === "recovery") {
          await API.updatePassword(password);
          toast("Your password has been updated.");
          const user = state.recoveryUser;
          state.recoveryUser = null;
          if (user) await showApp(user);
          setAuthMode("login");
        } else if (state.authMode === "signup") {
          const result = await API.signUp(email, password);
          if (!result.session) toast("Account created. Check your email to confirm it, then sign in.");
          else await showApp(result.user);
        } else {
          const result = await API.signIn(email, password);
          await showApp(result.user);
        }
      } catch (error) {
        toast(error.message || "Could not access your account.", "error");
      } finally { setBusy(button, false); }
    });

    $("#forgot-password").addEventListener("click", async () => {
      const email = $("#auth-email").value.trim();
      if (!email) return toast("Enter your email address first.", "error");
      try { await API.resetPassword(email); toast("Password reset link sent. Check your email."); }
      catch (error) { toast(error.message, "error"); }
    });

    $("#logout-button").addEventListener("click", async () => {
      try { await API.signOut(); showAuth(); }
      catch (error) { toast(error.message, "error"); }
    });

    $$(".nav-item").forEach(item => item.addEventListener("click", () => switchView(item.dataset.view)));
    bindGoButtons();
    $("#open-sidebar").addEventListener("click", () => { $(".sidebar").classList.add("open"); $("#sidebar-scrim").classList.add("open"); });
    $("#close-sidebar").addEventListener("click", () => { $(".sidebar").classList.remove("open"); $("#sidebar-scrim").classList.remove("open"); });
    $("#sidebar-scrim").addEventListener("click", () => { $(".sidebar").classList.remove("open"); $("#sidebar-scrim").classList.remove("open"); });

    $("#dashboard-chart-metric").addEventListener("change", renderDashboardChart);
    $("#clear-note-form").addEventListener("click", clearNoteForm);
    $("#related-note-search").addEventListener("input", renderRelatedOptions);
    $("#related-note-options").addEventListener("change", event => {
      if (!event.target.matches('input[type="checkbox"]')) return;
      if (event.target.checked) state.selectedRelated.add(event.target.value);
      else state.selectedRelated.delete(event.target.value);
    });

    $("#note-form").addEventListener("submit", async event => {
      event.preventDefault();
      const note = collectNoteForm();
      if (!note.title || !note.body) return toast("A title and approach are required.", "error");
      const button = $("#save-note-button");
      setBusy(button, true, note.id ? "Updating…" : "Saving…");
      try {
        const saved = await API.saveNote(note, state.user.id);
        const index = state.notes.findIndex(item => item.id === saved.id);
        if (index >= 0) state.notes[index] = saved; else state.notes.unshift(saved);
        toast(note.id ? "Note updated." : "Note added to your atlas.");
        clearNoteForm();
        renderAll();
        switchView("library");
      } catch (error) { toast(error.message || "Could not save the note.", "error"); }
      finally { setBusy(button, false); }
    });

    document.addEventListener("keydown", event => {
      const tag = document.activeElement?.tagName;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && state.activeView === "add-note") {
        event.preventDefault();
        $("#note-form").requestSubmit();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        $("#global-search").focus();
      }
      if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "n" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        clearNoteForm(); switchView("add-note");
      }
    });

    ["#library-search", "#filter-topic", "#filter-status", "#sort-notes"].forEach(selector => $(selector).addEventListener(selector.includes("search") ? "input" : "change", renderNotesGrid));
    $("#global-search").addEventListener("input", event => {
      $("#library-search").value = event.target.value;
      switchView("library", { keepScroll: true });
      renderNotesGrid();
    });
    $("#notes-grid").addEventListener("click", event => {
      const card = event.target.closest("[data-note-id]");
      if (card) showNote(card.dataset.noteId);
    });
    $("#recent-notes").addEventListener("click", event => {
      const row = event.target.closest("[data-note-id]");
      if (row) showNote(row.dataset.noteId);
    });
    window.addEventListener("exam-atlas:open-note", event => showNote(event.detail));
    $("#close-note-dialog").addEventListener("click", () => $("#note-dialog").close());
    $("#dialog-edit").addEventListener("click", () => state.currentDialogNote && editNote(state.currentDialogNote.id));
    $("#dialog-delete").addEventListener("click", async () => {
      const note = state.currentDialogNote;
      if (!note) return;
      $("#note-dialog").close();
      if (!await confirmAction("Delete this note?", `“${note.title}” will be permanently removed along with its graph connections.`)) return;
      try { await API.deleteNote(note.id); state.notes = state.notes.filter(n => n.id !== note.id); renderAll(); toast("Note deleted."); }
      catch (error) { toast(error.message, "error"); }
    });

    $("#graph-mode").addEventListener("change", event => window.ExamGraph.render(state.notes, event.target.value));
    $("#graph-search").addEventListener("input", event => window.ExamGraph.search(event.target.value));
    $("#reset-graph").addEventListener("click", () => window.ExamGraph.render(state.notes, $("#graph-mode").value));

    $("#open-log-form").addEventListener("click", () => $("#progress-form-panel").classList.add("open"));
    $("#close-log-form").addEventListener("click", () => $("#progress-form-panel").classList.remove("open"));
    $("#progress-form").addEventListener("submit", async event => {
      event.preventDefault();
      const button = event.submitter;
      const entry = { log_date: $("#progress-date").value, questions_solved: $("#progress-questions").value, study_minutes: $("#progress-minutes").value, reflection: $("#progress-reflection").value.trim() };
      setBusy(button, true, "Saving…");
      try {
        const saved = await API.saveProgress(entry, state.user.id);
        const index = state.progress.findIndex(p => p.log_date === saved.log_date);
        if (index >= 0) state.progress[index] = saved; else state.progress.unshift(saved);
        state.progress.sort((a, b) => b.log_date.localeCompare(a.log_date));
        renderAll();
        $("#progress-form-panel").classList.remove("open");
        toast("Daily progress saved.");
      } catch (error) { toast(error.message, "error"); }
      finally { setBusy(button, false); }
    });
    $("#progress-range").addEventListener("change", renderProgressCharts);
    $("#progress-date").addEventListener("change", event => {
      const existing = state.progress.find(item => item.log_date === event.target.value);
      $("#progress-questions").value = existing?.questions_solved ?? 0;
      $("#progress-minutes").value = existing?.study_minutes ?? 0;
      $("#progress-reflection").value = existing?.reflection ?? "";
    });
    $("#progress-history").addEventListener("click", async event => {
      const button = event.target.closest("[data-delete-progress]");
      if (!button) return;
      if (!await confirmAction("Delete this check-in?", "The daily progress entry will be permanently removed.")) return;
      try { await API.deleteProgress(button.dataset.deleteProgress); state.progress = state.progress.filter(p => String(p.id) !== String(button.dataset.deleteProgress)); renderAll(); toast("Progress entry deleted."); }
      catch (error) { toast(error.message, "error"); }
    });

    $("#export-notes-button").addEventListener("click", () => downloadBackup(true));
    $("#export-all-button").addEventListener("click", () => downloadBackup(false));
    $("#import-button").addEventListener("click", () => $("#import-file").click());
    $("#import-file").addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const backup = JSON.parse(await file.text());
        if (!Array.isArray(backup.notes) && !Array.isArray(backup.progress) && !Array.isArray(backup.study_logs)) throw new Error("This file does not look like an Exam Atlas backup.");
        const result = await API.importBackup(backup, state.user.id);
        await loadData();
        toast(`Imported ${result.notes} notes and ${result.progress} progress entries.`);
      } catch (error) { toast(error.message || "Could not import this JSON file.", "error"); }
      event.target.value = "";
    });
    $("#delete-all-button").addEventListener("click", async () => {
      if (!await confirmAction("Delete everything?", "All notes, links, and progress entries in your account will be permanently deleted. Export a backup first if you may need them.", "Delete everything")) return;
      try { await API.deleteEverything(state.user.id); state.notes = []; state.progress = []; renderAll(); toast("All account data was deleted."); }
      catch (error) { toast(error.message, "error"); }
    });
  }

  async function init() {
    window.lucide?.createIcons();
    if (!API) {
      const message = window.EXAM_ATLAS_STARTUP_ERROR || "Exam Atlas could not start its account service. Reload the page and try again.";
      $("#auth-submit").disabled = true;
      $("#auth-submit").textContent = "Account service unavailable";
      toast(message, "error");
      return;
    }
    bindEvents();
    API.onAuthChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        state.recoveryUser = session.user;
        showAuth();
        setAuthMode("recovery");
        return;
      }
      if (event === "SIGNED_OUT") showAuth();
      if (event === "SIGNED_IN" && session?.user && state.authMode !== "recovery" && state.user?.id !== session.user.id) showApp(session.user);
    });
    const hashView = window.location.hash.replace("#", "");
    if (viewMeta[hashView]) state.activeView = hashView;
    try {
      const session = await API.getSession();
      if (session?.user) {
        await showApp(session.user);
        switchView(state.activeView, { keepScroll: true });
      } else showAuth();
    } catch (error) {
      console.error(error);
      toast("Could not connect to the account service. Check your connection.", "error");
      showAuth();
    }
  }

  init();
})();
