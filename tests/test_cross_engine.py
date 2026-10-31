"""Optional parity checks between independently implemented Python and browser engines.

Node is used only by these tests, never by the Python application. Environments
without Node skip this module's cases and retain the full Python test suite.
"""
import json
from pathlib import Path
import shutil
import subprocess
import unittest
from scheduler import load, generate, build_graph, color_graph, validate
from scheduler.timetable import assignments_from_schedule

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")
SCRIPT = r'''
import {parseJSON,buildGraph,solve} from './dist/engine.js';
let input='';for await(const chunk of process.stdin)input+=chunk;
const data=parseJSON(input);
const graph=buildGraph(data);
const results=['welsh-powell','dsatur'].map(algorithm=>{
 const result=solve(data,{algorithm,optimize:false});
 return {algorithm,colors:result.colors,slots:result.slot_count,
  exported:{assignments:Object.entries(result.colors).map(([course_id,color])=>({course_id,slot:color+1}))}};
});
process.stdout.write(JSON.stringify({graph,results}));
'''

@unittest.skipUnless(NODE, "Node is optional; browser/Python parity tests require Node.")
class CrossEngineTests(unittest.TestCase):
    def browser(self, dataset):
        result = subprocess.run([NODE, "--input-type=module", "-e", SCRIPT], input=json.dumps(dataset.as_dict()),
                                capture_output=True, text=True, cwd=ROOT, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def assert_parity(self, dataset):
        browser = self.browser(dataset)
        graph = build_graph(dataset)
        self.assertEqual(browser["graph"]["edges"], graph.edges)
        self.assertEqual(browser["graph"]["adj"], {c: sorted(ns) for c, ns in graph.adjacency.items()})
        self.assertEqual({(edge["source"], edge["target"]): edge["students"] for edge in browser["graph"]["weights"]}, graph.weights)
        for result in browser["results"]:
            python = color_graph(graph, result["algorithm"])
            self.assertEqual(result["slots"], python.slots)
            self.assertEqual(result["colors"], python.colors)
            imported = assignments_from_schedule(result["exported"])
            self.assertTrue(validate(dataset, imported)["valid"])

    def test_shared_cohort_fixture_and_export_interop(self):
        self.assert_parity(load(ROOT / "examples/cohort_30_300.json"))

    def test_five_cycle_and_seeded_registrations(self):
        self.assert_parity(load(ROOT / "examples/cycle5.json"))
        for seed in range(5):
            with self.subTest(seed=seed):
                self.assert_parity(generate(courses=12, students=40, min_courses=2, max_courses=4, seed=seed))

if __name__ == "__main__":
    unittest.main()
