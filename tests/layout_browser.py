"""Opt-in routing, classic-layout round trips, and live simulation regressions.
Run: python -m unittest discover -s tests -p '*browser.py' -v
"""
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright, expect
from browser import mount, OUTPUT

PATTERN = '((a|b)*abb)|(abb(a|b)*)'


class LayoutToggleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        OUTPUT.mkdir(exist_ok=True)
        cls.playwright = sync_playwright().start()
        executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser')
        cls.browser = cls.playwright.chromium.launch(**({'executable_path': executable} if executable else {}))

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1612, 'height': 1000})
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        mount(self.page)
        self.toggle = self.page.locator('#avoid-overlap')

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def prepare(self, pattern=PATTERN, text='aabb', kind='dfa', minimize=True):
        self.page.locator('#pattern').fill(pattern)
        self.page.locator('#sample-text').fill(text)
        self.page.locator(f'#kind-{kind}').check()
        if kind == 'dfa':
            self.page.locator('#minimize').set_checked(minimize)
        self.page.locator('#prepare').click()
        expect(self.page.locator('#form-error')).to_be_hidden()
        expect(self.page.locator('#automaton')).to_be_visible()

    def seek(self, value):
        self.page.locator('#seek').evaluate('(el,n)=>{el.value=n==="end"?el.max:n;el.dispatchEvent(new Event("input",{bubbles:true}));}', value)

    def geometry(self):
        return self.page.locator('#automaton').evaluate('''svg => ({
          view: svg.getAttribute('viewBox'),
          nodes: [...svg.querySelectorAll('.state')].map(n=>[n.dataset.state, n.getAttribute('transform')]),
          edges: [...svg.querySelectorAll('.transition')].map(g=>[g.dataset.from, g.dataset.to,
            g.querySelector('.edge-line').getAttribute('d'), g.querySelector('.edge-label').outerHTML])
        })''')

    def assert_clear(self):
        problems = self.page.locator('#automaton').evaluate('''svg => {
          const problems = [];
          const states = [...svg.querySelectorAll('.state')].map(el => {
            const m = el.transform.baseVal.consolidate().matrix;
            return { id: el.dataset.state, x: m.e, y: m.f };
          });
          const labels = [...svg.querySelectorAll('.edge-label')].map(el => {
            const b = el.getBBox();
            return { x: b.x-3, y: b.y-3, width: b.width+6, height: b.height+6 };
          });
          const overlaps = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
          labels.forEach((label,i) => {
            for (const s of states) {
              const x = Math.max(label.x, Math.min(s.x, label.x+label.width));
              const y = Math.max(label.y, Math.min(s.y, label.y+label.height));
              if (Math.hypot(x-s.x,y-s.y)<27) problems.push(`label ${i} on ${s.id}`);
            }
            labels.slice(i+1).forEach((other,j)=>{if(overlaps(label,other))problems.push(`labels ${i}/${i+j+1}`);});
          });
          for (const group of svg.querySelectorAll('.transition')) {
            const path = group.querySelector('.edge-line'), length = path.getTotalLength();
            for (let d=0;d<=length;d+=2) {
              const p = path.getPointAtLength(d);
              for (const s of states) {
                if (s.id===group.dataset.from || s.id===group.dataset.to) continue;
                if (Math.hypot(p.x-s.x,p.y-s.y)<29) {problems.push(`${group.dataset.from}→${group.dataset.to} hits ${s.id}`);break;}
              }
            }
          }
          const view=svg.viewBox.baseVal, scene=svg.querySelector(':scope > g').getBBox();
          if(scene.x<view.x || scene.y<view.y || scene.x+scene.width>view.x+view.width || scene.y+scene.height>view.y+view.height)problems.push('clipped scene');
          return [...new Set(problems)];
        }''')
        self.assertEqual(problems, [])

    def test_initial_and_fresh_page_default_is_classic(self):
        expect(self.toggle).not_to_be_checked()
        expect(self.toggle).to_be_disabled()
        self.prepare()
        expect(self.toggle).to_be_enabled()
        expect(self.page.locator('#automaton')).to_have_attribute('data-layout', 'classic')
        self.toggle.check()
        mount(self.page)
        expect(self.toggle).not_to_be_checked()
        expect(self.toggle).to_be_disabled()
        self.prepare()
        expect(self.page.locator('#automaton')).to_have_attribute('data-layout', 'classic')

    def test_default_and_opt_in_screenshots_and_exact_round_trip(self):
        self.prepare()
        original = self.geometry()
        expect(self.page.locator('.state')).to_have_count(8)
        self.assertNotIn(' Q ', self.page.locator('.transition[data-from="2"][data-to="3"] .edge-line').get_attribute('d'))
        self.page.screenshot(path=str(OUTPUT/'layout-default.png'))
        self.toggle.check()
        expect(self.page.locator('#automaton')).to_have_attribute('data-layout', 'spaced')
        self.assertNotEqual(self.geometry(), original)
        self.assert_clear()
        self.page.screenshot(path=str(OUTPUT/'layout-enabled.png'))
        self.toggle.uncheck()
        self.assertEqual(self.geometry(), original)

    def test_both_layouts_across_machine_modes(self):
        for pattern in [PATTERN, '(a|b)*abb', 'ab|ac', '((a?)*)*', '[a-zA-Z0-9_]+', '(🙂|ğ)+']:
            for kind, minimize in [('dfa', True), ('dfa', False), ('nfa', False)]:
                with self.subTest(pattern=pattern, kind=kind, minimize=minimize):
                    self.prepare(pattern, kind=kind, minimize=minimize)
                    expect(self.toggle).not_to_be_checked()
                    original = self.geometry()
                    self.toggle.check()
                    self.assert_clear()
                    self.toggle.uncheck()
                    self.assertEqual(self.geometry(), original)

    def test_toggle_preserves_step_selection_table_and_tape(self):
        self.prepare()
        self.seek('2')
        self.page.locator('.state[data-state="6"]').click()
        before = {s: self.page.locator(s).inner_html() for s in ['#state-inspector', '#transition-rows', '#subset-rows', '#history-rows', '#step-report', '#tape']}
        for enabled in [True, False, True, False]:
            self.toggle.set_checked(enabled)
            self.assertEqual(self.page.locator('#seek').input_value(), '2')
            expect(self.page.locator('.state[data-state="6"]')).to_have_class('state is-selected')
            for selector, html in before.items():
                self.assertEqual(self.page.locator(selector).inner_html(), html, selector)

    def test_toggle_mid_animation_resumes_without_stale_callbacks(self):
        self.prepare(text='aaaababb')
        self.page.locator('#speed').select_option('2')
        self.page.locator('#play').click()
        self.page.wait_for_selector('.travel-dot')
        # In one browser task, capture the frame and toggle during animation.
        state = self.toggle.evaluate('''el=>{
          const before=document.getElementById('seek').value;
          el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
          return {before,after:document.getElementById('seek').value,dots:document.querySelectorAll('.travel-dot').length};
        }''')
        self.assertEqual(state['before'], state['after'])
        self.assertEqual(state['dots'], 0)
        expect(self.page.locator('#play')).to_have_attribute('aria-pressed', 'true')
        self.toggle.uncheck()
        self.toggle.check()
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi', timeout=9000)
        expect(self.page.locator('.travel-dot')).to_have_count(0)
        self.assert_clear()

    def test_input_edits_keep_selected_mode_and_nodes(self):
        self.prepare()
        self.toggle.check()
        self.page.evaluate('window.kept=[...document.querySelectorAll(".state")]')
        view = self.geometry()['view']
        for text, result in [('abbb', 'Kabul edildi'), ('babba', 'Reddedildi')]:
            self.page.locator('#sample-text').fill(text)
            expect(self.toggle).to_be_checked()
            self.assertTrue(self.page.evaluate('window.kept.every((n,i)=>n===document.querySelectorAll(".state")[i])'))
            self.assertEqual(self.geometry()['view'], view)
            self.seek('end')
            expect(self.page.locator('#step-title')).to_have_text(result)
            self.toggle.uncheck()
            expect(self.page.locator('#step-title')).to_have_text(result)
            self.toggle.check()
            self.page.evaluate('window.kept=[...document.querySelectorAll(".state")]')

    def test_new_pattern_example_kind_and_minimization_reset_to_classic(self):
        self.prepare()
        for action in [lambda: self.page.locator('#pattern').fill('a(b|c)+'),
                       lambda: self.page.locator('#examples').select_option('suffix'),
                       lambda: self.page.locator('#minimize').uncheck(),
                       lambda: self.page.locator('#kind-nfa').check()]:
            self.toggle.check()
            action()
            expect(self.toggle).not_to_be_checked()
            expect(self.toggle).to_be_disabled()
            self.page.locator('#prepare').click()
            expect(self.page.locator('#automaton')).to_have_attribute('data-layout', 'classic')

    def test_language_switch_keeps_mode_and_localizes_control(self):
        self.prepare()
        self.toggle.check()
        self.seek('2')
        graph = self.geometry()
        self.page.locator('[data-language=en]').click()
        expect(self.page.get_by_label('Enable if arrows or states overlap')).to_be_checked()
        self.assertEqual(self.geometry(), graph)
        self.assertEqual(self.page.locator('#seek').input_value(), '2')
        self.page.locator('[data-language=tr]').click()
        expect(self.page.get_by_label('Oklar veya durumlar üst üste geliyorsa açın')).to_be_checked()

    def test_keyboard_toggle_does_not_control_playback(self):
        self.prepare()
        self.toggle.focus()
        self.page.keyboard.press('Space')
        expect(self.toggle).to_be_checked()
        expect(self.page.locator('#play')).to_have_attribute('aria-pressed', 'false')
        self.assertEqual(self.page.locator('#seek').input_value(), '0')
        self.page.keyboard.press('Space')
        expect(self.toggle).not_to_be_checked()

    def test_invalid_input_can_still_switch_and_recover(self):
        self.prepare()
        self.page.locator('#sample-text').fill('a'*257)
        for enabled in [True, False]:
            self.toggle.set_checked(enabled)
            expect(self.page.locator('#form-error')).to_be_visible()
            expect(self.page.locator('#play')).to_be_disabled()
        self.page.locator('#sample-text').fill('abb')
        expect(self.page.locator('#form-error')).to_be_hidden()
        self.seek('end')
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi')

    def test_zoom_fit_and_export_use_selected_layout(self):
        self.prepare()
        for enabled, mode in [(False, 'classic'), (True, 'spaced')]:
            self.toggle.set_checked(enabled)
            view = self.geometry()['view']
            self.page.locator('#zoom-in').click()
            self.assertNotEqual(self.geometry()['view'], view)
            self.page.locator('#fit').click()
            self.assertEqual(self.geometry()['view'], view)
            with self.page.expect_download() as event:
                self.page.locator('#export-svg').click()
            path = OUTPUT/f'layout-{mode}.svg'
            event.value.save_as(str(path))
            svg = path.read_text(encoding='utf-8')
            self.assertIn(f'data-layout="{mode}"', svg)
            self.assertEqual(' Q ' in svg, enabled)
            self.assertNotIn('<script', svg)
            self.assertNotIn('NaN', svg)

    def test_mobile_toggle_and_both_layouts_do_not_overflow(self):
        for width in [320, 390, 768]:
            self.page.set_viewport_size({'width': width, 'height': 844})
            self.prepare()
            for enabled in [False, True]:
                self.toggle.set_checked(enabled)
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
                if enabled:
                    self.assert_clear()
            self.toggle.scroll_into_view_if_needed()
            self.page.screenshot(path=str(OUTPUT/f'layout-mobile-{width}.png'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
