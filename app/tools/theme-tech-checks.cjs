'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const V = require('../launcher/theme-validate.cjs'), F = require('../launcher/theme-files.cjs'), Z = require('../launcher/zip.cjs'), P = require('../launcher/skinpack.cjs');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

module.exports = function checks(ok) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't3-tech-checks-'));
  try {
    const evilSvg = `<svg><path d='M0 0" onload="alert(1)'/></svg>`;
    const svg = V.sanitizeSvg(evilSvg);
    ok(!/"\s+onload="/.test(svg), 'SVG attribute quotes cannot introduce event attributes');
    ok(V.sanitizeSvg('<svg/><svg/>') === null && V.sanitizeSvg('<path/><svg/>') === null && V.sanitizeSvg('<svg><svg/></svg>') === null, 'SVG must have a single unnested root');
    ok(V.sanitizeSvg('<svg><path d="' + 'é'.repeat(5000) + '"/></svg>') === null, 'SVG budget counts UTF-8 bytes');
    const th = JSON.parse('{"palette":{"bg":"#111"},"scene":{"template":"test","params":{"__proto__":{"polluted":true},"constructor":2,"ok":4}},"fonts":{"files":[{"family":"X","file":"fonts/x.woff","weight":"1;}body{"}]}}');
    const r = V.validateTheme(th, () => null, { templates: () => 'T3Scene(function(){return {}})', checkFiles: false });
    ok(!('polluted' in r.theme.scene.params) && r.theme.scene.params.ok === 4 && !Object.hasOwn(r.theme.scene.params, 'constructor'), 'scene parameters cannot replace prototypes');
    ok(r.theme.fonts.files[0].weight === '400', 'font-weight rejects CSS delimiters');
    ok(!V.validateTheme([], () => null).ok, 'array theme manifests are rejected clearly');
    let binaryReads = 0;
    V.validateTheme({ palette: { bg: '#111' }, backdrop: { image: 'media/bg.png' }, fonts: { files: [{ family: 'X', file: 'fonts/x.woff' }] } }, () => { binaryReads++; return 'binary'; }, { binaryExists: () => true });
    ok(binaryReads === 0, 'binary existence checks never decode media/fonts');
    const noMedia = V.validateTheme({ palette: { bg: '#111' }, backdrop: { image: 'media/no.png' } }, () => null, { binaryExists: () => false });
    ok(!noMedia.theme.backdrop && noMedia.report.warnings.some(w => /media\/no.png/.test(w)), 'missing media references are dropped with a useful warning');
    const wrong = V.validateTheme({ palette: { bg: '#111' }, scene: { file: 'scene.js' } }, () => 'T3Welcome(function(){return {}})');
    ok(!wrong.code.scene && wrong.report.errors.some(e => /must call T3Scene/.test(e)), 'code must register the correct factory');
    const hugeCode = V.validateTheme({ palette: { bg: '#111' }, scene: { file: 'scene.js' } }, () => 'T3Scene(function(){/*' + 'é'.repeat(50000) + '*/return {}})');
    ok(!hugeCode.code.scene, 'code budget counts UTF-8 bytes');
    fs.mkdirSync(path.join(tmp, 'oversize'));
    fs.writeFileSync(path.join(tmp, 'oversize', 'theme.json'), ' '.repeat(F.LIMITS.manifest + 1));
    ok(!V.loadTheme(path.join(tmp, 'oversize')).ok, 'oversized manifests are rejected before parsing');
    for (const unsafe of ['../outside.js', 'C:/outside.js', 'media/NUL.png', 'media/a./x.png', 'media/a\\b.png']) assert.equal(F.safeRelative(unsafe), false);
    ok(true, 'theme paths reject traversal and Windows aliases');
    const bytes = Buffer.from('stored payload 0123456789');
    const pack = () => Z.writeZip([{ name: 'payload.bin', data: bytes }]);
    let b = pack(), cd = b.indexOf(Buffer.from([0x50, 0x4b, 1, 2])); b.writeUInt32LE(1, cd + 24);
    assert.throws(() => Z.readZip(b, { maxTotal: 1 }), /size|large|mismatch/); ok(true, 'stored ZIP data cannot bypass declared size budgets');
    b = pack(); b[30 + 'payload.bin'.length] ^= 1;
    assert.throws(() => Z.readZip(b), /checksum/); ok(true, 'ZIP CRC detects altered stored data');
    const dup = Z.writeZip([{ name: 'theme.json', data: Buffer.from('{}') }, { name: 'THEME.json', data: Buffer.from('{}') }]);
    assert.throws(() => Z.readZip(dup), /Duplicate/); ok(true, 'ZIP rejects duplicate and case-colliding entries');
    for (const name of ['../escape.txt', '/root.txt', 'C:/root.txt', 'a\\b.txt', 'media/CON.jpg', 'a./b.txt']) assert.throws(() => Z.readZip(Z.writeZip([{ name, data: Buffer.from('x') }])), /Unsafe/);
    ok(true, 'ZIP paths reject traversal, drive paths and Windows aliases');
    for (const mutate of [x => x.writeUInt32LE(0, 0), x => x.writeUInt32LE(0xffffffff, x.length - 6), x => x.writeUInt16LE(1, 6), x => x.writeUInt16LE(0xffff, 26)]) { b = pack(); mutate(b); assert.throws(() => Z.readZip(b), /zip|ZIP|header|flags|bounds|unsupported/i); }
    ok(true, 'corrupt ZIP headers/bounds fail with explicit archive errors');
    for (const n of [0, 1, 10, 21]) assert.throws(() => Z.readZip(Buffer.alloc(n)), /Not a zip/);
    ok(true, 'truncated ZIPs do not leak RangeError exceptions');
    b = Z.writeZip([{ name: 'long.txt', data: Buffer.from('hello'.repeat(5000)) }]);
    cd = b.indexOf(Buffer.from([0x50, 0x4b, 1, 2])); b.writeUInt32LE(2, cd + 24); b.writeUInt32LE(2, 22);
    assert.throws(() => Z.readZip(b), /oversized|size|compressed/); ok(true, 'compressed entries cannot inflate beyond their stated size');
    ok(Z.readZip(pack(), { metadataOnly: true })[0].data === undefined, 'pack identification does not inflate asset contents');
    const raw = { name: 'Safe import', palette: { bg: '#111', accent: '#eee' }, css: 'body{display:none}', prompt: 'private', icons: { custom: { settings: 'icons/settings.svg' } }, backdrop: { image: 'media/fake.webp' }, fonts: { files: [{ family: 'X', file: 'fonts/x.ttf' }] } };
    const imported = P.importTheme(Z.writeZip([{ name: 'theme.json', data: Buffer.from(JSON.stringify(raw)) }, { name: 'icons/settings.svg', data: Buffer.from('<svg><script>bad()</script></svg>') }, { name: 'media/fake.webp', data: Buffer.from('RIFF....WAVE....') }, { name: 'fonts/x.ttf', data: Buffer.from('not an actual font') }]), tmp);
    const dir = path.join(tmp, imported.id), manifest = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8'));
    ok(!manifest.css && !manifest.prompt && !manifest.backdrop && !manifest.fonts.files.length, 'imports persist normalized safe references without private fields');
    ok(!fs.existsSync(path.join(dir, 'icons/settings.svg')) && !fs.existsSync(path.join(dir, 'media/fake.webp')), 'rejected SVG and mislabeled binary files are never written');
    ok(!F.magicOk('x.webp', Buffer.from('RIFF....WAVE....')) && !F.magicOk('x.ttf', Buffer.from('anything')), 'WebP and TTF signatures are verified');
    assert.throws(() => F.checkSize('media/big.mp4', F.LIMITS.video + 1), /limit/); assert.throws(() => F.checkSize('media/big.jpg', F.LIMITS.image + 1), /limit/);
    ok(true, 'video and image budgets are enforced independently');
    const ids = Array.from({ length: 8 }, () => F.reserveDir(tmp, 'same').id);
    ok(new Set(ids).size === 8, 'exclusive directory reservations preserve unique ids');
    sandboxChecks(ok);
    atmosChecks(ok);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
};

