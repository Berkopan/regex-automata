"""Offline Chromium UI regression tests. Install: pip install playwright
Run: python tests/browser.py (or set CHROMIUM_PATH for a system Chromium).
The real ES modules are loaded from in-memory Blob URLs; no external service,
CDN, Pages deployment, or network request is involved.
"""
from pathlib import Path
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'test-results'


def mount(page):
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="./styles.css">', '')
    html = html.replace('<script type="module" src="./src/app.js"></script>', '')
    page.set_content(html)
    page.add_style_tag(content=(ROOT / 'styles.css').read_text(encoding='utf-8'))
    page.evaluate('''async sources => {
      const url = text => URL.createObjectURL(new Blob([text], {type:'text/javascript'}));
      const engine = url(sources.engine);
      const i18n = url(sources.i18n);
      const graph = url(sources.graph.replace("'./i18n.js'", JSON.stringify(i18n)).replace("'./automata.js'", JSON.stringify(engine)));
      await import(url(sources.app.replace("'./i18n.js'", JSON.stringify(i18n)).replace("'./automata.js'",JSON.stringify(engine)).replace("'./graph.js'",JSON.stringify(graph))));
    }''', {name: (ROOT / f'src/{file}.js').read_text(encoding='utf-8') for name, file in [('i18n', 'i18n'), ('engine', 'automata'), ('graph', 'graph'), ('app', 'app')]})


