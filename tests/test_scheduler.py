"""Meaningful correctness checks, including an independent exhaustive oracle."""
import csv
import io
import json
import random
import subprocess
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from scheduler import from_json, from_csv, generate, build_graph, color_graph, make_schedule, validate
from scheduler.data import load, save_dataset
from scheduler.model import Dataset, Graph
from scheduler.graph import clique_bound
from scheduler.timetable import optimize_gaps, consecutive_metrics, calendar_slots, assignments_from_schedule
from scheduler.export import export_all

ROOT = Path(__file__).resolve().parents[1]

def graph_with(n, edges):
    adjacency = {str(i): set() for i in range(n)}
    weights = {}
    for a, b in edges:
        a, b = str(a), str(b)
        adjacency[a].add(b)
        adjacency[b].add(a)
        weights[tuple(sorted((a, b)))] = 1
    return Graph(adjacency, weights, {str(i): set() for i in range(n)})

def brute_chromatic(graph):
    """Independent fixed-order k-color decision oracle, with no DSatur code."""
    vertices = list(graph.adjacency)
    for k in range(1, len(vertices) + 1):
        assigned = {}
        def possible(index):
            if index == len(vertices):
                return True
            v = vertices[index]
            for c in range(k):
                if all(assigned.get(u) != c for u in graph.adjacency[v]):
                    assigned[v] = c
                    if possible(index + 1):
                        return True
                    del assigned[v]
            return False
        if possible(0):
            return k
    return 0

class IngestionTests(unittest.TestCase):
    def test_csv_duplicates_trim_bom_and_quotes(self):
        data = from_csv('\ufeffstudent_id,course_id,course_name\n S1 , A ,"Logic, sets"\nS1,A,"Logic, sets"\nS2,B,Graphs\n')
        self.assertEqual(data.students["S1"], ("A",))
        self.assertEqual(data.courses["A"], "Logic, sets")
        self.assertTrue(data.warnings)

    def test_csv_rejects_bad_inputs(self):
        for text in ["student,course\nS,A", "student_id,course_id\nS,", "student_id,course_id\nS,A,x", 'student_id,course_id\nS,"unterminated', "student_id,course_id\nS"]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                from_csv(text)

    def test_json_rejects_unknown_duplicate_and_wrong_type(self):
        values = [
            {"students": [{"student_id": "S", "courses": ["A", "A"]}]},
            {"students": [{"student_id": "S", "courses": "A"}]},
            {"students": [{"student_id": "S", "courses": ["A"]}], "courses": []},
            {"students": [{"student_id": "S", "courses": ["A"]}, {"student_id": "S", "courses": ["B"]}]},
            {"students": [{"student_id": 1, "courses": ["A"]}]},
        ]
        for value in values:
            with self.subTest(value=value), self.assertRaises(ValueError):
                from_json(value)

    def test_isolated_courses_and_empty_registrations_preserved(self):
        data = from_json({"courses": [{"id": "A"}, {"id": "B"}], "students": [{"student_id": "S", "courses": []}]})
        self.assertEqual(color_graph(build_graph(data)).slots, 1)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "d.json"
            save_dataset(data, path)
            self.assertEqual(load(path), data)
            with self.assertRaises(ValueError):
                save_dataset(data, Path(directory) / "lossy.csv")

    def test_generator_reproducible_and_limits(self):
        self.assertEqual(generate().as_dict(), generate().as_dict())
        self.assertNotEqual(generate(seed=1).as_dict(), generate(seed=2).as_dict())
        for kwargs in [{"courses": 0}, {"students": 0}, {"courses": 2}, {"min_courses": 5, "max_courses": 3}]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                generate(**kwargs)

