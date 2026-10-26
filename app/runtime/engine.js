/* T3 Skin Engine v3. Live, reversible themes for the real T3 web client.
 *
 * Two kinds of items:
 *   theme  (t3theme/1)  tokens + typography + shape + icons + loaders + layout touches, and sandboxed
 *                       scene.js / welcome.js code running in runtime/sandbox.js (no access to T3).
 *   skin   (v2)         palette + built-in WebGL scene + particles + image/video plate (unchanged from v2).
 *
 * Layers, back to front: scene (sandbox iframe or v2 canvas/plate/particles) -> overlay effect -> scrims
 * behind text -> T3 UI. Text regions are measured live (selectors.js) and sent to the scene as safe zones.
 * If T3's markup changes so the required hooks vanish, the engine drops to tokens only (colours, fonts).
 * Requires runtime/selectors.js and runtime/sandbox.js to be loaded first. Everything is removed by destroy().
 */
(function () {
  'use strict';
  if (window.T3Skin && window.T3Skin.version === '3.0.0') return;
  var SEL = window.T3SkinSelectors, SB = window.T3SkinSandbox;
  if (!SEL || !SB) { console.warn('T3 skin: selectors.js and sandbox.js must load before engine.js'); return; }
  var current = null;
  var SCENES = { none: -1, nebula: 0, aurora: 1, dusk: 2, synth: 3, abyss: 4 };
  var MOTION = { live: { fps: 30, speed: 1, particles: 1 }, calm: { fps: 20, speed: 0.45, particles: 0.5 }, still: { fps: 0, speed: 0, particles: 0 } };
  var ROOT = "html[data-t3-skin='on']", FULL = "html[data-t3-skin='on'][data-t3-skin-mode='full']";

  var api = {
    version: '3.0.0',
    mount: mount, destroy: destroy,
    setTheme: function (id) { if (current) applyItem(current, id, true); return api; },
    setSkin: function (id) { return api.setTheme(id); },
    setMotion: function (m) { if (current && MOTION[m]) { current.motion = m; report(current); sync(current); } return api; },
    setWelcome: function (v) { if (current) { current.welcome = !!v; clearWelcomes(current); attachWelcome(current, document.body); sync(current); renderGallery(current); tell('__t3skin-welcome:', current.welcome ? 'on' : 'off'); } return api; },
    setFocus: function (v) { if (current) { current.focus = !!v; sync(current); } return api; },
    setIntensity: function (v) { if (current) { current.intensity = clamp(Number(v) || 0, 0, 100); report(current); sync(current); } return api; },
    openGallery: function (open) { if (current) setGallery(current, open !== false); return api; },
    addItems: function (items, applyId) { if (current) addItems(current, items, applyId); return api; },
    removeItem: function (id) { if (current) removeItem(current, id); return api; },
    _event: function (ev) { if (current) onLauncherEvent(current, ev); return api; },
    getState: function () {
      var s = current; if (!s) return { mounted: false };
      return { mounted: true, skin: s.item && s.item.id, kind: s.item && s.item.kind, motion: s.motion, focus: s.focus, intensity: s.intensity,
        mode: s.mode, health: s.health, webgl: !!s.gl, running: !!s.raf || !!(s.box && s.box.status === 'ok' && !stopped(s)),
        fps: s.box ? s.box.fps : s.fpsMeasured, frameCost: s.box ? s.box.cost : null, scene: s.box ? { status: s.box.status, msg: s.box.msg } : s.sceneError ? { status: 'error', msg: s.sceneError } : null,
        zones: s.zones.map(function (z) { return z.kind + ' ' + [z.x, z.y, z.w, z.h].map(Math.round).join(','); }),
        welcome: s.welcomes.length, items: s.items.map(function (k) { return k.id; }), skins: s.items.map(function (k) { return k.id; }) };
    }
  };
  api.getUiTheme = function () {
    if (!current || !current.item) return null;
    var p = palOf(current.item), t = uiOf(current.item);
    return { appearance: t.appearance, bg: p.bg, surface: p.surface, text: p.text, muted: p.muted,
      accent: p.accent, accent2: p.accent2, onAccent: p.onAccent, border: p.border, codeBg: p.codeBg, font: t.fonts.ui || '', radius: t.shape.radius };
  };

  /* ---------- helpers ---------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
  function listen(s, t, type, fn, o) { t.addEventListener(type, fn, o); s.cleanup.push(function () { t.removeEventListener(type, fn, o); }); }
  function hex(c) { c = String(c || '#000').replace('#', ''); if (c.length === 3) c = c.split('').map(function (x) { return x + x; }).join(''); var n = parseInt(c.slice(0, 6), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function toHex(rgb) { return '#' + rgb.map(function (v) { return ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2); }).join(''); }
  function mix(a, b, t) { a = hex(a); b = hex(b); return toHex(a.map(function (v, i) { return v + (b[i] - v) * t; })); }
  function rgba(c, a) { var v = hex(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }
  function lum(c) { var v = hex(c).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function vec3(c) { return hex(c).map(function (v) { return v / 255; }); }
  function reduced() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function q(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }
  function qa(sel) { try { return Array.prototype.slice.call(document.querySelectorAll(sel)); } catch (e) { return []; } }
  function cssUrl(u) { return 'url("' + String(u).replace(/["\\\n]/g, '') + '")'; }
  // Channel to the launcher (it listens for console messages with these prefixes). Carries only UI state.
  function tell(prefix, payload) { if (!current || !current.launcher) return; try { console.debug(prefix + (payload === undefined ? '' : (typeof payload === 'string' ? payload : JSON.stringify(payload)))); } catch (e) {} }
  function report(s) { tell('__t3skin:', { skin: s.item && s.item.id, motion: s.motion, intensity: s.intensity }); }

  /* ---------- palette & tokens ---------- */
  function palOf(item) {
    var p = item.kind === 'theme' ? item.theme.palette : item.uiTheme ? item.uiTheme.palette : item.palette;
    var bg = p.bg, text = p.text || (lum(bg) > 0.4 ? '#16161a' : '#f2f2f5'), surf = p.surface || mix(bg, text, 0.06);
    var acc = p.accent, onAcc = p.onAccent || (contrast('#111111', acc) >= contrast('#ffffff', acc) ? '#111111' : '#ffffff');
    return { bg: bg, surface: surf, text: text, muted: p.muted || mix(text, bg, 0.38), accent: acc, accent2: p.accent2 || acc,
      border: p.border || mix(surf, text, 0.16), selection: p.selection || acc, codeBg: p.codeBg || mix(bg, '#000000', 0.35),
      codeText: p.codeText || text, onAccent: onAcc, glass: p.glass };
  }
  function uiOf(item) {
    if (item.kind === 'theme') return item.theme;
    if (item.uiTheme) return item.uiTheme;
    // v2 skins keep their v2 look: glass panels, soft shadow, gradient project name.
    return { appearance: lum(item.palette.bg) > 0.4 ? 'light' : 'dark', fonts: {}, shape: { radius: 10, density: 'normal', borderWidth: 1 },
      ui: { surface: 'glass', glass: item.palette.glass != null ? item.palette.glass : 0.72, blur: 16, shadow: 'soft', topbar: 'glass', sidebarSide: 'left',
        decor: 'none', textGlow: false, overlay: 'none', heroStyle: 'plain', cursorLight: false, hideStageArt: true },
      icons: { style: 'default', color: 'text', custom: [] }, loader: { style: 'spin' }, motion: { fps: 30, resolution: 0.75, interactive: false },
      textSafety: { scrim: 0.4, heroScrim: 0.25, blur: 4, busy: 'medium' } };
  }
  // Colour helpers for derived tokens: hue rotation in HSL and "nudge toward the text colour until readable".
  function toHsl(c) {
    var v = hex(c).map(function (x) { return x / 255; }), mx = Math.max.apply(null, v), mn = Math.min.apply(null, v), l = (mx + mn) / 2, h = 0, sat = 0, d = mx - mn;
    if (d) { sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === v[0] ? (v[1] - v[2]) / d + (v[1] < v[2] ? 6 : 0) : mx === v[1] ? (v[2] - v[0]) / d + 2 : (v[0] - v[1]) / d + 4; h *= 60; }
    return [h, sat, l];
  }
  function fromHsl(h, sat, l) {
    h = ((h % 360) + 360) % 360 / 360;
    function f(t) { t = (t + 1) % 1; var q2 = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p2 = 2 * l - q2; return t < 1 / 6 ? p2 + (q2 - p2) * 6 * t : t < 0.5 ? q2 : t < 2 / 3 ? p2 + (q2 - p2) * (2 / 3 - t) * 6 : p2; }
    return toHex([f(h + 1 / 3), f(h), f(h - 1 / 3)].map(function (x) { return x * 255; }));
  }
  function readable(c, toward, on, min) { for (var k = 0; k <= 1.001; k += 0.08) { var m = mix(c, toward, k); if (contrast(m, on) >= min) return m; } return toward; }
  // Syntax colours for chat code blocks, derived from the theme so each theme highlights code in its own voice.
  function syntaxColors(p, light) {
    var base = p.codeBg, fg = p.codeText;
    function tone(c, rot, satMin) { var h = toHsl(c); return fromHsl(h[0] + (rot || 0), Math.max(h[1], satMin || 0.45), light ? Math.min(Math.max(h[2], 0.26), 0.4) : Math.min(Math.max(h[2], 0.64), 0.8)); }
    function ok(c) { return readable(c, fg, base, 4.6); }
    return { kw: ok(tone(p.accent)), str: ok(tone(p.accent2)), fn: ok(tone(p.accent, 38)), num: ok(tone(p.accent2, -42)), type: ok(tone(p.accent, -64)),
      vari: ok(mix(fg, tone(p.accent2, 20), 0.4)), tag: ok(tone(p.accent2, 34)), cmt: readable(mix(fg, base, 0.5), fg, base, 4.6), punc: readable(mix(fg, base, 0.22), fg, base, 7) };
  }
  // Common token colours of T3's built-in Shiki themes (GitHub, GitHub default, Dark+/Light+) mapped to roles.
  var SHIKI = { kw: 'F97583 D73A49 FF7B72 CF222E 569CD6 C586C0 0000FF AF00DB', str: '9ECBFF 032F62 A5D6FF 0A3069 CE9178 A31515', fn: 'B392F0 6F42C1 D2A8FF 8250DF DCDCAA 795E26',
    num: '79B8FF 005CC5 79C0FF 0550AE B5CEA8 098658', cmt: '6A737D 8B949E 6E7781 6A9955 008000', vari: 'FFAB70 E36209 FFA657 953800 9CDCFE 001080', type: '85E89D 22863A 7EE787 116329 4EC9B0 267F99' };
  function syntaxCss() {
    var sh = ROOT + ' .chat-markdown-shiki', out = [sh + ' :is(pre,code,span){color:var(--t3s-syn-punc) !important}', sh + ' span[style]{color:var(--t3s-code-text) !important}'];
    Object.keys(SHIKI).forEach(function (role) {
      out.push(SHIKI[role].split(' ').map(function (c) { return sh + ' span[style*="#' + c + '" i]'; }).join(',') + '{color:var(--t3s-syn-' + role + ') !important' + (role === 'cmt' ? ';font-style:italic' : '') + '}');
    });
    return out.join('\n');
  }
  function tokensCss(item) {
    var p = palOf(item), t = uiOf(item), light = t.appearance === 'light';
    var bg = p.bg, surf = p.surface, text = p.text, muted = p.muted, acc = p.accent, acc2 = p.accent2, border = p.border;
    var raised = mix(surf, text, 0.04), accSurf = mix(surf, acc, 0.22), rowHover = mix(surf, text, 0.05), rowSelected = mix(surf, text, 0.10), input = mix(border, acc, 0.25), glassA = t.ui.surface === 'solid' ? 0.97 : t.ui.surface === 'paper' ? 0.94 : t.ui.glass;
    var actionHover = mix(acc, p.onAccent, 0.06);
    if (contrast(actionHover, p.onAccent) < 4.5) actionHover = acc;
    // Selected/hovered rows: a quiet accent tint over the panel, kept only while the label stays at 7:1.
    [light ? 0.16 : 0.2, 0.12, 0.08].some(function (k) { var c = mix(surf, acc, k); if (contrast(text, c) >= 7) { rowSelected = c; return true; } return false; });
    if (contrast(text, mix(surf, acc, 0.07)) >= 7) rowHover = mix(surf, acc, 0.07);
    var link = readable(acc, text, surf, 4.5), syn = syntaxColors(p, light);
    var v = {
      '--background': bg, '--foreground': text, '--card': surf, '--card-foreground': text, '--popover': raised,
      '--popover-foreground': text, '--primary': acc, '--primary-foreground': p.onAccent, '--secondary': mix(surf, acc, 0.1),
      '--secondary-foreground': text, '--muted': mix(surf, bg, 0.3), '--muted-foreground': muted, '--accent': accSurf,
      '--placeholder': muted, '--secondary-label': muted, '--icon-muted': muted,
      '--message-surface': surf, '--message-foreground': text, '--message-action': acc,
      '--message-action-foreground': p.onAccent, '--message-action-hover': actionHover,
      '--code-background': p.codeBg, '--code-foreground': p.codeText,
      '--toolbar-background': surf, '--toolbar-foreground': muted, '--toolbar-control': raised,
      '--toolbar-control-foreground': text, '--toolbar-control-hover': accSurf, '--toolbar-border': border,
      '--appearance-contrast-target': light ? '#000000' : '#ffffff',
      '--accent-foreground': text, '--border': border, '--input': input, '--ring': acc, '--sidebar': bg,
      '--sidebar-foreground': text, '--sidebar-muted-foreground': muted, '--sidebar-border': border,
      '--sidebar-control-surface': surf, '--sidebar-row-hover': rowHover, '--sidebar-row-active': rowSelected,
      '--sidebar-row-selected': rowSelected, '--sidebar-stage-fade': bg, '--surface-raised': raised,
      '--app-theme-canvas': bg, '--app-theme-text': text, '--app-theme-surface': surf, '--app-theme-surface-raised': raised,
      '--app-theme-surface-overlay': raised, '--app-theme-muted': mix(surf, bg, 0.3), '--app-theme-muted-foreground': muted,
      '--app-theme-placeholder': muted, '--app-theme-secondary-label': muted, '--app-theme-icon-muted': muted,
      '--app-theme-secondary': mix(surf, acc, 0.1), '--app-theme-secondary-foreground': text,
      '--app-theme-message-surface': surf, '--app-theme-message-action': acc,
      '--app-theme-message-action-foreground': p.onAccent, '--app-theme-message-action-hover': actionHover,
      '--app-theme-code-background': p.codeBg, '--app-theme-code-foreground': p.codeText, '--app-theme-focus': acc,
      '--app-theme-border': border, '--app-theme-input': input, '--app-theme-accent-surface': accSurf,
      '--app-theme-accent-surface-foreground': text, '--app-theme-sidebar': bg, '--app-theme-sidebar-foreground': text,
      '--app-theme-sidebar-muted-foreground': muted, '--app-theme-sidebar-control-surface': surf,
      '--app-theme-sidebar-row-hover': rowHover, '--app-theme-sidebar-row-active': rowSelected,
      '--app-theme-sidebar-row-selected': rowSelected, '--app-theme-sidebar-border': border,
      '--app-theme-toolbar-foreground': muted, '--app-theme-toolbar-control-foreground': muted,
      '--app-theme-toolbar-background': surf, '--app-theme-toolbar-control': raised, '--app-theme-toolbar-control-hover': accSurf,
      '--app-theme-toolbar-border': border, '--app-theme-message-foreground': text,
      '--t3s-bg': bg, '--t3s-surface': surf, '--t3s-text': text, '--t3s-muted': muted, '--t3s-accent': acc,
      '--t3s-accent2': acc2, '--t3s-border': border, '--t3s-glass': rgba(surf, glassA),
      '--t3s-glass-strong': rgba(mix(surf, bg, 0.3), Math.max(0.9, glassA)), '--t3s-glow': rgba(acc, 0.45), '--t3s-glow2': rgba(acc2, 0.35),
      '--t3s-on-accent': p.onAccent, '--t3s-code-bg': p.codeBg, '--t3s-code-text': p.codeText, '--t3s-selection': rgba(p.selection, 0.4),
      '--t3s-radius': t.shape.radius + 'px', '--t3s-bw': t.shape.borderWidth + 'px', '--t3s-blur': t.ui.blur + 'px',
      '--t3s-shadow-ink': light ? rgba(mix(text, bg, 0.1), 1) : 'rgba(0,0,0,.85)', '--t3s-soft-shadow': light ? 'rgb(30 20 60 / 14%)' : 'rgb(0 0 0 / 38%)',
      '--radius': (t.shape.radius / 16).toFixed(3) + 'rem', '--t3s-link': link, '--t3s-row-selected': rowSelected,
      // T3's canvas terminal reads these when it (re)builds its theme; it uses the code colours, a validated pair.
      '--terminal-background': p.codeBg, '--terminal-foreground': p.codeText, '--terminal-cursor': acc, '--terminal-selection-background': rgba(p.selection, 0.35),
      '--app-theme-terminal-background': p.codeBg, '--app-theme-terminal-foreground': p.codeText, '--app-theme-terminal-cursor': acc,
      '--app-theme-terminal-selection-background': rgba(p.selection, 0.35)
    };
    Object.keys(syn).forEach(function (k) { v['--t3s-syn-' + k] = syn[k]; });
    if (t.shape.density === 'compact') v['--spacing'] = '.23rem'; else if (t.shape.density === 'roomy') v['--spacing'] = '.27rem';
    if (t.fonts.ui) v['--font-sans'] = t.fonts.ui;
    if (t.fonts.mono) v['--font-mono'] = t.fonts.mono;
    v['--t3s-font-display'] = t.fonts.display || t.fonts.ui || 'inherit';
    // T3 redeclares semantic colours on the sidebar. An important root variable does not override a local one.
    return ROOT + '{color-scheme:' + (light ? 'light' : 'dark') + ';background:' + bg + ' !important;}' +
      ROOT + ',' + ROOT + ' ' + SEL.layout.sidebarPalette.sel + '{' + Object.keys(v).map(function (k) { return k + ':' + v[k] + ' !important'; }).join(';') + '}' +
      (t.fonts.ui ? ROOT + ' body{font-family:var(--font-sans) !important}' : '') +
      ROOT + ' ::selection{background:var(--t3s-selection)}' +
      // The terminal picks its ANSI palette (light or dark) from the computed color-scheme of its drawer.
      ROOT + ' :is([data-thread-terminal-drawer],[data-thread-terminal-drawer] *){color-scheme:' + (light ? 'light' : 'dark') + ' !important}' +
      ROOT + ' *{scrollbar-color:' + rgba(acc, 0.45) + ' transparent}';
  }
  function fontFaceCss(s, item) {
    if (item.kind !== 'theme' || !item.theme.fonts.files || !item.theme.fonts.files.length) return '';
    return item.theme.fonts.files.map(function (f) {
      return '@font-face{font-family:"' + f.family + '";src:' + cssUrl(themeAsset(s, item, f.file)) + ';font-weight:' + (f.weight || '400') + ';font-style:' + (f.style || 'normal') + ';font-display:swap}';
    }).join('');
  }
  // Structural CSS is generated from the selector map so a T3 markup change only needs selectors.js.
  function structuralCss(item) {
    var t = uiOf(item), u = t.ui, L = SEL.layout, out = [];
    function r(sel, body, root) { out.push((root || FULL) + ' :is(' + sel + '){' + body + '}'); }
    out.push(FULL + ' body{background:transparent !important;isolation:isolate}');
    // Transparency is a base layer; #root in this list must not outrank the header/panel treatments below.
    r(':where(' + SEL.transparent.join(',') + ')', 'background:transparent !important');
    r(L.inset.sel, 'color:var(--t3s-text)');
    var glass = 'background:var(--t3s-glass) !important;-webkit-backdrop-filter:blur(var(--t3s-blur)) saturate(1.2);backdrop-filter:blur(var(--t3s-blur)) saturate(1.2)';
    r(L.sidebarInner.sel + ",[data-slot='sidebar'][data-mobile='true']", glass + ';border-color:var(--t3s-border) !important');
    r(L.sidebarContainer.sel, 'border-color:var(--t3s-border) !important;border-right-width:var(--t3s-bw) !important');
    r(L.details.sel, 'border-radius:calc(var(--t3s-radius) * 1.2)');
    var hdr = { glass: 'background:color-mix(in srgb,var(--t3s-surface) 62%,transparent) !important;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:var(--t3s-bw) solid color-mix(in srgb,var(--t3s-accent) 20%,transparent)',
      solid: 'background:var(--t3s-surface) !important;border-bottom:var(--t3s-bw) solid var(--t3s-border)',
      transparent: 'background:transparent !important;border-bottom:0',
      'accent-line': 'background:color-mix(in srgb,var(--t3s-bg) 70%,transparent) !important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:calc(var(--t3s-bw) + 1px) solid var(--t3s-accent)' }[u.topbar];
    r(L.header.sel, hdr);
    var sh = { none: 'none', soft: '0 10px 40px var(--t3s-soft-shadow)', hard: '5px 5px 0 var(--t3s-shadow-ink)', glow: '0 0 0 1px var(--t3s-accent),0 0 26px var(--t3s-glow)' }[u.shadow];
    r(L.composer.sel, '--chat-composer-glass-surface:var(--t3s-glass-strong) !important;--chat-composer-outline:color-mix(in srgb,var(--t3s-accent) 45%,transparent) !important;' +
      '--chat-composer-highlight:color-mix(in srgb,var(--t3s-accent2) 8%,transparent) !important;border-radius:calc(var(--t3s-radius) * 1.6);transition:box-shadow .4s ease;' +
      'box-shadow:' + sh + (u.shadow === 'hard' ? ';outline:var(--t3s-bw) solid var(--t3s-shadow-ink);outline-offset:-1px' : ''));
    // Keep the editing plane opaque and unfiltered. Blurring its ancestor makes scrolling content bleed through the text.
    r(L.composerSurface.sel, 'background-color:var(--t3s-surface) !important;color:var(--t3s-text);' +
      '-webkit-backdrop-filter:none !important;backdrop-filter:none !important;border-radius:calc(var(--t3s-radius) * 1.6)');
    r(L.composerEditor.sel, 'color:var(--t3s-text) !important;caret-color:var(--t3s-text);text-shadow:none');
    r(L.composer.sel + ':focus-within', 'box-shadow:' + (u.shadow === 'hard' ? '6px 6px 0 var(--t3s-accent)' : (sh === 'none' ? '' : sh + ',') + '0 0 0 2px var(--t3s-accent)'));
    r(L.composerAction.sel, 'background:var(--message-action) !important;color:var(--message-action-foreground) !important', ROOT);
    r(L.composerAction.sel + ':enabled:hover', 'background:var(--message-action-hover) !important', ROOT);
    r(L.composerAction.sel + ' [data-stage-art]', 'display:none !important', ROOT);
    r(L.composerAction.sel + ' svg', 'color:inherit !important;filter:none !important', ROOT);
    r(L.composerAction.sel + ':focus-visible', 'outline:2px solid var(--t3s-accent);outline-offset:3px', ROOT);
    r(L.activeThread.sel, 'color:var(--t3s-text) !important;background:var(--sidebar-row-active) !important;box-shadow:none;border-radius:6px');
    if (u.decor === 'brackets') r(L.composerSurface.sel, 'background-image:linear-gradient(var(--t3s-accent),var(--t3s-accent)),linear-gradient(var(--t3s-accent),var(--t3s-accent)),linear-gradient(var(--t3s-accent),var(--t3s-accent)),linear-gradient(var(--t3s-accent),var(--t3s-accent)),linear-gradient(var(--t3s-accent),var(--t3s-accent)),linear-gradient(var(--t3s-accent),var(--t3s-accent)),linear-gradient(var(--t3s-accent),var(--t3s-accent)),linear-gradient(var(--t3s-accent),var(--t3s-accent));' +
      'background-repeat:no-repeat;background-size:14px 2px,2px 14px,14px 2px,2px 14px,14px 2px,2px 14px,14px 2px,2px 14px;background-position:6px 6px,6px 6px,calc(100% - 6px) 6px,calc(100% - 6px) 6px,6px calc(100% - 6px),6px calc(100% - 6px),calc(100% - 6px) calc(100% - 6px),calc(100% - 6px) calc(100% - 6px)');
    if (u.decor === 'stitch') r(L.composerSurface.sel, 'outline:2px dashed color-mix(in srgb,var(--t3s-accent) 70%,transparent);outline-offset:-7px');
    if (u.decor === 'double') r(L.composer.sel, 'outline:3px double var(--t3s-accent);outline-offset:3px');
    r(L.markdown.sel, 'color:var(--t3s-text)');
    r(L.codeblock.sel, 'background-color:var(--t3s-code-bg) !important;color:var(--t3s-code-text)');
    if (u.textGlow) r(L.markdown.sel + ',' + L.sidebarInner.sel + ',' + L.header.sel + ',' + L.welcomeHeading.sel, 'text-shadow:0 0 6px var(--t3s-glow)');
    if (u.uppercase) r(L.header.sel + ',' + L.welcomeHeading.sel, 'text-transform:uppercase;letter-spacing:.06em');
    if (u.hideStageArt) r(L.sidebarStage.sel, 'display:none !important');
    if (u.hideStageArt) r(L.sidebarBrand.sel + ' :is(span,svg,a,button,div)', 'color:var(--t3s-text) !important');
    if (u.sidebarSide === 'right') {
      r(L.sidebarWrapper.sel, 'flex-direction:row-reverse');
      r(L.sidebarContainer.sel, 'left:auto !important;right:0 !important;border-right-width:0 !important;border-left:var(--t3s-bw) solid var(--t3s-border) !important');
    }
    // Welcome heading + project name
    var hero = L.welcomeHeading.sel;
    r(hero, 'font-family:var(--t3s-font-display)');
    if (u.heroStyle === 'gradient' || u.heroStyle === 'glow') r(L.projectTrigger.sel, 'background:linear-gradient(90deg,var(--t3s-accent),var(--t3s-accent2),var(--t3s-accent));background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent !important');
    if (u.heroStyle === 'glow') r(hero, 'text-shadow:0 0 18px var(--t3s-glow),0 0 2px var(--t3s-glow)');
    if (u.heroStyle === 'outline') r(hero, '-webkit-text-stroke:1px var(--t3s-shadow-ink);paint-order:stroke fill;font-weight:700');
    if (u.heroStyle === 'shadow') r(hero, 'text-shadow:3px 3px 0 var(--t3s-accent2);font-weight:700');
    r(L.projectTrigger.sel, 'color:var(--t3s-accent)');
    out.push(FULL + "[data-t3-skin-motion='live'] " + L.projectTrigger.sel + '{animation:t3s-sheen 6s linear infinite}');
    // Virtualized timeline rows are recycled while scrolling; entrance animations make existing text jump and fade.
    return out.join('\n');
  }
  // Craft layer: menus, popovers, inputs, code, links, scrollbars and rows follow the theme's material
  // (glass / paper / solid) and shadow style (soft / hard / glow / none), so themes differ in feel, not just colour.
  function polishCss(item) {
    var t = uiOf(item), u = t.ui, L = SEL.layout, light = t.appearance === 'light', out = [];
    function r(sel, body, root) { out.push((root || ROOT) + ' :is(' + sel + '){' + body + '}'); }
    var pops = "[data-slot='menu-popup'],[data-slot='popover-popup'],[data-slot='select-popup'],[data-slot='sheet-popup'],[data-slot='dialog-popup']";
    var hard = u.shadow === 'hard', glow = u.shadow === 'glow';
    var popShadow = hard ? '4px 4px 0 var(--t3s-shadow-ink)' : glow ? '0 0 0 1px color-mix(in srgb,var(--t3s-accent) 45%,transparent),0 18px 48px -16px var(--t3s-glow)' :
      u.shadow === 'none' ? '0 6px 18px -8px var(--t3s-soft-shadow)' : '0 24px 56px -18px var(--t3s-soft-shadow),0 4px 14px -6px var(--t3s-soft-shadow)';
    var sheen = light ? 'inset 0 1px 0 rgb(255 255 255 / 70%)' : 'inset 0 1px 0 rgb(255 255 255 / 6%)';
    var popBg = u.surface === 'glass' ? 'color-mix(in srgb,var(--t3s-surface) 88%,transparent)' : 'var(--t3s-surface)';
    r(pops, 'background:' + popBg + ' !important;color:var(--t3s-text) !important;border:var(--t3s-bw) solid ' + (hard ? 'var(--t3s-shadow-ink)' : 'var(--t3s-border)') + ' !important;' +
      'border-radius:calc(var(--t3s-radius) * .75 + 4px) !important;box-shadow:' + (hard ? popShadow : sheen + ',' + popShadow) + ' !important;' +
      (u.surface === 'glass' ? '-webkit-backdrop-filter:blur(18px) saturate(1.35);backdrop-filter:blur(18px) saturate(1.35);' : ''));
    r("[data-slot='dialog-popup']", 'border-radius:calc(var(--t3s-radius) * 1.1 + 6px) !important');
    r(":is(" + pops + ") :is([data-highlighted],[role='option'][aria-selected='true'])", 'background:color-mix(in srgb,var(--t3s-accent) ' + (light ? 14 : 18) + '%,transparent) !important;color:var(--t3s-text) !important;border-radius:calc(var(--t3s-radius) * .5 + 2px)');
    r("[data-slot='separator']", 'background:color-mix(in srgb,var(--t3s-border) 80%,transparent) !important');
    r("[data-slot='kbd']", 'font-family:var(--font-mono,ui-monospace);background:color-mix(in srgb,var(--t3s-surface) 86%,var(--t3s-text)) !important;border:1px solid var(--t3s-border);border-bottom-width:2px;border-radius:5px;color:var(--t3s-muted)');
    r("[data-slot='badge']", 'border-radius:999px');
    // Inputs: one consistent focus ring in the accent colour.
    var fields = "[data-slot='input'],[data-slot='input-control'],[data-slot='textarea-control'],[data-slot='select-trigger'],[data-slot='combobox-input'],[data-slot='autocomplete-input'],[data-slot='input-group']";
    r(fields, 'transition:border-color .15s ease,box-shadow .15s ease');
    r(':is(' + fields + '):focus-visible,:is(' + fields + '):focus-within', 'border-color:var(--t3s-accent) !important;box-shadow:0 0 0 3px color-mix(in srgb,var(--t3s-accent) 26%,transparent) !important;outline:none');
    r("button[data-slot='button'],[data-slot='toggle']", 'transition:background-color .15s ease,border-color .15s ease,box-shadow .15s ease,transform .12s ease');
    r("button[data-slot='button']:active:not(:disabled)", 'transform:translateY(1px)');
    r("button[data-slot='button']:focus-visible,[data-slot='toggle']:focus-visible", 'outline:2px solid var(--t3s-accent) !important;outline-offset:2px');
    // Sidebar rows: quiet accent tint plus a small pill marker on the current conversation.
    r(L.menuButton.sel + ',' + "[data-thread-item] [role='button']", 'transition:background-color .15s ease,color .15s ease');
    r(L.activeThread.sel, 'position:relative;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--t3s-accent) 18%,transparent) !important');
    r(L.activeThread.sel + '::before', "content:'';position:absolute;left:3px;top:28%;bottom:28%;width:3px;border-radius:3px;background:var(--t3s-accent);opacity:.85");
    // Chat content: links, inline code, blocks, quotes, tables.
    r(L.markdown.sel + ' a', 'color:var(--t3s-link) !important;text-decoration-color:color-mix(in srgb,var(--t3s-link) 45%,transparent) !important;text-underline-offset:3px');
    r(L.markdown.sel + ' a:hover', 'text-decoration-color:var(--t3s-link) !important');
    r(L.markdown.sel + ' :not(pre) > code', 'background:color-mix(in srgb,var(--t3s-accent) 10%,var(--t3s-code-bg)) !important;color:var(--t3s-code-text) !important;' +
      'border:1px solid color-mix(in srgb,var(--t3s-accent) 20%,var(--t3s-border));border-radius:calc(var(--t3s-radius) * .3 + 3px);padding:.06em .36em;font-size:.9em');
    // Frame only the outer block; Shiki's inner <pre> stays flat inside it.
    r('.chat-markdown-codeblock pre,.chat-markdown-shiki pre', 'border:0 !important;box-shadow:none !important;background-color:transparent !important');
    r('.chat-markdown-codeblock,.chat-markdown pre:not(.chat-markdown-codeblock pre)', 'border:var(--t3s-bw) solid ' + (hard ? 'var(--t3s-shadow-ink)' : 'color-mix(in srgb,var(--t3s-border) 75%,var(--t3s-accent))') + ' !important;' +
      'border-radius:calc(var(--t3s-radius) * .6 + 4px) !important;box-shadow:' + (hard ? '3px 3px 0 var(--t3s-shadow-ink)' : glow ? '0 0 0 1px color-mix(in srgb,var(--t3s-accent) 12%,transparent),' + sheen : sheen) + ' !important');
    r(L.markdown.sel + ' blockquote', 'border-left:3px solid var(--t3s-accent) !important;background:color-mix(in srgb,var(--t3s-accent) 6%,transparent);border-radius:0 8px 8px 0;padding:.3em .9em;color:var(--t3s-text)');
    r(L.markdown.sel + ' :is(th,td)', 'border-color:var(--t3s-border) !important');
    r(L.markdown.sel + ' th', 'background:color-mix(in srgb,var(--t3s-accent) 8%,transparent)');
    r(L.markdown.sel + ' hr', 'border-color:var(--t3s-border) !important;opacity:.8');
    // Thin, theme-tinted scrollbars.
    out.push(ROOT + ' *{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--t3s-muted) ' + (light ? 40 : 34) + '%,transparent) transparent}');
    out.push(ROOT + ' .t3s-controls *{scrollbar-color:color-mix(in srgb,var(--t3s-accent) 40%,transparent) transparent}');
    // Material accents on the big panels.
    if (u.surface === 'glass') r(L.sidebarInner.sel, 'box-shadow:' + sheen + ' !important');
    if (u.surface === 'paper') r(L.sidebarInner.sel + ',' + L.composerSurface.sel, "background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.45 0 0 0 0 0.35 0 0 0 0 0.3 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")");
    // Welcome heading: balanced lines and a confident weight.
    r(L.welcomeHeading.sel, 'text-wrap:balance;letter-spacing:' + (u.uppercase ? '.06em' : '-.012em'));
    return out.join('\n') + '\n' + syntaxCss();
  }
  // Braille spinner / block snake as a mask sprite (no font needed): N frames side by side.
  var BRAILLE = [0x0B, 0x19, 0x39, 0x38, 0x3C, 0x34, 0x26, 0x27, 0x07, 0x0F];
  var BRAILLE_DOTS = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]];
  function spriteSvg(kind) {
    var frames = [], n;
    if (kind === 'braille') { n = BRAILLE.length; BRAILLE.forEach(function (bits, i) { BRAILLE_DOTS.forEach(function (d, b) { if (bits & (1 << b)) frames.push('<circle cx="' + (i * 24 + 8 + d[0] * 8) + '" cy="' + (5 + d[1] * 4.6) + '" r="1.9"/>'); }); }); }
    else { // blocks: a 3x3 snake
      var path = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]]; n = path.length;
      path.forEach(function (_, i) { for (var k = 0; k < 3; k++) { var c = path[(i + k) % n]; frames.push('<rect x="' + (i * 24 + 3 + c[0] * 6.4) + '" y="' + (3 + c[1] * 6.4) + '" width="5.4" height="5.4" opacity="' + (1 - k * 0.3) + '"/>'); } });
    }
    return { n: n, url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n * 24) + ' 24">' + frames.join('') + '</svg>') };
  }
  function iconCss(item) {
    var t = uiOf(item), out = [], st = t.icons.style;
    var all = ROOT + ' svg.lucide';
    var strokes = { bold: 'stroke-width:2.6px', thin: 'stroke-width:1.2px', pixel: 'stroke-width:2.4px;stroke-linecap:square;stroke-linejoin:miter;shape-rendering:crispEdges',
      glow: 'filter:drop-shadow(0 0 3px var(--t3s-accent))', cartoon: 'stroke-width:2.5px;filter:drop-shadow(1.5px 1.5px 0 var(--t3s-shadow-ink))' };
    if (strokes[st]) out.push(all + '{' + strokes[st] + '}');
    if (t.icons.color === 'accent') out.push(all + '{color:var(--t3s-accent)}');
    if (t.icons.color === 'muted') out.push(all + '{color:var(--t3s-muted)}');
    var svgs = item.icons || {};
    Object.keys(svgs).forEach(function (name) {
      var sel = SEL.icons[name]; if (!sel) return;
      var url = 'url("data:image/svg+xml,' + encodeURIComponent(svgs[name]).replace(/'/g, '%27') + '")';
      var targets = sel.split(',').map(function (x) { return ROOT + ' ' + x.trim(); });
      out.push(targets.join(',') + '{background-color:currentColor;-webkit-mask:' + url + ' center/contain no-repeat;mask:' + url + ' center/contain no-repeat;filter:none}');
      out.push(targets.map(function (x) { return x + ' > *'; }).join(',') + '{visibility:hidden}');
    });
    return out.join('\n');
  }
  function loaderCss(item) {
    var st = uiOf(item).loader.style, sel = SEL.loaders.split(',').map(function (x) { return ROOT + ' ' + x.trim(); });
    var all = sel.join(','), kids = sel.map(function (x) { return x + ' > *'; }).join(',');
    var css = [];
    if (st === 'spin') css.push(all + '{animation:t3s-spin 1.1s linear infinite;color:var(--t3s-accent)}');
    if (st === 'pulse') css.push(all + '{animation:t3s-pulse 1.2s ease-in-out infinite;color:var(--t3s-accent)}');
    if (st === 'bounce') css.push(all + '{animation:t3s-bounce .7s cubic-bezier(.3,0,.3,1) infinite alternate;color:var(--t3s-accent)}');
    if (st === 'orbit') {
      var o = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#000" stroke-width="1.5" opacity=".45"/><circle cx="12" cy="4" r="3"/></svg>') + '")';
      css.push(all + '{background-color:var(--t3s-accent);-webkit-mask:' + o + ' center/contain no-repeat;mask:' + o + ' center/contain no-repeat;animation:t3s-spin .9s linear infinite}', kids + '{visibility:hidden}');
    }
    if (st === 'braille' || st === 'blocks') {
      var sp = spriteSvg(st), u = 'url("' + sp.url + '")';
      css.push(all + '{background-color:var(--t3s-accent);-webkit-mask-image:' + u + ';mask-image:' + u + ';-webkit-mask-size:' + (sp.n * 100) + '% 100%;mask-size:' + (sp.n * 100) + '% 100%;' +
        '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;animation:t3s-frames-' + sp.n + ' ' + (sp.n * 0.08).toFixed(2) + 's steps(' + sp.n + ',jump-none) infinite}', kids + '{visibility:hidden}',
        '@keyframes t3s-frames-' + sp.n + '{from{-webkit-mask-position:0 0;mask-position:0 0}to{-webkit-mask-position:100% 0;mask-position:100% 0}}');
    }
    if (st === 'orbit' || st === 'braille' || st === 'blocks') css.push(ROOT + ' :is(' + SEL.layout.composerAction.sel + ') :is(' + SEL.loaders + '){background-color:var(--message-action-foreground) !important}');
    css.push(ROOT + "[data-t3-skin-motion='still'] :is(" + SEL.loaders + '){animation:none !important}');
    css.push('@media (prefers-reduced-motion:reduce){' + all + '{animation:none !important}}');
    return css.join('\n');
  }

  /* ---------- v2 skins: built-in WebGL scenes and particles (unchanged) ---------- */
  var VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FRAG = [
    'precision highp float;',
    'uniform vec2 R;uniform float T;uniform vec2 M;uniform vec3 C0,C1,C2,C3;uniform int S;uniform vec4 P;uniform float D;',
    'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*n(p);p=m*p;a*=.5;}return v;}',
    // three parallax star layers with twinkle
    'vec3 stars(vec2 uv,float dens){vec3 c=vec3(0.);for(int l=0;l<3;l++){float fl=float(l);float sc=18.+fl*22.;vec2 q=uv*sc+M*(3.+fl*4.)+fl*17.3;vec2 id=floor(q),f=fract(q)-.5;float r=h(id+fl);',
    ' if(r>1.-.07*dens){vec2 o=vec2(h(id*1.7),h(id*2.3))-.5;float d=length(f-o*.7);float tw=.55+.45*sin(T*(1.+r*3.)+r*40.);float s=smoothstep(.06-fl*.012,0.,d)*tw;',
    '  c+=mix(vec3(1.),mix(C2,C3,h(id*3.1)),.35)*s*(1.2-fl*.3);c+=C3*smoothstep(.25,0.,d)*.06*tw;}}return c;}',
    'float ridge(float x,float s,float a){return a*fbm(vec2(x*s,s*3.1))+a*.35*fbm(vec2(x*s*4.,7.));}',
    'void main(){vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;vec2 p=uv+M*.015;float t=T;vec3 col=C0;float calm=smoothstep(.1,.85,length(uv*vec2(.75,1.25)));',
    // ---- 0 nebula: domain-warped gas, planet with atmosphere + ring
    'if(S==0){float tt=t*.018;vec2 q=vec2(fbm(p*1.5+tt),fbm(p*1.5+vec2(5.2,1.3)-tt));vec2 r=vec2(fbm(p*1.5+3.5*q+vec2(1.7,9.2)+tt*1.3),fbm(p*1.5+3.5*q+vec2(8.3,2.8)));float f=fbm(p*1.5+3.5*r);',
    ' vec3 neb=mix(C0,C1,clamp(f*f*1.6,0.,1.));neb=mix(neb,C2,clamp(length(q)*.9*f,0.,1.));neb+=C3*pow(f,5.)*1.4;col=mix(C0,neb,.25+.75*calm);col+=stars(p,D);',
    ' vec2 d=(p-P.xy)/P.z;float dd=dot(d,d);vec2 rd=mat2(.94,-.34,.34,.94)*d;float ring=length(vec2(rd.x,rd.y/.22));',
    ' float band=P.w*smoothstep(1.35,1.42,ring)*smoothstep(2.35,2.2,ring)*(.45+.55*fbm(vec2(ring*26.,1.)));',
    ' float rlit=.35+.65*smoothstep(-1.5,1.,-rd.x);vec3 rc=mix(C2,C3,.55)*rlit;',
    ' float pe=smoothstep(1.,1.-2.5/(P.z*R.y),sqrt(dd));vec3 outc=col;',
    ' {float g=exp(-max(sqrt(dd)-1.,0.)*7.)*max(.15,dot(normalize(d),normalize(vec2(-.55,.45))));outc+=C2*g*.55;}',
    ' if(dd<1.){float z=sqrt(max(1.-dd,0.));vec3 nn=vec3(d,z);vec3 L=normalize(vec3(-.55,.45,.6));float dif=max(dot(nn,L),0.);',
    '  float lon=atan(nn.x,nn.z)+t*.012,lat=asin(nn.y);float bnd=fbm(vec2(lon*1.6,lat*7.)+fbm(vec2(lon*3.,lat*14.))*.6);',
    '  vec3 surf=mix(C0*1.4+C1*.25,mix(C1,C2,.5),bnd);surf=mix(surf,C3,smoothstep(.62,.9,bnd)*.35);col=surf*(.04+dif*1.05);',
    '  col+=C2*pow(1.-z,3.)*(.35+dif)*1.2;col=mix(outc,col,pe);}else col=outc;',
    ' if(dd>=1.||rd.y<0.)col=col*(1.-band*.55)+rc*band*.9;}',
    // ---- 1 aurora: curtains over layered mountains
    'else if(S==1){col=mix(C0,mix(C0,C1,.35),smoothstep(-.5,.6,uv.y));col+=stars(p,D)*smoothstep(-.1,.4,uv.y);',
    ' for(int i=0;i<3;i++){float fi=float(i);float x=p.x*(1.1+fi*.3)+fi*2.1;float y0=.18+fi*.07+.09*sin(x*1.7+t*.11+fi)+.12*fbm(vec2(x*1.2,t*.05+fi));',
    '  float dy=uv.y-y0;float curtain=exp(-max(dy,0.)*(3.5+fi))*smoothstep(-.02,.03,dy);float streak=.45+.55*fbm(vec2(x*14.,t*.25+fi*3.));',
    '  col+=mix(C2,C3,fi/2.)*curtain*streak*(.55-fi*.12);}',
    ' float m1=-.22+ridge(p.x*.9+M.x*.01,1.1,.32);float m2=-.36+ridge(p.x*1.3+M.x*.03+4.,1.5,.25);',
    ' float haze=exp(-abs(uv.y-m1)*9.)*.35;col+=C2*haze*.25;if(uv.y<m1)col=mix(col,C0*.8+C1*.12,.85);if(uv.y<m2)col=C0*.55;',
    ' col+=C3*smoothstep(.02,0.,abs(uv.y-m1))*.12;float mist=fbm(vec2(p.x*2.+t*.03,uv.y*6.))*smoothstep(-.1,-.45,uv.y);col+=C2*mist*.12;}',
    // ---- 2 dusk: gradient sky, glowing moon, drifting clouds, soft hills
    'else if(S==2){float y=uv.y;col=mix(C3,C1,smoothstep(-.35,.15,y));col=mix(col,C0,smoothstep(.05,.6,y));',
    ' vec2 md=(p-P.xy);float mr=length(md)/P.z;col+=C3*exp(-mr*1.6)*.55;float mt=.85+.15*fbm(md/P.z*3.+7.);col=mix(col,mix(vec3(1.),C3,.45)*mt,smoothstep(1.,1.-2.5/(P.z*R.y),mr)*.92);',
    ' col+=stars(p,D*.6)*smoothstep(.05,.5,y);',
    ' for(int i=0;i<3;i++){float fi=float(i);float c=fbm(vec2(p.x*(1.2+fi*.6)+t*(.012+fi*.008)+fi*9.,y*(5.+fi*2.)+fi*3.));',
    '  float band=smoothstep(.55,.75,c)*exp(-abs(y-(.05+fi*.13))*4.);col=mix(col,mix(C2,C3,.4+fi*.2),band*.45);}',
    ' float h1=-.2+ridge(p.x*.7+M.x*.01,.9,.2);float h2=-.33+ridge(p.x+M.x*.025+3.,1.2,.18);',
    ' if(y<h1)col=mix(col,mix(C0,C1,.4),.8);if(y<h2)col=mix(C0,C1,.15);col+=C3*smoothstep(.015,0.,abs(y-h1))*.15;}',
    // ---- 3 synth: neon sun + perspective grid
    'else if(S==3){float hz=-.08;col=mix(C0,C1*.6,smoothstep(.6,hz,uv.y));col+=stars(p,D*.7)*smoothstep(hz,.4,uv.y);',
    ' vec2 sd=p-P.xy;float sr=length(sd)/P.z;if(sr<1.02&&uv.y>hz){float se=smoothstep(1.,1.-2.5/(P.z*R.y),sr);float vis=se*max(step(0.,sd.y),step(.38,fract(sd.y/P.z*9.-t*.25)));',
    '  col=mix(col,mix(C2,C3,smoothstep(-.8,.8,sd.y/P.z)),vis);}col+=C2*exp(-max(sr-1.,0.)*3.)*.3;',
    ' if(uv.y<hz){float z=.35/(hz-uv.y+.001);vec2 g=vec2(p.x*z,z+t*.6);vec2 gl=abs(fract(g)-.5)/fwidth(g);float line=1.-min(min(gl.x,gl.y),1.);',
    '  col=mix(C0,C1*.4,.3)+C2*line*exp(-z*.08)*1.2+C3*exp(-(hz-uv.y)*14.)*.6;}}',
    // ---- 4 abyss: deep water caustics + light shafts
    'else if(S==4){col=mix(C0,C1,smoothstep(-.6,.7,uv.y));float sh=0.;for(int i=0;i<4;i++){float fi=float(i);float x=p.x+uv.y*(.35+fi*.05)+fi*.7;',
    '  sh+=smoothstep(.12,0.,abs(fract(x*.6+sin(t*.05+fi)*.2)-.5))*(.2+.1*sin(t*.3+fi*2.));}col+=C2*sh*smoothstep(-.5,.6,uv.y)*.35;',
    ' float ca=fbm(p*3.+vec2(t*.05,-t*.04));ca=pow(abs(sin(ca*12.)),8.);col+=C3*ca*.12*smoothstep(0.,.7,uv.y);col+=stars(p*.7,D*.4)*.5;}',
    // shared finish: vignette + grain
    'col*=1.-.55*smoothstep(.45,1.15,length(uv*vec2(.85,1.)));col+=(h(gl_FragCoord.xy+fract(T))-.5)*.018;',
    'gl_FragColor=vec4(max(col,0.),1.);}'
  ].join('\n');

  function initGL(s) {
    var c = s.scene;
    var gl = c.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return null;
    gl.getExtension('OES_standard_derivatives');
    function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    var frag = '#extension GL_OES_standard_derivatives : enable\n' + FRAG;
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var u = {}; ['R', 'T', 'M', 'C0', 'C1', 'C2', 'C3', 'S', 'P', 'D'].forEach(function (k) { u[k] = gl.getUniformLocation(prog, k); });
    return { gl: gl, u: u };
  }
  function drawGL(s) {
    var g = s.gl, sk = s.skin, sc = sk.scene || {};
    if (!g || SCENES[sc.kind || 'none'] < 0) return;
    var gl = g.gl, u = g.u, scale = s.motion === 'live' ? (sc.resolution || 0.7) : 0.6;
    var w = Math.max(2, Math.round(innerWidth * scale)), h = Math.max(2, Math.round(innerHeight * scale));
    if (s.scene.width !== w || s.scene.height !== h) { s.scene.width = w; s.scene.height = h; gl.viewport(0, 0, w, h); }
    var c = sc.colors || [];
    var pal = sk.palette;
    gl.uniform2f(u.R, w, h); gl.uniform1f(u.T, s.t); gl.uniform2f(u.M, s.mx, s.my);
    gl.uniform3fv(u.C0, vec3(c[0] || pal.bg)); gl.uniform3fv(u.C1, vec3(c[1] || pal.surface || mix(pal.bg, pal.accent, 0.3)));
    gl.uniform3fv(u.C2, vec3(c[2] || pal.accent)); gl.uniform3fv(u.C3, vec3(c[3] || pal.accent2 || pal.accent));
    gl.uniform1i(u.S, SCENES[sc.kind]);
    var b = sc.body || [0.55, 0.12, 0.42, 1];
    gl.uniform4f(u.P, b[0], b[1], b[2], b[3]); gl.uniform1f(u.D, sc.stars != null ? sc.stars : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---------- particles ---------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function spawn(kind, w, h, initial) {
    var p = { x: rnd(0, w), y: initial ? rnd(0, h) : 0, z: rnd(0.3, 1), a: rnd(0, 6.28), life: 0 };
    if (kind === 'petals') { p.y = initial ? p.y : rnd(-60, -10); p.vx = rnd(-8, 18); p.vy = rnd(18, 42); p.r = rnd(4, 9); p.spin = rnd(-1.6, 1.6); }
    else if (kind === 'fireflies') { p.vx = 0; p.vy = 0; p.r = rnd(1.2, 2.6); p.seed = rnd(0, 100); p.y = initial ? p.y : rnd(h * 0.35, h); }
    else if (kind === 'embers') { p.y = initial ? p.y : h + 10; p.vx = rnd(-6, 6); p.vy = -rnd(14, 40); p.r = rnd(0.8, 2.2); p.seed = rnd(0, 100); }
    else if (kind === 'snow') { p.y = initial ? p.y : -10; p.vx = rnd(-6, 6); p.vy = rnd(10, 28); p.r = rnd(0.8, 2.6); p.seed = rnd(0, 100); }
    else if (kind === 'bubbles') { p.y = initial ? p.y : h + 10; p.vx = 0; p.vy = -rnd(8, 26); p.r = rnd(1.5, 5); p.seed = rnd(0, 100); }
    else { p.vx = rnd(-3, 3); p.vy = rnd(-2, 2); p.r = rnd(0.6, 1.6); p.seed = rnd(0, 100); } // dust / stars
    return p;
  }
  function stepParticles(s, dt) {
    var cfg = s.skin.particles || {}, kind = cfg.type, ctx = s.pctx;
    var w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 1.5);
    if (s.pcanvas.width !== Math.round(w * dpr)) { s.pcanvas.width = Math.round(w * dpr); s.pcanvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    if (!kind || kind === 'none') { s.parts = []; }
    var want = kind && kind !== 'none' ? Math.round(clamp((w * h) / 16000, 25, 110) * (cfg.density || 1) * MOTION[s.motion].particles) : 0;
    if (s.motion === 'still' && kind && kind !== 'none') want = Math.round(clamp((w * h) / 16000, 25, 110) * (cfg.density || 1) * 0.5);
    while (s.parts.length < want) s.parts.push(spawn(kind, w, h, true));
    if (s.parts.length > want) s.parts.length = want;
    var col = cfg.color || s.skin.palette.accent2 || s.skin.palette.accent, col2 = cfg.color2 || s.skin.palette.accent;
    var ox = s.mx * 18, oy = s.my * 12, t = s.t;
    ctx.globalCompositeOperation = kind === 'petals' ? 'source-over' : 'lighter';
    for (var i = 0; i < s.parts.length; i++) {
      var p = s.parts[i]; p.life += dt;
      var x, y;
      if (kind === 'petals') {
        p.x += (p.vx + Math.sin(t * 0.8 + p.a) * 14) * dt * p.z; p.y += p.vy * dt * p.z; p.a += p.spin * dt;
        x = p.x + ox * p.z; y = p.y + oy * p.z;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.a); ctx.scale(1, 0.55 + 0.45 * Math.sin(t * 2 + p.a * 3));
        ctx.globalAlpha = 0.55 + p.z * 0.4; ctx.fillStyle = p.z > 0.65 ? col : col2;
        ctx.beginPath(); ctx.ellipse(0, 0, p.r * p.z * 1.4, p.r * p.z * 0.75, 0, 0, 6.283); ctx.fill(); ctx.restore();
        if (p.y > h + 20 || p.x > w + 40) s.parts[i] = spawn(kind, w, h, false);
        continue;
      }
      if (kind === 'fireflies') {
        p.x += Math.sin(t * 0.3 + p.seed) * 14 * dt + Math.cos(t * 0.17 + p.seed * 2) * 9 * dt;
        p.y += Math.cos(t * 0.23 + p.seed) * 10 * dt - 3 * dt;
        if (p.y < h * 0.2 || p.x < -20 || p.x > w + 20) s.parts[i] = spawn(kind, w, h, false);
        var pulse = Math.pow(0.5 + 0.5 * Math.sin(t * (1.2 + p.seed % 1.3) + p.seed), 3);
        x = p.x + ox * p.z; y = p.y + oy * p.z;
        var g = ctx.createRadialGradient(x, y, 0, x, y, p.r * 9);
        g.addColorStop(0, rgba(col, 0.9 * pulse)); g.addColorStop(0.25, rgba(col, 0.3 * pulse)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.fillRect(x - p.r * 9, y - p.r * 9, p.r * 18, p.r * 18);
        continue;
      }
      p.x += (p.vx + (kind === 'snow' ? Math.sin(t + p.seed) * 6 : kind === 'embers' ? Math.sin(t * 2 + p.seed) * 10 : 0)) * dt;
      p.y += p.vy * dt;
      x = p.x + ox * p.z; y = p.y + oy * p.z;
      var a = kind === 'embers' ? (0.4 + 0.6 * Math.abs(Math.sin(t * 3 + p.seed))) * clamp(p.y / h, 0, 1)
        : kind === 'dust' || kind === 'stars' ? 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.5 + p.seed)) : 0.7;
      ctx.globalAlpha = a * p.z;
      ctx.fillStyle = kind === 'embers' ? (p.seed % 2 > 1 ? col : col2) : col;
      if (kind === 'bubbles') { ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, y, p.r * p.z, 0, 6.283); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(x, y, p.r * p.z, 0, 6.283); ctx.fill(); }
      if (p.y < -20 || p.y > h + 20 || p.x < -30 || p.x > w + 30) s.parts[i] = spawn(kind, w, h, false);
    }
    ctx.globalAlpha = 1;
    // shooting stars / comets
    if (cfg.shooting && s.motion !== 'still') {
      if (!s.comet && Math.random() < dt * 0.12) s.comet = { x: rnd(w * 0.2, w), y: rnd(-20, h * 0.35), vx: -rnd(500, 800), vy: rnd(160, 300), life: 0 };
      var cm = s.comet;
      if (cm) {
        cm.life += dt; cm.x += cm.vx * dt; cm.y += cm.vy * dt;
        var len = 0.12, gx = ctx.createLinearGradient(cm.x, cm.y, cm.x - cm.vx * len, cm.y - cm.vy * len);
        var fade = clamp(1 - cm.life / 1.3, 0, 1);
        gx.addColorStop(0, rgba('#ffffff', 0.9 * fade)); gx.addColorStop(0.2, rgba(col, 0.5 * fade)); gx.addColorStop(1, rgba(col, 0));
        ctx.strokeStyle = gx; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cm.x, cm.y); ctx.lineTo(cm.x - cm.vx * len, cm.y - cm.vy * len); ctx.stroke();
        if (cm.life > 1.3) s.comet = null;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- safe zones (text-aware scene) ---------- */
  function rectOf(e, pad) { if (!e) return null; var r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) return null; pad = pad || 0; return { x: r.left - pad, y: r.top - pad, w: r.width + 2 * pad, h: r.height + 2 * pad }; }
  // Union of the rendered text inside an element (block boxes are often full width; the words are not).
  function textBounds(root, pad) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, rg = document.createRange();
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim() || (n.parentElement && n.parentElement.closest('.t3s-welcome,.t3s-emblem'))) continue;
      rg.selectNodeContents(n); var rr = rg.getBoundingClientRect(); if (!rr.width) continue;
      l = Math.min(l, rr.left); t = Math.min(t, rr.top); r = Math.max(r, rr.right); b = Math.max(b, rr.bottom);
    }
    if (!isFinite(l)) return rectOf(root, pad);
    return { x: l - pad, y: t - pad, w: r - l + 2 * pad, h: b - t + 2 * pad };
  }
  function measureZones() {
    var z = [], Z = SEL.zones;
    function add(kind, r) { if (r) { r.kind = kind; z.push(r); } }
    var side = rectOf(q(Z.sidebar)); if (side && side.x > -10) add('sidebar', side);
    var head = rectOf(q(Z.topbar)); add('topbar', head);
    var comp = rectOf(q(Z.composer), 6); add('composer', comp);
    add('details', rectOf(q(Z.details), 6));
    var hero = q(Z.hero); if (hero) add('hero', textBounds(hero.parentElement || hero, 18));
    // Message lane: horizontal extent of visible timeline rows, from the top bar down to the composer.
    var rows = qa(SEL.layout.timelineRow.sel), l = Infinity, rr = -Infinity;
    for (var i = 0; i < rows.length && i < 80; i++) { var b = rows[i].getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight || b.width < 4) continue; l = Math.min(l, b.left); rr = Math.max(rr, b.right); }
    if (rows.length) {
      if (!isFinite(l) && comp) { l = comp.x; rr = comp.x + comp.w; }
      if (isFinite(l)) { var top = head ? head.y + head.h : 0, bottom = comp ? comp.y : innerHeight; if (bottom - top > 20) add('messages', { x: l - 18, y: top, w: rr - l + 36, h: bottom - top }); }
    }
    if (comp) add('send', rectOf(q(SEL.layout.composerAction.sel)));   // the send button, for scenes that interact with it
    return z;
  }
  function zonesKey(z) { return z.map(function (r) { return r.kind + Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.w) + ',' + Math.round(r.h); }).join('|'); }
  function updateZones(s, force) {
    if (!current || current !== s) return;
    var z = s.mode === 'full' ? measureZones() : [], key = zonesKey(z);
    // Keep the launcher out of the editor/send target on narrow chat columns.
    var comp = z.filter(function (r) { return r.kind === 'composer'; })[0] || rectOf(q(SEL.zones.composer), 6);
    if (s.toggle && s.controls) {
      var toggle = s.toggle.getBoundingClientRect(), x = innerWidth - 14 - toggle.width, y = innerHeight - 14 - toggle.height;
      var overlaps = comp && x < comp.x + comp.w && x + toggle.width > comp.x && y < comp.y + comp.h && y + toggle.height > comp.y;
      s.controls.style.setProperty('--t3s-control-lift', (overlaps && comp.y > toggle.height + 30 ? Math.max(0, innerHeight - comp.y - 6) : 0) + 'px');
    }
    if (!force && key === s.zonesKey) return;
    s.zones = z; s.zonesKey = key;
    var plain = z.map(function (r) { return { kind: r.kind, x: r.x, y: r.y, w: r.w, h: r.h }; });
    if (s.box) s.box.zones(plain);
    if (s.comp) s.comp.zones(plain);
    renderScrims(s);
  }
  function renderScrims(s) {
    var item = s.item; if (!item) return;
    var t = uiOf(item), p = palOf(item), pol = t.textSafety, layer = s.scrims;
    layer.textContent = '';
    var hasText = s.zones.some(function (z) { return z.kind === 'messages' || z.kind === 'hero'; });
    var healthy = s.health.ok;
    s.zones.forEach(function (z) {
      var a = z.kind === 'messages' ? pol.scrim : z.kind === 'hero' ? pol.heroScrim : 0;
      if (!a) return;
      var d = el('div', 't3s-scrim'); var f = 40;
      d.style.cssText = 'left:' + (z.x + f / 2) + 'px;top:' + (z.y + f / 2) + 'px;width:' + Math.max(0, z.w - f) + 'px;height:' + Math.max(0, z.h - f) + 'px;background:' + rgba(p.bg, a) +
        ';box-shadow:0 0 ' + f + 'px ' + (f * 0.75) + 'px ' + rgba(p.bg, a) + (pol.blur ? ';-webkit-backdrop-filter:blur(' + pol.blur + 'px);backdrop-filter:blur(' + pol.blur + 'px)' : '');
      layer.append(d);
    });
    // Zones could not be measured although the full skin is on: calm the whole scene instead.
    s.backdrop.dataset.globalScrim = String(!hasText && !healthy);
    s.backdrop.style.setProperty('--t3s-global-scrim', rgba(p.bg, pol.scrim * 0.85));
  }

  /* ---------- health: fall back to tokens only if T3's markup moved ---------- */
  function checkHealth(s) {
    var L = SEL.layout, missing = [];
    Object.keys(L).forEach(function (k) { if (L[k].required && !q(L[k].sel)) missing.push(k); });
    var ok = missing.length === 0;
    s.healthMisses = ok ? 0 : s.healthMisses + 1;
    var mode = ok ? 'full' : (s.healthMisses >= 2 ? 'tokens' : s.mode);
    s.health = { ok: ok, missing: missing };
    if (mode !== s.mode) { s.mode = mode; document.documentElement.setAttribute('data-t3-skin-mode', mode); if (mode === 'tokens') console.warn('T3 skin: T3 layout hooks missing (' + missing.join(', ') + '); showing colours only'); sync(s); }
    updateZones(s);
  }

  /* ---------- theme scene in the sandbox ---------- */
  function sceneDpr(s) { var t = uiOf(s.item); return Math.min(devicePixelRatio || 1, 1.5) * t.motion.resolution; }
  function themeMotion(s) {
    var t = uiOf(s.item), fps = t.motion.fps;
    if (s.motion === 'calm') return { fps: Math.min(15, fps), speed: 0.45 };
    return { fps: fps, speed: 1 };
  }
  function startScene(s) {
    stopScene(s);
    var item = s.item; if (!item || item.kind !== 'theme' || !item.code || !item.code.scene || s.mode !== 'full') return;
    var p = palOf(item), m = themeMotion(s);
    s.fallback.hidden = true;
    s.box = SB.create({ code: item.code.scene, kind: 'scene', palette: scenePalette(item), params: item.theme.scene.params, light: item.theme.appearance === 'light', backdrop: !!item.theme.backdrop,
      motion: s.motion, fps: m.fps, speed: m.speed, dpr: sceneDpr(s), width: innerWidth, height: innerHeight, run: !stopped(s), t0: 8 + Math.random() * 20,
      zones: s.zones.map(function (r) { return { kind: r.kind, x: r.x, y: r.y, w: r.w, h: r.h }; }),
      onStatus: function (st, msg) {
        tell('__t3skin-scene:', { id: item.id, status: st, msg: msg });
        if (st === 'error') { stopScene(s); s.fallback.hidden = false; s.sceneError = msg; renderGalleryStatus(s); }
        else renderGalleryStatus(s);
      } });
    s.sceneError = '';
    s.box.el.style.colorScheme = 'normal';
    s.sceneHost.append(s.box.el);
    void p;
    if (item.theme.scene.params && item.theme.scene.params.companion === true) startCompanion(s);
  }
  // Companion layer: the same sandboxed scene code run a second time with api.layer === 'companion', in a
  // transparent, click-through layer ABOVE the app (a pet that walks onto the composer). It may raise one
  // cosmetic flag on the send button ("paw"); it still cannot read or touch the page.
  function companionFps(s) { return s.motion === 'calm' ? 24 : 60; }
  function startCompanion(s) {
    var item = s.item, m = themeMotion(s);
    s.compHost = el('div', 't3s-companion'); s.compHost.setAttribute('aria-hidden', 'true');
    s.comp = SB.create({ code: item.code.scene, kind: 'scene', layer: 'companion', palette: scenePalette(item), params: item.theme.scene.params, light: item.theme.appearance === 'light',
      motion: s.motion, fps: companionFps(s), speed: m.speed, dpr: Math.min(devicePixelRatio || 1, 2), width: innerWidth, height: innerHeight, run: !stopped(s), t0: 0, budgetMs: 12,
      zones: s.zones.map(function (r) { return { kind: r.kind, x: r.x, y: r.y, w: r.w, h: r.h }; }),
      onStatus: function (st) { if (st === 'error') stopCompanion(s); },
      onSignal: function (name, on) { if (name === 'paw') setPaw(s, on); } });
    s.comp.el.style.colorScheme = 'normal';
    s.compHost.append(s.comp.el); document.body.append(s.compHost);
    s.compHost.style.opacity = s.focus ? '0' : String(s.intensity / 100);
    if (s.uiWorking) setTimeout(function () { if (s.comp) s.comp.ui('working', true); }, 400);
  }
  function setPaw(s, on) {
    var b = q(SEL.layout.composerAction.sel);
    if (s.pawEl && s.pawEl !== b) s.pawEl.removeAttribute('data-t3s-paw');
    s.pawEl = b; if (b) { if (on) b.setAttribute('data-t3s-paw', ''); else b.removeAttribute('data-t3s-paw'); }
  }
  function stopCompanion(s) { if (s.comp) { s.comp.destroy(); s.comp = null; } if (s.compHost) { s.compHost.remove(); s.compHost = null; } setPaw(s, false); }
  function stopScene(s) { if (s.box) { s.box.destroy(); s.box = null; } stopCompanion(s); }
  // What the user is doing, as plain facts (no text): typing, sent, working, done.
  function uiEvent(s, name, value) { if (s.box) s.box.ui(name, value); if (s.comp) s.comp.ui(name, value); }
  function checkWorking(s) {
    var col = q(SEL.layout.chatColumn.sel) || document, w = false;
    try { w = !!col.querySelector(SEL.loaders); } catch (e) {}
    if (w === !!s.uiWorking) return;
    s.uiWorking = w; uiEvent(s, 'working', w); if (!w) uiEvent(s, 'done', Date.now());
  }
  function scenePalette(item) { var p = palOf(item); var o = {}; Object.keys(p).forEach(function (k) { if (typeof p[k] === 'string') o[k] = p[k]; }); o.scene = (item.theme && item.theme.sceneColors) || []; return o; }

  /* ---------- welcome animation ---------- */
  function clearWelcomes(s) { s.welcomes.forEach(function (w) { if (w.box) w.box.destroy(); w.el.remove(); }); s.welcomes = []; s.welcomeHeads = new WeakMap(); }
  function attachWelcome(s, node) {
    if (!(node instanceof Element) || !s.item || !s.welcome) return;
    var sel = SEL.layout.welcomeHeading.sel + ',[data-space-preview-hero]';
    var heads; try { heads = Array.prototype.slice.call(node.querySelectorAll(sel)); if (node.matches(sel)) heads.unshift(node); } catch (e) { return; }
    heads.forEach(function (hd) {
      var w = s.welcomeHeads.get(hd); if (w && w.el.isConnected) return;
      if (!hd.parentElement) return;
      var item = s.item, host;
      if (item.kind === 'theme' && item.code && item.code.welcome && s.mode === 'full') {
        var h = item.theme.welcome.height || 150, width = Math.min(560, Math.max(240, (hd.parentElement.getBoundingClientRect().width || 560)));
        host = el('div', 't3s-welcome'); host.setAttribute('aria-hidden', 'true'); host.style.height = h + 'px'; host.style.width = width + 'px';
        var m = themeMotion(s);
        var box = SB.create({ code: item.code.welcome, kind: 'welcome', palette: scenePalette(item), params: item.theme.welcome.params, text: item.theme.welcome.text || item.theme.name,
          light: item.theme.appearance === 'light', motion: s.motion, fps: Math.max(24, m.fps), speed: m.speed, dpr: Math.min(devicePixelRatio || 1, 2), width: width, height: h,
          run: !stopped(s), t0: stopped(s) ? 6 : 0, budgetMs: 14,
          onStatus: function (st) { if (st === 'error') { box.destroy(); host.classList.add('t3s-welcome-failed'); } } });
        box.el.style.colorScheme = 'normal';
        host.append(box.el);
        w = { el: host, box: box };
      } else if (item.kind === 'skin' && !item.plate) {
        host = el('div', 't3s-emblem'); host.setAttribute('aria-hidden', 'true');
        host.innerHTML = '<span class="t3s-orbit o1"><i></i></span><span class="t3s-orbit o2"><i></i></span><span class="t3s-core"></span>';
        w = { el: host, box: null };
      } else return;
      hd.parentElement.insertBefore(host, hd); s.welcomeHeads.set(hd, w); s.welcomes.push(w);
    });
    s.welcomes = s.welcomes.filter(function (w) { if (w.el.isConnected) return true; if (w.box) w.box.destroy(); return false; });
  }

  /* ---------- loop (v2 skins) + run state ---------- */
  function stopped(s) { return s.focus || s.motion === 'still' || reduced() || document.hidden || s.intensity === 0; }
  function frame(s, now) {
    s.raf = 0;
    if (current !== s || stopped(s) || !s.skin) return;
    var fps = MOTION[s.motion].fps, minDt = 1000 / fps;
    if (s.last && now - s.last < minDt - 2) { s.raf = requestAnimationFrame(function (n) { frame(s, n); }); return; }
    var dt = s.last ? Math.min(0.1, (now - s.last) / 1000) : 1 / fps;
    s.fpsMeasured = Math.round(1 / dt); s.last = now;
    s.t += dt * MOTION[s.motion].speed * ((s.skin.scene && s.skin.scene.speed) || 1);
    s.mx += (s.tx - s.mx) * Math.min(1, dt * 3); s.my += (s.ty - s.my) * Math.min(1, dt * 3);
    drawGL(s); stepParticles(s, dt * MOTION[s.motion].speed);
    if (s.plateEl && s.skin.plate && s.skin.plate.parallax !== 0) {
      var k = (s.skin.plate.parallax != null ? s.skin.plate.parallax : 1) * 14;
      s.plateEl.style.transform = 'translate3d(' + (-s.mx * k).toFixed(2) + 'px,' + (-s.my * k).toFixed(2) + 'px,0) scale(1.06)';
    }
    s.raf = requestAnimationFrame(function (n) { frame(s, n); });
  }
  function sync(s) {
    cancelAnimationFrame(s.raf); s.raf = 0; s.last = 0;
    var root = document.documentElement, still = stopped(s);
    if (still) stopCardPreview(s);
    root.setAttribute('data-t3-skin-motion', still ? 'still' : s.motion);
    s.backdrop.dataset.focus = String(s.focus);
    s.visual.style.opacity = String((s.focus ? 0.22 : 1) * s.intensity / 100);
    if (s.video) { if (still) s.video.pause(); else s.video.play().catch(function () {}); }
    if (s.skin) { try { drawGL(s); stepParticles(s, 0); } catch (e) {} if (!still) s.raf = requestAnimationFrame(function (n) { frame(s, n); }); }
    if (s.item && s.item.kind === 'theme') {
      if (s.mode === 'full' && !s.box && s.item.code && s.item.code.scene && !s.sceneError) startScene(s);
      if (s.mode !== 'full') stopScene(s);
      var m = themeMotion(s);
      if (s.box) s.box.run(!still, m.fps, m.speed, s.motion);
      if (s.comp) { s.comp.run(!still, companionFps(s), m.speed, s.motion); s.compHost.style.opacity = s.focus ? '0' : String(s.intensity / 100); }
      s.welcomes.forEach(function (w) { if (w.box) w.box.run(!still, Math.max(24, m.fps), m.speed, s.motion); });
    }
    renderGallery(s, true);
  }

  /* ---------- applying an item ---------- */
  function themeAsset(s, item, file) { return new URL(encodeURIComponent(item.id) + '/' + file.split('/').map(encodeURIComponent).join('/'), item.kind === 'theme' ? s.themeBase : s.base).href; }
  function assetUrl(s, sk, file) { return themeAsset(s, sk, file); }
  function applyItem(s, id, animate) {
    clearTimeout(s.applyTimer); s.applyTimer = 0; s.pendingItem = null;
    var item = s.items.filter(function (k) { return k.id === id; })[0] || s.items[0];
    if (!item) return;
    var go = function () {
      s.applyTimer = 0; s.pendingItem = null;
      if (current !== s || s.items.indexOf(item) < 0) return;
      stopScene(s); clearWelcomes(s);
      s.item = item; s.skin = item.kind === 'skin' ? item : null; s.parts = []; s.comet = null; s.sceneError = '';
      s.themeStyle.textContent = fontFaceCss(s, item) + tokensCss(item) + '\n' + structuralCss(item) + '\n' + polishCss(item) + '\n' + iconCss(item) + '\n' + loaderCss(item) + (item.kind === 'skin' && item.css ? item.css : '');
      document.documentElement.setAttribute('data-t3-skin-id', item.id);
      document.documentElement.setAttribute('data-t3-skin-kind', item.kind);
      var t = uiOf(item), p = palOf(item);
      s.backdrop.dataset.overlay = t.ui.overlay; s.backdrop.dataset.cursorLight = String(!!t.ui.cursorLight);
      if (s.controls) { s.controls.dataset.shadow = t.ui.shadow || 'soft'; s.controls.dataset.surface = t.ui.surface || 'glass'; s.controls.dataset.appearance = t.appearance; }
      s.fallback.style.background = 'radial-gradient(ellipse at 78% 18%,' + rgba(p.accent, 0.35) + ',transparent 55%),radial-gradient(ellipse at 12% 90%,' + rgba(p.accent2, 0.28) + ',transparent 60%),' + p.bg;
      var themeBd = item.kind === 'theme' ? item.theme.backdrop : null;
      s.fallback.hidden = item.kind !== 'theme' || !!themeBd || !!(item.code && item.code.scene);
      // v2 layers
      var kind = s.skin ? ((s.skin.scene && s.skin.scene.kind) || 'none') : 'none';
      s.scene.style.display = s.skin && SCENES[kind] >= 0 && s.gl ? 'block' : 'none';
      s.pcanvas.style.display = s.skin ? 'block' : 'none';
      s.plateWrap.textContent = ''; s.plateEl = null; s.video = null;
      // v2 skins have a plate; hybrid v3 themes have a backdrop (AI image/video under the code scene).
      var pl = s.skin ? s.skin.plate : themeBd;
      if (pl && (pl.image || pl.video)) {
        var wrap = el('div', 't3s-plate'); wrap.style.opacity = pl.opacity != null ? pl.opacity : 1;
        wrap.style.mixBlendMode = pl.blend || 'normal';
        if (pl.image) { var img = el('img'); img.alt = ''; img.decoding = 'async'; img.src = assetUrl(s, item, pl.image); img.style.objectPosition = pl.position || '50% 50%'; wrap.append(img); }
        if (pl.video) {
          var v = el('video'); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('muted', ''); v.tabIndex = -1;
          v.src = assetUrl(s, item, pl.video); v.style.objectPosition = pl.position || '50% 50%';
          v.addEventListener('playing', function () { v.dataset.ready = 'true'; });
          wrap.append(v); s.video = v;
        }
        if (pl.drift !== false) wrap.classList.add('t3s-drift');
        s.plateWrap.append(wrap); s.plateEl = wrap;
      }
      s.backdrop.style.setProperty('--t3s-shade', String(s.skin ? (s.skin.shade != null ? s.skin.shade : 0.35) : themeBd ? themeBd.dim : 0));
      updateZones(s, true);
      report(s); sync(s);
      attachWelcome(s, document.body);
      s.backdrop.classList.remove('t3s-fading');
      renderGallery(s);
      nudgeTerminal();
    };
    if (animate && s.item && !stopped(s)) { s.backdrop.classList.add('t3s-fading'); s.pendingItem = item.id; s.applyTimer = setTimeout(go, 380); }
    else go();
  }
  // T3's terminal rebuilds its theme only when <html>'s class or style attribute changes. Touch a harmless
  // custom property after our stylesheet changes so an open terminal picks up the new colours at once.
  var terminalRev = 0;
  function nudgeTerminal(remove) {
    var de = document.documentElement;
    if (remove) de.style.removeProperty('--t3s-rev'); else de.style.setProperty('--t3s-rev', String(++terminalRev));
  }
  function addItems(s, items, applyId) {
    (items || []).forEach(function (it) { if (!valid(it)) return; s.items = s.items.filter(function (k) { return k.id !== it.id; }); s.items.unshift(it); });
    buildCards(s);
    if (applyId) applyItem(s, applyId, true);
  }
  function removeItem(s, id) {
    if (s.pendingItem === id) { clearTimeout(s.applyTimer); s.applyTimer = 0; s.pendingItem = null; s.backdrop.classList.remove('t3s-fading'); }
    s.items = s.items.filter(function (k) { return k.id !== id; });
    buildCards(s);
    if (s.item && s.item.id === id) applyItem(s, (s.prevId && s.prevId !== id) ? s.prevId : (s.items[0] && s.items[0].id), true);
  }
  function valid(it) {
    if (!it || !it.id) return false;
    if (it.kind === 'theme') return !!(it.theme && it.theme.palette && it.theme.palette.bg && it.theme.palette.accent);
    it.kind = 'skin'; return !!(it.palette && it.palette.bg && it.palette.accent);
  }
  function itemName(it) { return it.kind === 'theme' ? it.theme.name : (it.name || it.id); }
  function itemCategory(it) { return it.kind === 'theme' ? it.theme.category : (it.plate ? 'AI image' : 'Classic'); }

  /* ---------- gallery (theme library) ----------
     A side sheet built from T3's own tokens (popover, border, input, primary, radius, font), so it reads as part
     of T3 rather than a skin on top. Library: grid + detail pane with a live preview. Create: the prompt form. */
  var ICON = {
    palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    star: '<path d="M11.5 2.9a.6.6 0 0 1 1 0l2.6 5.3 5.8.8a.6.6 0 0 1 .3 1l-4.2 4.1 1 5.8a.6.6 0 0 1-.8.6L12 17.8l-5.2 2.7a.6.6 0 0 1-.8-.6l1-5.8-4.2-4.1a.6.6 0 0 1 .3-1l5.8-.8z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    thread: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    download: '<path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'
  };
  function icon(name, size) {
    var sp = el('span', 't3s-i'); sp.setAttribute('aria-hidden', 'true');
    sp.innerHTML = '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>';
    return sp;
  }
  function btn(label, cls, title, ic) {
    var b = el('button', 't3s-btn' + (cls ? ' ' + cls : '')); b.type = 'button';
    if (ic) b.append(icon(ic, 14));
    if (label) b.append(el('span', 't3s-btn-l', label));
    if (title) b.title = title;
    return b;
  }
  function itemLegacy(it) { return it.kind === 'skin' || !!it.legacy; }
  function itemTagline(it) { return (it.kind === 'theme' ? it.theme.tagline : it.tagline) || ''; }
  function itemSource(it) { return it.kind !== 'theme' ? 'Image skin (v2)' : it.builtIn ? 'Built in' : it.theme.generated ? 'Generated' : 'Imported'; }
  function itemBackground(it) {
    if (it.kind !== 'theme') return it.plate ? (it.plate.video ? 'Picture and video' : 'Picture') : 'Procedural';
    var b = it.theme.backdrop; return b ? (b.video ? 'Picture, video loop and code' : 'Picture and code') : 'Code';
  }

  function buildGallery(s) {
    s.controls = el('section', 't3s-controls'); s.controls.setAttribute('aria-label', 'Themes');
    s.toggle = el('button', 't3s-toggle'); s.toggle.type = 'button'; s.toggle.append(icon('palette', 15), el('span', '', 'Themes'));
    s.toggle.setAttribute('aria-expanded', 'false'); s.toggle.setAttribute('aria-controls', 't3s-gallery');
    var g = s.gallery = el('div', 't3s-gallery'); g.id = 't3s-gallery'; g.hidden = true; g.setAttribute('role', 'dialog'); g.setAttribute('aria-label', 'Themes');
    // header: title · tabs · search · close
    var head = el('div', 't3s-g-head');
    var tabs = el('div', 't3s-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Themes');
    s.tabButtons = [['library', 'Library'], ['create', 'Create']].map(function (t) {
      var b = el('button', 't3s-tab', t[1]); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = t[0];
      listen(s, b, 'click', function () { setTab(s, t[0], true); }); tabs.append(b); return b;
    });
    s.searchWrap = el('label', 't3s-g-searchwrap'); s.searchWrap.append(icon('search', 14));
    s.search = el('input', 't3s-g-search'); s.search.type = 'search'; s.search.placeholder = 'Search themes'; s.search.setAttribute('aria-label', 'Search themes');
    s.searchWrap.append(s.search);
    var close = el('button', 't3s-iconbtn t3s-g-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.append(icon('x', 16));
    head.append(el('h2', 't3s-g-h', 'Themes'), tabs, s.searchWrap, close);

    // library: filters + grid, detail pane on the right
    var lib = s.libView = el('div', 't3s-g-lib');
    var filters = el('div', 't3s-g-filters');
    var scope = el('div', 't3s-seg'); scope.setAttribute('role', 'group'); scope.setAttribute('aria-label', 'Show');
    s.scopeButtons = [['all', 'All'], ['favs', 'Favourites'], ['yours', 'Yours']].map(function (v) {
      var b = el('button', '', v[1]); b.type = 'button'; b.dataset.scope = v[0];
      listen(s, b, 'click', function () { s.scope = v[0]; renderFilters(s); filterCards(s); }); scope.append(b); return b;
    });
    s.catSelect = el('select', 't3s-g-cat'); s.catSelect.setAttribute('aria-label', 'Category');
    listen(s, s.catSelect, 'change', function () { s.category = s.catSelect.value; filterCards(s); });
    s.count = el('span', 't3s-g-count');
    filters.append(scope, s.catSelect, s.count);
    s.sceneStatus = el('p', 't3s-g-scene'); s.sceneStatus.setAttribute('role', 'status');
    s.grid = el('div', 't3s-g-grid');
    s.emptyResults = el('p', 't3s-g-empty', 'No themes match. Try another search or category.'); s.emptyResults.hidden = true; s.emptyResults.setAttribute('role', 'status');
    var scroll = el('div', 't3s-g-scroll'); scroll.append(s.sceneStatus, s.grid, s.emptyResults);
    var main = el('div', 't3s-g-main'); main.append(filters, scroll);
    s.detail = buildDetail(s);
    lib.append(main, s.detail.el);
    listen(s, s.grid, 'pointerleave', function () { clearTimeout(s.detailTimer); s.detailTimer = setTimeout(function () { s.hoverId = null; stopCardPreview(s); showDetail(s, s.item); }, 160); });

    // create: the prompt form (generate here, or hand the whole brief to a new T3 thread)
    var cr = s.createView = el('div', 't3s-g-create'); cr.hidden = true;
    var inner = el('div', 't3s-g-cinner');
    s.previewBar = el('div', 't3s-g-preview'); s.previewBar.hidden = true;
    var gen = s.genBox = el('form', 't3s-g-gen'); gen.setAttribute('aria-label', 'Create a theme from a prompt');
    var gl = el('label', 't3s-g-genlabel', 'Describe a theme'); gl.htmlFor = 't3s-gen-prompt';
    var intro = el('p', 't3s-g-intro', 'A place, a mood, a film or a show. The theme is written as code: colours, type, icons and a live background.');
    s.genPrompt = el('textarea'); s.genPrompt.rows = 3; s.genPrompt.id = 't3s-gen-prompt'; s.genPrompt.maxLength = 400;
    s.genPrompt.placeholder = 'e.g. Interstellar, a cosy rainy café, 90s arcade, a quiet Kyoto garden at dusk'; s.genPrompt.setAttribute('aria-label', 'Theme idea');
    var opts = el('div', 't3s-g-opts');
    function select(label, values) { var w = el('label', 't3s-g-sel'); w.append(el('span', '', label)); var sel = el('select'); values.forEach(function (v) { var o = el('option', '', v[1]); o.value = v[0]; sel.append(o); }); w.append(sel); opts.append(w); return sel; }
    s.genLook = select('Look', [['any', 'Any'], ['dark', 'Dark'], ['light', 'Light']]);
    s.genMotion = select('Motion', [['live', 'Lively'], ['calm', 'Calm'], ['still', 'Almost still']]);
    s.genEngine = select('Made by', (s.engines || [{ id: 'offline', label: 'Local templates · no AI' }]).map(function (e) { return [e.id, e.label]; }));
    s.genModel = select('Model', []);
    // Hybrid: an AI picture (and optional video loop) painted under the theme's live code layer.
    s.genBackdrop = select('Background', [['none', 'Code only'], ['image', 'AI picture + code'], ['video', 'AI picture + video + code']]);
    var inter = el('label', 't3s-g-check'); s.genInteractive = el('input'); s.genInteractive.type = 'checkbox'; inter.append(s.genInteractive, el('span', '', 'Interactive'));
    opts.append(inter);
    var modelNote = el('p', 't3s-g-model-note');
    function updateModels() {
      var engine = (s.engines || []).filter(function (e) { return e.id === s.genEngine.value; })[0] || {}, previous = s.genModel.value;
      s.genModel.textContent = '';
      (engine.models || []).forEach(function (m) { var o = el('option', '', m.label || m.id); o.value = m.id; s.genModel.append(o); });
      s.genModel.parentElement.hidden = !(engine.models && engine.models.length);
      if (engine.models && engine.models.some(function (m) { return m.id === previous; })) s.genModel.value = previous;
      else if (engine.defaultModel) s.genModel.value = engine.defaultModel;
      modelNote.textContent = s.genEngine.value === 'offline' ? 'Local templates reuse built-in scenes and ignore the prompt guidance. Pick a Claude or Codex model for original theme code.' :
        s.genEngine.value === 'codex-cli' ? 'Uses your Codex CLI account. A time limit applies; Codex cannot enforce a dollar cap.' :
        s.genEngine.value === 'claude-cli' ? 'Uses your Claude Code CLI account and its usage limits.' : 'Uses your Anthropic API key. You will see the run budget before generating.';
      if (s.genBackdrop.value !== 'none') modelNote.textContent += ' The picture is painted by your image provider; you confirm the credit cap first.';
      if (s.promptBox) s.promptBox.classList.toggle('t3s-offline', s.genEngine.value === 'offline');
    }
    listen(s, s.genEngine, 'change', updateModels); listen(s, s.genBackdrop, 'change', updateModels);
    s.genStatus = el('p', 't3s-g-status'); s.genStatus.setAttribute('role', 'status');
    s.threadGo = btn('Open in T3 thread', 't3s-g-thread', 'Start a new T3 chat with this idea and the full theme brief', 'thread');
    s.genGo = el('button', 't3s-btn t3s-primary t3s-g-go'); s.genGo.type = 'submit'; s.genGo.append(el('span', 't3s-btn-l', 'Generate'));
    var acts = el('div', 't3s-g-genacts'); acts.append(s.threadGo, s.genGo);
    var genFoot = el('div', 't3s-g-genfoot'); genFoot.append(s.genStatus, acts);
    var threadNote = el('p', 't3s-g-hint', 'Open in T3 thread starts a new chat in this project with your idea, the theme files, master prompt, design rules and validation steps. Keep working elsewhere; the theme appears in the Library when it is saved.');
    gen.append(gl, intro, s.genPrompt, opts, modelNote, buildPromptBox(s), genFoot, threadNote);
    updateModels();
    inner.append(s.previewBar, gen);
    if (s.launcher) {
      var studio = el('button', 't3s-link', 'Use your own picture or video instead (Skin Studio)'); studio.type = 'button';
      listen(s, studio, 'click', function () { tell('__t3skin-studio:open'); }); inner.append(studio);
    }
    cr.append(inner);
    if (!s.launcher) { s.genGo.disabled = true; s.threadGo.disabled = true; s.genStatus.textContent = 'Creating themes needs the T3 Code Themes app.'; }

    // footer: playback on the left, file actions on the right (one row on desktop)
    var foot = el('div', 't3s-g-foot');
    var left = el('div', 't3s-g-footl');
    var motion = el('div', 't3s-seg'); motion.setAttribute('role', 'group'); motion.setAttribute('aria-label', 'Motion');
    s.motionButtons = ['live', 'calm', 'still'].map(function (m) { var b = el('button', '', m[0].toUpperCase() + m.slice(1)); b.type = 'button'; b.dataset.m = m; listen(s, b, 'click', function () { api.setMotion(m); }); motion.append(b); return b; });
    var lab = el('label', 't3s-range'); lab.append(el('span', '', 'Intensity'));
    s.output = el('output'); s.range = el('input'); s.range.type = 'range'; s.range.min = '0'; s.range.max = '100'; lab.append(s.range, s.output);
    listen(s, s.range, 'input', function () { api.setIntensity(s.range.value); });
    s.focusButton = btn('Focus', 't3s-ghost t3s-press', 'Dim and pause the background');
    listen(s, s.focusButton, 'click', function () { api.setFocus(!s.focus); });
    s.welcomeButton = btn('Title card', 't3s-ghost t3s-press', 'Show the theme’s title animation above “What should we build”');
    listen(s, s.welcomeButton, 'click', function () { api.setWelcome(!s.welcome); });
    left.append(motion, lab, s.focusButton, s.welcomeButton);
    var row = el('div', 't3s-g-actions');
    function action(label, title, fn, cls, ic) { var b = btn(label, cls || 't3s-ghost', title, ic); listen(s, b, 'click', fn); row.append(b); return b; }
    if (s.launcher) {
      action('Import', 'Add a .t3skin someone shared with you', function () { tell('__t3skin-import'); }, '', 'download');
      action('Export', 'Save the current theme as one .t3skin file', function () { tell('__t3skin-export:', s.item ? s.item.id : ''); }, '', 'upload');
    }
    action('Turn off', 'Remove the theme and show T3 as normal', function () { tell('__t3skin-off'); destroy(); }, 't3s-ghost t3s-off', 'power');
    foot.append(left, row);

    var body = el('div', 't3s-g-body'); body.append(lib, cr);
    g.append(head, body, foot);
    s.controls.append(s.toggle, g);
    s.category = ''; s.scope = 'all'; s.tab = 'library';
    buildCards(s); setTab(s, 'library');
    listen(s, s.toggle, 'click', function () { setGallery(s, s.gallery.hidden); });
    listen(s, close, 'click', function () { setGallery(s, false); s.toggle.focus(); });
    listen(s, s.search, 'input', function () { if (s.tab !== 'library') setTab(s, 'library'); filterCards(s); });
    listen(s, gen, 'submit', function (e) { e.preventDefault(); generate(s); });
    listen(s, s.threadGo, 'click', function () { sendToThread(s); });
    listen(s, s.controls, 'keydown', function (e) { if (e.key === 'Escape' && !s.gallery.hidden) { e.preventDefault(); e.stopPropagation(); setGallery(s, false); s.toggle.focus(); } });
    listen(s, document, 'pointerdown', function (e) { if (!s.gallery.hidden && !s.controls.contains(e.target)) setGallery(s, false); });
  }
  function setTab(s, tab, focus) {
    s.tab = tab;
    s.tabButtons.forEach(function (b) { var on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    s.libView.hidden = tab !== 'library'; s.createView.hidden = tab !== 'create';
    s.searchWrap.classList.toggle('t3s-dim', tab !== 'library');
    if (tab !== 'library') stopCardPreview(s);
    if (focus) (tab === 'create' ? s.genPrompt : s.search).focus();
  }
  function buildDetail(s) {
    var d = { el: el('aside', 't3s-g-detail') };
    d.el.setAttribute('aria-label', 'Theme details');
    d.stage = el('div', 't3s-g-stage'); d.img = el('img'); d.img.alt = ''; d.img.decoding = 'async';
    d.live = el('div', 't3s-g-live'); d.stage.append(d.img, d.live);
    d.name = el('h3', 't3s-g-dname'); d.tag = el('p', 't3s-g-dtag');
    d.meta = el('dl', 't3s-g-dmeta'); d.pal = el('div', 't3s-g-dpal'); d.pal.setAttribute('aria-hidden', 'true');
    var row = el('div', 't3s-g-drow');
    d.apply = btn('Apply', 't3s-primary t3s-g-apply');
    d.fav = btn('Favourite', 't3s-g-dfav', '', 'star');
    row.append(d.apply, d.fav);
    d.el.append(d.stage, d.name, d.tag, d.meta, d.pal, row);
    listen(s, d.apply, 'click', function () { if (d.item) { s.prevId = s.item && s.item.id; api.setTheme(d.item.id); } });
    listen(s, d.fav, 'click', function () { if (d.item) toggleFav(s, d.item.id); });
    return d;
  }
  function showDetail(s, it) {
    var d = s.detail; it = it || s.item; if (!d || !it) return;
    if (d.item !== it) {
      d.item = it;
      d.img.hidden = !it.thumb; if (it.thumb) d.img.src = themeAsset(s, it, it.thumb); else d.img.removeAttribute('src');
      d.stage.style.background = thumbBg(s, it);
      d.name.textContent = itemName(it); d.tag.textContent = itemTagline(it); d.tag.hidden = !d.tag.textContent;
      d.meta.textContent = '';
      [['Category', itemCategory(it) || '—'], ['Look', (it.kind === 'theme' ? it.theme.appearance : it.appearance) === 'light' ? 'Light' : 'Dark'], ['Background', itemBackground(it)], ['Source', itemSource(it)]]
        .forEach(function (r) { d.meta.append(el('dt', '', r[0]), el('dd', '', r[1])); });
      var p = palOf(it); d.pal.textContent = '';
      [p.bg, p.surface, p.text, p.accent, p.accent2].forEach(function (c) { var i = el('i'); i.style.background = c; d.pal.append(i); });
    }
    var on = !!(s.item && s.item.id === it.id), f = s.favs.indexOf(it.id) >= 0;
    d.apply.disabled = on; d.apply.classList.toggle('t3s-primary', !on); d.apply.querySelector('.t3s-btn-l').textContent = on ? 'Current theme' : 'Apply';
    d.fav.setAttribute('aria-pressed', String(f)); d.fav.querySelector('.t3s-btn-l').textContent = f ? 'Favourited' : 'Favourite';
  }
  function setGallery(s, open) {
    clearTimeout(s.galleryFocusTimer);
    if (open && s.gallery.hidden) s.galleryReturnFocus = document.activeElement;
    s.gallery.hidden = !open; s.toggle.setAttribute('aria-expanded', String(open));
    if (open) { renderGallery(s); showDetail(s, s.item); s.galleryFocusTimer = setTimeout(function () { if (current === s && !s.gallery.hidden) (s.tab === 'create' ? s.genPrompt : s.search).focus(); }, 30); }
    else { stopCardPreview(s); if (s.gallery.contains(document.activeElement)) (s.galleryReturnFocus && s.galleryReturnFocus.isConnected ? s.galleryReturnFocus : s.toggle).focus(); }
  }
  function thumbBg(s, it) {
    var p = palOf(it);
    if (it.thumb) return 'center/cover ' + cssUrl(themeAsset(s, it, it.thumb)) + ',' + p.bg;
    return 'linear-gradient(160deg,' + mix(p.bg, p.accent, 0.18) + ',' + p.bg + ' 70%)';
  }
  function buildCards(s) {
    if (!s.grid) return;
    stopCardPreview(s);
    s.grid.textContent = ''; s.cards = [];
    s.items.forEach(function (it) {
      var card = el('div', 't3s-card'); card.dataset.id = it.id;
      var b = el('button', 't3s-card-main'); b.type = 'button';
      var sw = el('span', 't3s-swatch'); sw.style.background = thumbBg(s, it);
      var mark = el('span', 't3s-card-on'); mark.append(icon('check', 12)); sw.append(mark);
      var meta = el('span', 't3s-meta');
      meta.append(el('span', 't3s-name', itemName(it)), el('span', 't3s-cat', itemCategory(it) + (it.kind === 'theme' && it.theme.generated ? ' · yours' : '')));
      b.append(sw, meta);
      b.setAttribute('aria-label', itemName(it) + ', ' + itemCategory(it));
      var fav = el('button', 't3s-fav'); fav.type = 'button'; fav.append(icon('star', 13));
      listen(s, fav, 'click', function (e) { e.stopPropagation(); toggleFav(s, it.id); });
      listen(s, b, 'click', function () { s.prevId = s.item && s.item.id; api.setTheme(it.id); });
      var hover = function () {
        clearTimeout(s.detailTimer); stopCardPreview(s); s.hoverId = it.id; showDetail(s, it);
        s.cardHoverTimer = setTimeout(function () { startCardPreview(s, it, sw); }, 220);
      };
      listen(s, card, 'pointerenter', hover);
      listen(s, b, 'focus', hover);
      listen(s, card, 'pointerleave', function () { clearTimeout(s.cardHoverTimer); });
      card.append(b, fav);
      s.grid.append(card); s.cards.push({ el: card, item: it, fav: fav, main: b });
    });
    renderFilters(s); filterCards(s); renderGallery(s);
  }
  function renderFilters(s) {
    var counts = {}, order = [];
    s.items.forEach(function (it) { if (itemLegacy(it)) return; var c = itemCategory(it); if (!c) return; if (!counts[c]) { counts[c] = 0; order.push(c); } counts[c]++; });
    order.sort(function (a, b) { return a.localeCompare(b); });
    var legacy = s.items.filter(itemLegacy).length;
    if (s.category && s.category !== 'Legacy' && !counts[s.category]) s.category = '';
    s.catSelect.textContent = '';
    var all = el('option', '', 'All categories'); all.value = ''; s.catSelect.append(all);
    order.forEach(function (c) { var o = el('option', '', c + ' (' + counts[c] + ')'); o.value = c; s.catSelect.append(o); });
    if (legacy) { var o = el('option', '', 'Legacy (' + legacy + ')'); o.value = 'Legacy'; s.catSelect.append(o); }
    s.catSelect.value = s.category;
    s.scopeButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.scope === s.scope)); });
  }
  function filterCards(s) {
    stopCardPreview(s);
    var term = (s.search && s.search.value || '').toLowerCase().trim(), n = 0;
    s.cards.forEach(function (c) {
      var it = c.item, hay = [itemName(it), itemCategory(it)].concat(it.kind === 'theme' ? (it.theme.tags || []).concat(it.theme.tagline || '') : [it.tagline || '']).join(' ').toLowerCase();
      var inScope = s.scope === 'favs' ? s.favs.indexOf(it.id) >= 0 : s.scope === 'yours' ? (it.kind === 'theme' && !it.builtIn) : true;
      var inCat = s.category === 'Legacy' ? itemLegacy(it) : (!itemLegacy(it) || (s.item && s.item.id === it.id && !s.category)) && (!s.category || itemCategory(it) === s.category);
      c.el.hidden = !(inScope && inCat && (!term || hay.indexOf(term) >= 0));
      if (!c.el.hidden) n++;
    });
    s.emptyResults.textContent = s.scope === 'favs' && !s.favs.length ? 'No favourites yet. Use the star on a theme to keep it here.' :
      s.scope === 'yours' && !term ? 'Themes you create or import appear here. Open Create to make one.' : 'No themes match. Try another search or category.';
    s.emptyResults.hidden = n > 0;
    s.count.textContent = n + (n === 1 ? ' theme' : ' themes');
  }
  function toggleFav(s, id) {
    var i = s.favs.indexOf(id); if (i >= 0) s.favs.splice(i, 1); else s.favs.push(id);
    tell('__t3skin-fav:', s.favs); renderGallery(s); filterCards(s);
  }
  // Hover preview: the detail pane plays the theme live (picture, video loop and code layer).
  // On narrow screens the pane is hidden and the card itself plays it.
  function startCardPreview(s, it, sw) {
    stopCardPreview(s);
    if (current !== s || s.gallery.hidden || stopped(s) || it.kind !== 'theme' || !it.code || !it.code.scene) return;
    var host = s.detail && s.detail.el.offsetParent !== null ? s.detail.live : sw;
    if (!host.isConnected) return;
    var r = host.getBoundingClientRect(); if (r.width < 10) return;
    var layer = el('div', 't3s-livewrap'), bd = it.theme.backdrop;
    if (bd && bd.image) { var img = el('img'); img.alt = ''; img.src = themeAsset(s, it, bd.image); img.style.objectPosition = bd.position || '50% 50%'; layer.append(img); }
    if (bd && bd.video && s.motion !== 'still') {
      var v = el('video'); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('muted', ''); v.tabIndex = -1; v.src = themeAsset(s, it, bd.video); v.style.objectPosition = bd.position || '50% 50%';
      v.addEventListener('playing', function () { v.dataset.ready = 'true'; }); layer.append(v); v.play().catch(function () {});
    }
    if (!bd) layer.style.background = palOf(it).bg;
    var box = SB.create({ code: it.code.scene, kind: 'scene', palette: scenePalette(it), params: it.theme.scene.params, light: it.theme.appearance === 'light', backdrop: !!bd, motion: s.motion,
      fps: Math.min(30, MOTION[s.motion].fps), speed: MOTION[s.motion].speed, dpr: Math.min(devicePixelRatio || 1, 2), width: Math.round(r.width), height: Math.round(r.height), run: true, preview: true, t0: 6,
      zones: [], onStatus: function (st) { if (st === 'error') stopCardPreview(s); } });
    box.el.className = 't3s-sandbox t3s-card-live'; box.el.style.colorScheme = 'normal';
    layer.append(box.el); host.append(layer);
    s.cardPreview = { box: box, layer: layer };
    requestAnimationFrame(function () { requestAnimationFrame(function () { layer.classList.add('t3s-in'); }); });
  }
  function stopCardPreview(s) {
    clearTimeout(s.cardHoverTimer);
    if (s.cardPreview) { var v = s.cardPreview.layer.querySelector('video'); if (v) { v.pause(); v.removeAttribute('src'); } s.cardPreview.box.destroy(); s.cardPreview.layer.remove(); s.cardPreview = null; }
  }
  function renderGalleryStatus(s) {
    if (!s.sceneStatus) return;
    var it = s.item, msg = '';
    if (it && it.kind === 'theme') {
      if (s.mode === 'tokens') msg = 'T3 layout changed: showing this theme’s colours only (selectors.js needs an update).';
      else if (s.sceneError) msg = 'Scene stopped (' + s.sceneError + '). A still backdrop is shown instead.';
      else if (s.box && s.box.status === 'slow') msg = s.box.msg;
    }
    s.sceneStatus.textContent = msg; s.sceneStatus.hidden = !msg;
  }
  function renderGallery(s, light) {
    if (!s.gallery) return;
    s.cards.forEach(function (c) {
      var on = !!(s.item && c.item.id === s.item.id); c.el.classList.toggle('t3s-on', on); c.main.setAttribute('aria-pressed', String(on));
      var f = s.favs.indexOf(c.item.id) >= 0; c.fav.setAttribute('aria-pressed', String(f)); c.fav.setAttribute('aria-label', (f ? 'Remove ' : 'Add ') + itemName(c.item) + (f ? ' from' : ' to') + ' favourites');
    });
    s.motionButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === s.motion)); });
    s.focusButton.setAttribute('aria-pressed', String(s.focus));
    s.welcomeButton.setAttribute('aria-pressed', String(!!s.welcome));
    s.range.value = String(s.intensity); s.output.textContent = Math.round(s.intensity) + '%';
    if (s.detail && s.detail.item) showDetail(s, s.hoverId ? s.detail.item : s.item);
    renderGalleryStatus(s);
    void light;
  }

  /* ---------- generation (handled by the launcher, which owns keys and spending) ---------- */
  function generate(s, tweak) {
    if (!s.launcher || s.generating) return;
    var prompt = (s.genPrompt.value || '').trim();
    if (!prompt && !tweak) { s.genStatus.textContent = 'Describe the theme first, for example “Interstellar” or “cosy rainy café”.'; s.genPrompt.focus(); return; }
    s.generating = true; s.genGo.disabled = true; setBusy(s, true);
    s.genStatus.textContent = tweak ? 'Tweaking…' : 'Generating…';
    tell('__t3skin-gen:', { prompt: tweak ? tweak.prompt : prompt, appearance: s.genLook.value, motion: s.genMotion.value, interactive: s.genInteractive.checked, backdrop: tweak ? 'none' : s.genBackdrop.value,
      engine: s.genEngine.value, model: s.genModel.value || undefined, tweakOf: tweak ? tweak.id : undefined, tweak: tweak ? tweak.text : undefined, guidance: promptSettings(s) });
  }
  // Hand the request to a new T3 thread: the launcher writes the brief and starts the thread with T3's own CLI.
  function sendToThread(s) {
    if (!s.launcher || s.threadBusy) return;
    var prompt = (s.genPrompt.value || '').trim();
    if (!prompt) { s.genStatus.textContent = 'Describe the theme first. The new thread starts from your idea.'; s.genPrompt.focus(); return; }
    if (!s.threadOk) {
      // One inline confirmation per session: the new thread's agent starts working right away.
      s.genStatus.textContent = 'This starts a new T3 thread in this project, and its agent begins right away (the Claude or Codex model chosen above, otherwise Opus). ';
      var yes = el('button', 't3s-link', 'Start thread'); yes.type = 'button';
      listen(s, yes, 'click', function () { s.threadOk = true; sendToThread(s); });
      s.genStatus.append(yes); yes.focus(); return;
    }
    s.threadBusy = true; s.threadGo.disabled = true; s.genStatus.textContent = 'Starting a T3 thread…';
    tell('__t3skin-thread:', { prompt: prompt, engine: s.genEngine.value, model: s.genModel.value || undefined, appearance: s.genLook.value, motion: s.genMotion.value, interactive: s.genInteractive.checked, backdrop: s.genBackdrop.value, guidance: promptSettings(s) });
  }
  function openThread(s, path) {
    if (typeof path !== 'string' || path.charAt(0) !== '/') return;
    setGallery(s, false);
    try { history.pushState(history.state, '', path); window.dispatchEvent(new PopStateEvent('popstate', { state: history.state })); }
    catch (e) { location.assign(path); }
  }
  // While a theme is being made: a quiet progress bar on the form and a placeholder card at the top of the grid.
  function setBusy(s, on) {
    s.genBox.classList.toggle('t3s-busy', on); s.genBox.setAttribute('aria-busy', String(on));
    if (s.skeleton) { s.skeleton.remove(); s.skeleton = null; }
    if (on && s.grid) {
      var k = s.skeleton = el('div', 't3s-card t3s-skeleton'); k.setAttribute('aria-hidden', 'true');
      var sw = el('span', 't3s-swatch'), meta = el('span', 't3s-meta');
      meta.append(el('span', 't3s-name', 'Creating…'), el('span', 't3s-cat', 'your new theme'));
      var b = el('span', 't3s-card-main'); b.append(sw, meta); k.append(b); s.grid.prepend(k);
    }
  }
  function onLauncherEvent(s, ev) {
    if (!ev || typeof ev !== 'object') return;
    if (ev.type === 'gen') {
      if (ev.phase === 'progress') { s.genStatus.textContent = String(ev.msg || '').slice(0, 300); return; }
      s.generating = false; s.genGo.disabled = false; setBusy(s, false);
      if (ev.phase === 'error') { s.genStatus.textContent = 'Could not generate: ' + String(ev.msg || '').slice(0, 300); return; }
      if (ev.phase === 'done' && ev.item) {
        s.genStatus.textContent = String(ev.msg || '').slice(0, 300);
        s.prevId = s.item && s.item.id;
        addItems(s, [ev.item], ev.item.id);
        setTab(s, 'create');
        showPreviewBar(s, ev.item, ev.report || {});
      }
    } else if (ev.type === 'thread') {
      s.threadBusy = false; s.threadGo.disabled = !s.launcher;
      s.genStatus.textContent = '';
      if (ev.phase === 'error') { s.genStatus.textContent = 'Could not start a thread: ' + String(ev.msg || '').slice(0, 300); return; }
      s.genStatus.append(document.createTextNode('Started “' + String(ev.title || 'Theme').slice(0, 80) + '” in T3. '));
      var open = el('button', 't3s-link', 'Open thread'); open.type = 'button';
      listen(s, open, 'click', function () { openThread(s, String(ev.path || '')); });
      s.genStatus.append(open);
    } else if (ev.type === 'items') {
      addItems(s, ev.items || [], ev.apply);
    } else if (ev.type === 'removed') {
      removeItem(s, ev.id);
    } else if (ev.type === 'favs') {
      s.favs = Array.isArray(ev.favs) ? ev.favs.slice(0, 200) : s.favs; renderGallery(s);
    }
  }
  function showPreviewBar(s, it, rep) {
    var bar = s.previewBar; bar.textContent = ''; bar.hidden = false;
    var t = it.theme, line = el('p', 't3s-g-pvtitle');
    line.append(el('strong', '', 'Previewing ' + t.name), document.createTextNode(t.tagline ? ' · ' + t.tagline : ''));
    var checks = el('ul', 't3s-g-checks');
    (rep.selfCheck || []).forEach(function (c) { var li = el('li', c.ok ? 'ok' : 'bad', (c.ok ? '✓ ' : '✗ ') + c.item); checks.append(li); });
    (rep.fixes || []).slice(0, 4).forEach(function (f) { checks.append(el('li', 'fix', '↻ ' + f)); });
    if (rep.engineNote) checks.append(el('li', 'fix', 'ℹ ' + rep.engineNote));
    var row = el('div', 't3s-g-pvrow');
    var keep = btn('Keep', 't3s-primary'), again = btn('Regenerate'), twb = btn('Tweak'), discard = btn('Discard', 't3s-ghost t3s-off');
    var tw = el('input'); tw.type = 'text'; tw.placeholder = 'Tweak: more green, calmer, bigger planet…'; tw.setAttribute('aria-label', 'Tweak instruction'); tw.maxLength = 200;
    row.append(keep, again, tw, twb, discard);
    bar.append(line, checks, row);
    listen(s, keep, 'click', function () { bar.hidden = true; s.genStatus.textContent = 'Saved “' + t.name + '” to your library.'; });
    listen(s, again, 'click', function () { bar.hidden = true; s.genPrompt.value = t.prompt || s.genPrompt.value; generate(s); });
    function doTweak() { var v = tw.value.trim(); if (!v) { tw.focus(); return; } bar.hidden = true; generate(s, { id: it.id, text: v, prompt: t.prompt || t.name }); }
    listen(s, twb, 'click', doTweak);
    listen(s, tw, 'keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doTweak(); } });
    listen(s, discard, 'click', function () { bar.hidden = true; tell('__t3skin-discard:', it.id); s.genStatus.textContent = 'Discarded.'; });
  }

  // Prompt settings for AI generation: built-in design guidance (editable), the user's own instructions,
  // and a read-only view of the core contract that is always sent. Stored by the launcher profile (no keys).
  function buildPromptBox(s) {
    var P = s.prompt || {}, box = s.promptBox = el('details', 't3s-g-prompt');
    var sum = el('summary'); sum.append(el('span', 't3s-g-ptitle', 'Prompt guidance'), s.promptSummary = el('span', 't3s-g-psum'));
    var body = el('div', 't3s-g-pbody');
    var off = el('p', 't3s-g-poff', 'Local templates ignore prompt text. Choose a Claude or Codex model to use it.');
    var useRow = el('label', 't3s-g-check t3s-g-use'); s.promptUse = el('input'); s.promptUse.type = 'checkbox'; s.promptUse.checked = P.useTaste !== false;
    useRow.append(s.promptUse, el('span', '', 'Use built-in design guidance'));
    var view = el('button', 't3s-g-pview', 'View prompt'); view.type = 'button'; view.setAttribute('aria-expanded', 'false');
    var row = el('div', 't3s-g-prow'); row.append(useRow, view);
    var panel = el('div', 't3s-g-ppanel'); panel.hidden = true;
    var coreLab = el('div', 't3s-g-plab'); coreLab.append(el('strong', '', 'Core contract'), el('span', '', 'always sent · locked'));
    var core = el('pre', 't3s-g-core'); core.textContent = P.core || 'The core contract is shown in the T3 Code Themes app.'; core.tabIndex = 0; core.setAttribute('aria-label', 'Core contract, read only');
    var tasteLab = el('div', 't3s-g-plab'); tasteLab.append(el('strong', '', 'Design guidance'), s.tasteState = el('span', ''));
    s.promptTaste = el('textarea', 't3s-g-taste'); s.promptTaste.rows = 10; s.promptTaste.maxLength = P.tasteMax || 12000; s.promptTaste.spellcheck = false;
    s.promptTaste.value = P.taste || P.tasteDefault || ''; s.promptTaste.setAttribute('aria-label', 'Design guidance (editable)');
    var reset = el('button', 't3s-g-preset', 'Reset to default'); reset.type = 'button';
    var tasteFoot = el('div', 't3s-g-pfoot'); tasteFoot.append(el('span', '', 'Shapes the look. The core contract wins on any conflict.'), reset);
    panel.append(coreLab, core, tasteLab, s.promptTaste, tasteFoot);
    var ownLab = el('label', 't3s-g-plab t3s-g-own'); ownLab.append(el('strong', '', 'Your own instructions'), el('span', '', 'added after the design guidance'));
    s.promptCustom = el('textarea', 't3s-g-custom'); s.promptCustom.rows = 3; s.promptCustom.maxLength = P.customMax || 4000; s.promptCustom.id = 't3s-gen-custom'; ownLab.htmlFor = 't3s-gen-custom';
    s.promptCustom.value = P.custom || ''; s.promptCustom.placeholder = 'e.g. Hand-inked lines everywhere. Muted 70s film palette. The welcome should feel like a title card.';
    body.append(off, row, panel, ownLab, s.promptCustom);
    box.append(sum, body);
    function edited() { return !!P.tasteDefault && s.promptTaste.value.trim() !== P.tasteDefault.trim(); }
    function refresh() {
      var e = edited(), c = s.promptCustom.value.trim().length;
      s.tasteState.textContent = !s.promptUse.checked ? 'off · not sent' : e ? 'edited' : 'built-in';
      s.promptTaste.disabled = !s.promptUse.checked; reset.disabled = !e;
      s.promptSummary.textContent = (s.promptUse.checked ? (e ? 'Your edited guidance' : 'Built-in guidance') : 'Guidance off') + (c ? ' + your instructions' : '');
      box.classList.toggle('t3s-custom', c > 0 || e || !s.promptUse.checked);
    }
    function save() { clearTimeout(s.promptSaveT); s.promptSaveT = setTimeout(function () { tell('__t3skin-genprompt:', promptSettings(s)); }, 400); }
    s.promptEdited = edited;
    listen(s, s.promptUse, 'change', function () { refresh(); save(); });
    listen(s, s.promptTaste, 'input', function () { refresh(); save(); });
    listen(s, s.promptCustom, 'input', function () { refresh(); save(); });
    listen(s, reset, 'click', function () { s.promptTaste.value = P.tasteDefault || ''; refresh(); save(); s.promptTaste.focus(); });
    listen(s, view, 'click', function () { panel.hidden = !panel.hidden; view.setAttribute('aria-expanded', String(!panel.hidden)); view.textContent = panel.hidden ? 'View prompt' : 'Hide prompt'; });
    if (!s.launcher) { [s.promptUse, s.promptTaste, s.promptCustom, reset].forEach(function (n) { n.disabled = true; }); }
    refresh();
    return box;
  }
  function promptSettings(s) {
    if (!s.promptUse) return undefined;
    return { useTaste: s.promptUse.checked, taste: s.promptEdited() ? s.promptTaste.value : null, custom: s.promptCustom.value };
  }
  /* ---------- pointer → scene ---------- */
  var UI_SEL = "button,a,input,textarea,select,label,[role='button'],[contenteditable],.t3s-controls," + [SEL.zones.sidebar, SEL.zones.topbar, SEL.zones.composer, SEL.zones.details].join(',');
  function onPointer(s, e, kind) {
    if (!s.box && !s.comp) return;
    var over = false;
    try { over = !!(e.target && e.target.closest && e.target.closest(UI_SEL)); } catch (x) {}
    if (!over) for (var i = 0; i < s.zones.length; i++) { var z = s.zones[i]; if (z.kind === 'messages' && e.clientX >= z.x && e.clientX <= z.x + z.w && e.clientY >= z.y && e.clientY <= z.y + z.h) { over = true; break; } }
    var msg = { type: 'pointer', kind: kind, x: e.clientX, y: e.clientY, overUI: over, inside: true };
    if (s.box) s.box.pointer(msg); if (s.comp) s.comp.pointer(msg);
  }

  /* ---------- mount / destroy ---------- */
  function mount(options) {
    if (current) return api;
    options = options || {};
    var items = (options.items || []).concat((options.skins || []).map(function (k) { k.kind = k.kind || 'skin'; return k; })).filter(valid);
    if (!items.length) throw new Error('No valid themes or skins supplied');
    var s = current = {
      base: new URL(options.skinBase || './skins/', document.baseURI).href, themeBase: new URL(options.themeBase || './themes/', document.baseURI).href,
      items: items, item: null, skin: null, launcher: !!options.launcher, engines: options.engines, prompt: options.prompt, favs: Array.isArray(options.favourites) ? options.favourites.slice() : [], welcome: options.welcome === true,
      motion: MOTION[options.motion] ? options.motion : 'live', focus: false, intensity: clamp(options.intensity != null ? options.intensity : 100, 0, 100),
      cleanup: [], raf: 0, last: 0, t: Math.random() * 100, mx: 0, my: 0, tx: 0, ty: 0, parts: [], welcomes: [], welcomeHeads: new WeakMap(), fpsMeasured: 0,
      zones: [], zonesKey: '', mode: 'full', health: { ok: true, missing: [] }, healthMisses: 0, box: null, cards: []
    };
    s.themeStyle = el('style'); s.themeStyle.setAttribute('data-t3-skin-owned', ''); document.head.append(s.themeStyle);
    s.backdrop = el('div', 't3s-backdrop'); s.backdrop.setAttribute('aria-hidden', 'true'); s.backdrop.setAttribute('inert', '');
    s.visual = el('div', 't3s-visual');
    s.fallback = el('div', 't3s-fallback'); s.fallback.hidden = true;
    s.sceneHost = el('div', 't3s-scenehost');
    s.scene = el('canvas', 't3s-scene');
    s.plateWrap = el('div', 't3s-platewrap');
    s.pcanvas = el('canvas', 't3s-particles'); s.pctx = s.pcanvas.getContext('2d');
    s.light = el('div', 't3s-light');
    s.visual.append(s.fallback, s.scene, s.plateWrap, s.sceneHost, s.pcanvas, s.light);
    s.overlayFx = el('div', 't3s-overlayfx');
    s.scrims = el('div', 't3s-scrims');
    s.backdrop.append(s.visual, el('div', 't3s-shade'), s.overlayFx, s.scrims);
    try { s.gl = initGL(s); } catch (e) { s.gl = null; console.warn('T3 skin: WebGL scene disabled', e && e.message); }
    listen(s, s.scene, 'webglcontextlost', function (e) { e.preventDefault(); s.gl = null; sync(s); });
    buildGallery(s);
    document.body.prepend(s.backdrop); document.body.append(s.controls);
    document.documentElement.setAttribute('data-t3-skin', 'on');
    document.documentElement.setAttribute('data-t3-skin-mode', 'full');
    // pointer: parallax target, cursor light and scene input (transform only, no layout)
    listen(s, window, 'pointermove', function (e) {
      s.tx = (e.clientX / innerWidth) * 2 - 1; s.ty = (e.clientY / innerHeight) * 2 - 1;
      s.light.style.transform = 'translate3d(' + (e.clientX - 300) + 'px,' + (e.clientY - 300) + 'px,0)';
      onPointer(s, e, 'move');
    }, { passive: true, capture: true });
    listen(s, window, 'pointerdown', function (e) { onPointer(s, e, 'down'); }, { passive: true, capture: true });
    listen(s, window, 'pointerup', function (e) { onPointer(s, e, 'up'); }, { passive: true, capture: true });
    listen(s, document, 'visibilitychange', function () { sync(s); });
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)'); listen(s, mq, 'change', function () { sync(s); });
    var resizeT = 0;
    listen(s, window, 'resize', function () {
      if (s.skin && stopped(s)) { drawGL(s); stepParticles(s, 0); }
      if (s.box) s.box.resize(innerWidth, innerHeight, sceneDpr(s));
      if (s.comp) s.comp.resize(innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));
      clearTimeout(resizeT); resizeT = setTimeout(function () { updateZones(s, true); }, 60);
    });
    // Zones follow layout changes (sidebar collapse, new messages, details panel) without polling hard.
    var zoneT = 0, schedule = function () { if (!zoneT) zoneT = setTimeout(function () { zoneT = 0; updateZones(s); checkWorking(s); }, 120); };
    var inComposer = function (t) { try { return !!(t && t.closest && t.closest(SEL.layout.composer.sel)); } catch (x) { return false; } };
    listen(s, document, 'input', function (e) { if (inComposer(e.target)) uiEvent(s, 'typing', Date.now()); }, { capture: true, passive: true });
    listen(s, document, 'keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || !inComposer(e.target)) return;
      var v = e.target.value != null ? e.target.value : e.target.textContent; if (String(v || '').trim()) uiEvent(s, 'sent', Date.now());
    }, { capture: true });
    listen(s, document, 'click', function (e) { var b = null; try { b = e.target && e.target.closest && e.target.closest(SEL.layout.composerAction.sel); } catch (x) {} if (b && !b.disabled) uiEvent(s, 'sent', Date.now()); }, { capture: true, passive: true });
    var mo = new MutationObserver(function (rs) { rs.forEach(function (r) { attachWelcome(s, r.target); }); schedule(); });
    mo.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
    listen(s, document, 'scroll', schedule, { capture: true, passive: true });
    listen(s, document, 'transitionend', schedule, { capture: true, passive: true });
    var hz = setInterval(function () { checkHealth(s); }, 2000);
    s.cleanup.push(function () { mo.disconnect(); clearInterval(hz); clearTimeout(zoneT); clearTimeout(resizeT); clearWelcomes(s); stopScene(s); stopCardPreview(s); });
    applyItem(s, options.active, false);
    setTimeout(function () { checkHealth(s); }, 600);
    return api;
  }
  function destroy() {
    var s = current; if (!s) return api;
    cancelAnimationFrame(s.raf);
    clearTimeout(s.applyTimer); clearTimeout(s.galleryFocusTimer);
    s.cleanup.forEach(function (f) { try { f(); } catch (e) {} });
    current = null;
    if (s.video) { s.video.pause(); s.video.removeAttribute('src'); s.video.load(); }
    if (s.gl) { var ext = s.gl.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
    s.backdrop.remove(); s.controls.remove(); s.themeStyle.remove();
    ['data-t3-skin', 'data-t3-skin-id', 'data-t3-skin-kind', 'data-t3-skin-motion', 'data-t3-skin-mode'].forEach(function (a) { document.documentElement.removeAttribute(a); });
    nudgeTerminal(true);
    return api;
  }
  window.T3Skin = api;
})();