function sandboxChecks(ok) {
  const events = new Map(), timers = new Set(), sent = [], removed = [];
  const on = (k, f) => events.set(k, f), off = k => events.delete(k);
  const media = { matches: false, addEventListener: (k, f) => on('media:' + k, f), removeEventListener: k => off('media:' + k) };
  const frame = { setAttribute() {}, addEventListener: (k, f) => on('frame:' + k, f), removeEventListener: k => off('frame:' + k), remove: () => removed.push(true), contentWindow: { postMessage: m => sent.push(m) } };
  const window = { addEventListener: on, removeEventListener: off, matchMedia: () => media };
  const document = { hidden: false, createElement: () => frame, addEventListener: (k, f) => on('document:' + k, f), removeEventListener: k => off('document:' + k) };
  vm.runInNewContext(source('runtime/sandbox.js'), { window, document, Date, setInterval: f => (timers.add(f), f), clearInterval: f => timers.delete(f) });
  const c = window.T3SkinSandbox.create({ run: true, width: 100, height: 100 });
  c.resize(800, 600, 2); c.run(false); c.zones([{ x: 1, y: 2, w: 3, h: 4 }]); events.get('frame:load')();
  const init = sent.find(m => m.type === 'init');
  ok(init.width === 800 && init.height === 600 && init.dpr === 2 && init.run === false && init.zones.length === 1, 'sandbox startup retains latest dimensions, zones and pause state');
  media.matches = true; c.run(true); ok(sent.at(-1).on === false, 'sandbox enforces reduced motion even when caller requests live');
  media.matches = false; document.hidden = true; events.get('document:visibilitychange')(); ok(sent.at(-1).on === false, 'hidden document cannot restart the sandbox');
  c.created = 1; [...timers][0]();
  ok(c.status === 'error' && c.destroyed && removed.length === 1 && events.size === 0 && timers.size === 0, 'watchdog failure releases frame/listeners/timers without a caller callback');
  c.destroy(); ok(removed.length === 1, 'sandbox destroy is idempotent');
  const worker = { self: null, postMessage() {}, setInterval() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, performance: { now: () => 0 }, Date, Math, Float32Array }; worker.self = worker;
  vm.createContext(worker); vm.runInContext('(' + init.shim + ')()', worker);
  let api, frames = 0, resized = 0;
  worker.T3Scene(a => (api = a, { frame() { frames++; }, resize() { resized++; } }));
  const canvas = { getContext: () => ({ setTransform() {} }) };
  worker.onmessage({ data: { ...init, kind: 'scene', width: 100, height: 100, dpr: 2, canvas, run: false } });
  worker.onmessage({ data: { type: 'degrade' } });
  worker.onmessage({ data: { type: 'resize', width: 200, height: 100, dpr: 2 } });
  ok(canvas.width === 240 && api.dpr === 1.2, 'resize retains watchdog resolution reduction');
  const before = frames, rb = resized;
  worker.onmessage({ data: { type: 'resize', width: 200, height: 100, dpr: 2 } });
  worker.onmessage({ data: { type: 'run', on: false } }); worker.onmessage({ data: { type: 'run', on: false } });
  ok(frames === before && resized === rb, 'unchanged resize/pause does not redraw or relayout');
  worker.onmessage({ data: { type: 'resize', width: 1e9, height: Infinity, dpr: 100 } });
  ok(Number.isFinite(canvas.width) && canvas.width * canvas.height <= 8 * 1024 * 1024 + 10000, 'canvas dimensions and pixel budget stay finite and bounded');
  // Exercise the actual iframe boot code and its worker URL lifecycle.
  let handler, pagehide, revoked = 0, terminated = 0, interval;
  const boot = /<script>\(([^]*?)\)\(\);<\/script>/.exec(frame.srcdoc)[1];
  const parent = { postMessage() {} }; let fakeWorker;
  const iframe = { parent, document: { querySelector: () => ({ transferControlToOffscreen: () => ({}) }) }, URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => revoked++ }, Blob: class {}, Worker: class { constructor() { fakeWorker = this; } postMessage() {} terminate() { terminated++; } }, addEventListener: (k, f) => { if (k === 'message') handler = f; else pagehide = f; }, setInterval: f => (interval = f, 1), clearInterval: () => interval = null, Date };
  vm.runInNewContext('(' + boot + ')()', iframe); handler({ source: parent, data: { type: 'init', shim: '', code: '' } });
  fakeWorker.onmessage({ data: { type: 'ready' } }); pagehide();
  ok(revoked === 1 && terminated === 1 && interval === null, 'worker Blob URLs are revoked and pagehide terminates the worker/timer');
}

