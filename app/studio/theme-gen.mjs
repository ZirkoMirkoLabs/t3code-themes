#!/usr/bin/env node
// Theme Generator: one prompt -> a complete t3theme/1 pack written as code (theme.json, scene.js, welcome.js, icons).
//
//   node studio/theme-gen.mjs --prompt "cosy rainy café" [--appearance any|light|dark] [--motion live|calm|still]
//        [--interactive] [--engine offline|claude-sonnet|claude-opus|claude-haiku|claude-cli|codex-cli]
//        [--model <full-model-id>] [--max-usd 1] [--time 8m]
//        [--tweak-of <themeId> --tweak "more green, calmer"] [--events] [--estimate] [--reply-file saved-reply.json]
//        [--no-taste] [--taste <text> | --taste-file f] [--custom <text> | --custom-file f]   (design guidance; core contract always sent)
//        [--backdrop auto|higgsfield|openai|… [--backdrop-video] [--max-credits 6]]   (hybrid: AI picture/video + atmos code layer)
//
// Hybrid: the model writes the theme, an image prompt, a motion prompt and atmos-template settings (no code, so it is
// fast); studio/skin-studio.mjs then paints the backdrop with its receipts and spend caps, into themes/<id>/media/.
//
// Engines: offline = deterministic mood + template library (free, instant, always works).
//          claude-sonnet / claude-opus / claude-haiku = Anthropic Messages API (paid, receipts kept).
//          claude-cli / codex-cli = local CLI login; subscription/extra/API usage depends on that account.
//          Codex CLI has no dollar-cap control; --time still bounds execution. Consent belongs to the launcher.
// Model output is validated (tokens, contrast, code syntax, banned APIs, SVG); one repair round is tried;
// anything still broken falls back to templates so a working theme is ALWAYS produced.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { FAMILY_DEFAULT, selectModel, callCli as runCli, totalKnownCost, CLI_BILLING, runCliProcess } from './theme-cli.mjs';

const require = createRequire(import.meta.url);
const V = require('../launcher/theme-validate.cjs');
const Files = require('../launcher/theme-files.cjs');
const Lib = require('../launcher/theme-library.cjs');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const themesRoot = Lib.themesRoot;
const baseDir = id => fs.existsSync(path.join(Lib.basesRoot, id)) ? path.join(Lib.basesRoot, id) : path.join(themesRoot, id);

/* ---------------- args & events ---------------- */
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const has = n => argv.includes(n);
const EVENTS = has('--events');
function emit(type, data = {}) { if (EVENTS) process.stdout.write(JSON.stringify({ type, ...data }) + '\n'); else if (type !== 'done') console.log(type === 'progress' ? '· ' + data.msg : `${type}: ${data.msg || ''}`); else console.log(`done: themes/${data.id}  (${data.note || ''})`); }
const progress = msg => emit('progress', { msg });

