# Data and export contract

## Portable input subset

Use UTF-8 JSON with a `students` array and, preferably, a complete `courses` catalogue. Student and course identifiers are strings. Trim surrounding whitespace, use unique catalogue IDs and student IDs, and give each student a distinct list of known course IDs.

```json
{
  "courses": [{"id": "DM", "name": "Discrete Mathematics"}],
  "students": [{"student_id": "S001", "courses": ["DM"]}]
}
```

If `courses` is omitted, the engines infer courses from registrations. An explicit catalogue can preserve courses without students. A student with no courses is best represented in JSON.

For CSV, use one registration per row:

```csv
student_id,course_id,course_name
S001,DM,Discrete Mathematics
S002,DM,Discrete Mathematics
```

`student_id` and `course_id` are required. `course_name` is optional. Quoted cells, escaped quotes, and CRLF line endings are supported. All appearances of the same course must use a consistent name. Exact duplicate registration rows are deduplicated, rather than counted as additional students or weighted conflicts.

Long-format CSV cannot preserve an unregistered course or a zero-course student. The Python generator rejects a CSV export when it would lose such data; use JSON instead.

## Limits and intentional implementation differences

| Property | Python CLI | Browser engine |
| --- | --- | --- |
| Course cap | 200 | 200 engine / 120 application |
| Student cap | 20,000 | 10,000 engine / 5,000 application |
| Input file cap | 10 MiB | 5 MiB application import limit; engine also caps registrations |
| Browser engine registration cap | Not this browser-specific cap | 100,000 |
| Exhaustive-search course policy | Up to 60 | Up to 18 |
| Exact default budget | 3 seconds / 100,000 nodes | 1 second / 100,000 nodes at engine level; UI may choose a budget |
| Duplicate CSV registration | Deduplicate with warning | Deduplicate |
| Duplicate JSON student IDs | Reject | Reject |
| Duplicate JSON courses within one student | Reject | Normalise to a set |
| Unknown registered course with supplied catalogue | Reject | Infer and append course |
| Pseudorandom generator | Python standard-library generator | JavaScript seeded generator |
| Mock registration pattern | Uniform choices | Cohort-biased choices |

For consistent input acceptance across interfaces, use the portable subset described above. A shared valid dataset can be solved by either engine; identical generator seeds do not imply identical data. The cross-engine tests verify graph construction and deterministic heuristic assignments on shared fixtures rather than assuming equivalence without evidence.

## Python schedule JSON

`solve` produces a versioned object with these top-level sections:

| Section | Purpose |
| --- | --- |
| `schema_version` | Export version, currently 1 |
| `algorithm` | Algorithm requested / used by the engine |
| `configuration` | Start date, periods per day, weekend policy |
| `courses` | Course ID, display name, enrolment |
| `assignments` | One `{course_id, slot}` entry per course; slot is one-based |
| `slots` | Calendar slots with course lists, date, day, time, position, student-exam count |
| `statistics` | Counts, runtime, search nodes, slot and examination-day totals |
| `proof` | `optimal`, status, safe lower bound, upper bound, clique witness and size |
| `soft_constraints` | Before / after consecutive-pair metrics and optimisation method |
| `validation` | Independent coverage and student-clash results |
| `warnings` | Parser normalisation warnings |
| `algorithm_trace` | Inspectable colouring decisions |
| `trace_note` | Clarifies how the trace relates to final slot reordering |

An abbreviated assignment:

```json
{
  "assignments": [
    {"course_id": "DM", "slot": 1},
    {"course_id": "DS", "slot": 2}
  ]
}
```

The exported assignment uses one-based slots. Internal Python and browser colour maps use zero-based values. `python3 -m scheduler validate INPUT SCHEDULE` accepts the exported assignment representation and checks it against the input registrations.

The browser export can include its own UI configuration and additional fields. Its authoritative interchange contract with the Python validator is the compatible `assignments` representation rather than every top-level metadata field. Do not assume all browser metadata has the same shape as Python metadata.

## Proof interpretation

- `optimal: true` requires matching safe bounds or completed exhaustive search.
- `upper_bound` is the number of slots in the incumbent valid colouring.
- `lower_bound` is the certified number required; after completed exact proof it may be stronger than the stored clique witness.
- `clique_witness` is an actual pairwise-adjacent course set. Its size may be smaller than a lower bound established by exhaustive search.
- A budget or size cutoff means the incumbent remains valid while a smaller schedule may still exist.

Do not equate the algorithm name `exact` with `optimal: true`. Proof status and bounds carry the guarantee.

## Independent validation

The validator checks:

1. Missing course assignments.
2. Unknown extra course assignments.
3. Invalid slot values.
4. Multiple courses for one student in the same slot.

`clash_count` counts student/slot clash groups. If one student has three exams in a single slot, that is one clash group containing three courses, rather than three separately counted course pairs. `checked_students` and `checked_registrations` show the extent of the input checked.

A valid report applies to the supplied registrations. It cannot detect missing real-world registrations that were absent from the input file.

## Export handling

Python creates `timetable.csv`, `schedule.json`, `conflict_report.json`, `graph.json`, and `report.html`. HTML content is escaped and spreadsheet-facing CSV values are protected from formula interpretation. Browser exports are produced through local downloads. Keep the source registration file together with exported schedules so a reviewer can revalidate the original facts.
