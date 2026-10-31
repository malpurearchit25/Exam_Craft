/**
 * ExamCraft — dependency-free graph-colouring engine.
 * All colours are zero-based internally. Display/export layers add one.
 * Input never leaves the browser. See docs for the mathematical model.
 */
const LIMITS = {
  courses: 200,
  students: 10000,
  registrations: 100000
};
const dict = () => Object.create(null);
const now = () => globalThis.performance?.now() ?? Date.now();
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const integer = (v, name, min, max) => {
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  return v;
};
const identifier = (v, label) => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > 80 || /[\u0000-\u001f]/.test(v))
    throw new Error(`${label} must be a nonempty string of at most 80 characters without control characters.`);
  return v.trim();
};

function normalize(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.students)) throw new Error('JSON must contain a students array.');
  if (data.students.length > LIMITS.students) throw new Error(`Maximum ${LIMITS.students} students supported in the browser.`);
  const catalog = new Map();
  if (data.courses !== undefined && !Array.isArray(data.courses)) throw new Error('courses must be an array of {id, name} objects.');
  for (const course of data.courses || []) {
    if (!course || typeof course !== 'object') throw new Error('Each course must contain id and name.');
    const id = identifier(course.id, 'Course ID');
    if (catalog.has(id)) throw new Error(`Duplicate course ID: ${id}.`);
    const name = course.name === undefined ? id : course.name;
    if (typeof name !== 'string' || !name.trim() || name.length > 200) throw new Error(`Invalid name for course ${id}.`);
    catalog.set(id, {
      id,
      name: name.trim()
    });
  }
  const seen = new Set();
  let registrations = 0;
  const students = data.students.map(student => {
    if (!student || typeof student !== 'object') throw new Error('Each student must be an object.');
    const student_id = identifier(student.student_id, 'Student ID');
    if (seen.has(student_id)) throw new Error(`Duplicate student ID: ${student_id}. Merge its registrations first.`);
    seen.add(student_id);
    if (!Array.isArray(student.courses)) throw new Error(`courses must be an array for student ${student_id}.`);
    const courses = [...new Set(student.courses.map(c => identifier(c, 'Course ID')))].sort(cmp);
    registrations += courses.length;
    if (registrations > LIMITS.registrations) throw new Error(`Maximum ${LIMITS.registrations} registrations supported.`);
    for (const id of courses)
      if (!catalog.has(id)) catalog.set(id, {
        id,
        name: id
      });
    return {
      student_id,
      courses
    };
  });
  if (catalog.size > LIMITS.courses) throw new Error(`Maximum ${LIMITS.courses} courses supported in the browser.`);
  if (!catalog.size) throw new Error('The dataset must contain at least one course, either registered or in the course catalog.');
  return {
    students,
    courses: [...catalog.values()].sort((a, b) => cmp(a.id, b.id))
  };
}

/** Strict CSV reader supporting commas, CRLF, quoted cells and escaped quotes. */
function csvRows(text) {
  if (typeof text !== 'string') throw new Error('CSV input must be text.');
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [],
    cell = '',
    quoted = false,
    closed = false;
  const finishCell = () => {
    row.push(cell);
    cell = '';
    closed = false;
  };
  const finishRow = () => {
    finishCell();
    if (row.some(x => x.trim())) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error('Malformed CSV: unexpected quote.');
      quoted = true;
    } else if (c === ',') finishCell();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      finishRow();
    } else {
      if (closed && !/\s/.test(c)) throw new Error('Malformed CSV: characters after closing quote.');
      if (!closed) cell += c;
    }
  }
  if (quoted) throw new Error('Malformed CSV: unclosed quoted field.');
  if (cell || row.length || closed) finishRow();
  return rows;
}

