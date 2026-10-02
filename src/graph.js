import { stateLabel, symbolsLabel } from './automata.js';
import { t } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const R = 23;
const svgStyle = `
  .edge-line,.start-line{fill:none;stroke:#555b60;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}
  .label-leader{fill:none;stroke:#92999e;stroke-width:1;stroke-dasharray:3 3;pointer-events:none}
  .edge-label{font:16px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#30363a;paint-order:stroke;stroke:#f6f2e9;stroke-width:6;stroke-linejoin:round;text-anchor:middle}
  .state .outer{fill:#fbf8f1;stroke:#30363a;stroke-width:1.65}
  .state .inner{fill:none;stroke:#30363a;stroke-width:1.4;pointer-events:none}
  .state-label{font:italic 23px Georgia,'Times New Roman',serif;fill:#252b30;text-anchor:middle;dominant-baseline:central;pointer-events:none}
  .state{cursor:pointer;outline:none}
  .state:focus-visible .outer,.state.is-selected .outer{stroke-width:3}
  .state.is-active .outer{fill:#eaf1f8;stroke:#245a8c;stroke-width:2.8}
  .state.is-active .inner{stroke:#245a8c}
  .state.is-active .state-label{fill:#184873}
  .state.is-accepted .outer{fill:#edf5ef;stroke:#32634a;stroke-width:2.8}
  .state.is-accepted .inner{stroke:#32634a}
  .state.is-rejected .outer{fill:#fbefed;stroke:#963f38;stroke-width:2.8}
  .transition.is-used .edge-line{stroke:#245a8c;stroke-width:2.7;marker-end:url(#arrow-active)}
  .transition.is-used .edge-label{fill:#184873;font-weight:600}
  .travel-dot{fill:#245a8c;stroke:#fff;stroke-width:1.2;pointer-events:none}
`;
function element(tag, attrs = {}, text = null) {
  const el = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  if (text !== null) el.textContent = text;
  return el;
}

// Keep measurement and rendering in sync, including Unicode labels.
const displayLabel = label => [...label].length > 28 ? [...label].slice(0, 26).join('') + '…' : label;
const labelWidth = label => [...displayLabel(label)].reduce((width, ch) => width + (ch.codePointAt(0) > 0x2fff ? 17 : 10), 0) + 12;

// Rounded orthogonal routes leave/enter states horizontally. Their vertical
// sections stay in inter-column gutters, never through a stack of states.
function roundedRoute(points) {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const ab = Math.hypot(b.x - a.x, b.y - a.y), bc = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(16, ab / 2, bc / 2);
    if (!ab || !bc) continue;
    const before = { x: b.x + (a.x - b.x) * r / ab, y: b.y + (a.y - b.y) * r / ab };
    const after = { x: b.x + (c.x - b.x) * r / bc, y: b.y + (c.y - b.y) * r / bc };
    d += ` L ${before.x} ${before.y} Q ${b.x} ${b.y} ${after.x} ${after.y}`;
  }
  const end = points.at(-1);
  return d + ` L ${end.x} ${end.y}`;
}

/** Deterministic layered layout; no force simulation or runtime dependency.
 * State, loop, label, and return-route clearance is reserved before routing. */
