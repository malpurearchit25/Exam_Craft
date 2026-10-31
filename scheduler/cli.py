"""Command-line interface. Run ``python -m scheduler --help``."""
import argparse
import json
import sys
from pathlib import Path
from .data import load, generate, save_dataset
from .graph import build_graph
from .coloring import color_graph, ALGORITHMS
from .timetable import make_schedule, validate, assignments_from_schedule
from .export import export_all

def parser():
    p = argparse.ArgumentParser(prog="examcraft", description="Graph coloring for conflict-free university exam scheduling.")
    p.add_argument("--version", action="version", version="ExamCraft 1.0.0")
    sub = p.add_subparsers(dest="command", required=True)
    gen = sub.add_parser("generate", help="Create a reproducible synthetic registration dataset.")
    gen.add_argument("--courses", type=int, default=30)
    gen.add_argument("--students", type=int, default=300)
    gen.add_argument("--min-courses", type=int, default=3)
    gen.add_argument("--max-courses", type=int, default=5)
    gen.add_argument("--seed", type=int, default=42)
    gen.add_argument("--output", required=True)
    solve = sub.add_parser("solve", help="Build, color, validate and export a timetable.")
    solve.add_argument("input")
    solve.add_argument("--algorithm", choices=ALGORITHMS, default="dsatur")
    solve.add_argument("--output-dir", default="output")
    solve.add_argument("--slots-per-day", type=int, choices=range(1, 5), default=3)
    solve.add_argument("--start-date", default="2026-11-02")
    solve.add_argument("--skip-weekends", action="store_true")
    solve.add_argument("--optimize-gaps", action="store_true")
    solve.add_argument("--time-limit", type=float, default=3.0)
    solve.add_argument("--node-limit", type=int, default=100_000)
    compare = sub.add_parser("compare", help="Compare heuristics and optionally bounded exact search.")
    compare.add_argument("input")
    compare.add_argument("--exact", action="store_true")
    compare.add_argument("--time-limit", type=float, default=3.0)
    compare.add_argument("--node-limit", type=int, default=100_000)
    val = sub.add_parser("validate", help="Independently verify a saved schedule against registrations.")
    val.add_argument("input")
    val.add_argument("schedule")
    return p

def main(argv=None):
    p = parser()
    args = p.parse_args(argv)
    try:
        if args.command == "generate":
            dataset = generate(args.courses, args.students, args.min_courses, args.max_courses, args.seed)
            save_dataset(dataset, args.output)
            print(f"Created {args.output}: {len(dataset.courses)} courses, {len(dataset.students)} students (seed {args.seed}).")
            return 0
        dataset = load(args.input)
        if args.command == "validate":
            value = json.loads(Path(args.schedule).read_text(encoding="utf-8"))
            report = validate(dataset, assignments_from_schedule(value))
            print(json.dumps(report, indent=2))
            return 0 if report["valid"] else 1
        graph = build_graph(dataset)
        if args.command == "compare":
            print(f"{'Algorithm':<16} {'Slots':>5} {'Bound':>5} {'Milliseconds':>13}  Evidence")
            for algorithm in (*ALGORITHMS[:2], *(["exact"] if args.exact else [])):
                result = color_graph(graph, algorithm, args.time_limit, args.node_limit)
                print(f"{algorithm:<16} {result.slots:>5} {result.lower_bound:>5} {result.elapsed_ms:>13.3f}  {result.status}")
            return 0
        result = color_graph(graph, args.algorithm, args.time_limit, args.node_limit)
        schedule = make_schedule(dataset, graph, result, args.start_date, args.slots_per_day, args.skip_weekends, args.optimize_gaps)
        paths = export_all(schedule, graph, args.output_dir)
        print(f"{len(dataset.courses)} courses | {graph.edges} conflict edges | {result.slots} slots | 0 student clashes")
        print(f"Bounds: {result.lower_bound} <= chi(G) <= {result.slots}. " + ("Minimum proven." if result.optimal else "Minimum not proven."))
        print(f"{'Slot':<6} {'Date':<12} {'Time':<14} Courses")
        for slot in schedule["slots"]:
            print(f"{slot['slot']:<6} {slot['date']:<12} {slot['time']:<14} {', '.join(slot['courses'])}")
        for warning in dataset.warnings:
            print("Warning: " + warning, file=sys.stderr)
        print("\nExports:\n" + "\n".join(paths))
        return 0
    except (ValueError, OSError, KeyError, TypeError, RecursionError) as error:
        p.exit(2, f"error: {error}\n")
