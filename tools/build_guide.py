#!/usr/bin/env python3
"""Build the standalone academic guide (optional developer dependency: reportlab).

Run: python3 tools/build_guide.py --output output/pdf/ExamCraft_Project_Guide.pdf
The application and CLI themselves do not depend on ReportLab.
"""
from argparse import ArgumentParser
from pathlib import Path
import math
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Flowable, KeepTogether, Preformatted
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT

GREEN = colors.HexColor('#1C5749')
INK = colors.HexColor('#243B31')
MUTED = colors.HexColor('#6F7E70')
LINE = colors.HexColor('#DFE6D9')
PALE = colors.HexColor('#F0F5EA')
GOLD = colors.HexColor('#BE9145')
PAGE_W, PAGE_H = 595.276, 841.89
WIDTH = PAGE_W - 100


def register_fonts():
    root = Path('/usr/share/fonts/truetype/dejavu')
    if not root.exists():
        raise SystemExit('Install DejaVu fonts (fonts-dejavu-core on Debian/Ubuntu) before rebuilding the optional PDF.')
    for label, filename in [('Body','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf'),('Mono','DejaVuSansMono.ttf'),('Serif','DejaVuSerif.ttf')]:
        pdfmetrics.registerFont(TTFont(label,str(root/filename)))
    pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')


def styles():
    return {
        'body': ParagraphStyle('body',fontName='Body',fontSize=9.2,leading=13.7,textColor=INK,spaceAfter=8),
        'small': ParagraphStyle('small',fontName='Body',fontSize=8.1,leading=12.5,textColor=MUTED,spaceAfter=8),
        'h1': ParagraphStyle('h1',fontName='Serif',fontSize=26,leading=31,textColor=GREEN,spaceAfter=16),
        'h2': ParagraphStyle('h2',fontName='Bold',fontSize=12.2,leading=18,textColor=GREEN,spaceBefore=10,spaceAfter=7),
        'eyebrow': ParagraphStyle('eyebrow',fontName='Bold',fontSize=8,leading=12,textColor=GOLD,spaceAfter=10),
        'formula': ParagraphStyle('formula',fontName='Body',fontSize=13,leading=22,textColor=GREEN,spaceAfter=12),
        'cell': ParagraphStyle('cell',fontName='Body',fontSize=8.2,leading=11.7,textColor=INK),
        'header': ParagraphStyle('header',fontName='Bold',fontSize=7.8,leading=12,textColor=GREEN),
        'code': ParagraphStyle('code',fontName='Mono',fontSize=8,leading=12,textColor=GREEN,leftIndent=10,spaceBefore=6,spaceAfter=12),
        'cover': ParagraphStyle('cover',fontName='Serif',fontSize=48,leading=55,textColor=GREEN,spaceAfter=15),
        'cover_sub': ParagraphStyle('cover_sub',fontName='Body',fontSize=17,leading=25,textColor=INK,spaceAfter=20),
    }


class CycleGraph(Flowable):
    def __init__(self):
        Flowable.__init__(self);self.width=WIDTH;self.height=164
    def draw(self):
        c=self.canv;cx=145;cy=80;r=59
        points=[(cx+r*math.cos(2*math.pi*i/5+math.pi/2),cy+r*math.sin(2*math.pi*i/5+math.pi/2)) for i in range(5)]
        c.setStrokeColor(LINE);c.setLineWidth(2)
        for i,(x,y) in enumerate(points):
            x2,y2=points[(i+1)%5];c.line(x,y,x2,y2)
        fills=[GREEN,GOLD,GREEN,GOLD,colors.HexColor('#788DA5')]
        for i,(x,y) in enumerate(points):
            c.setFillColor(fills[i]);c.circle(x,y,17,fill=1,stroke=0)
            c.setFillColor(colors.white);c.setFont('Bold',11);c.drawCentredString(x,y-4,chr(65+i))
        c.setFillColor(GREEN);c.setFont('Bold',11);c.drawString(270,126,'A valid 3-coloring')
        c.setFillColor(MUTED);c.setFont('Body',9)
        for i,text in enumerate(['Slot 1: A, C','Slot 2: B, D','Slot 3: E','5 vertices / 5 conflict edges']):c.drawString(270,101-i*20,text)


