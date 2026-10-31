/** Run with: node --test tests/test_web_engine.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,parseJSON,generateData,buildGraph,solve,compare,validate} from '../dist/engine.js';

function graphData(n, edges) {
  return {courses:Array.from({length:n},(_,i)=>({id:String(i),name:`Course ${i}`})),students:edges.map(([a,b],i)=>({student_id:`s${i}`,courses:[String(a),String(b)]}))};
}
function cycle(n) {return graphData(n,Array.from({length:n},(_,i)=>[i,(i+1)%n]));}
function bruteChromatic(data) {
  const {ids,adj}=buildGraph(data),colors={};
  function feasible(i,k) {
    if(i===ids.length)return true;
    const v=ids[i];
    for(let c=0;c<k;c++) if(!adj[v].some(n=>colors[n]===c)) {
      colors[v]=c;if(feasible(i+1,k))return true;delete colors[v];
    }
    return false;
  }
  for(let k=1;k<=ids.length;k++)if(feasible(0,k))return k;
  return 0;
}

test('CSV round trips quoted commas, BOM, CRLF, escaped quotes and repeated registration',()=>{
  const d=parseCSV('\uFEFFstudent_id,course_id,course_name\r\nS1,C1,"Discrete, Math"\r\nS1,C1,"Discrete, Math"\r\nS1,C2,"The ""Graph"" Course"\r\nS2,C1,"Discrete, Math"\r\n');
  assert.equal(d.students.length,2);assert.deepEqual(d.students[0].courses,['C1','C2']);
  assert.equal(d.courses[0].name,'Discrete, Math');assert.equal(d.courses[1].name,'The "Graph" Course');
  assert.equal(buildGraph(d).weights[0].students,1);
});

test('CSV rejects malformed headers, quotations, rows and conflicting names',()=>{
  for(const csv of ['', 'id,course\ns,c', 'student_id,course_id\ns,"unterminated', 'student_id,course_id\ns,c,extra', 'student_id,course_id\n,c', 'student_id,course_id,course_name\ns,c,One\nt,c,Two','student_id,student_id,course_id\na,b,c','student_id,course_id\ns,"c"bad'])assert.throws(()=>parseCSV(csv));
});

test('JSON normalizes duplicate registrations, preserves unregistered catalog courses and rejects ambiguity',()=>{
  const data=parseJSON(JSON.stringify({students:[{student_id:'S1',courses:['A','A']}],courses:[{id:'Z',name:'Zero enrollment'}]}));
  assert.deepEqual(data.students[0].courses,['A']);assert.equal(data.courses.length,2);
  for(const invalid of ['bad','{}','{"students":{}}','{"students":[{"student_id":"a","courses":[3]}]}','{"students":[{"student_id":"a","courses":[]},{"student_id":"a","courses":[]}]}','{"students":[],"courses":[{"id":"x"},{"id":"x"}]}'])assert.throws(()=>parseJSON(invalid));
});

test('special object-key course IDs cannot break graph or assignment bookkeeping',()=>{
  const data=parseJSON({courses:[{id:'__proto__'},{id:'constructor'},{id:'toString'}],students:[{student_id:'x',courses:['__proto__','constructor']}]});
  const result=solve(data);assert.equal(result.slot_count,2);assert.equal(result.validation.valid,true);
});

test('graph weights count shared students and graph remains symmetric',()=>{
  const data={students:[{student_id:'a',courses:['A','B','C']},{student_id:'b',courses:['A','B']},{student_id:'c',courses:['C']} ]};
  const graph=buildGraph(data);assert.equal(graph.edges,3);assert.equal(graph.density,1);assert.equal(graph.enrollment.A,2);
  assert.equal(graph.weights.find(e=>e.source==='A'&&e.target==='B').students,2);
  for(const v of graph.ids)for(const u of graph.adj[v])assert.ok(graph.adj[u].includes(v));
});

test('known graph families produce correct chromatic numbers and proper assignments',()=>{
  const completeEdges=[];for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)completeEdges.push([i,j]);
  const bipartiteEdges=[];for(let i=0;i<3;i++)for(let j=3;j<7;j++)bipartiteEdges.push([i,j]);
  const cases=[[graphData(5,[]),1],[graphData(6,completeEdges),6],[graphData(7,bipartiteEdges),2],[cycle(5),3],[cycle(6),2],[graphData(1,[]),1]];
  for(const [data,expected]of cases)for(const algorithm of ['welsh-powell','dsatur','exact']){
    const result=solve(data,{algorithm});assert.equal(result.slot_count,expected);assert.ok(result.validation.valid);
    if(algorithm==='exact')assert.ok(result.optimal);
    assert.equal(result.trace.length,data.courses.length);
    assert.equal(new Set(result.trace.map(s=>s.course)).size,data.courses.length);
  }
});

test('bounded exact search agrees with independent brute force across every 5-vertex graph',()=>{
  const pairs=[];for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)pairs.push([i,j]);
  for(let mask=0;mask<1<<pairs.length;mask++){
    const data=graphData(5,pairs.filter((_,i)=>mask&(1<<i)));
    const result=solve(data,{algorithm:'exact',optimize:false,timeLimitMs:10000});
    assert.equal(result.slot_count,bruteChromatic(data),`Graph mask ${mask}`);assert.ok(result.optimal);
  }
});

test('random larger small graphs agree with brute force',()=>{
  let x=142;
  const random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/2**32;};
  for(let k=0;k<70;k++){
    const n=6+k%4,edges=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(random()<0.18+(k%6)*0.13)edges.push([i,j]);
    const data=graphData(n,edges),result=solve(data,{algorithm:'exact',optimize:false,timeLimitMs:10000});
    assert.equal(result.slot_count,bruteChromatic(data));assert.ok(result.optimal);
  }
});

test('time and node budgets return a valid incumbent without claiming proof',()=>{
  for(const options of [{maxNodes:0},{timeLimitMs:0}]){
    const result=solve(cycle(5),{algorithm:'exact',optimize:false,...options});
    assert.equal(result.slot_count,3);assert.equal(result.lower_bound,2);assert.equal(result.optimal,false);assert.equal(result.exact_status,'budget-exhausted');assert.equal(result.validation.valid,true);
  }
  const big=solve(cycle(19),{algorithm:'exact'});assert.equal(big.exact_status,'skipped-size-limit');assert.equal(big.optimal,false);
});

test('independent validator catches coverage, unknown courses, invalid slots and every student clash',()=>{
  const data={students:[{student_id:'s1',courses:['A','B','C']},{student_id:'s2',courses:['A','B']}]};
  const good=validate(data,{A:0,B:1,C:2});assert.ok(good.valid);
  const missing=validate(data,{A:0,B:1});assert.deepEqual(missing.missing,['C']);assert.equal(missing.valid,false);
  const clash=validate(data,{A:0,B:0,C:0,extra:9});assert.equal(clash.clashes.length,2);assert.equal(clash.conflict_count,4);assert.deepEqual(clash.unknown,['extra']);assert.equal(clash.valid,false);
  assert.equal(validate(data,{A:-1,B:1,C:2}).valid,false);
});

test('generator is seeded, respects registration bounds and avoids repeated registrations',()=>{
  const a=generateData(),b=generateData();assert.deepEqual(a,b);assert.notDeepEqual(a,generateData({seed:43}));
  assert.equal(a.courses.length,30);assert.equal(a.students.length,300);
  for(const s of a.students){assert.ok(s.courses.length>=3&&s.courses.length<=6);assert.equal(new Set(s.courses).size,s.courses.length);}
  for(const settings of [{courses:0},{students:0},{minCourses:7,maxCourses:6},{seed:-1}])assert.throws(()=>generateData(settings));
});

test('soft optimization preserves slot count, never worsens objective and matches independent counting',()=>{
  function objective(data,colors,spd){let n=0;for(const s of data.students)for(let i=0;i<s.courses.length;i++)for(let j=i+1;j<s.courses.length;j++){const a=colors[s.courses[i]],b=colors[s.courses[j]];if(Math.abs(a-b)===1&&Math.floor(a/spd)===Math.floor(b/spd))n++;}return n;}
  for(let seed=0;seed<12;seed++){
    const data=generateData({courses:12,students:60,minCourses:2,maxCourses:4,seed});
    for(const spd of [1,2,3,4]){
      const plain=solve(data,{optimize:false,slotsPerDay:spd}),optimized=solve(data,{slotsPerDay:spd});
      assert.equal(plain.slot_count,optimized.slot_count);assert.ok(optimized.soft.after<=optimized.soft.before);assert.equal(optimized.soft.after,objective(data,optimized.colors,spd));assert.ok(optimized.validation.valid);
    }
  }
});

test('comparisons expose tested algorithms and input options fail explicitly',()=>{
  assert.deepEqual(compare(cycle(5)).map(r=>r.algorithm),['welsh-powell','dsatur','exact']);
  assert.equal(compare(generateData()).length,2);
  for(const options of [{algorithm:'magic'},{slotsPerDay:0},{slotsPerDay:2.5},{algorithm:'exact',maxNodes:-1},{algorithm:'exact',timeLimitMs:-1}])assert.throws(()=>solve(cycle(5),options));
});
