# Validation record

Recorded on **28 October 2026** for ExamCraft 1.0.0.

## Automated checks

Environment: Python 3.12 and Node.js 24.22.1. Python 3.10+ and Node 18+ are the declared minimum versions; the minimum versions were not separately exercised in this environment.

| Check | Result |
| --- | --- |
| `python3 -m unittest discover -s tests -v` | 18 passed, including 2 optional Node-backed cross-engine tests |
| `node --test tests/*.mjs` | 23 passed: 13 engine and 10 export tests |
| JavaScript syntax checks | Passed for app, engine, worker and exporters |
| Python compilation | Passed for scheduler package and launcher |
| Launcher and CLI help | Passed |
| Downloaded browser schedule → Python independent validator | Valid: 300 students, 1,356 registrations, no missing/unknown courses or clashes |
| Downloaded browser CSV | 30 unique courses, 13 slots, expected five exam dates |

**41 named tests pass.** Individual tests contain many distinct cases. In particular, the JavaScript exact solver is checked against an independent brute-force oracle on all 1,024 labelled simple graphs with five vertices and on 70 random graphs with six to nine vertices. Python exact search is compared against a separate brute-force oracle on 105 random cases. This is strong finite evidence, not a claim of exhaustive testing of all possible graphs.

Other assertions cover known graph families; weighted symmetric adjacency; isolated courses; malformed CSV and JSON; duplicate registration policies; exact-search interruption; deterministic tie-breaking; independent collision and coverage checks; gap optimization invariants; calendar boundaries; CLI solve/export/validate; and deliberate schedule tampering.

Export tests verify one entry per course, one-based JSON assignments, quoted CSV, spreadsheet formula protection, escaped HTML, iCalendar text escaping, unique event IDs, floating local exam times, UTC creation timestamps, UTF-8 line folding within 75 octets, weekend skipping, duration, leap days and month/year boundaries.

## Reproducible results

All below use the bundled inputs. The cohort runs use three slots per day and gap optimization.

| Dataset / method | Courses | Students | Edges | Slots | Proof | Consecutive pairs before → after |
| --- | --- | --- | --- | --- | --- | --- |
| Cohort / Python DSatur | 30 | 300 | 316 | 13 | Clique 11; minimum unproved | 253 → 108 |
| Cohort / browser DSatur | 30 | 300 | 316 | 13 | Clique 11; minimum unproved | 253 → 108 |
| Cohort / Python exact | 30 | 300 | 316 | 12 | Search exhausted; minimum proved | 328 → 154 |
| Five-cycle / exact | 5 | 5 | 5 | 3 | Search proof; clique witness 2 | Depends on gap/calendar setting |

The 30-course Python exact search used 593 search nodes. Wall-clock timings vary by machine and load and are not treated as a performance guarantee. The Python and browser gap algorithms differ; equal results on one input do not establish identical soft optimization behaviour.

To reproduce the main result:

```bash
python3 -m scheduler solve examples/cohort_30_300.json --algorithm exact --output-dir output/cohort_exact --slots-per-day 3 --skip-weekends --optimize-gaps
python3 -m scheduler validate examples/cohort_30_300.json output/cohort_exact/schedule.json
```

## Browser workflow checks

The actual application was exercised in Chrome through its interface:

- Default 30-course / 300-student dataset loads and generates a complete 13-slot, five-day schedule with zero student clashes.
- Conflict graph selection changes the course details and shared-student counts.
- Welsh–Powell / DSatur comparison reports bounds, slot counts, runtime and soft objective.
- Student lookup for `ST0001` displays five exams in slot order; course search filters the catalog.
- Malformed CSV is rejected with a useful error while retaining the previous dataset.
- Pasted five-cycle registrations produce a three-slot schedule. Exact search then displays a proved minimum of three, despite a clique certificate of two.
- Calendar settings with a Friday start, two slots per day and 90-minute duration place the next day on Monday and display the correct start/end times.
- Mock generation with 8 courses, 20 students, 2–3 courses per student and seed 7 produces 52 registrations and a verified 5-slot schedule.
- The mathematics view renders its model, bounds and proofs; moving the trace slider to the first step shows exactly one assignment row.
- A full schedule JSON was downloaded and independently validated by Python. A timetable CSV was downloaded and checked for course coverage and dates.

## Verification limits

The cloud browser did not consistently return download-completion events for iCalendar and later repeated downloads. CSV and JSON downloads were obtained successfully. ICS and HTML content, escaping and coverage are covered by automated byte-level tests; importing ICS into an external calendar application was not exercised. No external calendar account is required to use the export.

The desktop interface was visually inspected. Responsive CSS, semantic controls, keyboard graph selection and native dialogs are implemented; a separate mobile device, every browser version and a complete accessibility audit were not tested. The private hosted release is verified by the deployment result and checked separately at handoff.

The scheduler certifies conflicts only for the registrations supplied. Rooms, capacity, invigilators, holidays and different per-course durations are outside the implemented constraint model. Exact search is bounded; interrupted results retain a valid incumbent and an honest unproved-minimum label.
