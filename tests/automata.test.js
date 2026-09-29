import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, parse, simulate, epsilonClosure, symbolsLabel, symbolLabel, LIMITS, RegexError } from '../src/automata.js';

const variants = pattern => [compile(pattern, { kind: 'nfa' }), compile(pattern, { minimize: false }), compile(pattern)];
function expectLanguage(pattern, yes, no) {
  for (const machine of variants(pattern)) {
    for (const text of yes) assert.equal(simulate(machine, text).accepted, true, `${pattern} accepts ${JSON.stringify(text)} (${machine.kind})`);
    for (const text of no) assert.equal(simulate(machine, text).accepted, false, `${pattern} rejects ${JSON.stringify(text)} (${machine.kind})`);
  }
}

test('textbook suffix language and minimal four-state DFA', () => {
  expectLanguage('(a|b)*abb', ['abb', 'aabb', 'babb', 'abbaabb'], ['', 'ab', 'abbb', 'abba', 'cabb']);
  assert.equal(compile('(a|b)*abb').states.length, 4);
});
test('concatenation binds more tightly than alternation', () => expectLanguage('ab|c', ['ab', 'c'], ['a', 'b', 'ac', 'abc']));
test('quantifiers bind more tightly than concatenation', () => expectLanguage('ab*', ['a', 'ab', 'abbb'], ['', 'b', 'abab']));
test('empty pattern, epsilon, empty groups and empty alternatives', () => {
  for (const p of ['', 'ε', '()']) expectLanguage(p, [''], ['a', 'ε']);
  for (const p of ['a|', '|a', 'a|ε']) expectLanguage(p, ['', 'a'], ['aa', 'b']);
});
test('empty language and empty language under repetition', () => {
  expectLanguage('∅', [], ['', 'a']);
  expectLanguage('∅*', [''], ['a']);
  expectLanguage('a∅', [], ['', 'a']);
  expectLanguage('∅|a', ['a'], ['', 'aa']);
});
test('plus, optional and bounded repetitions', () => {
  expectLanguage('(ab)+c?', ['ab', 'abc', 'abab', 'ababc'], ['', 'c', 'ac', 'abcc']);
  expectLanguage('a{2,4}', ['aa', 'aaa', 'aaaa'], ['', 'a', 'aaaaa']);
  expectLanguage('(ab){2,}', ['abab', 'ababab'], ['', 'ab', 'aba']);
  expectLanguage('a{0}', [''], ['a']);
  expectLanguage('a{3}', ['aaa'], ['aa', 'aaaa']);
});
test('character classes, literal hyphens and range expansion', () => {
  expectLanguage('[a-c0-2]+', ['a', 'ac12', '020'], ['', 'd', '3']);
  expectLanguage('[a-]+', ['a-', '--'], ['b']);
  expectLanguage('[-a]+', ['a-', '--'], ['b']);
});
test('ASCII shorthands and control characters', () => {
  expectLanguage('\\d{2}\\w?', ['12', '12a', '12_', '129'], ['1', '1234', '١٢']);
  expectLanguage('a\\s?b', ['ab', 'a b', 'a\nb', 'a\tb'], ['a  b', 'a\u00a0b']);
});
test('escaped metacharacters and epsilon as a literal', () => {
  expectLanguage('a\\+b\\.\\ε', ['a+b.ε'], ['abε', 'aaabx']);
  expectLanguage('\\[\\]\\\\', ['[]\\'], ['[]']);
});
test('Unicode input is consumed by code point, not UTF-16 code unit', () => {
  expectLanguage('(ğ|🙂)+', ['ğ', '🙂', 'ğ🙂🙂'], ['', 'g']);
  const result = simulate(compile('🙂a'), '🙂a');
  assert.equal(result.input.length, 2);
  assert.equal(result.frames.filter(f => f.kind === 'read').length, 2);
});
test('whitespace is significant and input is never trimmed', () => {
  expectLanguage(' a ', [' a '], ['a', ' a', 'a ']);
  expectLanguage('a', ['a'], ['a\n', '\na', ' a', 'a ']);
});
test('matching is whole-string, not substring search', () => expectLanguage('ab', ['ab'], ['xab', 'abx', 'xabx']));
test('nested epsilon cycles terminate', () => {
  expectLanguage('((a?)*)*', ['', 'a', 'aaa'], ['b', 'ab']);
  const m = compile('(ε*)*', { kind: 'nfa' });
  const trace = simulate(m, '');
  assert.ok(trace.frames.length < 20);
  assert.deepEqual(trace.frames.at(-1).active, epsilonClosure(m, [m.start]));
});
test('NFA keeps every nondeterministic branch active', () => {
  const m = compile('ab|ac', { kind: 'nfa' });
  const trace = simulate(m, 'ac');
  const readA = trace.frames.find(f => f.kind === 'read' && f.symbol === 'a');
  assert.equal(readA.active.length, 2);
  assert.equal(readA.edges.length, 2);
  assert.equal(trace.accepted, true);
});
test('epsilon frames do not consume a character and only accumulate states', () => {
  const trace = simulate(compile('(a|ε)*b', { kind: 'nfa' }), 'aab');
  for (let i = 1; i < trace.frames.length; i++) {
    const frame = trace.frames[i], prev = trace.frames[i - 1];
    if (frame.kind === 'epsilon') {
      assert.equal(frame.consumed, prev.consumed);
      assert.ok(prev.active.every(id => frame.active.includes(id)));
    }
    if (frame.kind === 'read') assert.equal(frame.consumed, prev.consumed + 1);
  }
});
test('an accepting prefix is not an early acceptance', () => {
  const trace = simulate(compile('a*'), 'ab');
  assert.equal(trace.frames[0].kind, 'start');
  assert.equal(trace.accepted, false);
  assert.equal(trace.frames.filter(f => Object.hasOwn(f, 'accepted')).length, 1);
});
test('DFA is total over its own alphabet and has no epsilon edges', () => {
  for (const m of [compile('ab', { minimize: false }), compile('ab')]) {
    for (const state of m.states) for (const symbol of m.alphabet) {
      assert.equal(m.edges.filter(e => e.from === state.id && e.symbols?.includes(symbol)).length, 1);
    }
    assert.ok(m.edges.every(e => e.symbols !== null));
    assert.ok(m.states.some(s => s.dead));
  }
});
test('outside-alphabet characters reject without changing the constructed machine', () => {
  const m = compile('a*'), before = JSON.stringify(m);
  const result = simulate(m, 'aca');
  assert.equal(result.accepted, false);
  const bad = result.frames.find(f => f.kind === 'read' && f.symbol === 'c');
  assert.equal(bad.outside, true);
  assert.deepEqual(bad.active, []);
  assert.equal(JSON.stringify(m), before);
});
test('minimization preserves provenance and removes equivalent states', () => {
  const raw = compile('a|b', { minimize: false }), small = compile('a|b');
  assert.ok(small.states.length < raw.states.length);
  assert.equal(small.start, 0);
  assert.equal(small.states.flatMap(s => s.members).length, raw.states.length);
  assert.equal(compile('(a|b)*').states.length, 1);
});
test('syntax errors are typed and have useful positions', () => {
  for (const p of ['(', ')', 'a)', '[a', '[]', '[z-a]', '[a-\\d]', 'a**', 'a*?', '*a', 'a{2,1}', 'a{', 'a{}', 'a\\', '\\1', '(?=a)', '[^a]', '.', '^a$', '\\p']) {
    assert.throws(() => compile(p), error => error instanceof RegexError && Number.isInteger(error.position), p);
  }
});
test('resource limits fail with controlled errors', () => {
  assert.throws(() => compile('a'.repeat(LIMITS.pattern + 1)), RegexError);
  assert.throws(() => compile('a{25}'), RegexError);
  assert.throws(() => compile('[\u0000-\uffff]'), RegexError);
  assert.throws(() => compile('a'.repeat(70), { kind: 'nfa' }), RegexError);
  assert.throws(() => simulate(compile('a'), 'a'.repeat(LIMITS.input + 1)), RegexError);
  assert.throws(() => compile('(a|b)*a(a|b){7}', { minimize: false }), /DFA durumu/);
});
test('labels are explicit for invisible symbols and compact for ranges', () => {
  assert.equal(symbolLabel(' '), '␠');
  assert.equal(symbolLabel('\n'), '\\n');
  assert.equal(symbolsLabel(null), 'ε');
  assert.equal(symbolsLabel([...'abcxyz019']), '0, 1, 9, a–c, x–z');
});
test('parse and compile reject wrong API types', () => {
  assert.throws(() => parse(null), TypeError);
  assert.throws(() => compile('a', { kind: 'pda' }), TypeError);
  assert.throws(() => simulate(compile('a'), null), TypeError);
});

