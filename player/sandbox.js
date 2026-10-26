/* T3 Skin sandbox: runs untrusted theme code (scene.js / welcome.js) away from the T3 page.
 *
 *   T3 page ──postMessage──> <iframe sandbox="allow-scripts" srcdoc>  (opaque origin, CSP: no network)
 *                               └─ Worker(blob)  ← shim + theme code, draws into an OffscreenCanvas
 *
 * The iframe cannot touch the T3 DOM, cookies or storage (opaque origin) and cannot open popups or
 * navigate the top window (no allow-* flags besides scripts). Its CSP blocks fetch/XHR/WebSocket/
 * importScripts; the blob worker inherits that CSP. Theme code only ever sees the tiny API built by
 * workerShim() below. A hung or slow worker is detected by heartbeats and replaced by a still frame.
 */
(function () {
  'use strict';
  if (window.T3SkinSandbox && window.T3SkinSandbox.version === 3) return;

  /* ---------- runs inside the worker (stringified) ---------- */
  function workerShim() {
    var factory = null;
    self.T3Scene = self.T3Welcome = function (f) { factory = f; };
    // Belt and braces: the CSP already blocks these, theme code has no reason to use them.
    ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'indexedDB', 'caches', 'BroadcastChannel'].forEach(function (k) { try { self[k] = undefined; } catch (e) {} });
    var api = null, inst = null, ctx2d = null, running = false, raf = 0, last = 0, t = 0;
    var fpsCap = 30, speed = 1, cost = 0, frames = 0, beatAt = Date.now(), dead = false, hasDrawn = false, requestedDpr = 1, quality = 1;
    function bounded(v, lo, hi, fallback) { return typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback; }
    function hex(c) { c = String(c || '#000').replace('#', ''); if (c.length === 3) c = c.replace(/./g, '$&$&'); var n = parseInt(c.slice(0, 6), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function toHex(v) { return '#' + v.map(function (x) { return ('0' + Math.max(0, Math.min(255, Math.round(x))).toString(16)).slice(-2); }).join(''); }
    function fail(where, e) { if (dead) return; dead = true; running = false; postMessage({ type: 'error', where: where, msg: String(e && e.message || e).slice(0, 300) }); }
    function seeded(seed) { var a = seed >>> 0 || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var r = Math.imul(a ^ a >>> 15, 1 | a); r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
    function hash2(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
    function noise2(x, y) { var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      var a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
    function zonesGL() {
      var out = new Float32Array(32), s = api.dpr, H = api.height * s, n = 0;
      for (var i = 0; i < api.zones.length && n < 8; i++, n++) { var z = api.zones[i]; out.set([z.x * s, H - (z.y + z.h) * s, (z.x + z.w) * s, H - z.y * s], n * 4); }
      api.zoneCount = n; return out;
    }
    function resizeCanvas() {
      api.width = bounded(api.width, 2, 16384, 2); api.height = bounded(api.height, 2, 16384, 2);
      api.dpr = Math.min(requestedDpr * quality, Math.sqrt(8 * 1024 * 1024 / (api.width * api.height)));
      var c = api.canvas, w = Math.max(2, Math.round(api.width * api.dpr)), h = Math.max(2, Math.round(api.height * api.dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      api.pxWidth = w; api.pxHeight = h; api.scale = api.dpr; api.zonesGL = zonesGL();
    }
    function draw(dt) {
      if (!inst || dead) return;
      if (ctx2d) ctx2d.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
      api.t = t; hasDrawn = true;
      try { if (inst.frame) inst.frame(t, dt); } catch (e) { fail('frame', e); }
    }
    function loop(now) {
      raf = 0; if (!running || dead) return;
      raf = requestAnimationFrame(loop);
      var min = 1000 / fpsCap; if (last && now - last < min - 1.5) return;
      var dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / fpsCap; last = now; t += dt * speed;
      var c0 = performance.now(); draw(dt * speed); cost += performance.now() - c0; frames++;
    }
    function setRun(on) {
      var next = !!on && !dead;
      if (next === running && hasDrawn) return;
      running = next; last = 0;
      if (running && !raf) raf = requestAnimationFrame(loop);
      if (!running) { if (raf) cancelAnimationFrame(raf); raf = 0; if (api && api.kind === 'welcome') t = Math.max(t, 6); draw(0); }
    }
    setInterval(function () { var now = Date.now(), secs = (now - beatAt) / 1000; postMessage({ type: 'beat', cost: frames ? cost / frames : 0, fps: frames / Math.max(secs, 0.001), running: running }); cost = 0; frames = 0; beatAt = now; }, 1000);
    onmessage = function (e) {
      var m = e.data || {};
      if (m.type === 'init') {
        if (api) return;
        if (!factory) { fail('setup', 'Theme code did not call T3Scene(function (api) { ... })'); return; }
        var canvas = m.canvas, rand = seeded(m.seed);
        var getCtx = canvas.getContext.bind(canvas);
        canvas.getContext = function (kind, opts) { var c = getCtx(kind, opts); if (kind === '2d') ctx2d = c; return c; };
        api = { canvas: canvas, width: m.width, height: m.height, dpr: m.dpr, palette: m.palette, params: m.params || {}, text: m.text || '',
          kind: m.kind, layer: m.layer === 'companion' ? 'companion' : 'scene', motion: m.motion, light: !!m.light, backdrop: !!m.backdrop, seed: m.seed, zones: m.zones || [], zoneCount: 0, t: 0, preview: !!m.preview,
          ui: {},   // live UI state from the host: typing, sent, working (facts only, never content)
          // The only thing a scene may ask of the page: a cosmetic flag on a known element ("paw" = the send button).
          signal: function (name, on) { name = String(name); if (/^[a-z]{1,16}$/.test(name)) postMessage({ type: 'signal', name: name, on: !!on }); },
          pointer: { x: -1, y: -1, down: false, overUI: true, inside: false },
          random: rand, noise: noise2, hash: hash2, rgb: hex, hex: toHex,
          rgba: function (c, a) { var v = hex(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; },
          mix: function (a, b, k) { a = hex(a); b = hex(b); return toHex(a.map(function (v, i) { return v + (b[i] - v) * k; })); },
          vec3: function (c) { return hex(c).map(function (v) { return v / 255; }); },
          calm: function (x, y, feather) {
            var f = feather || 56, best = 0;
            for (var i = 0; i < api.zones.length; i++) { var z = api.zones[i];
              var dx = Math.max(z.x - x, 0, x - z.x - z.w), dy = Math.max(z.y - y, 0, y - z.y - z.h), d = Math.sqrt(dx * dx + dy * dy);
              var v = d <= 0 ? 1 : Math.max(0, 1 - d / f); if (v > best) best = v; }
            return best;
          },
          free: function (pad) { // largest free rectangle to the side of the zones (where detail may go)
            var W = api.width, H = api.height, p = pad || 0, cands = [{ x: 0, y: 0, w: W, h: H }];
            api.zones.forEach(function (z) { var next = []; cands.forEach(function (r) {
              if (z.x >= r.x + r.w || z.x + z.w <= r.x || z.y >= r.y + r.h || z.y + z.h <= r.y) { next.push(r); return; }
              if (z.x > r.x) next.push({ x: r.x, y: r.y, w: z.x - r.x, h: r.h });
              if (z.x + z.w < r.x + r.w) next.push({ x: z.x + z.w, y: r.y, w: r.x + r.w - z.x - z.w, h: r.h });
              if (z.y > r.y) next.push({ x: r.x, y: r.y, w: r.w, h: z.y - r.y });
              if (z.y + z.h < r.y + r.h) next.push({ x: r.x, y: z.y + z.h, w: r.w, h: r.y + r.h - z.y - z.h }); }); next.sort(function (a, b) { return b.w * b.h - a.w * a.h; }); cands = next.slice(0, 64); });
            cands.sort(function (a, b) { return b.w * b.h - a.w * a.h; });
            var r = cands[0] || { x: 0, y: 0, w: W, h: H }; return { x: r.x + p, y: r.y + p, w: Math.max(0, r.w - 2 * p), h: Math.max(0, r.h - 2 * p) };
          }
        };
        fpsCap = bounded(m.fps, 1, 60, 30); speed = bounded(m.speed, 0, 4, 1); t = bounded(m.t0, 0, 86400, 0); requestedDpr = bounded(m.dpr, 0.1, 4, 1);
        resizeCanvas();
        try { inst = factory(api) || {}; } catch (err) { fail('setup', err); return; }
        postMessage({ type: 'ready' });
        setRun(!!m.run);
      } else if (!api || dead) {
        return;
      } else if (m.type === 'resize') {
        var w = bounded(m.width, 2, 16384, 2), h = bounded(m.height, 2, 16384, 2), dpr = bounded(m.dpr, 0.1, 4, requestedDpr);
        if (w === api.width && h === api.height && dpr === requestedDpr) return;
        api.width = w; api.height = h; requestedDpr = dpr; resizeCanvas();
        try { if (inst.resize) inst.resize(api.width, api.height); } catch (err) { fail('resize', err); }
        if (!running) draw(0);
      } else if (m.type === 'zones') {
        api.zones = m.zones || []; api.zonesGL = zonesGL();
        try { if (inst.zones) inst.zones(api.zones); } catch (err) { fail('zones', err); }
        if (!running) draw(0);
      } else if (m.type === 'pointer') {
        var p = api.pointer; p.x = m.x; p.y = m.y; p.overUI = !!m.overUI; p.inside = !!m.inside; if (m.kind === 'down') p.down = true; if (m.kind === 'up') p.down = false;
        try { if (inst.pointer) inst.pointer({ kind: m.kind, x: m.x, y: m.y, overUI: !!m.overUI, down: p.down }); } catch (err) { fail('pointer', err); }
      } else if (m.type === 'ui') {
        var nm = String(m.name || '').slice(0, 16); api.ui[nm] = m.value;
        try { if (inst.ui) inst.ui({ name: nm, value: m.value }); } catch (err) { fail('ui', err); }
      } else if (m.type === 'run') {
        fpsCap = bounded(m.fps, 1, 60, fpsCap); if (m.speed != null) speed = bounded(m.speed, 0, 4, speed); api.motion = m.motion || api.motion; setRun(!!m.on);
      } else if (m.type === 'degrade') {
        quality = Math.max(0.1, quality * 0.6); resizeCanvas(); try { if (inst.resize) inst.resize(api.width, api.height); } catch (err) { fail('resize', err); }
      }
    };
  }

  /* ---------- runs inside the iframe (stringified) ---------- */
  function iframeBoot() {
    var worker = null, lastMsg = Date.now(), started = false, url = null, dog = null;
    function up(m) { parent.postMessage(m, '*'); }
    function revoke() { if (url) { URL.revokeObjectURL(url); url = null; } }
    function kill() { if (worker) worker.terminate(); worker = null; revoke(); clearInterval(dog); }
    addEventListener('pagehide', kill);
    addEventListener('message', function (e) {
      if (e.source !== parent) return;
      var m = e.data || {};
      if (m.type === 'init' && !started) {
        started = true; lastMsg = Date.now();
        try {
          var c = document.querySelector('canvas'), off = c.transferControlToOffscreen();
          url = URL.createObjectURL(new Blob(['(' + m.shim + ')();\n', m.code, '\n'], { type: 'text/javascript' }));
          worker = new Worker(url);
          worker.onmessage = function (ev) { lastMsg = Date.now(); if (ev.data && ev.data.type === 'ready') revoke(); if (ev.data && ev.data.type === 'error') kill(); up(ev.data); };
          worker.onerror = function (ev) { ev.preventDefault(); kill(); up({ type: 'error', where: 'load', msg: String(ev.message || 'script error').slice(0, 300) }); };
          var init = {}; for (var k in m) if (k !== 'shim' && k !== 'code') init[k] = m[k];
          init.canvas = off; worker.postMessage(init, [off]);
          dog = setInterval(function () { if (worker && Date.now() - lastMsg > 3500) { kill(); up({ type: 'dead', reason: 'Theme code stopped responding (endless loop?)' }); } }, 1000);
        } catch (err) { kill(); up({ type: 'error', where: 'boot', msg: String(err && err.message || err) }); }
      } else if (m.type === 'kill') kill();
      else if (worker) worker.postMessage(m);
    });
  }

  var CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; font-src 'none'; media-src 'none'; form-action 'none'; base-uri 'none'";
  var SRCDOC = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + CSP + '">' +
    '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;width:100%;height:100%}</style>' +
    '<canvas></canvas><script>(' + iframeBoot.toString() + ')();<\/script>';
  var SHIM = workerShim.toString();

  /* ---------- host side (T3 page) ---------- */
  // create({ code, kind, layer, palette, params, text, light, motion, fps, speed, dpr, run, zones, preview, onStatus, onSignal, budgetMs })
  function create(o) {
    o = Object.assign({}, o);
    var frame = document.createElement('iframe'), booted = false;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true'); frame.setAttribute('tabindex', '-1'); frame.setAttribute('title', '');
    frame.setAttribute('referrerpolicy', 'no-referrer'); frame.setAttribute('loading', 'eager');
    frame.className = 't3s-sandbox'; frame.srcdoc = SRCDOC;
    var c = { el: frame, status: 'loading', msg: '', fps: 0, cost: 0, destroyed: false, slowBeats: 0, degraded: 0, lastBeat: 0, created: Date.now() };
    var budget = o.budgetMs || 22, media = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    function status(st, msg) { if (c.status === st && c.msg === (msg || '')) return; c.status = st; c.msg = msg || ''; if (o.onStatus) try { o.onStatus(st, c.msg, c); } catch (e) {} }
    function send(m) { if (!c.destroyed && frame.contentWindow) frame.contentWindow.postMessage(m, '*'); }
    function post(m) { if (booted && !c.forcedStill) send(m); }
    function allowed() { return !!o.run && o.motion !== 'still' && !(media && media.matches) && !document.hidden; }
    function release() {
      if (c.destroyed) return;
      try { send({ type: 'kill' }); } catch (e) {}
      c.destroyed = true; clearInterval(dog);
      window.removeEventListener('message', onMsg); frame.removeEventListener('load', onLoad);
      document.removeEventListener('visibilitychange', syncRun);
      if (media) media.removeEventListener('change', syncRun);
      frame.remove(); o.code = ''; o.params = null; o.onStatus = null;
    }
    function fail(msg) { var callback = o.onStatus; release(); o.onStatus = callback; status('error', msg); o.onStatus = null; }
    function onMsg(e) {
      if (e.source !== frame.contentWindow || c.destroyed || c.forcedStill) return;
      var m = e.data || {};
      if (m.type === 'ready') { c.lastBeat = Date.now(); status('ok'); }
      else if (m.type === 'beat') {
        if (!Number.isFinite(m.fps) || !Number.isFinite(m.cost)) return;
        c.lastBeat = Date.now(); c.fps = Math.round(m.fps); c.cost = Math.round(m.cost * 10) / 10;
        if (m.running && m.cost > budget) {
          if (++c.slowBeats >= 2) {
            c.slowBeats = 0;
            if (c.degraded < 2 && m.cost < budget * 2.5) { c.degraded++; post({ type: 'degrade' }); status('ok', 'lowered resolution to keep T3 smooth'); }
            else { send({ type: 'kill' }); c.forcedStill = true; clearInterval(dog); status('slow', 'scene too heavy: showing a still frame'); }
          }
        } else c.slowBeats = 0;
      } else if (m.type === 'signal') { if (o.onSignal) try { o.onSignal(String(m.name).slice(0, 16), !!m.on); } catch (e) {} }
      else if (m.type === 'error') fail((m.where ? m.where + ': ' : '') + m.msg);
      else if (m.type === 'dead') fail(m.reason);
    }
    function syncRun() { post({ type: 'run', on: allowed(), fps: o.fps, speed: o.speed, motion: o.motion }); }
    function onLoad() {
      if (c.destroyed || booted) return;
      booted = true;
      send({ type: 'init', shim: SHIM, code: String(o.code || ''), kind: o.kind || 'scene', palette: o.palette || {}, params: o.params || {}, text: o.text || '',
        light: !!o.light, backdrop: !!o.backdrop, motion: o.motion || 'live', fps: o.fps || 30, speed: o.speed, dpr: o.dpr || 1, width: o.width || 2, height: o.height || 2,
        run: allowed(), zones: o.zones || [], layer: o.layer || 'scene', seed: o.seed != null ? o.seed : (Math.random() * 4294967295) >>> 0, t0: o.t0 || 0, preview: !!o.preview });
    }
    window.addEventListener('message', onMsg); frame.addEventListener('load', onLoad);
    document.addEventListener('visibilitychange', syncRun);
    if (media) media.addEventListener('change', syncRun);
    var dog = setInterval(function () { if (!c.destroyed && Date.now() - (c.lastBeat || c.created) > 6000) fail('scene did not start or stopped responding'); }, 1500);
    c.post = post;
    c.run = function (on, fps, speed, motion) { o.run = !!on; if (fps != null) o.fps = fps; if (speed != null) o.speed = speed; if (motion) o.motion = motion; syncRun(); };
    c.resize = function (w, h, dpr) { o.width = w; o.height = h; if (dpr != null) o.dpr = dpr; post({ type: 'resize', width: w, height: h, dpr: o.dpr }); };
    c.zones = function (z) { o.zones = z; post({ type: 'zones', zones: z }); };
    c.pointer = function (p) { post(p); };
    c.ui = function (name, value) { post({ type: 'ui', name: name, value: value }); };
    c.destroy = release;
    return c;
  }

  window.T3SkinSandbox = { version: 3, create: create, csp: CSP };
})();
