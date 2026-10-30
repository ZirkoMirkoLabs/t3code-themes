// Runtime guarantees, checked in a real Chromium (needs `node tools/preview-server.mjs`):
//   electron tools/test-runtime.cjs
// 1 endless-loop scene is killed, page stays responsive, still backdrop shown
// 2 too-heavy scene is degraded, then frozen to a still frame
// 3 a scene cannot reach the network or the T3 page even if the validator is bypassed
// 4 reduced motion -> still; 5 T3 markup change -> tokens-only mode; 6 theme switch leaves no stray sandboxes
'use strict';
// EPIPE-safe: a closed stdout (parent stopped) must not pop an Electron error dialog.
for (const s of [process.stdout, process.stderr]) s.on('error', () => {});
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), path = require('node:path');
const themes = path.join(__dirname, '..', 'themes');
const tmp = ['zz-test-hang', 'zz-test-heavy'];
function mk(id, scene) {
  fs.mkdirSync(path.join(themes, id), { recursive: true });
  fs.writeFileSync(path.join(themes, id, 'theme.json'), JSON.stringify({ name: id, palette: { bg: '#101018', accent: '#ff8800' }, scene: { file: 'scene.js' } }));
  fs.writeFileSync(path.join(themes, id, 'scene.js'), scene);
}
mk('zz-test-hang', 'T3Scene(function (api) { var c = api.canvas.getContext("2d"); return { frame: function (t) { if (t > 0.5) { for (;;) {} } c.fillRect(0, 0, 10, 10); } }; });');
mk('zz-test-heavy', 'T3Scene(function (api) { return { frame: function () { var e = performance.now() + 60; while (performance.now() < e) {} } }; });');
// Injected straight into the page (skipping the validator, which would reject it): the sandbox itself must contain it.
const ESCAPE = 'T3Scene(function (api) { var r = {}; r.doc = typeof document; r.parent = typeof parent; r.fetch = typeof self.fetch; r.xhr = typeof self.XMLHttpRequest; ' +
  'var res = "none"; try { importScripts("http://127.0.0.1:43872/runtime/engine.js"); res = "LOADED"; } catch (e) { res = "blocked"; } r.importScripts = res; throw new Error("probe " + JSON.stringify(r)); });';
const cleanTmp = () => { for (const id of tmp) try { fs.rmSync(path.join(themes, id), { recursive: true, force: true }); } catch {} };
process.on('exit', cleanTmp);
let failures = 0; const check = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false, webPreferences: { backgroundThrottling: false } });
  const js = e => win.webContents.executeJavaScript(e);
  const st = () => js('T3Skin.getState()');
  try {
    await win.loadURL('http://127.0.0.1:43872/preview/index.html?theme=zz-test-hang'); await wait(1500);
    const t0 = Date.now(); await js('1 + 1'); check(Date.now() - t0 < 500, 'page stays responsive while a scene loops forever');
    await wait(5500); let s = await st();
    const fb = await js("!document.querySelector('.t3s-fallback').hidden");
    check(s.scene && s.scene.status === 'error' && fb, 'endless loop: worker killed, still backdrop shown');
    console.log('     state:', JSON.stringify({ scene: s.scene, fallback: await js("!document.querySelector('.t3s-fallback').hidden") }));

    await win.loadURL('http://127.0.0.1:43872/preview/index.html?theme=zz-test-heavy'); await wait(9000); s = await st();
    check(s.scene && s.scene.status === 'slow', 'heavy scene: frozen to a still frame instead of slowing T3 (' + JSON.stringify(s.scene) + ')');

    await win.loadURL('http://127.0.0.1:43872/preview/index.html?theme=portal-lab'); await wait(1200);
    await js(`fetch('/themes/index.json').then(r => r.json()).then(j => { const it = JSON.parse(JSON.stringify(j.items.find(i => i.id === 'portal-lab'))); it.id = 'zz-escape'; it.code = { scene: ${JSON.stringify(ESCAPE)} }; T3Skin.addItems([it], 'zz-escape'); return 1; })`);
    await wait(2500); s = await st();
    const probe = s.scene && s.scene.msg || '';
    check(/"doc":"undefined"/.test(probe) && /"parent":"undefined"/.test(probe), 'scene has no document and no parent window (' + probe.slice(0, 120) + ')');
    check(/"fetch":"undefined"/.test(probe) && /"xhr":"undefined"/.test(probe) && /"importScripts":"blocked"/.test(probe), 'fetch / XHR removed and importScripts blocked by CSP');

    await win.loadURL('http://127.0.0.1:43872/preview/index.html?theme=portal-lab'); await wait(2000);
    const dbg = win.webContents.debugger; dbg.attach('1.3');
    await dbg.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await wait(1500);
    s = await st(); check(!s.running && (await js("document.documentElement.dataset.t3SkinMotion")) === 'still', 'reduced motion: scene stops on a still frame');
    await dbg.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }); dbg.detach();

    await js("document.querySelector(\"[data-slot='sidebar-wrapper']\").removeAttribute('data-slot'); 1"); await wait(5000); s = await st();
    check(s.mode === 'tokens' && (await js("getComputedStyle(document.querySelector('.t3s-backdrop')).display")) === 'none', 'T3 markup change: drops to tokens only (colours kept, no scene) — missing: ' + (s.health.missing || []).join(','));

    await win.loadURL('http://127.0.0.1:43872/preview/index.html?theme=meadow-breeze&welcome=1'); await wait(1500);
    for (const id of ['koi-pond', 'playground', 'rainy-cafe', 'portal-lab', 'meadow-breeze']) { await js(`T3Skin.setTheme('${id}'); 1`); await wait(700); }
    await wait(800);
    check((await js("document.querySelectorAll('iframe.t3s-sandbox').length")) === 2, 'after 5 theme switches: exactly one scene + one welcome sandbox remain');
    await js('T3Skin.destroy(); 1');
    check((await js("document.querySelectorAll('iframe.t3s-sandbox, .t3s-backdrop, .t3s-controls, style[data-t3-skin-owned]').length + (document.documentElement.hasAttribute('data-t3-skin') ? 1 : 0)")) === 0, 'Off/destroy removes every owned node and attribute');
  } catch (e) { console.log('  ✗ test crashed:', e.message); failures++; }
  for (const id of tmp) fs.rmSync(path.join(themes, id), { recursive: true, force: true });
  console.log(failures ? `\n${failures} FAILED` : '\nall runtime checks passed');
  app.exit(failures ? 1 : 0);
});
