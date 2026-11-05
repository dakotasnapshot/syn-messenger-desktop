#!/usr/bin/env python3
"""Guard shipped product branding without modifying licenses or wire/storage IDs."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'apps/web'
failures = []


def check_values(value, filename):
    if isinstance(value, dict):
        for child in value.values():
            check_values(child, filename)
    elif isinstance(value, list):
        for child in value:
            check_values(child, filename)
    elif isinstance(value, str) and re.search(r'\bElement\b', value):
        failures.append(f'{filename}: upstream product name in display value')


catalogs = list((WEB / 'src/i18n/strings').glob('*.json'))
for path in catalogs:
    check_values(json.loads(path.read_text()), path.relative_to(ROOT))
check_values(json.loads((WEB / 'res/manifest.json').read_text()), 'manifest.json')
for relative in ['src/vector/index.html', 'src/vector/mobile_guide/index.html']:
    text = (WEB / relative).read_text()
    if re.search(r'(?:>Element(?:\s|<)|alt="Element|content="Element|(?:apps\.apple\.com|play\.google\.com)/[^"\s]*element)', text):
        failures.append(f'{relative}: upstream product branding or app link')
for path in WEB.rglob('*'):
    if path.is_file() and path.name in {
        'element-logo.svg', 'element-desktop-logo.svg', 'element-shiny.svg', 'element-app-logo.png'
    } and 'node_modules' not in path.parts and 'webapp' not in path.parts:
        failures.append(f'{path.relative_to(ROOT)}: upstream product logo remains')
for path in [WEB / 'res/img/syndicate-logo.svg', WEB / 'src/vector/mobile_guide/assets/syndicate-logo.svg']:
    if not path.is_file():
        failures.append(f'{path.relative_to(ROOT)}: Syndicate logo missing')
if failures:
    raise SystemExit('\n'.join(failures))
print(f'PASS: {len(catalogs)} translation catalogs, page/manifest branding and source product-logo inventory')
