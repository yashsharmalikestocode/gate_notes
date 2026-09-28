(function () {
  "use strict";

  const instances = {};
  const gridColor = "rgba(194, 221, 215, 0.07)";
  const tickColor = "#65727d";

  function destroy(name) {
    if (instances[name]) instances[name].destroy();
  }

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateSeries(days) {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      result.push({
        key: localDateKey(date),
        label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      });
    }
    return result;
  }

  function aggregate(notes, progress, days) {
    const dates = dateSeries(days);
    const map = new Map(dates.map(d => [d.key, { ...d, notes: 0, questions: 0, minutes: 0 }]));
    notes.forEach(note => {
      if (!note.created_at) return;
      const key = localDateKey(new Date(note.created_at));
      if (map.has(key)) map.get(key).notes += 1;
    });
    progress.forEach(entry => {
      if (!map.has(entry.log_date)) return;
      const item = map.get(entry.log_date);
      item.questions += Number(entry.questions_solved || 0);
      item.minutes += Number(entry.study_minutes || 0);
    });
    return [...map.values()];
  }

  function sharedOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(8, 13, 18, .96)",
          borderColor: "rgba(194, 221, 215, .14)",
          borderWidth: 1,
          titleColor: "#edf4f2",
          bodyColor: "#9aa8b1",
          padding: 11,
          cornerRadius: 9
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, border: { display: false } },
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 9 }, precision: 0 }, border: { display: false } }
      }
    };
  }

  function renderDashboard(notes, progress, metric) {
    const canvas = document.getElementById("dashboard-chart");
    if (!canvas || !window.Chart) return;
    destroy("dashboard");
    const rows = aggregate(notes, progress, 14);
    const colors = { questions: ["#54d4bc", "rgba(84,212,188,.13)"], notes: ["#68a8ff", "rgba(104,168,255,.13)"], minutes: ["#ac91ff", "rgba(172,145,255,.13)"] };
    const labels = { questions: "Questions", notes: "Notes", minutes: "Minutes" };
    instances.dashboard = new Chart(canvas, {
      type: "line",
      data: {
        labels: rows.map(r => r.label),
        datasets: [{
          label: labels[metric], data: rows.map(r => r[metric]), borderColor: colors[metric][0],
          backgroundColor: colors[metric][1], fill: true, tension: .38, pointRadius: 2.5,
          pointHoverRadius: 5, pointBackgroundColor: colors[metric][0], borderWidth: 2
        }]
      },
      options: sharedOptions()
    });
  }

  function renderProgress(notes, progress, days) {
    const rows = aggregate(notes, progress, days);
    const labels = rows.map(r => r.label);
    destroy("output");
    destroy("time");
    const output = document.getElementById("output-chart");
    const time = document.getElementById("time-chart");
    if (!output || !time || !window.Chart) return;

    const outputOptions = sharedOptions();
    outputOptions.plugins.legend = { display: true, position: "bottom", labels: { color: tickColor, boxWidth: 9, boxHeight: 9, usePointStyle: true, font: { size: 9 }, padding: 18 } };
    instances.output = new Chart(output, {
      type: "bar",
      data: { labels, datasets: [
        { label: "Questions", data: rows.map(r => r.questions), backgroundColor: "rgba(84,212,188,.72)", borderRadius: 5, maxBarThickness: 22 },
        { label: "Notes", data: rows.map(r => r.notes), backgroundColor: "rgba(104,168,255,.72)", borderRadius: 5, maxBarThickness: 22 }
      ] },
      options: outputOptions
    });

    instances.time = new Chart(time, {
      type: "line",
      data: { labels, datasets: [{ label: "Minutes", data: rows.map(r => r.minutes), borderColor: "#ac91ff", backgroundColor: "rgba(172,145,255,.12)", fill: true, tension: .38, pointRadius: 2, borderWidth: 2 }] },
      options: sharedOptions()
    });
  }

  window.ExamCharts = { aggregate, renderDashboard, renderProgress, localDateKey };
})();
