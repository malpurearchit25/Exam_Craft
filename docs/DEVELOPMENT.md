# Development and extension guide

## Run and inspect

The Python engine uses the standard library. Run it directly from the repository root with `python3 -m scheduler`. Optional editable packaging is available with `python3 -m pip install -e .`; packaging requires setuptools and may need access to the configured package source. Installation is unnecessary for classroom use.

Serve the web app with `python3 -m http.server 8000 --directory dist`. The JavaScript engine is an ES module. Node.js is used for its automated tests; the browser app itself has no Node runtime requirement.

## Module responsibilities

| Python module | Responsibility |
| --- | --- |
| `data.py` | Validated data structures, CSV / JSON import, seeded generator |
| `graph.py` | Adjacency construction, enrolment and edge weights, clique certificate |
| `coloring.py` | Welsh–Powell, DSatur, bounded exact search, trace and proof information |
| `timetable.py` | Direct student validation, soft metrics, class permutation, calendar mapping |
| `export.py` | CSV, structured JSON, conflict report, graph export, printable HTML |
| `cli.py` | Arguments, commands, formatted terminal results, exit status |
| `__main__.py` | `python -m scheduler` entry point |

The web app separates the reusable `engine.js` module from the UI module, HTML structure, and CSS. The browser engine has no dependency on the Python code. Cross-engine tests use shared data to check important common behaviour.

## Invariants worth preserving

- Every declared course is a graph vertex, including isolates.
- Adjacency is symmetric and excludes self-loops.
- An edge weight counts distinct students, not duplicate rows.
- A returned colouring covers all courses and is proper.
- A reported lower bound is justified by a real certificate or completed proof.
- A timeout never claims infeasibility or optimality without evidence.
- Reordering classes preserves clashes and the slot count.
- The final exported assignment is validated after any reordering.
- Exported slot numbering is explicit and converted at interface boundaries.

## Adding an algorithm

1. Accept the existing graph representation and return a colour map plus trace / metadata.
2. Use deterministic tie-breaking where feasible.
3. Independently validate the output against registrations.
4. Report the actual slot count as an upper bound.
5. Set minimum-proof status only with a valid mathematical justification.
6. Add a CLI / UI choice and test it against known graph families and a separate small-instance oracle.
7. Update the documentation and preserve exported schema compatibility.

A new heuristic need not outperform every existing heuristic on every graph. Report measured comparisons rather than assuming superiority.

## Adding constraints

Room capacity cannot be solved just by renaming colours: it limits how much can share one period. Variable examination durations can overlap more than one slot and require a richer time model. Individual unavailable periods introduce vertex-specific allowed colours. Add these as explicit constraints with separate validation, rather than silently treating ordinary colouring as sufficient.

For a production API, a future server can wrap the Python package. The current app does not pretend to supply a persistent backend, accounts, or shared collaborative database.

## Meaningful test workflow

```bash
python3 -m unittest discover -s tests -v
node --test tests/*.mjs
```

The Python discovery includes cross-engine checks when Node is available. Inspect skip messages if Node is absent. Small random graph tests compare exact colouring with an independent brute-force oracle; they are stronger than merely checking that a function returns its own expected fields.

When changing import rules, add a malformed or boundary case that would have failed before the fix. When changing proof logic, include interrupted searches and examples with a loose clique bound. When changing timetable logic, include a day boundary and a permutation that improves the stated penalty.

## Contributions and academic ownership

Review and understand generated code before presenting it. Run the tests, reproduce the worked example manually, fill the report's actual team details, and follow your institution's rules on declaring assistance. Keep changes focused and document limitations honestly. The team should be able to explain the model, core loops, proof status, and validation method without relying on the interface.


## Export and worker boundaries

`dist/worker.js` runs scheduling outside the UI thread. `dist/exporters.js` contains pure calendar and export functions shared by the UI and ten byte-level export tests. Internal colors are zero-based; exported assignments are one-based and can be checked by the Python validator. The UI keeps registrations in memory for the current visit and performs no scheduling API requests.

## Rebuilding the printable companion guide

The normal application and CLI have no third-party dependencies. The optional developer-only guide generator uses ReportLab:

```bash
python3 -m pip install reportlab
python3 tools/build_guide.py --help
```

See the script's argument parser for destination options. The original ten-page guide is delivered separately from the runtime code.
