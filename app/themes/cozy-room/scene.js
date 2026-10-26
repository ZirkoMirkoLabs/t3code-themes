/* Cozy Room: a lofi night room behind T3, and a black cat that lives in it.
 * Built from t3code-skins/experiments/cozy-room (room.js + cat.js) by build_theme.py. Edit those, then rebuild.
 * The same file runs twice: api.layer 'scene' draws the room behind the app; 'companion' draws the cat above it
 * (click-through) so it can walk onto the composer and paw the send button (api.signal('paw')).
 * sceneColors: [wall, sky, city glow, lamp, moon] (used for the contrast checks).
 * params: companion (true), catEnergy 0..1, rain 0..1, rays 0..1, lights (bool). */
T3Scene(function (api) {
  'use strict';
function Room(C, api, geoOnly) {
const x = geoOnly ? null : api.canvas.getContext('2d');
const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
let seed = 1; const sr = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const WARM = [255, 190, 120], MOON = [170, 182, 255];
let W = 0, H = 0, DPR = 1, sc = 1, g = null, st = null, rc = null, rcx = null, T = 0;
let neonCol = hexRgb(C.st.accent), neonFrom = neonCol, neonTo = neonCol, neonMix = 1;
let neonOn = 1, neonSeq = null, nextFlicker = 9;
let lampK = C.st.lamp, lampTarget = lampK, lampSeq = null;
let beatK = 0, chase = 0, surge = 0, recAng = 0;
let stars = [], twin = [], drops = [], beads = [], slides = [], motes = [];
const rr = (c, x0, y0, w, h, r) => { c.beginPath(); c.moveTo(x0 + r, y0); c.arcTo(x0 + w, y0, x0 + w, y0 + h, r); c.arcTo(x0 + w, y0 + h, x0, y0 + h, r); c.arcTo(x0, y0 + h, x0, y0, r); c.arcTo(x0, y0, x0 + w, y0, r); c.closePath(); };
const glow = (c, px, py, r, col, a) => { const gr = c.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); c.fillStyle = gr; c.fillRect(px - r, py - r, r * 2, r * 2); };
/* ---------- layout ---------- */
function geo() {
const L = C.L, G = {};
W = C.L.W; H = C.L.H; sc = clamp(H / 900, .8, 1.25);
G.lm = { x0: L.side.right + 8, x1: L.lane.left - 10 }; G.lm.w = G.lm.x1 - G.lm.x0;
G.rm = { x0: L.lane.right + 10, x1: W - 8 }; G.rm.w = G.rm.x1 - G.rm.x0;
const ww = clamp(G.rm.w + 190 * sc, 300, 600), wx1 = W - Math.max(44 * sc, G.rm.w * .13);
G.win = { x0: wx1 - ww, x1: wx1, y0: Math.max(L.top.bottom + 50 * sc, H * .11), y1: Math.round(H * .585) };
G.deskY = Math.round(L.comp.top + L.comp.height * .32);
G.shelf = { x0: G.lm.x0 + 22 * sc, x1: G.lm.x1 - 14 * sc, y: Math.round(H * .6) };
G.neon = { x: (G.lm.x0 + G.lm.x1) / 2 - 8 * sc, y: H * .44 };
G.plant = { x: G.lm.x0 + 46 * sc, y: H * .2 };
G.lamp = { x: W - 58 * sc, y: G.deskY };
G.rec = { x0: G.rm.x0 + 14 * sc, w: clamp(G.rm.w * .42, 90, 140) };
G.mug = { x: G.lm.x1 - 46 * sc, y: G.deskY };
G.lights = { x0: L.side.right + 24, x1: W - 24, y: L.top.bottom + 18 * sc, sag: 26 * sc };
return G;
}
function resize() {
if (!C.L.comp) return;
DPR = api.dpr || 1;
g = geo();
st = geoOnly ? new OffscreenCanvas(1, 1) : new OffscreenCanvas(Math.max(2, Math.round(W * DPR)), Math.max(2, Math.round(H * DPR)));
const c = st.getContext('2d'); c.scale(DPR, DPR);
seed = 11;
wall(c); windowStatic(c); shelfStatic(c); planterStatic(c); deskStatic(c); lampStatic(c); recordStatic(c); mugStatic(c); if (!geoOnly) grain(c);
if (!geoOnly) { rc = new OffscreenCanvas(Math.ceil(W / 4), Math.ceil(H / 4)); rcx = rc.getContext('2d'); initParticles(); }
C.geo = g; C.emit('geo', g);
}
/* ---------- static layer ---------- */
function wall(c) {
let gr = c.createLinearGradient(0, 0, 0, H);
gr.addColorStop(0, '#1b1532'); gr.addColorStop(.6, '#161029'); gr.addColorStop(1, '#100c1d');
c.fillStyle = gr; c.fillRect(0, 0, W, H);
c.fillStyle = 'rgba(200,184,255,.022)';
for (let x0 = 0; x0 < W; x0 += 26 * sc) c.fillRect(x0, 0, 1, g.deskY);
c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, g.win.y0 - 34 * sc, W, 3);
c.fillStyle = 'rgba(255,220,200,.04)'; c.fillRect(0, g.win.y0 - 35 * sc, W, 1);
}
function city(c, x0, x1, base, hmin, hmax, col, lit, store, details) {
let xx = x0 - 10;
while (xx < x1 + 10) {
const w = (14 + sr() * 34) * sc, h = hmin + sr() * (hmax - hmin);
c.fillStyle = col; c.fillRect(xx, base - h, w, h);
if (details && sr() < .35) c.fillRect(xx + w * .3, base - h - 6 * sc, w * .28, 6 * sc);
if (details && sr() < .2) {
const tx = xx + w * .62, ty = base - h;
c.fillRect(tx - 4.5 * sc, ty - 15 * sc, 9 * sc, 9 * sc);
c.fillRect(tx - 4 * sc, ty - 6 * sc, 1.2 * sc, 6 * sc); c.fillRect(tx + 3 * sc, ty - 6 * sc, 1.2 * sc, 6 * sc);
c.beginPath(); c.moveTo(tx - 5.5 * sc, ty - 15 * sc); c.lineTo(tx, ty - 19 * sc); c.lineTo(tx + 5.5 * sc, ty - 15 * sc); c.fill();
}
for (let wy = base - h + 6 * sc; wy < base - 4; wy += 7 * sc)
for (let wx = xx + 3 * sc; wx < xx + w - 4 * sc; wx += 5.5 * sc) {
const p = sr();
if (p < lit) { c.fillStyle = sr() < .22 ? 'rgba(160,205,255,.5)' : 'rgba(255,204,140,.62)'; c.fillRect(wx, wy, 2 * sc, 3 * sc); }
else if (store && p > .975) store.push({ x: wx, y: wy, on: sr() < .5, next: sr() * 10 });
}
xx += w + (sr() < .3 ? sr() * 6 * sc : 0);
}
}
function windowStatic(c) {
const w = g.win, f = 13 * sc;
const gx0 = w.x0 + f, gy0 = w.y0 + f, gx1 = w.x1 - f, gy1 = w.y1 - f, gw = gx1 - gx0, gh = gy1 - gy0;
g.glass = { x0: gx0, y0: gy0, x1: gx1, y1: gy1 };
c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 40; c.shadowOffsetY = 14;
c.fillStyle = '#1e131b'; c.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0); c.restore();
c.save(); c.beginPath(); c.rect(gx0, gy0, gw, gh); c.clip();
let s = c.createLinearGradient(0, gy0, 0, gy1);
s.addColorStop(0, '#080b24'); s.addColorStop(.5, '#1a1543'); s.addColorStop(.82, '#3e1f50'); s.addColorStop(1, '#6a2a57');
c.fillStyle = s; c.fillRect(gx0, gy0, gw, gh);
stars = [];
for (let i = 0; i < 110; i++) {
const sx = gx0 + sr() * gw, sy = gy0 + sr() * gh * .6, r = sr() * .9 + .2;
c.fillStyle = `rgba(230,225,255,${.2 + sr() * .5})`; c.fillRect(sx, sy, r, r);
if (sr() < .12) stars.push({ x: sx, y: sy, p: sr() * TAU });
}
const mx = gx0 + gw * .72, my = gy0 + gh * .2, mr = 22 * sc;
g.moon = { x: mx, y: my, r: mr };
glow(c, mx, my, mr * 6, [255, 232, 200], .16);
glow(c, mx, my, mr * 2.2, [255, 240, 215], .22);
let mg = c.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr);
mg.addColorStop(0, '#fffaf0'); mg.addColorStop(1, '#e8d9bb');
c.fillStyle = mg; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
c.fillStyle = 'rgba(150,130,110,.13)';
[[-.3, -.15, .22], [.25, .2, .16], [-.05, .38, .1], [.32, -.3, .09]].forEach(([a, b, r]) => { c.beginPath(); c.arc(mx + a * mr, my + b * mr, r * mr, 0, TAU); c.fill(); });
c.fillStyle = 'rgba(185,165,230,.08)';
for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(gx0 + sr() * gw, gy0 + gh * (.15 + sr() * .35), 60 * sc + sr() * 80 * sc, 4 * sc + sr() * 5 * sc, 0, 0, TAU); c.fill(); }
twin = [];
city(c, gx0, gx1, gy1, gh * .2, gh * .44, '#271f4f', .1, null, false);
let hz = c.createLinearGradient(0, gy1 - gh * .5, 0, gy1);
hz.addColorStop(0, 'rgba(255,110,170,0)'); hz.addColorStop(1, 'rgba(255,110,170,.18)');
c.fillStyle = hz; c.fillRect(gx0, gy1 - gh * .5, gw, gh * .5);
city(c, gx0, gx1, gy1, gh * .14, gh * .33, '#191335', .2, twin, true);
const tx = gx0 + gw * .3, th = gh * .5;
c.strokeStyle = '#120e26'; c.lineWidth = 1.3 * sc;
c.beginPath(); c.moveTo(tx - 7 * sc, gy1); c.lineTo(tx, gy1 - th); c.lineTo(tx + 7 * sc, gy1);
for (let k = 1; k < 8; k++) { const yy = gy1 - th * k / 8, ww = 7 * sc * (1 - k / 8); c.moveTo(tx - ww, yy); c.lineTo(tx + ww, yy); }
c.stroke();
g.beacon = { x: tx, y: gy1 - th - 2 };
city(c, gx0, gx1, gy1, gh * .06, gh * .2, '#0f0b21', .3, twin, true);
g.board = { x: gx0 + gw * .56, y: gy1 - gh * .17, w: 34 * sc, h: 11 * sc };
c.fillStyle = 'rgba(120,140,255,.05)'; c.fillRect(gx0, gy0, gw, gh);
c.restore();
let fr = c.createLinearGradient(w.x0, w.y0, w.x1, w.y1);
fr.addColorStop(0, '#33212a'); fr.addColorStop(1, '#22151c');
c.fillStyle = fr; c.beginPath(); c.rect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0); c.rect(gx0, gy0, gw, gh); c.fill('evenodd');
c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 2; c.strokeRect(gx0 - 1, gy0 - 1, gw + 2, gh + 2);
c.strokeStyle = 'rgba(255,215,195,.08)'; c.lineWidth = 1; c.strokeRect(w.x0 + .5, w.y0 + .5, w.x1 - w.x0 - 1, w.y1 - w.y0 - 1);
const mw = 8 * sc, mxx = gx0 + gw / 2, myy = gy0 + gh * .44;
c.fillStyle = '#2c1c24';
c.fillRect(mxx - mw / 2, gy0, mw, gh); c.fillRect(gx0, myy - mw / 2, gw, mw);
c.fillStyle = 'rgba(255,215,195,.07)'; c.fillRect(mxx - mw / 2, gy0, 1, gh); c.fillRect(gx0, myy - mw / 2, gw, 1);
c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(mxx + mw / 2 - 1, gy0, 1, gh); c.fillRect(gx0, myy + mw / 2 - 1, gw, 1);
g.panes = [[gx0, gy0, mxx - mw / 2, myy - mw / 2], [mxx + mw / 2, gy0, gx1, myy - mw / 2], [gx0, myy + mw / 2, mxx - mw / 2, gy1], [mxx + mw / 2, myy + mw / 2, gx1, gy1]];
c.fillStyle = '#8a6b4a'; rr(c, mxx - 3 * sc, myy - 9 * sc, 6 * sc, 5 * sc, 1.5); c.fill();
const sx0 = w.x0 - 16 * sc, sx1 = w.x1 + 16 * sc, sy = w.y1;
let sg = c.createLinearGradient(0, sy - 3, 0, sy + 8 * sc);
sg.addColorStop(0, '#4d3332'); sg.addColorStop(1, '#3a2527');
c.fillStyle = sg; c.fillRect(sx0, sy - 3, sx1 - sx0, 10 * sc);
c.fillStyle = '#26171a'; c.fillRect(sx0, sy + 7 * sc, sx1 - sx0, 11 * sc);
c.fillStyle = 'rgba(255,222,200,.14)'; c.fillRect(sx0, sy - 3, sx1 - sx0, 1);
let sh = c.createLinearGradient(0, sy + 18 * sc, 0, sy + 40 * sc);
sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
c.fillStyle = sh; c.fillRect(sx0 + 6, sy + 18 * sc, sx1 - sx0 - 12, 22 * sc);
succulent(c, w.x1 - 26 * sc, sy - 3);
}
function succulent(c, px, py) {
const pw = 22 * sc, ph = 18 * sc;
let pg = c.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0);
pg.addColorStop(0, '#7a4232'); pg.addColorStop(.45, '#a65f45'); pg.addColorStop(1, '#6a3528');
c.fillStyle = pg; c.beginPath();
c.moveTo(px - pw / 2, py - ph); c.lineTo(px + pw / 2, py - ph); c.lineTo(px + pw * .38, py); c.lineTo(px - pw * .38, py); c.closePath(); c.fill();
c.fillStyle = '#b8704f'; c.fillRect(px - pw / 2 - 1, py - ph - 3 * sc, pw + 2, 4 * sc);
for (let i = 0; i < 9; i++) {
const a = -Math.PI / 2 + (i - 4) * .33, l = (9 + (i % 3) * 3) * sc;
c.save(); c.translate(px, py - ph - 2 * sc); c.rotate(a);
let lg = c.createLinearGradient(0, 0, l, 0); lg.addColorStop(0, '#2f6b55'); lg.addColorStop(1, '#79b59a');
c.fillStyle = lg; c.beginPath(); c.ellipse(l / 2, 0, l / 2, 2.6 * sc, 0, 0, TAU); c.fill(); c.restore();
}
}
function shelfStatic(c) {
const s = g.shelf, th = 10 * sc;
g.cushion = null;
if (s.x1 - s.x0 < 120) { s.bookEnd = s.x0; return; }
let sh = c.createLinearGradient(0, s.y + th, 0, s.y + th + 26 * sc);
sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
c.fillStyle = sh; c.fillRect(s.x0 + 6, s.y + th, s.x1 - s.x0 - 12, 26 * sc);
c.fillStyle = '#1b1218';
[s.x0 + 24 * sc, s.x1 - 24 * sc].forEach(bx => { c.fillRect(bx - 2, s.y + th, 4, 16 * sc); c.fillRect(bx - 2, s.y + th + 14 * sc, -10 * sc, 3); });
let bx = s.x0 + 10 * sc;
const cols = ['#6b3b52', '#2f4a63', '#8a6a3d', '#3d3460', '#5c2f3a', '#2b5248', '#74465c'];
const ws = [12, 15, 10, 14, 11, 16, 12], hs = [52, 44, 58, 47, 40, 55, 46];
for (let i = 0; i < 6; i++) {
const bw = ws[i] * sc, bh = hs[i] * sc, top = s.y - bh;
let bg = c.createLinearGradient(bx, 0, bx + bw, 0);
bg.addColorStop(0, cols[i]); bg.addColorStop(.35, shade(cols[i], 1.25)); bg.addColorStop(1, shade(cols[i], .7));
c.fillStyle = bg; c.fillRect(bx, top, bw, bh);
c.fillStyle = 'rgba(255,220,170,.28)'; c.fillRect(bx + 1, top + bh * .16, bw - 2, 1.4); c.fillRect(bx + 1, top + bh * .8, bw - 2, 1.4);
c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(bx + bw * .25, top + bh * .34, bw * .5, bh * .22);
bx += bw + .5;
}
c.save(); c.translate(bx + 2, s.y); c.rotate(-.24);
let lb = c.createLinearGradient(0, 0, 13 * sc, 0); lb.addColorStop(0, '#2b5248'); lb.addColorStop(1, '#1d3a33');
c.fillStyle = lb; c.fillRect(0, -50 * sc, 13 * sc, 50 * sc);
c.fillStyle = 'rgba(255,220,170,.25)'; c.fillRect(1, -42 * sc, 11 * sc, 1.4); c.restore();
s.bookEnd = bx + 18 * sc;
const cx = s.x1 - 22 * sc, ch = 22 * sc;
c.fillStyle = '#2a2026'; c.beginPath(); c.ellipse(cx, s.y - 1, 11 * sc, 3 * sc, 0, 0, TAU); c.fill();
let cg = c.createLinearGradient(cx - 5 * sc, 0, cx + 5 * sc, 0); cg.addColorStop(0, '#d9c7b0'); cg.addColorStop(.4, '#f3e6d2'); cg.addColorStop(1, '#bfa98f');
c.fillStyle = cg; c.fillRect(cx - 5 * sc, s.y - ch, 10 * sc, ch - 2);
c.fillStyle = '#f7ecdc'; c.beginPath(); c.ellipse(cx, s.y - ch, 5 * sc, 1.8 * sc, 0, 0, TAU); c.fill();
c.fillRect(cx + 2 * sc, s.y - ch, 2 * sc, 7 * sc);
c.strokeStyle = '#2a1d17'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, s.y - ch); c.lineTo(cx, s.y - ch - 3 * sc); c.stroke();
g.candle = { x: cx, y: s.y - ch - 3 * sc };
let pg = c.createLinearGradient(0, s.y, 0, s.y + th);
pg.addColorStop(0, '#5a3a2d'); pg.addColorStop(.35, '#45291f'); pg.addColorStop(1, '#2b1913');
c.fillStyle = pg; rr(c, s.x0, s.y, s.x1 - s.x0, th, 2); c.fill();
c.fillStyle = 'rgba(255,215,180,.16)'; c.fillRect(s.x0 + 2, s.y, s.x1 - s.x0 - 4, 1);
cushion(c, s, cx);
}
/* a small knitted cushion between the books and the candle: the cat's bed */
function cushion(c, s, candleX) {
const room = candleX - 13 * sc - s.bookEnd;
if (room < 40) { g.cushion = null; return; }
const w = Math.min(58 * sc, room - 4), h = 12 * sc, cx = s.bookEnd + room / 2, yb = s.y, yt = yb - h, x0 = cx - w / 2, x1 = cx + w / 2;
const path = () => {
c.beginPath(); c.moveTo(x0 + 3, yb - .5);
c.bezierCurveTo(x0 - 2.5, yb - h * .45, x0 - .5, yt + 1.5, x0 + 3.5, yt + .5);
c.bezierCurveTo(cx - w * .26, yt - h * .32, cx + w * .26, yt - h * .32, x1 - 3.5, yt + .5);
c.bezierCurveTo(x1 + .5, yt + 1.5, x1 + 2.5, yb - h * .45, x1 - 3, yb - .5);
c.bezierCurveTo(cx + w * .22, yb + 1.2, cx - w * .22, yb + 1.2, x0 + 3, yb - .5); c.closePath();
};
c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cx, yb, w * .5, 2.5 * sc, 0, 0, TAU); c.fill();
path(); let cg = c.createLinearGradient(0, yt - 3 * sc, 0, yb);
cg.addColorStop(0, '#8d6079'); cg.addColorStop(.55, '#6a4560'); cg.addColorStop(1, '#4a2f45'); c.fillStyle = cg; c.fill();
c.save(); path(); c.clip();
let rg = c.createLinearGradient(x0, 0, x1, 0);
rg.addColorStop(0, 'rgba(0,0,0,.28)'); rg.addColorStop(.3, 'rgba(0,0,0,0)'); rg.addColorStop(.75, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.3)');
c.fillStyle = rg; c.fillRect(x0 - 4, yt - 6, w + 8, h + 8);
c.strokeStyle = 'rgba(255,215,235,.1)'; c.lineWidth = .8;
for (let kx = x0 + 3 * sc; kx < x1; kx += 4.2 * sc) for (let ky = yt - 2 * sc; ky < yb; ky += 3 * sc) {
c.beginPath(); c.moveTo(kx - 1.4 * sc, ky); c.lineTo(kx, ky + 1.6 * sc); c.lineTo(kx + 1.4 * sc, ky); c.stroke();
}
c.restore();
c.strokeStyle = 'rgba(255,220,235,.2)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0 + 4, yt + .5); c.bezierCurveTo(cx - w * .26, yt - h * .32, cx + w * .26, yt - h * .32, x1 - 4, yt + .5); c.stroke();
c.strokeStyle = '#a77890'; c.lineWidth = 1;
[[x0 + 3.5, yt + .5, -1], [x1 - 3.5, yt + .5, 1]].forEach(([tx, ty, d]) => { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + d * (2 + i) * sc, ty - (1.5 - i * 1.2) * sc); c.stroke(); } });
g.cushion = { x: cx, w, h: h * .72, y: yt };
}
function shade(hex, k) { const c = hexRgb(hex); return rgba(c.map(v => clamp(v * k, 0, 255)), 1); }
function planterStatic(c) {
const p = g.plant;
if (g.lm.w < 150) return;
const ringY = 26 * sc, potW = 46 * sc, potH = 30 * sc, rimY = p.y - potH;
c.strokeStyle = 'rgba(217,198,165,.75)'; c.lineWidth = 1.3 * sc;
c.beginPath(); c.moveTo(p.x, -4); c.lineTo(p.x, ringY); c.stroke();
c.beginPath(); c.arc(p.x, ringY + 4 * sc, 4 * sc, 0, TAU); c.stroke();
const ends = [-.5, -.17, .17, .5].map(k => p.x + k * potW);
const knotY = lerp(ringY, rimY, .55);
ends.forEach((ex, i) => {
const kx = lerp(p.x, ex, .55);
c.beginPath(); c.moveTo(p.x, ringY + 8 * sc); c.lineTo(kx, knotY); c.lineTo(ex, rimY + 3 * sc); c.stroke();
c.fillStyle = 'rgba(217,198,165,.85)'; c.beginPath(); c.arc(kx, knotY, 2 * sc, 0, TAU); c.fill();
if (i < 3) { const nx = lerp(p.x, ends[i + 1], .55); c.beginPath(); c.moveTo(kx, knotY); c.quadraticCurveTo((kx + nx) / 2, knotY + 9 * sc, nx, knotY); c.stroke(); }
});
c.strokeStyle = 'rgba(217,198,165,.6)';
for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(p.x - 2 + i * 1.3, ringY + 8 * sc); c.lineTo(p.x - 4 + i * 2.6, ringY + 22 * sc); c.stroke(); }
let pg = c.createLinearGradient(p.x - potW / 2, 0, p.x + potW / 2, 0);
pg.addColorStop(0, '#6a3a2c'); pg.addColorStop(.4, '#a1634a'); pg.addColorStop(1, '#5b3024');
c.fillStyle = pg; c.beginPath();
c.moveTo(p.x - potW / 2, rimY); c.lineTo(p.x + potW / 2, rimY);
c.bezierCurveTo(p.x + potW / 2, rimY + potH * .8, p.x + potW * .3, p.y, p.x, p.y);
c.bezierCurveTo(p.x - potW * .3, p.y, p.x - potW / 2, rimY + potH * .8, p.x - potW / 2, rimY); c.fill();
c.fillStyle = '#b8765a'; rr(c, p.x - potW / 2 - 2, rimY - 3 * sc, potW + 4, 5 * sc, 2); c.fill();
c.fillStyle = 'rgba(255,230,210,.18)'; c.fillRect(p.x - potW / 2, rimY - 3 * sc, potW, 1);
g.potRim = { x: p.x, y: rimY };
}
function deskStatic(c) {
const y = g.deskY;
let tg = c.createLinearGradient(0, y, 0, y + 12 * sc);
tg.addColorStop(0, '#523629'); tg.addColorStop(1, '#3d271f');
c.fillStyle = tg; c.fillRect(0, y, W, 12 * sc);
c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 1;
for (let i = 0; i < 5; i++) { c.beginPath(); const yy = y + 2 + i * 2.2 * sc; c.moveTo(0, yy); for (let xx = 0; xx <= W; xx += 40) c.lineTo(xx, yy + Math.sin(xx * .013 + i) * .8); c.stroke(); }
c.fillStyle = 'rgba(255,214,180,.17)'; c.fillRect(0, y, W, 1);
let fg = c.createLinearGradient(0, y + 12 * sc, 0, H);
fg.addColorStop(0, '#26180f'); fg.addColorStop(1, '#130c08');
c.fillStyle = fg; c.fillRect(0, y + 12 * sc, W, H - y);
c.fillStyle = 'rgba(255,214,180,.06)'; c.fillRect(0, y + 12 * sc, W, 1);
}
function lampStatic(c) {
const b = { x: g.lamp.x, y: g.deskY + 7 * sc };
const j0 = { x: b.x, y: b.y - 7 * sc }, el = { x: b.x + 20 * sc, y: b.y - 92 * sc }, hd = { x: b.x - 24 * sc, y: b.y - 136 * sc };
c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(b.x, b.y + 3, 30 * sc, 5 * sc, 0, 0, TAU); c.fill();
let bg = c.createLinearGradient(0, b.y - 8 * sc, 0, b.y);
bg.addColorStop(0, '#3a3443'); bg.addColorStop(1, '#1c1922');
c.fillStyle = bg; c.beginPath(); c.ellipse(b.x, b.y - 2 * sc, 24 * sc, 6 * sc, 0, 0, TAU); c.fill();
c.fillRect(b.x - 24 * sc, b.y - 6 * sc, 48 * sc, 4 * sc);
c.fillStyle = 'rgba(255,230,210,.12)'; c.beginPath(); c.ellipse(b.x, b.y - 6 * sc, 22 * sc, 4 * sc, 0, Math.PI, TAU); c.fill();
c.lineCap = 'round';
[[j0, el], [el, hd]].forEach(([a, z]) => {
c.strokeStyle = '#2b2634'; c.lineWidth = 5 * sc; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(z.x, z.y); c.stroke();
c.strokeStyle = 'rgba(255,230,210,.14)'; c.lineWidth = 1; c.beginPath(); c.moveTo(a.x - 1.5, a.y); c.lineTo(z.x - 1.5, z.y); c.stroke();
});
c.strokeStyle = 'rgba(160,150,175,.45)'; c.lineWidth = 1;
c.beginPath();
for (let i = 0; i <= 14; i++) { const u = .2 + i / 14 * .5, px = lerp(j0.x, el.x, u) + 4 * sc, py = lerp(j0.y, el.y, u); c.lineTo(px + (i % 2 ? 2.5 : -2.5) * sc, py); }
c.stroke();
[j0, el, hd].forEach(p => { c.fillStyle = '#3c3546'; c.beginPath(); c.arc(p.x, p.y, 4 * sc, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,230,210,.2)'; c.beginPath(); c.arc(p.x - 1, p.y - 1, 1.2 * sc, 0, TAU); c.fill(); });
const ang = 2.25, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, len = 34 * sc;
const n0 = 7 * sc, n1 = 24 * sc;
const m = { x: hd.x + dx * len, y: hd.y + dy * len };
let shg = c.createLinearGradient(hd.x + nx * n1, hd.y + ny * n1, hd.x - nx * n1, hd.y - ny * n1);
shg.addColorStop(0, '#3d3548'); shg.addColorStop(1, '#1c1823');
c.fillStyle = shg; c.beginPath();
c.moveTo(hd.x + nx * n0 - dx * 4, hd.y + ny * n0 - dy * 4); c.lineTo(m.x + nx * n1, m.y + ny * n1);
c.lineTo(m.x - nx * n1, m.y - ny * n1); c.lineTo(hd.x - nx * n0 - dx * 4, hd.y - ny * n0 - dy * 4); c.closePath(); c.fill();
c.strokeStyle = 'rgba(255,230,210,.18)'; c.lineWidth = 1; c.beginPath(); c.moveTo(hd.x + nx * n0, hd.y + ny * n0); c.lineTo(m.x + nx * n1, m.y + ny * n1); c.stroke();
g.bulb = { x: m.x - dx * 4 * sc, y: m.y - dy * 4 * sc, dx, dy, nx, ny, n1, mouth: m };
}
function recordStatic(c) {
const r = g.rec, y = g.deskY + 8 * sc, h = 24 * sc, x0 = r.x0, w = r.w;
if (g.rm.w < 150) return;
r.top = y - h;
c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(x0 + 4, y - 1, w - 8, 5 * sc);
let fg = c.createLinearGradient(0, y - h + 10 * sc, 0, y);
fg.addColorStop(0, '#6a4532'); fg.addColorStop(1, '#40291e');
c.fillStyle = fg; rr(c, x0, y - h + 9 * sc, w, h - 9 * sc, 3); c.fill();
c.fillStyle = 'rgba(214,170,110,.5)'; c.fillRect(x0 + 4, y - h + 13 * sc, w - 8, 1);
c.fillStyle = '#1b1519'; c.beginPath();
c.moveTo(x0 + 3, y - h + 9 * sc); c.lineTo(x0 + w - 3, y - h + 9 * sc); c.lineTo(x0 + w - 7, y - h); c.lineTo(x0 + 7, y - h); c.closePath(); c.fill();
[.78, .88].forEach(k => { c.fillStyle = '#c9a97c'; c.beginPath(); c.arc(x0 + w * k, y - 6 * sc, 2.4 * sc, 0, TAU); c.fill(); });
r.platter = { x: x0 + w * .4, y: y - h + 4.5 * sc, rx: w * .27, ry: 3.6 * sc };
r.arm = { x: x0 + w - 12 * sc, y: y - h + 2 * sc };
r.led = { x: x0 + 10 * sc, y: y - 6 * sc };
}
function mugStatic(c) {
const m = g.mug; if (g.lm.w < 150) return;
const y = g.deskY + 8 * sc;
c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(m.x - 34 * sc, y - 1, 66 * sc, 4 * sc);
c.fillStyle = '#2f3f5a'; c.fillRect(m.x - 34 * sc, y - 6 * sc, 64 * sc, 6 * sc);
c.fillStyle = '#e9dfcf'; c.fillRect(m.x - 33 * sc, y - 6 * sc, 62 * sc, 1.6 * sc);
c.fillStyle = '#c8475e'; c.fillRect(m.x + 18 * sc, y - 6 * sc, 2 * sc, 6 * sc);
const by = y - 6 * sc, mw = 24 * sc, mh = 26 * sc;
c.strokeStyle = '#3b3352'; c.lineWidth = 4 * sc; c.beginPath(); c.arc(m.x - mw / 2, by - mh * .55, 7 * sc, Math.PI * .5, Math.PI * 1.5); c.stroke();
let mg = c.createLinearGradient(m.x - mw / 2, 0, m.x + mw / 2, 0);
mg.addColorStop(0, '#4a4166'); mg.addColorStop(.35, '#3a3352'); mg.addColorStop(1, '#221e31');
c.fillStyle = mg; rr(c, m.x - mw / 2, by - mh, mw, mh, 5 * sc); c.fill();
c.fillStyle = '#5a5078'; c.beginPath(); c.ellipse(m.x, by - mh, mw / 2, 3 * sc, 0, 0, TAU); c.fill();
c.fillStyle = '#24140e'; c.beginPath(); c.ellipse(m.x, by - mh + .6, mw / 2 - 2, 2.2 * sc, 0, 0, TAU); c.fill();
c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(m.x - mw / 2 + 3 * sc, by - mh + 5 * sc, 2 * sc, mh - 10 * sc);
m.top = by - mh;
}
function grain(c) {
const n = new OffscreenCanvas(128, 128);
const nx = n.getContext('2d'), d = nx.createImageData(128, 128);
for (let i = 0; i < d.data.length; i += 4) { const v = sr() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
nx.putImageData(d, 0, 0);
c.save(); c.globalAlpha = .045; c.globalCompositeOperation = 'overlay';
c.fillStyle = c.createPattern(n, 'repeat'); c.fillRect(0, 0, W, H); c.restore();
}
/* ---------- particles ---------- */
function initParticles() {
const gl = g.glass, gw = gl.x1 - gl.x0, gh = gl.y1 - gl.y0;
drops = Array.from({ length: 150 }, () => ({ x: gl.x0 + Math.random() * (gw + 60), y: gl.y0 + Math.random() * gh, l: 6 + Math.random() * 10, v: 380 + Math.random() * 240 }));
beads = Array.from({ length: 80 }, () => ({ x: gl.x0 + Math.random() * gw, y: gl.y0 + Math.random() * gh, r: (.7 + Math.random() * 1.8) * sc }));
slides = Array.from({ length: 6 }, () => newSlide(true));
motes = Array.from({ length: 70 }, () => newMote(true));
}
function newSlide(any) {
const gl = g.glass;
return { x: gl.x0 + Math.random() * (gl.x1 - gl.x0), y: gl.y0 + Math.random() * (any ? (gl.y1 - gl.y0) : 40), r: (1.4 + Math.random() * 1.4) * sc, v: 0, hold: Math.random() * 2, trail: [] };
}
const rayDir = () => { const len = Math.max(W, H) * 1.05; return { x: -.8 * len, y: .6 * len }; };
function newMote(any) {
const p = g.panes[(Math.random() * 4) | 0], D = rayDir(), u = any ? Math.random() : Math.random() * .1;
return { px: lerp(p[0], p[2], Math.random()), py: lerp(p[1], p[3], Math.random()), u, du: .006 + Math.random() * .01, r: .5 + Math.random() * 1.3, ph: Math.random() * TAU, D };
}
function hull(pts) {
pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const lo = [], up = [];
for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
for (const p of pts.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
return lo.slice(0, -1).concat(up.slice(0, -1));
}
/* ---------- dynamic layer ---------- */
function frame(dt) {
x.clearRect(0, 0, W, H);
x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
x.drawImage(st, 0, 0, W, H);
windowLife(dt);
curtains();
wallGlows();
neon(dt);
vines();
lamp();
stringLights();
rays(dt);
candle();
steam();
record(dt);
vignette();
}
function windowLife(dt) {
const gl = g.glass;
x.save(); x.beginPath(); x.rect(gl.x0, gl.y0, gl.x1 - gl.x0, gl.y1 - gl.y0); x.clip();
for (const s of stars) { const a = .35 + .35 * Math.sin(T * 1.7 + s.p); x.fillStyle = `rgba(240,236,255,${a})`; x.fillRect(s.x - .5, s.y - .5, 1.6, 1.6); }
for (const w of twin) {
w.next -= dt; if (w.next < 0) { w.on = !w.on; w.next = 4 + Math.random() * 14; }
if (w.on) { x.fillStyle = 'rgba(255,204,140,.7)'; x.fillRect(w.x, w.y, 2 * sc, 3 * sc); }
}
if ((T % 1.8) < .3) { glow(x, g.beacon.x, g.beacon.y, 9 * sc, [255, 60, 70], .6); x.fillStyle = '#ff4d5a'; x.beginPath(); x.arc(g.beacon.x, g.beacon.y, 1.6 * sc, 0, TAU); x.fill(); }
const b = g.board, bf = Math.sin(T * 13) > -.92 ? 1 : .25;
glow(x, b.x + b.w / 2, b.y + b.h / 2, b.w * 1.3, [255, 90, 180], .22 * bf);
x.fillStyle = `rgba(255,120,200,${.85 * bf})`; x.fillRect(b.x, b.y, b.w, 1.4); x.fillRect(b.x, b.y + b.h - 1.4, b.w, 1.4);
x.fillStyle = `rgba(110,230,255,${.8 * bf})`; x.fillRect(b.x + 4 * sc, b.y + b.h / 2 - .7, b.w - 8 * sc, 1.4);
const n = Math.round(drops.length * C.st.rain);
x.strokeStyle = 'rgba(175,195,255,.17)'; x.lineWidth = 1; x.beginPath();
for (let i = 0; i < n; i++) {
const d = drops[i]; d.y += d.v * dt; d.x -= d.v * dt * .12;
if (d.y > gl.y1) { d.y = gl.y0 - Math.random() * 40; d.x = gl.x0 + Math.random() * (gl.x1 - gl.x0 + 60); }
x.moveTo(d.x, d.y); x.lineTo(d.x + d.l * .12, d.y - d.l);
}
x.stroke();
const nb = Math.round(beads.length * Math.min(1, C.st.rain * 1.2));
for (let i = 0; i < nb; i++) bead(beads[i].x, beads[i].y, beads[i].r);
const ns = Math.round(slides.length * C.st.rain);
for (let i = 0; i < ns; i++) {
const s = slides[i];
if (s.hold > 0) { s.hold -= dt; s.v = 0; } else { s.v = 30 + Math.random() * 90; if (Math.random() < dt * .8) s.hold = Math.random() * 1.2; }
s.y += s.v * dt; s.x += Math.sin(s.y * .08) * .15;
if (s.v) { s.trail.push([s.x, s.y]); if (s.trail.length > 40) s.trail.shift(); }
if (s.trail.length > 1) { x.strokeStyle = 'rgba(200,215,255,.09)'; x.lineWidth = s.r * .8; x.beginPath(); s.trail.forEach(([a, b2], k) => k ? x.lineTo(a, b2) : x.moveTo(a, b2)); x.stroke(); }
bead(s.x, s.y, s.r * 1.3);
if (s.y > gl.y1 + 4) slides[i] = newSlide(false);
}
glow(x, gl.x1 - 40 * sc, gl.y1 - 30 * sc, 90 * sc, WARM, .05 * lampK);
x.restore();
}
function bead(px, py, r) {
x.fillStyle = 'rgba(8,10,28,.28)'; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
x.fillStyle = 'rgba(200,215,255,.22)'; x.beginPath(); x.arc(px, py + r * .35, r * .7, 0, Math.PI); x.fill();
x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(px - r * .45, py - r * .5, Math.max(.8, r * .4), Math.max(.8, r * .4));
}
function curtains() {
const w = g.win, ya = w.y0 - 20 * sc, yb = w.y1 + 92 * sc;
const wind = (.55 + .45 * Math.sin(T * .13)) * (.6 + C.st.rain * .6);
x.strokeStyle = '#2a2230'; x.lineWidth = 3 * sc; x.beginPath(); x.moveTo(w.x0 - 70 * sc, ya - 4); x.lineTo(w.x1 + 70 * sc, ya - 4); x.stroke();
x.fillStyle = '#3a3142'; [w.x0 - 70 * sc, w.x1 + 70 * sc].forEach(px => { x.beginPath(); x.arc(px, ya - 4, 4.5 * sc, 0, TAU); x.fill(); });
curtain(w.x0 - 56 * sc, w.x0 + 22 * sc, ya, yb, wind, 0, 1);
curtain(w.x1 - 22 * sc, w.x1 + 56 * sc, ya, yb, wind, 2.1, -1);
}
function curtain(xa, xb, ya, yb, wind, ph, lit) {
const n = 6, fw = (xb - xa) / n, steps = 18, amp = 5.5 * sc * wind;
const sway = (y, j) => { const u = (y - ya) / (yb - ya); return amp * Math.pow(u, 1.6) * Math.sin(T * .85 + ph + j * .45 - u * 2.2) + amp * .5 * Math.pow(u, 2) * Math.sin(T * .37 + ph); };
for (let j = 0; j < n; j++) {
const L = [], R = [];
for (let k = 0; k <= steps; k++) { const y = ya + (yb - ya) * k / steps; L.push([xa + j * fw + sway(y, j), y]); R.push([xa + (j + 1) * fw + sway(y, j + 1), y]); }
L[steps][1] += Math.sin(j * 1.7 + ph) * 3 * sc; R[steps][1] += Math.sin((j + 1) * 1.7 + ph) * 3 * sc;
x.beginPath(); L.forEach(([a, b], k) => k ? x.lineTo(a, b) : x.moveTo(a, b)); for (let k = steps; k >= 0; k--) x.lineTo(R[k][0], R[k][1]); x.closePath();
const gx0 = xa + j * fw, hg = x.createLinearGradient(gx0, 0, gx0 + fw, 0);
hg.addColorStop(0, '#24152c'); hg.addColorStop(.5, '#4a2c55'); hg.addColorStop(1, '#24152c');
x.fillStyle = hg; x.fill();
const vg = x.createLinearGradient(0, ya, 0, yb);
vg.addColorStop(0, 'rgba(0,0,0,.25)'); vg.addColorStop(.4, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.38)');
x.fillStyle = vg; x.fill();
}
const ex = lit > 0 ? xb : xa, j = lit > 0 ? n : 0;
x.strokeStyle = 'rgba(175,185,255,.2)'; x.lineWidth = 1.4; x.beginPath();
for (let k = 0; k <= steps; k++) { const y = ya + (yb - ya) * k / steps; k ? x.lineTo(ex + sway(y, j), y) : x.moveTo(ex + sway(y, j), y); }
x.stroke();
x.strokeStyle = 'rgba(70,60,82,.95)'; x.lineWidth = 1;
for (let j2 = 0; j2 <= n; j2 += 2) { x.beginPath(); x.ellipse(xa + j2 * fw, ya - 4, 2 * sc, 3 * sc, 0, 0, TAU); x.stroke(); }
}
function wallGlows() {
x.save(); x.globalCompositeOperation = 'lighter';
if (g.lm.w >= 150) {
glow(x, g.neon.x, g.neon.y, 260 * sc, neonCol, .1 * neonOn);
glow(x, g.neon.x, g.deskY + 6 * sc, 110 * sc, neonCol, .05 * neonOn);
}
glow(x, g.bulb.x, g.bulb.y, 330 * sc, WARM, .12 * lampK);
if (g.candle) glow(x, g.candle.x, g.candle.y - 6 * sc, 80 * sc, WARM, .12 + .03 * Math.sin(T * 9));
x.restore();
}
function neon(dt) {
if (g.lm.w < 150) return;
if (neonMix < 1) { neonMix = Math.min(1, neonMix + dt * 2.5); neonCol = neonFrom.map((v, i) => lerp(v, neonTo[i], neonMix)); }
if (neonSeq) {
neonSeq.t += dt; const k = neonSeq.keys; let v = 1;
for (let i = 0; i < k.length; i++) if (neonSeq.t >= k[i][0]) v = k[i][1];
neonOn = v;
if (neonSeq.swap && neonSeq.t > neonSeq.swap) { neonFrom = neonCol; neonTo = neonSeq.to; neonMix = 0; neonSeq.swap = 0; }
if (neonSeq.t > k[k.length - 1][0]) neonSeq = null;
} else if ((nextFlicker -= dt) < 0) {
nextFlicker = 14 + Math.random() * 26;
neonSeq = { t: 0, keys: [[0, .25], [.06, 1], [.14, .4], [.2, 1]] };
}
const fs = clamp(g.lm.w * .125, 22, 38) * sc, cx0 = g.neon.x, cy0 = g.neon.y;
x.save();
x.font = `${fs}px "Segoe Script","Brush Script MT","Snell Roundhand",cursive`;
x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineCap = 'round';
const tw = x.measureText('stay cozy').width, hx = cx0 + tw / 2 + 16 * sc, hy = cy0 - 2 * sc;
x.fillStyle = 'rgba(255,255,255,.025)'; rr(x, cx0 - tw / 2 - 18 * sc, cy0 - fs * .78, tw + 52 * sc, fs * 1.5, 10 * sc); x.fill();
x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 1; x.stroke();
x.fillStyle = 'rgba(255,255,255,.18)';
[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { x.beginPath(); x.arc(cx0 + 8 * sc + a * (tw / 2 + 18 * sc), cy0 + b * fs * .58, 1.8 * sc, 0, TAU); x.fill(); });
x.strokeStyle = 'rgba(8,6,14,.85)'; x.lineWidth = 1.5;
x.beginPath(); x.moveTo(cx0 - tw / 2 - 8 * sc, cy0 + fs * .72); x.bezierCurveTo(cx0 - tw / 2 - 20 * sc, g.shelf.y - 90 * sc, cx0 - tw / 2 + 6 * sc, g.shelf.y - 40 * sc, cx0 - tw / 2 - 4 * sc, g.shelf.y); x.stroke();
const heart = () => { x.beginPath(); const s = 9 * sc; x.moveTo(hx, hy + s * .9); x.bezierCurveTo(hx - s * 1.4, hy - s * .1, hx - s * .7, hy - s * 1.1, hx, hy - s * .35); x.bezierCurveTo(hx + s * .7, hy - s * 1.1, hx + s * 1.4, hy - s * .1, hx, hy + s * .9); };
const pass = (col, lw, blur) => { x.strokeStyle = col; x.lineWidth = lw; x.shadowColor = rgba(neonCol, 1); x.shadowBlur = blur; x.strokeText('stay cozy', cx0, cy0); heart(); x.stroke(); };
pass(rgba(neonCol, .14), 2.6 * sc, 0);
if (neonOn > .05) {
pass(rgba(neonCol, .5 * neonOn), 5 * sc, 26 * sc);
pass(rgba(neonCol, .95 * neonOn), 2.4 * sc, 9 * sc);
x.shadowBlur = 0; x.strokeStyle = `rgba(255,245,250,${.7 * neonOn})`; x.lineWidth = 1 * sc; x.strokeText('stay cozy', cx0, cy0); heart(); x.stroke();
}
x.restore();
}
function leaf(c, px, py, ang, s, tone) {
c.save(); c.translate(px, py); c.rotate(ang);
c.beginPath(); c.moveTo(0, 0);
c.bezierCurveTo(-s * .1, -s * .62, s * .6, -s * .78, s * 1.25, 0);
c.bezierCurveTo(s * .6, s * .78, -s * .1, s * .62, 0, 0);
const lg = c.createLinearGradient(0, -s * .5, s, s * .5);
lg.addColorStop(0, tone ? '#5fae6e' : '#4a9a5f'); lg.addColorStop(1, tone ? '#2b6a40' : '#225a37');
c.fillStyle = lg; c.fill();
c.strokeStyle = 'rgba(220,255,200,.2)'; c.lineWidth = .7; c.beginPath(); c.moveTo(s * .1, 0); c.quadraticCurveTo(s * .6, -s * .06, s * 1.12, 0); c.stroke();
if (tone) { c.strokeStyle = 'rgba(240,240,150,.18)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(s * .35, -s * .25); c.quadraticCurveTo(s * .7, -s * .3, s * .95, -s * .1); c.stroke(); }
c.restore();
}
const VINES = [[-17, 120, 0], [-7, 165, 1.3], [6, 100, 2.1], [18, 140, .7], [0, 75, 3]];
function vines() {
if (!g.potRim) return;
const p = g.potRim, wind = .6 + .4 * Math.sin(T * .21);
VINES.forEach(([dx, len, ph], vi) => {
const N = 13, seg = len * sc / N; let px = p.x + dx * sc, py = p.y - 1, a = Math.PI / 2 + Math.sign(dx || 1) * .55;
const pts = [[px, py]];
for (let k = 1; k <= N; k++) {
const u = k / N;
a += (Math.PI / 2 - a) * .32 + Math.sin(T * .55 + ph + k * .3) * .035 * u * wind * 3;
px += Math.cos(a) * seg; py += Math.sin(a) * seg; pts.push([px, py, a]);
}
x.strokeStyle = '#2d5a3a'; x.lineWidth = 1.4 * sc; x.beginPath(); pts.forEach(([a1, b1], k) => k ? x.lineTo(a1, b1) : x.moveTo(a1, b1)); x.stroke();
pts.forEach(([a1, b1, an], k) => { if (!k) return; const side = (k + vi) % 2 ? 1 : -1, s = (6.5 + 3.5 * Math.abs(Math.sin(k * 1.7 + ph))) * sc * (1 - k / N * .35); leaf(x, a1, b1, an + side * 1.05 + Math.sin(T * .9 + k + ph) * .06, s, (k + vi) % 3 === 0); });
});
for (let i = 0; i < 7; i++) leaf(x, p.x - 20 * sc + i * 6.5 * sc, p.y - 1, -Math.PI / 2 + (i - 3) * .42, 9 * sc, i % 3 === 0);
}
function lamp() {
const b = g.bulb;
if (lampSeq) {
lampSeq.t += 1 / 30;
const k = lampSeq.keys; let v = lampSeq.to;
for (let i = 0; i < k.length; i++) if (lampSeq.t >= k[i][0]) v = k[i][1] * lampSeq.to;
lampK = v; if (lampSeq.t > k[k.length - 1][0]) { lampSeq = null; lampK = lampTarget; }
} else lampK += (lampTarget - lampK) * .08;
const k = lampK;
const hit = (nx, ny) => { const t = (g.deskY + 4 * sc - b.mouth.y) / Math.max(.1, b.dy * .95 + ny * .25); return [b.mouth.x + (b.dx + nx * .25) * t, b.mouth.y + (b.dy * .95 + ny * .25) * t]; };
const l1 = [b.mouth.x + b.nx * b.n1, b.mouth.y + b.ny * b.n1], l2 = [b.mouth.x - b.nx * b.n1, b.mouth.y - b.ny * b.n1];
const p1 = hit(b.nx, b.ny), p2 = hit(-b.nx, -b.ny);
x.save(); x.globalCompositeOperation = 'lighter';
const cg = x.createLinearGradient(b.mouth.x, b.mouth.y, (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2);
cg.addColorStop(0, rgba(WARM, .16 * k)); cg.addColorStop(1, rgba(WARM, .03 * k));
x.fillStyle = cg; x.beginPath(); x.moveTo(...l1); x.lineTo(...p1); x.lineTo(...p2); x.lineTo(...l2); x.closePath(); x.fill();
const pc = [(p1[0] + p2[0]) / 2, g.deskY + 5 * sc];
x.save(); x.translate(pc[0], pc[1]); x.scale(1, .1); glow(x, 0, 0, 170 * sc, WARM, .4 * k); x.restore();
glow(x, b.x, b.y, 26 * sc, [255, 236, 205], .95 * k);
glow(x, b.x, b.y, 80 * sc, WARM, .3 * k);
x.restore();
x.strokeStyle = rgba([255, 214, 160], .5 * k); x.lineWidth = 1.5; x.beginPath(); x.moveTo(...l1); x.lineTo(...l2); x.stroke();
}
function stringLights() {
const s = g.lights, segs = 3, span = (s.x1 - s.x0) / segs;
const on = C.st.lights;
for (let j = 0; j < segs; j++) {
const ax = s.x0 + j * span, bx = ax + span, cx0 = (ax + bx) / 2, cy0 = s.y + s.sag * 2;
x.strokeStyle = 'rgba(14,10,20,.9)'; x.lineWidth = 1.3; x.beginPath(); x.moveTo(ax, s.y); x.quadraticCurveTo(cx0, cy0, bx, s.y); x.stroke();
const n = Math.max(4, Math.round(span / (36 * sc)));
for (let i = 0; i < n; i++) {
const u = (i + .5) / n, px = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * cx0 + u * u * bx, py = (1 - u) * (1 - u) * s.y + 2 * u * (1 - u) * cy0 + u * u * s.y;
const idx = j * n + i;
let v = .72 + .22 * Math.sin(T * 1.4 + idx * 1.9);
if (C.st.working) v += .7 * Math.pow(Math.max(0, Math.sin(idx * .45 - T * 5)), 6);
v += beatK * .35 + surge * Math.max(0, 1 - Math.abs(idx / (segs * n) - (1 - surge)) * 4);
v = clamp(v, 0, 1.6);
x.fillStyle = '#1a141f'; x.fillRect(px - 1.2, py, 2.4, 3 * sc);
const by = py + 6 * sc;
if (on) {
x.save(); x.globalCompositeOperation = 'lighter'; glow(x, px, by, 18 * sc, [255, 200, 130], .26 * v); x.restore();
x.fillStyle = `rgba(255,${200 + 30 * Math.min(1, v)},${150 + 40 * Math.min(1, v)},${.55 + .45 * Math.min(1, v)})`;
} else x.fillStyle = 'rgba(120,110,100,.35)';
x.beginPath(); x.ellipse(px, by, 2.4 * sc, 3.4 * sc, 0, 0, TAU); x.fill();
}
}
}
function rays(dt) {
const k = C.st.rays; if (k <= 0.01) return;
const D = rayDir();
rcx.setTransform(.25, 0, 0, .25, 0, 0); rcx.clearRect(0, 0, W, H);
rcx.globalCompositeOperation = 'lighter';
g.panes.forEach((p, i) => {
const pts = [[p[0], p[1]], [p[2], p[1]], [p[2], p[3]], [p[0], p[3]]];
const all = pts.concat(pts.map(([a, b]) => [a + D.x, b + D.y])), h = hull(all);
const cx0 = (p[0] + p[2]) / 2, cy0 = (p[1] + p[3]) / 2;
const gr = rcx.createLinearGradient(cx0, cy0, cx0 + D.x * .75, cy0 + D.y * .75);
const a = .2 * k * (.85 + .15 * Math.sin(T * .3 + i * 1.7));
gr.addColorStop(0, rgba(MOON, a)); gr.addColorStop(.45, rgba(MOON, a * .45)); gr.addColorStop(1, rgba(MOON, 0));
rcx.fillStyle = gr; rcx.beginPath(); h.forEach(([a1, b1], j) => j ? rcx.lineTo(a1, b1) : rcx.moveTo(a1, b1)); rcx.closePath(); rcx.fill();
});
x.save(); x.globalCompositeOperation = 'lighter'; x.drawImage(rc, 0, 0, rc.width, rc.height, 0, 0, W, H);
for (let i = 0; i < motes.length; i++) {
const m = motes[i]; m.u += m.du * dt; m.ph += dt;
if (m.u > .7) { motes[i] = newMote(false); continue; }
const mx = m.px + m.D.x * m.u + Math.sin(m.ph * .7) * 6, my = m.py + m.D.y * m.u + Math.sin(m.ph * .5 + 1) * 5;
const a = Math.pow(1 - m.u / .7, 1.5) * (.35 + .35 * Math.sin(m.ph * 2)) * k;
x.fillStyle = `rgba(225,228,255,${a})`; x.beginPath(); x.arc(mx, my, m.r, 0, TAU); x.fill();
}
x.restore();
}
function candle() {
if (!g.candle) return;
const c = g.candle, h = (9 + Math.sin(T * 7) * 1 + Math.sin(T * 13.3) * .6) * sc, sw = Math.sin(T * 3.1) * 1.2 * sc;
x.save(); x.globalCompositeOperation = 'lighter';
glow(x, c.x, c.y - h * .5, 16 * sc, [255, 170, 80], .5);
const fg = x.createLinearGradient(0, c.y, 0, c.y - h);
fg.addColorStop(0, 'rgba(255,240,200,.95)'); fg.addColorStop(.5, 'rgba(255,190,90,.85)'); fg.addColorStop(1, 'rgba(255,120,40,0)');
x.fillStyle = fg; x.beginPath(); x.moveTo(c.x, c.y + 1); x.bezierCurveTo(c.x - 3.4 * sc, c.y - h * .3, c.x - 1 * sc + sw, c.y - h * .8, c.x + sw, c.y - h);
x.bezierCurveTo(c.x + 1 * sc + sw, c.y - h * .8, c.x + 3.4 * sc, c.y - h * .3, c.x, c.y + 1); x.fill();
x.restore();
}
function steam() {
if (!g.mug.top) return;
const m = g.mug, k = C.st.working ? 1 : .45, len = 54 * sc * (.7 + .3 * k);
x.save(); x.lineCap = 'round';
for (let w = 0; w < 3; w++) {
let px = m.x + (w - 1) * 5 * sc, py = m.top - 2;
for (let i = 0; i < 14; i++) {
const u = i / 14, ny = m.top - 2 - len * (i + 1) / 14;
const nx = m.x + (w - 1) * 5 * sc + Math.sin(T * 1.6 + u * 5 + w * 2.1) * 7 * sc * u;
x.strokeStyle = `rgba(235,230,255,${.13 * k * Math.sin(u * Math.PI) * (1 - u * .5)})`; x.lineWidth = (3 + u * 4) * sc;
x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); px = nx; py = ny;
}
}
x.restore();
}
function record(dt) {
const r = g.rec; if (!r.platter) return;
const p = r.platter, on = C.st.music;
if (on) recAng += dt * 3.5;
x.fillStyle = '#0b090c'; x.beginPath(); x.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU); x.fill();
x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = .7;
[.8, .6].forEach(f => { x.beginPath(); x.ellipse(p.x, p.y, p.rx * f, p.ry * f, 0, 0, TAU); x.stroke(); });
x.fillStyle = rgba(neonCol, .9); x.beginPath(); x.ellipse(p.x, p.y, p.rx * .3, p.ry * .3, 0, 0, TAU); x.fill();
x.fillStyle = '#fff'; x.beginPath(); x.arc(p.x + Math.cos(recAng) * p.rx * .2, p.y + Math.sin(recAng) * p.ry * .2, .8, 0, TAU); x.fill();
x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1; x.beginPath(); x.ellipse(p.x, p.y, p.rx * .7, p.ry * .7, 0, Math.PI * 1.1, Math.PI * 1.45); x.stroke();
x.strokeStyle = '#bfc3cc'; x.lineWidth = 1.4 * sc; x.beginPath(); x.moveTo(r.arm.x, r.arm.y); x.lineTo(p.x + p.rx * .55, p.y - (on ? 0 : 2 * sc)); x.stroke();
x.fillStyle = '#9aa0ab'; x.beginPath(); x.arc(r.arm.x, r.arm.y, 2.4 * sc, 0, TAU); x.fill();
x.save(); x.globalCompositeOperation = 'lighter'; glow(x, r.led.x, r.led.y, 7 * sc, on ? neonCol : [255, 80, 80], on ? .9 : .25); x.restore();
}
function vignette() {
const vg = x.createRadialGradient(W * .55, H * .45, Math.min(W, H) * .35, W * .55, H * .45, Math.max(W, H) * .8);
vg.addColorStop(0, 'rgba(4,2,10,0)'); vg.addColorStop(1, 'rgba(4,2,10,.5)');
x.fillStyle = vg; x.fillRect(0, 0, W, H);
}
/* ---------- events ---------- */
C.on('layout', resize);
C.on('beat', d => { beatK = d.s === 0 ? 1 : .6; });
/* ---------- the runtime owns the clock ---------- */
return { frame(dt) { if (!st) return; T += dt; beatK *= .86; surge = Math.max(0, surge - dt * .9); frame(dt); }, resize };
}
function Cat(C, api) {
const x = api.canvas.getContext('2d');
const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a), ease = t => (t = clamp(t, 0, 1)) * t * (3 - 2 * t);
const oc = new OffscreenCanvas(2, 2), ox = oc.getContext('2d');
const OW = 280, OH = 230, OX = 140, OY = 180;
const BODY = '#0d0a13', FAR = '#07050b';
let W = 0, H = 0, DPR = 1, s = 1, T = 0;
/* ---------- poses: facing right, paws on y = 0, in cat units (scaled by s) ---------- */
const base = {
hx: -18, hy: -29, rH: 12.5, sx: 14, sy: -31, rS: 11.5, arch: 0, belly: 3,
hdx: 28, hdy: -43, tilt: 0, front: 0, eyes: 1, ear: 1,
f1x: 16, f1y: 0, f2x: 12, f2y: 0, b1x: -15, b1y: 0, b2x: -20, b2y: 0, heel: 0,
tbx: -28, tby: -32, ta: -2.25, tc: 2.3, tw: .35, pitch: 0, tf: 0,
};
const P = {};
const def = (n, o, from = base) => (P[n] = { ...from, ...o });
def('stand', {});
def('walk', { hdx: 29, hdy: -42, tilt: .06, ta: -2.45, tc: 2.7, tw: .15 });
def('rise', { hx: -16, hy: -24, rH: 13.5, b1x: -10, b2x: -15, heel: .5, ta: -2.7, tc: 1.4 });
def('sitHalf', { hx: -14, hy: -18, rH: 14.5, sx: 11, sy: -31, hdx: 22, hdy: -46, f1x: 14, f2x: 10, b1x: -6, b2x: -11, heel: .8, tbx: -26, tby: -14, ta: 2.9, tc: -1, tw: .12 });
def('sit', { hx: -10, hy: -14, rH: 15.5, sx: 7, sy: -30.5, rS: 11, belly: 2, hdx: 9, hdy: -49, front: 1, f1x: 10, f2x: 5, b1x: 4, b2x: -2, heel: 1, tbx: -22, tby: -6, ta: 2.4, tc: -2.9, tw: .18 });
def('sitSide', { hdx: 14, hdy: -48, front: 0 }, P.sit);
def('watch', { hdx: 13, hdy: -49, tilt: -.22, tw: .3 }, P.sitSide);
def('loaf', { hx: -12, hy: -12.5, rH: 13.5, sx: 9, sy: -12.5, rS: 12.5, hdx: 21, hdy: -22, tilt: .04, eyes: .55, ear: .9, f1x: 14, f1y: -1, f2x: 10, f2y: -1, b1x: -6, b1y: -2, b2x: -10, b2y: -2, heel: 1, tbx: -21, tby: -5, ta: 2.6, tc: -3.6, tw: .05 });
def('curl', { hx: -7, hy: -12, rH: 13.5, sx: 6, sy: -11.5, rS: 12.5, arch: 4, belly: 1, hdx: 15, hdy: -10, tilt: .78, eyes: 0, ear: .72, f1x: 10, f2x: 7, b1x: 0, b2x: -3, tbx: -16, tby: -3, ta: 1.65, tc: -2.9, tw: 0, tf: 1 }, P.loaf);
def('crouch', { hx: -16, hy: -18, sx: 13, sy: -19, hdx: 26, hdy: -28, tilt: -.1, f1x: 19, f2x: 15, b1x: -11, b2x: -16, heel: .7, tbx: -28, tby: -18, ta: -3.05, tc: .5, tw: .04 });
def('launch', { hx: -21, hy: -32, sx: 19, sy: -36, hdx: 33, hdy: -46, tilt: -.1, f1x: 38, f1y: -21, f2x: 34, f2y: -17, b1x: -40, b1y: -15, b2x: -36, b2y: -11, heel: 0, tbx: -30, tby: -32, ta: -3.1, tc: .3, tw: 0 });
def('tuck', { hx: -17, hy: -30, sx: 15, sy: -32, hdx: 29, hdy: -43, f1x: 23, f1y: -14, f2x: 19, f2y: -12, b1x: -10, b1y: -12, b2x: -14, b2y: -11, heel: .3, ta: -2.9, tc: .8, tw: 0 });
def('reach', { hx: -17, hy: -32, sx: 15, sy: -30, hdx: 30, hdy: -40, tilt: .2, f1x: 28, f1y: -1, f2x: 24, f2y: 0, b1x: -9, b1y: -14, b2x: -13, b2y: -12, heel: .2, ta: -2.5, tc: 1, tw: 0 });
def('land', { hx: -17, hy: -25, sx: 14, sy: -20, hdx: 28, hdy: -30, tilt: .05, f1x: 20, f2x: 16, b1x: -14, b2x: -19, heel: .45, ta: -2.7, tc: 1.6 });
def('bow', { hx: -18, hy: -32, sx: 15, sy: -14, rS: 11, hdx: 30, hdy: -18, tilt: .05, eyes: .15, ear: .75, f1x: 37, f2x: 33, b1x: -16, b2x: -21, ta: -1.9, tc: 2.2, tw: .15 });
def('kick', { hx: -16, hy: -26, sx: 14, sy: -31, hdx: 28, hdy: -45, tilt: -.3, eyes: .3, b1x: -38, b1y: -4, heel: 0, ta: -2.9, tc: .8 });
def('knead', { hx: -18, hy: -26, sx: 14, sy: -24, hdx: 27, hdy: -34, eyes: .35, ear: .85, ta: -2.6, tc: 1.8, tw: .08 });
def('groom', { hdx: 15, hdy: -44, tilt: .55, eyes: .2 }, P.sitSide);
const cur = { ...P.watch }; let tgt = P.watch, tSpeed = 6;
const pose = (name, speed = 7) => { tgt = P[name]; tSpeed = speed; };
const poseObj = (o, speed) => { tgt = o; tSpeed = speed; };
const cat = {
x: 0, y: 0, stride: 22, plat: 'sill', dir: 1, faceTo: 1, turnT: 1, posture: 'sit', walking: false, walkW: 0, ph: 0,
air: false, airY: 0, pitch: 0, pitchT: 0, sleeping: false, kneading: false, happy: false, ready: false,
sq: 0, sqV: 0, earA: 0, earV: 0, earT: 0, earUntil: 0, blink: null, nextBlink: 3, nextEar: 5,
look: null, lookA: 0, lookW: 0, flick: 0, puff: 0, pupil: 0, yawn: 0, yawnT: 0, bob: 0, peek: 0, wig: 0, wake: 0,
};
cat.lookAt = (px, py, dur) => { cat.look = { x: px, y: py, until: T + dur }; };
const earKick = (v, dur = .3) => { cat.earT = v; cat.earUntil = T + dur; };
const slowBlink = () => { cat.blink = { t: 0, d: 1.5, slow: true }; };
const face = d => {
if (!d || d === cat.faceTo) return;
cat.faceTo = d;
if (cat.air) { cat.dir = d; return; }
cat.turnT = 0; shuffle();
};
/* ---------- platforms come from the app layout and the room ---------- */
let PS = null;
function plats() {
const g = C.geo, L = C.L; if (!g || !L.comp) return null;
const o = {
sill: { y: g.win.y1 - 2, x0: Math.max(g.win.x0 + 40, L.lane.right + 24), x1: g.win.x1 - 64 * s },
shelf: { y: g.shelf.y, x0: (g.shelf.bookEnd || g.shelf.x0) + 30 * s, x1: g.shelf.x1 - 46 * s },
desk: { y: g.deskY + 9 * s, x0: L.side.right + 40, x1: W - 92 * s },
comp: { y: L.send.bottom + 1, x0: L.comp.left + 50, x1: L.comp.right - 50 },
};
for (const k in o) o[k].ok = o[k].x1 - o[k].x0 > 30;
return o;
}
const LINKS = { shelf: ['desk'], desk: ['shelf', 'comp', 'sill'], comp: ['desk'], sill: ['desk'] };
const outside = (xx, toward = xx) => { const a = C.L.comp.left - 30 * s, b = C.L.comp.right + 30 * s; if (xx <= a || xx >= b) return xx; return Math.abs(toward - a) < Math.abs(toward - b) ? a : b; };
function ground(pl, xx) {
let y = PS[pl].y; const cu = C.geo?.cushion;
if (pl === 'shelf' && cu) { const u = (xx - cu.x) / (cu.w * .5); if (Math.abs(u) < 1) y -= cu.h * Math.cos(u * Math.PI / 2) ** 2; }
return y;
}
/* ---------- feet: a planted-paw walk, plus small settling steps ---------- */
const LEGS = ['b1', 'f1', 'b2', 'f2'], OFF = { b1: 0, f1: .25, b2: .5, f2: .75 }, DUTY = .62;
const feet = {}; LEGS.forEach(l => feet[l] = { x: 0, y: 0, st: null });
function gaitFoot(l) {
const q = (cat.ph + OFF[l]) % 1;
const S = cat.stride; if (q < DUTY) return [S / 2 - S * q / DUTY, 0];
const u = (q - DUTY) / (1 - DUTY);
return [-S / 2 + S * ease(u), -(l[0] === 'b' ? 4.2 : 5.2) * (S / 22) * Math.sin(Math.PI * u)];
}
function settle() {
let k = 0;
LEGS.slice().sort((a, b) => feet[a].y - feet[b].y).forEach(l => {
const f = feet[l];
if (Math.abs(f.x) > 1 || f.y < -.5) f.st = { t: -k++ * .08, d: .16, x0: f.x, y0: f.y, h: 3 };
});
}
function shuffle() { ['f1', 'b2', 'f2', 'b1'].forEach((l, k) => feet[l].st = { t: -k * .08, d: .15, x0: feet[l].x, y0: feet[l].y, h: 3.2 }); }
function updateFeet(dt) {
for (const l of LEGS) {
const f = feet[l];
if (cat.walking) { [f.x, f.y] = gaitFoot(l); f.st = null; continue; }
if (!f.st) continue;
f.st.t += dt; if (f.st.t < 0) continue;
const u = clamp(f.st.t / f.st.d, 0, 1), e = ease(u);
f.x = f.st.x0 * (1 - e); f.y = f.st.y0 * (1 - e) - f.st.h * Math.sin(Math.PI * u);
if (u >= 1) { f.st = null; f.x = 0; f.y = 0; }
}
}
const stopWalk = () => { if (cat.walking) { cat.walking = false; settle(); } };
/* ---------- actions ---------- */
let queue = [], act = null, lastUser = 0, typeStart = 0, attending = false, lastPawHint = 0, idleT = 0, nextIdle = 10, napUntil = 0;
const plan = (...list) => {
if (act && act.keep && act.keep()) { queue = list.flat(); return; }
if (act?.end) act.end();
queue = list.flat(); act = null; cat.happy = false;
};
function sitInit(a, name) { a.sp = cat.posture === 'sit'; a.pn = name; pose(a.sp ? name : 'sitHalf', a.sp ? 5 : 10); cat.posture = 'sit'; }
function sitStep(a) { if (!a.sp && a.t > .24) { a.sp = true; pose(a.pn, 6); } }
const A = {
walk: (tx, spd = 1) => ({
start() { this.tx = tx; this.v = 0; this.brisk = Math.abs(tx - cat.x) > 280 * s; cat.stride = this.brisk ? 29 : 22; this.rise = cat.posture === 'sit' ? .28 : 0; if (this.rise) pose('rise', 9); },
update(dt) {
const p = PS[cat.plat]; this.tx = clamp(this.tx, p.x0, p.x1);
if (this.rise > 0) { this.rise -= dt; return false; }
const d = this.tx - cat.x;
if (Math.abs(d) < 1) { stopWalk(); return true; }
const dir = Math.sign(d);
if (dir !== cat.dir || cat.turnT < .72) { face(dir); stopWalk(); return false; }
cat.posture = 'stand'; cat.walking = true; pose('walk', 6);
const vmax = (this.brisk ? 118 : 76) * s * spd, a = 240 * s;
this.v = Math.min(vmax, this.v + a * dt, Math.sqrt(2 * a * Math.abs(d)) + 10 * s);
const step = dir * Math.min(Math.abs(d), this.v * dt);
cat.x += step; cat.ph += Math.abs(step) / (s * cat.stride / DUTY);
return false;
},
end() { stopWalk(); },
}),
jump: (pl, tx) => ({
keep() { return this.ph >= 2; },
start() {
const p = PS[pl]; this.pl = pl; this.x1 = clamp(tx, p.x0, p.x1); this.t = 0; this.ph = 0; this.wig = rnd(.3, .6);
cat.jump = { from: cat.plat, to: pl, risen: false };
face(Math.sign(this.x1 - cat.x) || cat.dir);
cat.lookAt(this.x1, ground(pl, this.x1) - 12 * s, 1.4); earKick(.4, 1.2);
if (cat.posture === 'sit') pose('rise', 9);
cat.posture = 'stand';
},
update(dt) {
this.t += dt;
if (this.ph === 0) { if (cat.turnT < 1 || this.t < .12) return false; pose('crouch', 7); this.ph = 1; this.t = 0; return false; }
if (this.ph === 1) {
cat.wig = this.t > .32 ? Math.min(1, (this.t - .32) * 6) : 0;
if (this.t > .32 + this.wig) { cat.wig = 0; this.ph = 2; this.t = 0; pose('launch', 28); }
return false;
}
if (this.ph === 2) { if (this.t > .07) this.launch(); return false; }
if (this.ph === 3) {
const t = Math.min(this.t, this.T), u = t / this.T;
cat.x = this.x0 + this.vx * t; cat.y = this.y0 - this.vy * t + .5 * this.g * t * t; cat.airY = lerp(this.y0, this.y1, ease(u));
cat.pitchT = clamp(Math.atan2(this.g * t - this.vy, Math.abs(this.vx) + 90 * s) * .55, -.55, .55);
pose(u < .28 ? 'launch' : u < .62 ? 'tuck' : 'reach', 13);
if (u >= 1) this.land();
return false;
}
if (this.t > .12 && !this.up) { this.up = 1; pose('stand', 6); }
return this.t > .34;
},
launch() {
this.x0 = cat.x; this.y0 = cat.y; this.y1 = ground(this.pl, this.x1);
const g = 2600 * s, lift = 14 * s + Math.abs(this.x1 - this.x0) * .07, apex = Math.min(this.y0, this.y1) - lift;
const t1 = Math.sqrt(2 * (this.y0 - apex) / g), t2 = Math.sqrt(2 * (this.y1 - apex) / g);
this.g = g; this.T = t1 + t2; this.vy = g * t1; this.vx = (this.x1 - this.x0) / this.T;
this.ph = 3; this.t = 0; cat.air = true; cat.sqV = -1.1;
},
land() {
cat.x = this.x1; cat.y = this.y1; cat.air = false; cat.plat = this.pl; cat.pitchT = 0; cat.jump = null;
cat.sqV += 1.5; pose('land', 22); C.emit('catLand', this.pl); this.ph = 4; this.t = 0;
},
end() { if (cat.air) this.land(); cat.wig = 0; cat.pitchT = 0; },
}),
goto: (pl, xf) => ({ start() { queue.unshift(...route(pl, typeof xf === 'function' ? xf() : xf)); }, update() { return true; } }),
sit: (dur, mode = 'front') => ({
start() {
this.t = 0; this.f = rnd(4, 7);
if (mode === 'chat') { const L = C.L; face(L.lane.left + L.lane.width / 2 < cat.x ? -1 : 1); cat.lookAt(L.lane.left + L.lane.width * .6, L.comp.top - 120, dur); }
if (mode === 'music') { const g = C.geo; face(g.rec.x0 + 30 < cat.x ? -1 : 1); }
sitInit(this, mode === 'front' ? 'sit' : 'sitSide');
},
update(dt) {
this.t += dt; sitStep(this);
if (mode === 'chat' && this.t > .9 && !this.b) { this.b = 1; slowBlink(); }
if (this.t > this.f) {   // small fidgets while sitting a long time
this.f = this.t + rnd(5, 9); const r = Math.random();
if (r < .35) slowBlink(); else if (r < .7) earKick(rnd(-.5, .4), .25); else cat.flick = .6;
}
return this.t > dur;
},
}),
watch: dur => ({
start() { this.t = 0; this.n = 0; const g = C.geo; face(g && g.moon.x > cat.x ? 1 : -1); sitInit(this, 'watch'); },
update(dt) {
this.t += dt; sitStep(this);
if ((this.n -= dt) < 0) {   // eyes dart between raindrops and lit windows
this.n = rnd(1.1, 3.6); const gl = C.geo?.glass;
if (gl && Math.random() < .7) cat.lookAt(rnd(gl.x0, gl.x1), rnd(gl.y0, gl.y1), this.n); else cat.look = null;
if (Math.random() < .2) earKick(rnd(-.4, .4), .2);
}
return this.t > dur;
},
}),
groom: () => ({
start() { this.t = 0; sitInit(this, 'sitSide'); },
update(dt) {
const t = (this.t += dt); sitStep(this);
const g = P.groom, mouth = [g.hdx + 4, g.hdy + 9];
if (t < .5) return false;
if (t < 2.3) {   // paw to mouth, lick
const k = ease((t - .5) / .35);
poseObj({ ...g, f1x: lerp(P.sitSide.f1x, mouth[0], k), f1y: lerp(0, mouth[1], k), tilt: g.tilt + .1 * Math.sin(t * 13) * k, hdy: g.hdy + Math.sin(t * 13) * .6 * k }, 14);
} else if (t < 3.7) {   // wipe over the ear, twice
const w = ((t - 2.3) / .7) % 1, a = Math.sin(Math.PI * w);
poseObj({ ...g, tilt: .75, hdx: 16, hdy: -43, f1x: lerp(mouth[0], g.hdx - 3, w), f1y: lerp(mouth[1], g.hdy - 7, w) - a * 4 }, 16);
} else if (t < 4) pose('sitSide', 8);
return t > 4.3;
},
}),
paw: () => ({
start() {
this.t = 0; const b = C.L.send; this.bx = b.left + b.width * .4; this.by = b.top + b.height * .5;
face(this.bx > cat.x ? 1 : -1); sitInit(this, 'sitSide'); cat.lookAt(this.bx, this.by, 2.3); earKick(.45, 2);
},
update(dt) {
const t = (this.t += dt); sitStep(this);
const rx = (this.bx - cat.x) / (s * cat.dir), ry = (this.by - cat.y) / s, sp = P.sitSide;
if (t > .55 && t < 2) {
let k = t < .82 ? ease((t - .55) / .27) : t > 1.66 ? 1 - ease((t - 1.66) / .3) : 1, lift = 10;
if (t >= .82 && t < 1.18) lift = 10 * (1 - ease((t - .82) / .12));
else if (t >= 1.18 && t < 1.4) lift = 6 * Math.sin(Math.PI * (t - 1.18) / .22);
else if (t >= 1.4 && t < 1.66) lift = 0;
poseObj({ ...sp, f1x: lerp(sp.f1x, rx, k), f1y: lerp(0, ry - lift, k), hdx: sp.hdx + 2 * k, sy: sp.sy + 1.5 * k }, 30);
} else if (t >= 2) pose('sitSide', 8);
C.pawSend((t > .93 && t < 1.18) || (t > 1.38 && t < 1.66));
return t > 2.4;
},
end() { C.pawSend(false); },
}),
pet: () => ({
start() { this.t = 0; cat.happy = true; sitInit(this, 'sit'); heart(); earKick(-.35, 1.6); },
update(dt) {
this.t += dt; sitStep(this);
if (this.sp) poseObj({ ...P.sit, tilt: .2 + .12 * Math.sin(this.t * 2.6), hdx: P.sit.hdx + 1.5 * Math.sin(this.t * 2.6) }, 5);
if (this.t > 1.9) { cat.happy = false; return true; } return false;
},
end() { cat.happy = false; },
}),
sleep: (dur = 1e9) => ({
start() { this.t = 0; this.st = 0; this.z = 1.5; this.dur = dur; stopWalk(); },
update(dt) {
const t = (this.t += dt);
if (this.st === 0) { face(-cat.dir); this.st = 1; this.t = 0; }
else if (this.st === 1 && t > .7) { face(-cat.dir); this.st = 2; this.t = 0; }
else if (this.st === 2 && t > .65) { pose('knead', 5); cat.kneading = true; this.st = 3; this.t = 0; }
else if (this.st === 3 && t > 2.6) { cat.kneading = false; pose('loaf', 2.4); cat.posture = 'loaf'; this.st = 4; this.t = 0; }
else if (this.st === 4) {
poseObj({ ...P.loaf, eyes: Math.max(0, .55 - t * .14) }, 2.4);
if (t > 5) { cat.sleeping = true; pose('curl', .8); cat.posture = 'curl'; this.st = 5; this.t = 0; }
} else if (this.st === 5) {
if ((this.z -= dt) < 0) { this.z = rnd(2.4, 3.4); zzz(); }
if (Math.random() < dt * .08) earKick(rnd(-.5, .3), .15);
if (Math.random() < dt * .05) cat.flick = .5;
return t > this.dur;
}
return false;
},
end() { cat.kneading = false; cat.sleeping = false; },
}),
wake: () => ({
keep() { return true; },
start() { this.t = 0; cat.sleeping = false; cat.wake = 1; pose('loaf', 3); earKick(.3, .6); },
update(dt) {
const t = (this.t += dt);
if (t > .8 && !this.a) { this.a = 1; pose('bow', 3.2); cat.posture = 'stand'; }
if (t > 2 && !this.b) { this.b = 1; pose('kick', 3.5); cat.yawnT = 1; }
if (t > 2.9 && !this.c) { this.c = 1; cat.yawnT = 0; pose('stand', 5); }
if (t > 3.3) { cat.wake = 0; return true; }
return false;
},
end() { cat.yawnT = 0; cat.wake = 0; this.keep = () => false; },
}),
};
function path(a, b) {
const prev = { [a]: null }, q = [a];
while (q.length) { const n = q.shift(); if (n === b) break; for (const m of LINKS[n]) if (!(m in prev) && PS[m].ok) { prev[m] = n; q.push(m); } }
if (!(b in prev)) return null;
const out = []; for (let n = b; n; n = prev[n]) out.unshift(n); return out;
}
function route(pl, tx) {
if (!PS || !PS[pl].ok) return [];
const pth = path(cat.plat, pl); if (!pth) return [];
const out = []; let cx = cat.x;
for (let i = 1; i < pth.length; i++) {
const from = pth[i - 1], to = pth[i], A0 = PS[from], B = PS[to];
const nx = pth[i + 1] ? mid(pth[i + 1]) : tx;
let land, off;
if (from === 'comp') { off = cx; land = clamp(outside(clamp(cx, B.x0, B.x1), cx), B.x0, B.x1); }   // hop straight off the composer
else {
land = clamp(nx, B.x0, B.x1);
if (to === 'desk') land = clamp(outside(land, cx), B.x0, B.x1);
off = clamp(land - Math.sign(land - cx) * 28 * s, A0.x0, A0.x1);
if (from === 'desk') off = clamp(outside(off, land), A0.x0, A0.x1);
}
if (Math.abs(off - cx) > 3) out.push(A.walk(off));
out.push(A.jump(to, land)); cx = land;
}
if (Math.abs(clamp(tx, PS[pl].x0, PS[pl].x1) - cx) > 3) out.push(A.walk(tx));
return out;
}
const mid = pl => (PS[pl].x0 + PS[pl].x1) / 2;
const sendX = () => { const b = C.L.send; return b.left + b.width / 2 - 31 * s; };
const bedX = () => C.geo?.cushion ? C.geo.cushion.x : mid('shelf');
const deskSeat = () => C.L.comp.left - 46 * s;
const rouse = () => (cat.posture === 'loaf' || cat.posture === 'curl') ? [A.wake()] : [];
function nap(dur) { if (cat.sleeping) return; plan(rouse(), A.goto('shelf', bedX), A.sleep(dur)); }
function intro() {
plan(A.watch(2.6), A.goto('comp', sendX), A.paw(), A.sit(1.3, 'front'), A.goto('shelf', bedX), A.sleep(rnd(40, 70)));
}
/* ---------- reactions ---------- */
const awake = () => C.st.cat && C.st.motion !== 'calm' && cat.ready;
C.on('typing', () => {
const now = performance.now();
if (now - lastUser > 1800) typeStart = now;
lastUser = now;
if (!awake()) return;
earKick(.35, .25);
if (cat.sleeping || cat.posture === 'curl' || cat.posture === 'loaf') {
cat.peek = 1.6;   // one eye opens; a longer burst of typing wakes it up
if (now - typeStart > 2600 && !attending) { attending = true; plan(A.wake(), A.goto('desk', deskSeat), A.sit(1e9, 'front')); }
return;
}
if (!attending) { attending = true; plan(A.goto('desk', deskSeat), A.sit(1e9, 'front')); }
});
C.on('sent', () => {
lastUser = performance.now(); attending = false; cat.flick = 1;
if (!awake()) return;
if (cat.sleeping) { earKick(.5, .3); cat.peek = 1.2; return; }
earKick(.5, 1);
plan(A.sit(1, 'chat'), A.goto('sill', () => mid('sill')), A.watch(1e9));
});
C.on('done', () => {
cat.flick = 1;
if (!awake() || cat.sleeping) return;
earKick(.4, .5);
if (cat.plat === 'sill' && !cat.air && !attending) plan(A.sit(2.6, 'chat'), A.watch(rnd(10, 20)));
});
C.on('model', () => {   // the neon sign flickers: a small startle
if (!awake()) return;
earKick(-.8, .7);
if (cat.sleeping) return;
cat.puff = 1; const g = C.geo; if (g) cat.lookAt(g.neon.x, g.neon.y, 1.3);
});
C.on('effort', e => {
if (!awake() || cat.sleeping) return;
const g = C.geo; if (g) cat.lookAt(g.bulb.x, g.bulb.y, 1.2);
if (e === 'max') { cat.pupil = 1; earKick(.5, 1); }
if (e === 'low' && !cat.walking && !cat.air) { cat.yawnT = 1; setTimeout(() => cat.yawnT = 0, 900); }
});
C.on('beat', d => { if (C.st.music && cat.posture === 'sit' && !cat.sleeping) { cat.bob = 1; if (d.s === 0 && Math.random() < .3) earKick(rnd(-.3, .3), .15); } });
C.on('music', on => { if (on && awake() && !cat.sleeping) { const g = C.geo; earKick(.5, .6); if (g) cat.lookAt(g.rec.x0 + 40, g.rec.top, 1.5); } });
C.on('click', p => {
if (!C.st.cat || !cat.ready) return;
if (Math.abs(p.x - cat.x) < 40 * s && p.y < cat.y + 6 && p.y > cat.y - 70 * s) {
if (cat.sleeping) { heart(); earKick(-.4, .3); cat.peek = 1; return; }
if (cat.air) return;
const rest = queue; plan(A.pet(), rest);
}
});
C.on('cat', on => { if (on) { place(); intro(); } });
C.on('motion', m => { if (m === 'calm') nap(); });
C.catPlay = name => ({
groom: () => plan(A.groom(), A.sit(3, 'front')), sleep: () => nap(), wake: () => plan(rouse(), A.sit(3, 'front')), paw: () => plan(rouse(), A.goto('comp', sendX), A.paw(), A.sit(1, 'front')),
sill: () => plan(rouse(), A.goto('sill', () => mid('sill')), A.watch(20)), desk: () => plan(rouse(), A.goto('desk', deskSeat), A.sit(20, 'front')),
intro,
})[name]?.();
/* idle life */
function director(dt) {
if (!act && queue.length) { act = queue.shift(); act.start(); }
if (act) {
if (act.update(dt)) { act.end?.(); act = null; } else return;
if (queue.length) return;
}
const now = performance.now();
if (attending && now - lastUser > 15000) { attending = false; nap(); return; }
if (attending && now - lastUser > 2600 && now - lastPawHint > 60000 && C.st.draft) {
lastPawHint = now;
plan(A.goto('comp', sendX), A.paw(), A.sit(1, 'front'), A.goto('desk', deskSeat), A.sit(1e9, 'front'));
return;
}
const energy = C.st.catEnergy ?? .5;
if ((idleT += dt) < nextIdle) return;
idleT = 0; nextIdle = lerp(24, 7, energy) * rnd(.7, 1.3);
if (C.st.motion === 'calm' || now - lastUser > 90000) { nap(); return; }
const r = Math.random();
if (r < .15 + (1 - energy) * .2) return nap(rnd(30, 60));
if (C.st.music && r < .45) return plan(rouse(), A.goto('desk', () => outside(C.geo.rec.x0 + C.geo.rec.w + 26 * s)), A.sit(rnd(10, 18), 'music'));
if (r < .62) return plan(rouse(), A.goto('sill', () => rnd(PS.sill.x0, PS.sill.x1)), A.watch(rnd(12, 24)));
if (r < .82) return plan(rouse(), A.goto('desk', deskSeat), A.sit(.6, 'side'), A.groom(), A.sit(rnd(4, 8), 'front'));
plan(rouse(), A.goto('desk', () => outside(rnd(PS.desk.x0, PS.desk.x1))), A.sit(rnd(6, 10), 'front'));
}
/* ---------- particles ---------- */
const parts = [];
const headPos = () => ({ x: cat.x + cur.hdx * s * cat.dir, y: cat.y + cur.hdy * s });
function zzz() { const h = headPos(); parts.push({ k: 'z', x: h.x + 6 * s * cat.dir, y: h.y - 10 * s, vx: 5 * cat.dir, vy: -11, life: 3, t: 0, size: rnd(3.2, 4.4) * s, rot: rnd(-.25, .1) }); }
function heart() { const h = headPos(); parts.push({ k: 'h', x: h.x + rnd(-4, 4) * s, y: h.y - 16 * s, vx: rnd(-4, 4), vy: -22, life: 1.5, t: 0, size: 5 * s }); }
/* ---------- rig ---------- */
const TN = 12, TSEG = 4.2, tl = { p: null, q: null };
function rig(dt) {
const r = { ...cur };
const w = cat.walkW, ph = cat.ph;
if (w > .01) {
const hb = -1.1 * Math.cos(TAU * 2 * (ph - .31)), sb = -1.1 * Math.cos(TAU * 2 * (ph - .56));
r.hy += hb * w; r.sy += sb * w; r.tby += hb * w;
r.arch += .9 * Math.sin(TAU * 2 * (ph - .1)) * w;
r.scap = (.9 + .9 * Math.cos(TAU * (ph - .06))) * w;
r.pelv = (1.3 + 1.3 * Math.cos(TAU * (ph - .31))) * w;
r.hdy -= sb * .85 * w; r.hdx += .5 * Math.sin(TAU * 2 * ph) * w;
}
for (const l of LEGS) { r[l + 'x'] += feet[l].x; r[l + 'y'] += feet[l].y; }
if (cat.wig) { const k = Math.sin(T * 26) * cat.wig; r.hx += k * 1.6; r.hy += Math.abs(k) * .8; r.tbx += k * 1.6; r.tw = 0; }
if (cat.kneading) {
const k = T * 7.5;
r.f1y -= 3.4 * Math.max(0, Math.sin(k)); r.f2y -= 3.4 * Math.max(0, Math.sin(k + Math.PI));
r.f1x += 1.2 * Math.sin(k); r.f2x += 1.2 * Math.sin(k + Math.PI); r.sy += .5 * Math.sin(k * 2);
}
if (cat.posture === 'curl' || cat.posture === 'loaf') {   // slow breathing
const b = Math.sin(T * 1.45);
r.rH *= 1 + .03 * b; r.rS *= 1 + .025 * b; r.hy -= b * .35;
if (cat.peek > 0) { const k = Math.min(1, cat.peek * 2); r.hdy -= 5 * k * (r.tilt > .5 ? 1 : .4); r.tilt *= 1 - .6 * k; r.eyes = Math.max(r.eyes, .45 * k); }
}
r.tilt = lerp(r.tilt, cat.lookA, cat.lookW * (r.front > .5 ? .35 : 1));
if (cat.yawn > .01) { r.tilt -= .45 * cat.yawn; r.eyes *= 1 - cat.yawn; }
if (cat.bob > .01) r.tilt += .07 * cat.bob;
r.pitch += cat.pitch;
r.earRot = cat.earA + (cat.sleeping ? -.25 : 0);
r.eyes *= 1 - blinkAmt();
r.puff = cat.puff;
return r;
}
function blinkAmt() {
const b = cat.blink; if (!b) return 0;
const u = b.t / b.d;
if (!b.slow) return Math.sin(Math.PI * clamp(u, 0, 1));
return u < .35 ? ease(u / .35) * .92 : u < .6 ? .92 : .92 * (1 - ease((u - .6) / .4));
}
const toW = (r, SX, SY, lx, ly) => {
const c = Math.cos(r.pitch), si = Math.sin(r.pitch), yy = ly + 26;
return [cat.x + (lx * c - yy * si) * SX, cat.y + (lx * si + yy * c - 26) * SY];
};
function tailStep(r, dt, SX, SY) {
const rest = []; let px = r.tbx, py = r.tby, a = r.ta;
rest.push(toW(r, SX, SY, px, py));
for (let i = 0; i < TN; i++) {
const u = (i + 1) / TN;
a += r.tc * 2 * u / TN + (r.tw * Math.sin(T * 1.9 - i * .5) + cat.flick * Math.sin(T * 15 - i * .9)) * .3 * u;
px += Math.cos(a) * TSEG; py += Math.sin(a) * TSEG; rest.push(toW(r, SX, SY, px, py));
}
if (!tl.p) { tl.p = rest.map(p => p.slice()); tl.q = rest.map(p => p.slice()); }
const P0 = tl.p, Q = tl.q, damp = Math.pow(.86, dt * 60), grav = 300 * s * dt * dt;
P0[0] = rest[0].slice(); Q[0] = rest[0].slice();
for (let i = 1; i <= TN; i++) {
const p = P0[i], q = Q[i], vx = (p[0] - q[0]) * damp, vy = (p[1] - q[1]) * damp;
q[0] = p[0]; q[1] = p[1]; p[0] += vx; p[1] += vy + grav;
}
const floor = cat.air ? 1e9 : cat.y - 1.4 * s;
for (let it = 0; it < 2; it++) for (let i = 1; i <= TN; i++) {
const u = i / TN, k = 1 - Math.pow(1 - lerp(.36, .1, u), dt * 30), A0 = P0[i - 1], p = P0[i];
const rx = rest[i][0] - rest[i - 1][0], ry = rest[i][1] - rest[i - 1][1], L = Math.hypot(rx, ry);
p[0] += (A0[0] + rx - p[0]) * k; p[1] += (A0[1] + ry - p[1]) * k;
const dx = p[0] - A0[0], dy = p[1] - A0[1], d = Math.hypot(dx, dy) || 1;
p[0] = A0[0] + dx / d * L; p[1] = A0[1] + dy / d * L;
if (p[1] > floor) p[1] = floor;
}
r.tail = P0.map(([wx, wy]) => [(wx - cat.x) / SX, (wy - cat.y) / SY]);
}
/* ---------- drawing ---------- */
function ik(ax, ay, tx, ty, l1, l2, bend) {
let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || .001;
const mx = l1 + l2 - .01; if (d > mx) { tx = ax + dx / d * mx; ty = ay + dy / d * mx; d = mx; }
const an = Math.atan2(dy, dx), al = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
return [ax + Math.cos(an + bend * al) * l1, ay + Math.sin(an + bend * al) * l1, tx, ty];
}
const seg = (c, a, b, d, e, w) => { c.lineWidth = w; c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); };
function frontLeg(c, r, px, py, far) {
const ax = r.sx + 3 + far * 1.5, ay = r.sy + r.rS * .5 - far;
const [jx, jy, ex, ey] = ik(ax, ay, px, py - 1.7, 12.5, 12.5, 1);
seg(c, ax, ay, jx, jy, 6.8); seg(c, jx, jy, ex, ey, 5);
c.beginPath(); c.ellipse(ex + 1.1, ey + .3, 3.3, 2, 0, 0, TAU); c.fill();
}
function hindLeg(c, r, px, py, far) {
const ax = r.hx + 2 + far * 1.5, ay = r.hy + r.rH * .3 - far, fx = px, fy = py - 1.5;
const rot = (Math.atan2(fy - ay, fx - ax) - Math.PI / 2) * .85, co = Math.cos(rot), si = Math.sin(rot);
const o0 = [-4.5 * co + 9.5 * si, -4.5 * si - 9.5 * co], o1 = [-10.5, -2.4];
const hx = fx + lerp(o0[0], o1[0], r.heel), hy = fy + lerp(o0[1], o1[1], r.heel);
const [kx, ky, hkx, hky] = ik(ax, ay, hx, hy, 11, 10.5, -1);
seg(c, ax, ay, kx, ky, 9); seg(c, kx, ky, hkx, hky, 5.6); seg(c, hkx, hky, fx, fy, 4.4);
c.beginPath(); c.ellipse(fx + 1.2, fy + .4, 3.5, 2, 0, 0, TAU); c.fill();
}
function body(c, r) {
c.beginPath(); c.arc(r.hx, r.hy, r.rH, 0, TAU); c.fill();
c.beginPath(); c.arc(r.sx, r.sy, r.rS, 0, TAU); c.fill();
const ax = r.sx - r.hx, ay = r.sy - r.hy, L = Math.hypot(ax, ay) || 1, nx = ay / L, ny = -ax / L;
const mx = (r.hx + r.sx) / 2, my = (r.hy + r.sy) / 2, rm = (r.rH + r.rS) / 2, top = rm - 1.5 + r.arch;
c.beginPath(); c.moveTo(r.hx + nx * r.rH, r.hy + ny * r.rH);
c.quadraticCurveTo(mx + nx * top, my + ny * top, r.sx + nx * r.rS, r.sy + ny * r.rS);
c.lineTo(r.sx - nx * r.rS, r.sy - ny * r.rS);
c.quadraticCurveTo(mx - nx * (rm + r.belly), my - ny * (rm + r.belly), r.hx - nx * r.rH, r.hy - ny * r.rH);
c.closePath(); c.fill();
if (r.scap) { c.beginPath(); c.arc(r.sx - 3, r.sy - r.rS + 5 - r.scap, 5.5, 0, TAU); c.fill(); }
if (r.pelv) { c.beginPath(); c.arc(r.hx + 3, r.hy - r.rH + 5 - r.pelv, 6, 0, TAU); c.fill(); }
}
function neck(c, r) {
const hx = r.hdx, hy = r.hdy;
c.beginPath();
c.moveTo(r.sx - r.rS * .55, r.sy - r.rS * .8);
c.quadraticCurveTo(lerp(r.sx, hx, .55) - 2.5, lerp(r.sy, hy, .55) - 2, hx - 7.5, hy - 1.5);
c.lineTo(hx + 3, hy + 7.5);
c.quadraticCurveTo(lerp(r.sx, hx, .5) + 5, lerp(r.sy, hy, .5) + 5, r.sx + r.rS * .95, r.sy + r.rS * .15);
c.closePath(); c.fill();
}
function ear(c, a, b, tx, ty, e, rot) {
const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, vx = (tx - mx) * e, vy = (ty - my) * e, co = Math.cos(rot), si = Math.sin(rot);
const px = mx + vx * co - vy * si, py = my + vx * si + vy * co;
c.beginPath(); c.moveTo(a[0], a[1]);
c.quadraticCurveTo(lerp(a[0], px, .55) - .7, lerp(a[1], py, .55), px, py);
c.quadraticCurveTo(lerp(b[0], px, .5) + .5, lerp(b[1], py, .5), b[0], b[1]);
c.closePath(); c.fill();
}
function headFrame(c, r) { c.translate(r.hdx, r.hdy); c.rotate(r.tilt); c.scale(r.hsx || 1, 1); }
function head(c, r) {
c.save(); headFrame(c, r);
const e = r.ear, er = r.earRot;
if (r.front > .5) {
c.beginPath(); c.ellipse(0, -1, 11.6, 11, 0, 0, TAU); c.fill();
c.beginPath(); c.ellipse(0, 3.6, 13.6, 8.8, 0, 0, TAU); c.fill();
ear(c, [-12.2, -2], [-3.5, -10.2], -10.8, -18, e, er * .7);
ear(c, [12.2, -2], [3.5, -10.2], 10.8, -18, e, -er * .7);
} else {
c.beginPath();
c.moveTo(-10.5, 3);
c.bezierCurveTo(-11.6, -6, -6, -11, 0, -10.8);
c.bezierCurveTo(4.5, -10.6, 7.5, -7.5, 9.4, -4.4);
c.bezierCurveTo(11, -2.4, 13.2, -.8, 14, 1.4);
c.bezierCurveTo(14.4, 2.9, 13.5, 4.3, 12.2, 4.8);
c.bezierCurveTo(11.6, 6.6, 10.4, 7.9, 8.5, 8.3);
c.bezierCurveTo(4, 10.3, -4, 10.4, -8.4, 7.4);
c.closePath(); c.fill();
ear(c, [-8.5, -6.2], [-2, -10.4], -6.4, -19.5, e, er * .8);
ear(c, [-3, -10.4], [4.6, -8.4], .4, -20.2, e, er);
}
c.restore();
}
function tail(c, r) {
const t = r.tail; if (!t) return;
const pf = 1 + r.puff * 1.1;
for (let i = 0; i < TN; i++) seg(c, t[i][0], t[i][1], t[i + 1][0], t[i + 1][1], lerp(6.6, 3.4, (i + 1) / TN) * pf);
}
function shape(c, r, col, far) {
c.lineCap = c.lineJoin = 'round';
c.fillStyle = c.strokeStyle = col;
if (r.tf < .5) tail(c, r);
c.save(); c.translate(0, -26); c.rotate(r.pitch); c.translate(0, 26);
c.fillStyle = c.strokeStyle = far;
hindLeg(c, r, r.b2x, r.b2y, 1); frontLeg(c, r, r.f2x, r.f2y, 1);
c.fillStyle = c.strokeStyle = col;
body(c, r); neck(c, r);
hindLeg(c, r, r.b1x, r.b1y, 0); frontLeg(c, r, r.f1x, r.f1y, 0);
head(c, r);
c.restore();
if (r.tf >= .5) tail(c, r);   // curled up: the tail wraps around the front
}
function rim(r, SX, SY, col, a, dx, dy) {
ox.setTransform(DPR, 0, 0, DPR, 0, 0); ox.globalCompositeOperation = 'source-over'; ox.clearRect(0, 0, OW, OH);
const draw = (ofx, ofy, fill) => { ox.save(); ox.translate(OX + ofx, OY + ofy); ox.scale(SX, SY); shape(ox, r, fill, fill); ox.restore(); };
draw(0, 0, col);
ox.globalCompositeOperation = 'destination-out'; draw(dx * s, dy * s, '#000');
ox.globalCompositeOperation = 'destination-in';
const gr = ox.createLinearGradient(0, OY - 60 * s, 0, OY); gr.addColorStop(0, '#000'); gr.addColorStop(1, 'rgba(0,0,0,.28)');
ox.fillStyle = gr; ox.fillRect(0, 0, OW, OH);
const bx = cat.x - OX, by = cat.y - OY;
x.save(); x.globalAlpha = a; x.drawImage(oc, 0, 0, oc.width, oc.height, bx, by, OW, OH);
x.globalCompositeOperation = 'lighter'; x.globalAlpha = a * .7; x.filter = 'blur(2.5px)';
x.drawImage(oc, 0, 0, oc.width, oc.height, bx, by, OW, OH); x.restore();
}
function eyes(r, SX, SY) {
x.save(); x.translate(cat.x, cat.y); x.scale(SX, SY);
x.translate(0, -26); x.rotate(r.pitch); x.translate(0, 26); headFrame(x, r);
const front = r.front > .5, open = r.eyes, pts = front ? [[-5, -.6], [5, -.6]] : [[6.6, -2.8]];
let px = 0, py = 0;
const lt = cat.look && T < cat.look.until ? cat.look : (C.caret && performance.now() - C.caret.t < 4000) ? C.caret : front ? C.mouse : null;
if (lt) { const h = headPos(); px = clamp((lt.x - h.x) / 240, -1, 1) * (front ? 1.1 * cat.dir : .6); py = clamp((lt.y - h.y) / 240, -1, 1) * .8; }
const pw = .8 + .9 * cat.pupil + (cat.plat === 'desk' && cat.x > C.L.comp.right ? 0 : .25);
for (const [ex, ey] of pts) {
const ew = front ? 2.9 : 2.4;
if (cat.happy) { x.strokeStyle = 'rgba(235,225,255,.6)'; x.lineWidth = 1; x.beginPath(); x.arc(ex, ey + 1.5, 2.6, 1.15 * Math.PI, 1.85 * Math.PI); x.stroke(); continue; }
if (open < .12) { x.strokeStyle = 'rgba(225,215,255,.3)'; x.lineWidth = .9; x.beginPath(); x.moveTo(ex - ew, ey); x.quadraticCurveTo(ex, ey + 1.6, ex + ew, ey - .3); x.stroke(); continue; }
x.save(); x.globalCompositeOperation = 'lighter';
const gg = x.createRadialGradient(ex, ey, 0, ex, ey, 7); gg.addColorStop(0, `rgba(210,240,110,${.24 * open})`); gg.addColorStop(1, 'rgba(210,240,110,0)');
x.fillStyle = gg; x.fillRect(ex - 7, ey - 7, 14, 14); x.restore();
const ig = x.createRadialGradient(ex, ey - .5, .3, ex, ey, 2.9); ig.addColorStop(0, '#f6fb9a'); ig.addColorStop(1, '#a3cc36');
x.fillStyle = ig; x.beginPath(); x.moveTo(ex - ew, ey + .2);
x.quadraticCurveTo(ex, ey - 3.3 * open, ex + ew, ey - .3); x.quadraticCurveTo(ex, ey + 2.8 * open, ex - ew, ey + .2); x.fill();
x.fillStyle = '#100b07'; x.beginPath(); x.ellipse(ex + px, ey + py * open, Math.min(pw, ew * .8), 1.9 * open, 0, 0, TAU); x.fill();
x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(ex - .9, ey - .8 * open, .5, 0, TAU); x.fill();
if (open < .7) { x.fillStyle = BODY; x.fillRect(ex - ew - .5, ey - 3.6, ew * 2 + 1, 3.6 * (1 - open) * .9); }
}
if (front) {
x.fillStyle = 'rgba(160,95,125,.55)'; x.beginPath(); x.moveTo(-1.4, 3); x.lineTo(1.4, 3); x.lineTo(0, 4.4); x.closePath(); x.fill();
x.fillStyle = 'rgba(120,70,100,.3)';
[-1, 1].forEach(d => ear(x, [d * 10.6, -3.4], [d * 5.2, -8.9], d * 10.1, -15.6, r.ear, -d * r.earRot * .7));
}
if (cat.yawn > .05) {
const y = cat.yawn; x.fillStyle = '#4a1a2d';
if (front) { x.beginPath(); x.ellipse(0, 6.8, 2.4 * y, 3.4 * y, 0, 0, TAU); x.fill(); }
else { x.beginPath(); x.moveTo(7.5, 4.6); x.lineTo(13.2, 4.4); x.lineTo(9.5, 4.8 + 5.5 * y); x.closePath(); x.fill(); x.fillStyle = '#b7587a'; x.beginPath(); x.ellipse(9.8, 4.9 + 3.6 * y, 1.8 * y, .9 * y, .3, 0, TAU); x.fill(); }
}
x.strokeStyle = `rgba(230,225,245,${.22 * clamp(1.6 - r.tilt * 1.6, 0, 1)})`; x.lineWidth = .45;
const wh = front ? [[-4.5, 4.5, -1], [4.5, 4.5, 1]] : [[10, 4, 1]];
for (const [wx, wy, d] of wh) for (const k of [-3, .5, 4]) { x.beginPath(); x.moveTo(wx, wy); x.quadraticCurveTo(wx + d * 8, wy + k * .4, wx + d * 15, wy + k); x.stroke(); }
x.restore();
}
function layer() {
const j = cat.jump;
if (!j || !cat.air) return cat.plat === 'comp';
if (j.from !== 'comp' && j.to !== 'comp') return false;
if (cat.y < C.L.comp.top) j.risen = true;   // switch layers only while the cat is clear of the glass
return j.risen ? j.to === 'comp' : j.from === 'comp';
}
function render(dt) {
x.clearRect(0, 0, W, H);
if (!C.st.cat || !cat.ready) return;
const r = rig(dt);
const turnK = cat.turnT < 1 ? Math.abs(Math.cos(Math.PI * cat.turnT)) : 1, tk = Math.max(.3, turnK);
if (turnK < .8) r.front = 1;
r.hsx = 1 / tk;
const SX = s * cat.dir * tk * (1 + cat.sq * .5), SY = s * (1 - cat.sq);
tailStep(r, dt, SX, SY);
const gy = cat.air ? cat.airY : cat.y, ga = cat.air ? clamp(.5 - (cat.airY - cat.y) / (200 * s), .12, .45) : .5;
x.save(); x.translate(cat.x, gy + 1); x.scale(1, .16);
const sg = x.createRadialGradient(0, 0, 0, 0, 0, 34 * s); sg.addColorStop(0, `rgba(0,0,0,${ga})`); sg.addColorStop(1, 'rgba(0,0,0,0)');
x.fillStyle = sg; x.beginPath(); x.arc(0, 0, 34 * s, 0, TAU); x.fill(); x.restore();
x.save(); x.translate(cat.x, cat.y); x.scale(SX, SY); shape(x, r, BODY, FAR);
if (r.tf >= .5 && r.tail) {   // a tail lying in front of the body needs its own thin edge of light
x.lineCap = 'round';
const tt = r.tail, n = tt.length - 1, line = (dy, col, k) => { x.strokeStyle = col; for (let i = 3; i < n; i++) { x.lineWidth = lerp(6.6, 3.4, (i + 1) / TN) * k; x.beginPath(); x.moveTo(tt[i][0], tt[i][1] + dy); x.lineTo(tt[i + 1][0], tt[i + 1][1] + dy); x.stroke(); } };
line(-.9, 'rgba(175,185,255,.32)', .9); line(.3, BODY, 1);
}
x.restore();
const g = C.geo, accent = C.st.accent;
const nearNeon = g ? clamp(1.15 - Math.abs(cat.x - g.neon.x) / 900, .35, 1) : .6;
const warm = g && cat.x > g.rm.x0 - 40 && cat.y > g.deskY - 30;
rim(r, SX, SY, accent, .85 * nearNeon, 1.6, 1.1);
rim(r, SX, SY, warm ? '#ffc382' : '#a9bdff', warm ? .8 : .78, -1.6, 1.1);
eyes(r, SX, SY);
for (const p of parts) {
const a = Math.sin(Math.PI * Math.min(1, p.t / p.life));
if (p.k === 'z') {
const z = p.size * (1 + p.t * .15);
x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.strokeStyle = `rgba(220,212,255,${.55 * a})`; x.lineWidth = 1.2; x.lineCap = x.lineJoin = 'round';
x.beginPath(); x.moveTo(-z, -z); x.lineTo(z, -z); x.lineTo(-z, z); x.lineTo(z, z); x.stroke(); x.restore();
} else {
x.fillStyle = accent; x.globalAlpha = a * .85; const hs = p.size, hx = p.x, hy = p.y;
x.beginPath(); x.moveTo(hx, hy + hs * .9); x.bezierCurveTo(hx - hs * 1.4, hy - hs * .1, hx - hs * .7, hy - hs * 1.1, hx, hy - hs * .35);
x.bezierCurveTo(hx + hs * .7, hy - hs * 1.1, hx + hs * 1.4, hy - hs * .1, hx, hy + hs * .9); x.fill(); x.globalAlpha = 1;
}
}
}
function update(dt) {
PS = plats(); if (!PS) return;
if (!cat.ready) { place(); cat.ready = true; intro(); }
if (C.st.cat) director(dt);
if (!cat.air && PS[cat.plat]) { cat.x = clamp(cat.x, PS[cat.plat].x0, PS[cat.plat].x1); cat.y = ground(cat.plat, cat.x); }
const k = 1 - Math.exp(-dt * tSpeed);
for (const key in tgt) cur[key] += (tgt[key] - cur[key]) * k;
if (cat.turnT < 1) { cat.turnT = Math.min(1, cat.turnT + dt / .42); if (cat.turnT >= .5) cat.dir = cat.faceTo; }
cat.walkW += ((cat.walking ? 1 : 0) - cat.walkW) * (1 - Math.exp(-dt * 12));
updateFeet(dt);
cat.pitch += (cat.pitchT - cat.pitch) * (1 - Math.exp(-dt * 14));
cat.sqV += (-150 * cat.sq - 13 * cat.sqV) * dt; cat.sq += cat.sqV * dt;
if (T > cat.earUntil) cat.earT = 0;
cat.earV += (110 * (cat.earT - cat.earA) - 12 * cat.earV) * dt; cat.earA += cat.earV * dt;
if ((cat.nextEar -= dt) < 0) { cat.nextEar = rnd(4, 10); if (!cat.earUntil || T > cat.earUntil) earKick(rnd(-.45, .35), .14); }
const lk = cat.look && T < cat.look.until ? cat.look : null;
if (lk) {
const hx = cat.x + cur.hdx * s * cat.dir, hy = cat.y + cur.hdy * s, dx = (lk.x - hx) * cat.dir, dy = lk.y - hy;
if (dx > -12 * s) cat.lookA += (clamp(Math.atan2(dy, Math.max(dx, 10 * s)), -.6, .55) - cat.lookA) * (1 - Math.exp(-dt * 9));
}
cat.lookW += ((lk && !cat.walking && !cat.air && cat.posture !== 'curl' ? 1 : 0) - cat.lookW) * (1 - Math.exp(-dt * 6));
if (cat.blink) { cat.blink.t += dt; if (cat.blink.t > cat.blink.d) cat.blink = null; }
if ((cat.nextBlink -= dt) < 0) { cat.nextBlink = rnd(2.5, 6); if (!cat.blink) cat.blink = { t: 0, d: .17 }; }
cat.yawn += (cat.yawnT - cat.yawn) * (1 - Math.exp(-dt * (cat.yawnT ? 4 : 7)));
cat.flick = Math.max(0, cat.flick - dt * 1.6); cat.puff = Math.max(0, cat.puff - dt * .7);
cat.pupil = Math.max(0, cat.pupil - dt * .35); cat.bob = Math.max(0, cat.bob - dt * 5); cat.peek = Math.max(0, cat.peek - dt);
for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life) parts.splice(i, 1); }
}
C.cat = cat;
function place() {
PS = plats(); if (!PS) return;
const start = PS.sill.ok ? 'sill' : 'desk';
cat.plat = start; cat.x = lerp(PS[start].x0, PS[start].x1, .35); cat.y = PS[start].y; cat.dir = cat.faceTo = 1; cat.turnT = 1;
tl.p = null;
}
function resize() {
DPR = api.dpr || 1; W = C.L.W; H = C.L.H; s = clamp(H / 900, .85, 1.2);
oc.width = Math.round(OW * DPR); oc.height = Math.round(OH * DPR);
tl.p = null;
}
C.on('layout', resize);
resize();
function behindGlass() {
if (layer()) return;
const c = C.L.comp, r = 18;
x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = .84; x.beginPath();
x.moveTo(c.left + 6 + r, c.top + 6); x.arcTo(c.right - 6, c.top + 6, c.right - 6, c.bottom - 6, r); x.arcTo(c.right - 6, c.bottom - 6, c.left + 6, c.bottom - 6, r);
x.arcTo(c.left + 6, c.bottom - 6, c.left + 6, c.top + 6, r); x.arcTo(c.left + 6, c.top + 6, c.right - 6, c.top + 6, r); x.closePath(); x.fill(); x.restore();
}
return { frame(dt) { dt = Math.min(.05, dt); T += dt; update(dt); render(dt); behindGlass(); }, resize };
}

  /* ---------- hub: shared state, layout from the safe zones, UI facts from the host ---------- */
  const num = (v, d) => typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : d;
  const P = api.params || {};
  const C = {
    L: {}, geo: null, mouse: { x: -9999, y: -9999 }, caret: null, ev: {},
    on(n, f) { (this.ev[n] || (this.ev[n] = [])).push(f); },
    emit(n, d) { (this.ev[n] || []).forEach(f => f(d)); },
    st: { cat: true, catEnergy: num(P.catEnergy, .5), rain: num(P.rain, .7), rays: num(P.rays, .8), lights: P.lights !== false, lamp: .8,
      motion: api.motion === 'calm' ? 'calm' : 'live', working: false, music: false, draft: false, accent: api.palette.accent || '#ff6fb1' },
  };
  C.pawSend = on => api.signal('paw', on);
  const rect = (x0, y0, w, h) => ({ left: x0, top: y0, right: x0 + w, bottom: y0 + h, width: w, height: h });
  let key = '', sentAt = 0;
  function measure(force) {
    const W = api.width, H = api.height, Z = {};
    (api.zones || []).forEach(z => { if (!Z[z.kind]) Z[z.kind] = z; });
    const R = z => z && rect(z.x, z.y, z.w, z.h);
    const side = R(Z.sidebar) || rect(0, 0, 0, H), top = R(Z.topbar) || rect(side.right, 0, W - side.right, Math.min(48, H * .08));
    const cw = Math.min(736, W - side.right - 48), comp = R(Z.composer) || rect((side.right + W - cw) / 2, H - 22 - Math.min(140, H * .2), cw, Math.min(140, H * .2));
    const lane = Z.messages ? R(Z.messages) : rect(comp.left - 12, top.bottom, comp.width + 24, comp.top - top.bottom);
    const send = R(Z.send) || rect(comp.right - 54, comp.bottom - 52, 34, 34);
    const details = R(Z.details);
    const L = { side, top, lane, comp, send, details, W, H };
    const k = [W, H, side.right, top.bottom, lane.left, lane.right, comp.left, comp.top, comp.right, comp.bottom, send.left, details ? details.left : 0].map(Math.round).join(',');
    C.L = L;
    if (force || k !== key) { key = k; C.emit('layout', L); }
  }
  const companion = api.layer === 'companion';
  measure(true);
  const theRoom = Room(C, api, companion);
  const theCat = companion ? Cat(C, api) : null;
  measure(true);
  return {
    frame(t, dt) { if (theCat) theCat.frame(dt || 0); else theRoom.frame(dt || 0); },
    resize() { measure(true); },
    zones() { measure(false); },
    pointer(e) { C.mouse.x = e.x; C.mouse.y = e.y; if (e.kind === 'down') C.emit('click', { x: e.x, y: e.y }); },
    ui(e) {
      if (e.name === 'typing') { if (Date.now() - sentAt < 600) return; C.st.draft = true; C.emit('typing'); }
      else if (e.name === 'sent') { sentAt = Date.now(); C.st.draft = false; C.emit('sent'); }
      else if (e.name === 'working') { C.st.working = !!e.value; C.emit('working', !!e.value); }
      else if (e.name === 'done') C.emit('done');
    },
  };
});
