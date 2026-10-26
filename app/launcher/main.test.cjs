'use strict';
// Pure Node regression tests: the launcher runs in a VM with Electron, disk,
// network and child processes replaced. No window or live profile is touched.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const source = require('node:fs').readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function until(predicate) {
  for (let i = 0; i < 40; i++) { if (predicate()) return; await tick(); }
  assert.fail('mock launcher did not reach the expected state');
}

async function launcher(options = {}) {
  let settings = JSON.stringify(options.settings || {}), menu, serial = 0, closed = false;
  const css = new Set(), calls = [], errors = [];
  const renderer = vm.createContext({ window: { mounted: false, mounts: [] } });
  const wc = new EventEmitter();
  Object.assign(wc, {
    session: { setPermissionRequestHandler() {} },
    getURL: () => 'https://t3.test/', isDestroyed: () => closed,
    setWindowOpenHandler() {},
    async insertCSS() {
      const key = 'css-' + ++serial;
      if (options.insert) await options.insert(key);
      css.add(key);
      return key;
    },
    async removeInsertedCSS(key) {
      if (options.remove) await options.remove(key);
      css.delete(key);
    },
    async executeJavaScript(expression) {
      calls.push(expression);
      if (options.execute) await options.execute(expression);
      return vm.runInContext(expression, renderer);
    },
  });
  class BrowserWindow extends EventEmitter {
    constructor() { super(); this.webContents = wc; }
    isDestroyed() { return closed; }
    show() {} focus() {}
    async loadURL() {}
    static getAllWindows() { return []; }
  }
  const app = new EventEmitter();
  Object.assign(app, {
    setName() {}, setPath() {}, requestSingleInstanceLock: () => true,
    whenReady: () => Promise.resolve(), quit() {},
  });
  const fakeFs = {
    mkdirSync() {}, appendFileSync() {}, readdirSync: () => [], existsSync: () => false,
    readFileSync(file) {
      assert.equal(path.basename(file), 'skin-settings.json');
      return settings;
    },
    writeFileSync(file, text) {
      assert.equal(path.basename(file), 'skin-settings.json');
      settings = text;
    },
  };
  const scripts = {
    'engine.css': '/* CSS */', 'selectors.js': '/* selectors */', 'sandbox.js': '/* sandbox */',
    'engine.js': 'window.T3Skin = { mount(options) { window.mounted = true; window.mounts.push(options); }, destroy() { window.mounted = false; } };',
  };
  const modules = {
    '../studio/theme-models.cjs': require('../studio/theme-models.cjs'),
    electron: {
      app, BrowserWindow,
      Menu: { buildFromTemplate: value => value, setApplicationMenu: value => { menu = value; } },
      protocol: { registerSchemesAsPrivileged() {}, handle() {} }, net: {}, shell: {},
      dialog: { showErrorBox: (...args) => errors.push(args) },
      ipcMain: { on() {}, handle() {} },
    },
    'node:fs': fakeFs,
    'node:fs/promises': { async readFile(file) {
      if (options.read) await options.read(path.basename(file));
      assert.ok(Object.hasOwn(scripts, path.basename(file)));
      return scripts[path.basename(file)];
    } },
    'node:path': path, 'node:os': require('node:os'), 'node:url': require('node:url'),
    'node:child_process': {}, './t3-detect.cjs': {}, './skinpack.cjs': {},
    './theme-library.cjs': { loadAllThemes: () => ({ items: [], problems: [] }) },
    './keystore.cjs': { createKeystore: () => ({ env: () => ({}) }) },
  };
  const context = vm.createContext({
    require(name) { assert.ok(Object.hasOwn(modules, name), 'unexpected require: ' + name); return modules[name]; },
    __dirname, URL, AbortSignal,
    process: { argv: ['node', 'main.cjs', '--origin', 'https://t3.test', ...(options.args || [])], env: {}, platform: process.platform, pid: 0 },
    fetch: async () => ({ ok: true, json: async () => ({ environmentId: 'test', serverVersion: 'test' }) }),
  });
  vm.runInContext(source, context, { filename: 'main.cjs' });
  await until(() => wc.listenerCount('dom-ready') === 1);
  const h = {
    wc, css, calls, errors, renderer,
    settings: () => JSON.parse(settings),
    checkbox: () => menu[0].submenu.find(item => item.label === 'Enable skin'),
    reload: () => wc.emit('dom-ready'),
    off: () => wc.emit('console-message', { message: '__t3skin-off' }),
    setEnabled: checked => h.checkbox().click({ checked }),
    close() { closed = true; wc.emit('destroyed'); },
  };
  return h;
}

test('gallery Off persists, unchecks the menu and remains off after reload/restart', async () => {
  const h = await launcher({ settings: { skin: 'chosen-theme', motion: 'calm' } });
  h.reload();
  await until(() => h.renderer.window.mounted);
  h.off();
  await until(() => !h.renderer.window.mounted && h.css.size === 0);
  assert.equal(h.settings().enabled, false);
  assert.equal(h.settings().skin, 'chosen-theme');
  assert.equal(h.checkbox().checked, false);
  const mounts = h.renderer.window.mounts.length;
  h.reload(); await tick();
  assert.equal(h.renderer.window.mounts.length, mounts);
  const restarted = await launcher({ settings: h.settings() });
  restarted.reload(); await tick();
  assert.equal(restarted.checkbox().checked, false);
  assert.equal(restarted.calls.filter(c => !JSON.stringify(c).includes('t3s-off-btn')).length, 0);
  h.setEnabled(true);
  await until(() => h.renderer.window.mounted);
  assert.equal(h.settings().enabled, true);
  assert.equal(h.renderer.window.mounts.at(-1).active, 'chosen-theme');
});

