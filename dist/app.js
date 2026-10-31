import {
  parseCSV,
  parseJSON,
  generateData
} from './engine.js';
import {
  registrationsCSV,
  calendarSlots,
  scheduleJSON,
  calendarICS,
  htmlReport,
  timetableCSV
} from './exporters.js';

const paths = {
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2 M8 18h2',
  graph: 'M7 6l10 1 M6 8l5 10 M18 9l-5 9 M4 4h4v4H4z M16 5h4v4h-4z M10 17h4v4h-4z',
  chart: 'M4 20h17 M7 16v-5 M12 16V5 M17 16V8',
  users: 'M15 21v-3a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v3 M17 14a4 4 0 0 1 4 4v3 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7',
  book: 'M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z M12 6v15',
  upload: 'M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6',
  download: 'M12 3v13 M7 11l5 5 5-5 M4 16v5h16v-5',
  chevron: 'M7 10l5 5 5-5',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  play: 'M8 4l13 8-13 8z',
  layers: 'M12 3l10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5',
  check: 'M5 12l4 4L19 6',
  shield: 'M12 2l9 4v6c0 6-9 10-9 10S3 18 3 12V6z M8 12l3 3 5-6',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  close: 'M6 6l12 12 M18 6L6 18',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  clock: 'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  courses: 'M4 3h13v18H4z M8 7h5 M8 11h5 M8 15h3 M17 6h3v15h-3',
  spark: 'M12 3l2 6 7 3-7 2-2 7-2-7-7-2 7-3z'
};
const icon = name => `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name]||paths.check}"/></svg>`;

function icons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon);
  });
}
const $ = id => document.getElementById(id),
  esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  } [c]));
const palette = ['#f4d442', '#b4c4d0', '#e7a874', '#a6c69a', '#cfb1e2', '#81c9c2', '#e7aaa9', '#c2c879', '#adc0ef', '#d3b995', '#a7d2b5', '#e3b8d4', '#c3c3ae', '#c1a7ef', '#edc078'];
const color = i => palette[i % palette.length],
  tint = i => color(i) + '13',
  sty = i => `--slot:${color(i)};--tint:${tint(i)}`;
const titles = {
  timetable: ['Outsmart exam week.', 'Every course in its place. Every student free of clashes.', 'Exam timetable'],
  graph: ['See every connection.', 'One shared student. One edge. One constraint to respect.', 'Conflict graph'],
  compare: ['Better, by comparison.', 'Explore the trade-off between speed, slots and proof.', 'Compare algorithms'],
  data: ['Start with the students.', 'Transparent registrations. Personal timetables. Clear data.', 'Students & data'],
  learn: ['The theory behind the calm.', 'A real application of sets, relations and graph coloring.', 'The mathematics']
};
let data = generateData(),
  result = null,
  comparison = null,
  tab = 'timetable',
  datasetName = 'Computer Engineering',
  datasetOrigin = 'Demo · seed 42',
  selectedCourse = null,
  source = 'upload',
  busy = false;
let settings = {
  startDate: '2026-11-02',
  slotsPerDay: 3,
  duration: 120,
  skipWeekends: true,
  optimize: true
};
let courseFilter = '';
// Store calendar preferences only. Student registrations are never persisted.
try {
 const saved = JSON.parse(localStorage.getItem('examcraft.calendar.v1') || 'null');
 if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved.startDate) && Number.isFinite(Date.parse(saved.startDate)) && +saved.startDate.slice(0,4)>=1900 && +saved.startDate.slice(0,4)<=2100 && [2,3,4].includes(saved.slotsPerDay) && [60,90,120].includes(saved.duration) && typeof saved.skipWeekends==='boolean' && typeof saved.optimize==='boolean') settings = saved;
} catch { /* Storage may be unavailable or contain invalid preferences. */ }
function syncSettingsForm() {
 $('start-date').value=settings.startDate;
 $('slots-per-day').value=settings.slotsPerDay;
 $('duration').value=settings.duration;
 $('skip-weekends').checked=settings.skipWeekends;
 $('optimize-gaps').checked=settings.optimize;
}
function filterTimetable() {
 const query = courseFilter.trim().toLocaleLowerCase();
 let count=0;
 document.querySelectorAll('#view-timetable .exam-row').forEach(row => {
  row.hidden = !row.textContent.toLocaleLowerCase().includes(query);
  if(!row.hidden) count++;
 });
 document.querySelectorAll('#view-timetable .slot-card').forEach(card => card.hidden = ![...card.querySelectorAll('.exam-row')].some(row=>!row.hidden));
 document.querySelectorAll('#view-timetable .day-group').forEach(day => day.hidden = ![...day.querySelectorAll('.slot-card')].some(card=>!card.hidden));
 $('filter-summary').textContent=query ? count+' matching courses' : 'All courses';
}
let toastTimer;
let requestId = 0;
const pending = new Map();
const worker = new Worker('./worker.js', {
  type: 'module'
});
worker.onmessage = ({
  data: message
}) => {
  const p = pending.get(message.id);
  if (!p) return;
  pending.delete(message.id);
  message.error ? p.reject(new Error(message.error)) : p.resolve(message.result);
};
worker.onerror = () => {
  for (const p of pending.values()) p.reject(new Error('The scheduling engine could not load. Run the app through a local web server; see README.md.'));
  pending.clear();
};

