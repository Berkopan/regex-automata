/** Regex → Thompson ε-NFA → subset DFA → optional partition minimization.
 * No native RegExp is used for matching. Symbols are Unicode code points.
 */
export const LIMITS = Object.freeze({ pattern: 180, nfa: 128, dfa: 96, alphabet: 96, input: 256, repeat: 24, frames: 12000 });
export class RegexError extends Error {
  constructor(message, position = null) {
    super(message); this.name = 'RegexError'; this.position = position;
  }
}
const sorted = values => [...new Set(values)].sort((a, b) => a - b);
const EPS = () => ({ type: 'epsilon' });
const sequence = parts => parts.length === 0 ? EPS() : parts.length === 1 ? parts[0] : { type: 'concat', parts };
const DIGITS = [...'0123456789'];
const WORD = [...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'];
const SPACE = [' ', '\t', '\n', '\r', '\f', '\v'];

export function parse(pattern) {
  if (typeof pattern !== 'string') throw new TypeError('Düzenli ifade bir metin olmalı.');
  const input = [...pattern];
  if (input.length > LIMITS.pattern) throw new RegexError(`En fazla ${LIMITS.pattern} karakterlik bir ifade kullanın.`);
  let i = 0;
  const fail = (message, position = i) => { throw new RegexError(message, position); };
  const peek = () => input[i];
  function escape() {
    const at = i++;
    if (i === input.length) fail('Ters eğik çizgiden sonra bir karakter gerekli.', at);
    const ch = input[i++];
    const shorthands = { d: DIGITS, w: WORD, s: SPACE };
    if (shorthands[ch]) return [...shorthands[ch]];
    const controls = { n: '\n', t: '\t', r: '\r', f: '\f', v: '\v' };
    if (Object.hasOwn(controls, ch)) return [controls[ch]];
    if ('\\|()*+?[]{}.^$-ε∅/'.includes(ch)) return [ch];
    fail(`\\${ch} desteklenmiyor. Geri başvurular ve Unicode kaçışları bu laboratuvarın kapsamı dışında.`, at);
  }
  function charClass() {
    const at = i++;
    if (peek() === '^') fail('Negatif karakter sınıfları desteklenmiyor. Açık bir küme kullanın: [abc].', i);
    const chars = new Set();
    const unit = () => peek() === '\\' ? escape() : [input[i++]];
    while (i < input.length && peek() !== ']') {
      const left = unit();
      if (peek() === '-' && input[i + 1] !== ']' && i + 1 < input.length) {
        i++;
        const right = unit();
        if (left.length !== 1 || right.length !== 1) fail('Aralığın iki ucu da tek bir karakter olmalı.', i - 1);
        const a = left[0].codePointAt(0), b = right[0].codePointAt(0);
        if (a > b) fail('Karakter aralığı ters yazılmış.', i - 1);
        if (b - a + 1 > LIMITS.alphabet) fail(`Bir aralık en fazla ${LIMITS.alphabet} sembol içerebilir.`, at);
        for (let cp = a; cp <= b; cp++) chars.add(String.fromCodePoint(cp));
      } else left.forEach(ch => chars.add(ch));
      if (chars.size > LIMITS.alphabet) fail(`Alfabe en fazla ${LIMITS.alphabet} sembol içerebilir.`, at);
    }
    if (peek() !== ']') fail('Karakter sınıfını kapatan ] eksik.', at);
    i++;
    if (!chars.size) fail('Boş karakter sınıfı yerine boş dil için ∅ kullanın.', at);
    return { type: 'chars', chars: [...chars] };
  }
  function atom() {
    const at = i, ch = peek();
    if (ch === '(') {
      i++;
      if (peek() === '?') fail('Lookaround ve özel grup türleri desteklenmiyor. Normal ( … ) grubu kullanın.', i);
      const node = union();
      if (peek() !== ')') fail('Grubu kapatan ) eksik.', at);
      i++; return node;
    }
    if (ch === '[') return charClass();
    if (ch === '\\') return { type: 'chars', chars: escape() };
    if (ch === '.') fail('Joker . desteklenmiyor. Sonlu bir karakter kümesi yazın; örneğin [a-z].');
    if (ch === '^' || ch === '$') fail('Çapa kullanmayın: bu laboratuvar zaten metnin tamamını eşleştirir.');
    if ('*+?{}'.includes(ch)) fail('Tekrar işaretinden önce bir karakter veya grup gerekli.');
    if (ch === ']') fail('Beklenmeyen ]. Gerçek ] karakteri için \\] kullanın.');
    i++;
    if (ch === 'ε') return EPS();
    if (ch === '∅') return { type: 'empty' };
    return { type: 'chars', chars: [ch] };
  }
  function repeated() {
    let node = atom();
    const ch = peek();
    if (ch === '*' || ch === '+' || ch === '?') {
      i++; node = { type: 'repeat', child: node, min: ch === '+' ? 1 : 0, max: ch === '?' ? 1 : Infinity };
    } else if (ch === '{') {
      const at = i++;
      function number() {
        let n = '';
        while (peek() !== undefined && DIGITS.includes(peek())) n += input[i++];
        return n ? Number(n) : null;
      }
      const min = number();
      if (min === null) fail('Tekrar sayısı gerekli: {3}, {2,4} veya {2,}.', at);
      let max = min;
      if (peek() === ',') { i++; max = number() ?? Infinity; }
      if (peek() !== '}') fail('Tekrar ifadesini kapatan } eksik.', at);
      i++;
      if (max < min) fail('Üst tekrar sınırı alt sınırdan küçük olamaz.', at);
      if (min > LIMITS.repeat || (max !== Infinity && max > LIMITS.repeat)) fail(`Tekrar sınırı en fazla ${LIMITS.repeat} olabilir.`, at);
      node = { type: 'repeat', child: node, min, max };
    }
    if (peek() !== undefined && '*+?{'.includes(peek())) fail('Üst üste tekrar işareti kullanmayın; lazy/possessive tekrarlar desteklenmiyor.');
    return node;
  }
  function concat() {
    const parts = [];
    while (i < input.length && peek() !== ')' && peek() !== '|') parts.push(repeated());
    return sequence(parts);
  }
  function union() {
    const parts = [concat()];
    while (peek() === '|') { i++; parts.push(concat()); }
    return parts.length === 1 ? parts[0] : { type: 'union', parts };
  }
  const ast = union();
  if (i !== input.length) fail('Beklenmeyen ). Açılan bir grup yok.');
  return ast;
}

export function thompson(ast) {
  const states = [], edges = [];
  function state() {
    if (states.length >= LIMITS.nfa) throw new RegexError(`NFA ${LIMITS.nfa} durum sınırını aşıyor. Daha küçük bir ifade deneyin.`);
    const id = states.length; states.push({ id, accepting: false }); return id;
  }
  function edge(from, to, symbols = null) {
    edges.push({ id: `e${edges.length}`, from, to, symbols });
  }
  function join(parts) {
    if (!parts.length) return build(EPS());
    for (let j = 1; j < parts.length; j++) edge(parts[j - 1].end, parts[j].start);
    return { start: parts[0].start, end: parts.at(-1).end };
  }
  function optional(child, loop, skip) {
    const start = state(), part = build(child), end = state();
    edge(start, part.start); edge(part.end, end);
    if (skip) edge(start, end);
    if (loop) edge(part.end, part.start);
    return { start, end };
  }
  function build(node) {
    if (node.type === 'concat') return join(node.parts.map(build));
    if (node.type === 'union') {
      const start = state(), parts = node.parts.map(build), end = state();
      for (const part of parts) { edge(start, part.start); edge(part.end, end); }
      return { start, end };
    }
    if (node.type === 'repeat') {
      const { child, min, max } = node;
      if (min === 0 && max === Infinity) return optional(child, true, true);
      if (min === 1 && max === Infinity) return optional(child, true, false);
      if (min === 0 && max === 1) return optional(child, false, true);
      const parts = Array.from({ length: min }, () => build(child));
      if (max === Infinity) parts.push(optional(child, true, true));
      else for (let n = min; n < max; n++) parts.push(optional(child, false, true));
      return join(parts);
    }
    const start = state(), end = state();
    if (node.type === 'chars') edge(start, end, [...node.chars]);
    else if (node.type === 'epsilon') edge(start, end);
    else if (node.type !== 'empty') throw new TypeError(`Bilinmeyen AST türü: ${node.type}`);
    return { start, end };
  }
  const { start, end } = build(ast);
  states[end].accepting = true;
  const alphabet = [...new Set(edges.flatMap(e => e.symbols ?? []))].sort();
  if (alphabet.length > LIMITS.alphabet) throw new RegexError(`Alfabe en fazla ${LIMITS.alphabet} farklı sembol içerebilir.`);
  return { kind: 'nfa', states, edges, start, alphabet, minimized: false };
}

const indexCache = new WeakMap();
export function outgoing(machine) {
  if (!indexCache.has(machine)) {
    const index = new Map(machine.states.map(s => [s.id, []]));
    for (const edge of machine.edges) index.get(edge.from).push(edge);
    indexCache.set(machine, index);
  }
  return indexCache.get(machine);
}
export function epsilonClosure(machine, seeds) {
  const index = outgoing(machine), seen = new Set(seeds), stack = [...seeds];
  while (stack.length) {
    for (const edge of index.get(stack.pop()) ?? []) {
      if (edge.symbols === null && !seen.has(edge.to)) { seen.add(edge.to); stack.push(edge.to); }
    }
  }
  return sorted(seen);
}

export function determinize(nfa) {
  const index = outgoing(nfa), states = [], edges = [], known = new Map();
  const accepting = new Set(nfa.states.filter(s => s.accepting).map(s => s.id));
  function add(subset) {
    const key = subset.join(',');
    if (known.has(key)) return known.get(key);
    if (states.length >= LIMITS.dfa) throw new RegexError(`Altküme dönüşümü ${LIMITS.dfa} DFA durumu sınırına ulaştı. NFA görünümünü veya daha küçük bir ifadeyi deneyin.`);
    const id = states.length; known.set(key, id);
    states.push({ id, accepting: subset.some(s => accepting.has(s)), subsets: [subset], dead: subset.length === 0 });
    return id;
  }
  add(epsilonClosure(nfa, [nfa.start]));
  for (let i = 0; i < states.length; i++) {
    const destinations = new Map();
    for (const symbol of nfa.alphabet) {
      const seeds = [];
      for (const id of states[i].subsets[0]) for (const edge of index.get(id)) {
        if (edge.symbols?.includes(symbol)) seeds.push(edge.to);
      }
      const to = add(epsilonClosure(nfa, seeds));
      if (!destinations.has(to)) destinations.set(to, []);
      destinations.get(to).push(symbol);
    }
    for (const [to, symbols] of destinations) edges.push({ id: `e${edges.length}`, from: i, to, symbols });
  }
  return { kind: 'dfa', states, edges, start: 0, alphabet: [...nfa.alphabet], minimized: false, nfaSize: nfa.states.length };
}

/** Moore-style partition refinement on the reachable, complete DFA. */
export function minimizeDFA(dfa) {
  if (dfa.kind !== 'dfa') throw new TypeError('Yalnızca DFA minimize edilebilir.');
  const table = new Map(dfa.states.map(s => [s.id, new Map()]));
  for (const edge of dfa.edges) for (const symbol of edge.symbols) table.get(edge.from).set(symbol, edge.to);
  let groups = [dfa.states.filter(s => !s.accepting).map(s => s.id), dfa.states.filter(s => s.accepting).map(s => s.id)].filter(g => g.length);
  while (true) {
    const groupOf = new Map(groups.flatMap((group, id) => group.map(s => [s, id])));
    const next = [];
    for (const group of groups) {
      const buckets = new Map();
      for (const id of group) {
        const signature = dfa.alphabet.map(symbol => groupOf.get(table.get(id).get(symbol))).join(',');
        if (!buckets.has(signature)) buckets.set(signature, []);
        buckets.get(signature).push(id);
      }
      next.push(...buckets.values());
    }
    if (next.length === groups.length) break;
    groups = next;
  }
  const groupOf = new Map(groups.flatMap((group, id) => group.map(s => [s, id])));
  // Renumber in breadth-first order: the initial state is always q0.
  const order = [groupOf.get(dfa.start)], numbered = new Map([[order[0], 0]]);
  for (let i = 0; i < order.length; i++) for (const symbol of dfa.alphabet) {
    const target = groupOf.get(table.get(groups[order[i]][0]).get(symbol));
    if (!numbered.has(target)) { numbered.set(target, order.length); order.push(target); }
  }
  const byId = new Map(dfa.states.map(s => [s.id, s]));
  const states = order.map((g, id) => ({
    id, accepting: byId.get(groups[g][0]).accepting,
    members: [...groups[g]], subsets: groups[g].flatMap(s => byId.get(s).subsets), dead: false,
  }));
  const edges = [];
  order.forEach((groupId, from) => {
    const destinations = new Map();
    for (const symbol of dfa.alphabet) {
      const to = numbered.get(groupOf.get(table.get(groups[groupId][0]).get(symbol)));
      if (!destinations.has(to)) destinations.set(to, []);
      destinations.get(to).push(symbol);
    }
    for (const [to, symbols] of destinations) edges.push({ id: `e${edges.length}`, from, to, symbols });
    states[from].dead = !states[from].accepting && [...destinations.keys()].every(to => to === from);
  });
  return { kind: 'dfa', states, edges, start: 0, alphabet: [...dfa.alphabet], minimized: true, nfaSize: dfa.nfaSize, unminimizedSize: dfa.states.length };
}

export function compile(pattern, { kind = 'dfa', minimize = true } = {}) {
  if (!['dfa', 'nfa'].includes(kind)) throw new TypeError('Makine türü dfa veya nfa olmalı.');
  const nfa = thompson(parse(pattern));
  if (kind === 'nfa') return nfa;
  const dfa = determinize(nfa);
  return minimize ? minimizeDFA(dfa) : dfa;
}

/** Every ε wave is a frame and consumes no input. Cycles terminate via visited states. */
export function simulate(machine, text) {
  if (typeof text !== 'string') throw new TypeError('Girdi bir metin olmalı.');
  const input = [...text];
  if (input.length > LIMITS.input) throw new RegexError(`Simülasyon metni en fazla ${LIMITS.input} karakter olabilir.`);
  const index = outgoing(machine), frames = [];
  let active = [machine.start];
  function push(frame) {
    if (frames.length >= LIMITS.frames) throw new RegexError('Bu simülasyon çok fazla adım üretiyor. Daha kısa bir metin kullanın.');
    frames.push({ edges: [], consumed: 0, previous: [], added: [], ...frame, active: [...active] });
  }
  function close(consumed) {
    const seen = new Set(active);
    let frontier = [...active];
    while (frontier.length) {
      const edges = [], added = [];
      for (const id of frontier) for (const edge of index.get(id) ?? []) if (edge.symbols === null) {
        edges.push(edge.id);
        if (!seen.has(edge.to)) { seen.add(edge.to); added.push(edge.to); }
      }
      if (!edges.length) break;
      const previous = [...active]; active = sorted(seen);
      push({ kind: 'epsilon', consumed, edges, added: sorted(added), previous });
      frontier = added;
    }
  }
  push({ kind: 'start' });
  if (machine.kind === 'nfa') close(0);
  for (let i = 0; i < input.length; i++) {
    const symbol = input[i], edges = [], targets = [], previous = [...active];
    for (const id of active) for (const edge of index.get(id) ?? []) if (edge.symbols?.includes(symbol)) {
      edges.push(edge.id); targets.push(edge.to);
    }
    active = sorted(targets);
    push({ kind: 'read', symbol, consumed: i + 1, edges, previous, outside: !machine.alphabet.includes(symbol) });
    if (machine.kind === 'nfa') close(i + 1);
  }
  const finals = new Set(machine.states.filter(s => s.accepting).map(s => s.id));
  const accepted = active.some(s => finals.has(s));
  push({ kind: 'result', consumed: input.length, accepted });
  return { input, frames, accepted };
}

export function symbolLabel(symbol) {
  return ({ ' ': '␠', '\n': '\\n', '\t': '\\t', '\r': '\\r', '\f': '\\f', '\v': '\\v' })[symbol] ?? symbol;
}
export function symbolsLabel(symbols) {
  if (symbols === null) return 'ε';
  const chars = [...new Set(symbols)].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
  const parts = [];
  for (let i = 0; i < chars.length; i++) {
    let j = i;
    const asciiAlnum = c => /[0-9A-Za-z]/u.test(c);
    const category = c => c <= '9' ? 0 : c <= 'Z' ? 1 : 2;
    while (j + 1 < chars.length && asciiAlnum(chars[i]) && asciiAlnum(chars[j + 1]) && category(chars[i]) === category(chars[j + 1]) && chars[j + 1].codePointAt(0) === chars[j].codePointAt(0) + 1) j++;
    if (j - i >= 2) { parts.push(`${chars[i]}–${chars[j]}`); i = j; }
    else parts.push(symbolLabel(chars[i]));
  }
  return parts.join(', ');
}
export const stateLabel = id => `q${String(id).replace(/[0-9]/g, d => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])}`;
export const stateSetLabel = ids => ids.length ? `{${ids.map(stateLabel).join(', ')}}` : '∅';
