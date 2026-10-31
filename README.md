# ExamCraft

**University Exam & Timetable Scheduler — Discrete Mathematics course project**

Turn student course registrations into a conflict graph, colour it, independently verify the result, and export a complete examination timetable. Includes an interactive browser application and a dependency-free Python CLI.

A colour is a time slot. An edge means at least one student takes both courses. Adjacent courses receive different colours, giving zero simultaneous examinations for any student.

> **Mathematical honesty:** Welsh–Powell and DSatur are heuristics. A valid timetable is not automatically a minimum timetable. ExamCraft reports lower / upper bounds and distinguishes a certified minimum from a best schedule found within its budget.

## Night shift edition (1.1)

Black and signal-yellow interface with responsive timetable cards, accessible focus states, reduced-motion support, and print styling. Search the timetable by course code or name. Calendar preferences survive reloads; student registrations stay in memory and are never saved to browser storage.

With Node.js 18+, run `node serve.mjs` and open http://127.0.0.1:8000. Python remains optional for the browser app and required for the CLI.

Verified: 23 JavaScript tests, 18 Python tests (including cross-engine checks), and Edge browser checks for navigation, search, saved preferences and mobile overflow. Windows CLI output now uses terminal-compatible mathematical notation.

## Start in two minutes

### Browser application

From the extracted project root:

```bash
python3 run.py
```

The launcher opens **http://127.0.0.1:8000** automatically. Keep the terminal running; press `Ctrl+C` to stop it. Use `python3 run.py --port 8001` if port 8000 is occupied, or add `--no-browser` to open the address yourself. On Windows, use `py` in place of `python3` if needed.

The browser engine runs locally and does not need a Python API or database. Use the bundled demo or generate synthetic registrations, choose an algorithm, inspect the timetable and conflict graph, look up a student, compare algorithms, and export the result. CSV / JSON imports follow the formats below. Serve the files over HTTP because ES module loading may fail when opening `index.html` directly with `file://`.

### Python CLI

Python **3.10 or newer** is required. Run from the project root; no installation or third-party Python packages are necessary.

```bash
python3 -m scheduler solve examples/cycle5.json --algorithm exact --output-dir output/cycle5
python3 -m scheduler validate examples/cycle5.json output/cycle5/schedule.json
```

The five-cycle needs three slots. The exact result proves this even though its clique witness has only two vertices. This is a useful viva example.

### Full reproducible demo

```bash
python3 -m scheduler generate --courses 30 --students 300 --min-courses 3 --max-courses 5 --seed 42 --output output/mock.json
python3 -m scheduler compare output/mock.json --exact
python3 -m scheduler solve output/mock.json --algorithm dsatur --output-dir output/demo --slots-per-day 3 --start-date 2026-11-02 --skip-weekends --optimize-gaps
python3 -m scheduler validate output/mock.json output/demo/schedule.json
```

The date is illustrative; change it for your intended exam calendar. A fully uniform random registration generator can produce a dense conflict graph. `examples/cohort_30_300.json` supplies a more structured, cohort-biased comparison case with the same 30-course / 300-student scale.

## Included capabilities

- Student-registration CSV and JSON import with validation.
- Seeded synthetic datasets, including reproducible bundled examples.
- Adjacency sets, conflict-edge weights, enrolment counts, and graph metrics.
- Welsh–Powell colour-class sweeps and dynamic DSatur colouring.
- Bounded exact search, safe clique lower bounds, and honest proof status.
- Independent clash and coverage validation from the original registrations.
- Optional reordering of colour classes to reduce same-day consecutive exam pairs.
- Calendar layout using a start date, periods per day, and optional weekend skipping.
- Browser timetable, conflict graph, algorithm comparison, student lookup, and educational trace.
- Python CSV, JSON, graph, conflict-report, and printable HTML exports.
- Browser CSV, JSON, iCalendar (.ics), printable HTML, and print / save-as-PDF controls.
- Tests against known graph families and independent small-graph brute-force oracles.
- Academic report, worked proof, viva preparation, and presentation script.

## Project map

```text
examcraft/
  dist/                 Browser app: HTML, CSS, UI module, scheduling engine
  scheduler/            Python package: parsing, graph, colouring, calendar, exports, CLI
  tests/                Python and JavaScript algorithm / integration tests
  examples/             Input datasets and generated example results
  docs/REPORT.md        Academic report and mathematical correctness proof
  docs/VIVA.md          30 viva questions with answers
  docs/DEMO_SCRIPT.md   Live demo and presentation guide
  docs/DATA_FORMAT.md   Input, output, parser differences, and validation contract
  docs/DEVELOPMENT.md   Architecture, extension points, and contribution guidance
  run.py                One-command offline browser launcher
  package.json          Optional Node test commands; no runtime dependencies
  pyproject.toml        Optional Python package metadata
```

`output/` is created when you run a solve command. Generated outputs are reproducible and may be overwritten when reusing the same output directory.

## CLI reference

Use `python3 -m scheduler --help` or add `--help` after any subcommand for the authoritative argument list.

| Command | Purpose |
| --- | --- |
| `generate --output FILE` | Create a seeded JSON or long-format CSV registration dataset |
| `solve INPUT` | Parse, build graph, colour, validate, and export a schedule |
| `compare INPUT` | Compare Welsh–Powell and DSatur on the same graph |
| `compare INPUT --exact` | Include bounded exact search in the comparison |
| `validate INPUT SCHEDULE_JSON` | Independently check a saved assignment against the original input |

### Solve options

