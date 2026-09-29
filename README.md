# Regex → Automata

An interactive lab for understanding how regular expressions become finite automata. Build a DFA or an ε-NFA, feed it a word, and follow the transitions in a textbook-style state diagram.

[Open the lab](https://berkopan.github.io/regex-automata/) · [Türkçe](README.tr.md)

## Explore an expression

Enter a regular expression and some input, choose **DFA** or **NFA**, and select **Prepare simulation**. Then play the simulation or advance one step at a time. The input tape, highlighted arrows, and active states show exactly what happens as each character is read. The final step explains acceptance or rejection.

Try `(a|b)*abb` with `aabb` for a DFA, or `ab|ac` with `ac` to explore parallel NFA paths.

**Reuse the machine with different input.** Editing only the input pauses playback and resets the trace, while keeping the diagram, zoom, and selected state. Changing the expression, machine type, or minimization option requires a new preparation.

## Features

- **Thompson ε-NFA construction**, including all active paths and separate ε-closure steps that consume no input.
- **Subset DFA construction** with optional minimization. Inspect the original NFA subsets represented by each DFA state.
- **Playback and inspection:** forward/backward steps, speed controls, timeline, transition tables, state details, and step history. Pan, zoom, or export the diagram as SVG.

The interface is available in **Turkish and English** through the **TR / EN** switch. Language changes preserve the machine and current step; the preference is saved locally when browser storage is available.

The warm, light interface keeps the diagram stationary during playback. Keyboard controls and reduced-motion preferences are supported.

## Supported syntax

| Syntax | Meaning |
| --- | --- |
| `ab`, `a\|b`, `(ab)` | Concatenation, union, grouping |
| `a*`, `a+`, `a?` | Zero or more, one or more, optional |
| `a{3}`, `a{2,4}`, `a{2,}` | Bounded or lower-bounded repetition |
| `[abc]`, `[a-z]` | Finite character sets and ranges |
| `\d`, `\w`, `\s` | ASCII digit, word, and whitespace classes |
| `\*`, `\[`, `\\`, `\n`, `\t` | Escaped literals and control characters |
| `ε`, an empty expression, `()` | Empty word |
| `∅` | Empty language |

This is a teaching tool, **not a full JavaScript/PCRE regex engine**. Wildcard `.`, negated classes, anchors, flags, lookaround, backreferences, and lazy/possessive quantifiers are unsupported. Matching covers the **entire input**, not a substring. Do not wrap expressions in `/…/`: slash is a literal character here.

Whitespace is preserved. Input is processed as Unicode code points; a combined grapheme may take multiple steps. `\d` and `\w` use ASCII sets; `\s` contains space, `\t`, `\n`, `\r`, `\f`, and `\v`. Use `\ε` or `\∅` for literal ε or ∅ characters.

For readability and browser responsiveness, limits are 180 expression code points, 256 input code points, 128 NFA states, 96 DFA states before minimization, 96 alphabet symbols, a finite repetition bound of 24, and 12,000 trace steps.

## Development

No runtime dependencies or build step. Serve the repository over HTTP:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. ES modules require HTTP rather than opening `index.html` directly.

Run engine and localization tests with Node.js 20+:

```sh
npm test
```

Optional Chromium interface tests:

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/browser.py
```

The implementation is split into `src/automata.js` (algorithms), `src/graph.js` (SVG), `src/app.js` (interaction), and `src/i18n.js` (translations).

Everything runs in the browser: no backend, external fonts, CDN, analytics, or remote matching service. Expressions and input text are not sent anywhere.
