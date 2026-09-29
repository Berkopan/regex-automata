import { stateLabel, symbolsLabel } from './automata.js';

const NS = 'http://www.w3.org/2000/svg';
const R = 23;
const svgStyle = `
  .edge-line,.start-line{fill:none;stroke:#555b60;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}
  .edge-label{font:16px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#30363a;paint-order:stroke;stroke:#fff;stroke-width:6;stroke-linejoin:round;text-anchor:middle}
  .state .outer{fill:#fff;stroke:#30363a;stroke-width:1.65}
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

/** Deterministic layered layout. Back edges use separate return arcs, not
 * force simulation, so the diagram never moves while input is being read. */
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
  const spacing = machine.states.length <= 7 ? 155 : 102;
  const pos = new Map();
  layers.forEach((layer, r) => layer.forEach((id, i) => pos.set(id, { x: 76 + r * spacing, y: 140 + (i - (layer.length - 1) / 2) * 104 })));
  const ys = [...pos.values()].map(p => p.y), minY = Math.min(...ys), maxY = Math.max(...ys);
  const lanes = { top: [], bottom: [], side: [] };
  function lane(side, start, end) {
    const a = Math.min(start, end), b = Math.max(start, end);
    let n = 0;
    while ((lanes[side][n] ?? []).some(([lo, hi]) => a <= hi && b >= lo)) n++;
    if (!lanes[side][n]) lanes[side][n] = [];
    lanes[side][n].push([a, b]); return n;
  }
  for (const edge of edges) {
    const a = pos.get(edge.from), b = pos.get(edge.to);
    if (edge.from === edge.to) {
      edge.d = `M ${a.x - 15} ${a.y - 18} C ${a.x - 58} ${a.y - 90}, ${a.x + 58} ${a.y - 90}, ${a.x + 15} ${a.y - 18}`;
      edge.labelX = a.x; edge.labelY = a.y - 81;
    } else if (rank.get(edge.to) === rank.get(edge.from) + 1) {
      const sx = a.x + R, tx = b.x - R, mid = (sx + tx) / 2;
      edge.d = `M ${sx} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${tx} ${b.y}`;
      edge.labelX = mid; edge.labelY = (a.y + b.y) / 2 - 12;
    } else if (a.x === b.x) {
      const side = a.x + 86 + lane('side', a.y, b.y) * 40;
      edge.d = `M ${a.x + R} ${a.y} C ${side} ${a.y}, ${side} ${b.y}, ${b.x + R} ${b.y}`;
      edge.labelX = (a.x + R + 3 * side) / 4 + 12; edge.labelY = (a.y + b.y) / 2;
    } else {
      const isBack = b.x < a.x;
      const n = lane(isBack ? 'bottom' : 'top', a.x, b.x);
      const y = isBack ? maxY + 106 + n * 53 : minY - 125 - n * 53;
      const sy = a.y + (isBack ? R : -R), ty = b.y + (isBack ? R : -R);
      edge.d = `M ${a.x} ${sy} C ${a.x} ${y}, ${b.x} ${y}, ${b.x} ${ty}`;
      edge.labelX = (a.x + b.x) / 2; edge.labelY = (sy + ty + 6 * y) / 8 + (isBack ? 21 : -12);
    }
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
    this.svg.append(element('title', {}, `${machine.kind.toUpperCase()}: ${machine.states.length} durum. Çift çemberler kabul durumlarıdır.`));
    this.svg.append(element('style', {}, svgStyle));
    const defs = element('defs');
    for (const [id, fill] of [['arrow', '#555b60'], ['arrow-active', '#245a8c']]) {
      const marker = element('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' });
      marker.append(element('path', { d: 'M 0 1 L 9 5 L 0 9 z', fill })); defs.append(marker);
    }
    this.svg.append(defs);
    this.scene = element('g'); this.svg.append(this.scene);
    for (const edge of edges) {
      const group = element('g', { class: 'transition' });
      const path = element('path', { d: edge.d, class: 'edge-line', 'marker-end': 'url(#arrow)' });
      group.append(element('title', {}, `${stateLabel(edge.from)} → ${stateLabel(edge.to)}: ${edge.label}`));
      const display = edge.label.length > 28 ? `${edge.label.slice(0, 26)}…` : edge.label;
      group.append(path, element('text', { class: 'edge-label', x: edge.labelX, y: edge.labelY }, display));
      this.scene.append(group);
      edge.ids.forEach(id => this.paths.set(id, { path, group }));
    }
    const start = positions.get(machine.start);
    this.scene.append(element('path', { d: `M ${start.x - 64} ${start.y} L ${start.x - R - 2} ${start.y}`, class: 'start-line', 'marker-end': 'url(#arrow)' }));
    for (const state of machine.states) {
      const p = positions.get(state.id);
      const group = element('g', { class: 'state', transform: `translate(${p.x} ${p.y})`, tabindex: 0, role: 'button', 'aria-label': `${stateLabel(state.id)}${state.id === machine.start ? ', başlangıç' : ''}${state.accepting ? ', kabul durumu' : ''}${state.dead ? ', tuzak durum' : ''}`, 'data-state': state.id });
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
    const box = this.scene.getBBox();
    this.bounds = [box.x - 34, box.y - 36, Math.max(box.width + 68, 250), Math.max(box.height + 72, 210)];
    this.fit();
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
    const background = element('rect', { x: this.bounds[0], y: this.bounds[1], width: this.bounds[2], height: this.bounds[3], fill: 'white' });
    clone.insertBefore(background, clone.querySelector('g'));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `regex-${this.machine.kind}.svg`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