export function parseCSV(text) {
  const rows = csvRows(text);
  if (!rows.length) throw new Error('CSV is empty. Expected student_id,course_id headers.');
  const header = rows.shift().map(x => x.trim().toLowerCase());
  if (new Set(header).size !== header.length) throw new Error('Duplicate CSV column names.');
  const si = header.indexOf('student_id'),
    ci = header.indexOf('course_id'),
    ni = header.indexOf('course_name');
  if (si < 0 || ci < 0) throw new Error('CSV requires student_id and course_id columns.');
  const students = new Map(),
    courses = new Map();
  rows.forEach((row, i) => {
    if (row.length !== header.length) throw new Error(`CSV row ${i+2} has ${row.length} fields; expected ${header.length}.`);
    const sid = identifier(row[si], `Student ID on row ${i+2}`),
      id = identifier(row[ci], `Course ID on row ${i+2}`);
    const name = ni >= 0 && row[ni].trim() ? row[ni].trim() : id;
    if (courses.has(id) && courses.get(id).name !== id && name !== id && courses.get(id).name !== name) throw new Error(`Conflicting course names for ${id}.`);
    if (!courses.has(id) || name !== id) courses.set(id, {
      id,
      name
    });
    if (!students.has(sid)) students.set(sid, new Set());
    students.get(sid).add(id);
  });
  return normalize({
    students: [...students].map(([student_id, ids]) => ({
      student_id,
      courses: [...ids]
    })),
    courses: [...courses.values()]
  });
}

export function parseJSON(text) {
  let data;
  try {
    data = typeof text === 'string' ? JSON.parse(text) : text;
  } catch {
    throw new Error('Invalid JSON. Check quotes, commas and brackets.');
  }
  return normalize(data);
}

export function generateData({
  courses = 30,
  students = 300,
  minCourses = 3,
  maxCourses = 6,
  seed = 42
} = {}) {
  integer(courses, 'Courses', 1, LIMITS.courses);
  integer(students, 'Students', 1, LIMITS.students);
  integer(minCourses, 'Minimum courses', 1, courses);
  integer(maxCourses, 'Maximum courses', minCourses, courses);
  integer(seed, 'Seed', 0, 4294967295);
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const names = ['Discrete Mathematics', 'Data Structures', 'Computer Networks', 'Database Systems', 'Operating Systems', 'Linear Algebra', 'Programming in C', 'Object Oriented Programming', 'Probability & Statistics', 'Software Engineering', 'Theory of Computation', 'Web Technologies', 'Digital Logic', 'Computer Architecture', 'Design & Analysis of Algorithms', 'Artificial Intelligence', 'Compiler Design', 'Information Security', 'Machine Learning', 'Numerical Methods', 'Cloud Computing', 'Human Computer Interaction', 'Embedded Systems', 'Data Science', 'Graph Theory', 'Mobile Computing', 'Distributed Systems', 'Optimization Techniques', 'Computer Graphics', 'Internet of Things'];
  const catalog = Array.from({
    length: courses
  }, (_, i) => ({
    id: `CS${String(i+101)}`,
    name: names[i % names.length] + (i >= names.length ? ` ${Math.floor(i/names.length)+1}` : '')
  }));
  const data = [];
  for (let i = 0; i < students; i++) {
    const count = minCourses + Math.floor(random() * (maxCourses - minCourses + 1));
    const available = catalog.map(x => x.id),
      selected = [];
    // Cohort-biased registrations model degree electives without making the
    // 300-student example an almost-complete conflict graph by construction.
    const groups = Math.ceil(courses / 8),
      group = i % groups;
    for (let j = 0; j < count; j++) {
      const cohort = available.filter(id => Math.floor((Number(id.slice(2)) - 101) / 8) === group);
      const pool = cohort.length && random() < 0.92 ? cohort : available;
      const id = pool[Math.floor(random() * pool.length)];
      selected.push(id);
      available.splice(available.indexOf(id), 1);
    }
    data.push({
      student_id: `ST${String(i+1).padStart(4,'0')}`,
      courses: selected.sort(cmp)
    });
  }
  return normalize({
    students: data,
    courses: catalog
  });
}

