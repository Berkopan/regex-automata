import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, simulate } from '../src/automata.js';
import { layout } from '../src/graph.js';

const regression = '((a|b)*abb)|(abb(a|b)*)';
const variants = pattern => [compile(pattern), compile(pattern, { minimize: false }), compile(pattern, { kind: 'nfa' })];

// Independent SVG M/L/Q/C sampler. Browser tests additionally measure the real
// SVG paths with getPointAtLength and the actual font bounds with getBBox.
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
  const graph = layout(machine);
  assert.equal(graph.positions.size, machine.states.length);
  for (const edge of graph.edges) {
    assert.ok(!/NaN|Infinity/.test(edge.d), description);
    assert.ok(Number.isFinite(edge.labelX) && Number.isFinite(edge.labelY));
    const others = [...graph.positions].filter(([id]) => id !== edge.from && id !== edge.to);
    for (const p of samplePath(edge.d)) for (const [id, q] of others) {
      assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 29, `${description}: ${edge.from}→${edge.to} intersects state ${id}`);
    }
    for (const [id, p] of graph.positions) {
      // The baseline itself must not sit on any state. Full glyph boxes are
      // checked in Chromium, including the SVG's stroke halo.
      assert.ok(Math.hypot(edge.labelX - p.x, edge.labelY - p.y) > 31, `${description}: label on ${id}`);
    }
  }
  return graph;
}

test('reported prefix/suffix union: no transition passes through an unrelated state', () => {
  const machine = compile(regression);
  assert.equal(machine.states.length, 8);
  const graph = assertClear(machine, regression);
  const lowerLoop = graph.edges.find(e => e.from === 6 && e.to === 6);
  assert.ok(lowerLoop.labelY > graph.positions.get(6).y, 'lower-row loop points outwards');
});

test('layout is deterministic, preserves all original edge IDs, and never mutates the machine', () => {
  for (const machine of variants(regression)) {
    const before = JSON.stringify(machine);
    const a = layout(machine), b = layout(machine);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(machine), before);
    assert.deepEqual(a.edges.flatMap(e => e.ids).sort(), machine.edges.map(e => e.id).sort());
    for (const edge of a.edges) for (const id of edge.ids) {
      const original = machine.edges.find(e => e.id === id);
      assert.equal(edge.from, original.from);
      assert.equal(edge.to, original.to);
    }
  }
});

test('passing seven states no longer reduces horizontal clearance', () => {
  const chain = count => ({ start: 0, states: Array.from({ length: count }, (_, id) => ({ id })), edges: Array.from({ length: count - 1 }, (_, id) => ({ id, from: id, to: id + 1, symbols: ['a'] })) });
  const a = layout(chain(7)), b = layout(chain(8));
  assert.deepEqual([...a.positions], [...b.positions].slice(0, 7));
  assert.ok(b.positions.get(1).x - b.positions.get(0).x >= 160);
});

test('DFA, unminimized DFA, and epsilon-NFA route safely for a varied corpus', () => {
  const patterns = ['', 'ε', '∅', 'a*', 'ab', '(a|b)*abb', regression, 'ab|ac', '(a|b|c)*abc', '(ab|ba)*', 'a(b|c)+', '((a?)*)*', '(ε*)*', '(a|ε)*b', '(ab){2,4}', '[a-zA-Z0-9_]+', '(🙂|ğ)+', '(a|b)*a(a|b){3}', 'a?b?c?d?', '(a|b|c|d){2}'];
  for (const pattern of patterns) for (const machine of variants(pattern)) assertClear(machine, `${pattern}/${machine.kind}/${machine.minimized}`);
});

test('same-rank reciprocal and disconnected states retain clearance', () => {
  const machine = {
    start: 0, states: [0, 1, 2, 3, 4, 5].map(id => ({ id })),
    edges: [[0, 1], [0, 2], [1, 2], [2, 1], [1, 3], [2, 3], [3, 1], [3, 2], [4, 5], [5, 4], [1, 1], [2, 2]].map(([from, to], id) => ({ id, from, to, symbols: ['a'] })),
  };
  assertClear(machine, 'reciprocal/disconnected');
});

test('long labels and merged epsilon/symbol edges are preserved for tooltips', () => {
  const symbols = [...'acegikmoqsuwyACEGIKMOQSUWY🙂ğ'];
  const machine = { start: 0, states: [0, 1, 2].map(id => ({ id })), edges: [
    { id: 'epsilon', from: 0, to: 1, symbols: null },
    { id: 'symbols', from: 0, to: 1, symbols },
    { id: 'loop', from: 1, to: 1, symbols },
    { id: 'back', from: 1, to: 0, symbols: ['a'] },
    { id: 'next', from: 1, to: 2, symbols },
  ] };
  const graph = assertClear(machine, 'long labels');
  const merged = graph.edges.find(e => e.from === 0 && e.to === 1);
  assert.deepEqual(merged.ids, ['epsilon', 'symbols']);
  assert.ok(merged.label.startsWith('ε, '));
  assert.ok(merged.label.includes('🙂'));
});

test('reported language keeps the same acceptance in all three machine modes', () => {
  for (const machine of variants(regression)) {
    const before = JSON.stringify(machine);
    layout(machine);
    for (let length = 0; length <= 7; length++) for (let mask = 0; mask < 2 ** length; mask++) {
      const text = Array.from({ length }, (_, bit) => mask & (1 << bit) ? 'a' : 'b').join('');
      assert.equal(simulate(machine, text).accepted, text.startsWith('abb') || text.endsWith('abb'), `${machine.kind}: ${text}`);
    }
    assert.equal(simulate(machine, 'cabb').accepted, false);
    assert.equal(JSON.stringify(machine), before);
  }
});

test('seeded generated layouts keep routes outside unrelated state circles', () => {
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
  for (let n = 0; n < 60; n++) {
    const pattern = expression(3);
    for (const machine of variants(pattern)) assertClear(machine, `${pattern}/${machine.kind}`);
  }
});