function compute(type, options) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    pending.set(id, {
      resolve,
      reject
    });
    worker.postMessage({
      id,
      type,
      data,
      options
    });
  });
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').hidden = true, 4000);
}

function labelAlgorithm(a) {
  return {
    'dsatur': 'DSatur',
    'welsh-powell': 'Welsh–Powell',
    'exact': 'Exact search'
  } [a] || a;
}

function options() {
  return {
    algorithm: $('algorithm').value,
    slotsPerDay: settings.slotsPerDay,
    optimize: settings.optimize,
    timeLimitMs: 1500,
    maxNodes: 100000
  };
}

function setBusy(value) {
  busy = value;
  ['run-btn', 'apply-data', 'apply-settings', 'algorithm', 'import-btn', 'settings-btn', 'export-btn', 'restore-demo'].forEach(id => $(id).disabled = value);
  $('run-btn').innerHTML = value ? 'Computing…' : `${icon('play')} Generate schedule`;
}
async function run({
  resetCompare = true
} = {}) {
  setBusy(true);
  $('app-error').hidden = true;
  try {
    if ($('algorithm').value === 'exact' && data.courses.length > 18) throw new Error('Browser exact search supports up to 18 courses. Choose DSatur or Welsh–Powell; the Python CLI also supports bounded exact search on larger datasets.');
    const next = await compute('solve', options());
    result = next;
    if (resetCompare) comparison = null;
    render();
  } catch (error) {
    $('app-error').textContent = error.message;
    $('app-error').hidden = false;
  } finally {
    setBusy(false);
  }
}

function calendar() {
  return result ? calendarSlots(result.slots, settings) : [];
}
const humanDate = (date, long = false) => new Intl.DateTimeFormat('en-IN', {
  weekday: long ? 'long' : 'short',
  day: 'numeric',
  month: long ? 'long' : 'short',
  timeZone: 'UTC'
}).format(new Date(date + 'T00:00:00Z'));
const timeRange = hour => {
  const fmt = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  return `${fmt(hour*60)} – ${fmt(hour*60+settings.duration)}`;
};

function catalog() {
  return new Map(data.courses.map(c => [c.id, c.name]));
}

function graphSummary() {
  const g = result.graph;
  return `${g.ids.length} vertices · ${g.edges} edges · ${(g.density*100).toFixed(1)}% density`;
}

function render() {
  if (!result) return;
  const regs = data.students.reduce((n, s) => n + s.courses.length, 0),
    days = new Set(calendar().map(x => x.date)).size;
  $('stats').innerHTML = [
    ['courses', 'Courses to schedule', data.courses.length, `${regs.toLocaleString()} total registrations`],
    ['users', 'Students considered', data.students.length, 'Every registration included'],
    ['calendar', 'Time slots required', result.slot_count, `${days} exam days · ${settings.slotsPerDay} slots per day`],
    ['shield', 'Student clashes', result.validation.clashes.length, `<em>${result.validation.valid?'Verified conflict-free':'Needs attention'}</em>`]
  ].map(([i, l, n, f], idx) => `<article class="stat ${idx===3?'green':''}"><div class="stat-label">${icon(i)} ${l}</div><div class="stat-number">${n.toLocaleString()}</div><div class="stat-foot">${f}</div><span class="stat-art">${icon(idx===3?'check':i)}</span></article>`).join('');
  $('dataset-name').textContent = datasetName;
  $('dataset-detail').textContent = `${datasetOrigin} · ${data.courses.length} courses`;
  $('nav-slots').textContent = result.slot_count;
  $('schedule-note').innerHTML = `${icon('check')} <span>${labelAlgorithm(result.algorithm)} · ${result.elapsed_ms.toFixed(1)} ms · Bounds: ${result.lower_bound} ≤ χ(G) ≤ ${result.slot_count}</span><span class="status-pill">${result.optimal?'Minimum proved':'Heuristic · minimum unproved'}</span>`;
  showTab(tab, false);
}

