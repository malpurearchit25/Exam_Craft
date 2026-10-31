"""ExamCraft: dependency-free university exam scheduling."""
__version__ = "1.0.0"
from .data import load, from_json, from_csv, generate
from .graph import build_graph
from .coloring import color_graph
from .timetable import make_schedule, validate
__all__ = ["load", "from_json", "from_csv", "generate", "build_graph", "color_graph", "make_schedule", "validate"]