/* ---------------- small colour helpers ---------------- */
function hsl(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); }
function toHsl(hex) { hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.replace(/./g, '$&$&'); let [r, g, b] = hex.match(/../g).map(x => parseInt(x, 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
function hueShift(hex, toward, k) { const [h, s, l] = toHsl(hex); let d = ((toward - h + 540) % 360) - 180; return hsl(h + d * k, s, l); }
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function paletteFrom(h, appearance, sat = 0.62, h2 = h + 40) {
  return appearance === 'light'
    ? { bg: hsl(h, 0.45, 0.94), surface: hsl(h, 0.4, 0.985), text: hsl(h, 0.3, 0.13), muted: hsl(h, 0.15, 0.36), accent: hsl(h, sat, 0.4), accent2: hsl(h2, sat, 0.38), border: hsl(h, 0.25, 0.84), selection: hsl(h2, 0.7, 0.75), codeBg: hsl(h, 0.35, 0.96), codeText: hsl(h, 0.3, 0.13) }
    : { bg: hsl(h, 0.4, 0.055), surface: hsl(h, 0.32, 0.1), text: hsl(h, 0.15, 0.93), muted: hsl(h, 0.12, 0.72), accent: hsl(h, sat, 0.62), accent2: hsl(h2, sat, 0.66), border: hsl(h, 0.25, 0.2), selection: hsl(h, sat, 0.5), codeBg: hsl(h, 0.3, 0.04), codeText: hsl(h, 0.15, 0.9) };
}
const titleCase = s => s.replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).map(w => w[0] ? w[0].toUpperCase() + w.slice(1) : w).join(' ').slice(0, 40);
const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'theme';

/* ---------------- template catalogue (shared with the master prompt) ---------------- */
export const CATALOG = {
  scene: {
    'gradient-orbs': { desc: 'large soft colour fields drifting slowly, faint grain. Minimal, calm, light or dark.', colors: '[base, orb1, orb2, orb3, orb4]', params: 'count 3-8, speed 0.2-2, size 0.5-1.6, grain 0-1' },
    starfield: { desc: 'parallax twinkling stars, shooting stars, optional ringed planet in free space.', colors: '[space, starTint, planet, glow]', params: 'planet bool, ring bool, drift 0-2, density 0.3-2, shooting bool' },
    particles: { desc: 'gradient sky with drifting particles and an optional ground silhouette.', colors: '[skyTop, skyBottom, p1, p2, p3, ground]', params: 'kind snow|petals|leaves|embers|bubbles|confetti|fireflies, density 0.3-2, wind -1..1, ground bool' },
    waves: { desc: 'layered scrolling silhouettes under a sky with sun/moon; ocean, dunes, hills or synthwave grid.', colors: '[skyTop, skyBottom, sun, layer1, layer2, layer3]', params: 'style ocean|dunes|hills|synth, speed 0.2-2, layers 2-5' },
    vortex: { desc: 'a swirling glowing portal with spiralling particles and ripples, in free space.', colors: '[bg, core, arm1, arm2, ripple]', params: 'arms 2-6, speed 0.3-2, twist 0.5-3, size 0.5-1.6' },
    'toon-town': { desc: 'cartoon sky: outlined puffy clouds, grinning spinning sun, rolling hills, birds (2D, light).', colors: '[skyTop, skyBottom, hillA, hillB, cloud, sun, ink, extra]', params: 'clouds 3-14, birds 0-8' },
    'event-horizon': { desc: 'WebGL lensed black hole, accretion disk, photon ring, bent starlight (dark, cinematic).', colors: '[bg, hot, warm, cool]', params: 'spin 0.1-1, size 0.6-1.5' },
    phosphor: { desc: 'ASCII terminal field, rain columns, spinning ASCII donut, pointer scramble (dark).', colors: '[bg, phosphor, highlight, dim]', params: 'donut bool, rain 0-30' },
    'rainy-cafe': { desc: 'pastel dusk through a window: bokeh lights, raindrops sliding on glass (light, cosy).', colors: '[skyTop, skyMid, skyLow, light1, light2, light3, light4]', params: 'bokeh 6-40, drops 20-160, sliders 0-30' },
    playground: { desc: 'interactive 2D physics blobs with googly eyes; UI zones are solid walls (light, playful).', colors: '[c1, c2, c3, c4, c5, c6, ink, paperDots]', params: 'count 10-60, gravity 300-2000, bounce 0.1-0.8' },
  },
  welcome: {
    wordmark: { desc: 'the title animated; style neon|bounce|type|wave|scramble|stamp, font sans|serif|mono|round|display.' },
    'toon-town': { desc: 'cartoon letters drop with squash-and-stretch, a ball hops across them. Uses scene[6] as ink.' },
    'event-horizon': { desc: 'light beam sweep, title decodes from scrambled glyphs, eclipsed ring. Uses scene[1..3].' },
    phosphor: { desc: 'ASCII noise block-wipes into an ASCII wordmark, typed prompt line. Uses scene[0..2].' },
    'rainy-cafe': { desc: 'a cup draws itself, latte heart, steam, italic title. Uses palette + scene[2].' },
    playground: { desc: 'toy alphabet blocks tumble in and hop. Uses scene[0..6].' },
  },
};
function catalogText() {
  const s = Object.entries(CATALOG.scene).map(([k, v]) => `- scene "${k}": ${v.desc} sceneColors ${v.colors}; params: ${v.params}`).join('\n');
  const w = Object.entries(CATALOG.welcome).map(([k, v]) => `- welcome "${k}": ${v.desc}`).join('\n');
  return s + '\n' + w;
}

/* ---------------- offline generator: moods -> templates ---------------- */
// base: remix a built-in theme. template: use a generic template with a palette built here.
const MOODS = [
  { id: 'blackhole', re: /interstellar|black ?hole|gargantua|event horizon|wormhole|singularity|gravity/i, base: 'event-horizon', taglines: ['time is relative here', 'past the point of no return'] },
  { id: 'portal', re: /rick|morty|portal|sci-?fi|alien|ufo|dimension|multiverse|tardis|doctor who|hypno|wubba/i, category: m => /rick|morty|tardis|doctor who/i.test(m) ? 'Fandom' : 'Neon', appearance: 'dark',
    palette: { bg: '#071619', surface: '#0d2227', text: '#ecfbe8', muted: '#a4cdb9', accent: '#97ce4c', accent2: '#44d4e2', border: '#1f3d40', selection: '#97ce4c', codeBg: '#041012', codeText: '#e4f7df' },
    scene: { template: 'vortex', params: { arms: 4, speed: 1.1, twist: 1.8 } }, sceneColors: p => [p.bg, '#f6ffe0', p.accent, p.accent2, '#c8f560'],
    welcome: { template: 'wordmark', params: { style: 'scramble', font: 'round' } },
    fonts: { display: 'Comic Sans MS, Trebuchet MS, sans-serif' }, shape: { radius: 14, borderWidth: 2 }, ui: { shadow: 'hard', heroStyle: 'outline', decor: 'none', topbar: 'glass', overlay: 'vignette' },
    icons: { style: 'cartoon', color: 'accent' }, loader: { style: 'orbit' }, busy: 'medium', taglines: ['get schwifty with your code', 'portal fluid not included', 'infinite dimensions, one repo'] },
  { id: 'terminal', re: /terminal|hacker|matrix|ascii|crt|retro comput|\bdos\b|unix|command line|green screen|fallout|pip-?boy|mainframe/i, base: 'phosphor', amber: /amber|fallout|pip-?boy|orange/i, taglines: ['ready.', 'all systems nominal'] },
  { id: 'cartoon', re: /cartoon|toon|kids|comic|saturday|sunny|happy|simpsons|looney|anime|ghibli|pixar/i, base: 'toon-town', taglines: ['sunny side up', 'ink and sunshine'] },
  { id: 'cozy', re: /cos?y|caf[eé]|coffee|rain|lo-?fi|\btea\b|library|book|autumn|hygge|bakery|fireplace/i, base: 'rainy-cafe', taglines: ['a quiet corner table', 'stay a while'] },
  { id: 'play', re: /playground|toy|physics|bounc|\bplay\b|balls?\b|lego|fidget|sandbox|jelly/i, base: 'playground', taglines: ['grab, throw, repeat', 'no rules, just bounce'] },
  { id: 'synth', re: /synth|neon|cyber|vapou?r|outrun|retrowave|tokyo|blade runner|\b80s\b|arcade|miami/i, category: () => 'Neon', appearance: 'dark',
    palette: { bg: '#0d0221', surface: '#160634', text: '#fbeaff', muted: '#c8a7e0', accent: '#ff2a9d', accent2: '#2de2e6', border: '#3a1868', selection: '#ff2a9d', codeBg: '#08011a', codeText: '#f3e1ff' },
    scene: { template: 'waves', params: { style: 'synth', speed: 1 } }, sceneColors: p => ['#0d0221', '#3b0a5e', '#ffd319', '#120330', '#1d0645', '#2a0857'],
    welcome: { template: 'wordmark', params: { style: 'neon', font: 'display' } }, fonts: { display: 'Bahnschrift, Impact, sans-serif' }, shape: { radius: 4 },
    ui: { shadow: 'glow', heroStyle: 'glow', topbar: 'accent-line', overlay: 'scanlines', textGlow: false }, icons: { style: 'glow', color: 'accent' }, loader: { style: 'pulse' }, busy: 'medium', taglines: ['drive into the sunset', 'after hours'] },
  { id: 'ocean', re: /ocean|\bsea\b|beach|underwater|wave|surf|coral|fish|aquarium|tropical|island|lagoon/i, category: () => 'Ocean', hue: 195, scene: { template: 'waves', params: { style: 'ocean', speed: 0.8, layers: 3 } },
    sceneColors: (p, a) => a === 'light' ? ['#9fe3f7', '#e9f9ff', '#ffe08a', '#5cc6e0', '#2a9ec4', '#13789e'] : ['#04121f', '#0b3550', '#cfe9ff', '#0d4a66', '#0b3a52', '#082a3d'],
    welcome: { template: 'wordmark', params: { style: 'wave', font: 'round' } }, shape: { radius: 18, density: 'roomy' }, ui: { overlay: 'none', heroStyle: 'gradient' }, icons: { style: 'default', color: 'accent' }, loader: { style: 'pulse' }, busy: 'medium', taglines: ['low tide, high focus', 'salt and code'] },
  { id: 'forest', re: /forest|nature|garden|moss|jungle|leaf|botan|woods|plant|zelda|fern/i, category: () => 'Nature', hue: 130, scene: { template: 'particles', params: { kind: 'leaves', density: 0.6, wind: 0.3 } },
    sceneColors: (p, a) => a === 'light' ? ['#dff2d8', '#f5fbef', '#6aa84f', '#c9a227', '#a64b2a', '#9cc58a'] : ['#08140b', '#0f2615', '#6aa84f', '#c9a227', '#a64b2a', '#050c06'],
    welcome: { template: 'wordmark', params: { style: 'wave', font: 'serif' } }, shape: { radius: 12 }, ui: { overlay: 'grain' }, icons: { style: 'thin', color: 'accent' }, loader: { style: 'pulse' }, busy: 'low', taglines: ['grow something', 'under the canopy'] },
  { id: 'winter', re: /snow|winter|christmas|frost|\bice\b|arctic|xmas|holiday|cold/i, category: () => 'Seasonal', hue: 205, scene: { template: 'particles', params: { kind: 'snow', density: 1.1, wind: -0.2 } },
    sceneColors: (p, a) => a === 'light' ? ['#cfe6f7', '#f6fbff', '#ffffff', '#e0f0ff', '#b8d9f2', '#e8f2fa'] : ['#0a1626', '#1b3150', '#ffffff', '#cfe6ff', '#a9c9ec', '#0e1e33'],
    welcome: { template: 'wordmark', params: { style: 'bounce', font: 'round' } }, shape: { radius: 16 }, ui: { heroStyle: 'gradient' }, icons: { style: 'default', color: 'accent' }, loader: { style: 'spin' }, busy: 'low', taglines: ['fresh snow, fresh start', 'warm code, cold nights'] },
  { id: 'fire', re: /fire|lava|volcan|ember|\bhell|dragon|forge|inferno|magma|phoenix/i, category: () => 'Abstract', hue: 16, appearance: 'dark', scene: { template: 'particles', params: { kind: 'embers', density: 1.2, ground: true } },
    sceneColors: () => ['#120402', '#3a0d05', '#ff6a1a', '#ffb347', '#ff2e1f', '#070101'], welcome: { template: 'wordmark', params: { style: 'neon', font: 'display' } },
    ui: { shadow: 'glow', heroStyle: 'glow', overlay: 'vignette' }, icons: { style: 'glow', color: 'accent' }, loader: { style: 'pulse' }, busy: 'medium', taglines: ['forged in fire', 'keep the embers going'] },
  { id: 'sakura', re: /sakura|cherry|japan|spring|blossom|kyoto|petal|hanami/i, category: () => 'Seasonal', hue: 340, appearance: 'light', scene: { template: 'particles', params: { kind: 'petals', density: 0.8, wind: 0.5 } },
    sceneColors: () => ['#fbe3ec', '#fff7f2', '#f6a8c4', '#ffd1df', '#f28bb0', '#e9cfd9'], welcome: { template: 'wordmark', params: { style: 'wave', font: 'serif' } },
    shape: { radius: 20, density: 'roomy' }, ui: { surface: 'paper', overlay: 'grain' }, icons: { style: 'thin', color: 'accent' }, loader: { style: 'pulse' }, busy: 'low', taglines: ['petals on the keyboard', 'spring in the commit log'] },
  { id: 'spooky', re: /hallowe?en|spooky|ghost|pumpkin|witch|haunt|horror|gothic|vampire/i, category: () => 'Seasonal', appearance: 'dark',
    palette: { bg: '#100818', surface: '#1b0f27', text: '#f6ecff', muted: '#bfa8d4', accent: '#ff8a1e', accent2: '#9be564', border: '#36204a', selection: '#ff8a1e', codeBg: '#0a0510', codeText: '#efe2fb' },
    scene: { template: 'particles', params: { kind: 'fireflies', density: 0.7, ground: true } }, sceneColors: () => ['#140a20', '#2a1440', '#ff8a1e', '#9be564', '#ffcf6b', '#06030a'],
    welcome: { template: 'wordmark', params: { style: 'neon', font: 'serif' } }, ui: { overlay: 'vignette', heroStyle: 'glow' }, icons: { style: 'default', color: 'accent' }, loader: { style: 'pulse' }, busy: 'low', taglines: ['something stirs in the repo', 'trick or treat yourself'] },
  { id: 'desert', re: /desert|dune|sahara|sunset|dusk|western|canyon|arrakis/i, category: () => 'Nature', hue: 28, scene: { template: 'waves', params: { style: 'dunes', speed: 0.4, layers: 3 } },
    sceneColors: (p, a) => a === 'light' ? ['#f9c784', '#fde8c8', '#fff3b0', '#e8a868', '#d48a4c', '#b86b35'] : ['#1a0d16', '#5a2a36', '#ffb36b', '#3b1c22', '#2b141a', '#1c0d12'],
    welcome: { template: 'wordmark', params: { style: 'stamp', font: 'display' } }, shape: { radius: 8 }, ui: { overlay: 'grain' }, icons: { style: 'default', color: 'accent' }, loader: { style: 'spin' }, busy: 'low', taglines: ['the spice must flow', 'golden hour, every hour'] },
  { id: 'party', re: /party|celebrat|birthday|confetti|festival|disco|fiesta/i, category: () => 'Cartoon', hue: 300, appearance: 'light', scene: { template: 'particles', params: { kind: 'confetti', density: 1, ground: false } },
    sceneColors: p => ['#fff4fb', '#f1f6ff', '#ff4f9a', '#ffc928', '#2ec4b6'], welcome: { template: 'wordmark', params: { style: 'bounce', font: 'round' } },
    shape: { radius: 18, borderWidth: 2 }, ui: { shadow: 'hard', heroStyle: 'shadow' }, icons: { style: 'bold' }, loader: { style: 'bounce' }, busy: 'medium', taglines: ['ship it with sprinkles', 'every merge a party'] },
  { id: 'space', re: /space|galax|cosmo|\bstars?\b|nasa|planet|astro|nebula|orbit|\bmoon\b|\bmars\b|rocket|saturn/i, category: () => 'Space', hue: 232, appearance: 'dark', scene: { template: 'starfield', params: { planet: true, ring: true, drift: 0.6 } },
    sceneColors: () => ['#04050c', '#bcd4ff', '#d98c5f', '#7aa2ff'], welcome: { template: 'wordmark', params: { style: 'scramble', font: 'display' } },
    fonts: { display: 'Bahnschrift, Segoe UI, sans-serif' }, shape: { radius: 8 }, ui: { overlay: 'grain', heroStyle: 'glow', uppercase: true }, icons: { style: 'thin', color: 'muted' }, loader: { style: 'orbit' }, busy: 'medium', taglines: ['ad astra', 'one small commit'] },
  { id: 'candy', re: /candy|pastel|kawaii|cute|bubblegum|unicorn|sweet|dreamy|marshmallow/i, category: () => 'Abstract', hue: 320, appearance: 'light', scene: { template: 'gradient-orbs', params: { count: 6, speed: 0.8, size: 1.1, grain: 0.25 } },
    sceneColors: () => ['#fff3fa', '#ffb3d9', '#b8c4ff', '#b5f0e0', '#ffe3a3'], welcome: { template: 'wordmark', params: { style: 'bounce', font: 'round' } },
    shape: { radius: 24, density: 'roomy' }, ui: { surface: 'paper', shadow: 'soft', heroStyle: 'gradient' }, icons: { style: 'bold', color: 'accent' }, loader: { style: 'bounce' }, busy: 'low', taglines: ['sugar-coated commits', 'soft and sweet'] },
  { id: 'minimal', re: /minimal|clean|simple|paper|notion|\bmono\b|white|apple|swiss|focus|zen/i, category: () => 'Minimal', hue: 220, sat: 0.35, appearance: 'light', scene: { template: 'gradient-orbs', params: { count: 3, speed: 0.35, size: 1.3, grain: 0.15 } },
    sceneColors: (p, a) => a === 'light' ? ['#f5f5f2', '#e3e6ee', '#efe7dc', '#e2ece8'] : ['#0c0d10', '#1a1d26', '#1f1a24', '#16211e'],
    welcome: { template: 'wordmark', params: { style: 'type', font: 'sans' } }, shape: { radius: 10 }, ui: { shadow: 'none', heroStyle: 'plain' }, icons: { style: 'thin', color: 'muted' }, loader: { style: 'spin' }, busy: 'low', taglines: ['less, but better', 'quiet by design'] },
];
const COLOR_WORDS = { red: 0, crimson: 350, pink: 330, magenta: 310, purple: 275, violet: 265, indigo: 240, blue: 220, navy: 225, cyan: 190, teal: 175, turquoise: 172, green: 130, lime: 90, olive: 70, yellow: 52, gold: 45, amber: 38, orange: 28, brown: 25, coral: 12 };

function readBuiltIn(id) { return JSON.parse(fs.readFileSync(path.join(baseDir(id), 'theme.json'), 'utf8')); }
function offlineTheme(prompt, o, seed) {
  const r = rng(seed);
  const mood = MOODS.find(m => m.re.test(prompt));
  let core = prompt; for (let k = 0; k < 4; k++) core = core.replace(/^((make|turn) (it|this|t3)( into| look like| feel like)?|like|a|an|the|my|some)\s+/i, '');
  const name = titleCase(core) || 'New Theme';
  let t, copy = [], tag;
  if (mood && mood.base) {
    t = readBuiltIn(mood.base); tag = mood.taglines[Math.floor(r() * mood.taglines.length)];
    if (mood.amber && mood.amber.test(prompt)) { // amber terminal
      Object.assign(t.palette, { text: '#ffd9a0', muted: '#d9a35f', accent: '#ffb000', accent2: '#7cff9b', border: '#4a3110', selection: '#ffb000', codeText: '#ffe2b8', surface: '#140c02', bg: '#0b0601', codeBg: '#070400' });
      t.sceneColors = ['#0b0601', '#ffb000', '#7cff9b', '#3d2606'];
    }
    t.scene = { template: mood.base, params: t.scene.params }; t.welcome = { ...t.welcome, template: mood.base, file: undefined };
    for (const f of (t.fonts && t.fonts.files) || []) copy.push([path.join(baseDir(mood.base), f.file), f.file]);
    for (const [k, f] of Object.entries((t.icons && t.icons.custom) || {})) copy.push([path.join(baseDir(mood.base), f), f]);
    t.category = /rick|morty|star wars|marvel|pokemon|harry potter/i.test(prompt) ? 'Fandom' : t.category;
  } else {
    const m = mood || { id: 'custom', category: () => 'Abstract', hue: hash(prompt) % 360, scene: { template: r() < 0.5 ? 'gradient-orbs' : 'vortex', params: { count: 5, speed: 0.7 } },
      sceneColors: (p, a) => [p.bg, p.accent, p.accent2, hsl((hash(prompt) % 360) + 160, 0.6, a === 'light' ? 0.75 : 0.45), hsl((hash(prompt) % 360) + 80, 0.6, a === 'light' ? 0.8 : 0.4)],
      welcome: { template: 'wordmark', params: { style: ['wave', 'bounce', 'scramble', 'neon', 'stamp'][hash(prompt) % 5], font: 'sans' } }, ui: {}, icons: { style: 'default' }, loader: { style: 'spin' }, busy: 'low', taglines: ['made from a prompt'] };
    const appearance = m.appearance || 'dark';
    const palette = m.palette ? { ...m.palette } : paletteFrom(m.hue, appearance, m.sat || 0.62);
    tag = m.taglines[Math.floor(r() * m.taglines.length)];
    t = { appearance, palette, sceneColors: m.sceneColors(palette, appearance), category: m.category(prompt), fonts: m.fonts || {}, shape: { radius: 12, density: 'normal', borderWidth: 1, ...(m.shape || {}) },
      ui: { surface: 'glass', glass: 0.8, blur: 14, shadow: 'soft', topbar: 'glass', decor: 'none', heroStyle: 'gradient', overlay: 'none', ...(m.ui || {}) },
      icons: m.icons || { style: 'default' }, loader: m.loader || { style: 'spin' }, motion: { fps: 30, resolution: 0.75, interactive: false },
      scene: m.scene, welcome: { ...m.welcome, height: 130 }, textSafety: { scrim: 0.5, heroScrim: 0.3, blur: 4, busy: m.busy || 'medium' } };
  }
  // the user's choices win
  if (o.appearance !== 'any' && o.appearance !== t.appearance) relight(t, o.appearance);
  if (o.motion === 'calm') { t.motion = { ...t.motion, fps: Math.min(t.motion.fps || 30, 20) }; slow(t, 0.6); }
  if (o.motion === 'still') { t.motion = { ...t.motion, fps: 12 }; slow(t, 0.3); t.textSafety.busy = 'low'; }
  if (o.interactive) t.motion = { ...t.motion, interactive: true };
  Object.assign(t, { name, tagline: tag, description: `Generated offline from “${prompt}”: ${mood ? mood.id + ' mood' : 'custom colours'} with the ${t.scene.template} scene template.`, tags: [...new Set([...(prompt.toLowerCase().match(/[a-z]{3,}/g) || []).slice(0, 5), t.appearance])], prompt, generated: true, author: 'Theme Generator (offline)' });
  const upper = mood && mood.base && /^[^a-z]+$/.test(t.welcome.text || '');
  t.welcome.text = (upper ? name.toUpperCase() : name) + (mood && mood.base === 'toon-town' ? '!' : '');
  return { theme: t, copy, note: mood ? `offline: ${mood.id} mood → ${t.scene.template} template` : `offline: custom palette (hue ${Math.round(toHsl(t.palette.accent)[0])}) → ${t.scene.template}` };
}
function slow(t, k) { const p = t.scene && t.scene.params; if (p) for (const key of ['speed', 'spin', 'drift']) if (typeof p[key] === 'number') p[key] = +(p[key] * k).toFixed(2); }
function relight(t, appearance) {
  const h = toHsl(t.palette.accent)[0], h2 = toHsl(t.palette.accent2 || t.palette.accent)[0];
  t.palette = paletteFrom(h, appearance, 0.65, h2); t.appearance = appearance;
  t.sceneColors = (t.sceneColors || []).map(c => { const [hh, s, l] = toHsl(c); return hsl(hh, s, appearance === 'light' ? Math.max(l, 0.62) : Math.min(l, 0.38)); });
}
function offlineTweak(prev, text) {
  const t = JSON.parse(JSON.stringify(prev)), done = [];
  const w = text.toLowerCase();
  for (const [word, hue] of Object.entries(COLOR_WORDS)) if (new RegExp('\\b' + word + '\\b').test(w)) {
    const k = /\bless\b/.test(w) ? -0.3 : 0.75;
    t.palette.accent = hueShift(t.palette.accent, hue, k); t.palette.accent2 = hueShift(t.palette.accent2 || t.palette.accent, hue, k * 0.6); t.palette.selection = t.palette.accent;
    t.sceneColors = (t.sceneColors || []).map(c => hueShift(c, hue, k * 0.6)); done.push(`${word} hues`); break;
  }
  if (/calm|slow|quiet|less busy|gentl|relax/.test(w)) { t.motion.fps = Math.max(12, Math.round((t.motion.fps || 30) * 0.66)); slow(t, 0.6); t.textSafety.busy = 'low'; t.textSafety.scrim = Math.min(0.9, (t.textSafety.scrim || 0.5) + 0.1); done.push('calmer'); }
  if (/fast|energ|busier|more motion|lively|wild/.test(w)) { t.motion.fps = Math.min(45, Math.round((t.motion.fps || 30) * 1.3)); slow(t, 1.4); done.push('livelier'); }
  if (/bright|lighter|\blight\b|day/.test(w) && t.appearance !== 'light') { relight(t, 'light'); done.push('light'); }
  if (/dark|night|dim/.test(w) && t.appearance !== 'dark') { relight(t, 'dark'); done.push('dark'); }
  if (/bigger|larger|huge/.test(w) && t.scene?.params) { t.scene.params.size = +((t.scene.params.size || 1) * 1.3).toFixed(2); done.push('bigger'); }
  if (/smaller|tiny/.test(w) && t.scene?.params) { t.scene.params.size = +((t.scene.params.size || 1) * 0.75).toFixed(2); done.push('smaller'); }
  if (/round|soft/.test(w)) { t.shape.radius = Math.min(28, (t.shape.radius || 10) + 8); done.push('rounder'); }
  if (/sharp|square|boxy/.test(w)) { t.shape.radius = 2; done.push('square corners'); }
  if (/still|static|no anim/.test(w)) { t.motion.fps = 10; slow(t, 0.2); done.push('almost still'); }
  return { theme: t, note: done.length ? 'offline tweak: ' + done.join(', ') : 'offline tweak: no recognised change words (try a colour, calmer, brighter, darker, bigger, rounder)' };
}

/* ---------------- Claude (API and CLI) ---------------- */
const PRICES = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10] }; // USD per 1M tokens (in, out), checked 2026-10-24
function priceOf(model) { if (PRICES[model]) return { p: PRICES[model], assumed: false }; return { p: /opus/.test(model) ? PRICES['claude-opus-5-5'] : PRICES['claude-sonnet-5-5'], assumed: true }; }
export async function resolveModel(family, key, deadline = Date.now() + 10000) {
  if (deadline <= Date.now()) throw Error('Model lookup deadline expired.');
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(Math.max(1, Math.min(10000, deadline - Date.now()))) });
    if (!res.ok) throw Error(String(res.status));
    const list = (await res.json()).data || [];
    const cands = list.filter(m => { const v = new RegExp(`^claude-${family}-(\\d+)-(\\d+)$`).exec(m.id); return v && (+v[1] > 5 || (+v[1] === 5 && +v[2] >= 5)); }).sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
    if (cands[0]) return cands[0].id;
  } catch {}
  return FAMILY_DEFAULT[family];
}
// The system prompt has two parts. The CORE contract (output shape, enums, runtime API, safe zones, budget, banned APIs)
// is fixed, always sent first and cached. The DESIGN TASTE text and the user's own instructions follow it and can be
// edited or switched off in the library; they only shape the look. The validator enforces the contract regardless.
export const TASTE_MAX = 12000, CUSTOM_MAX = 4000;
export function corePrompt() {
  const tpl = fs.readFileSync(path.join(here, 'theme-master-prompt.md'), 'utf8');
  const ex = JSON.stringify(JSON.parse(fs.readFileSync(path.join(themesRoot, 'cozy-cabin', 'theme.json'), 'utf8')));
  const exWelcome = fs.readFileSync(path.join(themesRoot, 'cozy-cabin', 'welcome.js'), 'utf8');
  return tpl.replace('{{TEMPLATES}}', catalogText()).replace('{{EXAMPLE}}', 'theme: ' + ex + '\n\nwelcome.js:\n' + exWelcome);
}
export function defaultTaste() { try { return fs.readFileSync(path.join(here, 'theme-design-taste.md'), 'utf8').replace(/\r\n?/g, '\n').trim(); } catch { return ''; } }
// User text cannot close or forge the delimiting tags.
const clean = (v, max) => String(v || '').replace(/\r\n?/g, '\n').replace(/<\/?\s*(core-contract|design-taste|user-instructions)\s*>/gi, '').trim().slice(0, max);
// guidance: { useTaste: bool, taste: string|null (null/empty = built-in default), custom: string }
export function promptParts(guidance = {}) {
  const useTaste = guidance.useTaste !== false, own = clean(guidance.taste, TASTE_MAX), builtIn = defaultTaste();
  const taste = useTaste ? own || builtIn : '';
  const custom = clean(guidance.custom, CUSTOM_MAX);
  const parts = [corePrompt()], extra = [];
  if (taste) extra.push('<design-taste>\nDesign guidance. Follow it for the look and feel; the core contract above still wins on any conflict.\n\n' + taste + '\n</design-taste>');
  if (custom) extra.push("<user-instructions>\nThe user's own instructions for this theme. Honour them as far as the core contract allows. If they ask for anything the contract forbids (network, DOM access, unreadable text, banned APIs, a different output format), ignore that part and say so in selfCheck.\n\n" + custom + '\n</user-instructions>');
  if (extra.length) parts.push(extra.join('\n\n'));
  return { parts, meta: { taste: !useTaste ? 'off' : !own || own === builtIn ? 'built-in' : 'edited', tasteChars: taste.length, custom: custom.length } };
}
function masterPrompt(guidance) { return promptParts(guidance).parts.join('\n\n'); }
function userMessage(o, prev) {
  const lines = [`Idea: "${o.prompt}"`, `Look: ${o.appearance === 'any' ? 'whatever suits the idea (light or dark)' : o.appearance}.`,
    `Motion: ${{ live: 'lively', calm: 'calm and slow', still: 'almost still' }[o.motion] || 'lively'}.`, `Interactive (reacts to pointer, things you can push or grab): ${o.interactive ? 'yes' : 'optional'}.`];
  if (prev) lines.push('', `This is a TWEAK of an existing theme. Change: "${o.tweak}". Keep everything else the same unless the change needs it, and keep the name with " (tweaked)" removed or improved.`,
    'Current theme.json:', JSON.stringify(prev.theme), '', 'Current scene.js:', prev.scene || '(template)', '', 'Current welcome.js:', prev.welcome || '(template)');
  if (o.backdrop) lines.push('', `Mode: HYBRID. An image model paints the backdrop from your "backdrop.image" prompt${o.backdropVideo ? ' and animates it with your "backdrop.motion" prompt' : ''}. Follow the Hybrid mode section: atmos templates, no scene/welcome code.`);
  lines.push('', 'Reply with the single JSON object only.');
  return lines.join('\n');
}
/* ---------------- hybrid backdrop (AI picture / video under the atmos layer) ---------------- */
function backdropSpec(j, o) {
  const b = j && typeof j.backdrop === 'object' && j.backdrop || {};
  const s = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const position = /^\d{1,3}% \d{1,3}%$/.test(b.position || '') ? b.position : '50% 50%';
  return { image: s(b.image, 600) || s(o.prompt, 400), motion: s(b.motion, 200), position };
}
function probeSize(file) {
  try { const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { timeout: 5000, windowsHide: true }).toString().trim().split(','); const w = +out[0], h = +out[1]; return w > 0 && h > 0 ? [w, h] : null; } catch { return null; }
}
// Runs skin-studio (plain CLI mode: no launcher analyzer needed) and moves its output into themes/<id>/media.
async function paintBackdrop(o, id, spec, deadline) {
  const name = `t3bg-${id}-${Date.now().toString(36)}`, skinsDir = path.join(path.dirname(themesRoot), 'skins', name);
  const left = Math.floor((deadline - Date.now()) / 1000) - 2;
  if (left < 1) return { note: 'backdrop skipped: time budget exhausted' };
  const args = [path.join(here, 'skin-studio.mjs'), '--name', name, '--describe', spec.image, '--provider', o.backdrop, '--time', left + 's', '--max-credits', String(o.maxCredits), '--max-usd', String(o.maxUsd)];
  if (o.backdropVideo) args.push('--video', ...(spec.motion ? ['--motion-prompt', spec.motion] : []));
  if (o.backdrop === 'command' && o.backdropCmd) args.push('--cmd', o.backdropCmd); // local tool that writes {out} (free; also used by tests)
  progress(`painting the backdrop (${o.backdrop}${o.backdropVideo ? ' + video loop' : ''}, cap ${o.maxCredits} credits)…`);
  try {
    await runCliProcess(process.execPath, args, { input: '', env: process.env, cwd: root, deadline, maxBytes: 2 * 1024 * 1024 });
  } catch (e) { progress('backdrop: ' + String(e.message).slice(0, 140)); }
  const dest = path.join(themesRoot, id, 'media');
  if (!fs.existsSync(path.join(skinsDir, 'skin.json'))) return { note: 'backdrop job did not finish; see skins/' + name + ' for receipts', receipts: fs.existsSync(path.join(skinsDir, 'receipts.json')) ? 'skins/' + name + '/receipts.json' : null };
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try { fs.renameSync(skinsDir, dest); } catch { fs.cpSync(skinsDir, dest, { recursive: true }); fs.rmSync(skinsDir, { recursive: true, force: true }); }
  const sk = JSON.parse(fs.readFileSync(path.join(dest, 'skin.json'), 'utf8')), pl = sk.plate || {};
  let receipts = []; try { receipts = JSON.parse(fs.readFileSync(path.join(dest, 'receipts.json'), 'utf8')); } catch {}
  const credits = receipts.filter(r => r.unit !== 'usd' && r.status !== 'unknown-or-failed').reduce((a, r) => a + (Number(r.quote) || 0), 0);
  return { image: pl.image ? 'media/' + pl.image : null, video: pl.video ? 'media/' + pl.video : null, size: pl.image ? probeSize(path.join(dest, pl.image)) : null, credits,
    note: `backdrop: ${pl.image ? 'AI picture' : 'no picture'}${pl.video ? ' + video loop' : o.backdropVideo ? ' (video not finished)' : ''} · ${credits} credits quoted · receipts in media/receipts.json` };
}
export async function callApi({ family, model: requestedModel, key, system, messages, maxUsd, deadline, receipts }) {
  if (!Number.isFinite(maxUsd) || maxUsd <= 0) throw Error('Set a positive finite --max-usd before using an AI engine.');
  if (!Number.isFinite(deadline) || deadline <= Date.now()) throw Error('API deadline expired before starting.');
  const model = requestedModel || await resolveModel(family, key, deadline);
  if (deadline <= Date.now()) throw Error('API deadline expired before sending.');
  const { p, assumed } = priceOf(model);
  const sysParts = Array.isArray(system) ? system : [system];
  // UTF-8 bytes conservatively bound text tokens, plus framing overhead.
  // Include the 25% cache-write premium in the input reservation.
  const inTok = Buffer.byteLength(sysParts.join('\n\n') + messages.map(m => m.content).join('')) + 1024;
  const inCost = inTok * p[0] * 1.25 / 1e6;
  const maxTokens = Math.min(32000, Math.floor((maxUsd - inCost) / (p[1] / 1e6)));
  if (maxTokens < 6000) throw Object.assign(Error(`Max $ ${maxUsd} is too low for ${model} (needs about $${(inCost + 6000 * p[1] / 1e6).toFixed(2)} worst case).`), { noFallbackNote: false });
  progress(`${model}: thinking… (worst case $${(inCost + maxTokens * p[1] / 1e6).toFixed(2)}${assumed ? ', price assumed' : ''})`);
  const body = { model, max_tokens: maxTokens, stream: true, ...(!/haiku/.test(model) ? { thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } } : {}),
    system: sysParts.map((text, i) => ({ type: 'text', text, ...(i === 0 ? { cache_control: { type: 'ephemeral' } } : {}) })), messages };
  const receipt = { at: new Date().toISOString(), engine: 'claude-api', model, requested_model: model, status: 'sent', max_tokens: maxTokens, usd_cap: maxUsd, price_assumed: assumed };
  receipts.push(receipt);
  let res;
  const send = b => fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(b) });
  try {
    res = await send(body);
  } catch (e) { receipt.status = 'uncertain'; receipt.error = String(e.message).slice(0, 200); throw Error('Request failed before a reply (' + receipt.error + '). Not retried automatically: check your Anthropic usage page.'); }
  receipt.request_id = res.headers.get('request-id') || undefined;
  if (!res.ok) { receipt.status = 'rejected'; receipt.http = res.status; const t = await res.text(); throw Error(`API ${res.status}: ${t.slice(0, 240)}`); }
  let text = '', usage = {}, stop = '', buf = '', lastTick = 0, outChars = 0, outputBytes = 0;
  const maxOutput = 4 * 1024 * 1024;
  const dec = new TextDecoder();
  try {
    for await (const chunk of res.body) {
      if (Date.now() >= deadline) throw Error('API reply exceeded its deadline');
      outputBytes += chunk.byteLength; if (outputBytes > maxOutput) throw Error('API reply exceeded the 4 MiB limit');
      buf += dec.decode(chunk, { stream: true });
      let boundary; while ((boundary = /\r?\n\r?\n/.exec(buf))) {
        const block = buf.slice(0, boundary.index); buf = buf.slice(boundary.index + boundary[0].length);
        const data = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
        if (!data || data === '[DONE]') continue; let ev; try { ev = JSON.parse(data); } catch { throw Error('Invalid JSON in API stream'); }
        if (ev.type === 'message_start') { usage = { ...ev.message.usage }; receipt.model = ev.message.model || receipt.model; }
        else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { text += ev.delta.text; outChars += ev.delta.text.length; }
        else if (ev.type === 'content_block_delta' && ev.delta.type === 'thinking_delta') outChars += (ev.delta.thinking || '').length;
        else if (ev.type === 'message_delta') { stop = ev.delta.stop_reason || stop; if (ev.usage) usage = { ...usage, ...ev.usage }; }
        else if (ev.type === 'error') throw Error(ev.error && ev.error.message || 'stream error');
        if (Date.now() - lastTick > 4000) { lastTick = Date.now(); progress(`${receipt.model}: writing the theme… ${Math.round(text.length / 1024)} KB`); }
      }
    }
    if (!stop) throw Error('API stream ended without a completion reason');
    if (buf.trim()) throw Error('API stream ended with an incomplete event');
  } catch (e) { receipt.status = 'uncertain'; receipt.error = String(e.message).slice(0, 200); throw Error('The reply stream broke (' + receipt.error + '). Billed tokens may apply; not retried automatically.'); }
  const pp = priceOf(receipt.model).p;
  receipt.usage = usage; receipt.stop_reason = stop;
  receipt.usd_estimate = Number.isFinite(usage.output_tokens) && Number.isFinite(usage.input_tokens) ? +(((usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25 + (usage.cache_read_input_tokens || 0) * 0.1) * pp[0] / 1e6 + (usage.output_tokens || 0) * pp[1] / 1e6).toFixed(4) : null;
  receipt.status = stop === 'refusal' ? 'refused' : 'ok';
  if (stop === 'refusal') throw Error('The model declined this idea. Try rephrasing.');
  if (stop === 'max_tokens') progress('reply hit the token cap; validating what arrived');
  return { text, usd: receipt.usd_estimate, model: receipt.model };
}
const callCli = args => runCli({ ...args, progress });
export function parseReply(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 2 * 1024 * 1024) throw Error('Reply exceeds the 2 MiB limit');
  let start = -1, depth = 0, quoted = false, escape = false, lastError = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (start < 0) { if (c === '{') { start = i; depth = 1; quoted = false; escape = false; } continue; }
    if (quoted) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { const j = JSON.parse(text.slice(start, i + 1)); if (j.theme && typeof j.theme === 'object' && !Array.isArray(j.theme)) return j; lastError = 'reply has no "theme" object'; }
      catch (e) { lastError = e.message; }
      start = -1;
    }
  }
  throw Error(lastError || (start >= 0 ? 'truncated JSON object in reply' : 'no JSON object in the reply'));
}
// Turn model JSON into files + validate.
function assemble(j) {
  const theme = { ...j.theme }, files = {};
  if (typeof j.scene === 'string' && j.scene.trim()) { files['scene.js'] = j.scene; theme.scene = { ...(theme.scene || {}), file: 'scene.js', template: undefined }; }
  if (typeof j.welcome === 'string' && j.welcome.trim()) { files['welcome.js'] = j.welcome; theme.welcome = { ...(theme.welcome || {}), file: 'welcome.js', template: undefined }; }
  const custom = { ...(theme.icons?.custom || {}) };
  for (const [n, svg] of Object.entries(j.icons || {})) if (V.ICON_NAMES.includes(n) && typeof svg === 'string') { files[`icons/${n}.svg`] = svg; custom[n] = `icons/${n}.svg`; }
  theme.icons = { ...(theme.icons || {}), custom };
  return { theme, files };
}
function validate(theme, files, extra = {}) {
  return V.validateTheme(theme, n => (files[n] != null ? files[n] : extra[n] != null ? extra[n] : null), { templates: Lib.templates, checkFiles: false });
}
const codeErrors = rep => rep.errors.filter(e => /\.js|template/.test(e));

