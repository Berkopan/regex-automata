import { compile, simulate, RegexError, stateLabel, stateSetLabel, symbolLabel, symbolsLabel } from './automata.js';
import { GraphView } from './graph.js';
import { t, setLanguage, getLanguage, translatePage, translateError } from './i18n.js';

const $ = id => document.getElementById(id);
const form = $('setup-form'), pattern = $('pattern'), input = $('sample-text');
let session = null, step = 0, playing = false, timer = null, renderToken = 0;
let selectedState = null, lastError = null;
const graph = new GraphView($('automaton'), inspectState);
const kind = () => form.elements.kind.value;
const delay = () => 950 / Number($('speed').value);
const finals = machine => machine.states.filter(s => s.accepting).map(s => s.id);
const alphabet = machine => machine.alphabet.length ? `{${symbolsLabel(machine.alphabet)}}` : '∅';

function controls() {
  const ready = Boolean(session?.trace), last = ready && step === session.trace.frames.length - 1;
  $('play').disabled = !ready;
  $('play').textContent = playing ? t('play.pause') : last ? t('play.replay') : ready && step > 0 ? t('play.resume') : t('play.start');
  $('play').classList.toggle('is-playing', playing);
  $('play').setAttribute('aria-pressed', String(playing));
  $('previous').disabled = !ready || step === 0;
  $('next').disabled = !ready || last;
  $('reset').disabled = !ready || (step === 0 && !playing);
  $('seek').disabled = !ready;
  for (const id of ['zoom-in', 'zoom-out', 'fit', 'export-svg']) $(id).disabled = !session;
  $('minimize').disabled = kind() === 'nfa';
  $('minimize-label').classList.toggle('is-disabled', kind() === 'nfa');
}
function pause() {
  playing = false; clearTimeout(timer); timer = null;
  graph.stopAnimation(); controls();
}
function clearError() {
  lastError = null;
  $('form-error').hidden = true; $('form-error').textContent = '';
  pattern.removeAttribute('aria-invalid'); input.removeAttribute('aria-invalid');
}
function invalidate() {
  renderToken++; pause(); session = null; step = 0;
  selectedState = null; graph.clear(); clearError(); renderEmpty(); controls();
}
function renderEmpty() {
  $('automaton').setAttribute('hidden', ''); $('empty-diagram').hidden = false; $('tables').hidden = true;
  $('machine-meta').textContent = t('empty.meta');
  $('construction-note').textContent = t('empty.note');
  $('state-inspector').textContent = t('empty.inspect');
  $('tape').replaceChildren(make('span', t('empty.tape'), 'muted tape-placeholder'));
  $('step-report').className = 'step-report';
  $('step-title').textContent = t('empty.step');
  $('step-equation').textContent = '—';
  $('step-detail').textContent = t('empty.detail');
  $('current-states').textContent = '—'; $('input-progress').textContent = '—';
  $('step-counter').textContent = t('empty.counter'); $('seek').value = '0';
  $('seek').removeAttribute('aria-valuetext'); $('history-rows').replaceChildren();
  $('live-status').textContent = t('empty.changed');
  controls();
}
function make(tag, text = null, className = '') {
  const el = document.createElement(tag);
  if (text !== null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function row(values) {
  const tr = make('tr');
  for (const value of values) {
    const td = make('td');
    if (value instanceof Node) td.append(value); else td.textContent = value;
    tr.append(td);
  }
  return tr;
}
function stateName(machine, id) {
  const state = machine.states.find(s => s.id === id);
  return `${id === machine.start ? '→ ' : ''}${stateLabel(id)}${state.accepting ? ' *' : ''}`;
}
function inspectState(state) {
  if (!session || !state) return;
  selectedState = state.id;
  const tags = [];
  if (state.id === session.machine.start) tags.push(t('state.start'));
  tags.push(state.accepting ? t('state.final') : t('state.notFinal'));
  if (state.dead) tags.push(t('state.dead'));
  let text = `${stateLabel(state.id)} · ${tags.join(' · ')}`;
  if (state.subsets) {
    const sets = state.subsets.map(stateSetLabel).join(t('common.or'));
    text += t('state.nfa', { sets: sets.length > 200 ? sets.slice(0, 197) + t('state.more') : sets });
  }
  $('state-inspector').textContent = text;
}
function renderTables() {
  const { machine } = session;
  $('tables').hidden = false;
  $('formal-definition').textContent = t('machine.definition', { states: stateSetLabel(machine.states.map(s => s.id)), alphabet: alphabet(machine), start: stateLabel(machine.start), finals: stateSetLabel(finals(machine)) });
  $('transition-rows').replaceChildren(...[...machine.edges].sort((a, b) => a.from - b.from || a.to - b.to).map(edge =>
    row([stateName(machine, edge.from), symbolsLabel(edge.symbols), stateLabel(edge.to)])));
  if (!machine.edges.length) $('transition-rows').append(row(['—', t('machine.noEdges'), '—']));
  $('subset-details').hidden = machine.kind !== 'dfa';
  $('subset-explanation').textContent = machine.minimized
    ? t('subset.minimized')
    : t('subset.plain');
  $('subset-rows').replaceChildren(...machine.states.filter(s => s.subsets).map(s => row([stateName(machine, s.id), s.subsets.map(stateSetLabel).join(t('common.or'))])));
}
function renderTape() {
  const { trace } = session;
  $('tape').replaceChildren();
  if (!trace.input.length) {
    $('tape').append(make('span', 'ε', 'tape-empty'), make('span', t('tape.empty'), 'muted empty-input-label'));
    return;
  }
  const cells = trace.input.map((symbol, index) => {
    const cell = make('span', symbolLabel(symbol), 'tape-cell');
    cell.dataset.index = String(index); cell.title = t('tape.character', { index: index + 1, symbol: symbolLabel(symbol) });
    return cell;
  });
  $('tape').append(...cells); $('tape').scrollLeft = 0;
}
function describe(frame) {
  const { machine, trace } = session;
  if (frame.kind === 'start') return {
    title: t('step.start'), equation: `S₀ = ${stateSetLabel(frame.active)}`,
    detail: machine.kind === 'nfa' ? t('step.startNfa') : t('step.startDfa'),
  };
  if (frame.kind === 'epsilon') return {
    title: t('step.epsilon'), equation: t('step.epsilonEquation', { states: stateSetLabel(frame.active) }),
    detail: frame.added.length ? t('step.epsilonAdded', { states: stateSetLabel(frame.added) }) : t('step.epsilonCycle'),
  };
  if (frame.kind === 'read') {
    let detail, equation;
    if (frame.outside) {
      equation = `${symbolLabel(frame.symbol)} ∉ Σ → S = ∅`;
      detail = t('step.outside');
    } else if (!frame.previous.length) {
      equation = 'S = ∅ → S′ = ∅';
      detail = t('step.noPaths');
    } else {
      const from = machine.kind === 'dfa' ? stateLabel(frame.previous[0]) : stateSetLabel(frame.previous);
      const to = machine.kind === 'dfa' && frame.active.length ? stateLabel(frame.active[0]) : stateSetLabel(frame.active);
      equation = `${machine.kind === 'dfa' ? 'δ' : 'move'}(${from}, ${symbolLabel(frame.symbol)}) = ${to}`;
      if (!frame.active.length) detail = t('step.noTransition');
      else if (frame.active.some(id => machine.states.find(s => s.id === id).dead)) detail = t('step.trap');
      else detail = machine.kind === 'nfa' ? t('step.readNfa') : t('step.readDfa');
    }
    return { title: t('step.read', { symbol: symbolLabel(frame.symbol) }), equation, detail };
  }
  const intersection = frame.active.filter(id => finals(machine).includes(id));
  return {
    title: frame.accepted ? t('result.accepted') : t('result.rejected'),
    equation: `S ∩ F = ${stateSetLabel(intersection)}${frame.accepted ? ' ≠ ∅' : ''}`,
    detail: frame.accepted
      ? t('result.acceptDetail', { consumed: trace.input.length ? t('result.consumed', { count: trace.input.length }) : t('result.empty') })
      : t('result.rejectDetail', { reason: frame.active.length ? t('result.noFinal') : t('result.noActive') }),
  };
}
function renderHistory() {
  const rows = [];
  for (let i = Math.max(0, step - 11); i <= step; i++) {
    const frame = session.trace.frames[i];
    const button = make('button', String(i), 'history-jump');
    button.type = 'button'; button.dataset.step = String(i); button.setAttribute('aria-label', t('history.jump', { step: i }));
    const action = frame.kind === 'start' ? t('history.start') : frame.kind === 'epsilon' ? t('history.epsilon') : frame.kind === 'read' ? t('history.read', { symbol: symbolLabel(frame.symbol) }) : frame.accepted ? t('history.accept') : t('history.reject');
    rows.push(row([button, action, String(frame.consumed), stateSetLabel(frame.active)]));
  }
  $('history-rows').replaceChildren(...rows);
}
function showStep(animate = false) {
  if (!session?.trace) return;
  const token = ++renderToken;
  const { trace } = session, frame = trace.frames[step], info = describe(frame);
  $('seek').value = String(step);
  $('seek').setAttribute('aria-valuetext', t('step.seek', { step, title: info.title }));
  $('step-counter').textContent = t('step.counter', { step, last: trace.frames.length - 1 });
  $('input-progress').textContent = t('step.progress', { read: frame.consumed, total: trace.input.length });
  $('step-title').textContent = info.title;
  $('step-equation').textContent = info.equation;
  $('step-detail').textContent = info.detail;
  $('step-report').className = `step-report${frame.kind === 'result' ? frame.accepted ? ' accepted' : ' rejected' : ''}`;
  $('current-states').textContent = stateSetLabel(animate && frame.edges.length ? frame.previous : frame.active);
  const cells = $('tape').querySelectorAll('.tape-cell');
  cells.forEach((cell, i) => {
    cell.classList.toggle('is-done', i < frame.consumed);
    cell.classList.toggle('is-next', i === frame.consumed && frame.kind !== 'result');
    cell.classList.toggle('is-read', frame.kind === 'read' && i === frame.consumed - 1);
  });
  const target = cells[frame.kind === 'read' ? frame.consumed - 1 : frame.consumed];
  if (target) {
    const box = target.getBoundingClientRect(), band = $('tape').getBoundingClientRect();
    if (box.right > band.right || box.left < band.left) $('tape').scrollLeft += box.left - band.left - band.width / 2 + box.width / 2;
  }
  renderHistory(); controls();
  graph.show(frame, { animate, duration: Math.min(400, delay() * 0.68), onSettled: () => {
    if (token !== renderToken || !session) return;
    $('current-states').textContent = stateSetLabel(frame.active);
    $('live-status').textContent = t('step.live', { title: info.title, read: frame.consumed, states: stateSetLabel(frame.active) });
  } });
}
function renderMachineInfo() {
  const { machine } = session;
  $('machine-meta').textContent = t('machine.meta', {
    kind: machine.kind === 'nfa' ? 'ε-NFA' : machine.minimized ? t('machine.minimal') : 'DFA',
    count: machine.states.length, alphabet: alphabet(machine),
  });
  $('construction-note').textContent = machine.kind === 'nfa'
    ? t('machine.nfa', { states: machine.states.length, edges: machine.edges.length })
    : t('machine.dfa', { nfa: machine.nfaSize, dfa: machine.unminimizedSize ?? machine.states.length,
        minimized: machine.minimized ? t('machine.minimization', { count: machine.states.length }) : '' });
  if (selectedState !== null) inspectState(machine.states.find(s => s.id === selectedState));
  else $('state-inspector').textContent = t('machine.inspect');
}
function showError(error, stage, focus = false) {
  lastError = { error, stage };
  const message = error instanceof RegexError ? translateError(error.message) : t('error.unexpected');
  $('form-error').textContent = message + (Number.isInteger(error.position)
    ? t('error.position', { position: error.position + 1 }) : '');
  $('form-error').hidden = false;
  const field = stage === 'text' ? input : pattern;
  field.setAttribute('aria-invalid', 'true');
  if (focus) {
    field.focus();
    if (field === pattern && Number.isInteger(error.position)) {
      const start = [...pattern.value].slice(0, error.position).join('').length;
      field.setSelectionRange(start, start + ([...pattern.value][error.position]?.length ?? 0));
    }
  }
  if (!(error instanceof RegexError)) console.error(error);
}
function showInvalidInput() {
  $('tape').replaceChildren(make('span', t('input.correct'), 'muted tape-placeholder'));
  $('history-rows').replaceChildren();
  $('seek').value = '0'; $('seek').max = '1'; $('seek').removeAttribute('aria-valuetext');
  $('step-counter').textContent = t('empty.counter');
  $('input-progress').textContent = '—';
  $('step-report').className = 'step-report';
  $('step-title').textContent = t('input.invalid');
  $('step-equation').textContent = '—';
  $('step-detail').textContent = t('input.retained');
  $('current-states').textContent = stateSetLabel([session.machine.start]);
  graph.show({ kind: 'start', active: [session.machine.start], previous: [], edges: [] });
  $('live-status').textContent = t('input.retained');
  controls();
}
// Keep the compiled machine, its SVG nodes, selected state, and viewport.
// Only the trace depends on the test text. Cancelling old callbacks prevents
// an in-flight transition from restoring state from the previous input.
function refreshInput() {
  if (!session) return;
  renderToken++; pause(); clearError(); step = 0;
  session.trace = null;
  try {
    session.trace = simulate(session.machine, input.value);
    renderTape(); $('seek').max = String(session.trace.frames.length - 1);
    showStep();
    $('live-status').textContent = t('input.changed');
  } catch (error) {
    showInvalidInput(); showError(error, 'text');
  }
  controls();
}
function prepare(event) {
  event?.preventDefault();
  renderToken++; pause(); clearError();
  try {
    const machine = compile(pattern.value, { kind: kind(), minimize: $('minimize').checked });
    session = { machine, trace: null }; step = 0; selectedState = null;
    $('automaton').removeAttribute('hidden'); $('empty-diagram').hidden = true;
    graph.render(machine); renderTables(); renderMachineInfo();
    refreshInput();
  } catch (error) {
    invalidate(); showError(error, 'pattern', true);
  }
  controls();
}
function changeLanguage(language, remember = true) {
  const wasPlaying = playing;
  renderToken++; pause(); setLanguage(language); translatePage();
  if (remember) {
    try { localStorage.setItem('regex-automata.language', getLanguage()); } catch { /* Storage may be blocked. */ }
  }
  document.querySelectorAll('[data-language]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.language === getLanguage())));
  if (session) {
    graph.localize(); renderTables(); renderMachineInfo();
    if (session.trace) {
      const scroll = $('tape').scrollLeft;
      renderTape(); showStep(); $('tape').scrollLeft = scroll;
    } else showInvalidInput();
  } else renderEmpty();
  if (lastError) showError(lastError.error, lastError.stage);
  playing = wasPlaying && Boolean(session?.trace);
  controls(); if (playing) schedule();
}
function schedule() {
  clearTimeout(timer);
  if (!playing || !session?.trace) return;
  timer = setTimeout(() => {
    if (!playing || !session?.trace) return;
    if (step < session.trace.frames.length - 1) { step++; showStep(true); }
    if (step === session.trace.frames.length - 1) { playing = false; timer = null; controls(); }
    else schedule();
  }, delay());
}
function togglePlay() {
  if (!session?.trace) return;
  if (playing) { pause(); return; }
  if (step === session.trace.frames.length - 1) { step = 0; showStep(); }
  playing = true; controls(); schedule();
}
function jump(index, animate = false) {
  if (!session?.trace) return;
  pause(); step = Math.max(0, Math.min(index, session.trace.frames.length - 1)); showStep(animate);
}

form.addEventListener('submit', prepare);
pattern.addEventListener('input', invalidate);
input.addEventListener('input', refreshInput);
document.querySelectorAll('[data-language]').forEach(button =>
  button.addEventListener('click', () => changeLanguage(button.dataset.language)));
for (const field of [$('kind-dfa'), $('kind-nfa'), $('minimize')]) field.addEventListener('change', invalidate);
$('play').addEventListener('click', togglePlay);
$('previous').addEventListener('click', () => jump(step - 1));
$('next').addEventListener('click', () => jump(step + 1, true));
$('reset').addEventListener('click', () => jump(0));
$('speed').addEventListener('change', () => { if (playing) schedule(); });
$('seek').addEventListener('input', event => jump(Number(event.target.value)));
$('history-rows').addEventListener('click', event => {
  const button = event.target.closest('[data-step]');
  if (button) jump(Number(button.dataset.step));
});
$('zoom-in').addEventListener('click', () => graph.zoom(0.8));
$('zoom-out').addEventListener('click', () => graph.zoom(1.25));
$('fit').addEventListener('click', () => graph.fit());
$('export-svg').addEventListener('click', () => graph.download());
const examples = {
  suffix: { pattern: '(a|b)*abb', text: 'aabb', kind: 'dfa' },
  branch: { pattern: 'ab|ac', text: 'ac', kind: 'nfa' },
  empty: { pattern: '(a|ε)*', text: '', kind: 'nfa' },
  class: { pattern: '[a-c]\\d{2}', text: 'b42', kind: 'dfa' },
  reject: { pattern: 'ab', text: 'aab', kind: 'dfa' },
};
$('examples').addEventListener('change', event => {
  const example = examples[event.target.value];
  if (!example) return;
  pattern.value = example.pattern; input.value = example.text;
  $(`kind-${example.kind}`).checked = true;
  invalidate();
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); prepare(); return; }
  if (event.target.closest('input,textarea,select,button,summary,a,[role="button"]') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (!session) return;
  if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) togglePlay(); }
  if (event.key === 'ArrowRight') { event.preventDefault(); jump(step + 1, true); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); jump(step - 1); }
  if (event.key === 'Home') { event.preventDefault(); jump(0); }
});
let savedLanguage = 'tr';
try { savedLanguage = localStorage.getItem('regex-automata.language') || 'tr'; } catch { /* Optional persistence. */ }
changeLanguage(savedLanguage, false);
