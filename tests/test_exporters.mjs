/** Run with: node --test tests/test_exporters.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV, solve} from '../dist/engine.js';
import {csv, registrationsCSV, calendarSlots, scheduleJSON, timetableCSV, calendarICS, htmlReport} from '../dist/exporters.js';

const settings = {startDate:'2026-10-30', slotsPerDay:3, duration:120, skipWeekends:true, optimize:true};
const data = {
  courses: Array.from({length:7}, (_, index) => ({id:`C${index+1}`, name:`Exam ${index+1}`})),
  students: [{student_id:'S1', courses:Array.from({length:7}, (_, index) => `C${index+1}`)}]
};
const result = solve(data, {optimize:false});
const calendar = calendarSlots(result.slots, settings);
const stamp = new Date('2026-10-28T01:02:03.456Z');

function unfold(text) {
  return text.replace(/\r\n[ \t]/g, '');
}
function events(text) {
  return unfold(text).split('BEGIN:VEVENT\r\n').slice(1).map(block => {
    const lines = block.split('\r\nEND:VEVENT')[0].split('\r\n');
    return Object.fromEntries(lines.map(line => {const colon = line.indexOf(':'); return [line.slice(0,colon), line.slice(colon+1)];}));
  });
}
function decodeUID(uid) {
  const encoded = uid.split('-')[0];
  return new TextDecoder().decode(Uint8Array.from(encoded.match(/../g).map(hex => parseInt(hex,16))));
}
function csvRecords(text) {
  // A small independent RFC-style CSV reader for exporter assertions.
  const records = [];
  let record = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for(let index=0; index<text.length; index++) {
    const character = text[index];
    if(character === '"') {
      if(quoted && text[index+1] === '"') {cell += '"'; index++;}
      else quoted = !quoted;
    } else if(character === ',' && !quoted) {record.push(cell); cell = '';}
    else if(character === '\r' && text[index+1] === '\n' && !quoted) {
      record.push(cell); records.push(record); record = []; cell = ''; index++;
    } else cell += character;
  }
  return records;
}

test('calendar uses deterministic date arithmetic, weekend skipping and fixed daily hours', () => {
  assert.deepEqual(calendar.map(slot=>slot.date), ['2026-10-30','2026-10-30','2026-10-30','2026-11-02','2026-11-02','2026-11-02','2026-11-03']);
  assert.deepEqual(calendar.map(slot=>slot.hour), [9,12,15,9,12,15,9]);
  assert.deepEqual(calendar.map(slot=>slot.slot), [1,2,3,4,5,6,7]);
  const weekend = calendarSlots([['A'],['B'],['C']], {...settings,startDate:'2026-10-31',slotsPerDay:2});
  assert.deepEqual(weekend.map(slot=>slot.date), ['2026-11-02','2026-11-02','2026-11-03']);
  const noSkip = calendarSlots([['A'],['B'],['C']], {...settings,startDate:'2026-10-31',slotsPerDay:2,skipWeekends:false});
  assert.deepEqual(noSkip.map(slot=>slot.date), ['2026-10-31','2026-10-31','2026-11-01']);
});

test('calendar correctly crosses leap days, month boundaries and year boundaries', () => {
  const fourSlots = [['A'],['B'],['C'],['D']];
  assert.deepEqual(calendarSlots(fourSlots,{...settings,startDate:'2028-02-28',slotsPerDay:2}).map(slot=>slot.date), ['2028-02-28','2028-02-28','2028-02-29','2028-02-29']);
  assert.deepEqual(calendarSlots(fourSlots,{...settings,startDate:'2026-12-31',slotsPerDay:2}).map(slot=>slot.date), ['2026-12-31','2026-12-31','2027-01-01','2027-01-01']);
  const sixSlots = [...fourSlots,['E'],['F']];
  assert.equal(calendarSlots(sixSlots,{...settings,startDate:'2026-12-31',slotsPerDay:2})[4].date,'2027-01-04');
  const originals = JSON.stringify(result.slots); const cal = calendarSlots(result.slots,settings); cal[0].courses.push('EXTRA');
  assert.equal(JSON.stringify(result.slots), originals);
});

test('calendar rejects invalid dates and unsupported timing settings', () => {
  for(const changes of [{startDate:'2026-02-29'},{startDate:'2026-13-01'},{startDate:'31-10-2026'},{slotsPerDay:1},{slotsPerDay:5},{slotsPerDay:2.5},{duration:59},{duration:121}]) {
    assert.throws(()=>calendarSlots([['A']],{...settings,...changes}));
  }
});

test('schedule JSON has one assignment per course with one-based Python-compatible slots', () => {
  const exported = scheduleJSON(data,result,settings,calendar);
  assert.equal(exported.schema_version,'1.0'); assert.equal(exported.slot_count,7);
  assert.deepEqual(exported.assignments.map(item=>item.course_id).sort(),data.courses.map(course=>course.id).sort());
  for(const assignment of exported.assignments) assert.equal(assignment.slot,result.colors[assignment.course_id]+1);
  assert.ok(exported.assignments.every(item=>Number.isInteger(item.slot)&&item.slot>=1));
  assert.deepEqual(exported.calendar,calendar);
  assert.deepEqual(scheduleJSON(data,result,settings).calendar,calendar);
  assert.equal(JSON.parse(JSON.stringify(exported)).validation.valid,true);
});

test('registration CSV preserves registration coverage and quoted comma/quote text', () => {
  const special = {courses:[{id:'A,B',name:'Math, "graphs"'}],students:[{student_id:'Student "One"',courses:['A,B']},{student_id:'S2',courses:['A,B']}]};
  const text = registrationsCSV(special);
  assert.ok(text.startsWith('\uFEFF'));assert.ok(text.endsWith('\r\n'));
  const parsed = parseCSV(text); assert.deepEqual(parsed,special);
  const records = csvRecords(registrationsCSV(data));
  assert.equal(records.length,8);assert.equal(new Set(records.slice(1).map(row=>row[1])).size,7);
});

test('CSV formula protection applies even inside quoted cells and handles embedded newlines', () => {
  const dangerous = ['=1+1','+SUM(A1)','@formula','-2+3','  =cmd','\tformula','\nformula','safe, "quoted"\nsecond line'];
  const text = csv([dangerous]);
  const decoded = csvRecords(text)[0];
  assert.deepEqual(decoded.slice(0,7),dangerous.slice(0,7).map(value=>"'"+value));
  assert.equal(decoded[7],dangerous[7]);
  assert.equal(text.match(/"safe, ""quoted""\nsecond line"/)?.length,1);
});

test('timetable CSV covers each course once and exports scheduled time ranges', () => {
  const records = csvRecords(timetableCSV(data,result,settings,calendar));
  assert.deepEqual(records[0],['slot','date','start_time','end_time','course_id','course_name','students']);
  assert.equal(records.length,data.courses.length+1);
  assert.deepEqual(records.slice(1).map(row=>row[4]).sort(),data.courses.map(course=>course.id).sort());
  assert.deepEqual(records[1].slice(0,4),['1','2026-10-30','09:00','11:00']);
  assert.deepEqual(records[4].slice(0,4),['4','2026-11-02','09:00','11:00']);
  const shorter = csvRecords(timetableCSV(data,result,{...settings,duration:60},calendar));
  assert.equal(shorter[1][3],'10:00');
});

test('ICS contains one unique event per course, floating local dates and UTC creation stamp', () => {
  const text = calendarICS(data,result,settings,calendar,stamp), items = events(text);
  assert.equal(items.length,data.courses.length);
  assert.equal(new Set(items.map(event=>event.UID)).size,data.courses.length);
  assert.deepEqual(items.map(event=>decodeUID(event.UID)).sort(),data.courses.map(course=>course.id).sort());
  assert.equal(items[0].DTSTART,'20261030T090000'); assert.equal(items[0].DTEND,'20261030T110000');
  assert.equal(items[3].DTSTART,'20261102T090000'); assert.equal(items[0].DTSTAMP,'20261028T010203Z');
  assert.ok(items.every(event=>!event.DTSTART.endsWith('Z')&&!event.DTEND.endsWith('Z')));
  assert.ok(!text.includes('TZID='));assert.ok(text.endsWith('END:VCALENDAR\r\n'));
  assert.equal(calendarICS(data,result,{...settings,duration:60},calendar,stamp).includes('DTEND:20261030T100000'),true);
  const refreshed = events(calendarICS(data,result,settings,calendar,new Date('2030-01-01T00:00:00Z')));
  assert.deepEqual(refreshed.map(event=>event.UID),items.map(event=>event.UID));
});

test('ICS escapes text injection, folds UTF-8 octets and preserves complete Unicode', () => {
  const id = '课程😀,;\\A';
  const name = 'Graph; theory, path\\root\r\nBEGIN:VEVENT\n' + 'गणित😀'.repeat(20);
  const specialData = {courses:[{id,name}],students:[{student_id:'S',courses:[id]}]};
  const specialResult = solve(specialData,{optimize:false});
  const text = calendarICS(specialData,specialResult,settings,undefined,stamp);
  const unfolded = unfold(text), items = events(text);
  assert.equal(items.length,1);assert.equal(decodeUID(items[0].UID),id);
  assert.ok(unfolded.includes('Graph\\; theory\\, path\\\\root\\nBEGIN:VEVENT\\n'));
  assert.ok(unfolded.includes('गणित😀'.repeat(20)));
  for(const line of text.split('\r\n')) assert.ok(new TextEncoder().encode(line).length<=75,`Fold exceeded75bytes: ${line}`);
  assert.equal(text.replaceAll('\r\n','').includes('\n'),false);
  assert.equal(items[0].SUMMARY.includes('\\,'),true);assert.equal(items[0].SUMMARY.includes('\\;'),true);
});

test('HTML report escapes imported markup and contains exactly one row per course', () => {
  const specialData = {courses:[{id:'<script>&"',name:'<img src=x onerror="attack()"> & <script>attack()</script>'}],students:[{student_id:'S',courses:['<script>&"']}]};
  const specialResult = solve(specialData,{optimize:false});
  const text = htmlReport(specialData,specialResult,settings);
  assert.ok(text.includes('&lt;script&gt;&amp;&quot;'));
  assert.ok(text.includes('&lt;img src=x onerror=&quot;attack()&quot;&gt;'));
  assert.ok(!text.includes('<img'));assert.ok(!text.includes('<script>'));
  const normal = htmlReport(data,result,settings,calendar);
  assert.equal((normal.match(/<tr>/g)||[]).length,data.courses.length+1);
  for(const course of data.courses) assert.equal((normal.match(new RegExp(`<td>${course.id}</td>`,'g'))||[]).length,1);
  assert.ok(normal.includes('Minimum proved'));assert.ok(normal.includes('09:00 – 11:00'));
});
