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
      const graph = url(sources.graph.replace("'./automata.js'", JSON.stringify(engine)));
      await import(url(sources.app.replace("'./automata.js'",JSON.stringify(engine)).replace("'./graph.js'",JSON.stringify(graph))));
    }''', {name: (ROOT / f'src/{file}.js').read_text(encoding='utf-8') for name, file in [('engine', 'automata'), ('graph', 'graph'), ('app', 'app')]})


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

    def test_edit_during_play_invalidates_and_cancels_timer(self):
        self.prepare()
        self.page.locator('#speed').select_option('4')
        self.page.locator('#play').click()
        self.page.locator('#sample-text').fill('abba')
        self.page.wait_for_timeout(450)
        expect(self.page.locator('#play')).to_be_disabled()
        expect(self.page.locator('#automaton')).to_be_hidden()
        self.prepare()
        expect(self.page.locator('#input-progress')).to_have_text('0 / 4 karakter')
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Reddedildi')

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
