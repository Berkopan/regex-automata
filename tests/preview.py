"""Opt-in live smoke check of the exact same-repository PR commit.
Invoked explicitly by CI, not by the offline browser suite.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

url = f"https://raw.githack.com/{os.environ['GITHUB_REPOSITORY']}/{os.environ['PREVIEW_SHA']}/index.html"
output = Path('test-results')
output.mkdir(exist_ok=True)
with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={'width': 1612, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    # Hosting-service consent only; does not bypass application authentication.
    page.context.add_cookies([{'name': '__Http-phish', 'value': '1', 'domain': 'raw.githack.com', 'path': '/', 'secure': True, 'httpOnly': True}])
    response = page.goto(url, wait_until='networkidle', timeout=90000)
    assert response.ok, f'Preview HTTP {response.status}'
    page.locator('#pattern').fill('((a|b)*abb)|(abb(a|b)*)')
    page.locator('#sample-text').fill('aabb')
    page.locator('#prepare').click()
    toggle = page.locator('#avoid-overlap')
    svg = page.locator('#automaton')
    expect(toggle).not_to_be_checked()
    expect(svg).to_have_attribute('data-layout', 'classic')
    expect(page.locator('.state')).to_have_count(8)
    path = page.locator('.transition[data-from="2"][data-to="3"] .edge-line')
    classic = path.get_attribute('d')
    assert ' Q ' not in classic
    page.screenshot(path=str(output/'live-layout-default.png'))
    toggle.check()
    expect(svg).to_have_attribute('data-layout', 'spaced')
    assert ' Q ' in path.get_attribute('d')
    page.screenshot(path=str(output/'live-layout-enabled.png'))
    page.locator('[data-language=en]').click()
    page.locator('#speed').select_option('4')
    page.locator('#play').click()
    expect(page.locator('#step-title')).to_have_text('Accepted', timeout=7000)
    step = page.locator('#seek').input_value()
    toggle.uncheck()
    expect(svg).to_have_attribute('data-layout', 'classic')
    assert path.get_attribute('d') == classic
    assert page.locator('#seek').input_value() == step
    expect(page.locator('#step-title')).to_have_text('Accepted')
    assert not errors, errors
    browser.close()
with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
    summary.write(f'## PR preview\n[Open the tested commit]({url})\n\nClassic default, opt-in routing, round trip and simulation verified. Served by raw.githack; main and GitHub Pages unchanged.\n')