export function layout(machine) {
  const merged = new Map();
  for (const edge of machine.edges) {
    const key = `${edge.from}:${edge.to}`;
    if (!merged.has(key)) merged.set(key, { from: edge.from, to: edge.to, ids: [], labels: [], symbols: [], epsilon: false });
    const group = merged.get(key);
    group.ids.push(edge.id);
    if (edge.symbols === null) group.epsilon = true;
    else group.symbols.push(...edge.symbols);
  }
  const edges = [...merged.values()];
  edges.forEach(e => { e.label = [e.epsilon ? 'ε' : '', e.symbols.length ? symbolsLabel(e.symbols) : ''].filter(Boolean).join(', '); });
  const adj = new Map(machine.states.map(s => [s.id, []]));
  for (const edge of edges) adj.get(edge.from).push(edge);
  const color = new Map(), feedback = new Set();
  function visit(id) {
    color.set(id, 1);
    for (const edge of adj.get(id)) {
      if (color.get(edge.to) === 1) feedback.add(edge);
      else if (!color.has(edge.to)) visit(edge.to);
    }
    color.set(id, 2);
  }
  visit(machine.start);
  machine.states.forEach(s => { if (!color.has(s.id)) visit(s.id); });
  const forward = edges.filter(e => !feedback.has(e));
  const degree = new Map(machine.states.map(s => [s.id, 0]));
  const rank = new Map(machine.states.map(s => [s.id, 0]));
  forward.forEach(e => degree.set(e.to, degree.get(e.to) + 1));
  const queue = machine.states.filter(s => degree.get(s.id) === 0).map(s => s.id);
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    for (const e of adj.get(id)) if (!feedback.has(e)) {
      rank.set(e.to, Math.max(rank.get(e.to), rank.get(id) + 1));
      degree.set(e.to, degree.get(e.to) - 1);
      if (degree.get(e.to) === 0) queue.push(e.to);
    }
  }
  const count = Math.max(...rank.values()) + 1;
  const layers = Array.from({ length: count }, () => []);
  machine.states.forEach(s => layers[rank.get(s.id)].push(s.id));
  // Barycenter sweeps reduce crossings between neighboring layers.
  const order = new Map();
  const refresh = () => layers.forEach(layer => layer.forEach((id, i) => order.set(id, i - (layer.length - 1) / 2)));
  refresh();
  for (let pass = 0; pass < 6; pass++) {
    const left = pass % 2 === 0;
    for (let k = 0; k < count; k++) {
      const r = left ? k : count - k - 1;
      const score = id => {
        const neighbors = forward.filter(e => left ? e.to === id : e.from === id).map(e => order.get(left ? e.from : e.to));
        return neighbors.length ? neighbors.reduce((a, b) => a + b, 0) / neighbors.length : order.get(id);
      };
      layers[r].sort((a, b) => score(a) - score(b) || a - b); refresh();
    }
  }
  // Do not squeeze diagrams at the old seven-state threshold. Reserve a
  // gutter per non-local endpoint and enough room for the displayed labels.
  const gutters = layers.map(() => ({ left: 0, right: 0 }));
  const ports = new Map();
  const port = (id, side, vertical) => {
    const key = `${id}:${side}:${vertical}`;
    const list = ports.get(key) ?? [];
    const value = { id, side, vertical, index: list.length, list };
    list.push(value); ports.set(key, list); return value;
  };
  const routes = new Map();
  for (const edge of edges) {
    const from = rank.get(edge.from), to = rank.get(edge.to);
    if (edge.from === edge.to || to === from + 1) continue;
    const same = from === to, back = to < from;
    const sourceSide = back ? 'left' : 'right', targetSide = back || same ? 'right' : 'left';
    const vertical = back || same ? 1 : -1;
    const sourceSlot = gutters[from][sourceSide]++;
    const targetSlot = same ? sourceSlot : gutters[to][targetSide]++;
    routes.set(edge, {
      same, back, sourceSlot, targetSlot,
      source: port(edge.from, sourceSide, vertical),
      target: port(edge.to, targetSide, same ? -vertical : vertical),
    });
  }
  const columnX = [76];
  const reach = (r, side) => 54 + Math.max(0, gutters[r][side] - 1) * 18;
  const loopWidth = layers.map(layer => Math.max(0, ...edges.filter(e => e.from === e.to && layer.includes(e.from)).map(e => labelWidth(e.label))));
  for (let r = 1; r < count; r++) {
    const width = Math.max(0, ...edges.filter(e => rank.get(e.from) === r - 1 && rank.get(e.to) === r).map(e => labelWidth(e.label)));
    columnX[r] = columnX[r - 1] + Math.max(160, reach(r - 1, 'right') + reach(r, 'left') + 36, width + R * 2 + 32, (loopWidth[r - 1] + loopWidth[r]) / 2 + 28);
  }
  const pos = new Map();
  layers.forEach((layer, r) => layer.forEach((id, i) => pos.set(id, { x: columnX[r], y: 140 + (i - (layer.length - 1) / 2) * 160 })));
  const loopDirection = id => {
    const layer = layers[rank.get(id)];
    return layer.indexOf(id) > (layer.length - 1) / 2 ? 1 : -1;
  };
  const obstacles = [...pos.values()].map(p => ({ left: p.x - R - 8, right: p.x + R + 8, top: p.y - R - 8, bottom: p.y + R + 8 }));
  for (const edge of edges.filter(e => e.from === e.to)) {
    const p = pos.get(edge.from), direction = loopDirection(edge.from);
    obstacles.push({ left: p.x - Math.max(38, labelWidth(edge.label) / 2), right: p.x + Math.max(38, labelWidth(edge.label) / 2), top: p.y + (direction < 0 ? -105 : 0), bottom: p.y + (direction > 0 ? 105 : 0) });
  }
  const lanes = { top: [], bottom: [] };
  function lane(side, start, end, sourceY, targetY) {
    const left = Math.min(start, end), right = Math.max(start, end);
    const relevant = obstacles.filter(o => o.left <= right && o.right >= left);
    const top = side === 'top';
    let y = top ? Math.min(sourceY, targetY, ...relevant.map(o => o.top)) - 40
      : Math.max(sourceY, targetY, ...relevant.map(o => o.bottom)) + 40;
    while (lanes[side].some(l => left <= l.right && right >= l.left && Math.abs(y - l.y) < 44)) y += top ? -44 : 44;
    lanes[side].push({ left, right, y }); return y;
  }
  const endpoint = port => {
    const center = pos.get(port.id), sign = port.side === 'right' ? 1 : -1;
    const offset = port.vertical * (port.list.length === 1 ? 12 : 6 + 15 * port.index / (port.list.length - 1));
    return { x: center.x + sign * Math.sqrt(R * R - offset * offset), y: center.y + offset };
  };
  const candidates = new Map();
  for (const edge of edges) {
    const a = pos.get(edge.from), b = pos.get(edge.to);
    if (edge.from === edge.to) {
      const direction = loopDirection(edge.from);
      edge.d = `M ${a.x - 15} ${a.y + direction * 18} C ${a.x - 58} ${a.y + direction * 90}, ${a.x + 58} ${a.y + direction * 90}, ${a.x + 15} ${a.y + direction * 18}`;
      candidates.set(edge, [{ x: a.x, y: a.y + direction * 81 + (direction > 0 ? 14 : 0) }]);
    } else if (rank.get(edge.to) === rank.get(edge.from) + 1) {
      const sx = a.x + R, tx = b.x - R, mid = (sx + tx) / 2;
      edge.d = `M ${sx} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${tx} ${b.y}`;
      const choices = [];
      for (const t of [0.5, 0.35, 0.65, 0.22, 0.78]) {
        const u = 1 - t;
        const x = u ** 3 * sx + 3 * u * t * mid + t ** 3 * tx;
        const y = (u ** 3 + 3 * u * u * t) * a.y + (3 * u * t * t + t ** 3) * b.y;
        choices.push({ x, y: y - 12 }, { x, y: y + 24 });
      }
      candidates.set(edge, choices);
    } else {
      const route = routes.get(edge), source = endpoint(route.source), target = endpoint(route.target);
      const sx = a.x + (route.source.side === 'right' ? 1 : -1) * (54 + route.sourceSlot * 18);
      const tx = b.x + (route.target.side === 'right' ? 1 : -1) * (54 + route.targetSlot * 18);
      if (route.same) {
        edge.d = roundedRoute([source, { x: sx, y: source.y }, { x: sx, y: target.y }, target]);
        candidates.set(edge, [{ x: sx + labelWidth(edge.label) / 2 + 8, y: (source.y + target.y) / 2 + 5 }]);
      } else {
        const y = lane(route.back ? 'bottom' : 'top', sx, tx, source.y, target.y);
        edge.d = roundedRoute([source, { x: sx, y: source.y }, { x: sx, y }, { x: tx, y }, { x: tx, y: target.y }, target]);
        candidates.set(edge, [0.5, 0.35, 0.65, 0.22, 0.78].map(t => ({ x: sx + (tx - sx) * t, y: y + (route.back ? 24 : -12) })));
      }
    }
  }
  // Place labels after routes. Loop labels have the fewest options, so reserve
  // them first; other labels can move along their own edge, not over a state.
  const occupied = [...pos.values()].map(p => ({ left: p.x - R - 8, right: p.x + R + 8, top: p.y - R - 8, bottom: p.y + R + 8 }));
  const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const box = (p, width) => ({ left: p.x - width / 2, right: p.x + width / 2, top: p.y - 20, bottom: p.y + 6 });
  for (const edge of [...edges].sort((a, b) => candidates.get(a).length - candidates.get(b).length)) {
    const width = labelWidth(edge.label), choices = candidates.get(edge);
    let chosen = choices.find(p => !occupied.some(other => overlap(box(p, width), other)));
    // Dense/long-label cases have a deterministic free band outside the graph.
    // Keep a leader to the actual edge rather than silently covering a node.
    if (!chosen) {
      const anchor = choices[0];
      chosen = { ...anchor };
      while (occupied.some(other => overlap(box(chosen, width), other))) chosen.y -= 30;
      edge.labelLeader = `M ${anchor.x} ${anchor.y + 8} L ${chosen.x} ${chosen.y + 8}`;
    }
    edge.labelX = chosen.x; edge.labelY = chosen.y;
    occupied.push(box(chosen, width));
  }
  return { positions: pos, edges };
}