class Architecture(Flowable):
    def __init__(self):
        Flowable.__init__(self);self.width=WIDTH;self.height=158
    def draw(self):
        c=self.canv
        labels=[('Input','CSV / JSON / mock data'),('Model','Sets, pairs, weighted graph'),('Solve','Heuristic or bounded exact'),('Improve','Permute complete slots'),('Verify','Read registrations directly'),('Output','Timetable, proof, report')]
        bw=150;bh=43;xs=[0,172,344];ys=[99,24]
        for i,(a,b) in enumerate(labels):
            x=xs[i%3];y=ys[i//3]
            c.setFillColor(PALE);c.setStrokeColor(LINE);c.roundRect(x,y,bw,bh,7,fill=1,stroke=1)
            c.setFillColor(GREEN);c.setFont('Bold',9);c.drawString(x+10,y+27,a)
            c.setFillColor(MUTED);c.setFont('Body',7);c.drawString(x+10,y+12,b)
        c.setStrokeColor(GREEN);c.setLineWidth(1)
        for y in ys:
            for x in [150,322]:c.line(x+2,y+22,x+18,y+22)
        c.line(419,96,419,80);c.line(419,80,75,80);c.line(75,80,75,69)


def build(output):
    register_fonts();S=styles();story=[]
    def p(text,style='body'):story.append(Paragraph(text,S[style]))
    def h(text):p(text,'h2')
    def section(num,title):
        if story:story.append(PageBreak())
        p(f'PROJECT GUIDE / {num:02d}','eyebrow');p(title,'h1')
    def callout(title,text):
        cells=[[Paragraph(title,S['header'])],[Paragraph(text,S['body'])]]
        t=Table(cells,colWidths=[WIDTH-24]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),.6,LINE),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,0),11),('BOTTOMPADDING',(0,-1),(-1,-1),7)]));story.append(KeepTogether([t,Spacer(1,12)]))
    def table(headers,rows,widths):
        vals=[[Paragraph(escape(str(x)),S['header']) for x in headers]]+[[Paragraph(escape(str(x)),S['cell']) for x in row] for row in rows]
        t=Table(vals,colWidths=widths,repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('LINEBELOW',(0,0),(-1,0),.8,LINE),('LINEBELOW',(0,1),(-1,-1),.35,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]));story.append(t);story.append(Spacer(1,12))
    def code(text):story.append(Preformatted(text,S['code']))

    # Page 1
    story.append(Spacer(1,55));p('DISCRETE MATHEMATICS / COURSE PROJECT','eyebrow');p('ExamCraft','cover');p('University Exam &amp;<br/>Timetable Scheduler','cover_sub')
    p('From shared registrations to conflict-free exam slots.','formula')
    story.append(Spacer(1,18));callout('THE CENTRAL IDEA','A course is a vertex. Shared students create edges. Colors are exam slots. A proper coloring gives every student a timetable without simultaneous exams.')
    story.append(Spacer(1,18));table(['PROJECT','DETAIL'],[
        ['Institution','Vishwakarma Institute of Technology, Pune'],['Programme','B.Tech. Computer Engineering'],['Student','Prasanna Mahalpure'],['Academic year','2026-2027'],['Team / division / guide','Complete the explicit placeholders in docs/REPORT.md before submission.']],[125,WIDTH-125])
    p('A practical companion to the complete source code, detailed academic report, reproducible datasets, test suites, and viva guide. Prepared 28 October 2026.','small')
    p('Reading map: Model 02 / Algorithms 03 / Architecture 04 / Data 05 / Worked example 06 / Results 07 / Verification 08 / Demo 09 / Scope &amp; viva 10','small')

    # Page 2
    section(2,'The mathematical model')
    p('Let S be the students, V the distinct course IDs, and Rₛ the set of courses registered by student s. The conflict graph G = (V, E) is simple and undirected:')
    callout('EDGE RULE','{u, v} ∈ E exactly when u ≠ v and at least one student registers for both u and v. The edge weight w(u,v) counts those shared students.')
    p('The graph has no self-loops and no parallel edges. Shared registrations establish a symmetric relation: if A conflicts with B, then B conflicts with A. Repeated registration rows must never inflate weights.')
    p('A coloring is an assignment c: V → {0, 1, ..., k - 1} satisfying c(u) ≠ c(v) for every edge. Internally, colors start at zero; timetable exports display Slot 1 through Slot k. The minimum k is the chromatic number χ(G).')
    h('Why proper coloring means no clashes')
    p('<b>Forward direction.</b> Suppose a student has distinct registered courses u and v in the same slot. Their registrations create the edge {u,v}. A proper coloring requires different colors at its endpoints, contradicting the assumed clash.')
    p('<b>Reverse direction.</b> If adjacent courses share a slot, the edge certifies that a student takes both. That student would face simultaneous exams. Therefore every clash-free complete assignment is a proper coloring.')
    p('Completeness is essential: a missing exam may hide a conflict. Validation must verify that every declared course appears exactly once, as well as checking collisions.')
    h('Bounds turn a good result into a certificate')
    p('L ≤ ω(G) ≤ χ(G) ≤ k_found ≤ Δ(G) + 1','formula')
    p('Here L is the size of an explicitly discovered clique, ω(G) the maximum clique size, and Δ(G) the maximum degree. A found clique may be smaller than a maximum clique but is always a valid lower bound. A validated coloring supplies the upper bound k_found.')
    p('If a valid schedule uses L slots, both bounds meet and χ(G) = L. A completed exact search can also certify χ(G), even when the clique certificate is weaker.','small')

    # Page 3
    section(3,'Three scheduling strategies')
    h('01 / Welsh-Powell: fixed degree order')
    p('Sort vertices by descending degree and then course ID. Scan that order to build one maximal independent color class. Repeat the scan with a new color until every course is assigned. The implementation follows this color-class formulation explicitly.')
    code('order = sort(courses, by=(-degree, course_id))\nwhile an uncolored course remains:\n    create the next slot\n    for course in order:\n        if uncolored and compatible with this slot:\n            assign course to this slot')
    h('02 / DSatur: adapt to the partial coloring')
    p('Saturation is the number of <b>distinct colors</b> among already colored neighbors. At each step, choose highest saturation, then highest total degree, then course ID. Give that course its smallest available color. Four colored neighbors all in one color give saturation one.')
    h('03 / Bounded exact search: improve and prove')
    p('Start from a valid heuristic incumbent. Branch on legal colors in DSatur order and prune choices unable to improve the incumbent. Introduce new colors canonically to remove redundant color-label permutations. A completed improvement search or matching lower bound proves optimality.')
    table(['MODE','BUDGET / CLAIM'],[['Browser exact','At most 18 courses; UI budget 1.5 seconds / 100,000 nodes.'],['Python exact','At most 60 courses; default search budget 3 seconds / 100,000 nodes.'],['Interrupted search','Return the best valid incumbent; minimum remains unproved.']],[110,WIDTH-110])
    callout('MATHEMATICAL HONESTY','Finding χ(G) is NP-hard. Deciding whether at most k colors suffice is NP-complete in general and for fixed k ≥ 3. Verifying a proposed coloring is polynomial. Neither heuristic always finds the minimum or always outperforms the other.')
    p('These teaching implementations recompute saturation and use clear set operations. They favor inspectability over sophisticated priority queues. Exact search remains exponential in the worst case.','small')

    # Page 4
    section(4,'Architecture & constraint flow')
    story.append(Architecture())
    p('Both interfaces implement the same graph-theoretic model. They are independent implementations; the web app is not a client of a hidden Python API.')
    table(['LAYER','BROWSER','PYTHON'],[['Input','File / pasted CSV or JSON; cohort generator','File parsing; uniform seeded generator'],['Computation','ES module in a Web Worker','Standard-library scheduler package'],['Views','Timetable, graph, comparison, student search','CLI tables; exported HTML report'],['Delivery','CSV, JSON, ICS, HTML, print controls','CSV, schedule / graph / conflict JSON, HTML']],[77,209,WIDTH-286])
    h('Graph construction from registration pairs')
    p('Create an adjacency set for each course, including zero-enrollment catalog entries. For every student with r distinct courses, enumerate r(r - 1)/2 unordered pairs. Add both adjacency directions and increment each pair weight once for that student.')
    p('Expected set/dictionary work is proportional to Σₛ |Rₛ|², plus initialization and sorting for deterministic output. Adjacency storage is O(|V| + |E|), excluding the registrations. An adjacency matrix would consume O(|V|²) cells even on a sparse graph.')
    h('A second, independent verification path')
    p('After coloring and any slot reordering, read the original students again and group each student’s courses by assigned slot. Reject missing courses, unexpected assignments, invalid slot values, or groups containing more than one registered exam. This avoids merely trusting the graph routine that created the schedule.')
    p('Browser datasets stay in memory for the current visit. Reloading restores the demo; download registrations to retain changes. The scheduling application sends no registrations to a scheduling backend.','small')

    # Page 5
    section(5,'Data contracts & reproducibility')
    h('Long-format CSV')
    code('student_id,course_id,course_name\nS001,DM,Discrete Mathematics\nS001,DS,Data Structures\nS002,DS,Data Structures\nS002,OS,Operating Systems')
    p('One row is one registration; repeated student IDs are expected. course_name is optional. Preserve identifiers as strings, including leading zeroes. CSV supports quoted commas, escaped quotation marks, UTF-8 BOM, and CRLF. Use JSON to represent a zero-enrollment course or a student with no registrations.')
    h('Canonical JSON')
    code('{\n  "courses": [{"id": "DM", "name": "Discrete Mathematics"},\n              {"id": "DS", "name": "Data Structures"}],\n  "students": [\n    {"student_id": "S001", "courses": ["DM", "DS"]}\n  ]\n}')
    p('For portability, provide a complete unique catalog and distinct courses within each student record. CSV duplicate registrations are deduplicated. Python’s explicit JSON parser rejects duplicate registrations and unknown references in a supplied catalog; the browser normalizes duplicates and may add referenced courses. Both reject duplicate student identities in JSON.')
    table(['ENTRY POINT','LIMITS'],[['Browser interface','120 courses; 5,000 students; 5 MiB imports'],['Browser engine','200 courses; 10,000 students; 100,000 registrations'],['Python input','200 courses; 20,000 students; see DATA_FORMAT.md for file / registration caps']],[125,WIDTH-125])
    h('Keep experiments comparable')
    p('The browser generator favors groups of eight courses with occasional cross-cohort choices. The Python generator samples uniformly and uses a different pseudorandom generator. Equal seeds across languages do not imply equal data. Import examples/cohort_30_300.json into both to compare the same graph.')
    p('Use fixed input files, deterministic tie-breakers, matching calendar settings, and recorded budgets. Runtime is machine-dependent; observed timing is evidence for this experiment, not a universal performance guarantee.','small')

    # Page 6
    section(6,'Worked example: the five-cycle')
    p('Five students register for pairs AB, BC, CD, DE, and EA. Each registration pair contributes one edge. The graph is C₅, an odd cycle with five vertices, five edges, and degree two at every vertex.')
    story.append(CycleGraph())
    table(['STUDENT','REGISTERED COURSES','CONFLICT CREATED'],[['S1','A, B','A - B'],['S2','B, C','B - C'],['S3','C, D','C - D'],['S4','D, E','D - E'],['S5','E, A','E - A']],[85,200,WIDTH-285])
    h('Why two slots cannot work')
    p('Assume A is in slot 1. Alternating around the cycle forces B into slot 2, C into slot 1, D into slot 2, and E into slot 1. But E is adjacent to A, so that assignment clashes. An odd cycle cannot be properly colored with two colors.')
    p('The displayed three-color assignment is valid, proving χ(C₅) = 3. The maximum clique contains only two vertices: there are no triangles. Therefore ω(C₅) = 2 &lt; χ(C₅) = 3.')
    callout('A GOOD VIVA MOMENT','The clique lower bound does not always equal the chromatic number. A heuristic may return 3 with bounds [2,3]; the exact solver proves 3 by exhausting the improvement search and tightens the certified interval to [3,3].')
    p('Reproduce: python3 -m scheduler solve examples/cycle5.json --algorithm exact --output-dir output/cycle5','small')

    # Page 7
    section(7,'Results & soft constraints')
    p('The shared cohort fixture has <b>30 courses, 300 students, 1,356 registrations, and 316 conflict edges</b>. Its density is 316 / 435 = 72.6%. The Python results bundled in examples/results were generated from this fixed file.')
    table(['PYTHON STRATEGY','SLOTS','CERTIFIED INTERVAL','PROOF'],[['Welsh-Powell','13','11 ≤ χ(G) ≤ 13','Unproved'],['DSatur','13','11 ≤ χ(G) ≤ 13','Unproved'],['Exact search','12','12 ≤ χ(G) ≤ 12','Minimum proved']],[132,45,165,WIDTH-342])
    p('The exact proof completes in 593 search nodes for this fixture. The stored run took about 14 ms, but timings vary by machine and process. The clique certificate still has size 11: the stronger lower bound of 12 comes from completed search, not a falsely enlarged clique.')
    h('Gap optimization preserves the hard constraints')
    p('For each student, count pairs of exams in adjacent slots on the same day. Three consecutive periods contribute two pairs. A day boundary contributes no pair. This deliberately narrow penalty does not model all forms of student fatigue.')
    p('Reorder complete color classes by a one-to-one permutation π. If c(u) ≠ c(v), then π(c(u)) ≠ π(c(v)). Therefore every edge remains properly colored, all courses stay assigned, and the slot count stays unchanged.')
    table(['PYTHON RUN / 3 SLOTS PER DAY','BEFORE','AFTER','EXAM DAYS'],[['DSatur / 13 slots','253 pairs','108 pairs','5'],['Exact / 12 slots','328 pairs','154 pairs','4']],[217,75,75,WIDTH-367])
    callout('FEWER SLOTS CAN MEAN TIGHTER EXAM SPACING','The proved 12-slot schedule uses fewer days, yet its final consecutive-pair count is higher than this 13-slot schedule. Minimum slot count and best student spacing are separate objectives. Report both; do not claim one metric proves overall superiority.')
    p('Python uses two sweeps of improving color-class swaps. The browser uses bounded best-improvement swaps, so optimized schedules can differ. Each accepted change lowers the selected penalty; neither method proves a global soft optimum.','small')

    # Page 8
    section(8,'Verification & evidence')
    p('The project suites pass <b>41 named tests: 18 Python tests and 23 JavaScript tests</b> (13 engine tests and 10 export tests). Two Python tests use Node when available and are skipped when it is absent. Node is a testing tool; the browser app and Python CLI do not require npm dependencies.')
    table(['EVIDENCE','WHAT IT CHECKS'],[['Known graph families','Cliques, cycles, bipartite and isolated-vertex cases have expected proper colorings.'],['Independent exact oracle','Python checks 105 small random graphs. JavaScript checks all 1,024 five-vertex graphs and 70 random graphs with 6-9 vertices.'],['Budget exhaustion','Time or node cutoffs retain a valid incumbent and do not falsely mark the result optimal.'],['Import validation','Quoted CSV, duplicates, malformed input, ambiguous identities, special object-key identifiers.'],['Cross-engine checks','Shared graph adjacency / weights, deterministic heuristic assignments before reordering, and browser exports validated by Python.'],['Soft and calendar checks','Nonincreasing penalty, preserved coverage and slot count, weekend advancement, partial exam days.'],['CLI integration','End-to-end export, independently validated assignments, and deliberate tamper detection.']],[132,WIDTH-132])
    h('Re-run the checks')
    code('python3 -m unittest discover -s tests -v\nnode --test tests/test_web_engine.mjs tests/test_exporters.mjs')
    p('Use Python 3.10+ and Node 18+ for the complete suites. Detailed current browser observations, export checks, and verification limits belong in docs/VALIDATION.md. Browser checks include graph inspection, student lookup, valid / invalid CSV paste, C5 exact proof, and weekend / duration settings.')
    h('Browser workflow and export checks')
    p('The actual browser JSON download was independently validated in Python against all 300 students and 1,356 registrations. Export tests check CSV safety, ICS Unicode folding, and dates. Repeated download notifications were limited in the test browser; complete cross-browser download behavior remains unverified.')
    p('No unit-test collection proves every possible graph correct. Combining independent brute-force comparisons, known families, invariants, cross-implementation checks, and live UI verification gives stronger evidence than one attractive screenshot.','small')

    # Page 9
    section(9,'Run it & present it')
    h('Offline browser app: one command')
    code('python3 run.py')
    p('Run from the extracted project root. The launcher serves only dist/ on the loopback interface, opens a browser, and prints the local URL. Press Ctrl+C to stop. Use --port 8001 if port 8000 is busy, or --no-browser to open the address manually. On Windows, use py in place of python3 if appropriate.')
    h('CLI demonstration on a fixed dataset')
    code('python3 -m scheduler compare examples/cohort_30_300.json --exact\n\npython3 -m scheduler solve examples/cohort_30_300.json \\\n  --algorithm dsatur --output-dir output/demo \\\n  --slots-per-day 3 --skip-weekends --optimize-gaps\n\npython3 -m scheduler validate examples/cohort_30_300.json \\\n  output/demo/schedule.json')
    table(['TIME','DEMONSTRATION','POINT TO EXPLAIN'],[['0:00-1:00','State the problem and mapping','Course = vertex; conflict = edge; slot = color.'],['1:00-2:00','Inspect a conflict graph node','An edge exists even for one shared student.'],['2:00-3:00','Compare heuristics and bounds','A proper 13-slot result need not be minimum.'],['3:00-4:00','Use C5 and exact search','Clique bound 2, but chromatic number 3.'],['4:00-5:00','Find a student and export','Independent validation checks the real hard constraint.'],['5:00-6:00','Show cohort exact result','12 slots are proved; soft spacing has a trade-off.']],[72,177,WIDTH-249])
    p('Before presenting: keep the terminal open, test on the presentation laptop, extract the entire archive, and have the bundled HTML results available as a fallback. Avoid relying on an internet connection for the classroom demonstration.')
    p('The detailed narrative, optional role split, and contingency steps are in docs/DEMO_SCRIPT.md. Replace team, batch, and instructor placeholders in the academic report before submitting.','small')

    # Page 10
    section(10,'Scope, viva & references')
    h('What this version guarantees')
    p('For the supplied registrations, a validated proper coloring assigns every course one slot and gives each student no simultaneous exams. The app clearly reports whether minimum slot count was proved. It can improve a defined consecutive-pair penalty while retaining feasibility.')
    h('What needs an expanded model')
    p('Room capacity, room allocation, invigilators, holidays, travel time, individual accommodations, and different per-course exam durations are outside the implemented constraints. The browser supports a common period duration for presentation and calendar exports. Operational university deployment would also need institutional data controls and review.')
    table(['VIVA PROMPT','ANSWER TO RETAIN'],[['Why is the graph undirected?','Shared enrollment is symmetric.'],['Degree vs saturation?','Degree counts neighbors; saturation counts distinct colors of colored neighbors.'],['Why validate coverage?','An omitted exam can hide a clash.'],['Why does a clique bound work?','Pairwise conflicting courses all need different slots.'],['Can a heuristic be proved optimal?','Yes, when a valid lower bound meets its slot count.'],['Why do implementations differ?','Different generators, budgets, and gap searches; compare shared input and guarantees.']],[181,WIDTH-181])
    h('Original algorithm and complexity references')
    p('1. D. J. A. Welsh and M. B. Powell (1967). <i>An upper bound for the chromatic number of a graph and its application to timetabling problems.</i> The Computer Journal 10(1), 85-86. DOI: 10.1093/comjnl/10.1.85.','small')
    p('2. Daniel Brélaz (1979). <i>New methods to color the vertices of a graph.</i> Communications of the ACM 22(4), 251-256. DOI: 10.1145/359094.359101.','small')
    p('3. Richard M. Karp (1972). <i>Reducibility Among Combinatorial Problems.</i> Complexity of Computer Computations, 85-103. DOI: 10.1007/978-1-4684-2001-2_9.','small')
    p('Source of project-specific results: included inputs, examples/results/*/schedule.json, and the independent test suites. Full discussion, proofs, complexity notes, and source links: docs/REPORT.md. Full viva set: docs/VIVA.md.','small')

    def decorate(c,doc):
        c.saveState();c.setFillColor(GREEN);c.rect(0,PAGE_H-8,PAGE_W,8,fill=1,stroke=0)
        if doc.page>1:
            c.setFont('Bold',8);c.drawString(50,PAGE_H-35,'ExamCraft')
            c.setFont('Body',7);c.setFillColor(MUTED);c.drawRightString(PAGE_W-50,PAGE_H-35,'DISCRETE MATHEMATICS / PROJECT GUIDE')
        c.setStrokeColor(LINE);c.line(50,45,PAGE_W-50,45)
        c.setFillColor(MUTED);c.setFont('Body',7);c.drawString(50,30,'VIT Pune  /  Prasanna Mahalpure')
        c.drawRightString(PAGE_W-50,30,f'{doc.page:02d}')
        c.restoreState()
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    doc=SimpleDocTemplate(str(output),pagesize=(PAGE_W,PAGE_H),rightMargin=50,leftMargin=50,topMargin=64,bottomMargin=62,title='ExamCraft - University Exam & Timetable Scheduler',author='Prasanna Mahalpure',subject='Discrete Mathematics course project guide',pageCompression=1)
    doc.build(story,onFirstPage=decorate,onLaterPages=decorate)
    print(output)


if __name__=='__main__':
    parser=ArgumentParser(description=__doc__);parser.add_argument('--output',default='output/pdf/ExamCraft_Project_Guide.pdf');build(parser.parse_args().output)
