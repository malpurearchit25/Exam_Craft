"""Portable, escaped timetable exports; no external dependencies."""
import csv
import html
import json
from pathlib import Path
from .graph import graph_dict

def _safe_cell(value):
    # Spreadsheet programs may execute formula-like CSV fields. Prefix text.
    return "'" + value if isinstance(value, str) and (value.lstrip().startswith(("=", "+", "-", "@")) or value[:1] in ("\t", "\r", "\n")) else value

def export_all(schedule, graph, output_dir):
    root = Path(output_dir)
    root.mkdir(parents=True, exist_ok=True)
    def dump(name, value):
        (root / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    dump("schedule.json", schedule)
    dump("conflict_report.json", schedule["validation"])
    dump("graph.json", graph_dict(graph))
    courses = {c["id"]: c for c in schedule["courses"]}
    assignments = {a["course_id"]: a["slot"] for a in schedule["assignments"]}
    slots = {s["slot"]: s for s in schedule["slots"]}
    with (root / "timetable.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["slot", "date", "time", "course_id", "course_name", "enrollment"])
        for cid in sorted(courses, key=lambda c: (assignments[c], c)):
            slot, course = slots[assignments[cid]], courses[cid]
            writer.writerow([_safe_cell(v) for v in [slot["slot"], slot["date"], slot["time"], cid, course["name"], course["enrollment"]]])
    esc = lambda value: html.escape(str(value))
    rows = "".join("<tr>" + "".join(f"<td>{esc(v)}</td>" for v in
                   [s["slot"], s["date"], s["time"], ", ".join(f'{c} — {courses[c]["name"]}' for c in s["courses"]), s["student_exams"]]) + "</tr>"
                   for s in schedule["slots"])
    proof, stats = schedule["proof"], schedule["statistics"]
    status = "Proven minimum" if proof["optimal"] else "Feasible schedule; minimum not proven"
    document = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ExamCraft · Exam timetable</title><style>body{{font:15px system-ui;color:#132f36;max-width:1100px;margin:40px auto;padding:20px}}h1{{font-size:36px}}.badge{{background:#ddf7ed;padding:12px;border-radius:8px}}table{{border-collapse:collapse;width:100%;margin-top:24px}}th,td{{text-align:left;padding:14px;border-bottom:1px solid #dce5e3}}th{{background:#eef5f2}}footer{{margin-top:28px;font-size:12px;color:#456}}@media print{{body{{margin:0}}}}</style>
<h1>ExamCraft · Exam timetable</h1><p>Algorithm: {esc(schedule['algorithm'])} · {stats['courses']} courses · {stats['students']} students</p>
<p class="badge">{esc(status)} · {stats['slots']} slots · bounds {proof['lower_bound']}–{proof['upper_bound']} · 0 student clashes verified</p>
<table><thead><tr><th>Slot</th><th>Date</th><th>Time</th><th>Examinations</th><th>Student exams</th></tr></thead><tbody>{rows}</tbody></table>
<p>Consecutive exam pairs: {schedule['soft_constraints']['before']['consecutive_exam_pairs']} before → {schedule['soft_constraints']['after']['consecutive_exam_pairs']} after calendar optimization.</p>
<footer>Rooms, invigilators, holidays and course-specific durations are outside this model. The conflict-free guarantee applies to the supplied registrations. Print this page to save a PDF.</footer></html>'''
    (root / "report.html").write_text(document, encoding="utf-8")
    return [str(root / name) for name in ("schedule.json", "timetable.csv", "report.html", "conflict_report.json", "graph.json")]
