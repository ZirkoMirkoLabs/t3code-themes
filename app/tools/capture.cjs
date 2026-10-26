// Renders playground screenshots of themes/skins. Needs `node tools/preview-server.mjs` running.
//   electron tools/capture.cjs [ids...] [--view welcome|chat] [--open] [--query 'prompt=view&launcher=1'] [--size 1440x900] [--wait 2600] [--out dir] [--motion still] [--thumbs]
// --thumbs also writes themes/<id>/thumb.jpg (640 px wide, Themes button hidden) used by the library cards and detail pane.
// Prints one JSON line per capture: id, file, engine state, scene status and any console errors.
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'); const path = require('node:path');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const flagVals = new Set(['--view', '--size', '--wait', '--out', '--motion', '--query'].map(n => opt(n, null)).filter(Boolean));
const ids = argv.filter(a => !a.startsWith('--') && !a.endsWith('.cjs') && a !== '.' && !flagVals.has(a));
const view = opt('--view', 'welcome'), open = argv.includes('--open'), wait = Number(opt('--wait', 2600)), motion = opt('--motion', 'live');
const [W, H] = opt('--size', '1440x900').split('x').map(Number);
const out = path.resolve(opt('--out', path.join(__dirname, '..', 'evidence', 'v3'))); fs.mkdirSync(out, { recursive: true });
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.whenReady().then(async () => {
  const base = 'http://127.0.0.1:43872';
  const list = ids.length ? ids : (await (await fetch(base + '/themes/index.json')).json()).items.map(s => s.id);
  const win = new BrowserWindow({ width: W, height: H, show: false, useContentSize: true, webPreferences: { backgroundThrottling: false } });
  const errors = [];
  win.webContents.on('console-message', (e, level, msg) => { const m = typeof e?.message === 'string' ? e.message : msg; const l = typeof e?.level === 'string' ? e.level : level; if (l === 'error' || l === 3 || /error/i.test(m)) errors.push(String(m).slice(0, 200)); });
  for (const id of list) {
    errors.length = 0;
    await win.loadURL(`${base}/preview/v3.html?theme=${encodeURIComponent(id)}&view=${view}&motion=${motion}${open ? '&open=1' : ''}${opt('--query', null) ? '&' + opt('--query', '') : ''}`);
    // Thumbnails: hide the Themes button before the scene settles (a hidden window may not repaint later).
    if (argv.includes('--thumbs')) await win.webContents.executeJavaScript("new Promise(r => { const t = setInterval(() => { const c = document.querySelector('.t3s-controls'); if (c) { c.style.display = 'none'; clearInterval(t); r(1); } }, 20); setTimeout(() => r(0), 3000); })");
    await new Promise(r => setTimeout(r, wait));
    const state = await win.webContents.executeJavaScript('window.T3Skin && T3Skin.getState()');
    const img = await win.webContents.capturePage();
    const file = path.join(out, `${id}-${view}${open ? '-gallery' : ''}${W < 800 ? '-phone' : ''}.png`);
    fs.writeFileSync(file, img.toPNG());
    if (argv.includes('--thumbs') && state && state.kind === 'theme') fs.writeFileSync(path.join(__dirname, '..', 'themes', id, 'thumb.jpg'), img.resize({ width: 640, quality: 'best' }).toJPEG(84));
    console.log(JSON.stringify({ id, file, kind: state && state.kind, mode: state && state.mode, fps: state && state.fps, cost: state && state.frameCost, scene: state && state.scene, zones: state && state.zones, welcome: state && state.welcome, errors: errors.slice(0, 5) }));
  }
  app.quit();
});