// Seeded property test: all three automata agree with an independent native
// regex oracle for the supported shared subset. End-of-input is strict (not $).
test('200 seeded regexes × 63 strings × 3 automata agree with native RegExp', () => {
  let seed = 78123;
  const rand = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  function expression(depth) {
    if (!depth) return ['a', 'b', '[ab]', ''][rand(4)];
    const a = expression(depth - 1);
    switch (rand(5)) {
      case 0: return `(${a}|${expression(depth - 1)})`;
      case 1: return `(${a})${['*', '+', '?', '{0,2}', '{1,2}'][rand(5)]}`;
      default: return `${a}${expression(depth - 1)}`;
    }
  }
  const strings = [''];
  for (let length = 1; length <= 5; length++) for (let mask = 0; mask < 2 ** length; mask++) {
    strings.push(Array.from({ length }, (_, bit) => mask & (1 << bit) ? 'a' : 'b').join(''));
  }
  for (let n = 0; n < 200; n++) {
    const pattern = expression(3);
    const oracle = new RegExp(`^(?:${pattern})(?![\\s\\S])`, 'u');
    for (const m of variants(pattern)) for (const text of strings) {
      assert.equal(simulate(m, text).accepted, oracle.test(text), `${pattern}, ${JSON.stringify(text)}, ${m.kind}/${m.minimized}`);
    }
  }
});
