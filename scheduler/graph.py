"""Course-conflict graph; weights retain the number of shared students."""
from itertools import combinations
from .model import Graph

def build_graph(dataset):
    adjacency = {c: set() for c in sorted(dataset.courses)}
    weights = {}
    enrollment = {c: set() for c in sorted(dataset.courses)}
    for student, courses in dataset.students.items():
        for c in courses:
            enrollment[c].add(student)
        for a, b in combinations(sorted(courses), 2):
            adjacency[a].add(b)
            adjacency[b].add(a)
            weights[a, b] = weights.get((a, b), 0) + 1
    return Graph(adjacency, weights, enrollment)

def clique_bound(graph):
    """A greedy clique is a certificate of a lower bound, not a maximum-clique claim."""
    order = sorted(graph.adjacency, key=lambda v: (-len(graph.adjacency[v]), v))
    best = []
    for seed in order:
        clique = [seed]
        candidates = set(graph.adjacency[seed])
        while candidates:
            v = min(candidates, key=lambda u: (-len(candidates & graph.adjacency[u]), -len(graph.adjacency[u]), u))
            clique.append(v)
            candidates &= graph.adjacency[v]
        if len(clique) > len(best):
            best = clique
    return len(best), best

def graph_dict(graph):
    n = len(graph.adjacency)
    return {"vertices": [{"id": c, "degree": len(graph.adjacency[c]), "enrollment": len(graph.enrollment[c])}
                         for c in graph.adjacency],
            "edges": [{"source": a, "target": b, "shared_students": w} for (a, b), w in sorted(graph.weights.items())],
            "adjacency_list": {c: sorted(ns) for c, ns in graph.adjacency.items()},
            "density": 2 * graph.edges / (n * (n - 1)) if n > 1 else 0}