test('checkbox Off uses the same cleanup and --no-skin overrides saved enabled', async () => {
  const h = await launcher();
  assert.equal(h.checkbox().checked, true);
  h.reload(); await until(() => h.renderer.window.mounted);
  h.setEnabled(false);
  await until(() => !h.renderer.window.mounted && h.css.size === 0);
  assert.equal(h.settings().enabled, false);
  assert.equal(h.checkbox().checked, false);
  const disabled = await launcher({ settings: { enabled: true }, args: ['--no-skin'] });
  disabled.reload(); await tick();
  assert.equal(disabled.calls.filter(c => !JSON.stringify(c).includes('t3s-off-btn')).length, 0);
  assert.equal(disabled.checkbox().checked, false);
});

test('Off cancels pending file reads before any CSS or runtime is installed', async () => {
  const gate = deferred();
  const h = await launcher({ read: () => gate.promise });
  h.reload(); h.off(); await tick();
  const calls = h.calls.length;
  gate.resolve(); await tick();
  assert.equal(h.css.size, 0);
  assert.equal(h.calls.length, calls);
  assert.equal(h.renderer.window.mounts.length, 0);
});

test('late CSS insertion is removed without touching a newer enabled skin', async () => {
  const gate = deferred(); let started = false;
  const h = await launcher({ insert: key => { if (key === 'css-1') { started = true; return gate.promise; } } });
  h.reload(); await until(() => started);
  h.off(); h.setEnabled(true);
  await until(() => h.renderer.window.mounted);
  gate.resolve(); await tick();
  assert.deepEqual([...h.css], ['css-2']);
  assert.equal(h.renderer.window.mounts.length, 1);
  assert.equal(h.checkbox().checked, true);
});

test('Off removes a stylesheet whose insertion finishes after disabling', async () => {
  const gate = deferred(); let started = false;
  const h = await launcher({ insert: () => { started = true; return gate.promise; } });
  h.reload(); await until(() => started);
  h.off(); gate.resolve(); await tick();
  assert.equal(h.css.size, 0);
  assert.equal(h.renderer.window.mounts.length, 0);
});

test('overlapping reloads discard stale reads and mount only the latest injection', async () => {
  const gate = deferred(); let reads = 0;
  const h = await launcher({ read: () => { if (++reads <= 4) return gate.promise; } });
  h.reload(); h.reload();
  await until(() => h.renderer.window.mounted);
  gate.resolve(); await tick();
  assert.equal(h.renderer.window.mounts.length, 1);
  assert.deepEqual([...h.css], ['css-1']);
});

for (const stage of ['delete window.T3Skin;', '/* selectors */', '/* sandbox */', 'window.T3Skin =', 'window.T3Skin.mount(']) {
  test('Off while renderer work is pending: ' + stage, async () => {
    const gate = deferred(); let started = false;
    const h = await launcher({ execute: expression => {
      if (!started && expression.includes(stage)) { started = true; return gate.promise; }
    } });
    h.reload(); await until(() => started);
    h.off(); gate.resolve(); await tick();
    assert.equal(h.renderer.window.mounted, false);
    assert.equal(h.css.size, 0);
    assert.equal(h.settings().enabled, false);
    assert.equal(h.errors.length, 0);
  });
}

test('rapid off/on orders pending mount before teardown and the new mount', async () => {
  const gate = deferred(); let started = false;
  const h = await launcher({ execute: expression => {
    if (!started && expression.includes('window.T3Skin.mount(')) { started = true; return gate.promise; }
  } });
  h.reload(); await until(() => started);
  h.off(); h.setEnabled(true); gate.resolve();
  await until(() => h.renderer.window.mounts.length === 2);
  assert.equal(h.renderer.window.mounted, true);
  assert.deepEqual([...h.css], ['css-2']);
});

test('same-origin document navigation invalidates work before the next dom-ready', async () => {
  const gate = deferred();
  const h = await launcher({ read: () => gate.promise });
  h.reload();
  h.wc.emit('did-start-navigation', {}, 'https://t3.test/next', false, true);
  gate.resolve(); await tick();
  assert.equal(h.calls.length, 0);
  assert.equal(h.css.size, 0);
  h.reload(); await until(() => h.renderer.window.mounted);
  assert.equal(h.renderer.window.mounts.length, 1);
});

test('CSS cleanup proceeds when renderer teardown rejects', async () => {
  const h = await launcher({ execute: expression => {
    if (expression.includes('window.T3Skin?.destroy?.()') && !expression.includes('delete')) throw Error('renderer gone');
  } });
  h.reload(); await until(() => h.renderer.window.mounted);
  h.off(); await tick();
  assert.equal(h.css.size, 0);
  assert.equal(h.settings().enabled, false);
  assert.equal(h.errors.length, 0);
});

test('cancelled read errors are suppressed; current read failures are reported', async () => {
  for (const cancel of [false, 'off', 'close']) {
    const gate = deferred();
    const h = await launcher({ read: () => gate.promise });
    h.reload();
    if (cancel === 'off') h.off();
    if (cancel === 'close') h.close();
    gate.reject(Error('read failed')); await tick();
    assert.equal(h.errors.length, cancel ? 0 : 1);
  }
});
