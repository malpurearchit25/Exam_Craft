"""Strict CSV/JSON ingestion and reproducible registration generation."""
import csv
import io
import json
import random
from pathlib import Path
from .model import Dataset

MAX_BYTES = 10 * 1024 * 1024

def _id(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a nonempty string.")
    return value.strip()

def from_json(value):
    if not isinstance(value, dict) or not isinstance(value.get("students"), list):
        raise ValueError('JSON requires an object with a "students" array.')
    names = {}
    if "courses" in value:
        if not isinstance(value["courses"], list):
            raise ValueError('"courses" must be an array of {id, name} objects.')
        for course in value["courses"]:
            if not isinstance(course, dict):
                raise ValueError("Each course must be an object.")
            cid = _id(course.get("id"), "Course ID")
            if cid in names:
                raise ValueError(f"Duplicate course ID: {cid}.")
            names[cid] = _id(course.get("name", cid), "Course name")
    students, inferred = {}, set()
    for student in value["students"]:
        if not isinstance(student, dict):
            raise ValueError("Each student must be an object.")
        sid = _id(student.get("student_id"), "Student ID")
        if sid in students:
            raise ValueError(f"Duplicate student ID: {sid}.")
        if not isinstance(student.get("courses"), list):
            raise ValueError(f"Courses for {sid} must be an array.")
        courses = [_id(c, "Registered course ID") for c in student["courses"]]
        if len(set(courses)) != len(courses):
            raise ValueError(f"Duplicate registration for {sid}.")
        students[sid] = tuple(sorted(courses))
        inferred.update(courses)
    if "courses" in value and not inferred.issubset(names):
        raise ValueError("Registrations reference undeclared course IDs: " + ", ".join(sorted(inferred - names.keys())))
    if "courses" not in value:
        names = {c: c for c in sorted(inferred)}
    return Dataset(names, students)

def from_csv(text):
    reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')), strict=True)
    if not reader.fieldnames or not {"student_id", "course_id"}.issubset(reader.fieldnames):
        raise ValueError("CSV requires student_id,course_id headers; optional course_name is supported.")
    if len(reader.fieldnames) != len(set(reader.fieldnames)):
        raise ValueError("CSV contains duplicate headers.")
    students, names, duplicate_count = {}, {}, 0
    try:
        rows = list(reader)
    except csv.Error as error:
        raise ValueError(f"Malformed CSV: {error}") from error
    for line, row in enumerate(rows, 2):
        if None in row or any(v is None for v in row.values()):
            raise ValueError(f"Malformed CSV row {line}.")
        sid = _id(row["student_id"], f"Student ID on row {line}")
        cid = _id(row["course_id"], f"Course ID on row {line}")
        name = (row.get("course_name") or cid).strip()
        if cid in names and names[cid] != name:
            raise ValueError(f"Inconsistent course names for {cid}.")
        names[cid] = name
        registrations = students.setdefault(sid, set())
        duplicate_count += int(cid in registrations)
        registrations.add(cid)
    warnings = (f"Ignored {duplicate_count} duplicate CSV registration rows.",) if duplicate_count else ()
    return Dataset(names, {s: tuple(sorted(cs)) for s, cs in students.items()}, warnings)

def load(path):
    path = Path(path)
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("Input exceeds the 10 MiB limit.")
    text = path.read_text(encoding="utf-8-sig")
    if path.suffix.lower() == ".csv":
        return from_csv(text)
    if path.suffix.lower() == ".json":
        return from_json(json.loads(text))
    raise ValueError("Input file must use .csv or .json extension.")

def generate(courses=30, students=300, min_courses=3, max_courses=5, seed=42):
    if not 1 <= courses <= 200 or not 1 <= students <= 20_000:
        raise ValueError("Generator supports 1–200 courses and 1–20000 students.")
    if not 0 <= min_courses <= max_courses <= courses:
        raise ValueError("Require 0 <= min-courses <= max-courses <= courses.")
    rng = random.Random(seed)
    names = {f"C{i:03d}": f"Course {i:02d}" for i in range(1, courses + 1)}
    ids = sorted(names)
    registrations = {f"S{i:04d}": tuple(sorted(rng.sample(ids, rng.randint(min_courses, max_courses))))
                     for i in range(1, students + 1)}
    return Dataset(names, registrations)

def save_dataset(dataset, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix.lower() == ".json":
        path.write_text(json.dumps(dataset.as_dict(), indent=2) + "\n", encoding="utf-8")
    elif path.suffix.lower() == ".csv":
        if any(not cs for cs in dataset.students.values()) or any(not any(c in cs for cs in dataset.students.values()) for c in dataset.courses):
            raise ValueError("Long CSV cannot preserve empty registrations or unenrolled courses; use JSON.")
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["student_id", "course_id", "course_name"])
            for sid, courses in sorted(dataset.students.items()):
                writer.writerows((sid, cid, dataset.courses[cid]) for cid in courses)
    else:
        raise ValueError("Output dataset must use .csv or .json extension.")
