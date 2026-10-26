'use strict';
const { app, BrowserWindow, Menu, protocol, net, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { execFile, spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
// Only fixed milestone labels and this wrapper's PID are written. Never log
// arguments, URLs, exceptions, CLI output or renderer content here.
const profile = path.join(__dirname, '.profile');
function milestone(label) {
  try { fsSync.mkdirSync(profile, { recursive: true }); fsSync.appendFileSync(path.join(profile, 'boot.log'), `${new Date().toISOString()} pid=${process.pid} ${label}\n`); } catch {}
}
milestone('entry');
if (!app) { milestone('electron-node-mode'); process.exit(1); }
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const { findT3Installs, findServers } = require('./t3-detect.cjs');
const themeLib = require('./theme-library.cjs');
let t3Base = option('--t3-home', null);
let origin, serverVersion = '', environmentId = '';
function validateOrigin(value) {
  const supplied = new URL(value);
  if (supplied.username || supplied.password || supplied.search || supplied.hash || supplied.pathname !== '/') throw Error();
  if (!(supplied.protocol === 'https:' || (supplied.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(supplied.hostname)))) throw Error();
  return supplied.origin;
}
async function resolveOrigin() {
  const explicit = option('--origin', null);
  if (explicit) { if (!t3Base) t3Base = path.join(os.homedir(), '.t3'); return validateOrigin(explicit); }
  // Upstream serverRuntimeState.ts defines server-runtime.json as nonsecret address metadata.
  // Stable and nightly installs may use different data homes: take the newest one that answers.
  const live = await findServers(t3Base, validateOrigin);
  if (!live.length) throw Error('no server');
  t3Base = live[0].home; serverVersion = live[0].version;
  return live[0].origin;
}

app.setName('T3 Skins');
milestone('app-named');
fsSync.mkdirSync(path.join(profile, 'session'), { recursive: true });
app.setPath('userData', path.join(__dirname, '.profile'));
milestone('profile-set');
app.setPath('sessionData', path.join(__dirname, '.profile', 'session'));
milestone('session-path-set');
milestone('lock-request');
if (!app.requestSingleInstanceLock()) { milestone('lock-denied'); app.quit(); process.exit(0); }
milestone('lock-acquired');
protocol.registerSchemesAsPrivileged([{ scheme: 't3-skin', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
let window;
app.on('second-instance', () => { if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
let insertion;
let injectionVersion = 0;
let runtimeQueue = Promise.resolve();
const onOrigin = () => { try { return new URL(window.webContents.getURL()).origin === origin; } catch { return false; } };
function runtimeCall(expression, current = () => true) {
  // Keep teardown after any already-dispatched mount, and skip obsolete work
  // that was queued before Off or a new document/injection took over.
  runtimeQueue = runtimeQueue.catch(() => {}).then(() => {
    if (current() && window && !window.isDestroyed() && onOrigin()) return window.webContents.executeJavaScript('(function () {\n' + expression + '\n})()');
  });
  return runtimeQueue;
}
const skinsRoot = path.join(root, 'skins');
const settingsFile = path.join(profile, 'skin-settings.json');
function readSettings() { try { return JSON.parse(fsSync.readFileSync(settingsFile, 'utf8')); } catch { return {}; } }
function writeSettings(patch) { try { fsSync.writeFileSync(settingsFile, JSON.stringify({ ...readSettings(), ...patch }, null, 2)); } catch {} }
let skinEnabled = !args.includes('--no-skin') && readSettings().enabled !== false;
async function setSkinEnabled(enabled) {
  skinEnabled = Boolean(enabled);
  ++injectionVersion;
  writeSettings({ enabled: skinEnabled });
  buildMenu();
  if (skinEnabled) { offButton(false); return applySkin(); }
  // Capture and release ownership before awaiting, so a quick re-enable cannot
  // have its new stylesheet removed by this older disable operation.
  const key = insertion;
  insertion = undefined;
  const contents = window?.webContents;
  await Promise.all([
    runtimeCall('window.T3SpaceSkin?.destroy?.(); window.T3Skin?.destroy?.();').catch(() => {}),
    key && contents && !contents.isDestroyed() ? contents.removeInsertedCSS(key).catch(() => {}) : undefined,
  ]);
  offButton(true);
}
// While themes are off, keep a small "Themes" button on screen so they can always be turned back on.
function offButton(show) {
  const contents = window?.webContents;
  if (!contents || contents.isDestroyed()) return;
  const js = show
    ? `(function(){if(document.getElementById('t3s-off-btn'))return;const b=document.createElement('button');b.id='t3s-off-btn';b.textContent='Themes';b.title='Turn themes back on';b.style.cssText='position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:6px 12px;border-radius:8px;border:1px solid rgba(128,128,128,.4);background:rgba(30,30,36,.85);color:#fff;font:600 12px system-ui,sans-serif;cursor:pointer';b.onclick=()=>console.log('__t3skin-on');document.body.appendChild(b);})()`
    : `document.getElementById('t3s-off-btn')?.remove()`;
  contents.executeJavaScript(js).catch(() => {});
}
function loadSkins() {
  const out = [];
  for (const d of fsSync.readdirSync(skinsRoot, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    try { const m = JSON.parse(fsSync.readFileSync(path.join(skinsRoot, d.name, 'skin.json'), 'utf8')); if (m.palette && m.palette.bg && m.palette.accent) out.push({ ...require('./skin-ui.cjs').adaptSkin(m), id: d.name }); } catch {}
  }
  const order = ['deep-space', 'sakura-dusk', 'emerald-realm', 'neon-drive', 'abyss', 'orbit-art'];
  return out.sort((a, b) => ((order.indexOf(a.id) + 1) || 99) - ((order.indexOf(b.id) + 1) || 99) || a.id.localeCompare(b.id));
}
// Everything the gallery shows: code themes (validated) first, then v2 image/video skins.
function loadItems() {
  const { items, problems } = themeLib.loadAllThemes();
  if (problems.length) milestone('theme-problems=' + problems.length);
  let skins = []; try { skins = loadSkins().map(sk => ({ ...sk, kind: 'skin' })); } catch {}
  return items.concat(skins);
}
const themeModels = require('../studio/theme-models.cjs');
const ENGINE_IDS = themeModels.ENGINE_IDS;
// Generator prompt settings (Themes ▸ Generate ▸ Prompt). Only design text is stored here, never keys.
const TASTE_MAX = 12000, CUSTOM_MAX = 4000;
function genPromptSettings(raw) {
  const g = raw && typeof raw === 'object' ? raw : {};
  return { useTaste: g.useTaste !== false, taste: typeof g.taste === 'string' && g.taste.trim() ? g.taste.slice(0, TASTE_MAX) : null, custom: typeof g.custom === 'string' ? g.custom.slice(0, CUSTOM_MAX) : '' };
}
function promptInfo() {
  const read = f => { try { return fsSync.readFileSync(path.join(root, 'studio', f), 'utf8').replace(/\r\n?/g, '\n').trim(); } catch { return ''; } };
  const core = read('theme-master-prompt.md').replace('{{TEMPLATES}}', '(the template catalogue is inserted here)').replace('{{EXAMPLE}}', '(the Rainy Café theme.json and welcome.js are inserted here as a style reference)');
  return { core, tasteDefault: read('theme-design-taste.md'), ...genPromptSettings(readSettings().genPrompt), tasteMax: TASTE_MAX, customMax: CUSTOM_MAX };
}
function engines() {
  const key = !!(keys.env().ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY);
  return themeModels.generatorChoices(key);
}
async function inject() {
  if (!skinEnabled || !onOrigin()) return;
  const version = ++injectionVersion;
  const contents = window.webContents;
  const current = () => version === injectionVersion && skinEnabled && !contents.isDestroyed() && onOrigin();
  const [css, ...scripts] = await Promise.all(['engine.css', 'selectors.js', 'sandbox.js', 'engine.js'].map(f => fs.readFile(path.join(root, 'runtime', f), 'utf8')));
  if (!current()) return;
  const previous = insertion;
  insertion = undefined;
  if (previous) await contents.removeInsertedCSS(previous).catch(() => {});
  if (!current()) return;
  const key = await contents.insertCSS(css);
  if (!current()) { await contents.removeInsertedCSS(key).catch(() => {}); return; }
  insertion = key;
  await runtimeCall('window.T3SpaceSkin?.destroy?.(); window.T3Skin?.destroy?.(); delete window.T3Skin; delete window.T3SkinSandbox; delete window.T3SkinSelectors;', current);
  for (const js of scripts) { if (!current()) return; await runtimeCall(js, current); }
  if (!current()) return;
  const settings = readSettings();
  const mountOptions = { skinBase: 't3-skin://skins/', themeBase: 't3-skin://themes/', items: loadItems(), active: settings.skin || 'cozy-room', motion: settings.motion || 'live',
    intensity: settings.intensity ?? 100, launcher: true, engines: engines(), prompt: promptInfo(), favourites: Array.isArray(settings.favs) ? settings.favs : [], welcome: settings.welcome === true };
  await runtimeCall('window.T3Skin.mount(' + JSON.stringify(mountOptions) + ');', current);
  if (!current()) return;
  buildMenu();
  watchThemes();
  if (args.includes('--diagnostics')) setTimeout(async () => {
    if (!current()) return;
    try {
      const state = await window.webContents.executeJavaScript('window.T3Skin ? window.T3Skin.getState() : null');
      const image = await window.webContents.capturePage();
      const dir = path.join(root, 'evidence', 'v2'); await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'live-' + (state && state.skin || 'none') + '.png'), image.toPNG());
      await fs.writeFile(path.join(dir, 'live-state.json'), JSON.stringify(state, null, 2));
    } catch {}
  }, 4000);
}
async function applySkin() {
  const pending = inject();
  const version = injectionVersion;
  try { await pending; }
  catch {
    if (version === injectionVersion && skinEnabled && onOrigin()) dialog.showErrorBox('Skin could not load', 'Check that runtime/engine.css and runtime/engine.js exist. The real T3 client remains available. Use Skin > Reload skins after fixing the files.');
  }
}

// This optional command uses T3's supported pairing path. Raw output stays in memory.
// Never print errors/output: either could contain a live one-time credential.
async function pairingDestination() {
  // Prefer the install whose channel (stable/nightly) matches the running server.
  const installs = findT3Installs();
  const install = installs.find(i => (i.channel === 'nightly') === /nightly/i.test(serverVersion)) || installs[0];
  if (!install && !args.includes('--t3-command')) throw Error('T3 install not found');
  const command = option('--t3-command', install && install.command);
  const cliArgs = ['pair', '--label', 'Space Terminal'];
  const entrypoint = option('--t3-entrypoint', args.includes('--t3-command') ? null : install.entrypoint);
  if (entrypoint) cliArgs.unshift(entrypoint);
  const scopes = option('--scopes', null);
  if (scopes) for (const scope of scopes.split(',').map(s => s.trim()).filter(Boolean)) cliArgs.push('--scope', scope);
  cliArgs.push('--base-dir', t3Base);
  const env = { ...process.env, T3CODE_HOME: t3Base };
  if (args.includes('--t3-electron-node') || !args.includes('--t3-command')) env.ELECTRON_RUN_AS_NODE = '1';
  const output = await new Promise((resolve, reject) => {
    execFile(command, cliArgs, { env, windowsHide: true, timeout: 25000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) reject(Error('Pairing command failed. Use the normal T3 pairing screen or check the installed CLI path.'));
      else resolve(stdout);
    });
  });
  for (const candidate of output.match(/https?:\/\/[^\s<>"']+/g) || []) {
    try {
      const url = new URL(candidate.replace(/\x1b\[[0-9;]*m/g, ''));
      if (url.origin === origin && url.pathname === '/pair' && new URLSearchParams(url.hash.slice(1)).has('token')) return url.href;
    } catch {}
  }
  throw Error('The CLI did not return a pairing link for the selected origin. Use the official pairing screen.');
}

app.whenReady().then(async () => {
  milestone('app-ready');
  // Construct and explicitly show the window before any network or pairing
  // await. Hidden helper-process startup must not hide the interactive client.
  window = new BrowserWindow({
    width: 1512, height: 982, minWidth: 850, minHeight: 600,
    show: false, title: 'T3 Space Terminal', backgroundColor: '#071019',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  window.on('page-title-updated', event => event.preventDefault());
  window.on('closed', quitIfOnlyHelpers);
  window.show();
  window.focus();
  milestone('window-shown');
  try {
    origin = await resolveOrigin();
    milestone('origin-resolved');
    // Node fetch avoids Chromium network-service startup for this public probe.
    const response = await fetch(origin + '/.well-known/t3/environment', { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(5000) });
    const descriptor = await response.json();
    if (!response.ok || typeof descriptor.environmentId !== 'string' || typeof descriptor.serverVersion !== 'string') throw Error();
    environmentId = descriptor.environmentId;
    milestone('descriptor-ready');
  } catch {
    milestone('descriptor-failed');
    dialog.showErrorBox('T3 server not found', 'Keep the official app running. The launcher reads only its nonsecret server-runtime.json address metadata. For another server, pass a bare --origin URL.');
    app.quit(); return;
  }
  protocol.handle('t3-skin', async request => {
    try {
      const url = new URL(request.url);
      if (!['assets', 'skins', 'themes'].includes(url.hostname) || request.method !== 'GET') return new Response('', { status: 403 });
      const assetRoot = await fs.realpath(path.join(root, url.hostname));
      const file = await fs.realpath(path.resolve(assetRoot, '.' + decodeURIComponent(url.pathname)));
      const relative = path.relative(assetRoot, file);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !/\.(png|jpe?g|webp|gif|mp4|webm|woff2?|ttf|otf)$/i.test(file)) return new Response('', { status: 403 });
      return net.fetch(pathToFileURL(file).href, { headers: request.headers });
    } catch { return new Response('', { status: 404 }); }
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, destination) => {
    try { if (new URL(destination).origin !== origin) event.preventDefault(); } catch { event.preventDefault(); }
  });
  window.webContents.on('will-redirect', (event, destination) => {
    try { if (new URL(destination).origin !== origin) event.preventDefault(); } catch { event.preventDefault(); }
  });
  // Engine -> launcher channel: only fixed prefixes carrying UI state are accepted.
  window.webContents.on('console-message', (event, _level, legacyMessage) => {
    const message = typeof event?.message === 'string' ? event.message : String(legacyMessage || '');
    if (message === '__t3skin-off') void setSkinEnabled(false);
    else if (message === '__t3skin-on') void setSkinEnabled(true).then(() => window?.webContents?.executeJavaScript('window.T3Skin?.openGallery?.(true)').catch(() => {}));
    else if (message === '__t3skin-studio:open') openStudio();
    else if (message === '__t3skin-import') void importSkinDialog();
    else if (message.startsWith('__t3skin-export:')) void exportSkinDialog(message.slice(16));
    else if (message.startsWith('__t3skin-gen:')) { try { void generateTheme(JSON.parse(message.slice(13))); } catch {} }
    else if (message.startsWith('__t3skin-genprompt:')) { try { writeSettings({ genPrompt: genPromptSettings(JSON.parse(message.slice(19))) }); } catch {} }
    else if (message.startsWith('__t3skin-thread:')) { try { void startThemeThread(JSON.parse(message.slice(16))); } catch {} }
    else if (message.startsWith('__t3skin-welcome:')) writeSettings({ welcome: message.slice(17) === 'on' });
    else if (message.startsWith('__t3skin-discard:')) void discardTheme(message.slice(17));
    else if (message.startsWith('__t3skin-fav:')) { try { const f = JSON.parse(message.slice(13)); if (Array.isArray(f)) writeSettings({ favs: f.map(String).slice(0, 200) }); } catch {} }
    else if (message.startsWith('__t3skin-scene:')) { try { void sceneFailed(JSON.parse(message.slice(15))); } catch {} }
    else if (message.startsWith('__t3skin:')) {
      try { const st = JSON.parse(message.slice(9)); writeSettings({ skin: String(st.skin || ''), motion: String(st.motion || 'live'), intensity: Number(st.intensity) }); buildMenu(); void syncStudioTheme(); } catch {}
    }
  });
  window.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) { ++injectionVersion; insertion = undefined; }
  });
  window.webContents.on('destroyed', () => { ++injectionVersion; insertion = undefined; });
  window.webContents.on('dom-ready', () => { milestone('dom-ready'); insertion = undefined; if (skinEnabled) void applySkin(); else offButton(true); });
  window.webContents.on('did-finish-load', () => milestone('load-finished'));
  buildMenu();
  let destination = origin;
  if (args.includes('--pair')) {
    try {
      milestone('session-check');
      const response = await window.webContents.session.fetch(origin + '/api/auth/session', { credentials: 'include', redirect: 'error', signal: AbortSignal.timeout(5000) });
      const state = response.ok ? await response.json() : null;
      if (state?.authenticated !== true) { milestone('pairing-start'); destination = await pairingDestination(); milestone('pairing-ready'); }
    }
    catch { milestone('pairing-failed'); dialog.showErrorBox('Pairing needed', 'Open the official pairing screen or check the installed CLI path.'); }
  }
  try { milestone('navigation-start'); await window.loadURL(destination); window.show(); milestone('navigation-ready'); }
  catch { milestone('navigation-failed'); dialog.showErrorBox('T3 is unavailable', 'Keep the official T3 app running and check the --origin port. This launcher never starts a T3 server.'); }
}).catch(() => { milestone('startup-failed'); dialog.showErrorBox('Launcher failed', 'The isolated launcher could not initialize. The official T3 app was not modified.'); app.quit(); });
function buildMenu() {
  const settings = readSettings(); let items = []; try { items = loadItems(); } catch {}
  const call = expr => () => void runtimeCall(expr);
  const active = settings.skin || 'cozy-room';
  const pick = it => ({ label: (it.kind === 'theme' ? it.theme.name : (it.name || it.id)), type: 'radio', checked: active === it.id, click: call('window.T3Skin?.setTheme?.(' + JSON.stringify(it.id) + ')') });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Skin', submenu: [
      { label: 'Theme library…', accelerator: 'CmdOrCtrl+Shift+L', click: call('window.T3Skin?.openGallery?.(true)') },
      { label: 'Themes (code)', submenu: items.filter(i => i.kind === 'theme').map(pick) },
      { label: 'Image & video skins', submenu: items.filter(i => i.kind !== 'theme').map(pick) },
      { type: 'separator' },
      ...['live', 'calm', 'still'].map(m => ({ label: 'Motion: ' + m, type: 'radio', checked: (settings.motion || 'live') === m, click: call('window.T3Skin?.setMotion?.(' + JSON.stringify(m) + ')') })),
      { label: 'Focus mode', type: 'checkbox', click: item => void runtimeCall('window.T3Skin?.setFocus?.(' + item.checked + ')') },
      { type: 'separator' },
      { label: 'Skin Studio…', accelerator: 'CmdOrCtrl+Shift+K', click: () => openStudio() },
      { label: 'Studio providers & API keys…', click: () => openStudio('providers') },
      { label: 'Export current theme (.t3skin)…', click: () => void exportSkinDialog(readSettings().skin) },
      { label: 'Import skin (.t3skin)…', click: () => void importSkinDialog() },
      { label: 'Open themes folder', click: () => void shell.openPath(themeLib.themesRoot) },
      { label: 'Open skins folder', click: () => void shell.openPath(skinsRoot) },
      { label: 'Reload skins', accelerator: 'CmdOrCtrl+Shift+R', click: () => void applySkin() },
      { label: 'Enable skin', type: 'checkbox', checked: skinEnabled, click: item => void setSkinEnabled(item.checked) },
      { type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }, { role: 'quit' },
    ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
  ]));
}

/* ---------- Skin Studio window: runs studio/skin-studio.mjs under a hard time/spend cap ---------- */
const { createKeystore, redact } = require('./keystore.cjs');
const { exportSkin, importSkin, exportTheme, importTheme, isThemePack } = require('./skinpack.cjs');
const keys = createKeystore(profile);
let providersMod, studioEstimator;
const providers = () => providersMod || (providersMod = import(pathToFileURL(path.join(root, 'studio', 'providers.mjs')).href));
let studioWindow, studioChild;
const childEnv = (extra = {}) => ({ ...process.env, ...keys.env(), ...extra, ELECTRON_RUN_AS_NODE: '1', SKIN_STUDIO_NODE: process.execPath });
function openStudio(tab) {
  if (studioWindow && !studioWindow.isDestroyed()) { studioWindow.show(); studioWindow.focus(); if (tab) studioSend({ type: 'tab', tab }); void syncStudioTheme(); return; }
  studioWindow = new BrowserWindow({ width: 1140, height: 800, minWidth: 720, minHeight: 560, title: 'Skin Studio', backgroundColor: '#0b0a14', autoHideMenuBar: true,
    webPreferences: { preload: path.join(root, 'studio', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  studioWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  studioWindow.webContents.on('will-navigate', e => e.preventDefault());
  studioWindow.webContents.on('did-finish-load', () => void syncStudioTheme());
  studioWindow.on('closed', quitIfOnlyHelpers);
  studioWindow.loadFile(path.join(root, 'studio', 'studio.html'), tab ? { hash: tab } : undefined);
}
const studioSend = ev => { if (studioWindow && !studioWindow.isDestroyed()) studioWindow.webContents.send('studio:event', ev); };
const fromStudio = e => !!studioWindow && !studioWindow.isDestroyed() && e.sender === studioWindow.webContents;
async function currentUiTheme() { try { return await runtimeCall('return window.T3Skin?.getUiTheme?.() || null;'); } catch { return null; } }
async function syncStudioTheme() {
  if (!studioWindow || studioWindow.isDestroyed()) return;
  const theme = await currentUiTheme();
  if (theme) studioSend({ type: 'theme', theme });
}

// Hidden canvas renderer for palette/thumbnail/poster (replaces Python+Pillow).
let analyzerWin, analyzerReady, analyzeSeq = 0; const analyzeJobs = new Map();
function analyzer() {
  if (analyzerReady) return analyzerReady;
  analyzerWin = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { preload: path.join(root, 'studio', 'analyze-preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  analyzerWin.on('closed', () => { analyzerReady = null; analyzerWin = null; });
  analyzerReady = analyzerWin.loadFile(path.join(root, 'studio', 'analyze.html')).then(() => analyzerWin);
  return analyzerReady;
}
ipcMain.on('analyze:done', (e, id, result) => { if (analyzerWin && e.sender === analyzerWin.webContents && analyzeJobs.has(id)) { analyzeJobs.get(id)(result); analyzeJobs.delete(id); } });
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/mp4', '.m4v': 'video/mp4', '.mkv': 'video/webm' };
async function analyzeFile(file, poster, posterWidth) {
  const win = await analyzer();
  const bytes = await fs.readFile(file);
  const id = ++analyzeSeq;
  return new Promise((ok, no) => {
    const t = setTimeout(() => { analyzeJobs.delete(id); no(Error('analysis timed out')); }, 40000);
    analyzeJobs.set(id, r => { clearTimeout(t); r && r.error ? no(Error(r.error)) : ok(r); });
    win.webContents.send('analyze:job', { id, bytes, mime: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', poster: !!poster, posterWidth: Math.min(1920, Math.max(256, Number(posterWidth) || 1920)) });
  });
}
// The CLI asks for analysis on its stdout; results go back on stdin. Files are only written inside skins/<id>/.
async function answerAnalyze(child, ev) {
  let reply;
  try {
    const file = path.resolve(String(ev.file || ''));
    const dir = path.dirname(file);
    if (path.dirname(dir) !== skinsRoot) throw Error('analysis path outside skins/');
    const r = await analyzeFile(file, ev.poster, ev.posterWidth);
    const posterName = /^[w-]{1,40}.jpg$/.test(String(ev.posterName || '')) && ev.posterName !== 'thumb.jpg' ? ev.posterName : 'poster.jpg';
    if (!ev.noThumb) await fs.writeFile(path.join(dir, 'thumb.jpg'), Buffer.from(r.thumb));
    if (r.poster) await fs.writeFile(path.join(dir, posterName), Buffer.from(r.poster));
    reply = { palette: r.palette, thumb: ev.noThumb ? null : 'thumb.jpg', poster: r.poster ? posterName : null, width: r.width, height: r.height, duration: r.duration };
  } catch (e) { reply = { error: String(e.message || e).slice(0, 200) }; }
  if (child && child.stdin.writable) child.stdin.write(`analysis ${Number(ev.req)} ${JSON.stringify(reply)}\n`);
}

function spawnStudio(cliArgs, onEvent, onExit) {
  const secrets = keys.secrets();
  const child = spawn(process.execPath, [path.join(root, 'studio', 'skin-studio.mjs'), '--events', ...cliArgs], { env: childEnv(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '';
  child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1);
    let ev; try { ev = JSON.parse(redact(l, secrets)); } catch { continue; }
    if (ev.type === 'analyze') void answerAnalyze(child, ev); else onEvent(ev); } });
  child.stderr.on('data', d => onEvent({ type: 'stderr', msg: redact(String(d), secrets).slice(0, 500) }));
  child.stdin.on('error', () => {});
  let ended = false;
  const finish = code => { if (!ended) { ended = true; if (onExit) onExit(code); } };
  child.on('error', () => { onEvent({ type: 'error', msg: 'The Studio process could not start.' }); finish(1); });
  child.on('close', finish);
  return child;
}

ipcMain.handle('studio:info', async e => {
  if (!fromStudio(e)) return null;
  const P = await providers();
  const env = childEnv();
  const routes = list => Promise.all(Object.values(list).map(async r => ({ id: r.id, label: r.label, account: r.account, status: r.status, time: r.time, costHint: r.costHint, defaultModel: r.defaultModel || '', models: r.models || [], ready: await Promise.resolve(r.available(env)).catch(() => false), setup: r.setup })));
  const st = readSettings().studio || {};
  return { theme: await currentUiTheme(), image: await routes(P.IMAGE), video: await routes(P.VIDEO), accounts: P.ACCOUNTS.map(a => a.kind === 'cli' ? { ...a, cliFound: !!P.findHiggsfieldCli(env) } : a), keys: keys.summary(), secure: keys.available(), local: await P.detectLocal(env).catch(() => ({})), last: st.last || {}, tests: st.tests || {} };
});
ipcMain.handle('studio:set-key', async (e, id, value) => {
  if (!fromStudio(e)) return { error: 'denied' };
  try { keys.set(String(id), value); studioEstimator?.invalidate(); return { ok: true, keys: keys.summary() }; } catch (err) { return { error: err.message }; }
});
// Tests a key typed in the box (not yet saved) or the saved one. Free endpoints only; the key never comes back.
ipcMain.handle('studio:test-key', async (e, id, typed) => {
  if (!fromStudio(e)) return { error: 'denied' };
  const P = await providers();
  const acct = P.ACCOUNTS.find(a => a.id === id); if (!acct) return { error: 'unknown provider' };
  typed = typed ? String(typed).trim() : '';
  const env = childEnv(typed && acct.env ? { [acct.env]: typed } : {});
  const secrets = [...keys.secrets(), typed].filter(v => v && v.length >= 6);
  let out;
  try { const r = await P.testAccount(id, env); out = { ok: !!r.ok, msg: redact(r.msg || '', secrets).slice(0, 300) }; }
  catch (err) { out = { ok: false, msg: redact(err.message, secrets).slice(0, 200) }; }
  const st = readSettings().studio || {};
  writeSettings({ studio: { ...st, tests: { ...(st.tests || {}), [id]: { ...out, at: new Date().toISOString() } } } });
  studioEstimator?.invalidate();
  return out;
});
ipcMain.handle('studio:higgsfield-login', async e => {
  if (!fromStudio(e)) return { error: 'denied' };
  try {
    const P = await providers();
    const invocation = P.higgsfieldCommand(childEnv(), process.execPath);
    await new Promise((resolve, reject) => {
      const child = spawn(invocation.command, [...invocation.args, 'auth', 'login'], { env: invocation.env, windowsHide: true, shell: false, stdio: 'ignore' });
      child.once('error', reject);
      child.once('spawn', () => { child.unref(); resolve(); });
    });
    studioEstimator?.invalidate();
    return { ok: true };
  } catch { return { error: 'Higgsfield login could not start. Check that the CLI is installed correctly.' }; }
});
ipcMain.handle('studio:open-link', (e, url) => { if (fromStudio(e) && /^https:\/\/[\w.-]+\//.test(String(url))) void shell.openExternal(String(url)); });
ipcMain.handle('studio:pick-file', async (e, kind) => {
  if (!fromStudio(e)) return null;
  const filters = kind === 'video' ? [{ name: 'Video or GIF', extensions: ['mp4', 'webm', 'gif', 'mov', 'm4v', 'mkv'] }] : [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }];
  const r = await dialog.showOpenDialog(studioWindow, { properties: ['openFile'], filters });
  return r.canceled ? null : r.filePaths[0];
});
const str = v => String(v ?? '').slice(0, 2000);
const safeTime = t => /^\d+(s|m)$/.test(t) ? t : '5m';
function studioArgs(o) {
  const a = [];
  if (o.resume) a.push('--resume', path.join(skinsRoot, path.basename(str(o.resume))));
  else {
    a.push('--name', str(o.name) || 'My Skin', '--provider', o.source === 'ai' ? (str(o.provider) || 'auto') : 'none', '--overwrite');
    if (o.describe) a.push('--describe', str(o.describe));
    if (o.image && ['ai', 'image'].includes(o.source)) a.push('--image', str(o.image));
    if (o.videoFile && o.source === 'video') a.push('--video-file', str(o.videoFile));
    if (o.model && o.source === 'ai') a.push('--model', str(o.model));
    if (o.cmd && o.source === 'ai') a.push('--cmd', str(o.cmd));
  }
  a.push('--time', safeTime(o.time), '--max-credits', String(Math.max(0, Number(o.credits) || 0)), '--max-usd', String(Math.max(0, Number(o.usd) || 0)));
  if (o.video && (o.source === 'ai' || o.resume)) { a.push('--video', '--video-provider', str(o.videoProvider) || 'higgsfield'); if (o.videoModel) a.push('--video-model', str(o.videoModel)); }
  return a;
}
ipcMain.handle('studio:estimate', async (e, o) => {
  if (!fromStudio(e)) return null;
  try {
    const P = await providers();
    studioEstimator ||= P.createStudioEstimator();
    return await studioEstimator.estimate(o || {}, childEnv());
  } catch { return { error: 'Could not calculate this estimate. Check the selected provider and model.' }; }
});
ipcMain.handle('studio:run', (e, o) => {
  if (!fromStudio(e)) return { error: 'denied' };
  if (studioChild) return { error: 'A run is already in progress.' };
  o = o || {};
  const st = readSettings().studio || {};
  if (!o.resume) writeSettings({ studio: { ...st, last: { source: o.source, provider: o.provider, videoProvider: o.videoProvider, time: o.time, credits: o.credits, usd: o.usd } } });
  studioChild = spawnStudio(studioArgs(o), studioSend, () => { studioChild = null; studioSend({ type: 'exit' }); buildMenu(); });
  return { ok: true };
});
ipcMain.handle('studio:finish-now', e => { if (fromStudio(e) && studioChild) studioChild.stdin.write('stop\n'); });
ipcMain.handle('studio:apply', async (e, id) => {
  if (!fromStudio(e)) return;
  writeSettings({ skin: path.basename(String(id)) });
  await applySkin();
  if (window && !window.isDestroyed()) window.focus();
});
ipcMain.handle('studio:open-folder', (e, id) => { if (fromStudio(e)) void shell.openPath(path.join(skinsRoot, path.basename(String(id || '')))); });

/* ---------- .t3skin export / import (Skins panel + Skin menu) ---------- */
async function exportSkinDialog(id) {
  id = path.basename(String(id || readSettings().skin || ''));
  const themeDir = path.join(themeLib.themesRoot, id), isTheme = !!id && fsSync.existsSync(path.join(themeDir, 'theme.json'));
  const dir = isTheme ? themeDir : path.join(skinsRoot, id);
  if (!id || (!isTheme && !fsSync.existsSync(path.join(dir, 'skin.json')))) return;
  const r = await dialog.showSaveDialog(window, { title: 'Export skin', defaultPath: path.join(app.getPath('downloads'), id + '.t3skin'), filters: [{ name: 'T3 skin', extensions: ['t3skin'] }] });
  if (r.canceled || !r.filePath) return;
  try { await fs.writeFile(r.filePath, isTheme ? exportTheme(dir) : exportSkin(dir)); shell.showItemInFolder(r.filePath); }
  catch (err) { dialog.showErrorBox('Export failed', String(err.message || err)); }
}
async function importSkinDialog() {
  const r = await dialog.showOpenDialog(window, { title: 'Import skin', properties: ['openFile'], filters: [{ name: 'T3 skin', extensions: ['t3skin', 'zip'] }] });
  if (r.canceled || !r.filePaths[0]) return;
  try {
    const stat = await fs.stat(r.filePaths[0]); if (stat.size > 300 << 20) throw Error('That file is larger than 300 MB.');
    const buf = await fs.readFile(r.filePaths[0]);
    const { id, name } = isThemePack(buf) ? importTheme(buf, themeLib.themesRoot) : importSkin(buf, skinsRoot);
    writeSettings({ skin: id }); await applySkin(); buildMenu();
    dialog.showMessageBox(window, { type: 'info', message: `Imported "${name}"`, detail: 'It is now in the Skins panel and active.' });
  } catch (err) { dialog.showErrorBox('Import failed', String(err.message || err)); }
}
/* ---------- Theme generator (Themes ▸ Generate from a prompt) ---------- */
let genChild = null;
const paidConfirmed = new Set();
const pageEvent = ev => void runtimeCall('window.T3Skin && window.T3Skin._event(' + JSON.stringify(ev) + ')');
async function generateTheme(req) {
  if (genChild) return pageEvent({ type: 'gen', phase: 'error', msg: 'A theme is already being generated.' });
  const engine = ENGINE_IDS.includes(req.engine) ? req.engine : 'offline';
  let model;
  try { model = themeModels.selectedModel(engine, req.model); }
  catch (e) { return pageEvent({ type: 'gen', phase: 'error', msg: e.message }); }
  const maxUsd = Math.max(0.1, Math.min(5, Number(readSettings().genMaxUsd) || 1));
  // No spending without saying so first: paid engines ask once (per launch, if the user ticks the box).
  const consentKey = engine + ':' + model;
  if (engine !== 'offline' && !paidConfirmed.has(consentKey)) {
    const how = engine.endsWith('-cli') ? `This runs ${model} through ${engine === 'codex-cli' ? 'Codex' : 'Claude Code'} CLI using its configured account. Subscription limits, extra usage or API charges depend on that login. ` +
      (engine === 'codex-cli' ? 'Codex CLI cannot enforce a dollar cap; the five-minute time limit applies.' : `The requested run budget is $${maxUsd.toFixed(2)}.`)
      : `This sends your idea to ${model} through the Anthropic API with your key. The run budget is $${maxUsd.toFixed(2)}.`;
    const r = await dialog.showMessageBox(window, { type: 'question', buttons: ['Generate', 'Cancel'], defaultId: 0, cancelId: 1, title: 'Generate with ' + model + '?',
      message: 'Generate this theme with ' + model + '?', detail: how + ' Receipts are saved with the theme. Local templates are free.', checkboxLabel: 'Do not ask again for this model until I restart', checkboxChecked: false });
    if (r.response !== 0) return pageEvent({ type: 'gen', phase: 'error', msg: 'Cancelled. Nothing was sent or spent.' });
    if (r.checkboxChecked) paidConfirmed.add(consentKey);
  }
  // Hybrid background: paid image (and video) jobs run through skin-studio with a credit cap; always confirmed.
  const backdrop = ['image', 'video'].includes(req.backdrop) && !req.tweakOf ? req.backdrop : 'none';
  const maxCredits = backdrop === 'video' ? 14 : 6;
  if (backdrop !== 'none') {
    const r = await dialog.showMessageBox(window, { type: 'question', buttons: ['Paint it', 'Cancel'], defaultId: 0, cancelId: 1, title: 'Paint an AI background?',
      message: backdrop === 'video' ? 'Paint an AI picture and animate it into a video loop?' : 'Paint an AI picture for the background?',
      detail: `Your image provider from Providers & keys (Higgsfield first) makes the picture${backdrop === 'video' ? ' and a 5-second loop' : ''}. Spend cap: ${maxCredits} credits (or the matching $ cap on money-billed providers). Receipts are saved in the theme's media folder; an uncertain job is never resubmitted.` });
    if (r.response !== 0) return pageEvent({ type: 'gen', phase: 'error', msg: 'Cancelled. Nothing was sent or spent.' });
  }
  const a = [path.join(root, 'studio', 'theme-gen.mjs'), '--events', '--engine', engine, '--max-usd', String(maxUsd), '--time', backdrop === 'video' ? '15m' : '10m',
    '--appearance', ['light', 'dark'].includes(req.appearance) ? req.appearance : 'any', '--motion', ['live', 'calm', 'still'].includes(req.motion) ? req.motion : 'live'];
  if (model) a.push('--model', model);
  if (req.prompt) a.push('--prompt', String(req.prompt).slice(0, 400));
  if (req.interactive) a.push('--interactive');
  if (backdrop !== 'none') a.push('--backdrop', 'auto', '--max-credits', String(maxCredits), ...(backdrop === 'video' ? ['--backdrop-video'] : []));
  if (req.tweakOf && req.tweak) a.push('--tweak-of', path.basename(String(req.tweakOf)), '--tweak', String(req.tweak).slice(0, 200));
  // Design guidance travels in files (no command-line length limits); theme-gen always adds the core contract first.
  const guide = genPromptSettings(req.guidance || readSettings().genPrompt);
  writeSettings({ genPrompt: guide });
  if (engine !== 'offline') {
    if (!guide.useTaste) a.push('--no-taste');
    else if (guide.taste) { const f = path.join(profile, 'gen-taste.txt'); fsSync.writeFileSync(f, guide.taste); a.push('--taste-file', f); }
    if (guide.custom.trim()) { const f = path.join(profile, 'gen-custom.txt'); fsSync.writeFileSync(f, guide.custom); a.push('--custom-file', f); }
  }
  const secrets = keys.secrets();
  pageEvent({ type: 'gen', phase: 'progress', msg: engine === 'offline' ? 'Composing from the template library…' : 'Starting ' + engine + '…' });
  genChild = spawn(process.execPath, a, { env: childEnv(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let buf = '', finished = false;
  genChild.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      let ev; try { ev = JSON.parse(redact(line, secrets)); } catch { continue; }
      if (ev.type === 'progress') pageEvent({ type: 'gen', phase: 'progress', msg: ev.msg });
      else if (ev.type === 'error') { finished = true; pageEvent({ type: 'gen', phase: 'error', msg: ev.msg }); }
      else if (ev.type === 'done') {
        finished = true;
        const r = themeLib.toItem(path.join(themeLib.themesRoot, path.basename(String(ev.id))));
        if (!r.item) { pageEvent({ type: 'gen', phase: 'error', msg: r.error || 'theme did not load' }); continue; }
        writeSettings({ skin: r.item.id });
        const cost = ev.usd != null ? ` · about $${Number(ev.usd).toFixed(3)}` : '';
        pageEvent({ type: 'gen', phase: 'done', item: r.item, report: { ...r.item.report, engineNote: ev.note }, msg: `Made “${r.item.theme.name}”${cost}.` });
        buildMenu();
        setTimeout(() => void captureThumb(r.item.id), 4500);
      }
    }
  });
  genChild.stderr.on('data', d => milestone('gen-stderr ' + redact(String(d), secrets).replace(/\s+/g, ' ').slice(0, 160)));
  genChild.on('exit', () => { genChild = null; if (!finished) pageEvent({ type: 'gen', phase: 'error', msg: 'The generator stopped unexpectedly.' }); });
}
/* ---------- Open in T3 thread (Themes ▸ Create) ---------- */
// Starts a new chat with T3's own CLI (`t3 thread start`) in the project that contains this folder. The brief
// (idea, files to read, the full generator prompt, how to validate) goes in on stdin; the agent starts at once.
let threadBusy = false;
function t3Cli() {
  const installs = findT3Installs();
  const install = installs.find(i => (i.channel === 'nightly') === /nightly/i.test(serverVersion)) || installs[0];
  const command = option('--t3-command', install && install.command);
  if (!command) throw Error('T3 Code install not found.');
  const entrypoint = option('--t3-entrypoint', args.includes('--t3-command') ? null : install && install.entrypoint);
  const env = { ...process.env, T3CODE_HOME: t3Base };
  if (args.includes('--t3-electron-node') || !args.includes('--t3-command')) env.ELECTRON_RUN_AS_NODE = '1';
  return { command, pre: entrypoint ? [entrypoint] : [], env };
}
function runT3(cliArgs, input) {
  const c = t3Cli();
  return new Promise((resolve, reject) => {
    const child = execFile(c.command, [...c.pre, ...cliArgs], { env: c.env, cwd: root, windowsHide: true, timeout: 45000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(Error(String(stderr || error.message).replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim().slice(0, 240) || 'T3 CLI failed'));
      else resolve(String(stdout));
    });
    child.stdin.end(input == null ? '' : input);
  });
}
async function themeBrief(req) {
  const idea = String(req.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!idea) throw Error('Describe the theme first.');
  const guide = genPromptSettings(req.guidance || readSettings().genPrompt);
  const gen = await import(pathToFileURL(path.join(root, 'studio', 'theme-gen.mjs')).href);
  const dir = path.join(root, 'studio', 'thread-briefs'); await fs.mkdir(dir, { recursive: true });
  const slug = idea.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'theme';
  const base = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '-' + slug;
  const promptRel = 'studio/thread-briefs/' + base + '-prompt.md', replyRel = 'studio/thread-briefs/' + base + '-reply.json';
  await fs.writeFile(path.join(root, promptRel), gen.promptParts(guide).parts.join('\n\n') + '\n');
  const appearance = ['light', 'dark'].includes(req.appearance) ? req.appearance : 'any';
  const motion = ['live', 'calm', 'still'].includes(req.motion) ? req.motion : 'live';
  const backdrop = ['image', 'video'].includes(req.backdrop) ? req.backdrop : 'none';
  const quoted = '"' + idea.replace(/["\\$`]/g, '') + '"';
  const cmd = `node studio/theme-gen.mjs --engine claude-cli --reply-file ${replyRel} --prompt ${quoted} --appearance ${appearance} --motion ${motion}${req.interactive ? ' --interactive' : ''}`;
  const lines = [
    `Make a new T3 Skins theme: "${idea}"`,
    '',
    `T3 Skins (this folder: ${root}) is the Electron launcher that skins T3 Code with live themes. Work inside a new themes/<id>/ folder only; do not change the runtime, the launcher or other themes.`,
    '',
    '## Request',
    `- Idea: ${idea}`,
    `- Look: ${appearance === 'any' ? 'whatever suits the idea (light or dark)' : appearance}`,
    `- Motion: ${{ live: 'lively', calm: 'calm and slow', still: 'almost still' }[motion]}`,
    `- Interactive (reacts to the pointer): ${req.interactive ? 'yes' : 'optional'}`,
    `- Background: ${backdrop === 'none' ? 'code only' : backdrop === 'image' ? 'AI picture + code (hybrid mode)' : 'AI picture + video loop + code (hybrid mode)'}`,
    '',
    '## Read first',
    `1. \`${promptRel}\`: the full generator prompt for this request. It holds the core contract (theme.json fields, the scene/welcome runtime API, safe zones, budget, banned APIs), the template catalogue, a format example and the design guidance${guide.custom.trim() ? ", plus the user's own instructions" : ''}${guide.useTaste ? '' : ' (design guidance is switched off)'}. The core contract wins on any conflict.`,
    '2. README.md, section "Themes (v3)".',
    '3. References: themes/cozy-room/ (code only, with a companion layer), themes/koi-pond/ (code only, interactive), runtime/templates/.',
    '',
    '## Make it',
    `Write your reply exactly as the prompt's "Output" section describes (one JSON object) to \`${replyRel}\`, then run:`,
    '',
    '    ' + cmd,
    '',
    'This replays your reply through the same parser, validator and contrast repair as in-app generation and writes themes/<id>/ with REPORT.md. It spends nothing.',
    backdrop === 'none' ? '' : `The background picture${backdrop === 'video' ? ' and video loop' : ''} costs image credits. Ask the user before adding \`--backdrop auto --max-credits ${backdrop === 'video' ? '14 --backdrop-video' : '6'}\` to that command.`,
    'After that, editing themes/<id>/theme.json, scene.js and welcome.js by hand is fine.',
    '',
    '## Validate',
    '- `node tools/test-themes.cjs` passes.',
    "- The pack loads cleanly: `node -e \"const r=require('./launcher/theme-library.cjs').toItem('themes/<id>');console.log(r.error||r.report.warnings)\"`",
    '- Thumbnail: start `node tools/preview-server.mjs` in the background, then run `electron tools/capture.cjs <id> --thumbs` (clear ELECTRON_RUN_AS_NODE first). Open evidence/v3/<id>-welcome.png and fix what you see: text readability, busy areas behind the composer, contrast.',
    '- The T3 Skins library picks up the new folder by itself (Themes ▸ Library ▸ Yours).',
    '',
    '## Then',
    'Summarise the theme in a few lines and give its id. The user will ask for tweaks here ("calmer", "more green"): edit the files in place and re-run the checks.',
  ];
  const text = lines.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  return { idea, title: 'Theme: ' + idea.slice(0, 60), text };
}
function threadIdFrom(out) {
  try {
    const j = JSON.parse(out);
    const id = j.threadId || j.id || (j.thread && (j.thread.id || j.thread.threadId));
    if (typeof id === 'string') return id;
  } catch {}
  const m = /\b((?:[a-z]+:)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i.exec(out);
  return m ? m[1] : '';
}
async function startThemeThread(req) {
  const ev = o => pageEvent({ type: 'thread', ...o });
  if (threadBusy) return ev({ phase: 'error', msg: 'A thread is already being started.' });
  threadBusy = true;
  try {
    const brief = await themeBrief(req || {});
    // The page asks for confirmation inline before sending this message (Themes > Create).
    // The thread runs on the Claude or Codex model chosen in the form; other engines fall back to the Opus default.
    const engine = ENGINE_IDS.includes(req && req.engine) ? req.engine : 'offline';
    let model = ''; try { model = engine === 'codex-cli' || engine.startsWith('claude') ? themeModels.selectedModel(engine, req.model) : ''; } catch {}
    const pick = /^gpt-/.test(model) ? ['codex', model] : ['claudeAgent', /^claude-/.test(model) ? model : themeModels.FAMILY_DEFAULT.opus];
    const out = await runT3(['thread', 'start', '--base-dir', t3Base, '--title', brief.title, '--provider', pick[0], '--model', pick[1], '--json', root, '-'], brief.text);
    const id = threadIdFrom(out);
    if (!id) throw Error('T3 did not report a thread id.');
    milestone('thread-started');
    ev({ phase: 'done', threadId: id, title: brief.title, path: '/' + encodeURIComponent(environmentId) + '/' + encodeURIComponent(id) });
  } catch (e) { ev({ phase: 'error', msg: String(e && e.message || e).slice(0, 240) }); }
  finally { threadBusy = false; }
}
// Themes made outside this window (a T3 thread, a hand edit) appear in the library without a restart.
const themeStamps = new Map(); let themeTimer = null;
function themeStamp(dir) {
  let m = 0;
  for (const f of ['theme.json', 'scene.js', 'welcome.js', 'thumb.jpg', 'thumb.png']) { try { m = Math.max(m, fsSync.statSync(path.join(dir, f)).mtimeMs); } catch {} }
  return m;
}
function scanThemes(prime) {
  let entries = []; try { entries = fsSync.readdirSync(themeLib.themesRoot, { withFileTypes: true }); } catch { return; }
  const changed = [];
  for (const d of entries) {
    if (!d.isDirectory() || !fsSync.existsSync(path.join(themeLib.themesRoot, d.name, 'theme.json'))) continue;
    const m = themeStamp(path.join(themeLib.themesRoot, d.name));
    const settled = Date.now() - m > 1500;
    if (!prime && settled && themeStamps.get(d.name) !== m) changed.push(d.name);
    if (prime || settled) themeStamps.set(d.name, m);
  }
  if (prime || genChild || !changed.length) return;
  const items = changed.map(id => themeLib.toItem(path.join(themeLib.themesRoot, id)).item).filter(Boolean);
  if (items.length) { pageEvent({ type: 'items', items }); buildMenu(); }
}
function watchThemes() {
  if (themeTimer) return;
  try { scanThemes(true); themeTimer = setInterval(() => scanThemes(false), 2500); } catch {}
}
// Library card thumbnail for a new theme: the scene only. Everything of T3 (sidebar, thread names, chat, composer)
// is hidden for the shot, because thumbnails travel with exported .t3skin files.
const THUMB_ON = "(() => { const s = document.createElement('style'); s.id = 't3s-thumbshot'; s.textContent = 'body > *:not(.t3s-backdrop):not(.t3s-companion), body > *:not(.t3s-backdrop):not(.t3s-companion) * { visibility: hidden !important; }'; document.head.append(s); })();";
const THUMB_OFF = "document.getElementById('t3s-thumbshot')?.remove();";
async function captureThumb(id) {
  const dir = path.join(themeLib.themesRoot, id);
  if (readSettings().skin !== id || !fsSync.existsSync(dir) || fsSync.existsSync(path.join(dir, 'thumb.jpg')) || !window || window.isDestroyed()) return;
  try {
    await runtimeCall(THUMB_ON);
    await new Promise(r => setTimeout(r, 250));
    const img = await window.webContents.capturePage();
    await runtimeCall(THUMB_OFF);
    await fs.writeFile(path.join(dir, 'thumb.jpg'), img.resize({ width: 480, quality: 'best' }).toJPEG(82));
    const r = themeLib.toItem(dir); if (r.item) pageEvent({ type: 'items', items: [r.item] });
  } catch { await runtimeCall(THUMB_OFF).catch(() => {}); }
}
async function discardTheme(id) {
  id = path.basename(String(id || '')); const dir = path.join(themeLib.themesRoot, id);
  try { const t = JSON.parse(fsSync.readFileSync(path.join(dir, 'theme.json'), 'utf8')); if (!t.generated || themeLib.BUILT_IN.includes(id)) return; } catch { return; }
  await fs.rm(dir, { recursive: true, force: true });
  if (readSettings().skin === id) writeSettings({ skin: 'cozy-room' });
  pageEvent({ type: 'removed', id }); buildMenu();
}
// A generated scene that crashes in the sandbox is swapped for a template once, so the theme keeps working.
async function sceneFailed(ev) {
  if (!ev || ev.status !== 'error') return;
  const id = path.basename(String(ev.id || '')), dir = path.join(themeLib.themesRoot, id), file = path.join(dir, 'theme.json');
  let t; try { t = JSON.parse(fsSync.readFileSync(file, 'utf8')); } catch { return; }
  if (!t.generated || !t.scene || !t.scene.file || themeLib.BUILT_IN.includes(id)) return;
  const code = path.join(dir, path.basename(t.scene.file)), kept = path.basename(code).replace(/\.js$/, '.failed.js');
  try { await fs.rename(code, path.join(dir, kept)); } catch {}
  const p = t.palette || {};
  t.scene = { template: 'gradient-orbs', params: { count: 5, speed: 0.6 } };
  t.sceneColors = [p.bg, p.accent, p.accent2, p.surface].filter(Boolean);
  await fs.writeFile(file, JSON.stringify(t, null, 2));
  await fs.appendFile(path.join(dir, 'REPORT.md'), `\n## Scene fallback\n- ${new Date().toISOString()}: the generated scene stopped in the sandbox (${String(ev.msg || '').slice(0, 200)}). Replaced with the "gradient-orbs" template; the original is kept as ${kept}.\n`).catch(() => {});
  const r = themeLib.toItem(dir);
  if (r.item) pageEvent({ type: 'items', items: [r.item], apply: r.item.id });
}

// The hidden analyzer window must not keep the app alive.
function quitIfOnlyHelpers() { if (BrowserWindow.getAllWindows().every(w => w === analyzerWin || w.isDestroyed())) app.quit(); }

app.on('window-all-closed', () => app.quit());
