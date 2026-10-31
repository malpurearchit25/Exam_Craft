# Demonstration and presentation guide

## Preparation

1. Extract the complete project and open a terminal in its root directory.
2. Use Python 3.10 or newer. No Python dependency installation is required.
3. Run the test commands in the README and review `VALIDATION.md`.
4. Open the web application through a local HTTP server or the supplied hosted link. A `file://` double-click may block ES module imports, so use the server command.
5. Use only synthetic registrations for a classroom demonstration.
6. Fill the team-member, division, roll-number, and instructor placeholders in the report before submission.

## Five-minute live demo

| Time | Presenter action | Explain |
| --- | --- | --- |
| 0:00–0:40 | Open the application and show a small dataset | Courses become vertices; shared registrations become edges. |
| 0:40–1:20 | Show the conflict graph | One edge prohibits simultaneous exams; its weight counts affected students. |
| 1:20–2:00 | Generate a DSatur timetable | Each slot is an independent set. A valid result is checked against registrations. |
| 2:00–2:40 | Compare with Welsh–Powell | Static degree order versus dynamically changing saturation. Equal results are valid experimental findings. |
| 2:40–3:20 | Look up a student | Their exams appear in distinct slots; discuss the consecutive-pair penalty. |
| 3:20–4:10 | Open the five-cycle example and run exact mode | Three slots are necessary, even though the maximum clique is only two. |
| 4:10–5:00 | Download a timetable and a schedule report | Explain validity, lower bound, upper bound, and whether minimum is proven. |

Use the UI's actual available controls and labels; do not promise that one algorithm will use fewer slots on every input. Import `examples/cycle5.json` for the small exact-search example.

## Ten-minute academic presentation outline

1. **Problem and motivation:** Manual registration conflict checking grows difficult as enrolments expand.
2. **Model:** Define V, E, a proper colouring, and the slot interpretation.
3. **Correctness:** Present the contradiction argument connecting shared registration to an edge and a clash.
4. **Algorithms:** Show the Welsh–Powell pass and the meaning of saturation degree.
5. **Optimality:** Explain lower / upper bounds, NP-hardness, and the bounded exact mode.
6. **Implementation:** Show the input parser, adjacency sets, independent validator, and exports.
7. **Live demonstration:** Use one small worked case and one reproducible mock dataset.
8. **Evaluation:** Show the actual validation record and compare algorithms on identical data.
9. **Limitations:** Rooms, invigilators, and variable exam durations are future constraints.
10. **Conclusion:** Explain what the team learned about mathematical modelling and verification.

## CLI demonstration

Run from the project root:

```bash
python3 -m scheduler generate --courses 30 --students 300 --min-courses 3 --max-courses 5 --seed 42 --output examples/demo.json
python3 -m scheduler compare examples/demo.json
python3 -m scheduler solve examples/demo.json --algorithm dsatur --output-dir output/demo --slots-per-day 3 --start-date 2026-11-02 --skip-weekends --optimize-gaps
python3 -m scheduler validate examples/demo.json output/demo/schedule.json
```

The example start date is an illustrative examination-calendar setting. Change it to your intended exam date.

Show these generated files:

- `timetable.csv`: each course assigned to a human-readable slot and calendar position;
- `schedule.json`: structured result with assignment and algorithm information;
- `conflict_report.json`: independent validation and student-level clash information;
- `graph.json`: inspectable graph representation;
- `report.html`: printable report that opens in a browser.

Inspect `python3 -m scheduler --help` and the subcommand help for the authoritative current arguments.

## Explain a failed validation

Make a temporary copy of a schedule. Change two courses taken by one student to the same slot, leaving the input registrations unchanged. Validate the temporary copy and explain the reported clash. Do this only on the copy; retain the original valid report for submission. Inspect the JSON assignment schema before editing instead of guessing its key names.

A stronger second demonstration is to remove one course assignment. Explain why the validator rejects incomplete coverage even if no simultaneous pair remains.

## Team role suggestions

| Role | Suggested responsibility |
| --- | --- |
| Mathematical modelling | Graph definition, correctness proof, bounds, five-cycle explanation |
| Algorithms | Welsh–Powell, DSatur, exact search, complexity |
| Implementation and data | Parsers, graph storage, validation, CLI and exports |
| Interface and evaluation | Web demo, student lookup, comparison, reproducibility |

Adapt these roles to the actual team. Every member should still be able to explain the core graph-colouring model and the difference between validity and optimality.

## If the internet is unavailable

Use the local browser app or Python CLI. The browser app does not require a Python API, a database, or an external account. Start the included local HTTP server command, then import a bundled example. Save important demo exports beforehand as a backup.

## If exact search reaches its budget

Explain that the result remains a valid incumbent while the minimum is unproven. Show the best upper bound and safe lower bound. Use the small five-cycle example to demonstrate completed proof. An honest cutoff is an expected property of bounded exponential search.
