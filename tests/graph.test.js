import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compile, simulate } from '../src/automata.js';
import { layout } from '../src/graph.js';

const regression = '((a|b)*abb)|(abb(a|b)*)';
const variants = pattern => [compile(pattern), compile(pattern, { minimize: false }), compile(pattern, { kind: 'nfa' })];
const spaced = machine => layout(machine, { avoidOverlap: true });
const references = JSON.parse(readFileSync(new URL('./fixtures/layout-signatures.json', import.meta.url), 'utf8'));
const signature = ({ positions, edges }) => createHash('sha256').update(JSON.stringify({ positions: [...positions], edges })).digest('hex');

// Independent SVG M/L/Q/C sampler; browser tests also measure actual SVG paths.
function samplePath(d) {
  const tokens = d.match(/[MLQC]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi);
  let i = 0, current;
  const points = [];
  const point = () => ({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M') { current = point(); points.push(current); continue; }
    const controls = [current];
    for (let k = 0; k < ({ L: 1, Q: 2, C: 3 }[command]); k++) controls.push(point());
    assert.ok(controls.length >= 2, `unknown command ${command}`);
    const length = controls.slice(1).reduce((sum, p, index) => sum + Math.hypot(p.x - controls[index].x, p.y - controls[index].y), 0);
    const steps = Math.max(12, Math.ceil(length / 3));
    for (let n = 1; n <= steps; n++) {
      const t = n / steps;
      let work = controls;
      while (work.length > 1) work = work.slice(1).map((p, k) => ({ x: (1 - t) * work[k].x + t * p.x, y: (1 - t) * work[k].y + t * p.y }));
      points.push(work[0]);
    }
    current = controls.at(-1);
  }
  return points;
}
function assertClear(machine, description) {
  const graph = spaced(machine);
  assert.equal(graph.positions.size, machine.states.length);
  for (const edge of graph.edges) {
    assert.ok(!/NaN|Infinity/.test(edge.d), description);
    assert.ok(Number.isFinite(edge.labelX) && Number.isFinite(edge.labelY));
    const others = [...graph.positions].filter(([id]) => id !== edge.from && id !== edge.to);
    for (const p of samplePath(edge.d)) for (const [id, q] of others) {
      assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 29, `${description}: ${edge.from}→${edge.to} intersects state ${id}`);
    }
    for (const [id, p] of graph.positions) assert.ok(Math.hypot(edge.labelX - p.x, edge.labelY - p.y) > 31, `${description}: label on ${id}`);
  }
  return graph;
}

