(function () {
  'use strict';
  if (window.T3SpaceSkin && window.T3SpaceSkin.version === '1.0.0') return;
  var current = null;
  var MODES = ['cinema', 'artwork', 'ascii'];
  var api = {
    version: '1.0.0',
    mount: mount,
    destroy: destroy,
    setMode: function (mode) {
      if (MODES.indexOf(mode) < 0) throw new TypeError('Unknown skin mode: ' + mode);
      if (current) { current.mode = mode; current.videoBlocked = false; sync(); }
      return api;
    },
    setPaused: function (paused) { if (current) { current.paused = !!paused; current.videoBlocked = false; sync(); } return api; },
    setFocus: function (focus) { if (current) { current.focus = !!focus; sync(); } return api; },
    setIntensity: function (value) {
      if (!Number.isFinite(Number(value))) throw new TypeError('Intensity must be a number from 0 to 100');
      if (current) { current.intensity = Math.max(0, Math.min(100, Number(value))); sync(); }
      return api;
    },
    getState: function () {
      var s = current;
      return s ? {
        mounted: true, mode: s.mode, paused: s.paused, focus: s.focus,
        intensity: s.intensity, reducedMotion: s.motion.matches, hidden: document.hidden,
        effectivePaused: stopped(s), videoPlaying: !s.video.paused,
        videoUnavailable: s.videoFailed || s.videoBlocked, artworkUnavailable: s.artFailed,
        assetBase: s.assetBase
      } : { mounted: false };
    }
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function listen(s, target, type, handler, options) {
    target.addEventListener(type, handler, options);
    s.cleanup.push(function () { target.removeEventListener(type, handler, options); });
  }
  function stopped(s) { return s.paused || s.focus || s.motion.matches || document.hidden || s.intensity === 0; }

  function attachWelcomeEmblem(s, node) {
    if (!(node instanceof Element)) return;
    var selector = 'h1:has([data-draft-project-trigger]),[data-space-preview-hero]';
    var headings = Array.from(node.querySelectorAll(selector));
    if (node.matches(selector)) headings.unshift(node);
    var containingHeading = node.closest('h1');
    if (containingHeading && containingHeading.matches(selector)) headings.push(containingHeading);
    headings.forEach(function (heading) {
      if (s.emblemHeadings.get(heading)?.isConnected || !heading.parentElement) return;
      var emblem = el('pre');
      emblem.setAttribute('data-space-emblem', '');
      emblem.setAttribute('aria-hidden', 'true');
      emblem.textContent = [
        '                  .  ·  .                  ',
        '              .-::::::::::-.              ',
        '            .:::::······:::::.            ',
        '       __ .::::::········::::::. ___       ',
        '    .-´  /:::::::········::::::/   `-.    ',
        '  .´   .´:::::::::······::::: .´       `.  ',
        ' /  .-´  `:::::::::::::: .-´       .-´ / ',
        ' `-´ ______`-.:::::_.-´_______.-´  .´   ',
        '    `----....____________....----´      ',
        '                  ·  +  ·                 '
      ].join('\n');
      heading.parentElement.insertBefore(emblem, heading);
      s.emblemHeadings.set(heading, emblem); s.emblems.push(emblem);
    });
  }

  function mount(options) {
    if (current) return api;
    if (!document.body) throw new Error('Mount the skin after the document body is ready.');
    options = options || {};
    var base = new URL(options.assetBase || './assets/', document.baseURI);
    if (!/^https?:$|^file:$|^t3-skin:$/.test(base.protocol)) throw new TypeError('Use an HTTP(S), file, or launcher asset directory.');
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    var s = current = {
      assetBase: base.href, mode: 'artwork', paused: false, focus: false, intensity: 85,
      motion: window.matchMedia('(prefers-reduced-motion: reduce)'), cleanup: [],
      timer: 0, frame: 0, phase: 0, previousAttribute: document.documentElement.getAttribute('data-space-skin'),
      lastFocus: document.activeElement, videoFailed: false, videoBlocked: false, artFailed: false,
      playingRequest: false, playGeneration: 0, emblems: [], emblemHeadings: new WeakMap()
    };
    s.backdrop = el('div', 't3-space-backdrop');
    s.backdrop.setAttribute('aria-hidden', 'true');
    s.backdrop.setAttribute('inert', '');
    s.visual = el('div', 't3-space-visual');
    s.art = el('img', 't3-space-art');
    s.art.alt = '';
    s.art.decoding = 'async';
    s.video = el('video', 't3-space-video');
    s.video.muted = true;
    s.video.defaultMuted = true;
    s.video.loop = true;
    s.video.playsInline = true;
    s.video.preload = 'metadata';
    s.video.setAttribute('muted', '');
    s.video.setAttribute('playsinline', '');
    s.video.setAttribute('disablepictureinpicture', '');
    s.video.tabIndex = -1;
    s.canvas = el('canvas', 't3-space-ascii');
    s.context = s.canvas.getContext('2d', { alpha: true });
    s.visual.append(s.art, s.video, s.canvas);
    var shade = el('div', 't3-space-shade');
    var caption = el('div', 't3-space-caption');
    caption.append(el('span', '', 'T3 CODE THEMES'), el('span', '', 'RING STUDY / DECORATIVE ART'));
    s.backdrop.append(s.visual, shade, caption);
    s.controls = el('section', 't3-space-controls');
    s.controls.setAttribute('aria-label', 'Skin');
    s.toggle = el('button', 't3-space-toggle', '◌  Skin');
    s.toggle.type = 'button';
    s.toggle.setAttribute('aria-expanded', 'false');
    s.toggle.setAttribute('aria-controls', 't3-space-settings');
    s.panel = el('div', 't3-space-panel');
    s.panel.id = 't3-space-settings';
    s.panel.hidden = true;
    var heading = el('div', 't3-space-heading');
    heading.append(el('strong', '', 'Skin'), el('span', '', 'YOUR WORK, IN ORBIT'));
    var modes = el('div', 't3-space-modes');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Background mode');
    s.modeButtons = MODES.map(function (mode) {
      var button = el('button', '', mode === 'ascii' ? 'ASCII' : mode[0].toUpperCase() + mode.slice(1));
      button.type = 'button';
      button.setAttribute('aria-pressed', String(mode === s.mode));
      listen(s, button, 'click', function () { api.setMode(mode); });
      modes.append(button);
      return button;
    });
    var actions = el('div', 't3-space-actions');
    s.pauseButton = el('button', '', 'Pause motion');
    s.pauseButton.type = 'button';
    s.focusButton = el('button', '', 'Focus mode');
    s.focusButton.type = 'button';
    actions.append(s.pauseButton, s.focusButton);
    var intensity = el('label', 't3-space-intensity');
    intensity.append(el('span', '', 'Artwork intensity'));
    s.output = el('output', '', '65%');
    s.range = el('input');
    s.range.type = 'range'; s.range.min = '0'; s.range.max = '100'; s.range.step = '1';
    s.range.value = String(s.intensity);
    s.range.setAttribute('aria-label', 'Artwork intensity');
    intensity.append(s.output, s.range);
    s.status = el('p', 't3-space-status');
    s.status.setAttribute('role', 'status');
    s.status.setAttribute('aria-live', 'polite');
    var footer = el('div', 't3-space-footer');
    var close = el('button', '', 'Close'); close.type = 'button';
    var off = el('button', 't3-space-off', 'Off · restore app'); off.type = 'button';
    footer.append(close, off);
    s.panel.append(heading, modes, actions, intensity, s.status, footer);
    s.controls.append(s.toggle, s.panel);
    function collapse() { s.panel.hidden = true; s.toggle.setAttribute('aria-expanded', 'false'); }
    listen(s, s.toggle, 'click', function () {
      s.panel.hidden = !s.panel.hidden;
      s.toggle.setAttribute('aria-expanded', String(!s.panel.hidden));
    });
    listen(s, close, 'click', function () { collapse(); s.toggle.focus({ preventScroll: true }); });
    listen(s, off, 'click', destroy);
    listen(s, s.pauseButton, 'click', function () { api.setPaused(!s.paused); });
    listen(s, s.focusButton, 'click', function () { api.setFocus(!s.focus); });
    listen(s, s.range, 'input', function () { api.setIntensity(s.range.value); });
    listen(s, s.controls, 'keydown', function (event) {
      if (event.key === 'Escape' && !s.panel.hidden) {
        event.preventDefault(); event.stopPropagation(); collapse(); s.toggle.focus({ preventScroll: true });
      }
    });
    listen(s, document, 'pointerdown', function (event) { if (!s.controls.contains(event.target)) collapse(); });
    listen(s, document, 'focusin', function (event) {
      if (!s.controls.contains(event.target)) { s.lastFocus = event.target; collapse(); }
    });
    listen(s, document, 'visibilitychange', sync);
    listen(s, s.motion, 'change', sync);
    listen(s, window, 'resize', function () { if (s.mode === 'ascii' && !document.hidden) renderAscii(s); });
    listen(s, s.video, 'error', function () { s.videoFailed = true; sync(); });
    listen(s, s.art, 'error', function () { s.artFailed = true; sync(); });
    listen(s, s.video, 'playing', function () {
      if (current !== s || stopped(s) || s.mode !== 'cinema') { s.video.pause(); return; }
      s.video.dataset.ready = 'true';
    });
    s.art.src = new URL('space-art.png', base).href;
    s.video.poster = s.art.src;
    s.video.src = new URL('space-video.mp4', base).href;
    document.body.prepend(s.backdrop);
    document.body.append(s.controls);
    document.documentElement.setAttribute('data-space-skin', 'on');
    attachWelcomeEmblem(s, document.body);
    var welcomeObserver = new MutationObserver(function (records) {
      records.forEach(function (record) { attachWelcomeEmblem(s, record.target); });
    });
    welcomeObserver.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
    s.cleanup.push(function () { welcomeObserver.disconnect(); s.emblems.forEach(function (emblem) { emblem.remove(); }); });
    sync();
    return api;
  }

  function stopFrames(s) {
    window.clearTimeout(s.timer); window.cancelAnimationFrame(s.frame);
    s.timer = 0; s.frame = 0;
  }
  function sync() {
    var s = current;
    if (!s) return;
    stopFrames(s);
    s.backdrop.dataset.mode = s.mode;
    s.backdrop.dataset.focus = String(s.focus);
    if (s.videoFailed || s.videoBlocked) delete s.video.dataset.ready;
    s.visual.style.opacity = String((s.focus ? 0.18 : 1) * s.intensity / 100);
    s.modeButtons.forEach(function (button, index) { button.setAttribute('aria-pressed', String(MODES[index] === s.mode)); });
    s.pauseButton.textContent = s.paused ? 'Resume motion' : 'Pause motion';
    s.pauseButton.setAttribute('aria-pressed', String(s.paused));
    s.focusButton.setAttribute('aria-pressed', String(s.focus));
    s.range.value = String(s.intensity); s.output.textContent = Math.round(s.intensity) + '%';
    s.range.setAttribute('aria-valuetext', Math.round(s.intensity) + ' percent');
    var reason = s.motion.matches ? 'Reduced motion · still background' : s.focus ? 'Focus mode · still and dimmed' : s.paused ? 'Motion paused' : document.hidden ? 'Paused while tab is hidden' : s.intensity === 0 ? 'Artwork hidden · motion paused' : s.mode === 'artwork' ? 'Original artwork · still background' : s.mode === 'ascii' ? 'Coded ring study · 8 fps maximum' : 'Cinema · muted looping background';
    if (s.mode === 'cinema' && (s.videoFailed || s.videoBlocked)) reason = 'Video unavailable · artwork fallback';
    if (s.artFailed && s.mode === 'artwork') reason = 'Artwork unavailable · ink background';
    s.status.textContent = reason;
    if (s.mode !== 'cinema' || stopped(s) || s.videoFailed || s.videoBlocked) {
      s.playGeneration += 1; s.playingRequest = false; s.video.pause();
    } else if (s.video.paused && !s.playingRequest) {
      s.playingRequest = true;
      var generation = ++s.playGeneration;
      var play = s.video.play();
      if (play && typeof play.then === 'function') {
        play.then(function () {
          if (current !== s || generation !== s.playGeneration || stopped(s) || s.mode !== 'cinema') {
            if (current !== s || stopped(s) || s.mode !== 'cinema') s.video.pause();
            return;
          }
          s.playingRequest = false;
        }).catch(function () {
          if (current !== s || generation !== s.playGeneration) return;
          s.playingRequest = false; s.videoBlocked = true; sync();
        });
      } else { s.playingRequest = false; }
    }
    if (s.mode === 'ascii' && !document.hidden) {
      renderAscii(s);
      if (!stopped(s)) scheduleAscii(s);
    }
  }
  function scheduleAscii(s) {
    s.timer = window.setTimeout(function () {
      s.timer = 0;
      if (current !== s || stopped(s) || s.mode !== 'ascii') return;
      s.frame = window.requestAnimationFrame(function () {
        s.frame = 0;
        if (current !== s || stopped(s) || s.mode !== 'ascii') return;
        s.phase += 0.018; renderAscii(s); scheduleAscii(s);
      });
    }, 125);
  }

  function renderAscii(s) {
    var ctx = s.context;
    if (!ctx) return;
    // Fixed cell budget, capped backing resolution, no full-speed rAF loop.
    var w = Math.min(window.innerWidth, 1600), h = Math.min(window.innerHeight, 1000);
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (s.canvas.width !== cw || s.canvas.height !== ch) { s.canvas.width = cw; s.canvas.height = ch; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    var cell = Math.max(8, w / 150), stepY = cell * 1.7;
    var radius = Math.min(w * 0.25, h * 0.33), cx = w * 0.71, cy = h * 0.39;
    ctx.font = Math.floor(cell * 1.55) + 'px ui-monospace, Consolas, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    var ramp = ' .,:;+=xX#@';
    for (var y = stepY / 2, row = 0; y < h; y += stepY, row++) {
      for (var x = cell / 2, col = 0; x < w; x += cell, col++) {
        var px = (x - cx) / radius, py = (y - cy) / radius;
        var distance = px * px + py * py;
        var rx = px * 0.956 - py * 0.292, ry = px * 0.292 + py * 0.956;
        var ring = rx * rx / 3.8 + ry * ry / 0.21;
        var glyph = '', alpha = 0;
        if (distance < 1) {
          var z = Math.sqrt(1 - distance);
          var light = Math.max(0, -px * 0.48 - py * 0.38 + z * 0.72);
          var band = (Math.sin(py * 38 + s.phase + Math.sin(px * 7) * 0.4) + 1) * 0.09;
          glyph = ramp[Math.min(ramp.length - 1, Math.floor((light * 0.8 + band) * (ramp.length - 1)))];
          alpha = 0.26 + light * 0.68;
        }
        if (ring > 0.78 && ring < 1.38 && (distance >= 1 || ry > 0.08)) {
          glyph = ring > 1.14 && ring < 1.20 ? '.' : ['=', '+', ':'][Math.abs(Math.floor(ring * 45)) % 3];
          alpha = 0.48 + Math.sin(ring * 60) * 0.2;
        }
        var hash = ((col * 374761393 + row * 668265263) >>> 0);
        hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
        if (!glyph && hash % 173 === 0) { glyph = hash % 7 === 0 ? '+' : '.'; alpha = 0.22 + (hash % 5) * 0.07; }
        if (glyph && glyph !== ' ') { ctx.fillStyle = 'rgba(139,222,229,' + alpha + ')'; ctx.fillText(glyph, x, y); }
      }
    }
  }

  function destroy() {
    var s = current;
    if (!s) return api;
    current = null;
    stopFrames(s); s.playGeneration += 1;
    s.cleanup.forEach(function (remove) { remove(); });
    var restoreFocus = s.controls.contains(document.activeElement);
    s.video.pause(); s.video.removeAttribute('src'); s.video.removeAttribute('poster'); s.video.load();
    s.art.removeAttribute('src'); s.backdrop.remove(); s.controls.remove();
    if (document.documentElement.getAttribute('data-space-skin') === 'on') {
      if (s.previousAttribute === null) document.documentElement.removeAttribute('data-space-skin');
      else document.documentElement.setAttribute('data-space-skin', s.previousAttribute);
    }
    if (restoreFocus && s.lastFocus && s.lastFocus.isConnected && typeof s.lastFocus.focus === 'function') s.lastFocus.focus({ preventScroll: true });
    return api;
  }
  window.T3SpaceSkin = api;
})();
