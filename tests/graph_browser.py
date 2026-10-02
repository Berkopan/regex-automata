"""SVG geometry and interaction regressions for obstacle-aware routing.
Run together with the existing UI suite:
  python -m unittest discover -s tests -p '*browser.py' -v
"""
from pathlib import Path
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright, expect
from browser import mount, OUTPUT

PATTERN = '((a|b)*abb)|(abb(a|b)*)'


class GraphRoutingTests(unittest.TestCase):
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
        self.page = self.browser.new_page(viewport={'width': 1612, 'height': 1000})
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        mount(self.page)

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def prepare(self, pattern=PATTERN, kind='dfa', minimize=True):
        self.page.locator('#pattern').fill(pattern)
        self.page.locator('#sample-text').fill('aabb')
        self.page.locator(f'#kind-{kind}').check()
        if kind == 'dfa':
            self.page.locator('#minimize').set_checked(minimize)
        self.page.locator('#prepare').click()
        expect(self.page.locator('#form-error')).to_be_hidden()
        expect(self.page.locator('#automaton')).to_be_visible()

    def assert_geometry(self):
        problems = self.page.locator('#automaton').evaluate('''svg => {
          const problems = [];
          const states = [...svg.querySelectorAll('.state')].map(el => {
            const m = el.transform.baseVal.consolidate().matrix;
            return { id: el.dataset.state, x: m.e, y: m.f };
          });
          const labels = [...svg.querySelectorAll('.edge-label')].map(el => {
            const b = el.getBBox();
            return { text: el.textContent, x: b.x - 3, y: b.y - 3, width: b.width + 6, height: b.height + 6 };
          });
          const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
          labels.forEach((label, i) => {
            for (const s of states) {
              const x = Math.max(label.x, Math.min(s.x, label.x + label.width));
              const y = Math.max(label.y, Math.min(s.y, label.y + label.height));
              if (Math.hypot(x - s.x, y - s.y) < 27) problems.push(`label ${i} on state ${s.id}`);
            }
            labels.slice(i + 1).forEach((other, j) => { if (intersects(label, other)) problems.push(`labels ${i}/${i+j+1}`); });
          });
          for (const group of svg.querySelectorAll('.transition')) {
            const path = group.querySelector('.edge-line'), length = path.getTotalLength();
            for (let d = 0; d <= length; d += 2) {
              const p = path.getPointAtLength(d);
              for (const s of states) {
                if (s.id === group.dataset.from || s.id === group.dataset.to) continue;
                if (Math.hypot(p.x - s.x, p.y - s.y) < 29) { problems.push(`${group.dataset.from}→${group.dataset.to} hits ${s.id}`); break; }
              }
            }
          }
          const view = svg.viewBox.baseVal, scene = svg.querySelector(':scope > g').getBBox();
          if (scene.x < view.x || scene.y < view.y || scene.x + scene.width > view.x + view.width || scene.y + scene.height > view.y + view.height) problems.push('clipped scene');
          return [...new Set(problems)];
        }''')
        self.assertEqual(problems, [])

    def test_reported_dfa_geometry_and_screenshot(self):
        self.prepare()
        expect(self.page.locator('.state')).to_have_count(8)
        self.assert_geometry()
        self.page.screenshot(path=str(OUTPUT / 'dfa-routing-fixed.png'))

    def test_geometry_in_all_machine_modes(self):
        for pattern in [PATTERN, '(a|b)*abb', 'ab|ac', '((a?)*)*', '[a-zA-Z0-9_]+', '(🙂|ğ)+']:
            for kind, minimize in [('dfa', True), ('dfa', False), ('nfa', False)]:
                with self.subTest(pattern=pattern, kind=kind, minimize=minimize):
                    self.prepare(pattern, kind, minimize)
                    self.assert_geometry()

    def test_routed_edges_animate_and_input_edits_keep_same_nodes(self):
        self.prepare()
        self.page.evaluate("window.keptNodes = [...document.querySelectorAll('.state')]")
        view = self.page.locator('#automaton').get_attribute('viewBox')
        self.page.locator('#speed').select_option('4')
        self.page.locator('#play').click()
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi', timeout=7000)
        self.page.locator('#sample-text').fill('abbb')
        self.assertTrue(self.page.evaluate("window.keptNodes.every((n,i)=>n===document.querySelectorAll('.state')[i])"))
        self.assertEqual(self.page.locator('#automaton').get_attribute('viewBox'), view)
        self.page.locator('#play').click()
        expect(self.page.locator('#step-title')).to_have_text('Kabul edildi', timeout=7000)
        self.page.locator('#sample-text').fill('babba')
        self.page.locator('#play').click()
        expect(self.page.locator('#step-title')).to_have_text('Reddedildi', timeout=7000)
        self.assert_geometry()

    def test_locale_switch_selection_zoom_fit_and_export(self):
        self.prepare()
        self.page.locator('.state[data-state="6"]').click()
        self.page.locator('[data-language=en]').click()
        expect(self.page.locator('#state-inspector')).to_contain_text('q₆')
        self.page.locator('#zoom-in').click()
        self.page.locator('#fit').click()
        self.assert_geometry()
        with self.page.expect_download() as event:
            self.page.locator('#export-svg').click()
        path = OUTPUT / 'dfa-routing-fixed.svg'
        event.value.save_as(str(path))
        svg = path.read_text(encoding='utf-8')
        self.assertIn('data-from="2" data-to="3"', svg)
        self.assertIn(' Q ', svg)
        self.assertNotIn('NaN', svg)
        self.assertNotIn('<script', svg)

    def test_mobile_fit_does_not_overflow_or_clip(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.prepare()
        self.assert_geometry()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        self.page.locator('#automaton').scroll_into_view_if_needed()
        self.page.screenshot(path=str(OUTPUT / 'dfa-routing-mobile.png'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