export function buildGraph(input) {
  const data = normalize(input),
    ids = data.courses.map(x => x.id),
    sets = new Map(ids.map(id => [id, new Set()]));
  const enrollment = dict(),
    weightsBySource = new Map();
  for (const id of ids) enrollment[id] = 0;
  for (const student of data.students) {
    for (const a of student.courses) enrollment[a]++;
    for (let i = 0; i < student.courses.length; i++)
      for (let j = i + 1; j < student.courses.length; j++) {
        const a = student.courses[i],
          b = student.courses[j];
        sets.get(a).add(b);
        sets.get(b).add(a);
        if (!weightsBySource.has(a)) weightsBySource.set(a, new Map());
        const row = weightsBySource.get(a);
        row.set(b, (row.get(b) || 0) + 1);
      }
  }
  const adj = dict();
  for (const id of ids) adj[id] = [...sets.get(id)].sort(cmp);
  const weights = [];
  for (const a of ids)
    for (const [b, students] of weightsBySource.get(a) || []) weights.push({
      source: a,
      target: b,
      students
    });
  weights.sort((a, b) => cmp(a.source, b.source) || cmp(a.target, b.target));
  return {
    ids,
    adj,
    weights,
    enrollment,
    edges: weights.length,
    density: ids.length < 2 ? 0 : 2 * weights.length / (ids.length * (ids.length - 1)),
    degrees: Object.fromEntries(ids.map(id => [id, adj[id].length]))
  };
}

function saturation(id, colors, g) {
  return new Set(g.adj[id].filter(n => colors[n] !== undefined).map(n => colors[n])).size;
}

function selectVertex(g, colors) {
  return g.ids.filter(id => colors[id] === undefined).sort((a, b) => saturation(b, colors, g) - saturation(a, colors, g) || g.adj[b].length - g.adj[a].length || cmp(a, b))[0];
}

function firstColor(id, colors, g) {
  const used = new Set(g.adj[id].map(n => colors[n]));
  let c = 0;
  while (used.has(c)) c++;
  return c;
}

function heuristic(g, algorithm) {
  const colors = dict(),
    trace = [];
  const assign = (id, c) => {
    const sat = saturation(id, colors, g);
    colors[id] = c;
    trace.push({
      step: trace.length + 1,
      course: id,
      color: c,
      degree: g.adj[id].length,
      saturation: sat
    });
  };
  if (algorithm === 'welsh-powell') {
    const order = [...g.ids].sort((a, b) => g.adj[b].length - g.adj[a].length || cmp(a, b));
    let c = 0;
    while (Object.keys(colors).length < g.ids.length) {
      for (const id of order)
        if (colors[id] === undefined && !g.adj[id].some(n => colors[n] === c)) assign(id, c);
      c++;
    }
  } else {
    while (Object.keys(colors).length < g.ids.length) {
      const id = selectVertex(g, colors);
      assign(id, firstColor(id, colors, g));
    }
  }
  return {
    colors,
    trace,
    count: new Set(Object.values(colors)).size
  };
}

function cliqueBound(g, data) {
  let best = [];
  for (const student of data.students)
    if (student.courses.length > best.length) best = [...student.courses];
  const order = [...g.ids].sort((a, b) => g.adj[b].length - g.adj[a].length || cmp(a, b));
  const sets = new Map(g.ids.map(id => [id, new Set(g.adj[id])]));
  for (const start of order) {
    const clique = [start];
    for (const id of order)
      if (id !== start && clique.every(v => sets.get(id).has(v))) clique.push(id);
    if (clique.length > best.length) best = clique;
  }
  return best;
}