function showTab(next, hash = true) {
  if (!titles[next]) next = 'timetable';
  tab = next;
  document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== `view-${next}`);
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === next);
    el.setAttribute('aria-current', el.dataset.tab === next ? 'page' : 'false');
  });
  $('page-title').textContent = titles[next][0];
  $('page-subtitle').textContent = titles[next][1];
  $('breadcrumb').textContent = titles[next][2];
  if (hash && location.hash !== `#${next}`) history.replaceState(null, '', `#${next}`);
  if (!result) return;
  ({
    timetable: renderTimetable,
    graph: renderGraph,
    compare: renderCompare,
    data: renderData,
    learn: renderLearn
  } [next])();
}

function renderTimetable() {
  const names = catalog(),
    cal = calendar(),
    days = [...new Set(cal.map(x => x.date))];
  $('view-timetable').innerHTML = `<div class="section-heading"><div><h2>Your exam timetable</h2><p>${humanDate(cal[0].date)} – ${humanDate(cal.at(-1).date)} ${cal.at(-1).date.slice(0,4)} <span class="muted">· Campus local time</span></p></div><div class="view-toggle">${icon('calendar')} By exam day <span class="badge">${days.length} days</span></div></div>${days.map((date,di)=>`<div class="day-group"><div class="day-title"><strong>DAY ${String(di+1).padStart(2,'0')}</strong><span>${esc(humanDate(date,true))}</span><span class="line"></span><span class="day-count">${cal.filter(x=>x.date===date).reduce((n,x)=>n+x.courses.length,0)} EXAMS</span></div><div class="slot-grid cols-${settings.slotsPerDay}">${cal.filter(x=>x.date===date).map(s=>`<article class="slot-card" style="${sty(s.slot-1)}"><div class="slot-head"><strong><span class="color-dot"></span>Slot ${String(s.slot).padStart(2,'0')}</strong><small>${timeRange(s.hour)}</small></div><div class="slot-exams">${s.courses.map(id=>`<div class="exam-row"><span class="course-code">${esc(id)}</span><div class="exam-info"><strong>${esc(names.get(id))}</strong><small>${result.graph.enrollment[id]} students enrolled</small></div></div>`).join('')}</div><div class="slot-foot">${icon('users')} ${s.courses.reduce((n,id)=>n+result.graph.enrollment[id],0)} students · ${s.courses.length} ${s.courses.length===1?'exam':'exams'}</div></article>`).join('')}</div></div>`).join('')}<div class="audit-banner"><span>${icon('shield')}</span><div><strong>Ready to schedule. Zero student clashes.</strong><p>All ${data.students.length} students checked against their assigned exam slots. Every course scheduled exactly once.</p></div><button id="audit-download" class="text-button">View conflict report ↗</button></div><div class="coverage-label">Consecutive same-day exam pairs: <strong>${result.soft.after}</strong>${result.soft.enabled?` · before slot reordering: ${result.soft.before}`:' · gap optimization disabled'}. ${result.soft.skipped?'Optimization was skipped at this input size.':''} A pair is one student with exams in adjacent slots.</div>`;
  $('view-timetable').insertAdjacentHTML('afterbegin', '<div class="timetable-search"><label for="course-filter">FIND A COURSE</label><input id="course-filter" class="search-input" type="search" placeholder="Course code or name…" aria-controls="view-timetable"><span id="filter-summary" class="filter-summary" role="status"></span></div>');
  $('course-filter').value=courseFilter;
  $('course-filter').oninput=event=>{courseFilter=event.target.value;filterTimetable();};
  filterTimetable();
  $('audit-download').onclick = () => download('report');
}

