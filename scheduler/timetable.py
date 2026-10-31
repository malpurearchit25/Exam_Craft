"""Calendar assignment, independent validation, and soft-constraint improvement."""
from datetime import date, timedelta
from itertools import combinations
import math

TIMES = ("09:00–11:00", "12:00–14:00", "15:00–17:00", "18:00–20:00")

def validate(dataset, colors):
    """Inspect student registrations independently of the constructed graph."""
    missing = sorted(set(dataset.courses) - set(colors))
    extra = sorted(set(colors) - set(dataset.courses))
    invalid = sorted(c for c, slot in colors.items() if isinstance(slot, bool) or not isinstance(slot, int) or slot < 0)
    clashes = []
    for student, courses in sorted(dataset.students.items()):
        by_slot = {}
        for course in courses:
            if course in colors and course not in invalid:
                by_slot.setdefault(colors[course], []).append(course)
        for slot, exams in by_slot.items():
            if len(exams) > 1:
                clashes.append({"student_id": student, "slot": slot + 1, "courses": sorted(exams)})
    return {"valid": not (missing or extra or invalid or clashes), "missing_courses": missing,
            "unknown_courses": extra, "invalid_slot_courses": invalid, "student_clashes": clashes,
            "clash_count": len(clashes), "checked_students": len(dataset.students),
            "checked_registrations": sum(map(len, dataset.students.values()))}

def consecutive_metrics(dataset, colors, slots_per_day):
    pairs, affected = 0, 0
    for courses in dataset.students.values():
        slots = sorted(colors[c] for c in courses)
        count = sum(1 for a, b in zip(slots, slots[1:]) if b == a + 1 and a // slots_per_day == b // slots_per_day)
        pairs += count
        affected += count > 0
    return {"consecutive_exam_pairs": pairs, "students_with_consecutive_exams": affected}

def optimize_gaps(dataset, colors, slots_per_day=3):
    """Deterministic pair-swap local search over complete color classes.

    The weighted sum between neighboring positions is exactly the number of
    consecutive student exam pairs in a valid coloring. Each accepted swap
    strictly reduces that sum; feasibility is invariant under permutation.
    """
    if not 1 <= slots_per_day <= 4:
        raise ValueError("slots-per-day must be between 1 and 4.")
    count = len(set(colors.values()))
    weights = [[0] * count for _ in range(count)]
    for courses in dataset.students.values():
        for a, b in combinations(courses, 2):
            ca, cb = colors[a], colors[b]
            weights[ca][cb] += 1
            weights[cb][ca] += 1
    order = list(range(count))
    positions = [p for p in range(count - 1) if p // slots_per_day == (p + 1) // slots_per_day]
    def score():
        return sum(weights[order[p]][order[p + 1]] for p in positions)
    initial = current = score()
    swaps = 0
    # Two sweeps bound cost at O(k^3 + sum r_s^2); no global-optimum claim.
    for _ in range(2):
        improved = False
        for a, b in combinations(range(count), 2):
            order[a], order[b] = order[b], order[a]
            candidate = score()
            if candidate < current:
                current, swaps, improved = candidate, swaps + 1, True
            else:
                order[a], order[b] = order[b], order[a]
        if not improved:
            break
    inverse = {old: new for new, old in enumerate(order)}
    return {c: inverse[slot] for c, slot in colors.items()}, {"before": initial, "after": current,
                                                            "accepted_swaps": swaps, "method": "two_sweep_color_class_swap"}

def calendar_slots(count, start_date="2026-11-02", slots_per_day=3, skip_weekends=False):
    if not 1 <= slots_per_day <= 4:
        raise ValueError("slots-per-day must be between 1 and 4.")
    current = date.fromisoformat(start_date)
    result = []
    while len(result) < count:
        if not skip_weekends or current.weekday() < 5:
            for position in range(slots_per_day):
                if len(result) == count:
                    break
                result.append({"slot": len(result) + 1, "date": current.isoformat(),
                               "day": current.strftime("%A"), "time": TIMES[position],
                               "position_in_day": position + 1})
        current += timedelta(days=1)
    return result

def make_schedule(dataset, graph, result, start_date="2026-11-02", slots_per_day=3,
                  skip_weekends=False, improve_gaps=False):
    if not 1 <= slots_per_day <= 4:
        raise ValueError("slots-per-day must be between 1 and 4.")
    colors = result.colors.copy()
    before = consecutive_metrics(dataset, colors, slots_per_day)
    optimization = {"enabled": improve_gaps, "method": "none"}
    if improve_gaps:
        colors, details = optimize_gaps(dataset, colors, slots_per_day)
        optimization.update(details)
    validation = validate(dataset, colors)
    if not validation["valid"]:
        raise RuntimeError("Internal schedule validation failed.")
    slots = calendar_slots(result.slots, start_date, slots_per_day, skip_weekends)
    for slot in slots:
        courses = sorted(c for c in colors if colors[c] == slot["slot"] - 1)
        slot["courses"] = courses
        slot["student_exams"] = sum(len(graph.enrollment[c]) for c in courses)
    return {"schema_version": 1, "algorithm": result.algorithm,
            "configuration": {"start_date": start_date, "slots_per_day": slots_per_day,
                              "skip_weekends": skip_weekends},
            "courses": [{"id": c, "name": dataset.courses[c], "enrollment": len(graph.enrollment[c])}
                        for c in sorted(dataset.courses)],
            "assignments": [{"course_id": c, "slot": colors[c] + 1} for c in sorted(colors)],
            "slots": slots,
            "statistics": {"courses": len(dataset.courses), "students": len(dataset.students),
                           "registrations": sum(map(len, dataset.students.values())), "conflict_edges": graph.edges,
                           "slots": result.slots, "exam_days": math.ceil(result.slots / slots_per_day),
                           "runtime_ms": result.elapsed_ms, "search_nodes": result.nodes},
            "proof": {"optimal": result.optimal, "status": result.status, "lower_bound": result.lower_bound,
                      "upper_bound": result.slots, "clique_witness": result.clique_witness,
                      "clique_size": len(result.clique_witness)},
            "soft_constraints": {"before": before, "after": consecutive_metrics(dataset, colors, slots_per_day),
                                 "optimization": optimization},
            "validation": validation, "warnings": list(dataset.warnings),
            "algorithm_trace": result.trace,
            "trace_note": "Trace records coloring before any calendar permutation; final assignments are authoritative."}

def assignments_from_schedule(value):
    if not isinstance(value, dict) or not isinstance(value.get("assignments"), list):
        raise ValueError("Schedule JSON requires an assignments array.")
    colors = {}
    for assignment in value["assignments"]:
        if not isinstance(assignment, dict) or not isinstance(assignment.get("course_id"), str):
            raise ValueError("Each assignment requires a course_id string and integer slot >= 1.")
        cid, slot = assignment["course_id"], assignment.get("slot")
        if cid in colors:
            raise ValueError(f"Duplicate assignment: {cid}.")
        if isinstance(slot, bool) or not isinstance(slot, int) or slot < 1:
            raise ValueError(f"Invalid slot for {cid}; use an integer >= 1.")
        colors[cid] = slot - 1
    return colors