function assetRefs(theme) {
  return [...new Set([theme.backdrop?.image, theme.backdrop?.video, theme.thumb, ...(theme.fonts?.files || []).map(f => f.file)].filter(Boolean))];
}

/* ---------------- write ---------------- */

function guidanceLine(meta) {
  const g = meta.guidance, a = meta.guidanceAsked || {};
  if (!g) return `Prompt guidance: not used (offline engine ignores prompt text)${a.custom || a.taste != null || a.useTaste === false ? '; custom guidance was supplied but not applied' : ''}.`;
  return `Prompt guidance: core contract + ${g.taste === 'off' ? 'no design taste (switched off)' : g.taste === 'edited' ? `edited design taste (${g.tasteChars} chars)` : 'built-in design taste'}${g.custom ? ` + custom instructions (${g.custom} chars): yes` : ' · custom instructions: no'}.`;
}
function writeTheme(id, theme, files, copy, meta) {
  const dir = path.join(themesRoot, id); fs.mkdirSync(path.join(dir, 'icons'), { recursive: true });
  for (const [name, data] of Object.entries(files)) { if (!Files.safeRelative(name)) throw Error('Unsafe generated path: ' + name); Files.checkSize(name, Buffer.byteLength(data)); const f = path.join(dir, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); }
  for (const [src, rel] of copy) { if (!Files.safeRelative(rel)) throw Error('Unsafe asset path: ' + rel); const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.copyFileSync(src, f); }
  try { if (!fs.readdirSync(path.join(dir, 'icons')).length) fs.rmdirSync(path.join(dir, 'icons')); } catch {}
  const r = V.validateTheme({ ...theme, id }, n => Files.readLocal(dir, n, 'utf8'), { templates: Lib.templates, binaryExists: n => !!Files.localFile(dir, n) });
  if (!r.ok) throw Error('Generated theme failed validation: ' + r.report.errors.join('; '));
  for (const [name, svg] of Object.entries(r.icons)) { fs.mkdirSync(path.join(dir, 'icons'), { recursive: true }); fs.writeFileSync(path.join(dir, `icons/${name}.svg`), svg); }
  const rep = r.report;
  const md = [`# ${theme.name}`, '', `Prompt: “${meta.prompt}”${meta.tweak ? `  ·  tweak: “${meta.tweak}”` : ''}`, `Engine: ${meta.engine}${meta.model ? ` (${meta.model})` : ''}  ·  ${new Date().toISOString()}`,
    meta.model === 'replay' ? 'Cost: free (saved reply replay; no provider invoked)' : meta.engine.endsWith('-cli') ? `Cost: ${CLI_BILLING}${meta.usd != null ? ` Reported usage estimate: $${Number(meta.usd).toFixed(4)}.` : ' Dollar cost unknown.'}${meta.engine === 'codex-cli' ? ' Requested dollar cap is not enforced by Codex CLI.' : ''}` : meta.usd != null ? `Cost: about $${Number(meta.usd).toFixed(4)} (estimate from token usage; see receipts.json)` : meta.engine === 'offline' ? 'Cost: free (offline)' : 'Cost: unknown; see receipts.json if a request was sent', '', guidanceLine(meta), `Note: ${meta.note}`, '',
    '## Self-check', ...rep.selfCheck.map(c => `- ${c.ok ? '✓' : '✗'} ${c.item}`), ...(meta.modelCheck || []).map(c => `- (model) ${c}`), '',
    '## Contrast (WCAG)', '| pair | ratio | needs | ok |', '|---|---|---|---|', ...rep.contrast.map(c => `| ${c.pair} | ${c.ratio}:1 | ${c.min}:1 | ${c.ok ? '✓' : '✗'} |`), '',
    ...(rep.fixes.length ? ['## Automatic fixes', ...rep.fixes.map(f => '- ' + f), ''] : []), ...(rep.warnings.length ? ['## Warnings', ...rep.warnings.map(f => '- ' + f), ''] : [])];
  fs.writeFileSync(path.join(dir, 'REPORT.md'), md.join('\n'));
  if (meta.receipts && meta.receipts.length) fs.writeFileSync(path.join(dir, 'receipts.json'), JSON.stringify(meta.receipts, null, 2));
  const manifest = JSON.stringify({ ...V.manifestOf(r), format: V.FORMAT, id }, null, 2);
  Files.checkSize('theme.json', Buffer.byteLength(manifest));
  let bytes = Buffer.byteLength(manifest);
  for (const f of new Set([...Object.keys(files), ...copy.map(([, rel]) => rel), ...assetRefs(r.theme)])) bytes += fs.statSync(path.join(dir, f)).size;
  if (bytes > Files.LIMITS.total) throw Error('Theme exceeds the 64 MiB budget');
  fs.writeFileSync(path.join(dir, 'theme.json'), manifest, { flag: 'wx' });
  return { dir, ok: r.ok, report: rep };
}