class GraphTests(unittest.TestCase):
    def test_edges_weights_and_isolates(self):
        data = Dataset({"A": "A", "B": "B", "C": "C"}, {"S1": ("A", "B"), "S2": ("A", "B")})
        graph = build_graph(data)
        self.assertEqual(graph.adjacency, {"A": {"B"}, "B": {"A"}, "C": set()})
        self.assertEqual(graph.weights["A", "B"], 2)
        self.assertEqual(graph.enrollment["A"], {"S1", "S2"})
        self.assertEqual(clique_bound(graph)[0], 2)

class ColoringTests(unittest.TestCase):
    def assert_proper(self, graph, result):
        self.assertEqual(set(result.colors), set(graph.adjacency))
        for v, neighbors in graph.adjacency.items():
            self.assertTrue(all(result.colors[v] != result.colors[u] for u in neighbors))

    def test_known_families(self):
        families = [
            (graph_with(7, []), 1),
            (graph_with(6, [(a, b) for a in range(6) for b in range(a + 1, 6)]), 6),
            (graph_with(5, [(i, (i + 1) % 5) for i in range(5)]), 3),
            (graph_with(6, [(i, (i + 1) % 6) for i in range(6)]), 2),
            (graph_with(7, [(a, b) for a in range(3) for b in range(3, 7)]), 2),
        ]
        for graph, expected in families:
            for algorithm in ("welsh-powell", "dsatur", "exact"):
                with self.subTest(expected=expected, algorithm=algorithm):
                    result = color_graph(graph, algorithm)
                    self.assert_proper(graph, result)
                    self.assertEqual(result.slots, expected)
                    if algorithm == "exact":
                        self.assertTrue(result.optimal)

    def test_exact_against_exhaustive_oracle(self):
        rng = random.Random(73)
        for n in range(2, 9):
            for _ in range(15):
                graph = graph_with(n, [(a, b) for a in range(n) for b in range(a + 1, n) if rng.random() < .42])
                result = color_graph(graph, "exact", time_limit=5)
                self.assertEqual(result.slots, brute_chromatic(graph))
                self.assertTrue(result.optimal)
                self.assert_proper(graph, result)
                for a in result.clique_witness:
                    self.assertTrue(all(a == b or b in graph.adjacency[a] for b in result.clique_witness))

    def test_search_limit_does_not_claim_optimum(self):
        graph = graph_with(5, [(i, (i + 1) % 5) for i in range(5)])
        result = color_graph(graph, "exact", node_limit=0)
        self.assertEqual(result.status, "search_limit")
        self.assertFalse(result.optimal)
        self.assertEqual((result.lower_bound, result.slots), (2, 3))
        self.assert_proper(graph, result)

    def test_determinism_and_guardrails(self):
        graph = build_graph(generate())
        for algorithm in ("welsh-powell", "dsatur"):
            self.assertEqual(color_graph(graph, algorithm).colors, color_graph(graph, algorithm).colors)
        with self.assertRaises(ValueError):
            color_graph(graph, "unknown")
        with self.assertRaises(ValueError):
            color_graph(graph, "exact", time_limit=0)
        with self.assertRaises(ValueError):
            color_graph(build_graph(generate(courses=61)), "exact")