class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        OUTPUT.mkdir(exist_ok=True)
        cls.playwright = sync_playwright().start()
        executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser')
        options = {'headless': True}
        if executable:
            options['executable_path'] = executable
        cls.browser = cls.playwright.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1440, 'height': 1080}, device_scale_factor=1)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        mount(self.page)

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def prepare(self, pattern=None, text=None, kind=None):
        if pattern is not None:
            self.page.locator('#pattern').fill(pattern)
        if text is not None:
            self.page.locator('#sample-text').fill(text)
        if kind:
            self.page.locator(f'#kind-{kind}').check()
        self.page.locator('#prepare').click()
        expect(self.page.locator('#form-error')).to_be_hidden()
        expect(self.page.locator('#automaton')).to_be_visible()

    def seek(self, value):
        self.page.locator('#seek').evaluate('(el,value)=>{el.value=value === "end" ? el.max : value;el.dispatchEvent(new Event("input",{bubbles:true}));}', value)

    def test_initial_controls_disabled(self):
        for field in ['play', 'next', 'previous', 'reset', 'seek', 'export-svg']:
            expect(self.page.locator('#' + field)).to_be_disabled()
        expect(self.page.locator('#automaton')).to_be_hidden()
        expect(self.page.locator('#empty-diagram')).to_be_visible()

    def test_prepare_renders_visible_textbook_diagram(self):
        self.prepare()
        expect(self.page.locator('.state')).to_have_count(4)
        expect(self.page.locator('.state .inner')).to_have_count(1)
        expect(self.page.locator('.start-line')).to_have_count(1)
        expect(self.page.locator('#play')).to_be_enabled()
        self.assertGreater(self.page.locator('#automaton').evaluate('el=>el.getBBox().width'), 500)
        self.assertEqual(self.page.locator('.state.is-active').get_attribute('data-state'), '0')
        self.page.screenshot(path=str(OUTPUT / 'desktop.png'), full_page=True)

    def test_forward_animation_and_backwards_restore(self):
        self.prepare()
        self.page.locator('#next').click()
        expect(self.page.locator('.transition.is-used')).to_have_count(1)
        expect(self.page.locator('.state.is-active')).to_have_attribute('data-state', '1')
        expect(self.page.locator('#current-states')).to_have_text('{q₁}')
        expect(self.page.locator('.tape-cell.is-read')).to_have_count(1)
        self.page.locator('#previous').click()
        expect(self.page.locator('.state.is-active')).to_have_attribute('data-state', '0')
        expect(self.page.locator('.tape-cell.is-done')).to_have_count(0)

    def test_play_pause_and_resume(self):
        self.prepare()
        self.page.locator('#speed').select_option('4')
        self.page.locator('#play').click()
        self.page.wait_for_function('document.getElementById("seek").value !== "0"')
        self.page.locator('#play').click()
        paused = self.page.locator('#seek').input_value()
        self.page.wait_for_timeout(600)
        self.assertEqual(self.page.locator('#seek').input_value(), paused)
        self.page.locator('#play').click()
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi', timeout=4000)
        expect(self.page.locator('#play')).to_have_text('Yeniden oynat')

    def test_acceptance_only_at_end_and_reset(self):
        self.prepare('a*', 'aa')
        self.assertNotEqual(self.page.locator('#step-title').text_content(), 'Kabul edildi')
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi')
        expect(self.page.locator('.state.is-accepted')).to_have_count(1)
        expect(self.page.locator('#next')).to_be_disabled()
        self.page.locator('#reset').click()
        expect(self.page.locator('#step-title')).to_have_text('Başlangıç durumu')
        expect(self.page.locator('#input-progress')).to_have_text('0 / 2 karakter')

    def test_rejection_and_trap_inspector(self):
        self.prepare('ab', 'aab')
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Reddedildi')
        expect(self.page.locator('.state.is-rejected')).to_have_count(1)
        self.page.locator('.state.is-rejected').click()
        expect(self.page.locator('#state-inspector')).to_contain_text('tuzak durum')

    def test_nfa_parallel_paths_and_epsilon_waves(self):
        self.prepare('ab|ac', 'ac', 'nfa')
        before = self.page.locator('.state').evaluate_all('nodes=>nodes.map(n=>n.getAttribute("transform"))')
        self.page.locator('#next').click()
        expect(self.page.locator('.state.is-active')).to_have_count(3)
        expect(self.page.locator('#input-progress')).to_have_text('0 / 2 karakter')
        self.page.locator('#next').click()
        expect(self.page.locator('.state.is-active')).to_have_count(2)
        expect(self.page.locator('.transition.is-used')).to_have_count(2)
        expect(self.page.locator('#current-states')).to_have_text('{q₂, q₆}')
        after = self.page.locator('.state').evaluate_all('nodes=>nodes.map(n=>n.getAttribute("transform"))')
        self.assertEqual(before, after)
        self.page.screenshot(path=str(OUTPUT / 'nfa-parallel.png'), full_page=True)
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi')

    def test_empty_input_epsilon_acceptance(self):
        self.prepare('(a|ε)*', '', 'nfa')
        expect(self.page.locator('.tape-cell')).to_have_count(0)
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi')
        expect(self.page.locator('#input-progress')).to_have_text('0 / 0 karakter')

    def remember_graph(self):
        self.page.evaluate("window.originalNodes = [...document.querySelectorAll('#automaton .state')]")
        return self.page.locator('#automaton').get_attribute('viewBox')

    def assert_graph_retained(self, view):
        self.assertTrue(self.page.evaluate("window.originalNodes.every((n,i)=>n===document.querySelectorAll('#automaton .state')[i])"))
        self.assertEqual(self.page.locator('#automaton').get_attribute('viewBox'), view)
        expect(self.page.locator('#automaton')).to_be_visible()

    def test_edit_during_play_keeps_machine_and_cancels_timer(self):
        self.prepare()
        self.page.locator('#zoom-in').click()
        view = self.remember_graph()
        self.page.locator('#speed').select_option('4')
        self.page.locator('#play').click()
        self.page.wait_for_function('document.getElementById("seek").value !== "0"')
        self.page.locator('#sample-text').fill('abba')
        self.page.wait_for_timeout(500)
        self.assert_graph_retained(view)
        expect(self.page.locator('#play')).to_be_enabled()
        expect(self.page.locator('#play')).to_have_attribute('aria-pressed', 'false')
        self.assertEqual(self.page.locator('#seek').input_value(), '0')
        expect(self.page.locator('#input-progress')).to_have_text('0 / 4 karakter')
        expect(self.page.locator('.travel-dot')).to_have_count(0)
        expect(self.page.locator('#history-rows tr')).to_have_count(1)
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Reddedildi')

    def test_input_edits_after_result_accept_new_text_without_prepare(self):
        for kind in ['dfa', 'nfa']:
            with self.subTest(kind=kind):
                self.prepare('a*', 'aa', kind)
                self.seek('end')
                view = self.remember_graph()
                for text, outcome in [('', 'Kabul edildi'), ('b', 'Reddedildi'), ('aaa', 'Kabul edildi')]:
                    self.page.locator('#sample-text').fill(text)
                    self.assert_graph_retained(view)
                    expect(self.page.locator('#play')).to_be_enabled()
                    self.seek('end')
                    expect(self.page.locator('#step-title')).to_have_text(outcome)

    def test_invalid_input_keeps_machine_and_recovers_without_compile(self):
        self.prepare()
        view = self.remember_graph()
        self.page.locator('#sample-text').fill('a' * 257)
        self.assert_graph_retained(view)
        expect(self.page.locator('#form-error')).to_be_visible()
        expect(self.page.locator('#play')).to_be_disabled()
        expect(self.page.locator('#export-svg')).to_be_enabled()
        self.page.locator('[data-language=en]').click()
        expect(self.page.locator('#form-error')).to_contain_text('256 characters')
        expect(self.page.locator('#step-title')).to_have_text('Please correct the input text.')
        self.page.locator('#sample-text').fill('abb')
        self.assert_graph_retained(view)
        expect(self.page.locator('#form-error')).to_be_hidden()
        expect(self.page.locator('#play')).to_be_enabled()
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Accepted')

    def test_initial_invalid_input_does_not_discard_valid_machine(self):
        self.page.locator('#sample-text').fill('a' * 257)
        self.page.locator('#prepare').click()
        expect(self.page.locator('#automaton')).to_be_visible()
        expect(self.page.locator('#play')).to_be_disabled()
        view = self.remember_graph()
        self.page.locator('#sample-text').fill('abb')
        self.assert_graph_retained(view)
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi')

    def test_english_interface_and_preserved_inspector_and_step(self):
        self.prepare()
        self.page.locator('#next').click()
        expect(self.page.locator('#current-states')).to_have_text('{q₁}')
        self.page.locator('.state[data-state="1"]').click()
        self.page.locator('#zoom-in').click()
        view = self.remember_graph()
        self.page.locator('[data-language=en]').click()
        self.assert_graph_retained(view)
        expect(self.page.locator('html')).to_have_attribute('lang', 'en')
        expect(self.page.locator('#prepare')).to_have_text('Prepare simulation')
        expect(self.page.locator('#step-title')).to_have_text('Read “a”')
        expect(self.page.locator('#state-inspector')).to_contain_text('NFA subsets')
        expect(self.page.locator('#current-states')).to_have_text('{q₁}')
        expect(self.page.locator('#automaton > title')).to_contain_text('states')
        expect(self.page.locator('.state[data-state="0"]')).to_have_attribute('aria-label', 'q₀, start')
        self.assertEqual(self.page.locator('#seek').input_value(), '1')
        self.assertEqual(self.page.locator('#pattern').input_value(), '(a|b)*abb')
        self.assertTrue(self.page.locator('#minimize').is_checked())
        self.page.screenshot(path=str(OUTPUT / 'desktop-en.png'), full_page=True)
        self.page.locator('[data-language=tr]').click()
        self.assert_graph_retained(view)
        expect(self.page.locator('#step-title')).to_have_text('“a” karakterini oku')
        self.page.screenshot(path=str(OUTPUT / 'desktop-tr.png'), full_page=True)

    def test_saved_language_is_restored_on_fresh_initialization(self):
        # about:blank has no storage origin. This Storage test double verifies
        # saving/restoring preferences without a live HTTP server.
        self.page.evaluate("""() => {
          const values = new Map();
          Object.defineProperty(window, 'localStorage', { configurable: true,
            value: { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key, String(value)) } });
        }""")
        self.page.locator('[data-language=en]').click()
        self.assertEqual(self.page.evaluate("localStorage.getItem('regex-automata.language')"), 'en')
        mount(self.page)
        expect(self.page.locator('html')).to_have_attribute('lang', 'en')
        expect(self.page.locator('#play')).to_have_text('Start simulation')
        self.page.locator('[data-language=tr]').click()
        mount(self.page)
        expect(self.page.locator('html')).to_have_attribute('lang', 'tr')

    def test_blocked_storage_does_not_break_language_switch(self):
        self.page.evaluate("Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('blocked');}})")
        mount(self.page)
        self.page.locator('[data-language=en]').click()
        self.prepare('a', 'a')
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Accepted')

    def test_localized_error_survives_language_change(self):
        self.page.locator('#pattern').fill('a(')
        self.page.locator('#prepare').click()
        self.page.locator('[data-language=en]').click()
        expect(self.page.locator('#form-error')).to_have_text('The closing ) of the group is missing. (character 2)')
        self.page.locator('[data-language=tr]').click()
        expect(self.page.locator('#form-error')).to_contain_text('Grubu kapatan ) eksik.')

    def test_english_epsilon_and_language_switch_during_play(self):
        self.page.locator('[data-language=en]').click()
        self.prepare('ab|ac', 'ac', 'nfa')
        self.page.locator('#next').click()
        expect(self.page.locator('#step-title')).to_have_text('ε transition · no character consumed')
        expect(self.page.locator('#step-detail')).to_contain_text('Previously active states are kept')
        view = self.remember_graph()
        self.page.locator('#speed').select_option('4')
        self.page.locator('#play').click()
        self.page.locator('[data-language=tr]').click()
        self.assert_graph_retained(view)
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi', timeout=6000)

    def test_cream_palette_remains_light_in_dark_os_mode(self):
        self.page.emulate_media(color_scheme='dark')
        self.assertEqual(self.page.locator('html').evaluate('el=>getComputedStyle(el).backgroundColor'), 'rgb(246, 242, 233)')
        self.assertEqual(self.page.locator('.diagram-area').evaluate('el=>getComputedStyle(el).backgroundColor'), 'rgb(246, 242, 233)')
        self.assertEqual(self.page.locator('#pattern').evaluate('el=>getComputedStyle(el).backgroundColor'), 'rgb(251, 248, 241)')

    def test_mobile_english_layout(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.locator('[data-language=en]').click()
        self.prepare()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        expect(self.page.locator('[data-language=tr]')).to_be_visible()
        self.page.screenshot(path=str(OUTPUT / 'mobile-en.png'), full_page=True)

    def test_syntax_error_has_position_and_disables_stale_machine(self):
        self.prepare()
        self.page.locator('#pattern').fill('a(')
        self.page.locator('#prepare').click()
        expect(self.page.locator('#form-error')).to_be_visible()
        expect(self.page.locator('#form-error')).to_contain_text('2. karakter')
        expect(self.page.locator('#pattern')).to_have_attribute('aria-invalid', 'true')
        expect(self.page.locator('#play')).to_be_disabled()
        self.assertEqual(self.page.locator('#pattern').evaluate('el=>el.selectionStart'), 1)

    def test_unicode_and_safe_dom_text(self):
        self.prepare('(🙂|ğ)+', '🙂ğ')
        expect(self.page.locator('.tape-cell')).to_have_count(2)
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi')
        self.prepare('<svg>', '<svg>')
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi')
        expect(self.page.locator('svg')).to_have_count(1)

    def test_reduced_motion_is_instant(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.prepare()
        self.page.locator('#next').click()
        expect(self.page.locator('.travel-dot')).to_have_count(0)
        expect(self.page.locator('.state.is-active')).to_have_attribute('data-state', '1')

    def test_zoom_pan_fit_and_svg_export(self):
        self.prepare()
        view = self.page.locator('#automaton').get_attribute('viewBox')
        self.page.locator('#zoom-in').click()
        self.assertNotEqual(self.page.locator('#automaton').get_attribute('viewBox'), view)
        self.page.locator('#fit').click()
        self.assertEqual(self.page.locator('#automaton').get_attribute('viewBox'), view)
        box = self.page.locator('#automaton').bounding_box()
        self.page.mouse.move(box['x'] + 20, box['y'] + 20)
        self.page.mouse.down()
        self.page.mouse.move(box['x'] + 80, box['y'] + 40)
        self.page.mouse.up()
        self.assertNotEqual(self.page.locator('#automaton').get_attribute('viewBox'), view)
        self.page.locator('#fit').click()
        with self.page.expect_download() as download:
            self.page.locator('#export-svg').click()
        path = OUTPUT / 'export.svg'
        download.value.save_as(str(path))
        text = path.read_text(encoding='utf-8')
        self.assertIn('http://www.w3.org/2000/svg', text)
        self.assertIn('.state.is-active', text)
        self.assertNotIn('<script', text)

    def test_keyboard_does_not_steal_input_arrows(self):
        self.prepare()
        self.page.locator('#pattern').focus()
        self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.page.locator('#seek').input_value(), '0')
        self.page.locator('#tape-heading').evaluate('el=>{el.tabIndex=-1;el.focus();}')
        self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.page.locator('#seek').input_value(), '1')
        self.page.keyboard.press('ArrowLeft')
        self.assertEqual(self.page.locator('#seek').input_value(), '0')

    def test_machine_switch_and_unminimized_provenance(self):
        self.prepare()
        self.page.locator('#minimize').uncheck()
        expect(self.page.locator('#play')).to_be_disabled()
        self.prepare()
        expect(self.page.locator('.state')).to_have_count(5)
        self.assertIn('DFA', self.page.locator('#machine-meta').text_content())
        self.page.locator('#kind-nfa').check()
        expect(self.page.locator('#minimize')).to_be_disabled()
        self.prepare()
        expect(self.page.locator('.state')).to_have_count(14)
        expect(self.page.locator('#subset-details')).to_be_hidden()

    def test_mobile_layout_and_single_state_machine(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.prepare()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.page.screenshot(path=str(OUTPUT / 'mobile.png'), full_page=True)
        self.prepare('ε', '', 'dfa')
        expect(self.page.locator('.state')).to_have_count(1)
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