| Option | Default | Meaning |
| --- | --- | --- |
| `--algorithm` | `dsatur` | `dsatur`, `welsh-powell`, or `exact` |
| `--output-dir` | `output` | Destination for generated timetable and reports |
| `--slots-per-day` | `3` | Number of periods per day, from 1 to 4 |
| `--start-date` | `2026-11-02` | First examination date, ISO `YYYY-MM-DD` |
| `--skip-weekends` | Off | Advance weekend dates to the next weekday |
| `--optimize-gaps` | Off | Improve same-day consecutive-pair penalty through whole-class swaps |
| `--time-limit` | `3.0` | Exact-search time budget in seconds; preprocessing is additional |
| `--node-limit` | `100000` | Exact-search node budget |

Exact mode retains a valid incumbent if a budget is exhausted. Read `proof.optimal` and `proof.status` instead of assuming the `exact` algorithm label guarantees a completed proof.

`compare` compares colouring results before calendar and optional gap optimisation. It does not claim to optimise the soft objective. CLI exit codes are `0` for success / valid schedule, `1` for a failed `validate` result, and `2` for input or command errors.

### Generator options

`--courses` defaults to 30, `--students` to 300, `--min-courses` to 3, `--max-courses` to 5, and `--seed` to 42. Set the minimum and maximum appropriately when requesting fewer than five courses.

The browser generator uses cohort-biased choices and a different pseudorandom-number generator. Identical seeds across Python and JavaScript do not imply identical generated data. Import one shared JSON file in both interfaces when comparing them.

## Input formats

### CSV: one registration per row

```csv
student_id,course_id,course_name
S001,DM,Discrete Mathematics
S001,DS,Data Structures
S002,DS,Data Structures
S002,OS,Operating Systems
```

`course_name` is optional. Repeated `student_id` values are expected because each row is a registration. Identifiers are strings; keep leading zeroes. CSV cannot express zero-enrolment courses or students with no registrations. Use JSON for those cases.

### JSON: explicit students and optional course catalogue

```json
{
  "courses": [
    {"id": "DM", "name": "Discrete Mathematics"},
    {"id": "DS", "name": "Data Structures"},
    {"id": "OS", "name": "Operating Systems"}
  ],
  "students": [
    {"student_id": "S001", "courses": ["DM", "DS"]},
    {"student_id": "S002", "courses": ["DS", "OS"]}
  ]
}
```

Use a complete, unique course catalogue and distinct per-student course IDs for portability between interfaces. The browser application accepts up to 120 courses, 5,000 students, and 5 MiB imports. Detailed parser rules and engine limits are in [DATA_FORMAT.md](docs/DATA_FORMAT.md).

## Outputs and how to read them

A Python `solve` creates:

| File | Contents |
| --- | --- |
| `timetable.csv` | Course, slot, date, time, and enrolment information |
| `schedule.json` | Full configuration, assignments, slot layout, proof metadata, soft metrics, trace, and validation |
| `conflict_report.json` | Coverage checks and individual student clashes |
| `graph.json` | Vertices, adjacency, weighted conflicts, and graph metrics |
| `report.html` | Printable report; open in a browser and print / save as PDF |

Slot numbers in the Python output are **one-based**. Internal engine colours are **zero-based**. The Python validator reads the exported `assignments` array and converts it appropriately. Do not confuse raw engine colours with timetable slot numbers.

**Interpretation example:** `lower_bound: 11`, `upper_bound: 13`, `optimal: false` means a 13-slot timetable was found, at least 11 slots are necessary, and the true minimum remains between 11 and 13. It does not prove that 13 is minimum.

The consecutive-pair penalty counts adjacent periods within one day for each student. Class reordering preserves the number of slots and cannot introduce a registration clash. A lower penalty is useful but does not prove global fairness or global soft optimality.

## Tests

Run from the project root:

```bash
python3 -m unittest discover -s tests -v
node --test tests/*.mjs
```

Node.js is needed only for the JavaScript and optional cross-engine test suites, not for running the browser app or Python CLI. The tests include known graph structures, malformed inputs, deterministic colouring, independent clash validation, exact-search cutoffs, CLI exports, and small random graphs compared with brute-force oracles. See `docs/VALIDATION.md` for the final recorded checks and their limits.

## Use the Python engine from code

```python
from scheduler import load, build_graph, color_graph, make_schedule

registrations = load("examples/cohort_30_300.json")
graph = build_graph(registrations)
result = color_graph(graph, algorithm="dsatur")
schedule = make_schedule(
    registrations, graph, result,
    start_date="2026-11-02",
    slots_per_day=3,
    skip_weekends=True,
    improve_gaps=True,
)
print(schedule["validation"]["valid"])
print(schedule["proof"])
```

The CLI remains the simplest supported entry point. The exported Python functions allow other interfaces to reuse the same engine.

## Mathematical guarantees and limits

A validated proper colouring is clash-free for the registrations supplied. Minimum slot count is certified only by matching bounds or completed exact search. Input completeness is essential: missing registrations can conceal real conflicts.

The model assumes equal-duration periods and unlimited simultaneous examination capacity. Rooms, invigilators, seating capacities, holidays, and accommodation constraints are outside the current model. The app is a course-project implementation; production institutional use would require additional operational and data-protection work.

## Submission and presentation

Read [the report](docs/REPORT.md), [viva preparation](docs/VIVA.md), and [demo script](docs/DEMO_SCRIPT.md). Fill the explicit team and instructor placeholders before submission. Keep the example inputs, generated outputs, and validation record together so reviewers can reproduce the demonstration.
