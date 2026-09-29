import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { messages, t, setLanguage, getLanguage, translateError } from '../src/i18n.js';
import { compile, simulate, RegexError } from '../src/automata.js';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('every message has both languages and matching interpolation names', () => {
  const params = text => [...text.matchAll(/\{([A-Za-z]\w*)\}/g)].map(m => m[1]).sort();
  for (const [key, pair] of Object.entries(messages)) {
    assert.equal(pair.length, 2, key);
    assert.ok(pair.every(text => typeof text === 'string' && text.length), key);
    assert.deepEqual(params(pair[0]), params(pair[1]), key);
  }
});

test('all declared DOM and JS translation keys exist', () => {
  for (const path of ['../src/app.js', '../src/graph.js']) {
    for (const [, key] of read(path).matchAll(/\bt\('([^']+)'/g)) assert.ok(messages[key], key);
  }
  for (const [, key] of read('../index.html').matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)) {
    assert.ok(messages[key], key);
  }
});

test('locale fallback and interpolation preserve literal regex syntax and input', () => {
  setLanguage('unsupported'); assert.equal(getLanguage(), 'tr');
  setLanguage('en');
  assert.equal(t('play.start'), 'Start simulation');
  assert.equal(t('step.read', { symbol: '<svg>$&{symbol}' }), 'Read “<svg>$&{symbol}”');
  assert.ok(t('syntax.item5').includes('{2} and {2,}'));
  assert.throws(() => t('missing.key'), /Missing translation/);
  setLanguage('tr');
});

test('all engine error templates translate without leaking Turkish in English', () => {
  for (const [key, pair] of Object.entries(messages).filter(([key]) => key.startsWith('error.engine'))) {
    const source = pair[0].replace('{value}', '42');
    setLanguage('en');
    assert.equal(translateError(source), pair[1].replace('{value}', '42'), key);
    setLanguage('tr'); assert.equal(translateError(source), source, key);
  }
});

test('actual parser and resource-limit errors are localized at the UI boundary', () => {
  const invalid = ['\\', '[^a]', '[a-\\d]', '[z-a]', '[a', '[]', '(?=a)', 'a(', '.', '^a', '*a', ']', 'a{}', 'a{2', 'a{3,2}', 'a**', ')', 'a'.repeat(181), '[a-🙂]', 'a{25}', '\\q', 'a'.repeat(65), '(a|b)*a(a|b){7}'];
  setLanguage('en');
  for (const pattern of invalid) {
    assert.throws(() => compile(pattern), error => {
      assert.ok(error instanceof RegexError, pattern);
      const text = translateError(error.message);
      assert.notEqual(text, error.message, pattern);
      assert.notEqual(text, t('error.unexpected'), pattern);
      return true;
    });
  }
  assert.throws(() => simulate(compile('a'), 'a'.repeat(257)), error => {
    assert.equal(translateError(error.message), 'The input text may contain at most 256 characters.');
    return true;
  });
  setLanguage('tr');
});