function renderGraph() {
  const g = result.graph,
    names = catalog();
  if (!selectedCourse || !g.ids.includes(selectedCourse)) selectedCourse = g.ids[0];
  const large = g.ids.length > 80;
  const width = 660,
    height = 480,
    cx = 330,
    cy = 232;
  const pos = new Map(g.ids.map((id, i) => {
    const a = 2 * Math.PI * i / g.ids.length - Math.PI / 2;
    const radius = g.ids.length <= 12 ? 164 : (i % 2 ? 183 : 132);
    return [id, {
      x: cx + radius * Math.cos(a),
      y: cy + radius * Math.sin(a)
    }];
  }));
  const neighbors = new Set(g.adj[selectedCourse]);
  $('view-graph').innerHTML = `<div class="section-heading"><div><h2>The conflict network</h2><p>${graphSummary()}</p></div><button id="export-graph" class="button secondary">${icon('download')} Graph JSON</button></div>${large?'<div class="notice">For readability, only edges connected to the selected course are drawn at this size. The complete graph is still used for scheduling and included in the export.</div>':''}<div class="graph-layout"><div class="panel graph-canvas"><svg id="conflict-svg" viewBox="0 0 ${width} ${height}" role="group" aria-label="Course conflict graph. Select a course node to inspect its shared registrations.">${g.weights.filter(e=>!large||e.source===selectedCourse||e.target===selectedCourse).map(e=>{const a=pos.get(e.source),b=pos.get(e.target),focus=e.source===selectedCourse||e.target===selectedCourse;return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${focus?'#93ac86':'#dce3d5'}" stroke-width="${focus?1.6:.7}" opacity="${focus?.85:.3}"/>`;}).join('')}${g.ids.map(id=>{const p=pos.get(id),focus=id===selectedCourse,r=g.ids.length>40?12:22;return `<g class="graph-node" data-course="${esc(id)}" tabindex="0" role="button" aria-label="${esc(id)}: ${g.degrees[id]} conflicts, slot ${result.colors[id]+1}"><circle cx="${p.x}" cy="${p.y}" r="${r+(focus?3:0)}" fill="${color(result.colors[id])}" stroke="${focus?'#314c2b':'#fff'}" stroke-width="${focus?3:2}" opacity="${focus||neighbors.has(id)?1:.55}"/>${g.ids.length<=40?`<text x="${p.x}" y="${p.y+3}" text-anchor="middle">${esc(id)}</text>`:`<title>${esc(id)}</title>`}</g>`;}).join('')}</svg><div class="graph-legend"><span>● Node = course</span><span>— Edge = shared student</span><span>Color = assigned slot</span><span>Select a node to explore</span></div></div><aside class="panel graph-detail"><div class="eyebrow">SELECTED COURSE</div><h3 class="big-code">${esc(selectedCourse)}</h3><strong style="font-size:12px">${esc(names.get(selectedCourse))}</strong><div class="metric-grid"><div class="mini-metric"><strong>${g.enrollment[selectedCourse]}</strong><span>Students</span></div><div class="mini-metric"><strong>${g.degrees[selectedCourse]}</strong><span>Conflicts</span></div><div class="mini-metric"><strong>${result.colors[selectedCourse]+1}</strong><span>Slot</span></div></div><h3 style="font-size:11px">Connected courses</h3>${g.adj[selectedCourse].map(id=>{const w=g.weights.find(e=>e.source===id&&e.target===selectedCourse||e.target===id&&e.source===selectedCourse);return `<div class="graph-neighbor"><span>${esc(id)}</span><span>${w?.students||0} shared students</span></div>`;}).join('')||'<p>No conflicts. This course can share a slot with any other course.</p>'}</aside></div><div class="notice"><strong>Clique certificate:</strong> ${result.clique.map(esc).join(', ')}. These ${result.clique.length} courses conflict pairwise, so at least ${result.clique_lower_bound} slots are necessary. ${result.optimal?'This schedule is proved minimum.':'A clique found greedily is a valid lower bound; it need not be the maximum clique.'}</div>`;
  $('export-graph').onclick = () => saveFile('examcraft-graph.json', JSON.stringify(g, null, 2), 'application/json');
  document.querySelectorAll('.graph-node').forEach(el => {
    const select = () => {
      selectedCourse = el.dataset.course;
      renderGraph();
    };
    el.onclick = select;
    el.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
        document.querySelectorAll('.graph-node').forEach(node => {
          if (node.dataset.course === selectedCourse) node.focus();
        });
      }
    };
  });
}

function renderCompare() {
  if (!comparison) {
    $('view-compare').innerHTML = `<div class="panel"><div class="section-heading"><div><h2>One dataset. Different strategies.</h2><p>Compare on the same graph and calendar settings.</p></div><button id="compare-btn" class="button primary">${icon('chart')} Run comparison</button></div><p>Welsh–Powell colors by degree. DSatur adapts to colored neighbors. For at most 18 courses, bounded exact search also attempts to prove the minimum.</p><div class="notice">Heuristics give upper bounds. A valid clique gives a lower bound. Equal bounds certify the chromatic number; a fast runtime alone does not prove an optimal schedule.</div></div>`;
    $('compare-btn').onclick = async () => {
      if (busy) return;
      setBusy(true);
      $('compare-btn').disabled = true;
      $('compare-btn').textContent = 'Comparing…';
      try {
        comparison = await compute('compare', options());
        renderCompare();
      } catch (e) {
        toast(e.message);
      } finally {
        setBusy(false);
        if ($('compare-btn')) {
          $('compare-btn').disabled = false;
          $('compare-btn').textContent = 'Run comparison';
        }
      }
    };
    return;
  }
  const best = Math.min(...comparison.map(r => r.slot_count));
  $('view-compare').innerHTML = `<div class="section-heading"><div><h2>Algorithm comparison</h2><p>${graphSummary()} · Same input and soft objective</p></div><button id="rerun-compare" class="button secondary">Run again</button></div><div class="result-cards">${comparison.map(r=>`<article class="panel result-card ${r.slot_count===best?'winner':''}"><h3>${labelAlgorithm(r.algorithm)}</h3><span class="time">${r.elapsed_ms.toFixed(2)} ms</span><div class="result-num">${r.slot_count} <small>time slots</small></div><p>${r.lower_bound} ≤ χ(G) ≤ ${r.slot_count} · ${r.validation.clashes.length} clashes</p><p>${r.soft.after} consecutive same-day pairs</p><span class="badge">${r.optimal?'Minimum proved':'Minimum unproved'}</span><div><button class="text-button use-algorithm" data-algorithm="${r.algorithm}">Use this strategy →</button></div></article>`).join('')}</div><p class="comparison-note">${data.courses.length>18?'Exact search is available in this browser for ≤18 courses. Use the Python CLI for bounded exact search on larger graphs. ':''}Timings are measured on this device and include graph construction, bounds, coloring, gap optimization and independent validation. Small differences in speed are normal. The displayed bound may be tighter after an exact proof than the clique certificate.</p><div class="panel"><h3>What the algorithms prioritize</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>STRATEGY</th><th>NEXT COURSE</th><th>COLOR RULE</th><th>GUARANTEE</th></tr></thead><tbody><tr><td>Welsh–Powell</td><td>Fixed descending degree, then course ID</td><td>Build one independent color class at a time</td><td>Proper coloring; at most Δ + 1 colors</td></tr><tr><td>DSatur</td><td>Highest saturation, then degree, then ID</td><td>Smallest available color</td><td>Proper coloring; minimum unproved unless bounds meet</td></tr><tr><td>Exact search</td><td>DSatur branching with incumbent and pruning</td><td>Explore feasible colors under a search budget</td><td>Proved optimum on completion; otherwise best valid incumbent</td></tr></tbody></table></div></div>`;
  $('rerun-compare').onclick = () => {
    comparison = null;
    renderCompare();
  };
  document.querySelectorAll('.use-algorithm').forEach(b => b.onclick = () => {
    $('algorithm').value = b.dataset.algorithm;
    run().then(() => showTab('timetable'));
  });
}

function renderData() {
  const names = catalog();
  $('view-data').innerHTML = `<div class="section-heading"><div><h2>Registrations, made visible</h2><p>${data.students.length} students · ${data.courses.length} courses · ${data.students.reduce((n,s)=>n+s.courses.length,0)} registrations</p></div><button id="data-edit" class="button secondary">${icon('upload')} Replace dataset</button></div><div class="data-layout"><div class="panel"><div class="section-heading"><h3 class="no-margin">Course catalog</h3><input class="search-input" id="course-search" aria-label="Search courses" placeholder="Search courses…"></div><div class="table-wrap" style="max-height:520px"><table class="data-table"><thead><tr><th>COURSE</th><th>STUDENTS</th><th>DEGREE</th><th>SLOT</th></tr></thead><tbody id="course-rows"></tbody></table></div><div class="data-actions"><button id="download-data-json" class="text-button">Download registrations JSON</button><button id="download-data-csv" class="text-button">Download registrations CSV</button></div></div><div><div class="panel"><h3>Find a student's exams</h3><p>Enter a complete student ID. Try <strong>${esc(data.students[0]?.student_id||'an ID')}</strong>.</p><form id="student-form" class="search-box"><input id="student-search" aria-label="Student ID" placeholder="Student ID" maxlength="80" required><button class="button primary">Find exams</button></form><div class="student-result" id="student-result" aria-live="polite"></div></div><div class="notice"><strong>Privacy by design.</strong> Registrations are processed in this browser and kept in memory for this visit. No dataset is uploaded to a scheduling server. Download your data before reloading to keep changes.</div><div class="panel"><h3>Import rules</h3><p>CSV uses one registration per row. Duplicate registrations are deduplicated. JSON uses one object per student; duplicate student IDs are rejected. Course IDs are case-sensitive. Catalog courses without registrations are scheduled too.</p></div></div></div>`;

  function rows(q = '') {
    const filtered = data.courses.filter(c => `${c.id} ${c.name}`.toLowerCase().includes(q.toLowerCase()));
    $('course-rows').innerHTML = filtered.map(c => `<tr><td><code>${esc(c.id)}</code><br>${esc(c.name)}</td><td>${result.graph.enrollment[c.id]}</td><td>${result.graph.degrees[c.id]}</td><td><span class="trace-badge" style="${sty(result.colors[c.id])}">${result.colors[c.id]+1}</span></td></tr>`).join('') || '<tr><td colspan="4">No matching courses.</td></tr>';
  }
  rows();
  $('course-search').oninput = e => rows(e.target.value);
  $('data-edit').onclick = () => openData();
  $('download-data-json').onclick = () => saveFile('examcraft-registrations.json', JSON.stringify(data, null, 2), 'application/json');
  $('download-data-csv').onclick = () => saveFile('examcraft-registrations.csv', registrationsCSV(data), 'text/csv');
  $('student-form').onsubmit = e => {
    e.preventDefault();
    const id = $('student-search').value.trim(),
      student = data.students.find(s => s.student_id === id);
    if (!student) {
      $('student-result').innerHTML = '<div class="empty">Student ID not found. IDs are case-sensitive.</div>';
      return;
    }
    const cal = calendar();
    $('student-result').innerHTML = `<h3>${esc(id)} <span class="badge">${student.courses.length} exams</span></h3>${[...student.courses].sort((a,b)=>result.colors[a]-result.colors[b]).map(c=>{const s=cal[result.colors[c]];return `<div class="student-exam"><span class="slot-token">Slot ${s.slot}</span><div><strong>${esc(c)} · ${esc(names.get(c))}</strong><small>${humanDate(s.date)} · ${timeRange(s.hour)}</small></div></div>`;}).join('')||'<p>No registered exams.</p>'}<p class="hint">${result.validation.valid?'No simultaneous exams in this schedule.':''}</p>`;
  };
}