function atmosChecks(ok) {
  let api, inst, allocations = [], draws = [];
  const ctx = new Proxy({ createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), drawImage: (...a) => draws.push(a.slice(1)), measureText: () => ({ width: 10 }), getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get: (o, k) => k in o ? o[k] : () => {} });
  class Canvas { constructor(w, h) { this.width = Math.trunc(w); this.height = Math.trunc(h); allocations.push(this); } getContext() { return ctx; } }
  const make = (kind, params, dpr = 1, w = 200) => {
    allocations = []; draws = [];
    api = { canvas: new Canvas(w * dpr, 100 * dpr), width: w, height: 100, dpr, params, palette: { bg: '#000', accent: '#ff0', accent2: '#0ff', text: '#fff' }, random: () => 0.5, calm: () => 0, rgba: () => 'rgba(0,0,0,1)', pointer: { x: 0, y: 0 }, text: 'Test' };
    vm.runInNewContext(source(`runtime/templates/atmos.${kind}.js`), { T3Scene: f => inst = f(api), T3Welcome: f => inst = f(api), OffscreenCanvas: Canvas });
  };
  make('scene', { fx: 'snow', img: [0, 0], glows: 'bad', cone: 'bad' }); inst.frame(1, 0);
  ok(true, 'Atmos tolerates malformed effect/vector controls');
  make('scene', { fx: ['motes'], motes: 1e12 }); inst.frame(0, 0);
  ok(draws.length <= 500, 'Atmos caps particle counts before allocating/drawing');
  make('scene', { fx: ['rainglass'], beads: 0, sliders: 1 }); inst.frame(10, 10); draws = []; inst.frame(10, 0); const frozen = JSON.stringify(draws); draws = []; inst.frame(10, 0);
  ok(frozen === JSON.stringify(draws), 'paused rainglass is stable across repeated redraws');
  make('scene', { fx: ['motes'], motes: 0 }); inst.frame(0, 0); ok(draws.length === 0, 'zero particle count really disables particles');
  make('scene', { fx: ['motes'], motes: 1 }); inst.frame(0, 0); const x = draws[0][0]; api.width = 400; inst.resize(400, 100); draws = []; inst.frame(0, 0);
  ok(draws[0][0] > x + 90, 'resize preserves particle distribution across the new width');
  make('welcome', { style: 'rise' }, 2); ok(allocations.length === 1, 'rise welcome avoids an unused offscreen canvas');
  make('welcome', { style: 'ink' }, 2); inst.frame(6, 0);
  ok(allocations[1].width === 400 && allocations[1].height === 200 && draws.at(-1).join(',') === '0,0,200,100', 'ink welcome rasterizes at DPR and composites at CSS size');
  make('welcome', { style: 'stars' }, 1, 200.5); inst.frame(6, 0); ok(true, 'star sampling handles fractional CSS dimensions');
}
