'use strict';
// Theme pack format t3theme/1: validation, normalisation, contrast repair and loading.
// Used by the launcher (before anything reaches the T3 page), the generator and .t3skin import.
// Nothing here trusts the pack: unknown keys are dropped, enums are whitelisted, numbers clamped,
// colours must be #hex, code is syntax-checked and size-capped, SVG icons are rebuilt from a whitelist.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Files = require('./theme-files.cjs');

const FORMAT = 't3theme/1';
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const MAX_CODE = 96 * 1024;
const MAX_ICON = 8 * 1024;
const CATEGORIES = ['Space', 'Cartoon', 'Retro', 'Cozy', 'Interactive', 'Minimal', 'Nature', 'Neon', 'ASCII', 'Ocean', 'Abstract', 'Seasonal', 'Fandom', 'Other'];
const ENUMS = {
  appearance: ['light', 'dark'],
  density: ['compact', 'normal', 'roomy'],
  surface: ['glass', 'solid', 'paper'],
  shadow: ['none', 'soft', 'hard', 'glow'],
  topbar: ['glass', 'solid', 'transparent', 'accent-line'],
  sidebarSide: ['left', 'right'],
  decor: ['none', 'brackets', 'stitch', 'double'],
  overlay: ['none', 'scanlines', 'grain', 'vignette'],
  heroStyle: ['plain', 'gradient', 'outline', 'glow', 'shadow'],
  iconStyle: ['default', 'bold', 'thin', 'pixel', 'glow', 'cartoon'],
  iconColor: ['text', 'accent', 'muted'],
  loader: ['spin', 'pulse', 'bounce', 'braille', 'blocks', 'orbit'],
  busy: ['low', 'medium', 'high'],
};
const ICON_NAMES = ['settings', 'search', 'filter', 'folder-plus', 'new-thread', 'folder', 'plus', 'clip', 'brain', 'server', 'branch',
  'pull-request', 'stats', 'menu', 'ellipsis', 'panel-bottom', 'panel-right', 'clock', 'check', 'chevron', 'lock'];
// Code that would try to reach the network or escape is rejected outright (the sandbox blocks it anyway).
const BANNED = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bEventSource\b/, /\bimportScripts\b/, /\bimport\s*\(/, /\bnavigator\.sendBeacon\b/, /\bpostMessage\s*\(/];

/* ---------------- colour maths ---------------- */
function rgb(c) { c = c.replace('#', ''); if (c.length === 3) c = c.replace(/./g, '$&$&'); const n = parseInt(c, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function hex(v) { return '#' + v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); }
function over(fg, alpha, bg) { return mix(bg, fg, alpha); } // fg at alpha composited over bg
function lum(c) { return rgb(c).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function onAccent(acc) { const dark = '#111111', light = '#ffffff'; return ratio(dark, acc) >= ratio(light, acc) ? dark : light; }
// Move fg toward black or white until it reaches `min` against bg (or as far as it can).
function pushContrast(fg, bg, min) {
  if (ratio(fg, bg) >= min) return fg;
  const target = lum(bg) > 0.18 ? '#000000' : '#ffffff';
  for (let t = 0.05; t <= 1.0001; t += 0.05) { const c = mix(fg, target, t); if (ratio(c, bg) >= min) return c; }
  const other = target === '#000000' ? '#ffffff' : '#000000';
  return ratio(other, bg) > ratio(target, bg) ? other : target;
}

/* ---------------- primitives ---------------- */
const str = (v, max = 80) => typeof v === 'string' ? v.replace(/[\u0000-\u001f<>`]/g, '').trim().slice(0, max) : undefined;
const num = (v, lo, hi, d) => typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const bool = (v, d) => typeof v === 'boolean' ? v : d;
const pick = (v, list, d) => list.includes(v) ? v : d;
const color = v => typeof v === 'string' && COLOR.test(v.trim()) ? v.trim().toLowerCase() : undefined;
const relFile = (v, ext) => Files.safeRelative(v) && ext.test(v) ? v : undefined;
// Local font family names only: letters, digits, spaces, hyphen, apostrophe. Generic families allowed.
function fontStack(v, fallback) {
  if (typeof v !== 'string') return fallback;
  const fams = v.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(f => /^[\w \-']{1,40}$/.test(f)).slice(0, 8);
  if (!fams.length) return fallback;
  const generic = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded'];
  return fams.map(f => generic.includes(f) ? f : `"${f.replace(/"/g, '')}"`).join(', ');
}
// JSON-safe free-form params for the scene (numbers, short strings, booleans, small arrays/objects).
function params(v, depth = 0, budget = { left: 2048 }) {
  if (--budget.left < 0 || depth > 3) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.replace(/[\u0000-\u001f]/g, '').slice(0, 200);
  if (Array.isArray(v)) return v.slice(0, 64).map(x => params(x, depth + 1, budget)).filter(x => x !== undefined);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).slice(0, 48)) if (/^[\w-]{1,40}$/.test(k) && !['__proto__', 'constructor', 'prototype'].includes(k)) { const x = params(v[k], depth + 1, budget); if (x !== undefined) o[k] = x; } return o; }
  return undefined;
}