function exact(g, incumbent, lower, {
  maxNodes = 100000,
  timeLimitMs = 1000
} = {}) {
  integer(maxNodes, 'Exact node budget', 0, 10000000);
  if (!Number.isFinite(timeLimitMs) || timeLimitMs < 0 || timeLimitMs > 10000) throw new Error('Exact time budget must be from 0 to 10000 ms.');
  if (incumbent.count === lower) return {
    ...incumbent,
    exact_status: 'proved-by-bound',
    nodes: 0,
    complete: true
  };
  if (g.ids.length > 18) return {
    ...incumbent,
    exact_status: 'skipped-size-limit',
    nodes: 0,
    complete: false
  };
  const start = now(),
    colors = dict(),
    trace = [];
  let best = incumbent,
    nodes = 0,
    interrupted = false;

  function search(used) {
    if (best.count === lower || interrupted) return;
    if (nodes >= maxNodes || now() - start >= timeLimitMs) {
      interrupted = true;
      return;
    }
    nodes++;
    if (Object.keys(colors).length === g.ids.length) {
      best = {
        colors: Object.assign(dict(), colors),
        trace: trace.map(x => ({
          ...x
        })),
        count: used
      };
      return;
    }
    const id = selectVertex(g, colors),
      forbidden = new Set(g.adj[id].map(v => colors[v])),
      sat = saturation(id, colors, g);
    for (let c = 0; c < Math.min(used + 1, best.count); c++) {
      if (forbidden.has(c)) continue;
      colors[id] = c;
      trace.push({
        step: trace.length + 1,
        course: id,
        color: c,
        degree: g.adj[id].length,
        saturation: sat
      });
      search(Math.max(used, c + 1));
      trace.pop();
      delete colors[id];
      if (best.count === lower || interrupted) break;
    }
  }
  search(0);
  return {
    ...best,
    nodes,
    complete: !interrupted || best.count === lower,
    exact_status: best.count === lower ? 'proved-by-bound' : interrupted ? 'budget-exhausted' : 'proved-by-search'
  };
}

function consecutiveCount(data, colors, slotsPerDay) {
  let total = 0;
  for (const student of data.students) {
    const slots = student.courses.map(id => colors[id]).sort((a, b) => a - b);
    for (let i = 1; i < slots.length; i++)
      if (slots[i] === slots[i - 1] + 1 && Math.floor(slots[i] / slotsPerDay) === Math.floor(slots[i - 1] / slotsPerDay)) total++;
  }
  return total;
}

function optimizeSlots(data, colors, count, slotsPerDay, enabled) {
  const before = consecutiveCount(data, colors, slotsPerDay);
  let score = before,
    permutation = Array.from({
      length: count
    }, (_, i) => i);
  // Course-pair weights make each evaluation independent of student count.
  const pairs = Array.from({
    length: count
  }, () => Array(count).fill(0));
  for (const student of data.students)
    for (let i = 0; i < student.courses.length; i++)
      for (let j = i + 1; j < student.courses.length; j++) {
        const a = colors[student.courses[i]],
          b = colors[student.courses[j]];
        if (a !== b) {
          pairs[a][b]++;
          pairs[b][a]++;
        }
      }
  const objective = p => {
    let sum = 0;
    for (let i = 0; i < count; i++)
      for (let j = i + 1; j < count; j++)
        if (Math.abs(p[i] - p[j]) === 1 && Math.floor(p[i] / slotsPerDay) === Math.floor(p[j] / slotsPerDay)) sum += pairs[i][j];
    return sum;
  };
  // Bounded deterministic best-improvement swap search, never accepting a worse schedule.
  if (enabled && count <= 60)
    for (let pass = 0; pass < 6; pass++) {
      let best = score,
        choice = null;
      for (let a = 0; a < count; a++)
        for (let b = a + 1; b < count; b++) {
          [permutation[a], permutation[b]] = [permutation[b], permutation[a]];
          const s = objective(permutation);
          [permutation[a], permutation[b]] = [permutation[b], permutation[a]];
          if (s < best) {
            best = s;
            choice = [a, b];
          }
        }
      if (!choice) break;
      const [a, b] = choice;
      [permutation[a], permutation[b]] = [permutation[b], permutation[a]];
      score = best;
    }
  const result = dict();
  for (const [id, c] of Object.entries(colors)) result[id] = permutation[c];
  return {
    colors: result,
    permutation,
    soft: {
      before,
      after: score,
      improved: before - score,
      metric: 'student consecutive-exam pairs within a day',
      enabled: !!enabled,
      skipped: enabled && count > 60
    }
  };
}

