# Viva preparation

Use these answers as prompts. Explain the argument in your own words and point to the relevant code or live example.

## 1. What is the project's main idea?

We convert shared course registrations into a conflict graph and colour it. A colour is an exam slot. Adjacent courses receive different colours, so every student can attend all registered examinations.

## 2. What are vertices and edges here?

A vertex is one course examination. An undirected edge joins two distinct courses when at least one student registers for both. Multiple shared students increase the edge's weight, but do not create parallel edges in the simple graph.

## 3. Why is the graph undirected?

If course A conflicts with B because a student takes both, B necessarily conflicts with A for that same reason. Conflict is symmetric.

## 4. Why are there no self-loops?

A course is scheduled once. Comparing a course with itself does not represent two simultaneous examinations. A self-loop would also make ordinary proper colouring impossible.

## 5. What does the chromatic number mean?

It is the minimum number of colours needed for a proper vertex colouring. In this model, it is the fewest exam slots needed to avoid all registration clashes.

## 6. Does your program always find the chromatic number?

The heuristic modes find valid schedules but do not always prove minimum slot count. A result is certified minimum when its upper bound equals a valid lower bound or bounded exact search finishes the necessary proof. A timeout preserves a valid schedule and reports the minimum as unproven.

## 7. What is the difference between NP-hard and NP-complete here?

Finding the minimum number of slots is an optimisation problem and is NP-hard. Asking whether at most k slots suffice is a decision problem and is NP-complete in general. Verification of a proposed colouring is polynomial.

## 8. Explain Welsh–Powell in this project.

Sort vertices in descending degree, with course ID resolving ties. Scan that fixed order to construct a maximal independent colour class. Start a new class and repeat until all vertices are assigned.

## 9. Is largest-degree first-fit exactly the same algorithm?

Both use degree ordering, but one may describe assigning each vertex its first legal colour and another constructs one colour class at a time. We specify and test the colour-class sweep used in our blueprint so the behaviour is unambiguous.

## 10. What is saturation degree?

It is the count of distinct colours among the already coloured neighbours of a vertex. If four coloured neighbours all have colour 0, saturation is one, rather than four.

## 11. Why can DSatur improve on static degree ordering?

It responds to the current partial colouring. A vertex surrounded by many different colours has fewer easy choices, so DSatur handles it early. This often helps, but does not guarantee a universally better result.

## 12. What happens when DSatur has a tie?

Our heuristic uses degree and then course ID to make a deterministic choice. Inspect the source for the precise tie-breaker; DSatur implementations may use static or remaining degree as a documented variant.

## 13. Why does a proper colouring guarantee no clashes?

Any two courses taken by the same student have an edge. Proper colouring makes their colours different. A simultaneous clash would therefore contradict the colouring rule.

## 14. Why validate directly against students after colouring?

It independently checks the property we actually care about and can catch problems in graph construction, mapping, or export. It also checks complete course coverage, since a missing exam would otherwise hide conflicts.

## 15. What is an independent set in your timetable?

All courses assigned to one slot form an independent set. No pair in that group shares an edge, so no student takes two exams in the group.

## 16. How does a clique give a lower bound?

Every two courses in a clique conflict. They all need distinct slots, so a clique of size L proves at least L slots are required. A greedy clique is a valid certificate even if it is not maximum.

## 17. Can the clique bound be smaller than the chromatic number?

Yes. A five-cycle has maximum clique size two but needs three colours. An odd cycle cannot be coloured by alternating only two colours.

## 18. How can a heuristic result be proven optimal?

If the heuristic produces L slots and we exhibit a clique of size L, then at least L and at most L slots are needed. The two bounds meet, proving the minimum without a full exact search.

## 19. What does the exact solver do?

It starts with a valid incumbent and explores legal partial colourings to find a smaller schedule. Bounds and colour-label symmetry prune redundant branches. It stops at configured size, time, or node limits and reports whether the proof was completed.

## 20. What is branch-and-bound?

The search branches into choices for a course's colour. A bound eliminates a branch once it cannot improve the best complete colouring already known. Keeping an incumbent means an interrupted search can still return a usable schedule.

## 21. What are hard and soft constraints?

No simultaneous exams for a student and complete course coverage are hard constraints. Reducing consecutive exams is a soft objective: we improve it only while retaining a valid schedule and its slot count.

## 22. What exactly is the consecutive-exam penalty?

Count each student's pairs of exams in adjacent periods on the same examination day. A student with exams in three consecutive periods contributes two pairs. Crossing a day boundary contributes zero to this particular penalty.

## 23. Why does reordering colour classes preserve validity?

It is a one-to-one renaming of colours. Distinct old colours remain distinct after the permutation, so every conflict edge still has differently coloured endpoints. The number of colours stays the same.

## 24. What is graph-construction complexity?

For each student with r courses, generate r(r−1)/2 course pairs. Across students, the expected set / dictionary work is proportional to the sum of these pair counts. Adjacency storage is O(n+m), excluding the registrations themselves.

## 25. Why use adjacency sets?

They store only existing neighbours and support efficient membership checks. A dense adjacency matrix needs n² cells even for a sparse conflict graph. A matrix is still useful for small educational displays.

## 26. What happens with duplicate registrations?

CSV duplicate registration rows can be deduplicated with warnings because they repeat the same fact. JSON uses a stricter explicit schema and rejects duplicate IDs or duplicate courses within one student. Duplicates must not inflate edge weights or student counts.

## 27. Can a course with no students be included?

Yes, by declaring it in the JSON course catalogue. It is an isolated vertex and can share a slot with other courses. Long-format CSV alone cannot represent an unenrolled course.

## 28. Why can Python and browser results differ?

They are independent implementations. Different generator pseudorandom-number algorithms, exact search budgets, or tie-breaking details may lead to different schedules. Both must satisfy the same registration constraints and must report proof status honestly.

## 29. What real-world constraints are missing?

Room capacity, invigilators, variable examination duration, holidays, building travel, individual accommodations, and administrative rules. They require an expanded constraint model, not just a visual interface change.

## 30. How would you evaluate improvement scientifically?

Use identical datasets and settings for every algorithm, multiple fixed seeds, and known graph families. Record slots, bounds, proof status, runtime, and soft penalty. Report the machine and budgets. One successful random example does not establish universal superiority.

## Questions to ask each other before the presentation

- Construct a triangle from student registrations and explain why three slots are forced.
- Show a student-level clash introduced deliberately into an exported assignment.
- Explain why zero clashes alone does not prove optimality.
- Find a course with high degree and explain how its neighbours affect its schedule.
- Explain why a large enrolment count does not necessarily imply high graph degree.
- Show how a five-course cycle differs from a five-course clique.