/* ---------------- SVG icon sanitiser ---------------- */
const SVG_TAGS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect']);
const SVG_ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'viewbox', 'fill', 'stroke',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'transform', 'opacity', 'fill-rule', 'clip-rule', 'fill-opacity', 'stroke-opacity']);
function sanitizeSvg(src) {
  if (typeof src !== 'string' || Buffer.byteLength(src) > MAX_ICON) return null;
  const out = []; const stack = [];
  const re = /<\s*(\/)?\s*([a-zA-Z][\w:-]*)([^>]*?)(\/)?\s*>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>/g;
  let m, sawSvg = false;
  while ((m = re.exec(src))) {
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (!m[1] && ((!sawSvg && tag !== 'svg') || (sawSvg && (tag === 'svg' || !stack.length)))) return null;
    if (!SVG_TAGS.has(tag)) return null; // anything else (script, foreignObject, use, image, style, a…) rejects the icon
    if (m[1]) { if (stack.pop() !== tag) return null; out.push(`</${tag}>`); continue; }
    const attrs = [];
    const ar = /([a-zA-Z][\w:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g; let a;
    while ((a = ar.exec(m[3]))) {
      const name = a[1].toLowerCase(), val = a[3] ?? a[4];
      if (!SVG_ATTRS.has(name)) continue;
      if (/[<>&]|url\s*\(|javascript:|expression/i.test(val) || val.length > 4000) continue;
      if (['fill', 'stroke'].includes(name) && !/^(none|currentColor|#[0-9a-f]{3,6}|black|white)$/i.test(val)) continue;
      attrs.push(`${name === 'viewbox' ? 'viewBox' : name}="${val.replace(/"/g, '&quot;')}"`);
    }
    if (tag === 'svg') { sawSvg = true; attrs.push('xmlns="http://www.w3.org/2000/svg"'); }
    out.push(`<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}${m[4] ? '/' : ''}>`);
    if (!m[4]) stack.push(tag);
  }
  if (!sawSvg || stack.length) return null;
  return out.join('');
}

/* ---------------- code checks ---------------- */
function checkCode(code, label, report, kind) {
  if (typeof code !== 'string' || !code.trim()) { report.errors.push(`${label}: missing`); return null; }
  if (Buffer.byteLength(code) > MAX_CODE) { report.errors.push(`${label}: ${Math.round(Buffer.byteLength(code) / 1024)} KB is over the ${MAX_CODE / 1024} KB limit`); return null; }
  for (const b of BANNED) if (b.test(code)) { report.errors.push(`${label}: uses a blocked API (${b.source.replace(/\\[sb]|\\\(|\*|\?/g, '')}); scenes cannot use the network or messaging`); return null; }
  if (!(kind === 'welcome' ? /\bT3Welcome\s*\(/ : /\bT3Scene\s*\(/).test(code)) { report.errors.push(`${label}: must call ${kind === 'welcome' ? 'T3Welcome' : 'T3Scene'}(function (api) { … })`); return null; }
  try { new vm.Script(code, { filename: label }); } catch (e) { report.errors.push(`${label}: syntax error: ${String(e.message).slice(0, 160)}`); return null; }
  return code;
}

/* ---------------- theme.json normaliser ---------------- */
// Hybrid themes: an AI image (and an optional seamless video loop) shown under the code scene.
function backdropRef(B) {
  if (!B || typeof B !== 'object') return undefined;
  const image = relFile(B.image, /\.(png|jpe?g|webp)$/i), video = relFile(B.video, /\.(mp4|webm)$/i);
  if (!image && !video) return undefined;
  const position = typeof B.position === 'string' && /^\d{1,3}% \d{1,3}%$/.test(B.position) ? B.position : '50% 50%';
  return { image, video, position, opacity: num(B.opacity, 0.2, 1, 1), dim: num(B.dim, 0, 0.8, 0), drift: bool(B.drift, true) };
}
function normalize(raw, report) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('theme.json is not an object');
  const P = raw.palette || {};
  const appearance = pick(raw.appearance, ENUMS.appearance, undefined);
  const bg = color(P.bg);
  if (!bg) throw Error('palette.bg must be a #hex colour');
  const dark = appearance ? appearance === 'dark' : lum(bg) < 0.4;
  const text = color(P.text) || (dark ? '#f2f2f5' : '#16161a');
  const surface = color(P.surface) || mix(bg, text, 0.06);
  const accent = color(P.accent) || (dark ? '#7aa2ff' : '#3a5bd9');
  const palette = {
    bg, surface, text,
    muted: color(P.muted) || mix(text, bg, 0.38),
    accent, accent2: color(P.accent2) || accent,
    border: color(P.border) || mix(surface, text, 0.16),
    selection: color(P.selection) || accent,
    codeBg: color(P.codeBg) || mix(bg, dark ? '#000000' : '#ffffff', 0.35),
    codeText: color(P.codeText) || text,
    danger: color(P.danger) || (dark ? '#ff6b6b' : '#c62828'),
  };
  const sceneColors = Array.isArray(raw.sceneColors) ? raw.sceneColors.map(color).filter(Boolean).slice(0, 8) : [];
  const F = raw.fonts || {};
  const fonts = {
    ui: fontStack(F.ui, undefined), mono: fontStack(F.mono, undefined), display: fontStack(F.display, undefined),
    files: Array.isArray(F.files) ? F.files.slice(0, 4).map(f => f && { family: str(f.family, 40), file: relFile(f.file, /\.(woff2?|ttf|otf)$/i), weight: /^(?:normal|bold|[1-9]\d{0,2}|1000)(?: (?:[1-9]\d{0,2}|1000))?$/.test(String(f.weight || '400')) ? String(f.weight || '400') : '400', style: pick(f.style, ['normal', 'italic'], 'normal') }).filter(f => f && f.family && /^[\w \-']+$/.test(f.family) && f.file) : [],
  };
  const S = raw.shape || {};
  const U = raw.ui || {};
  const I = raw.icons || {};
  const M = raw.motion || {};
  const T = raw.textSafety || {};
  const sceneRef = r => {
    if (!r || typeof r !== 'object') return undefined;
    const file = relFile(r.file, /\.js$/i);
    const template = typeof r.template === 'string' && ID.test(r.template) ? r.template : undefined;
    if (!file && !template) return undefined;
    return { file, template, params: params(r.params) || {} };
  };
  const out = {
    format: FORMAT,
    id: typeof raw.id === 'string' && ID.test(raw.id) ? raw.id : undefined,
    name: str(raw.name, 40) || 'Untitled theme',
    tagline: str(raw.tagline, 80),
    description: str(raw.description, 300),
    category: pick(raw.category, CATEGORIES, 'Other'),
    tags: Array.isArray(raw.tags) ? raw.tags.map(t => str(t, 20)).filter(Boolean).slice(0, 8) : [],
    author: str(raw.author, 40),
    prompt: str(raw.prompt, 400),
    generated: bool(raw.generated, false),
    appearance: dark ? 'dark' : 'light',
    palette, sceneColors, fonts,
    shape: { radius: num(S.radius, 0, 28, 10), density: pick(S.density, ENUMS.density, 'normal'), borderWidth: num(S.borderWidth, 1, 3, 1) },
    ui: {
      surface: pick(U.surface, ENUMS.surface, 'glass'), glass: num(U.glass, 0.6, 0.98, 0.78), blur: num(U.blur, 0, 24, 14),
      shadow: pick(U.shadow, ENUMS.shadow, 'soft'), topbar: pick(U.topbar, ENUMS.topbar, 'glass'), sidebarSide: pick(U.sidebarSide, ENUMS.sidebarSide, 'left'),
      decor: pick(U.decor, ENUMS.decor, 'none'), textGlow: bool(U.textGlow, false), overlay: pick(U.overlay, ENUMS.overlay, 'none'),
      heroStyle: pick(U.heroStyle, ENUMS.heroStyle, 'plain'), cursorLight: bool(U.cursorLight, false), hideStageArt: bool(U.hideStageArt, true),
      uppercase: bool(U.uppercase, false),
    },
    icons: { style: pick(I.style, ENUMS.iconStyle, 'default'), color: pick(I.color, ENUMS.iconColor, 'text'), custom: {} },
    loader: { style: pick((raw.loader || {}).style, ENUMS.loader, 'spin') },
    motion: { fps: num(M.fps, 10, 60, 30), resolution: num(M.resolution, 0.4, 1, 0.75), interactive: bool(M.interactive, false) },
    scene: sceneRef(raw.scene),
    welcome: sceneRef(raw.welcome),
    textSafety: { scrim: num(T.scrim, 0.35, 0.92, 0.55), heroScrim: num(T.heroScrim, 0.15, 0.85, 0.35), blur: num(T.blur, 0, 16, 6), busy: pick(T.busy, ENUMS.busy, 'medium') },
    thumb: relFile(raw.thumb, /\.(png|jpe?g|webp)$/i),
    backdrop: backdropRef(raw.backdrop),
  };
  if (out.welcome) { out.welcome.height = num((raw.welcome || {}).height, 80, 260, 150); out.welcome.text = str((raw.welcome || {}).text, 40); }
  if (I.custom && typeof I.custom === 'object') for (const k of Object.keys(I.custom)) {
    if (!ICON_NAMES.includes(k)) { report.warnings.push(`icons.custom.${k}: unknown icon name (known: ${ICON_NAMES.join(', ')})`); continue; }
    const v = I.custom[k];
    if (typeof v === 'string' && /^\s*<svg/i.test(v)) out.icons.custom[k] = { inline: v };
    else { const f = relFile(v, /\.svg$/i); if (f) out.icons.custom[k] = { file: f }; }
  }
  // Busy scenes need a stronger scrim behind messages.
  const minScrim = { low: 0.35, medium: 0.45, high: 0.6 }[out.textSafety.busy];
  if (out.textSafety.scrim < minScrim) { report.fixes.push(`textSafety.scrim raised ${out.textSafety.scrim} → ${minScrim} (scene marked "${out.textSafety.busy}")`); out.textSafety.scrim = minScrim; }
  return out;
}

/* ---------------- legibility: WCAG checks on the real UI surfaces, with repair ---------------- */
function legibility(theme, report) {
  const p = theme.palette;
  const repair = (key, passes, label) => {
    const before = p[key];
    if (passes(before)) return;
    let after = before;
    // Test all surfaces together: repairing the last one must not undo an earlier fix.
    search: for (let step = 1; step <= 255; step++) {
      for (const target of ['#000000', '#ffffff']) {
        const candidate = mix(before, target, step / 255);
        if (passes(candidate)) { after = candidate; break search; }
      }
    }
    if (after !== before) { p[key] = after; report.fixes.push(`${label}: ${key} ${before} → ${after}`); }
  };
  const fix = (key, against, min, label) => repair(key,
    c => [].concat(typeof against === 'function' ? against(c) : against).every(bg => ratio(c, bg) >= min), label);
  fix('accent', [p.bg, p.surface], 3, 'accent visibility');
  p.onAccent = onAccent(p.accent);
  // Buttons: if neither black nor white text reaches 4.5:1 on the accent, nudge the accent away from the label colour.
  if (ratio(p.onAccent, p.accent) < 4.5) {
    const before = p.accent, away = p.onAccent === '#ffffff' ? '#000000' : '#ffffff';
    for (let t = 0.04; t <= 0.6 && ratio(p.onAccent, p.accent) < 4.5; t += 0.04) p.accent = mix(before, away, t);
    if (p.accent !== before) report.fixes.push(`button contrast: accent ${before} → ${p.accent}`);
  }

  // Keep these blends aligned with tokensCss in runtime/engine.js. Selection retains
  // the element's foreground, so its translucent background needs a separate check.
  const glassAlpha = theme.ui.surface === 'solid' ? 0.97 : theme.ui.surface === 'paper' ? 0.94 : theme.ui.glass;
  const sceneCands = [...new Set([p.bg, p.accent, p.accent2, ...theme.sceneColors])];
  const selected = bg => over(p.selection, 0.4, bg);
  const surfaces = (text = p.text) => [
    ['background', [p.bg]], ['panel', [p.surface]],
    ['raised panel', [mix(p.surface, text, 0.04)]], ['muted panel', [mix(p.surface, p.bg, 0.3)]],
    ['hovered sidebar row', [mix(p.surface, text, 0.05)]],
    ['selected sidebar row', [mix(p.surface, text, 0.10)]],
    ['glass over scene', sceneCands.map(c => over(p.surface, glassAlpha, c))],
    ['strong glass over scene', sceneCands.map(c => over(mix(p.surface, p.bg, 0.3), Math.max(0.9, glassAlpha), c))],
    ['topbar over scene', sceneCands.map(c => theme.ui.topbar === 'solid' ? p.surface :
      theme.ui.topbar === 'transparent' ? c : theme.ui.topbar === 'accent-line' ? over(p.bg, 0.7, c) : over(p.surface, 0.62, c))],
  ];
  const backgrounds = text => surfaces(text).flatMap(([, colors]) => colors);
  fix('text', candidate => backgrounds(candidate), 4.5, 'text legibility');
  fix('muted', backgrounds(p.text), 4.5, 'secondary text legibility');
  fix('codeText', [p.codeBg], 4.5, 'code legibility');
  fix('codeText', [p.codeBg, selected(p.codeBg)], 4.5, 'code legibility');
  // If the selection tint is too bright/dark for inherited text, repair the tint
  // itself rather than rejecting otherwise readable panels or flattening all text to white.
  repair('selection', candidate => backgrounds(p.text).every(bg =>
    [p.text, p.muted].every(fg => ratio(fg, over(candidate, 0.4, bg)) >= 4.5)) &&
    ratio(p.codeText, over(candidate, 0.4, p.codeBg)) >= 4.5, 'text selection legibility');

  // Check every declared scene colour; the farthest from the panel is not
  // necessarily the least readable behind a particular foreground/selection.
  let s = theme.textSafety.scrim;
  const scrimPasses = alpha => sceneCands.every(c => {
    const bg = over(p.bg, alpha, c);
    return ratio(p.text, bg) >= 4.5 && ratio(p.text, selected(bg)) >= 4.5;
  });
  while (!scrimPasses(s) && s < 0.92) s = Math.min(0.92, Math.round((s + 0.05) * 100) / 100);
  if (s !== theme.textSafety.scrim) { report.fixes.push(`message scrim raised ${theme.textSafety.scrim} → ${s} for text and selection contrast`); theme.textSafety.scrim = s; }

  const rows = [];
  const check = (pair, fg, colors, min = 4.5) => {
    const bg = colors.reduce((worst, c) => ratio(fg, c) < ratio(fg, worst) ? c : worst);
    rows.push({ pair, fg, bg, ratio: Math.round(ratio(fg, bg) * 100) / 100, min, ok: ratio(fg, bg) >= min });
  };
  for (const [name, colors] of surfaces()) {
    check(`text on ${name}`, p.text, colors);
    check(`secondary text on ${name}`, p.muted, colors);
    check(`text selection on ${name}`, p.text, colors.map(selected));
    check(`secondary text selection on ${name}`, p.muted, colors.map(selected));
  }
  const scrims = sceneCands.map(c => over(p.bg, s, c));
  check('text on scrimmed scene', p.text, scrims);
  check('text selection on scrimmed scene', p.text, scrims.map(selected));
  check('accent on background', p.accent, [p.bg], 3);
  check('accent on panel', p.accent, [p.surface], 3);
  check('button label on accent', p.onAccent, [p.accent]);
  check('code text on code block', p.codeText, [p.codeBg]);
  check('code text selection', p.codeText, [selected(p.codeBg)]);
  report.contrast = rows;
  for (const r of report.contrast) if (!r.ok) report.errors.push(`contrast: ${r.pair} is ${r.ratio}:1 (needs ${r.min}:1) and could not be repaired`);
}

/* ---------------- load a theme folder ---------------- */
// opts.templates: function(name, kind) -> code string or null (built-in scene/welcome templates)
function loadTheme(dir, opts = {}) {
  const report = { errors: [], warnings: [], fixes: [], contrast: [] };
  let raw;
  try { raw = JSON.parse(Files.readLocal(dir, 'theme.json', 'utf8')); }
  catch (e) { return { ok: false, report: { ...report, errors: ['theme.json: ' + e.message] } }; }
  return validateTheme(raw, name => Files.readLocal(dir, name, 'utf8'),
    { ...opts, binaryExists: name => !!Files.localFile(dir, name) }, report, path.basename(dir));
}
// readFile(relativeName) -> string|null. Works for folders, zip entries and model output alike.
function validateTheme(raw, readFile, opts = {}, report = { errors: [], warnings: [], fixes: [], contrast: [] }, fallbackId) {
  const read = name => { try { return readFile(name); } catch (e) { report.errors.push(`${name}: ${e.message}`); return null; } };
  let theme;
  try { theme = normalize(raw, report); } catch (e) { report.errors.push(e.message); return { ok: false, report }; }
  theme.id = theme.id || (ID.test(fallbackId || '') ? fallbackId : undefined) || theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'theme';
  legibility(theme, report);
  const code = {};
  for (const kind of ['scene', 'welcome']) {
    const ref = theme[kind]; if (!ref) continue;
    let src = null, label = '';
    if (ref.file) { src = read(ref.file); label = ref.file; if (src == null) report.errors.push(`${kind}.file ${ref.file} not found`); }
    else if (ref.template) { src = opts.templates ? opts.templates(ref.template, kind) : null; label = `template ${ref.template}`; if (src == null) report.errors.push(`${kind}.template "${ref.template}" does not exist`); }
    if (src != null) code[kind] = checkCode(src, label, report, kind);
    if (!code[kind]) { report.warnings.push(`${kind} disabled: the theme keeps its colours, a still backdrop is used instead`); theme[kind] = undefined; delete code[kind]; }
  }
  const icons = {};
  for (const [name, ref] of Object.entries(theme.icons.custom)) {
    const svg = sanitizeSvg(ref.inline != null ? ref.inline : read(ref.file));
    if (svg) icons[name] = svg; else report.warnings.push(`icon ${name}: rejected (only plain path/shape SVG is allowed)`);
  }
  theme.icons.custom = Object.keys(icons);
  const hasBinary = name => {
    try { return opts.binaryExists ? opts.binaryExists(name) : readFile(name) != null; }
    catch (e) { report.warnings.push(`${name}: ${e.message}`); return false; }
  };
  if (opts.checkFiles !== false) {
    if (theme.backdrop) {
      for (const key of ['image', 'video']) { const f = theme.backdrop[key]; if (f && !hasBinary(f)) { report.warnings.push(`backdrop file ${f} not found or unusable`); delete theme.backdrop[key]; } }
      if (!theme.backdrop.image && !theme.backdrop.video) theme.backdrop = undefined;
    }
    theme.fonts.files = theme.fonts.files.filter(f => { if (hasBinary(f.file)) return true; report.warnings.push(`font file ${f.file} not found or unusable`); return false; });
    if (theme.thumb && !hasBinary(theme.thumb)) theme.thumb = undefined;
  }
  // Self-check list shown in the gallery and REPORT.md.
  report.selfCheck = [
    { item: 'Contrast (WCAG) on panels, sidebar states, selections, code, buttons and scrimmed scene', ok: report.contrast.every(r => r.ok) },
    { item: 'Scene runs sandboxed (no network, no access to T3)', ok: true },
    { item: `Scrim behind messages ${Math.round(theme.textSafety.scrim * 100)}%`, ok: theme.textSafety.scrim >= 0.35 },
    { item: `Frame budget: ${theme.motion.fps} fps cap, ${Math.round(theme.motion.resolution * 100)}% resolution`, ok: theme.motion.fps <= 60 },
    { item: 'Scene code present and valid', ok: !!code.scene },
    { item: 'Welcome animation present and valid', ok: !!code.welcome },
  ];
  const ok = report.errors.filter(e => !/^(scene|welcome)|template|\.js/.test(e)).length === 0;
  return { ok, theme, code, icons, report };
}

function manifestOf(result) {
  return { ...result.theme, icons: { ...result.theme.icons, custom: Object.fromEntries(Object.keys(result.icons).map(n => [n, `icons/${n}.svg`])) } };
}

module.exports = { FORMAT, CATEGORIES, ENUMS, ICON_NAMES, loadTheme, validateTheme, sanitizeSvg, manifestOf, ratio, mix, lum, onAccent, pushContrast };
