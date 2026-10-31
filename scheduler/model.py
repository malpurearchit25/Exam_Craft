"""Validated domain data. Course and student identifiers are opaque strings."""
from dataclasses import dataclass, field

MAX_COURSES = 200
MAX_STUDENTS = 20_000

@dataclass(frozen=True)
class Dataset:
    courses: dict[str, str]
    students: dict[str, tuple[str, ...]]
    warnings: tuple[str, ...] = ()

    def __post_init__(self):
        if not self.courses or len(self.courses) > MAX_COURSES:
            raise ValueError(f"Dataset must contain 1–{MAX_COURSES} courses.")
        if len(self.students) > MAX_STUDENTS:
            raise ValueError(f"At most {MAX_STUDENTS} students are supported.")
        for key, value in self.courses.items():
            if not isinstance(key, str) or not key.strip() or key != key.strip():
                raise ValueError("Course IDs must be nonempty strings without outer whitespace.")
            if not isinstance(value, str) or not value.strip():
                raise ValueError("Course names must be nonempty strings.")
        for student, courses in self.students.items():
            if not isinstance(student, str) or not student.strip() or student != student.strip():
                raise ValueError("Student IDs must be nonempty strings without outer whitespace.")
            if len(set(courses)) != len(courses):
                raise ValueError(f"Duplicate course registration for {student}.")
            if any(course not in self.courses for course in courses):
                raise ValueError(f"Unknown registered course for {student}.")

    def as_dict(self):
        return {"courses": [{"id": c, "name": self.courses[c]} for c in sorted(self.courses)],
                "students": [{"student_id": s, "courses": list(self.students[s])} for s in sorted(self.students)]}

@dataclass
class Graph:
    adjacency: dict[str, set[str]]
    weights: dict[tuple[str, str], int]
    enrollment: dict[str, set[str]]

    @property
    def edges(self):
        return len(self.weights)

@dataclass
class ColoringResult:
    colors: dict[str, int]
    algorithm: str
    lower_bound: int
    clique_witness: list[str]
    optimal: bool
    status: str
    elapsed_ms: float
    nodes: int = 0
    trace: list[dict] = field(default_factory=list)

    @property
    def slots(self):
        return len(set(self.colors.values()))