function renderLearn() {
  const g = result.graph;
  $('view-learn').innerHTML = `<div class="panel prose"><div class="eyebrow">DISCRETE MATHEMATICS, APPLIED</div><h2>A timetable is a colored graph.</h2><p>Let each course be a vertex. Join two vertices when at least one student takes both courses. A color represents a time slot. A proper coloring assigns different colors to adjacent vertices, which makes simultaneous exams safe for every student.</p><div class="math-mapping"><div class="math-card"><b>V</b><strong>Courses → vertices</strong><p>${g.ids.length} distinct courses in this dataset.</p></div><div class="math-card"><b>E</b><strong>Conflicts → edges</strong><p>${g.edges} pairs share at least one student.</p></div><div class="math-card"><b>C</b><strong>Colors → time slots</strong><p>${result.slot_count} independent sets form the timetable.</p></div></div><div class="formula">ω(G) ≤ χ(G) ≤ ${result.slot_count} ≤ Δ(G) + 1</div><p>Here ω(G) is the maximum clique size, χ(G) the chromatic number, and Δ(G) the maximum degree. The project computes a clique of size ${result.clique_lower_bound}, giving a certified lower bound. Finding one clique does not establish that it is maximum. ${result.optimal?`The completed proof certifies χ(G) = ${result.slot_count}.`:`The current interval is ${result.lower_bound} ≤ χ(G) ≤ ${result.slot_count}.`}</p><h3>Why no clashes? A short proof.</h3><p>If a student had two exams at the same time, their courses would share an edge by construction. A proper coloring cannot give those endpoints the same color: a contradiction. Conversely, a timetable with no student clash gives different slots to every conflicting pair, so it is a proper coloring.</p><details open><summary>Welsh–Powell: color by largest degree</summary><p>Sort courses by decreasing degree, breaking ties by course ID. Scan the order to create a maximal independent set for slot 1. Scan again for slot 2, continuing until all courses are assigned. It is a heuristic and may use more than χ(G) colors. This project uses the color-class form of Welsh–Powell.</p></details><details><summary>DSatur: color the most constrained course next</summary><p>Saturation is the number of distinct colors already used by a course's neighbors. Select maximum saturation, then maximum total degree, then course ID. Assign the smallest available color. DSatur often gives compact schedules, but it does not always beat Welsh–Powell or guarantee a minimum.</p></details><details><summary>Exact search: when is “minimum” justified?</summary><p>The exact solver starts from a valid heuristic schedule. It branches on feasible colors in DSatur order and prunes branches that cannot improve the best schedule. Completion or matching a valid lower bound proves optimality. The browser caps exact mode at 18 courses, 1.5 seconds and 100,000 search nodes. If a budget is exhausted, it returns the best valid schedule and labels optimality unproved.</p></details><details><summary>Complexity and honest scope</summary><p>Building the graph by registration pairs takes O(Σ kₛ² + |V| log |V|) plus adjacency sorting, where kₛ is a student's number of courses. Repeated scanning and sorting in this teaching DSatur implementation costs O(|V|²(|E| + |V| log |V|)) as a loose upper bound. Exact coloring is exponential in the worst case. Finding χ(G) is NP-hard; deciding whether a graph has a coloring with at most k colors is NP-complete for fixed k ≥ 3.</p><p>This model schedules exam conflicts, then maps slots to dates. Rooms, seating capacity, invigilators, holidays and individual exam durations are outside the implemented constraint model. The gap optimizer reorders existing slots; it does not prove globally optimal student spacing.</p></details><h3>Watch the coloring order</h3><p>This trace shows assignment order and the final slot after gap reordering. Degree and saturation are recorded when the course is colored. ${result.algorithm==='exact'?'For an exact result, the trace replays the final coloring; it is not the search tree.':''}</p><div class="trace-controls"><label for="trace-step">Steps</label><input id="trace-step" type="range" min="1" max="${result.trace.length}" value="${result.trace.length}"><strong id="trace-count">${result.trace.length}/${result.trace.length}</strong></div><div class="trace-table"><table class="data-table"><thead><tr><th>STEP</th><th>COURSE</th><th>DEGREE</th><th>SATURATION</th><th>FINAL SLOT</th></tr></thead><tbody id="trace-rows"></tbody></table></div><h3>Use this in your demonstration</h3><ol class="compact-list"><li>Start with the demo dataset and explain the vertex, edge and color mapping.</li><li>Inspect a conflict edge and the number of shared students.</li><li>Compare heuristics. Explain the gap between lower and upper bounds.</li><li>Import a five-cycle to show why a clique bound of 2 can still require 3 colors.</li><li>Export a timetable and a validation report, then find one student's exams.</li></ol><p>Complete Python source, reproducible datasets, algorithm notes, a project report, viva questions and demo instructions are included in the project download.</p></div>`;

  function showTrace(n) {
    $('trace-count').textContent = `${n}/${result.trace.length}`;
    $('trace-rows').innerHTML = result.trace.slice(0, n).map(s => `<tr><td>${s.step}</td><td>${esc(s.course)}</td><td>${s.degree}</td><td>${s.saturation}</td><td><span class="trace-badge" style="${sty(s.color)}">${s.color+1}</span></td></tr>`).join('');
  }
  showTrace(result.trace.length);
  $('trace-step').oninput = e => showTrace(Number(e.target.value));
}

function saveFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], {
    type: type + ';charset=utf-8'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${name} download started`);
}
// Exports are pure functions in exporters.js, shared with the automated tests.
function exportPayload(type) {
  const cal = calendar();
  const report = {
    dataset: {
      courses: data.courses.length,
      students: data.students.length,
      registrations: data.students.reduce((n, s) => n + s.courses.length, 0)
    },
    validation: result.validation,
    graph: {
      vertices: result.graph.ids.length,
      edges: result.graph.edges
    },
    bounds: {
      lower: result.lower_bound,
      upper: result.slot_count,
      optimal: result.optimal,
      clique: result.clique
    },
    soft: result.soft,
    method: 'Student registrations independently grouped by assigned slot; coverage and constraints checked.'
  };
  const payloads = {
    csv: () => ['examcraft-timetable.csv', timetableCSV(data, result, settings, cal), 'text/csv'],
    json: () => ['examcraft-schedule.json', JSON.stringify(scheduleJSON(data, result, settings, cal), null, 2), 'application/json'],
    report: () => ['examcraft-conflict-report.json', JSON.stringify(report, null, 2), 'application/json'],
    ics: () => ['examcraft-timetable.ics', calendarICS(data, result, settings, cal), 'text/calendar'],
    html: () => ['examcraft-report.html', htmlReport(data, result, settings, cal), 'text/html']
  };
  return payloads[type]();
}

function download(type) {
  if (!result || busy) return;
  saveFile(...exportPayload(type));
  $('export-menu').hidden = true;
  $('export-btn').setAttribute('aria-expanded', 'false');
}
let exportURLs = [];

function prepareExports() {
  exportURLs.forEach(url => URL.revokeObjectURL(url));
  exportURLs = [];
  document.querySelectorAll('a[data-export]').forEach(a => {
    const [name, content, type] = exportPayload(a.dataset.export);
    const url = URL.createObjectURL(new Blob([content], {
      type: type + ';charset=utf-8'
    }));
    a.href = url;
    a.download = name;
    exportURLs.push(url);
  });
}

function openData() {
  $('data-error').textContent = '';
  $('data-dialog').showModal();
}

function setSource(value) {
  source = value;
  document.querySelectorAll('[data-source]').forEach(b => b.classList.toggle('selected', b.dataset.source === value));
  $('source-upload').hidden = value !== 'upload';
  $('source-generate').hidden = value !== 'generate';
  $('data-error').textContent = '';
}
async function applyData() {
  try {
    let candidate;
    if (source === 'generate') {
      const courses = Number($('gen-courses').value),
        students = Number($('gen-students').value);
      if (courses > 120 || students > 5000) throw new Error('This interface supports at most 120 courses and 5,000 students.');
      candidate = generateData({
        courses,
        students,
        minCourses: Number($('gen-min').value),
        maxCourses: Number($('gen-max').value),
        seed: Number($('gen-seed').value)
      });
    } else {
      const file = $('file-input').files[0];
      if (file && file.size > 5 * 1024 * 1024) throw new Error('Maximum import size is 5 MB.');
      const text = file ? await file.text() : $('paste-data').value;
      if (text.length > 5 * 1024 * 1024) throw new Error('Maximum import size is 5 MB.');
      if (!text.trim()) throw new Error('Choose a file or paste registrations first.');
      candidate = text.trim().startsWith('{') ? parseJSON(text) : parseCSV(text);
      if (candidate.courses.length > 120 || candidate.students.length > 5000) throw new Error('This interface supports at most 120 courses and 5,000 students.');
    }
    // Commit imported data only after the engine produces a validated schedule.
    const oldData = data;
    data = candidate;
    let next;
    try {
      const algorithm = $('algorithm').value === 'exact' && candidate.courses.length > 18 ? 'dsatur' : $('algorithm').value;
      next = await compute('solve', {
        ...options(),
        algorithm
      });
    } catch (error) {
      data = oldData;
      throw error;
    }
    result = next;
    $('algorithm').value = result.algorithm;
    comparison = null;
    selectedCourse = null;
    datasetName = source === 'generate' ? 'Generated registrations' : $('file-input').files[0]?.name.replace(/\.[^.]+$/, '') || 'Imported registrations';
    datasetOrigin = source === 'generate' ? `Mock · seed ${$('gen-seed').value}` : 'Imported dataset';
    $('data-dialog').close();
    render();
    toast('Dataset loaded. Schedule independently verified.');
  } catch (error) {
    $('data-error').textContent = error.message;
  }
}

// Event bindings. All timetable computation runs in the module worker.
icons();
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
window.addEventListener('hashchange', () => showTab(location.hash.slice(1), false));
$('import-btn').onclick = openData;
$('run-btn').onclick = () => run();
$('settings-btn').onclick = () => {
  syncSettingsForm();
  $('settings-error').textContent = '';
  $('settings-dialog').showModal();
};
$('apply-settings').onclick = async () => {
  const date = $('start-date').value;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) < 1900 || Number(date.slice(0, 4)) > 2100) {
    $('settings-error').textContent = 'Choose a valid first exam date from 1900 to 2100.';
    return;
  }
  settings = {
    startDate: date,
    slotsPerDay: Number($('slots-per-day').value),
    duration: Number($('duration').value),
    skipWeekends: $('skip-weekends').checked,
    optimize: $('optimize-gaps').checked
  };
  try { localStorage.setItem('examcraft.calendar.v1', JSON.stringify(settings)); } catch { toast('Calendar applied for this session; browser storage is unavailable.'); }
  $('settings-dialog').close();
  await run();
};
$('export-btn').onclick = event => {
  event.stopPropagation();
  if ($('export-menu').hidden) prepareExports();
  $('export-menu').hidden = !$('export-menu').hidden;
  $('export-btn').setAttribute('aria-expanded', String(!$('export-menu').hidden));
};

function closeExportMenu() {
  $('export-menu').hidden = true;
  $('export-btn').setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', event => {
  if (!event.target.closest('.export-wrap')) closeExportMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeExportMenu();
});
document.querySelectorAll('a[data-export]').forEach(a => a.addEventListener('click', () => {
  // Let the browser activate the native download link before changing the menu.
  toast(`${a.download} download started`);
}));
$('print-btn').onclick = () => {
  showTab('timetable');
  closeExportMenu();
  window.print();
};
document.querySelectorAll('[data-source]').forEach(b => b.onclick = () => setSource(b.dataset.source));
$('apply-data').onclick = () => {
  if (busy) return;
  setBusy(true);
  applyData().finally(() => setBusy(false));
};
$('restore-demo').onclick = async () => {
  data = generateData();
  datasetName = 'Computer Engineering';
  datasetOrigin = 'Demo · seed 42';
  $('algorithm').value = 'dsatur';
  selectedCourse = null;
  $('data-dialog').close();
  await run();
  toast('Demo dataset restored.');
};
$('download-sample').onclick = () => saveFile('examcraft-sample.csv', registrationsCSV(generateData({
  courses: 8,
  students: 20,
  minCourses: 2,
  maxCourses: 3,
  seed: 7
})), 'text/csv');
$('file-input').addEventListener('change', () => {
  if ($('file-input').files.length) $('paste-data').value = '';
});
$('paste-data').addEventListener('input', () => {
  if ($('paste-data').value) $('file-input').value = '';
});
tab = titles[location.hash.slice(1)] ? location.hash.slice(1) : 'timetable';
run();
