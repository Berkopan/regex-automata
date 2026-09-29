import { compile, simulate, RegexError, stateLabel, stateSetLabel, symbolLabel, symbolsLabel } from './automata.js';
import { GraphView } from './graph.js';

const $ = id => document.getElementById(id);
const form = $('setup-form'), pattern = $('pattern'), input = $('sample-text');
let session = null, step = 0, playing = false, timer = null, renderToken = 0;
const graph = new GraphView($('automaton'), inspectState);
const kind = () => form.elements.kind.value;
const delay = () => 950 / Number($('speed').value);
const finals = machine => machine.states.filter(s => s.accepting).map(s => s.id);
const alphabet = machine => machine.alphabet.length ? `{${symbolsLabel(machine.alphabet)}}` : '∅';

function controls() {
  const ready = session !== null, last = ready && step === session.trace.frames.length - 1;
  $('play').disabled = !ready;
  $('play').textContent = playing ? 'Duraklat' : last ? 'Yeniden oynat' : ready && step > 0 ? 'Devam et' : 'Simülasyonu başlat';
  $('play').classList.toggle('is-playing', playing);
  $('play').setAttribute('aria-pressed', String(playing));
  $('previous').disabled = !ready || step === 0;
  $('next').disabled = !ready || last;
  $('reset').disabled = !ready || (step === 0 && !playing);
  $('seek').disabled = !ready;
  for (const id of ['zoom-in', 'zoom-out', 'fit', 'export-svg']) $(id).disabled = !ready;
  $('minimize').disabled = kind() === 'nfa';
  $('minimize-label').classList.toggle('is-disabled', kind() === 'nfa');
}
function pause() {
  playing = false; clearTimeout(timer); timer = null;
  graph.stopAnimation(); controls();
}
function clearError() {
  $('form-error').hidden = true; $('form-error').textContent = '';
  pattern.removeAttribute('aria-invalid'); input.removeAttribute('aria-invalid');
}
function invalidate() {
  renderToken++; pause(); session = null; step = 0;
  graph.clear(); clearError();
  $('automaton').setAttribute('hidden', ''); $('empty-diagram').hidden = false; $('tables').hidden = true;
  $('machine-meta').textContent = 'Henüz bir makine oluşturulmadı.';
  $('construction-note').textContent = 'Başlangıç oku ilk durumu, çift çember kabul durumunu gösterir.';
  $('state-inspector').textContent = 'Bir durumun ayrıntısını görmek için dairesine tıklayın.';
  $('tape').replaceChildren(make('span', 'Makine hazırlandığında metin burada görünecek.', 'muted tape-placeholder'));
  $('step-report').className = 'step-report';
  $('step-title').textContent = 'Simülasyon henüz hazır değil.';
  $('step-equation').textContent = '—';
  $('step-detail').textContent = 'Her adımda okunan karakteri, izlenen geçişleri ve etkin durumları burada göreceksiniz.';
  $('current-states').textContent = '—'; $('input-progress').textContent = '—';
  $('step-counter').textContent = 'Adım —'; $('seek').value = '0';
  $('live-status').textContent = 'Girdiler değişti. Simülasyonu yeniden hazırlayın.';
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
  if (!session) return;
  const tags = [];
  if (state.id === session.machine.start) tags.push('başlangıç durumu');
  tags.push(state.accepting ? 'kabul durumu' : 'kabul durumu değil');
  if (state.dead) tags.push('tuzak durum: buradan kabul durumuna ulaşılamaz');
  let text = `${stateLabel(state.id)} · ${tags.join(' · ')}`;
  if (state.subsets) {
    const sets = state.subsets.map(stateSetLabel).join(' veya ');
    text += ` · NFA karşılığı: ${sets.length > 200 ? sets.slice(0, 197) + '… (tamamı aşağıdaki tabloda)' : sets}`;
  }
  $('state-inspector').textContent = text;
}
function renderTables() {
  const { machine } = session;
  $('tables').hidden = false;
  $('formal-definition').textContent = `Q = ${stateSetLabel(machine.states.map(s => s.id))}; Σ = ${alphabet(machine)}; başlangıç = ${stateLabel(machine.start)}; F = ${stateSetLabel(finals(machine))}.`;
  $('transition-rows').replaceChildren(...[...machine.edges].sort((a, b) => a.from - b.from || a.to - b.to).map(edge =>
    row([stateName(machine, edge.from), symbolsLabel(edge.symbols), stateLabel(edge.to)])));
  if (!machine.edges.length) $('transition-rows').append(row(['—', 'Bu makinede geçiş yok.', '—']));
  $('subset-details').hidden = machine.kind !== 'dfa';
  $('subset-explanation').textContent = machine.minimized
    ? 'Minimizasyonda eşdeğer DFA durumları birleştirildi. Aynı satırdaki ayrı kümeler, birleştirilen durumların NFA altkümeleridir; tek bir ε-kapanışı olarak yorumlanmamalıdır.'
    : 'Her DFA durumu, aynı girdi önekinden sonra NFA’da etkin olabilen durumların ε-kapalı bir kümesidir. ∅, hiçbir etkin NFA yolu kalmadığını gösteren tuzak durumdur.';
  $('subset-rows').replaceChildren(...machine.states.filter(s => s.subsets).map(s => row([stateName(machine, s.id), s.subsets.map(stateSetLabel).join(' veya ')])));
}
function renderTape() {
  const { trace } = session;
  $('tape').replaceChildren();
  if (!trace.input.length) {
    $('tape').append(make('span', 'ε', 'tape-empty'), make('span', 'boş metin — okunacak karakter yok', 'muted empty-input-label'));
    return;
  }
  const cells = trace.input.map((symbol, index) => {
    const cell = make('span', symbolLabel(symbol), 'tape-cell');
    cell.dataset.index = String(index); cell.title = `${index + 1}. karakter: ${symbolLabel(symbol)}`;
    return cell;
  });
  $('tape').append(...cells); $('tape').scrollLeft = 0;
}
function describe(frame) {
  const { machine, trace } = session;
  if (frame.kind === 'start') return {
    title: 'Başlangıç durumu', equation: `S₀ = ${stateSetLabel(frame.active)}`,
    detail: machine.kind === 'nfa' ? 'Henüz karakter okunmadı. Sonraki adımlarda önce başlangıç durumunun ε-kapanışı bulunacak.' : 'Henüz karakter okunmadı. Başlangıç oku, makinenin başladığı durumu gösterir.',
  };
  if (frame.kind === 'epsilon') return {
    title: 'ε geçişi · karakter tüketilmez', equation: `S ← S ∪ ε-hedefleri = ${stateSetLabel(frame.active)}`,
    detail: frame.added.length ? `${stateSetLabel(frame.added)} eklendi. Önceki etkin durumlar da korunur. Yeni ε-hedefi kalmayana kadar kapanış genişletilir.` : 'Bu ε yolları zaten etkin olan durumlara ulaşıyor. Yeni durum eklenmez; ε döngüsü tekrar tekrar izlenmez.',
  };
  if (frame.kind === 'read') {
    let detail, equation;
    if (frame.outside) {
      equation = `${symbolLabel(frame.symbol)} ∉ Σ → S = ∅`;
      detail = 'Bu karakter makinenin alfabesinde yok. Hiçbir geçiş izlenemez; girdi reddedilecek. Makineye yeni bir ok eklenmez.';
    } else if (!frame.previous.length) {
      equation = 'S = ∅ → S′ = ∅';
      detail = 'Etkin bir yol kalmadı. Kalan karakterler bu girdiyi yeniden kabul edilebilir hâle getiremez.';
    } else {
      const from = machine.kind === 'dfa' ? stateLabel(frame.previous[0]) : stateSetLabel(frame.previous);
      const to = machine.kind === 'dfa' && frame.active.length ? stateLabel(frame.active[0]) : stateSetLabel(frame.active);
      equation = `${machine.kind === 'dfa' ? 'δ' : 'move'}(${from}, ${symbolLabel(frame.symbol)}) = ${to}`;
      if (!frame.active.length) detail = 'Bu karakter için etkin durumlardan çıkılan bir geçiş yok. Hiçbir yol devam edemiyor.';
      else if (frame.active.some(id => machine.states.find(s => s.id === id).dead)) detail = 'Tuzak duruma ulaşıldı. Kalan karakterler işlense de buradan bir kabul durumuna geçilemez.';
      else detail = machine.kind === 'nfa' ? 'Bu sembolle etiketli bütün uygun oklar aynı anda izlenir. Ardından hedef durumların ε-kapanışı alınır.' : 'Ok üzerindeki sembol okunur ve hedef duruma geçilir. Kabul kararı, metnin tamamı bittikten sonra verilir.';
    }
    return { title: `“${symbolLabel(frame.symbol)}” karakterini oku`, equation, detail };
  }
  const intersection = frame.active.filter(id => finals(machine).includes(id));
  return {
    title: frame.accepted ? 'Kabul edildi' : 'Reddedildi',
    equation: `S ∩ F = ${stateSetLabel(intersection)}${frame.accepted ? ' ≠ ∅' : ''}`,
    detail: frame.accepted
      ? `${trace.input.length ? `${trace.input.length} karakterin tamamı okundu.` : 'Girdi boş; karakter okunmadı.'} Son etkin durumlardan en az biri kabul durumu. Dolayısıyla w ∈ L(r).`
      : `Metnin tamamı işlendi. ${frame.active.length ? 'Son etkin durumların hiçbiri kabul durumu değil.' : 'Etkin durum kalmadı.'} Dolayısıyla w ∉ L(r).`,
  };
}
function renderHistory() {
  const rows = [];
  for (let i = Math.max(0, step - 11); i <= step; i++) {
    const frame = session.trace.frames[i];
    const button = make('button', String(i), 'history-jump');
    button.type = 'button'; button.dataset.step = String(i); button.setAttribute('aria-label', `${i}. adıma dön`);
    const action = frame.kind === 'start' ? 'Başlangıç' : frame.kind === 'epsilon' ? 'ε geçişi' : frame.kind === 'read' ? `Oku: ${symbolLabel(frame.symbol)}` : frame.accepted ? 'Kabul' : 'Ret';
    rows.push(row([button, action, String(frame.consumed), stateSetLabel(frame.active)]));
  }
  $('history-rows').replaceChildren(...rows);
}
function showStep(animate = false) {
  if (!session) return;
  const token = ++renderToken;
  const { trace } = session, frame = trace.frames[step], info = describe(frame);
  $('seek').value = String(step);
  $('seek').setAttribute('aria-valuetext', `${step}. adım: ${info.title}`);
  $('step-counter').textContent = `Adım ${step} / ${trace.frames.length - 1}`;
  $('input-progress').textContent = `${frame.consumed} / ${trace.input.length} karakter`;
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
    $('live-status').textContent = `${info.title}. ${frame.consumed} karakter okundu. Etkin durumlar: ${stateSetLabel(frame.active)}.`;
  } });
}
function prepare(event) {
  event?.preventDefault();
  renderToken++; pause(); clearError();
  let stage = 'pattern';
  try {
    const machine = compile(pattern.value, { kind: kind(), minimize: $('minimize').checked });
    stage = 'text';
    const trace = simulate(machine, input.value);
    session = { machine, trace }; step = 0;
    $('automaton').removeAttribute('hidden'); $('empty-diagram').hidden = true;
    graph.render(machine); renderTape(); renderTables();
    $('machine-meta').textContent = `${machine.kind === 'nfa' ? 'ε-NFA' : machine.minimized ? 'Minimal DFA' : 'DFA'} · ${machine.states.length} durum · Σ = ${alphabet(machine)}`;
    $('construction-note').textContent = machine.kind === 'nfa'
      ? `Thompson yapımı: ${machine.states.length} durum, ${machine.edges.length} geçiş. NFA’da birden fazla durum aynı anda etkin olabilir.`
      : `Thompson ε-NFA (${machine.nfaSize} durum) → altküme DFA (${machine.unminimizedSize ?? machine.states.length} durum)${machine.minimized ? ` → minimizasyon (${machine.states.length} durum)` : ''}.`;
    $('state-inspector').textContent = 'Bir duruma tıklayın: başlangıç, kabul, tuzak ve varsa NFA karşılıklarını inceleyin.';
    $('seek').max = String(trace.frames.length - 1);
    showStep();
  } catch (error) {
    invalidate();
    const message = error instanceof RegexError ? error.message : 'Makine oluşturulurken beklenmeyen bir hata oluştu. Daha küçük bir ifade deneyin.';
    $('form-error').textContent = `${message}${error.position !== null && error.position !== undefined ? ` (${error.position + 1}. karakter)` : ''}`;
    $('form-error').hidden = false;
    const field = stage === 'text' ? input : pattern;
    field.setAttribute('aria-invalid', 'true'); field.focus();
    if (field === pattern && Number.isInteger(error.position)) {
      const start = [...pattern.value].slice(0, error.position).join('').length;
      const end = start + ([...pattern.value][error.position]?.length ?? 0);
      pattern.setSelectionRange(start, end);
    }
    if (!(error instanceof RegexError)) console.error(error);
  }
  controls();
}
function schedule() {
  clearTimeout(timer);
  if (!playing || !session) return;
  timer = setTimeout(() => {
    if (!playing || !session) return;
    if (step < session.trace.frames.length - 1) { step++; showStep(true); }
    if (step === session.trace.frames.length - 1) { playing = false; timer = null; controls(); }
    else schedule();
  }, delay());
}
function togglePlay() {
  if (!session) return;
  if (playing) { pause(); return; }
  if (step === session.trace.frames.length - 1) { step = 0; showStep(); }
  playing = true; controls(); schedule();
}
function jump(index, animate = false) {
  if (!session) return;
  pause(); step = Math.max(0, Math.min(index, session.trace.frames.length - 1)); showStep(animate);
}

form.addEventListener('submit', prepare);
for (const field of [pattern, input]) field.addEventListener('input', invalidate);
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
controls();
