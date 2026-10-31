/**
 * Pure, DOM-independent ExamCraft exports.
 *
 * Colours inside the solver are zero-based; timetable slots and JSON
 * assignments use one-based slot numbers for human-readable interchange.
 * Calendar events deliberately use floating campus-local time (no TZID/Z).
 */
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
} [char]));

function csvCell(value) {
  let text = String(value ?? '');
  // Quoting alone does not stop spreadsheet applications executing formulas.
  if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

/** UTF-8 BOM and CRLF records help spreadsheet applications read Unicode. */
export function csv(rows) {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function registrationsCSV(data) {
  const names = new Map(data.courses.map(course => [course.id, course.name]));
  const rows = data.students.flatMap(student => student.courses.map(id => [
    student.student_id, id, names.get(id) ?? id
  ]));
  return csv([
    ['student_id', 'course_id', 'course_name'], ...rows
  ]);
}

function validatedSettings(settings) {
  if (!settings || typeof settings !== 'object') throw new Error('Calendar settings are required.');
  const {
    startDate,
    slotsPerDay,
    duration
  } = settings;
  if (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error('The start date must use YYYY-MM-DD.');
  }
  const date = new Date(startDate + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== startDate) {
    throw new Error('The start date is not a valid calendar date.');
  }
  if (!Number.isInteger(slotsPerDay) || slotsPerDay < 2 || slotsPerDay > 4) {
    throw new Error('Slots per day must be an integer from 2 to 4.');
  }
  if (!Number.isInteger(duration) || duration < 60 || duration > 120) {
    throw new Error('Exam duration must be an integer from 60 to 120 minutes.');
  }
  return {
    date,
    slotsPerDay,
    duration
  };
}

/**
 * UTC is used only for timezone-independent date arithmetic. Exam hours below
 * represent campus-local wall-clock time, not UTC instants.
 */
export function calendarSlots(slots, settings) {
  if (!Array.isArray(slots)) throw new Error('Slots must be an array of course arrays.');
  const {
    date,
    slotsPerDay
  } = validatedSettings(settings);
  return slots.map((courses, index) => {
    if (!Array.isArray(courses)) throw new Error('Each slot must be a course array.');
    if (index % slotsPerDay === 0) {
      if (index > 0) date.setUTCDate(date.getUTCDate() + 1);
      if (settings.skipWeekends) {
        while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
          date.setUTCDate(date.getUTCDate() + 1);
        }
      }
    }
    return {
      slot: index + 1,
      courses: [...courses],
      date: date.toISOString().slice(0, 10),
      hour: 9 + 3 * (index % slotsPerDay)
    };
  });
}

function calendarOrDefault(result, settings, calendar) {
  return calendar ?? calendarSlots(result.slots, settings);
}

const timeText = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const timeRange = (hour, duration) => `${timeText(hour * 60)} – ${timeText(hour * 60 + duration)}`;

/** A plain object ready for JSON.stringify; compatible with Python validate. */
export function scheduleJSON(data, result, settings, calendar) {
  const slots = calendarOrDefault(result, settings, calendar);
  return {
    schema_version: '1.0',
    source: 'ExamCraft browser',
    algorithm: result.algorithm,
    slot_count: result.slot_count,
    assignments: Object.entries(result.colors).map(([course_id, color]) => ({
      course_id,
      slot: color + 1
    })),
    optimal: result.optimal,
    lower_bound: result.lower_bound,
    upper_bound: result.slot_count,
    clique_certificate: result.clique,
    elapsed_ms: result.elapsed_ms,
    settings: {
      ...settings
    },
    calendar: slots,
    validation: result.validation,
    soft: result.soft
  };
}

export function timetableCSV(data, result, settings, calendar) {
  const slots = calendarOrDefault(result, settings, calendar);
  const names = new Map(data.courses.map(course => [course.id, course.name]));
  const rows = slots.flatMap(slot => slot.courses.map(id => [
    slot.slot,
    slot.date,
    timeText(slot.hour * 60),
    timeText(slot.hour * 60 + settings.duration),
    id,
    names.get(id) ?? id,
    result.graph.enrollment[id]
  ]));
  return csv([
    ['slot', 'date', 'start_time', 'end_time', 'course_id', 'course_name', 'students'], ...rows
  ]);
}

function icsEscape(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,');
}

/** RFC 5545 folds by UTF-8 octets, preserving Unicode code point boundaries. */
function foldICS(text) {
  const encoder = new TextEncoder();
  const lines = [];
  let line = '',
    bytes = 0;
  for (const character of text) {
    const width = encoder.encode(character).length;
    if (bytes + width > 75) {
      lines.push(line);
      line = ' ';
      bytes = 1;
    }
    line += character;
    bytes += width;
  }
  lines.push(line);
  return lines.join('\r\n');
}

const icsDate = date => date.toISOString().replace(/[-:]/g, '').slice(0, 15);

function stableUID(id, date) {
  // Hexadecimal UTF-8 is reversible, unlike a short collision-prone hash.
  const encoded = [...new TextEncoder().encode(id)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${encoded}-${date}@examcraft.local`;
}

export function calendarICS(data, result, settings, calendar, nowDate = new Date()) {
  const slots = calendarOrDefault(result, settings, calendar);
  const names = new Map(data.courses.map(course => [course.id, course.name]));
  if (!(nowDate instanceof Date) || !Number.isFinite(nowDate.getTime())) throw new Error('The export timestamp must be a valid Date.');
  const stamp = icsDate(nowDate) + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ExamCraft//University Exam Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  for (const slot of slots) {
    const start = new Date(`${slot.date}T${String(slot.hour).padStart(2, '0')}:00:00Z`);
    const end = new Date(start.getTime() + settings.duration * 60000);
    for (const id of slot.courses) {
      const description = `ExamCraft slot ${slot.slot}. ${result.graph.enrollment[id]} enrolled students. Campus local time. ${result.optimal ? 'Minimum slots proved.' : 'Heuristic schedule; minimum unproved.'}`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${stableUID(id, slot.date)}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(start)}`,
        `DTEND:${icsDate(end)}`,
        `SUMMARY:${icsEscape(`${id} — ${names.get(id) ?? id}`)}`,
        `DESCRIPTION:${icsEscape(description)}`,
        'END:VEVENT'
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldICS).join('\r\n') + '\r\n';
}

export function htmlReport(data, result, settings, calendar) {
  const slots = calendarOrDefault(result, settings, calendar);
  const names = new Map(data.courses.map(course => [course.id, course.name]));
  const algorithm = {
    'dsatur': 'DSatur',
    'welsh-powell': 'Welsh–Powell',
    'exact': 'Exact search'
  } [result.algorithm] ?? result.algorithm;
  const body = slots.flatMap(slot => slot.courses.map(id => `
      <tr>
        <td>${escapeHTML(slot.slot)}</td>
        <td>${escapeHTML(slot.date)}</td>
        <td>${escapeHTML(timeRange(slot.hour, settings.duration))}</td>
        <td>${escapeHTML(id)}</td>
        <td>${escapeHTML(names.get(id) ?? id)}</td>
        <td>${escapeHTML(result.graph.enrollment[id])}</td>
      </tr>`)).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ExamCraft timetable report</title>
<style>
body{font:14px system-ui,sans-serif;color:#243b2e;max-width:1050px;margin:40px auto;padding:0 24px}
h1{font:38px Georgia,serif}p{line-height:1.8;color:#647660}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{padding:12px 8px;border-bottom:1px solid #dfe7d9;text-align:left}
th{background:#eff4e9}.ok{padding:16px;background:#edf4e7}
button{padding:10px 15px;cursor:pointer}
@media print{button{display:none}tr{break-inside:avoid}}
</style>
</head>
<body>
<h1>ExamCraft · Exam timetable</h1>
<p>${escapeHTML(data.courses.length)} courses · ${escapeHTML(data.students.length)} students · ${escapeHTML(result.slot_count)} slots · ${escapeHTML(algorithm)}<br>
Bounds: ${escapeHTML(result.lower_bound)} ≤ χ(G) ≤ ${escapeHTML(result.slot_count)} · ${result.optimal ? 'Minimum proved' : 'Minimum unproved'} · Campus local time</p>
<p class="ok">Independent validation: ${result.validation.valid ? 'PASS' : 'FAIL'} · ${escapeHTML(result.validation.clashes.length)} student clashes · ${escapeHTML(result.soft.after)} consecutive same-day student pairs</p>
<button onclick="window.print()">Print / Save as PDF</button>
<table>
<thead><tr><th>Slot</th><th>Date</th><th>Time</th><th>Course</th><th>Exam</th><th>Students</th></tr></thead>
<tbody>${body}
</tbody>
</table>
<p>Constraint scope: shared-student conflicts. Rooms, capacity, invigilators and holidays are outside this model. Consecutive-pair spacing is a heuristic soft objective.</p>
</body>
</html>`;
}
