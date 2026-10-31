"""Deterministic heuristics and bounded exact branch-and-bound coloring.

Colors are zero-based internally. Exact search only claims optimality when
bounds meet or the entire improvement search finishes.
"""
from time import perf_counter
from math import isfinite
from .graph import clique_bound
from .model import ColoringResult

ALGORITHMS = ("welsh-powell", "dsatur", "exact")

def _dsatur_vertex(graph, colors):
    return min((v for v in graph.adjacency if v not in colors),
               key=lambda v: (-len({colors[u] for u in graph.adjacency[v] if u in colors}),
                              -len(graph.adjacency[v]), v))

def _heuristic(graph, algorithm):
    colors, trace = {}, []
    if algorithm == "welsh-powell":
        order = sorted(graph.adjacency, key=lambda v: (-len(graph.adjacency[v]), v))
        color = 0
        while len(colors) < len(order):
            for v in order:
                if v not in colors and all(colors.get(u) != color for u in graph.adjacency[v]):
                    colors[v] = color
                    trace.append({"step": len(trace) + 1, "course_id": v, "slot": color + 1,
                                  "degree": len(graph.adjacency[v])})
            color += 1
    else:
        while len(colors) < len(graph.adjacency):
            v = _dsatur_vertex(graph, colors)
            forbidden = {colors[u] for u in graph.adjacency[v] if u in colors}
            color = 0
            while color in forbidden:
                color += 1
            colors[v] = color
            trace.append({"step": len(trace) + 1, "course_id": v, "slot": color + 1,
                          "degree": len(graph.adjacency[v]), "saturation": len(forbidden)})
    return colors, trace

def color_graph(graph, algorithm="dsatur", time_limit=3.0, node_limit=100_000):
    if algorithm not in ALGORITHMS:
        raise ValueError("Unknown coloring algorithm.")
    if not isfinite(time_limit) or time_limit <= 0 or node_limit < 0:
        raise ValueError("time-limit must be positive and node-limit nonnegative.")
    if algorithm == "exact" and len(graph.adjacency) > 60:
        raise ValueError("Exact search supports at most 60 courses; use a heuristic for larger graphs.")
    start = perf_counter()
    lower, witness = clique_bound(graph)
    colors, trace = _heuristic(graph, "dsatur" if algorithm == "exact" else algorithm)
    upper = len(set(colors.values()))
    optimal, nodes, status = lower == upper, 0, "bounds_met" if lower == upper else "heuristic"
    if algorithm == "exact" and not optimal:
        best, best_count = colors.copy(), upper
        current = {}
        timed_out = False
        def search(used):
            nonlocal best, best_count, nodes, timed_out
            if best_count == lower or timed_out:
                return
            if nodes >= node_limit or perf_counter() - start >= time_limit:
                timed_out = True
                return
            nodes += 1
            if len(current) == len(graph.adjacency):
                best, best_count = current.copy(), used
                return
            v = _dsatur_vertex(graph, current)
            forbidden = {current[u] for u in graph.adjacency[v] if u in current}
            # Existing colors, plus one canonical new color, remove label symmetry.
            for candidate in range(min(used + 1, best_count - 1)):
                if candidate not in forbidden:
                    current[v] = candidate
                    search(max(used, candidate + 1))
                    del current[v]
                    if best_count == lower or timed_out:
                        break
        search(0)
        colors = best
        optimal = best_count == lower or not timed_out
        if optimal:
            lower = best_count
        status = "bounds_met" if best_count == len(witness) else ("search_exhausted" if optimal else "search_limit")
        trace = []  # Heuristic trace would no longer describe an improved exact assignment.
    return ColoringResult(colors, algorithm, lower, witness, optimal, status,
                          round((perf_counter() - start) * 1000, 3), nodes, trace)