/** Independently validates student registrations, assignment coverage and slot collisions. */
export function validate(input, colors) {
  const data = normalize(input),
    known = new Set(data.courses.map(c => c.id));
  const missing = [],
    unknown = [],
    invalid = [],
    clashes = [];
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) throw new Error('Assignments must be a course-to-integer-slot object.');
  for (const id of known) {
    if (!Object.hasOwn(colors, id)) missing.push(id);
    else if (!Number.isInteger(colors[id]) || colors[id] < 0) invalid.push(id);
  }
  for (const id of Object.keys(colors))
    if (!known.has(id)) unknown.push(id);
  for (const student of data.students) {
    const buckets = new Map();
    for (const id of student.courses) {
      if (!Object.hasOwn(colors, id) || !Number.isInteger(colors[id]) || colors[id] < 0) continue;
      if (!buckets.has(colors[id])) buckets.set(colors[id], []);
      buckets.get(colors[id]).push(id);
    }
    for (const [slot, courses] of buckets)
      if (courses.length > 1) clashes.push({
        student_id: student.student_id,
        slot,
        courses
      });
  }
  return {
    valid: !missing.length && !unknown.length && !invalid.length && !clashes.length,
    clashes,
    missing,
    unknown,
    invalid,
    conflict_count: clashes.reduce((n, c) => n + c.courses.length * (c.courses.length - 1) / 2, 0),
    checked_students: data.students.length,
    checked_exams: known.size
  };
}

export function solve(input, options = {}) {
  const start = now(),
    data = normalize(input),
    g = buildGraph(data);
  let algorithm = options.algorithm || 'dsatur';
  if (algorithm === 'ldo' || algorithm === 'welsh_powell') algorithm = 'welsh-powell';
  if (!['dsatur', 'welsh-powell', 'exact'].includes(algorithm)) throw new Error('Choose dsatur, welsh-powell or exact.');
  const slotsPerDay = integer(options.slotsPerDay ?? 3, 'Slots per day', 1, 8);
  const clique = cliqueBound(g, data),
    lower = clique.length;
  let result = heuristic(g, algorithm);
  if (algorithm === 'exact') {
    const alternate = heuristic(g, 'welsh-powell');
    if (alternate.count < result.count) result = alternate;
    result = exact(g, result, lower, options);
  }
  const optimized = optimizeSlots(data, result.colors, result.count, slotsPerDay, options.optimize ?? true);
  const slots = Array.from({
    length: result.count
  }, () => []);
  for (const id of g.ids) slots[optimized.colors[id]].push(id);
  const verification = validate(data, optimized.colors);
  if (!verification.valid) throw new Error('Internal scheduling validation failed. No timetable was returned.');
  const optimal = result.count === lower || (algorithm === 'exact' && result.complete);
  return {
    colors: optimized.colors,
    slots,
    slot_count: slots.length,
    algorithm,
    elapsed_ms: now() - start,
    lower_bound: optimal ? result.count : lower,
    clique_lower_bound: lower,
    clique,
    optimal,
    exact_status: result.exact_status ?? (optimal ? 'proved-by-bound' : 'heuristic'),
    nodes: result.nodes ?? 0,
    trace: result.trace.map(s => ({
      ...s,
      color: optimized.permutation[s.color]
    })),
    validation: verification,
    graph: g,
    soft: optimized.soft,
    slotsPerDay
  };
}

export function compare(data, options = {}) {
  const results = ['welsh-powell', 'dsatur'].map(algorithm => solve(data, {
    ...options,
    algorithm
  }));
  if (normalize(data).courses.length <= 18) results.push(solve(data, {
    ...options,
    algorithm: 'exact'
  }));
  return results;
}
