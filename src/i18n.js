/** Bilingual UI catalog. Array entries are [Turkish, English].
 * Rich strings are trusted, static markup only. Never interpolate user data
 * into translatePage's innerHTML path; dynamic messages use textContent.
 */
export const messages = {
  "page.title": [
    "Regex → Otomat",
    "Regex → Automata"
  ],
  "page.description": [
    "Düzenli ifadelerden NFA ve DFA oluşturun; durum geçişlerini karakter karakter izleyin. Sade, etkileşimli bir otomat laboratuvarı.",
    "Build NFAs and DFAs from regular expressions and follow state transitions one character at a time. An interactive automata lab."
  ],
  "nav.skip": [
    "Simülasyona geç",
    "Skip to simulation"
  ],
  "page.heading": [
    "Regex <span aria-hidden=\"true\">→</span> Otomat",
    "Regex <span aria-hidden=\"true\">→</span> Automata"
  ],
  "page.subtitle": [
    "Düzenli ifadeler, sonlu otomatalar ve adım adım sözcük işleme.",
    "Regular expressions, finite automata, and step-by-step word processing."
  ],
  "page.note": [
    "Etkileşimli ders notu",
    "Interactive study notes"
  ],
  "language.label": [
    "Arayüz dili",
    "Interface language"
  ],
  "setup.aria": [
    "Makine ve simülasyon ayarları",
    "Machine and simulation settings"
  ],
  "setup.title": [
    "Makineyi tanımla",
    "Define the machine"
  ],
  "setup.pattern": [
    "Düzenli ifade <span class=\"math\">r</span>",
    "Regular expression <span class=\"math\">r</span>"
  ],
  "setup.example": [
    "Örneğin <code>(a|b)*abb</code> veya <code>a(b|c)+</code>.",
    "For example, <code>(a|b)*abb</code> or <code>a(b|c)+</code>."
  ],
  "setup.input": [
    "İşlenecek metin <span class=\"math\">w</span>",
    "Input text <span class=\"math\">w</span>"
  ],
  "setup.inputHelp": [
    "Metnin tamamı eşleştirilir. Boşluklar da birer karakterdir. Boş bırakmak, ε girdisidir. Metni değiştirmek makineyi korur; yalnızca simülasyonu başa alır.",
    "The entire text is matched. Spaces count as characters; leave empty for ε. Editing the text keeps the machine and resets only the simulation."
  ],
  "setup.kind": [
    "Makine türü",
    "Machine type"
  ],
  "setup.minimize": [
    "Eşdeğer DFA durumlarını birleştir",
    "Merge equivalent DFA states"
  ],
  "setup.prepare": [
    "Simülasyonu hazırla",
    "Prepare simulation"
  ],
  "playback.title": [
    "Simülasyon",
    "Simulation"
  ],
  "playback.previous": [
    "← Geri",
    "← Back"
  ],
  "playback.next": [
    "İleri →",
    "Next →"
  ],
  "playback.reset": [
    "Başa dön",
    "Reset"
  ],
  "playback.previousTitle": [
    "Önceki adım (←)",
    "Previous step (←)"
  ],
  "playback.nextTitle": [
    "Sonraki adım (→)",
    "Next step (→)"
  ],
  "playback.resetTitle": [
    "Başa dön (Home)",
    "Reset to start (Home)"
  ],
  "playback.speed": [
    "Oynatma hızı",
    "Playback speed"
  ],
  "playback.half": [
    "0,5×",
    "0.5×"
  ],
  "playback.keys": [
    "<kbd>Space</kbd> oynat / duraklat &nbsp; <kbd>←</kbd> <kbd>→</kbd> adım",
    "<kbd>Space</kbd> play / pause &nbsp; <kbd>←</kbd> <kbd>→</kbd> step"
  ],
  "reference.aria": [
    "Örnekler ve sözdizimi",
    "Examples and syntax"
  ],
  "examples.title": [
    "Bir örnek dene",
    "Try an example"
  ],
  "examples.choose": [
    "Örnek seçin…",
    "Choose an example…"
  ],
  "examples.suffix": [
    "Sonu abb ile biten sözcükler",
    "Words ending in abb"
  ],
  "examples.branch": [
    "NFA’da birden fazla etkin yol",
    "Multiple active NFA paths"
  ],
  "examples.empty": [
    "Boş metin ve ε geçişleri",
    "Empty input and ε transitions"
  ],
  "examples.class": [
    "Karakter sınıfları ve tekrar",
    "Character classes and repetition"
  ],
  "examples.reject": [
    "DFA’da tuzak durum",
    "A DFA trap state"
  ],
  "syntax.title": [
    "Desteklenen sözdizimi",
    "Supported syntax"
  ],
  "syntax.item1": [
    "Ardışık okuma",
    "Concatenation"
  ],
  "syntax.item2": [
    "Birleşim: a veya b",
    "Union: a or b"
  ],
  "syntax.item3": [
    "Gruplama",
    "Grouping"
  ],
  "syntax.item4": [
    "0+, 1+ veya 0–1 tekrar",
    "0+, 1+, or 0–1 repetitions"
  ],
  "syntax.item5": [
    "2–4 tekrar; {2} ve {2,} de geçerli",
    "2–4 repetitions; also {2} and {2,}"
  ],
  "syntax.item6": [
    "Karakter kümesi / aralığı",
    "Character set / range"
  ],
  "syntax.item7": [
    "ASCII rakam, sözcük, boşluk sınıfları",
    "ASCII digit, word, whitespace classes"
  ],
  "syntax.item8": [
    "Gerçek *, satır sonu, sekme",
    "Literal *, newline, tab"
  ],
  "syntax.item9": [
    "Boş sözcük; boş ifade de aynı anlama gelir",
    "Empty word; an empty expression means the same"
  ],
  "syntax.item10": [
    "Boş dil: hiçbir sözcüğü kabul etmez",
    "Empty language: accepts no words"
  ],
  "syntax.limits": [
    "Bu bir JavaScript regex editörü değildir. Joker <code>.</code>, negatif sınıflar, çapalar, bayraklar, lookaround ve geri başvurular desteklenmez. Gerçek ε / ∅ karakteri için <code>\\ε</code> / <code>\\∅</code> yazın.",
    "This is not a JavaScript regex editor. Wildcard <code>.</code>, negated classes, anchors, flags, lookaround, and backreferences are unsupported. Use <code>\\ε</code> / <code>\\∅</code> for literal ε / ∅."
  ],
  "syntax.precedence": [
    "Öncelik: tekrar → ardışıklık → birleşim. Semboller Unicode kod noktalarıdır. <code>\\s</code> yalnızca boşluk, \\t, \\n, \\r, \\f ve \\v içerir.",
    "Precedence: repetition → concatenation → union. Symbols are Unicode code points. <code>\\s</code> includes only space, \\t, \\n, \\r, \\f, and \\v."
  ],
  "lab.aria": [
    "Otomat ve işleme adımları",
    "Automaton and processing steps"
  ],
  "diagram.title": [
    "Durum diyagramı",
    "State diagram"
  ],
  "diagram.tools": [
    "Diyagram görünümü",
    "Diagram view"
  ],
  "diagram.outTitle": [
    "Uzaklaştır (−)",
    "Zoom out (−)"
  ],
  "diagram.out": [
    "Uzaklaştır",
    "Zoom out"
  ],
  "diagram.inTitle": [
    "Yakınlaştır (+)",
    "Zoom in (+)"
  ],
  "diagram.in": [
    "Yakınlaştır",
    "Zoom in"
  ],
  "diagram.fitTitle": [
    "Diyagramı alana sığdır (0)",
    "Fit diagram to view (0)"
  ],
  "diagram.fit": [
    "Sığdır",
    "Fit"
  ],
  "diagram.export": [
    "Diyagramı SVG olarak kaydet",
    "Save diagram as SVG"
  ],
  "empty.heading": [
    "Önce makineyi oluşturun.",
    "Build the machine first."
  ],
  "empty.instructions": [
    "Soldaki ifadeyi ve metni düzenleyin,<br>ardından “Simülasyonu hazırla”ya basın.",
    "Edit the expression and input on the left,<br>then press “Prepare simulation”."
  ],
  "diagram.aria": [
    "Sonlu otomat durum diyagramı. Durumların ayrıntılarını tıklayarak veya Enter ile açabilirsiniz.",
    "Finite automaton state diagram. Click a state or press Enter to inspect it."
  ],
  "legend.state": [
    "Durum",
    "State"
  ],
  "legend.final": [
    "Kabul durumu",
    "Accepting state"
  ],
  "legend.active": [
    "Etkin durum",
    "Active state"
  ],
  "diagram.pan": [
    "Sürükle: taşı · +/−: yakınlaştır",
    "Drag to pan · +/− to zoom"
  ],
  "tape.title": [
    "Girdi bandı",
    "Input tape"
  ],
  "tape.aria": [
    "Girdi bandı",
    "Input tape"
  ],
  "playback.seek": [
    "Simülasyon adımı",
    "Simulation step"
  ],
  "execution.active": [
    "Etkin durumlar",
    "Active states"
  ],
  "tables.aria": [
    "Makinenin ayrıntıları",
    "Machine details"
  ],
  "tables.transitions": [
    "Geçiş tablosu ve makine tanımı",
    "Transition table and machine definition"
  ],
  "tables.note": [
    "→ başlangıç, * kabul. ε geçişi karakter tüketmez. DFA, gösterilen Σ alfabesi üzerinde tamdır; alfabe dışındaki bir karakter reddedilir.",
    "→ start, * accepting. ε transitions consume no characters. The DFA is complete over the displayed alphabet Σ; characters outside it are rejected."
  ],
  "tables.subsets": [
    "DFA durumlarının NFA karşılıkları",
    "NFA subsets behind DFA states"
  ],
  "tables.history": [
    "Adım geçmişi",
    "Step history"
  ],
  "tables.historyNote": [
    "Bulunduğunuz adıma kadar son 12 kayıt. Bir adım numarasına tıklayarak o ana dönün; diğer adımlar için kaydırıcıyı kullanın.",
    "The last 12 entries up to the current step. Click a step number to return to it; use the slider for other steps."
  ],
  "tables.col11": [
    "Durum",
    "State"
  ],
  "tables.col12": [
    "Sembol",
    "Symbol"
  ],
  "tables.col13": [
    "Hedef",
    "Target"
  ],
  "tables.col21": [
    "DFA durumu",
    "DFA state"
  ],
  "tables.col22": [
    "NFA durum kümesi / kümeleri",
    "NFA state set(s)"
  ],
  "tables.col31": [
    "Adım",
    "Step"
  ],
  "tables.col32": [
    "İşlem",
    "Action"
  ],
  "tables.col33": [
    "Okunan",
    "Consumed"
  ],
  "tables.col34": [
    "Etkin durumlar",
    "Active states"
  ],
  "footer.text": [
    "Regex → Thompson ε-NFA → altküme DFA → isteğe bağlı minimizasyon.<span>Tümü tarayıcınızda çalışır.</span>",
    "Regex → Thompson ε-NFA → subset DFA → optional minimization.<span>Everything runs in your browser.</span>"
  ],
  "play.pause": [
    "Duraklat",
    "Pause"
  ],
  "play.replay": [
    "Yeniden oynat",
    "Replay"
  ],
  "play.resume": [
    "Devam et",
    "Resume"
  ],
  "play.start": [
    "Simülasyonu başlat",
    "Start simulation"
  ],
  "empty.meta": [
    "Henüz bir makine oluşturulmadı.",
    "No machine has been built yet."
  ],
  "empty.note": [
    "Başlangıç oku ilk durumu, çift çember kabul durumunu gösterir.",
    "The incoming arrow marks the start state; a double circle marks an accepting state."
  ],
  "empty.inspect": [
    "Bir durumun ayrıntısını görmek için dairesine tıklayın.",
    "Click a state circle to inspect it."
  ],
  "empty.tape": [
    "Makine hazırlandığında metin burada görünecek.",
    "The input will appear here once the machine is ready."
  ],
  "empty.step": [
    "Simülasyon henüz hazır değil.",
    "The simulation is not ready yet."
  ],
  "empty.detail": [
    "Her adımda okunan karakteri, izlenen geçişleri ve etkin durumları burada göreceksiniz.",
    "Each step shows the character read, the transitions followed, and the active states."
  ],
  "empty.counter": [
    "Adım —",
    "Step —"
  ],
  "empty.changed": [
    "Girdiler değişti. Simülasyonu yeniden hazırlayın.",
    "The machine settings changed. Prepare the simulation again."
  ],
  "state.start": [
    "başlangıç durumu",
    "start state"
  ],
  "state.final": [
    "kabul durumu",
    "accepting state"
  ],
  "state.notFinal": [
    "kabul durumu değil",
    "not an accepting state"
  ],
  "state.dead": [
    "tuzak durum: buradan kabul durumuna ulaşılamaz",
    "trap state: no accepting state can be reached from here"
  ],
  "common.or": [
    " veya ",
    " or "
  ],
  "machine.noEdges": [
    "Bu makinede geçiş yok.",
    "This machine has no transitions."
  ],
  "subset.minimized": [
    "Minimizasyonda eşdeğer DFA durumları birleştirildi. Aynı satırdaki ayrı kümeler, birleştirilen durumların NFA altkümeleridir; tek bir ε-kapanışı olarak yorumlanmamalıdır.",
    "Equivalent DFA states were merged during minimization. Separate sets in one row are the NFA subsets of the merged states, not a single ε-closure."
  ],
  "subset.plain": [
    "Her DFA durumu, aynı girdi önekinden sonra NFA’da etkin olabilen durumların ε-kapalı bir kümesidir. ∅, hiçbir etkin NFA yolu kalmadığını gösteren tuzak durumdur.",
    "Each DFA state is an ε-closed set of NFA states reachable after the same input prefix. ∅ is the trap state: no active NFA path remains."
  ],
  "tape.empty": [
    "boş metin — okunacak karakter yok",
    "empty input — no characters to read"
  ],
  "step.start": [
    "Başlangıç durumu",
    "Start state"
  ],
  "step.startNfa": [
    "Henüz karakter okunmadı. Sonraki adımlarda önce başlangıç durumunun ε-kapanışı bulunacak.",
    "No characters have been read. The next steps first compute the ε-closure of the start state."
  ],
  "step.startDfa": [
    "Henüz karakter okunmadı. Başlangıç oku, makinenin başladığı durumu gösterir.",
    "No characters have been read. The incoming arrow marks the machine’s start state."
  ],
  "step.epsilon": [
    "ε geçişi · karakter tüketilmez",
    "ε transition · no character consumed"
  ],
  "step.epsilonCycle": [
    "Bu ε yolları zaten etkin olan durumlara ulaşıyor. Yeni durum eklenmez; ε döngüsü tekrar tekrar izlenmez.",
    "These ε paths reach states that are already active. No states are added; ε cycles are not followed repeatedly."
  ],
  "step.outside": [
    "Bu karakter makinenin alfabesinde yok. Hiçbir geçiş izlenemez; girdi reddedilecek. Makineye yeni bir ok eklenmez.",
    "This character is outside the machine’s alphabet. No transition is possible, so the input will be rejected. No new arrow is added to the machine."
  ],
  "step.noPaths": [
    "Etkin bir yol kalmadı. Kalan karakterler bu girdiyi yeniden kabul edilebilir hâle getiremez.",
    "No active path remains. Reading more characters cannot make this input acceptable again."
  ],
  "step.noTransition": [
    "Bu karakter için etkin durumlardan çıkılan bir geçiş yok. Hiçbir yol devam edemiyor.",
    "No transition for this character leaves an active state. No path can continue."
  ],
  "step.trap": [
    "Tuzak duruma ulaşıldı. Kalan karakterler işlense de buradan bir kabul durumuna geçilemez.",
    "A trap state was reached. No accepting state can be reached from here, even after processing the remaining characters."
  ],
  "step.readNfa": [
    "Bu sembolle etiketli bütün uygun oklar aynı anda izlenir. Ardından hedef durumların ε-kapanışı alınır.",
    "All eligible arrows labeled with this symbol are followed together. Next, the ε-closure of the target states is computed."
  ],
  "step.readDfa": [
    "Ok üzerindeki sembol okunur ve hedef duruma geçilir. Kabul kararı, metnin tamamı bittikten sonra verilir.",
    "Read the symbol on the arrow and move to its target state. Acceptance is decided only after the entire input has been processed."
  ],
  "result.accepted": [
    "Kabul edildi",
    "Accepted"
  ],
  "result.rejected": [
    "Reddedildi",
    "Rejected"
  ],
  "result.empty": [
    "Girdi boş; karakter okunmadı.",
    "The input is empty; no characters were read."
  ],
  "result.noFinal": [
    "Son etkin durumların hiçbiri kabul durumu değil.",
    "None of the final active states is accepting."
  ],
  "result.noActive": [
    "Etkin durum kalmadı.",
    "No active states remain."
  ],
  "history.start": [
    "Başlangıç",
    "Start"
  ],
  "history.epsilon": [
    "ε geçişi",
    "ε transition"
  ],
  "history.accept": [
    "Kabul",
    "Accept"
  ],
  "history.reject": [
    "Ret",
    "Reject"
  ],
  "machine.inspect": [
    "Bir duruma tıklayın: başlangıç, kabul, tuzak ve varsa NFA karşılıklarını inceleyin.",
    "Click a state to inspect its start, accepting, and trap status, and its NFA subsets where available."
  ],
  "error.unexpected": [
    "Makine oluşturulurken beklenmeyen bir hata oluştu. Daha küçük bir ifade deneyin.",
    "An unexpected error occurred. Try a smaller expression or a shorter input."
  ],
  "state.nfa": [
    " · NFA karşılığı: {sets}",
    " · NFA subsets: {sets}"
  ],
  "state.more": [
    "… (tamamı aşağıdaki tabloda)",
    "… (full sets in the table below)"
  ],
  "machine.definition": [
    "Q = {states}; Σ = {alphabet}; başlangıç = {start}; F = {finals}.",
    "Q = {states}; Σ = {alphabet}; start = {start}; F = {finals}."
  ],
  "tape.character": [
    "{index}. karakter: {symbol}",
    "Character {index}: {symbol}"
  ],
  "step.epsilonEquation": [
    "S ← S ∪ ε-hedefleri = {states}",
    "S ← S ∪ ε-targets = {states}"
  ],
  "step.epsilonAdded": [
    "{states} eklendi. Önceki etkin durumlar da korunur. Yeni ε-hedefi kalmayana kadar kapanış genişletilir.",
    "Added {states}. Previously active states are kept. The closure expands until no new ε-targets remain."
  ],
  "step.read": [
    "“{symbol}” karakterini oku",
    "Read “{symbol}”"
  ],
  "result.consumed": [
    "{count} karakterin tamamı okundu.",
    "All {count} characters have been read."
  ],
  "result.acceptDetail": [
    "{consumed} Son etkin durumlardan en az biri kabul durumu. Dolayısıyla w ∈ L(r).",
    "{consumed} At least one final active state is accepting. Therefore w ∈ L(r)."
  ],
  "result.rejectDetail": [
    "Metnin tamamı işlendi. {reason} Dolayısıyla w ∉ L(r).",
    "The entire input has been processed. {reason} Therefore w ∉ L(r)."
  ],
  "history.jump": [
    "{step}. adıma dön",
    "Go to step {step}"
  ],
  "history.read": [
    "Oku: {symbol}",
    "Read: {symbol}"
  ],
  "step.seek": [
    "{step}. adım: {title}",
    "Step {step}: {title}"
  ],
  "step.counter": [
    "Adım {step} / {last}",
    "Step {step} / {last}"
  ],
  "step.progress": [
    "{read} / {total} karakter",
    "{read} / {total} characters"
  ],
  "step.live": [
    "{title}. {read} karakter okundu. Etkin durumlar: {states}.",
    "{title}. {read} characters read. Active states: {states}."
  ],
  "machine.meta": [
    "{kind} · {count} durum · Σ = {alphabet}",
    "{kind} · {count} states · Σ = {alphabet}"
  ],
  "machine.minimal": [
    "Minimal DFA",
    "Minimal DFA"
  ],
  "machine.nfa": [
    "Thompson yapımı: {states} durum, {edges} geçiş. NFA’da birden fazla durum aynı anda etkin olabilir.",
    "Thompson construction: {states} states, {edges} transitions. Multiple states can be active in an NFA at once."
  ],
  "machine.dfa": [
    "Thompson ε-NFA ({nfa} durum) → altküme DFA ({dfa} durum){minimized}.",
    "Thompson ε-NFA ({nfa} states) → subset DFA ({dfa} states){minimized}."
  ],
  "machine.minimization": [
    " → minimizasyon ({count} durum)",
    " → minimization ({count} states)"
  ],
  "error.position": [
    " ({position}. karakter)",
    " (character {position})"
  ],
  "input.changed": [
    "Metin değişti. Makine korundu; simülasyon yeni metinle başa alındı.",
    "The input changed. The machine was kept; the simulation is ready to run the new text from the start."
  ],
  "input.correct": [
    "Metni düzelttiğinizde yeni girdi burada görünecek.",
    "The new input will appear here once it is valid."
  ],
  "input.invalid": [
    "İşlenecek metni düzeltin.",
    "Please correct the input text."
  ],
  "input.retained": [
    "Oluşturulan makine korundu. Metni düzelttikten sonra yeniden hazırlamadan simülasyonu başlatabilirsiniz.",
    "The compiled machine is still here. Correct the input to run it again without rebuilding the machine."
  ],
  "graph.title": [
    "{kind}: {count} durum. Çift çemberler kabul durumlarıdır.",
    "{kind}: {count} states. Double circles mark accepting states."
  ],
  "graph.start": [
    ", başlangıç",
    ", start"
  ],
  "graph.final": [
    ", kabul durumu",
    ", accepting state"
  ],
  "graph.trap": [
    ", tuzak durum",
    ", trap state"
  ],
  "error.engine0": [
    "Ters eğik çizgiden sonra bir karakter gerekli.",
    "A character is required after the backslash."
  ],
  "error.engine1": [
    "Negatif karakter sınıfları desteklenmiyor. Açık bir küme kullanın: [abc].",
    "Negated character classes are unsupported. Use an explicit set such as [abc]."
  ],
  "error.engine2": [
    "Aralığın iki ucu da tek bir karakter olmalı.",
    "Both ends of a range must be single characters."
  ],
  "error.engine3": [
    "Karakter aralığı ters yazılmış.",
    "The character range is reversed."
  ],
  "error.engine4": [
    "Karakter sınıfını kapatan ] eksik.",
    "The closing ] of the character class is missing."
  ],
  "error.engine5": [
    "Boş karakter sınıfı yerine boş dil için ∅ kullanın.",
    "Use ∅ for the empty language instead of an empty character class."
  ],
  "error.engine6": [
    "Lookaround ve özel grup türleri desteklenmiyor. Normal ( … ) grubu kullanın.",
    "Lookaround and special groups are unsupported. Use a regular ( … ) group."
  ],
  "error.engine7": [
    "Grubu kapatan ) eksik.",
    "The closing ) of the group is missing."
  ],
  "error.engine8": [
    "Joker . desteklenmiyor. Sonlu bir karakter kümesi yazın; örneğin [a-z].",
    "Wildcard . is unsupported. Use a finite character set, such as [a-z]."
  ],
  "error.engine9": [
    "Çapa kullanmayın: bu laboratuvar zaten metnin tamamını eşleştirir.",
    "Do not use anchors: this lab already matches the entire input."
  ],
  "error.engine10": [
    "Tekrar işaretinden önce bir karakter veya grup gerekli.",
    "A repetition operator must follow a character or a group."
  ],
  "error.engine11": [
    "Beklenmeyen ]. Gerçek ] karakteri için \\] kullanın.",
    "Unexpected ]. Use \\] for a literal ] character."
  ],
  "error.engine12": [
    "Tekrar sayısı gerekli: {3}, {2,4} veya {2,}.",
    "A repetition count is required: {3}, {2,4}, or {2,}."
  ],
  "error.engine13": [
    "Tekrar ifadesini kapatan } eksik.",
    "The closing } of the repetition is missing."
  ],
  "error.engine14": [
    "Üst tekrar sınırı alt sınırdan küçük olamaz.",
    "The upper repetition bound cannot be smaller than the lower bound."
  ],
  "error.engine15": [
    "Üst üste tekrar işareti kullanmayın; lazy/possessive tekrarlar desteklenmiyor.",
    "Do not stack repetition operators; lazy and possessive quantifiers are unsupported."
  ],
  "error.engine16": [
    "Beklenmeyen ). Açılan bir grup yok.",
    "Unexpected ). There is no open group."
  ],
  "error.engine17": [
    "Bu simülasyon çok fazla adım üretiyor. Daha kısa bir metin kullanın.",
    "This simulation produces too many steps. Use a shorter input."
  ],
  "error.engine18": [
    "En fazla {value} karakterlik bir ifade kullanın.",
    "Use an expression of at most {value} characters."
  ],
  "error.engine19": [
    "Bir aralık en fazla {value} sembol içerebilir.",
    "A range may contain at most {value} symbols."
  ],
  "error.engine20": [
    "Alfabe en fazla {value} sembol içerebilir.",
    "The alphabet may contain at most {value} symbols."
  ],
  "error.engine21": [
    "NFA {value} durum sınırını aşıyor. Daha küçük bir ifade deneyin.",
    "The NFA exceeds the {value}-state limit. Try a smaller expression."
  ],
  "error.engine22": [
    "Alfabe en fazla {value} farklı sembol içerebilir.",
    "The alphabet may contain at most {value} distinct symbols."
  ],
  "error.engine23": [
    "Altküme dönüşümü {value} DFA durumu sınırına ulaştı. NFA görünümünü veya daha küçük bir ifadeyi deneyin.",
    "Subset construction reached the {value}-state DFA limit. Try NFA mode or a smaller expression."
  ],
  "error.engine24": [
    "Tekrar sınırı en fazla {value} olabilir.",
    "The repetition bound may be at most {value}."
  ],
  "error.engine25": [
    "Simülasyon metni en fazla {value} karakter olabilir.",
    "The input text may contain at most {value} characters."
  ],
  "error.engine26": [
    "\\{value} desteklenmiyor. Geri başvurular ve Unicode kaçışları bu laboratuvarın kapsamı dışında.",
    "\\{value} is unsupported. Backreferences and Unicode escapes are outside the scope of this lab."
  ]
};
let language = 'tr';
export const getLanguage = () => language;
export function setLanguage(value) { language = value === 'en' ? 'en' : 'tr'; }
export function t(key, params = {}) {
  if (!Object.hasOwn(messages, key)) throw new Error(`Missing translation: ${key}`);
  return messages[key][language === 'en' ? 1 : 0].replace(/\{([A-Za-z]\w*)\}/g,
    (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
}
export function translatePage(root = document) {
  document.documentElement.lang = language;
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  for (const attr of ['aria-label', 'title', 'content']) {
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach(el =>
      el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`))));
  }
}
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const errorPatterns = Object.keys(messages).filter(key => key.startsWith('error.engine')).map(key => ({ key,
  regex: new RegExp('^' + messages[key][0].split('{value}').map(escapeRegex).join(key === 'error.engine26' ? '([\\s\\S]+)' : '(\\d+)') + '$'),
}));
export function translateError(message) {
  for (const { key, regex } of errorPatterns) {
    const match = message.match(regex);
    if (match) return t(key, { value: match[1] });
  }
  return language === 'tr' ? message : t('error.unexpected');
}