test('default and explicit off match pre-PR geometry exactly for 60 reference machines', () => {
  for (const fixture of references.fixtures) {
    const machine = compile(fixture.pattern, fixture.options);
    assert.equal(signature(layout(machine)), fixture.classic, `${fixture.pattern}: default`);
    assert.equal(signature(layout(machine, { avoidOverlap: false })), fixture.classic, `${fixture.pattern}: off`);
  }
});
test('opt-in matches PR #1 geometry exactly for 60 reference machines', () => {
  for (const fixture of references.fixtures) assert.equal(signature(spaced(compile(fixture.pattern, fixture.options))), fixture.spaced, fixture.pattern);
});
test('on/off round trips are reversible and leave machine/edge provenance unchanged', () => {
  for (const machine of variants(regression)) {
    const before = JSON.stringify(machine), original = layout(machine);
    for (let n = 0; n < 3; n++) for (const avoidOverlap of [true, false]) {
      const graph = layout(machine, { avoidOverlap });
      assert.deepEqual(graph, layout(machine, { avoidOverlap }));
      assert.deepEqual(graph.edges.flatMap(e => e.ids).sort(), machine.edges.map(e => e.id).sort());
      for (const edge of graph.edges) for (const id of edge.ids) {
        const source = machine.edges.find(e => e.id === id);
        assert.equal(edge.from, source.from); assert.equal(edge.to, source.to);
      }
    }
    assert.equal(JSON.stringify(machine), before);
    assert.deepEqual(layout(machine), original);
    assert.notDeepEqual(spaced(machine), original);
  }
});
test('reported union: opt-in routes around unrelated states and points lower loops outwards', () => {
  const machine = compile(regression);
  assert.equal(machine.states.length, 8);
  const graph = assertClear(machine, regression);
  assert.ok(graph.edges.find(e => e.from === 6 && e.to === 6).labelY > graph.positions.get(6).y);
});
test('only opt-in removes the seven-state horizontal spacing threshold', () => {
  const chain = count => ({ start: 0, states: Array.from({ length: count }, (_, id) => ({ id })), edges: Array.from({ length: count - 1 }, (_, id) => ({ id, from: id, to: id + 1, symbols: ['a'] })) });
  assert.equal(layout(chain(7)).positions.get(1).x - 76, 155);
  assert.equal(layout(chain(8)).positions.get(1).x - 76, 102);
  const a = spaced(chain(7)), b = spaced(chain(8));
  assert.deepEqual([...a.positions], [...b.positions].slice(0, 7));
  assert.ok(b.positions.get(1).x - b.positions.get(0).x >= 160);
});
test('opt-in geometry stays clear for the reference corpus in all three machine modes', () => {
  for (const fixture of references.fixtures) assertClear(compile(fixture.pattern, fixture.options), fixture.pattern);
});
test('same-rank reciprocal and disconnected states retain clearance when enabled', () => {
  assertClear({start: 0, states: [0, 1, 2, 3, 4, 5].map(id => ({ id })),
    edges: [[0, 1], [0, 2], [1, 2], [2, 1], [1, 3], [2, 3], [3, 1], [3, 2], [4, 5], [5, 4], [1, 1], [2, 2]].map(([from, to], id) => ({ id, from, to, symbols: ['a'] })),
  }, 'reciprocal/disconnected');
});
test('long labels and merged epsilon/symbol transitions are preserved in both modes', () => {
  const symbols = [...'acegikmoqsuwyACEGIKMOQSUWY🙂ğ'];
  const machine = { start: 0, states: [0, 1, 2].map(id => ({ id })), edges: [
    { id: 'epsilon', from: 0, to: 1, symbols: null }, { id: 'symbols', from: 0, to: 1, symbols },
    { id: 'loop', from: 1, to: 1, symbols }, { id: 'back', from: 1, to: 0, symbols: ['a'] }, { id: 'next', from: 1, to: 2, symbols },
  ] };
  for (const graph of [layout(machine), assertClear(machine, 'long labels')]) {
    const merged = graph.edges.find(e => e.from === 0 && e.to === 1);
    assert.deepEqual(merged.ids, ['epsilon', 'symbols']);
    assert.ok(merged.label.startsWith('ε, ')); assert.ok(merged.label.includes('🙂'));
  }
});
test('switching layouts never changes acceptance in any machine mode', () => {
  for (const machine of variants(regression)) for (const avoidOverlap of [false, true, false]) {
    const before = JSON.stringify(machine);
    layout(machine, { avoidOverlap });
    for (let length = 0; length <= 7; length++) for (let mask = 0; mask < 2 ** length; mask++) {
      const text = Array.from({ length }, (_, bit) => mask & (1 << bit) ? 'a' : 'b').join('');
      assert.equal(simulate(machine, text).accepted, text.startsWith('abb') || text.endsWith('abb'), `${machine.kind}: ${text}`);
    }
    assert.equal(simulate(machine, 'cabb').accepted, false);
    assert.equal(JSON.stringify(machine), before);
  }
});
test('60 seeded generated patterns have clear opt-in routes in all three modes', () => {
  let seed = 81461;
  const rand = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  const expression = depth => {
    if (!depth) return ['a', 'b', '[ab]', ''][rand(4)];
    const a = expression(depth - 1);
    switch (rand(4)) {
      case 0: return `(${a}|${expression(depth - 1)})`;
      case 1: return `(${a})${['*', '+', '?'][rand(3)]}`;
      default: return a + expression(depth - 1);
    }
  };
  for (let n = 0; n < 60; n++) for (const machine of variants(expression(3))) assertClear(machine, `generated ${n}/${machine.kind}`);
});