export class GraphView {
  constructor(svg, onSelect = () => {}) {
    this.svg = svg; this.onSelect = onSelect; this.animation = null; this.cancelAnimation = null;
    this.nodes = new Map(); this.paths = new Map(); this.view = null; this.bounds = null;
    let drag = null;
    svg.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !this.view || event.target.closest('.state')) return;
      drag = { x: event.clientX, y: event.clientY, view: [...this.view] };
      svg.setPointerCapture(event.pointerId); svg.classList.add('panning');
    });
    svg.addEventListener('pointermove', event => {
      if (!drag) return;
      const rect = svg.getBoundingClientRect();
      const scale = Math.max(this.view[2] / rect.width, this.view[3] / rect.height);
      this.setView([drag.view[0] - (event.clientX - drag.x) * scale, drag.view[1] - (event.clientY - drag.y) * scale, ...drag.view.slice(2)]);
    });
    const endDrag = () => { drag = null; svg.classList.remove('panning'); };
    svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('wheel', event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault(); this.zoom(event.deltaY < 0 ? 0.85 : 1.18);
    }, { passive: false });
    svg.addEventListener('keydown', event => {
      if (event.key === '+' || event.key === '=') { event.preventDefault(); this.zoom(0.8); }
      if (event.key === '-') { event.preventDefault(); this.zoom(1.25); }
      if (event.key === '0') { event.preventDefault(); this.fit(); }
    });
  }
  setView(view) { this.view = view; this.svg.setAttribute('viewBox', view.join(' ')); }
  fit() { if (this.bounds) this.setView([...this.bounds]); }
  zoom(factor) {
    if (!this.view || !this.bounds) return;
    const [x, y, w, h] = this.view;
    const ratio = w * factor / this.bounds[2];
    if (ratio < 0.12 || ratio > 4) return;
    this.setView([x + w * (1 - factor) / 2, y + h * (1 - factor) / 2, w * factor, h * factor]);
  }
  stopAnimation() {
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    this.animation = null;
    this.svg.querySelectorAll('.travel-dot').forEach(el => el.remove());
    if (this.cancelAnimation) this.cancelAnimation();
    this.cancelAnimation = null;
  }
  clear() {
    this.stopAnimation(); this.svg.replaceChildren(); this.nodes.clear(); this.paths.clear();
    this.bounds = null; this.view = null;
  }
  render(machine) {
    this.clear(); this.machine = machine;
    const { positions, edges } = layout(machine);
    this.svg.append(element('title', {}, t('graph.title', { kind: machine.kind.toUpperCase(), count: machine.states.length })));
    this.svg.append(element('style', {}, svgStyle));
    const defs = element('defs');
    for (const [id, fill] of [['arrow', '#555b60'], ['arrow-active', '#245a8c']]) {
      const marker = element('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' });
      marker.append(element('path', { d: 'M 0 1 L 9 5 L 0 9 z', fill })); defs.append(marker);
    }
    this.svg.append(defs);
    this.scene = element('g'); this.svg.append(this.scene);
    for (const edge of edges) {
      const group = element('g', { class: 'transition', 'data-from': edge.from, 'data-to': edge.to });
      const path = element('path', { d: edge.d, class: 'edge-line', 'marker-end': 'url(#arrow)' });
      group.append(element('title', {}, `${stateLabel(edge.from)} → ${stateLabel(edge.to)}: ${edge.label}`));
      const display = displayLabel(edge.label);
      if (edge.labelLeader) group.append(element('path', { d: edge.labelLeader, class: 'label-leader' }));
      group.append(path, element('text', { class: 'edge-label', x: edge.labelX, y: edge.labelY }, display));
      this.scene.append(group);
      edge.ids.forEach(id => this.paths.set(id, { path, group }));
    }
    const start = positions.get(machine.start);
    this.scene.append(element('path', { d: `M ${start.x - 64} ${start.y} L ${start.x - R - 2} ${start.y}`, class: 'start-line', 'marker-end': 'url(#arrow)' }));
    for (const state of machine.states) {
      const p = positions.get(state.id);
      const group = element('g', { class: 'state', transform: `translate(${p.x} ${p.y})`, tabindex: 0, role: 'button', 'aria-label': stateLabel(state.id), 'data-state': state.id });
      group.append(element('title', {}, group.getAttribute('aria-label')));
      group.append(element('circle', { r: R, class: 'outer' }));
      if (state.accepting) group.append(element('circle', { r: R - 5, class: 'inner' }));
      group.append(element('text', { class: 'state-label', y: -1 }, stateLabel(state.id)));
      const select = () => {
        this.nodes.forEach(node => node.classList.remove('is-selected'));
        group.classList.add('is-selected'); this.onSelect(state);
      };
      group.addEventListener('click', select);
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); select(); }
      });
      this.nodes.set(state.id, group); this.scene.append(group);
    }
    this.localize();
    const box = this.scene.getBBox();
    this.bounds = [box.x - 34, box.y - 36, Math.max(box.width + 68, 250), Math.max(box.height + 72, 210)];
    this.fit();
  }
  localize() {
    if (!this.machine || !this.nodes.size) return;
    this.svg.querySelector('title').textContent = t('graph.title', {
      kind: this.machine.kind.toUpperCase(), count: this.machine.states.length,
    });
    for (const state of this.machine.states) {
      const label = stateLabel(state.id)
        + (state.id === this.machine.start ? t('graph.start') : '')
        + (state.accepting ? t('graph.final') : '')
        + (state.dead ? t('graph.trap') : '');
      const node = this.nodes.get(state.id);
      node.setAttribute('aria-label', label); node.querySelector('title').textContent = label;
    }
  }
  show(frame, { animate = false, duration = 350, onSettled = () => {} } = {}) {
    this.stopAnimation();
    const active = new Set(frame.active);
    const applyStates = (ids, result = false) => {
      for (const [id, node] of this.nodes) {
        node.classList.toggle('is-active', ids.has(id));
        node.classList.toggle('is-accepted', result && frame.accepted && ids.has(id) && this.machine.states.find(s => s.id === id).accepting);
        node.classList.toggle('is-rejected', result && !frame.accepted && ids.has(id));
      }
    };
    const paths = [...new Set(frame.edges.map(id => this.paths.get(id)).filter(Boolean))];
    for (const { group } of this.paths.values()) group.classList.remove('is-used');
    paths.forEach(({ group }) => group.classList.add('is-used'));
    const settle = () => { applyStates(active, frame.kind === 'result'); onSettled(); };
    if (!animate || !paths.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { settle(); return; }
    applyStates(new Set(frame.previous));
    const moving = paths.map(({ path }) => {
      const dot = element('circle', { r: 3.8, class: 'travel-dot' });
      this.scene.append(dot);
      return { path, dot, length: path.getTotalLength() };
    });
    const started = performance.now();
    this.cancelAnimation = settle;
    const tick = now => {
      const progress = Math.min((now - started) / duration, 1);
      moving.forEach(({ path, dot, length }) => {
        const p = path.getPointAtLength(length * progress);
        dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
      });
      if (progress < 1) this.animation = requestAnimationFrame(tick);
      else {
        moving.forEach(({ dot }) => dot.remove()); this.animation = null; this.cancelAnimation = null; settle();
      }
    };
    tick(started);
  }
  download() {
    if (!this.bounds) return;
    const clone = this.svg.cloneNode(true);
    clone.querySelectorAll('.travel-dot').forEach(el => el.remove());
    clone.setAttribute('xmlns', NS); clone.setAttribute('viewBox', this.bounds.join(' '));
    clone.setAttribute('width', String(Math.ceil(this.bounds[2]))); clone.setAttribute('height', String(Math.ceil(this.bounds[3])));
    clone.removeAttribute('class'); clone.removeAttribute('style');
    const background = element('rect', { x: this.bounds[0], y: this.bounds[1], width: this.bounds[2], height: this.bounds[3], fill: '#f6f2e9' });
    clone.insertBefore(background, clone.querySelector('g'));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `regex-${this.machine.kind}.svg`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