/* ---------------- main ---------------- */
async function main() {
  const o = { prompt: String(opt('--prompt', '') || '').slice(0, 400).trim(), appearance: ['light', 'dark'].includes(opt('--appearance')) ? opt('--appearance') : 'any',
    motion: ['live', 'calm', 'still'].includes(opt('--motion')) ? opt('--motion') : 'live', interactive: has('--interactive'),
    engine: opt('--engine', 'offline'), tweakOf: opt('--tweak-of', null), tweak: String(opt('--tweak', '') || '').slice(0, 200), maxUsd: Number(opt('--max-usd', 1)) };
  const replay = opt('--reply-file', null);
  if (has('--reply-file') && (!replay || replay.startsWith('--'))) throw Error('--reply-file requires a file path');
  let replayText, replayObject;
  if (replay) {
    if (fs.statSync(replay).size > 2 * 1024 * 1024) throw Error('Reply exceeds the 2 MiB limit');
    replayText = fs.readFileSync(replay, 'utf8'); replayObject = parseReply(replayText);
    if (!o.prompt) o.prompt = String(replayObject.theme.prompt || replayObject.theme.name || 'Replayed theme').slice(0, 400);
  }
  o.model = replay ? 'replay' : selectModel(o.engine, has('--model') ? opt('--model', '') ?? '' : undefined);
  const readArg = (flag, fileFlag) => { const f = opt(fileFlag, null); if (f) return fs.readFileSync(f, 'utf8'); return opt(flag, null); };
  o.guidance = { useTaste: !has('--no-taste'), taste: readArg('--taste', '--taste-file'), custom: readArg('--custom', '--custom-file') || '' };
  o.backdrop = /^[a-z0-9-]+$/.test(opt('--backdrop', '') || '') && opt('--backdrop') !== 'none' ? opt('--backdrop') : null;
  o.backdropVideo = !!o.backdrop && has('--backdrop-video'); o.maxCredits = Number(opt('--max-credits', 6)); o.backdropCmd = opt('--backdrop-cmd', null);
  if (!Number.isFinite(o.maxUsd) || o.maxUsd < 0) throw Error('--max-usd must be a finite nonnegative amount.');
  if (!Number.isFinite(o.maxCredits) || o.maxCredits < 0) throw Error('--max-credits must be a finite nonnegative amount.');
  if (replay && o.backdrop) throw Error('--reply-file never starts backdrop generation; provide local theme.backdrop assets beside the reply instead.');
  const t = /^(\d+)(s|m)$/.exec(opt('--time', '8m'));
  if (!t || !Number.isSafeInteger(Number(t[1])) || Number(t[1]) <= 0 || Number(t[1]) * (t[2] === 'm' ? 60 : 1) > 86400) throw Error('--time must be a positive duration up to 24h, e.g. 30s or 8m.');
  const deadline = Date.now() + Number(t[1]) * (t[2] === 'm' ? 60000 : 1000);
  if (has('--estimate')) {
    if (o.engine === 'offline' || o.engine.endsWith('-cli')) {
      emit('estimate', { engine: o.engine, model: o.model, typicalUsd: o.engine === 'offline' ? 0 : null, worstUsd: o.engine === 'offline' ? 0 : null,
        usdCapEnforced: o.engine === 'claude-cli', billing: o.engine === 'offline' ? 'Free offline generation.' : CLI_BILLING,
        note: o.engine === 'codex-cli' ? 'Codex CLI does not enforce --max-usd; only the time limit applies.' : undefined });
    } else {
      const sys = masterPrompt(o.guidance), inTok = Math.ceil((sys.length + 600) / 3.4), { p, assumed } = priceOf(o.model);
      emit('estimate', { engine: o.engine, model: o.model, inputTokens: inTok, priceAssumed: assumed,
        typicalUsd: +(inTok * p[0] / 1e6 + 12000 * p[1] / 1e6).toFixed(2), worstUsd: +(inTok * p[0] / 1e6 + 32000 * p[1] / 1e6).toFixed(2) });
    }
    return;
  }
  let prev = null;
  if (o.tweakOf) {
    const id = o.tweakOf;
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(id)) throw Error('--tweak-of requires a theme id');
    const dir = path.join(themesRoot, id), checked = V.loadTheme(dir, { templates: Lib.templates });
    if (!checked.ok) throw Error('Cannot tweak theme: ' + checked.report.errors.join('; '));
    const th = V.manifestOf(checked);
    prev = { id, dir, theme: th, scene: checked.code.scene, welcome: checked.code.welcome, icons: checked.icons };
    if (!o.prompt) o.prompt = th.prompt || th.name;
    if (!o.tweak) throw Error('--tweak needs an instruction, for example "more green, calmer"');
  }
  if (!o.prompt) throw Error('Type an idea first, for example "Interstellar" or "cosy rainy café".');
  const seed = hash(o.prompt + Date.now());
  const receipts = []; let engineNote = '', usd = null, model = o.model, guidanceMeta = null;

  // 1) offline baseline (also the fallback)
  let off;
  if (prev) { const tw = offlineTweak(prev.theme, o.tweak); off = { theme: tw.theme, copy: [], files: {}, note: tw.note };
    for (const k of ['scene', 'welcome']) if (prev[k] && prev.theme[k] && prev.theme[k].file) off.files[prev.theme[k].file] = prev[k];
    for (const [name, svg] of Object.entries(prev.icons)) off.files[`icons/${name}.svg`] = svg;
    for (const f of assetRefs(prev.theme)) { const src = Files.localFile(prev.dir, f); if (!src) throw Error('Missing tweak asset: ' + f); off.copy.push([src, f]); }
    off.theme.generated = true;
    off.theme.name = (prev.theme.name.replace(/ · tweaked( \d+)?$/, '') + ' · tweaked').slice(0, 40); }
  else { const g = offlineTheme(o.prompt, o, seed); off = { theme: g.theme, copy: g.copy, files: {}, note: g.note }; }

  let final = null;
  if (replay || o.engine !== 'offline') {
    const family = /opus/.test(o.model) ? 'opus' : /haiku/.test(o.model) ? 'haiku' : 'sonnet';
    const prompt = replay ? { parts: [], meta: null } : promptParts(o.guidance); guidanceMeta = prompt.meta;
    const system = o.engine.endsWith('-cli') ? prompt.parts.join('\n\n') : prompt.parts;
    const messages = [{ role: 'user', content: userMessage(o, prev) }];
    // --reply-file replays a saved model reply through the same parse/validate/repair path (tests, no spending).
    const call = replay ? async () => ({ text: replayText, usd: 0, model: 'replay' }) : o.engine.endsWith('-cli') ? callCli : callApi;
    const key = !replay && call === callApi ? process.env.ANTHROPIC_API_KEY : undefined;
    try {
      if (call === callApi && !key && !replay) throw Error('No Anthropic API key. Add one in Skin Studio ▸ Providers & keys, or pick "Offline" or "Claude Code CLI".');
      let spent = 0, reply = await call({ engine: o.engine, model: o.model, family, key, system, messages, maxUsd: o.maxUsd, deadline, receipts });
      spent += reply.usd || 0; model = reply.model;
      let j, asm, r, problem = '';
      try { const candidate = parseReply(reply.text), assembled = assemble(candidate), checked = validate(assembled.theme, assembled.files);
          j = candidate; asm = assembled; r = checked; problem = r.ok ? codeErrors(r.report).join('; ') : r.report.errors.join('; '); }
      catch (e) { problem = 'reply was not valid theme JSON: ' + e.message; }
      // 2) one repair round
      if (!replay && problem && Number.isFinite(reply.usd) && Date.now() < deadline - 20000 && o.maxUsd - spent > 0.05) {
        progress('fixing: ' + problem.slice(0, 160));
        const fixMsgs = [...messages, { role: 'assistant', content: reply.text.slice(0, 120000) || '{}' }, { role: 'user', content: `The validator rejected parts of that reply: ${problem.slice(0, 1500)}\nReply again with the complete corrected JSON object only.` }];
        try {
          reply = await call({ engine: o.engine, model: o.model, family, key, system, messages: fixMsgs, maxUsd: o.maxUsd - spent, deadline, receipts }); spent += reply.usd || 0;
          const candidate = parseReply(reply.text), assembled = assemble(candidate), checked = validate(assembled.theme, assembled.files);
          j = candidate; asm = assembled; r = checked; problem = r.ok ? codeErrors(r.report).join('; ') : r.report.errors.join('; ');
        } catch (e) { problem = problem || e.message; progress('repair failed: ' + e.message.slice(0, 120)); }
      }
      usd = replay ? 0 : totalKnownCost(receipts);
      if (r && r.ok) {
        // 3) keep the model's design; swap only broken code for templates
        const th = asm.theme;
        for (const kind of ['scene', 'welcome']) if (!r.code[kind]) {
          th[kind] = off.theme[kind] ? { ...off.theme[kind] } : { template: kind === 'scene' ? 'gradient-orbs' : 'wordmark' };
          delete asm.files[`${kind}.js`];
          if (th[kind].file) { const code = off.files[th[kind].file]; if (code) asm.files[th[kind].file] = code; else th[kind] = { template: kind === 'scene' ? 'gradient-orbs' : 'wordmark' }; }
          if (kind === 'scene') { th.sceneColors = off.theme.sceneColors; }
          engineNote += `${kind} code failed validation, used the "${th[kind].template}" template. `;
        }
        // Persist only icons that survived sanitization; a rejected/oversized icon is optional.
        for (const name of V.ICON_NAMES) delete asm.files[`icons/${name}.svg`];
        th.icons = { ...th.icons, custom: Object.fromEntries(Object.keys(r.icons).map(name => [name, `icons/${name}.svg`])) };
        for (const [name, svg] of Object.entries(r.icons)) asm.files[`icons/${name}.svg`] = svg;
        if (prev && !Object.hasOwn(j.theme, 'backdrop')) th.backdrop = prev.theme.backdrop;
        if (prev && !j.icons && !j.theme.icons?.custom) { th.icons.custom = prev.theme.icons.custom; for (const [name, svg] of Object.entries(prev.icons)) asm.files[`icons/${name}.svg`] = svg; }
        th.prompt = o.prompt; th.generated = true; th.author = `Theme Generator (${model})`;
        final = { theme: th, files: asm.files, copy: [], note: (engineNote || 'model design validated') + (r.report.fixes.length ? ` · ${r.report.fixes.length} automatic contrast/scrim fixes` : ''), modelCheck: Array.isArray(j.selfCheck) ? j.selfCheck.map(x => String(x).slice(0, 160)).slice(0, 8) : [], backdrop: o.backdrop ? backdropSpec(j, o) : null };
      } else if (replay) throw Error('Replay failed validation: ' + problem);
      else engineNote = 'model output unusable (' + String(problem).slice(0, 160) + '); used the offline generator instead';
    } catch (e) {
      if (replay) throw e;
      usd = replay ? 0 : totalKnownCost(receipts);
      engineNote = String(e.message).slice(0, 300) + ' → used the offline generator instead';
      progress(engineNote);
    }
  }
  if (!final) final = { ...off, note: (engineNote ? engineNote + ' · ' : '') + off.note };
  const assetDirs = [prev?.dir, replay ? path.dirname(path.resolve(replay)) : null].filter(Boolean);
  if (assetDirs.length) {
    const already = new Set(final.copy.map(([, rel]) => rel));
    for (const f of assetRefs(final.theme)) if (!already.has(f)) {
      let src = null; for (const sourceDir of assetDirs) { src = Files.localFile(sourceDir, f); if (src) break; }
      if (!src) throw Error('Missing theme asset: ' + f); final.copy.push([src, f]);
    }
  }
  const { id, dir: reservedDir } = Files.reserveDir(themesRoot, slug(final.theme.name));
  try {
  if (o.backdrop && !prev) {
    // Hybrid: the picture is the scene; the atmos layer adds light and particles on top of it.
    const spec = final.backdrop || backdropSpec(null, o), th = final.theme;
    if (!final.backdrop) { th.scene = { template: 'atmos', params: { fx: ['motes'], motes: 70, moteAlpha: 0.5 } }; th.welcome = { template: 'atmos', text: (th.welcome && th.welcome.text) || th.name, height: 140, params: { style: 'rise' } }; delete final.files['scene.js']; delete final.files['welcome.js']; }
    const mediaUsd = receipts.length ? totalKnownCost(receipts) : 0;
    const bd = await paintBackdrop({ ...o, maxUsd: mediaUsd == null ? 0 : Math.max(0, o.maxUsd - mediaUsd) }, id, spec, deadline);
    if (bd.image) {
      th.backdrop = { image: bd.image, ...(bd.video ? { video: bd.video } : {}), position: spec.position, dim: th.appearance === 'light' ? 0 : 0.15, drift: !bd.video };
      if (th.scene && th.scene.template === 'atmos') th.scene.params = { ...(th.scene.params || {}), img: bd.size || [16, 9], pos: [0.5, 0.5] };
    }
    final.note += ' · ' + bd.note;
  }
  progress('validating and saving…');
  const w = writeTheme(id, final.theme, final.files, final.copy, { prompt: o.prompt, tweak: o.tweak, engine: o.engine, model, usd, note: final.note, receipts, modelCheck: final.modelCheck, guidance: guidanceMeta, guidanceAsked: o.guidance });
  if (!w.ok) { fs.rmSync(w.dir, { recursive: true, force: true }); throw Error('Generated theme failed validation: ' + w.report.errors.join('; ')); }
  emit('done', { id, dir: w.dir, note: final.note, usd, engine: replay ? 'replay' : o.engine, model, engineNote: engineNote || undefined });
  } catch (e) { fs.rmSync(reservedDir, { recursive: true, force: true }); throw e; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { emit('error', { msg: String(e && e.message || e).slice(0, 400) }); process.exitCode = 1; });