class TimetableTests(unittest.TestCase):
    def test_validator_catches_clashes_missing_extra_and_invalid(self):
        data = Dataset({"A": "A", "B": "B"}, {"S": ("A", "B")})
        self.assertFalse(validate(data, {"A": 0, "B": 0})["valid"])
        self.assertFalse(validate(data, {"A": 0})["valid"])
        self.assertFalse(validate(data, {"A": 0, "B": 1, "X": 2})["valid"])
        self.assertFalse(validate(data, {"A": False, "B": 1})["valid"])
        self.assertTrue(validate(data, {"A": 0, "B": 1})["valid"])

    def test_gap_swap_strictly_improves_example(self):
        data = Dataset({c: c for c in "ABCD"}, {"S1": ("A", "B"), "S2": ("C", "D")})
        colors = {"A": 0, "B": 1, "C": 2, "D": 3}
        improved, metrics = optimize_gaps(data, colors, 2)
        self.assertEqual(metrics["before"], 2)
        self.assertEqual(metrics["after"], 0)
        self.assertTrue(validate(data, improved)["valid"])
        self.assertEqual(len(set(colors.values())), len(set(improved.values())))

    def test_gap_optimization_nonincreasing_random(self):
        for seed in range(15):
            data = generate(courses=15, students=60, seed=seed)
            colors = color_graph(build_graph(data)).colors
            for per_day in (1, 2, 3, 4):
                improved, metrics = optimize_gaps(data, colors, per_day)
                self.assertLessEqual(metrics["after"], metrics["before"])
                self.assertEqual(metrics["after"], consecutive_metrics(data, improved, per_day)["consecutive_exam_pairs"])
                self.assertTrue(validate(data, improved)["valid"])

    def test_calendar_weekend_and_partial_days(self):
        slots = calendar_slots(5, "2026-11-06", 2, True)
        self.assertEqual([s["date"] for s in slots], ["2026-11-06", "2026-11-06", "2026-11-09", "2026-11-09", "2026-11-10"])
        with self.assertRaises(ValueError):
            calendar_slots(1, "not-a-date")
        with self.assertRaises(ValueError):
            calendar_slots(1, slots_per_day=0)

    def test_export_is_complete_escaped_and_csv_safe(self):
        data = Dataset({"=A": "<script>alert(1)</script>", "B": "Graphs"}, {"S": ("=A", "B")})
        graph = build_graph(data)
        schedule = make_schedule(data, graph, color_graph(graph), improve_gaps=True)
        with tempfile.TemporaryDirectory() as directory:
            paths = export_all(schedule, graph, directory)
            self.assertEqual(len(paths), 5)
            content = (Path(directory) / "report.html").read_text()
            self.assertNotIn("<script>", content)
            self.assertIn("&lt;script&gt;", content)
            rows = list(csv.DictReader(io.StringIO((Path(directory) / "timetable.csv").read_text())))
            self.assertEqual(rows[0]["course_id"], "'=A")
            saved = json.loads((Path(directory) / "schedule.json").read_text())
            self.assertTrue(validate(data, assignments_from_schedule(saved))["valid"])
        with self.assertRaises(ValueError):
            assignments_from_schedule({"assignments": [{"course_id": "A", "slot": True}]})
        with self.assertRaises(ValueError):
            assignments_from_schedule({"assignments": [{"course_id": "A", "slot": 1}, {"course_id": "A", "slot": 2}]})

class CLITests(unittest.TestCase):
    def run_cli(self, *arguments):
        return subprocess.run([sys.executable, "-m", "scheduler", *map(str, arguments)], cwd=ROOT, text=True, capture_output=True)

    def test_end_to_end_and_tamper_detection(self):
        with tempfile.TemporaryDirectory() as directory:
            dataset, output = Path(directory) / "input.json", Path(directory) / "output"
            self.assertEqual(self.run_cli("generate", "--courses", 8, "--students", 20, "--output", dataset).returncode, 0)
            solved = self.run_cli("solve", dataset, "--output-dir", output, "--optimize-gaps", "--skip-weekends")
            self.assertEqual(solved.returncode, 0, solved.stderr)
            self.assertEqual(self.run_cli("validate", dataset, output / "schedule.json").returncode, 0)
            self.assertEqual(self.run_cli("compare", dataset, "--exact").returncode, 0)
            schedule = json.loads((output / "schedule.json").read_text())
            for item in schedule["assignments"]:
                item["slot"] = 1
            (output / "schedule.json").write_text(json.dumps(schedule))
            self.assertEqual(self.run_cli("validate", dataset, output / "schedule.json").returncode, 1)
            self.assertEqual(self.run_cli("solve", dataset, "--start-date", "wrong").returncode, 2)
            self.assertEqual(self.run_cli("solve", Path(directory) / "missing.json").returncode, 2)

if __name__ == "__main__":
    unittest.main()
