(function () {
  "use strict";

  let simulation = null;
  let resizeObserver = null;
  let currentNotes = [];
  let currentMode = "topics";
  let searchTerm = "";

  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function truncate(text, length = 24) {
    const clean = String(text || "Untitled");
    return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
  }

  function buildData(notes, mode) {
    const visibleNotes = notes.slice(0, 250);
    const noteIds = new Set(visibleNotes.map(n => n.id));
    const nodes = visibleNotes.map(note => ({
      id: note.id, type: "note", label: note.title || "Untitled", note,
      radius: 10 + Math.min((note.topics || []).length, 5)
    }));
    const links = [];
    const seenLinks = new Set();
    const addLink = (source, target, type) => {
      if (!source || !target || source === target) return;
      const key = [source, target].sort().join("::");
      if (seenLinks.has(key)) return;
      seenLinks.add(key);
      links.push({ source, target, type });
    };

    visibleNotes.forEach(note => {
      (note.related_note_ids || []).forEach(id => {
        if (noteIds.has(id)) addLink(note.id, id, "explicit");
      });
    });

    if (mode === "topics") {
      const topics = new Map();
      visibleNotes.forEach(note => (note.topics || []).forEach(topic => {
        const cleaned = String(topic).trim();
        if (!cleaned) return;
        const key = `topic:${cleaned.toLowerCase()}`;
        if (!topics.has(key)) topics.set(key, { id: key, type: "topic", label: cleaned, count: 0, radius: 8 });
        topics.get(key).count += 1;
        addLink(note.id, key, "topic");
      }));
      topics.forEach(topic => {
        topic.radius = 8 + Math.min(topic.count * 1.5, 11);
        nodes.push(topic);
      });
    } else {
      const topicBuckets = new Map();
      visibleNotes.forEach(note => (note.topics || []).forEach(topic => {
        const key = String(topic).trim().toLowerCase();
        if (!key) return;
        if (!topicBuckets.has(key)) topicBuckets.set(key, []);
        topicBuckets.get(key).push(note.id);
      }));
      topicBuckets.forEach(ids => {
        if (ids.length < 2) return;
        for (let i = 1; i < Math.min(ids.length, 8); i += 1) addLink(ids[i - 1], ids[i], "shared-topic");
      });
    }
    return { nodes, links };
  }

  function connectedIds(node, links) {
    const set = new Set([node.id]);
    links.forEach(link => {
      const source = typeof link.source === "object" ? link.source.id : link.source;
      const target = typeof link.target === "object" ? link.target.id : link.target;
      if (source === node.id) set.add(target);
      if (target === node.id) set.add(source);
    });
    return set;
  }

  function render(notes = currentNotes, mode = currentMode) {
    currentNotes = notes;
    currentMode = mode;
    const container = document.getElementById("graph-canvas");
    const svgEl = document.getElementById("knowledge-graph");
    const empty = document.getElementById("graph-empty");
    if (!container || !svgEl || !window.d3) return;

    const { nodes, links } = buildData(notes, mode);
    empty?.classList.toggle("hidden", nodes.length > 0);
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 560;
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("viewBox", [0, 0, width, height]);
    if (!nodes.length) return;

    const root = svg.append("g");
    svg.call(d3.zoom().scaleExtent([.25, 4]).on("zoom", event => root.attr("transform", event.transform)));
    const link = root.append("g").selectAll("line").data(links).join("line")
      .attr("class", d => `graph-link ${d.type === "explicit" ? "explicit" : ""}`);
    const node = root.append("g").selectAll("g").data(nodes).join("g")
      .attr("class", d => `graph-node ${d.type}`)
      .style("cursor", d => d.type === "note" ? "pointer" : "default");
    node.append("circle").attr("r", d => d.radius);
    node.append("text").attr("text-anchor", "middle").attr("dy", d => d.radius + 13).text(d => truncate(d.label));

    const tooltip = document.getElementById("graph-tooltip");
    node.on("mouseenter", function (event, d) {
      const neighbors = connectedIds(d, links);
      node.classed("dimmed", item => !neighbors.has(item.id)).classed("highlighted", item => neighbors.has(item.id));
      link.classed("dimmed", item => {
        const source = typeof item.source === "object" ? item.source.id : item.source;
        const target = typeof item.target === "object" ? item.target.id : item.target;
        return source !== d.id && target !== d.id;
      });
      d3.select(this).select("circle").transition().duration(150).attr("r", d.radius * 1.45);
      if (tooltip) {
        const detail = d.type === "note"
          ? `<strong>${escapeHtml(d.label)}</strong><div class="chip-row">${(d.note.topics || []).slice(0, 4).map(t => `<span class="topic-chip">${escapeHtml(t)}</span>`).join("")}</div><p>${escapeHtml(d.note.key_insight || d.note.body || "Open this note to see the complete approach.")}</p>`
          : `<strong>${escapeHtml(d.label)}</strong><p>${d.count} connected note${d.count === 1 ? "" : "s"}</p>`;
        tooltip.innerHTML = detail;
        tooltip.classList.remove("hidden");
        const rect = container.getBoundingClientRect();
        const x = Math.min(event.clientX - rect.left + 15, rect.width - 265);
        const y = Math.min(event.clientY - rect.top + 15, rect.height - 155);
        tooltip.style.left = `${Math.max(10, x)}px`;
        tooltip.style.top = `${Math.max(10, y)}px`;
      }
    }).on("mousemove", function (event) {
      if (!tooltip) return;
      const rect = container.getBoundingClientRect();
      tooltip.style.left = `${Math.max(10, Math.min(event.clientX - rect.left + 15, rect.width - 265))}px`;
      tooltip.style.top = `${Math.max(10, Math.min(event.clientY - rect.top + 15, rect.height - 155))}px`;
    }).on("mouseleave", function (_event, d) {
      node.classed("dimmed", false).classed("highlighted", false);
      link.classed("dimmed", false);
      d3.select(this).select("circle").transition().duration(150).attr("r", d.radius);
      tooltip?.classList.add("hidden");
      applySearch(node);
    }).on("click", (_event, d) => {
      if (d.type === "note") window.dispatchEvent(new CustomEvent("exam-atlas:open-note", { detail: d.note.id }));
    });

    const drag = d3.drag()
      .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(.25).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; });
    node.call(drag);

    if (simulation) simulation.stop();
    simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(d => d.type === "topic" ? 65 : 100).strength(.42))
      .force("charge", d3.forceManyBody().strength(d => d.type === "topic" ? -115 : -160))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => d.radius + 22))
      .on("tick", () => {
        link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
      });
    applySearch(node);

    if (!resizeObserver && window.ResizeObserver) {
      let timer;
      resizeObserver = new ResizeObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => render(currentNotes, currentMode), 180);
      });
      resizeObserver.observe(container);
    }
  }

  function applySearch(selection) {
    if (!selection) return;
    const term = searchTerm.trim().toLowerCase();
    selection.classed("dimmed", d => term && !d.label.toLowerCase().includes(term))
      .classed("highlighted", d => term && d.label.toLowerCase().includes(term));
  }

  function search(term) {
    searchTerm = term || "";
    const selection = d3.select("#knowledge-graph").selectAll(".graph-node");
    applySearch(selection);
  }

  window.ExamGraph = { render, search };
})();
