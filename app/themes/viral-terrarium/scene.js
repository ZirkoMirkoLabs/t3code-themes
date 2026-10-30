// Viral Terrarium v2: you are a god peering into a giant glass jar. Golden-hour valley with layered hills,
// a waterfall and stream, cottages, tiny sheep and villagers, drifting lit clouds; curved glass, rim and
// condensation on top. Pointer = god-light that blooms flowers and sways trees. Click ground = plant a
// tree; click sky = rain cloud that rains, then leaves a rainbow.
// sceneColors: 0 sky top, 1 sky mid (dusk plum), 2 horizon glow, 3 sun gold, 4 far hills, 5 mid hills,
// 6 meadow, 7 water. Static world, glass and calm mask are cached on resize/zones.
T3Scene(function (api) {
  var c = api.canvas.getContext('2d'), P = api.palette, S = P.scene, R = api.random, N = api.noise;
  var W, H, HZ, sunX, sunY, F, world, glass, calmL, cloudSprites = [];
  var clouds = [], trees = [], flowers = [], walkers = [], flies = [], drips = [], planted = [], rains = [], bows = [], sparks = [];
  var px = -999, py = -999, pOn = 0, wfX, wfTop, wfBot, stream = [];
  var seed = R() * 100, lite = api.preview ? 0.45 : 1;
  var FLOWER = ['#ff8fb8', '#ffd45e', '#f4f1ff', '#b89cff', '#7fd8ff', '#ff9d6b'];
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // Hill layer i (0 far .. 4 front meadow): ridge height at x.
  function hillY(i, x) {
    var base = [0.53, 0.575, 0.63, 0.7, 0.8][i], amp = [0.07, 0.06, 0.055, 0.05, 0.045][i], fr = [1.6, 2.2, 2.8, 3.2, 2.4][i];
    var u = x / Math.max(1, W);
    var h = N(u * fr + seed + i * 7.3, i * 3.1) * 0.75 + N(u * fr * 3 + i, seed) * 0.25;
    var y = H * (base - amp * (h - 0.3) * 2.2);
    if (i === 2) y -= Math.max(0, 1 - Math.abs(x - wfX) / (W * 0.07)) * H * 0.07; // cliff mesa for the waterfall
    return y;
  }
  function depth(y) { return clamp((y - HZ) / (H - HZ), 0.05, 1); }
  function cone(g, x, y, s, dark, lit) { // conifer
    g.fillStyle = '#3a2a1e'; g.fillRect(x - s * 0.08, y - s * 0.25, s * 0.16, s * 0.3);
    for (var k = 0; k < 3; k++) { var yy = y - s * 0.2 - k * s * 0.32, ww = s * (0.42 - k * 0.1);
      g.fillStyle = dark; g.beginPath(); g.moveTo(x - ww, yy); g.lineTo(x, yy - s * 0.55); g.lineTo(x + ww, yy); g.closePath(); g.fill();
      g.fillStyle = lit; g.beginPath(); g.moveTo(x, yy - s * 0.55); g.lineTo(x + (sunX > x ? ww : -ww), yy); g.lineTo(x + (sunX > x ? ww * 0.3 : -ww * 0.3), yy); g.closePath(); g.fill(); }
  }
  function roundTree(g, x, y, s, dark, lit, lean) {
    g.strokeStyle = '#3a2a1e'; g.lineWidth = Math.max(1, s * 0.12); g.beginPath(); g.moveTo(x, y); g.lineTo(x + lean * 0.4, y - s * 0.6); g.stroke();
    var cx = x + lean, cy = y - s * 0.85;
    g.fillStyle = dark; g.beginPath(); g.arc(cx, cy, s * 0.5, 0, 7); g.arc(cx - s * 0.32, cy + s * 0.12, s * 0.34, 0, 7); g.arc(cx + s * 0.32, cy + s * 0.1, s * 0.36, 0, 7); g.fill();
    var d = sunX > x ? 1 : -1; g.fillStyle = lit; g.beginPath(); g.arc(cx + d * s * 0.18, cy - s * 0.16, s * 0.28, 0, 7); g.fill();
  }
  function cottage(g, x, y, s, roof) {
    g.fillStyle = 'rgba(10,20,15,.35)'; g.beginPath(); g.ellipse(x + s * 0.2, y + 1, s * 0.75, s * 0.14, 0, 0, 7); g.fill();
    g.fillStyle = '#e9dccb'; g.fillRect(x - s * 0.5, y - s * 0.55, s, s * 0.55);
    g.fillStyle = '#b8a48f'; g.fillRect(x + s * 0.1, y - s * 0.55, s * 0.4, s * 0.55);
    g.fillStyle = roof; g.beginPath(); g.moveTo(x - s * 0.62, y - s * 0.5); g.lineTo(x - s * 0.1, y - s * 1.05); g.lineTo(x + s * 0.62, y - s * 0.5); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,220,150,.35)'; g.beginPath(); g.moveTo(x - s * 0.62, y - s * 0.5); g.lineTo(x - s * 0.1, y - s * 1.05); g.lineTo(x - s * 0.2, y - s * 0.5); g.closePath(); g.fill();
    g.fillStyle = '#5a4a3c'; g.fillRect(x + s * 0.25, y - s * 1.02, s * 0.12, s * 0.3);
  }
  function buildWorld() {
    world = new OffscreenCanvas(Math.max(1, W), Math.max(1, H)); var g = world.getContext('2d');
    var sky = g.createLinearGradient(0, 0, 0, HZ + H * 0.05);
    sky.addColorStop(0, S[0]); sky.addColorStop(0.45, S[1]); sky.addColorStop(0.8, S[2]); sky.addColorStop(1, S[3]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    var sg = g.createRadialGradient(sunX, sunY, 4, sunX, sunY, H * 0.55);
    sg.addColorStop(0, 'rgba(255,240,190,.95)'); sg.addColorStop(0.06, 'rgba(255,214,130,.75)'); sg.addColorStop(0.3, 'rgba(255,160,90,.22)'); sg.addColorStop(1, 'rgba(255,140,80,0)');
    g.fillStyle = sg; g.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = 'lighter'; // sun rays
    for (var r = 0; r < 14; r++) { var a = -Math.PI * (0.08 + 0.84 * (r + R() * 0.6) / 14), len = H;
      g.fillStyle = 'rgba(255,200,120,' + (0.025 + R() * 0.03) + ')'; g.beginPath(); g.moveTo(sunX, sunY);
      g.lineTo(sunX + Math.cos(a - 0.03) * len, sunY + Math.sin(a - 0.03) * len); g.lineTo(sunX + Math.cos(a + 0.03) * len, sunY + Math.sin(a + 0.03) * len); g.fill(); }
    g.restore();
    var hazeC = [api.mix(S[4], S[2], 0.45), api.mix(S[4], S[1], 0.25), S[5], api.mix(S[5], S[6], 0.5), S[6]];
    for (var i = 0; i < 5; i++) {
      g.beginPath(); g.moveTo(0, H);
      for (var x = 0; x <= W + 8; x += 8) g.lineTo(x, hillY(i, x));
      g.lineTo(W, H); g.closePath();
      var top = hillY(i, sunX) - H * 0.06, gr = g.createLinearGradient(0, top, 0, H);
      gr.addColorStop(0, api.mix(hazeC[i], S[3], i < 2 ? 0.18 : 0.08)); gr.addColorStop(0.35, hazeC[i]); gr.addColorStop(1, api.mix(hazeC[i], '#02100c', 0.55));
      g.fillStyle = gr; g.fill();
      g.strokeStyle = api.rgba(S[3], i < 2 ? 0.25 : 0.45); g.lineWidth = 1.5; g.beginPath(); // gold rim light
      for (var x2 = 0; x2 <= W + 8; x2 += 8) { var yy = hillY(i, x2); if (x2) g.lineTo(x2, yy); else g.moveTo(x2, yy); } g.stroke();
      if (i === 2) { // rock face under the waterfall lip
        g.fillStyle = api.rgba('#2a2f33', 0.55); g.beginPath(); g.moveTo(wfX - W * 0.025, wfTop + 6); g.lineTo(wfX + W * 0.02, wfTop + 4); g.lineTo(wfX + W * 0.03, wfBot); g.lineTo(wfX - W * 0.035, wfBot); g.fill();
      }
      if (i >= 2) { // grass texture
        var n = (i === 4 ? 2200 : 900) * lite;
        for (var k = 0; k < n; k++) { var gx = R() * W, gy0 = hillY(i, gx), gy = gy0 + Math.pow(R(), 1.6) * (H - gy0) * (i === 4 ? 1 : 0.5), d = depth(gy);
          g.strokeStyle = R() < 0.5 ? api.rgba('#c9f07a', 0.10 + d * 0.12) : api.rgba('#06180f', 0.22); g.lineWidth = 0.6 + d;
          g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + (R() - 0.5) * 3, gy - 2 - d * 7); g.stroke(); }
      }
      if (i === 1 || i === 2 || i === 3) { // cached distant trees and cottages
        var cnt = [0, 70, 55, 40][i] * lite;
        for (var t = 0; t < cnt; t++) { var tx = R() * W, ty = hillY(i, tx) + 2 + R() * H * 0.02 * i, s = (4 + R() * 5) * (0.6 + depth(ty) * 2.2);
          if (Math.abs(tx - wfX) < W * 0.03) continue;
          var dk = api.mix(hazeC[i], '#06140c', 0.45), lt = api.mix(hazeC[i], S[3], 0.35);
          if (R() < 0.55) cone(g, tx, ty, s * 1.4, dk, lt); else roundTree(g, tx, ty, s, dk, lt, 0); }
        if (i >= 2) for (var h = 0; h < (i === 2 ? 3 : 4); h++) { var hx = W * (0.08 + R() * 0.84); if (Math.abs(hx - wfX) < W * 0.08) continue;
          var hy = hillY(i, hx) + H * 0.012, hs = 8 + depth(hy) * 26; cottage(g, hx, hy, hs, ['#3d5f86', '#6b3f6e', '#2f6c66', '#874052'][h]);
          cottages.push({ x: hx, y: hy, s: hs }); }
      }
      if (i === 4) { // stream on top of the meadow, from the pool to the viewer
        g.beginPath(); stream.forEach(function (p, j) { if (j) g.lineTo(p.x - p.w, p.y); else g.moveTo(p.x - p.w, p.y); });
        for (var j = stream.length - 1; j >= 0; j--) g.lineTo(stream[j].x + stream[j].w, stream[j].y); g.closePath();
        var wg = g.createLinearGradient(0, wfBot, 0, H); wg.addColorStop(0, api.mix(S[7], S[3], 0.45)); wg.addColorStop(0.4, S[7]); wg.addColorStop(1, api.mix(S[7], '#05202a', 0.5));
        g.fillStyle = wg; g.fill(); g.strokeStyle = 'rgba(230,255,240,.35)'; g.lineWidth = 1.5; g.stroke();
      }
    }
    var mist = g.createLinearGradient(0, HZ - H * 0.03, 0, HZ + H * 0.12); mist.addColorStop(0, api.rgba(S[2], 0)); mist.addColorStop(0.5, api.rgba(S[2], 0.16)); mist.addColorStop(1, api.rgba(S[2], 0));
    g.fillStyle = mist; g.fillRect(0, HZ - H * 0.03, W, H * 0.15);
  }
  var cottages = [];
  function buildGlass() {
    glass = new OffscreenCanvas(Math.max(1, W), Math.max(1, H)); var g = glass.getContext('2d');
    var v = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.78);
    v.addColorStop(0, 'rgba(3,22,20,0)'); v.addColorStop(1, 'rgba(3,22,20,.62)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    var fog = 28 + Math.min(W, H) * 0.05; // condensation fog hugging the glass edge
    [[0, 0, fog, 0, 0, 0, fog, H], [W, 0, W - fog, 0, W - fog, 0, fog, H], [0, H, 0, H - fog, 0, H - fog, W, fog]].forEach(function (e) {
      var lg = g.createLinearGradient(e[0], e[1], e[2], e[3]); lg.addColorStop(0, 'rgba(200,240,225,.16)'); lg.addColorStop(1, 'rgba(200,240,225,0)'); g.fillStyle = lg; g.fillRect(e[4], e[5], e[6], e[7]); });
    // curved jar reflection: broad sheen bands and a crisp highlight arc
    g.save(); g.globalCompositeOperation = 'screen';
    var b = g.createLinearGradient(W * 0.02, 0, W * 0.2, 0); b.addColorStop(0, 'rgba(255,255,255,0)'); b.addColorStop(0.45, 'rgba(220,255,240,.10)'); b.addColorStop(0.55, 'rgba(220,255,240,.13)'); b.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = b; g.beginPath(); g.moveTo(W * 0.06, 0); g.quadraticCurveTo(W * 0.01, H * 0.5, W * 0.08, H); g.lineTo(W * 0.17, H); g.quadraticCurveTo(W * 0.1, H * 0.5, W * 0.16, 0); g.fill();
    var b2 = g.createLinearGradient(W * 0.84, 0, W * 0.96, 0); b2.addColorStop(0, 'rgba(255,255,255,0)'); b2.addColorStop(0.6, 'rgba(255,230,190,.09)'); b2.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = b2; g.beginPath(); g.moveTo(W * 0.88, 0); g.quadraticCurveTo(W * 0.97, H * 0.5, W * 0.9, H); g.lineTo(W * 0.95, H); g.quadraticCurveTo(W * 1.01, H * 0.5, W * 0.94, 0); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(W / 2, H * 1.05, W * 0.62, H * 1.0, 0, Math.PI * 1.08, Math.PI * 1.3); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 7; g.beginPath(); g.ellipse(W / 2, H * 1.05, W * 0.6, H * 0.98, 0, Math.PI * 1.1, Math.PI * 1.26); g.stroke();
    g.restore();
    g.strokeStyle = api.rgba(P.accent, 0.35); g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3); // soft green jar rim
    g.strokeStyle = api.rgba(P.accent, 0.12); g.lineWidth = 12; g.strokeRect(6, 6, W - 12, H - 12);
    var drops = 700 * lite; // beaded condensation, densest at the edges
    for (var i = 0; i < drops; i++) {
      var side = R(), x, y, e = Math.pow(R(), 2.2) * fog * 2.4;
      if (side < 0.32) { x = e; y = R() * H; } else if (side < 0.64) { x = W - e; y = R() * H; } else if (side < 0.9) { x = R() * W; y = H - e; } else { x = R() * W; y = e * 0.6; }
      var r = 0.6 + Math.pow(R(), 3) * 4.5;
      g.fillStyle = 'rgba(2,14,12,.22)'; g.beginPath(); g.ellipse(x + r * 0.2, y + r * 0.35, r, r * 1.05, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(210,250,235,.16)'; g.beginPath(); g.ellipse(x, y, r, r * 1.05, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.65)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.4, Math.max(0.4, r * 0.28), 0, 7); g.fill();
    }
  }
  function buildCalm(zs) {
    calmL = new OffscreenCanvas(Math.max(1, W), Math.max(1, H)); var g = calmL.getContext('2d');
    (zs || api.zones || []).forEach(function (z) {
      if (z.kind === 'topbar' || z.kind === 'details' || z.kind === 'send') return;
      if (z.kind === 'hero') { g.save(); g.translate(z.x + z.w / 2, z.y + z.h / 2); g.scale(z.w * 0.75, z.h * 1.1);
        var hg = g.createRadialGradient(0, 0, 0, 0, 0, 1); hg.addColorStop(0, api.rgba(P.bg, 0.6)); hg.addColorStop(1, api.rgba(P.bg, 0)); g.fillStyle = hg; g.fillRect(-1, -1, 2, 2); g.restore(); return; }
      for (var k = 0; k < 10; k++) { var p = 70 - k * 7; g.fillStyle = api.rgba(P.bg, 0.09); g.fillRect(z.x - p, z.y - p, z.w + p * 2, z.h + p * 2); }
      g.fillStyle = P.bg; if (z.kind !== 'hero') g.fillRect(z.x, z.y, z.w, z.h); // text zones sit on the plain background
    });
  }
  function makeCloud(w) {
    var h = w * 0.55, cv = new OffscreenCanvas(Math.ceil(w), Math.ceil(h)), g = cv.getContext('2d'), n = 10 + (R() * 6 | 0), puffs = [];
    for (var i = 0; i < n; i++) { var u = (i + 0.5) / n, r = w * (0.07 + 0.11 * Math.sin(u * Math.PI)) * (0.8 + R() * 0.4);
      puffs.push({ x: w * (0.12 + 0.76 * u), y: h * 0.72 - r * 0.7 - R() * h * 0.08, r: r }); }
    g.fillStyle = api.mix('#ffd0a8', S[2], 0.3); g.beginPath();
    puffs.forEach(function (q) { g.moveTo(q.x + q.r, q.y); g.arc(q.x, q.y, q.r, 0, 7); }); g.rect(w * 0.14, h * 0.62, w * 0.72, h * 0.12); g.fill();
    g.globalCompositeOperation = 'source-atop';
    var sh = g.createLinearGradient(0, 0, 0, h * 0.78); sh.addColorStop(0, 'rgba(255,244,220,.9)'); sh.addColorStop(0.45, 'rgba(255,200,150,.25)'); sh.addColorStop(1, 'rgba(80,50,110,.75)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    puffs.forEach(function (q) { var d = sunX > W / 2 ? 1 : -1, hl = g.createRadialGradient(q.x + d * q.r * 0.35, q.y - q.r * 0.45, 0, q.x, q.y - q.r * 0.2, q.r);
      hl.addColorStop(0, 'rgba(255,240,205,.55)'); hl.addColorStop(1, 'rgba(255,240,205,0)'); g.fillStyle = hl; g.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2); });
    return cv;
  }
  function resize() {
    W = api.width; H = api.height; F = api.free(30); HZ = H * 0.55;
    sunX = clamp(F.x + F.w * 0.62, W * 0.2, W * 0.88); sunY = HZ - H * 0.03;
    wfX = clamp(F.x + F.w * 0.45, W * 0.15, W * 0.85);
    wfTop = 0; wfTop = hillY(2, wfX); wfBot = hillY(3, wfX) + 3;
    stream = []; var sx = wfX;
    for (var j = 0; j <= 30; j++) { var u = j / 30, y = wfBot + (H - wfBot + 20) * u; sx = wfX + Math.sin(u * 5.2 + seed) * W * 0.06 * u + (W * 0.5 - wfX) * 0.25 * u * u; stream.push({ x: sx, y: y, w: 4 + u * u * W * 0.05 }); }
    cottages = []; buildWorld(); buildGlass(); buildCalm();
    // front meadow interactive trees
    trees = []; for (var i = 0; i < 46 * lite; i++) { var tx = R() * W, ty = hillY(4, tx) + 4 + Math.pow(R(), 1.4) * (H - hillY(4, tx)) * 0.7; if (onStream(tx, ty, 26)) continue;
      trees.push({ x: tx, y: ty, s: 10 + depth(ty) * 34, conifer: R() < 0.45, ph: R() * 6, sway: 0, grow: 1 }); }
    flowers = []; for (var f = 0; f < 320 * lite; f++) { var fx = R() * W, top = hillY(3, fx) + 6, fy = top + Math.pow(R(), 0.8) * (H - top); if (onStream(fx, fy, 6)) continue;
      flowers.push({ x: fx, y: fy, c: (R() * FLOWER.length) | 0, b: R() < 0.3 ? 0.35 : 0.04, ph: R() * 6 }); }
    flowers.sort(function (a, b) { return a.y - b.y; });
    walkers = []; for (var w = 0; w < 12 * lite + 2; w++) walkers.push({ x: R() * W, v: (R() < 0.5 ? -1 : 1) * (6 + R() * 10), sheep: R() < 0.65, layer: R() < 0.6 ? 4 : 3, off: R() * 18, ph: R() * 6, col: ['#3d6fb0', '#c94f6d', '#e3b23c', '#5a9e6f'][(R() * 4) | 0] });
    cloudSprites = []; for (var k = 0; k < 4; k++) cloudSprites.push(makeCloud(160 + k * 70));
    if (!clouds.length) for (var q = 0; q < 8; q++) clouds.push({ x: R() * 1.3 - 0.15, y: 0.06 + R() * 0.34, k: (R() * 4) | 0, v: 0.004 + R() * 0.006, s: 0.6 + R() * 0.7 });
    flies = []; for (var m = 0; m < 60 * lite; m++) flies.push({ x: R() * W, y: HZ + R() * (H - HZ), ph: R() * 6, sp: 0.3 + R() * 0.6 });
    drips = []; for (var d = 0; d < 6; d++) drips.push(newDrip());
  }
  function newDrip() { var left = R() < 0.5; return { x: left ? 6 + R() * 50 : W - 6 - R() * 50, y: R() * H * 0.5, v: 4 + R() * 10, r: 1.8 + R() * 1.8 }; }
  function onStream(x, y, pad) { for (var j = 0; j < stream.length; j++) if (Math.abs(stream[j].y - y) < 14 && Math.abs(stream[j].x - x) < stream[j].w + pad) return true; return false; }
  function streamAt(u) { var f = u * 30, j = Math.min(29, f | 0), k = f - j, a = stream[j], b = stream[j + 1]; return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k }; }
  function bloomAround(x, y, r, amt) { for (var i = 0; i < flowers.length; i++) { var f = flowers[i], dx = f.x - x, dy = (f.y - y) * 1.4; if (dx * dx + dy * dy < r * r) f.b = Math.min(1, f.b + amt); } }
  resize();

  function drawTree(t, tt, k) {
    var lean = Math.sin(tt * 1.3 + t.ph) * (0.6 + t.sway * 5) * k, s = t.s * t.grow;
    var dk = api.mix(S[6], '#06200f', 0.55), lt = api.mix(S[6], S[3], 0.45 + t.sway * 0.3);
    c.fillStyle = 'rgba(4,16,8,.35)'; c.beginPath(); c.ellipse(t.x + s * 0.3, t.y + 1, s * 0.45, s * 0.1, 0, 0, 7); c.fill();
    if (t.conifer) { c.save(); c.translate(t.x, t.y); c.rotate(lean * 0.02); cone(c, 0, 0, s * 1.3, dk, lt); c.restore(); }
    else roundTree(c, t.x, t.y, s, dk, lt, lean);
  }
  return {
    resize: resize, zones: function (z) { F = api.free(30); buildCalm(z); },
    pointer: function (e) {
      if (e.overUI) { pOn = 0; return; }
      px = e.x; py = e.y; pOn = 1;
      if (e.kind !== 'down' || api.calm(e.x, e.y, 10) > 0.5) return;
      for (var i = 0; i < 18; i++) sparks.push({ x: e.x, y: e.y, vx: (R() - 0.5) * 120, vy: -40 - R() * 120, life: 1, c: FLOWER[(R() * 6) | 0] });
      if (e.y > hillY(4, e.x) - 4 || (e.y > hillY(3, e.x) && e.y > HZ)) {
        planted.push({ x: e.x, y: e.y, s: 12 + depth(e.y) * 46, conifer: R() < 0.4, ph: R() * 6, sway: 0, grow: 0, age: 0 });
        if (planted.length > 24) planted.shift(); bloomAround(e.x, e.y, 120, 1);
      } else {
        rains.push({ x: e.x, y: Math.min(e.y, HZ - 60), age: 0, k: (R() * 4) | 0 }); if (rains.length > 4) rains.shift();
      }
    },
    frame: function (t, dt) {
      dt = Math.min(dt, 0.1);
      c.drawImage(world, 0, 0, W, H);
      // drifting lit clouds
      clouds.forEach(function (q) { q.x += q.v * dt * 0.4; if (q.x > 1.25) q.x = -0.3; var sp = cloudSprites[q.k], w = sp.width * q.s;
        c.globalAlpha = 0.92; c.drawImage(sp, q.x * W, q.y * H, w, w * 0.55); }); c.globalAlpha = 1;
      // waterfall: falling sheets and foam
      var wfW = Math.max(8, W * 0.016), fh = wfBot - wfTop;
      var wg = c.createLinearGradient(0, wfTop, 0, wfBot); wg.addColorStop(0, api.mix(S[7], '#ffffff', 0.4)); wg.addColorStop(1, api.mix(S[7], '#ffffff', 0.15));
      c.fillStyle = wg; c.beginPath(); c.moveTo(wfX - wfW, wfTop); c.lineTo(wfX + wfW, wfTop); c.lineTo(wfX + wfW * 1.3, wfBot); c.lineTo(wfX - wfW * 1.3, wfBot); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2;
      for (var s = 0; s < 14; s++) { var lx = wfX + (s / 13 - 0.5) * wfW * 2, ph = ((t * 0.9 + s * 0.37) % 1);
        c.beginPath(); c.moveTo(lx, wfTop + fh * ph); c.lineTo(lx * 1 + (lx - wfX) * 0.2 * ph, wfTop + fh * Math.min(1, ph + 0.18)); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (var fo = 0; fo < 40; fo++) { var fp = ((t * 0.6 + fo * 0.618) % 1), a = fo * 2.4, rr = 1 + (fo % 4) * 0.8 + fp * 2.5;
        c.globalAlpha = 0.85 * (1 - fp); c.beginPath(); c.arc(wfX + Math.cos(a) * wfW * (0.6 + fp * 1.8), wfBot - fp * 10 + Math.sin(a) * 3, rr, 0, 7); c.fill(); } c.globalAlpha = 1;
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(wfX, wfBot, wfW * 2.2, 5, 0, 0, 7); c.fill();
      // stream shimmer flowing toward the viewer
      c.strokeStyle = 'rgba(255,240,200,.55)';
      for (var j = 0; j < 22; j++) { var u = ((t * 0.05 + j / 22) % 1), p = streamAt(u), off = Math.sin(j * 7.1) * p.w * 0.6;
        c.lineWidth = 0.8 + u * 2; c.beginPath(); c.moveTo(p.x + off - p.w * 0.15, p.y); c.lineTo(p.x + off + p.w * 0.15, p.y); c.stroke(); }
      // cottage windows glow
      cottages.forEach(function (h, i) { var fl = 0.7 + 0.3 * Math.sin(t * 2 + i * 3);
        c.fillStyle = 'rgba(255,200,90,' + (0.85 * fl) + ')'; c.fillRect(h.x - h.s * 0.32, h.y - h.s * 0.38, h.s * 0.18, h.s * 0.18);
        c.fillStyle = 'rgba(255,190,90,' + (0.12 * fl) + ')'; c.beginPath(); c.arc(h.x - h.s * 0.23, h.y - h.s * 0.3, h.s * 0.6, 0, 7); c.fill(); });
      // walkers: sheep and villagers on the ridges
      walkers.forEach(function (w) { w.x += w.v * dt; if (w.x < -20 || w.x > W + 20) w.v = -w.v;
        var y = hillY(w.layer, w.x) + w.off * (w.layer === 4 ? 2 : 0.6), d = depth(y), s = 3 + d * 7, bob = Math.abs(Math.sin(t * 6 + w.ph)) * s * 0.15, al = 1 - api.calm(w.x, y, 30) * 0.8;
        c.globalAlpha = al;
        if (w.sheep) { c.fillStyle = '#f6f2ea'; c.beginPath(); c.ellipse(w.x, y - s * 0.6 - bob, s, s * 0.62, 0, 0, 7); c.fill();
          c.fillStyle = '#2a2420'; c.beginPath(); c.arc(w.x + (w.v > 0 ? s : -s), y - s * 0.75 - bob, s * 0.35, 0, 7); c.fill(); c.fillRect(w.x - s * 0.5, y - s * 0.2, s * 0.15, s * 0.3); c.fillRect(w.x + s * 0.4, y - s * 0.2, s * 0.15, s * 0.3); }
        else { c.fillStyle = w.col; c.fillRect(w.x - s * 0.25, y - s * 1.3 - bob, s * 0.5, s * 0.9); c.fillStyle = '#f0c9a0'; c.beginPath(); c.arc(w.x, y - s * 1.5 - bob, s * 0.25, 0, 7); c.fill(); c.fillStyle = '#2a2420'; c.fillRect(w.x - s * 0.2, y - s * 0.4, s * 0.12, s * 0.4); c.fillRect(w.x + s * 0.08, y - s * 0.4, s * 0.12, s * 0.4); }
      }); c.globalAlpha = 1;
      // flowers, batched by colour; pointer god-light blooms them
      var R2 = 150 * 150, near = pOn ? 1 : 0;
      for (var i = 0; i < flowers.length; i++) { var f = flowers[i];
        if (near) { var dx = f.x - px, dy = (f.y - py) * 1.3; if (dx * dx + dy * dy < R2) f.b = Math.min(1, f.b + dt * 2.2); }
        f.b = Math.max(0.04, f.b - dt * 0.03); }
      for (var col = 0; col < FLOWER.length; col++) { c.fillStyle = FLOWER[col]; c.beginPath();
        for (var i2 = 0; i2 < flowers.length; i2++) { var f2 = flowers[i2]; if (f2.c !== col || f2.b < 0.12) continue; var r = (0.8 + depth(f2.y) * 4.2) * f2.b; c.moveTo(f2.x + r, f2.y); c.arc(f2.x, f2.y, r, 0, 7); }
        c.fill(); }
      c.fillStyle = '#5fae4a'; c.beginPath();
      for (var i3 = 0; i3 < flowers.length; i3++) { var f3 = flowers[i3]; if (f3.b >= 0.12) continue; var r3 = 0.6 + depth(f3.y) * 1.6; c.rect(f3.x - r3 * 0.5, f3.y - r3, r3, r3 * 1.5); } c.fill();
      // trees (front meadow + planted), swaying under the god-light
      var all = trees.concat(planted).sort(function (a, b) { return a.y - b.y; });
      all.forEach(function (tr) {
        if (pOn) { var dx = tr.x - px, dy = tr.y - py, dd = Math.sqrt(dx * dx + dy * dy); tr.sway += (Math.max(0, 1 - dd / 220) - tr.sway) * Math.min(1, dt * 3); } else tr.sway *= 1 - Math.min(1, dt * 2);
        if (tr.age != null) { tr.age += dt; var u = Math.min(1, tr.age / 2.2); tr.grow = 1 - Math.pow(1 - u, 3) * Math.cos(u * 9) ; tr.grow = Math.max(0.02, tr.grow); }
        c.globalAlpha = 1 - api.calm(tr.x, tr.y, 30) * 0.55; drawTree(tr, t, 1); });
      c.globalAlpha = 1;
      // rain clouds -> rain -> rainbow
      for (var q = rains.length - 1; q >= 0; q--) { var rn = rains[q]; rn.age += dt; var sp = cloudSprites[rn.k], cw = sp.width * 0.9, a2 = Math.min(1, rn.age * 2) * (rn.age > 5 ? Math.max(0, 1 - (rn.age - 5)) : 1);
        var ground = hillY(4, rn.x) + 20;
        if (rn.age < 4.6) { c.strokeStyle = 'rgba(190,230,255,.55)'; c.lineWidth = 1.1; c.beginPath();
          for (var d2 = 0; d2 < 60 * lite + 20; d2++) { var dxr = (api.hash(d2, q + 1) - 0.5) * cw * 0.8, ly = rn.y + cw * 0.3 + (((t * 1.4 + api.hash(q, d2)) % 1)) * (ground - rn.y - cw * 0.3);
            c.moveTo(rn.x + dxr, ly); c.lineTo(rn.x + dxr - 2, ly + 12); } c.stroke();
          bloomAround(rn.x, ground, cw * 0.5, dt * 0.8); }
        c.globalAlpha = a2; c.drawImage(sp, rn.x - cw / 2, rn.y, cw, cw * 0.55); c.globalAlpha = 1;
        if (rn.age > 3.6 && !rn.bow) { rn.bow = 1; bows.push({ x: rn.x, y: ground, r: Math.min(W * 0.28, 120 + (ground - rn.y) * 0.9), age: 0 }); }
        if (rn.age > 6) rains.splice(q, 1); }
      for (var b = bows.length - 1; b >= 0; b--) { var bw = bows[b]; bw.age += dt; var al2 = Math.min(1, bw.age / 1.5) * Math.max(0, Math.min(1, (9 - bw.age) / 3)) * 0.5;
        if (al2 <= 0 && bw.age > 3) { bows.splice(b, 1); continue; }
        var BC = ['#ff5d6c', '#ff9f43', '#ffe066', '#7bdc6b', '#4fc3f7', '#7c6cff', '#c77dff'];
        c.globalAlpha = al2; c.lineWidth = Math.max(4, bw.r * 0.03);
        for (var k = 0; k < 7; k++) { c.strokeStyle = BC[k]; c.beginPath(); c.arc(bw.x, bw.y, bw.r - k * c.lineWidth, Math.PI, Math.PI * 2); c.stroke(); }
        c.globalAlpha = 1; }
      // sprout sparks
      for (var sk = sparks.length - 1; sk >= 0; sk--) { var p2 = sparks[sk]; p2.life -= dt * 0.9; if (p2.life <= 0) { sparks.splice(sk, 1); continue; }
        p2.vy += 160 * dt; p2.x += p2.vx * dt; p2.y += p2.vy * dt; c.globalAlpha = p2.life; c.fillStyle = p2.c; c.beginPath(); c.ellipse(p2.x, p2.y, 3, 1.6, p2.x * 0.1, 0, 7); c.fill(); }
      c.globalAlpha = 1;
      // fireflies over the meadow
      c.save(); c.globalCompositeOperation = 'lighter';
      flies.forEach(function (fl) { var x = fl.x + Math.sin(t * fl.sp + fl.ph) * 30, y = fl.y + Math.cos(t * fl.sp * 1.3 + fl.ph) * 18, tw = 0.5 + 0.5 * Math.sin(t * 3 + fl.ph * 5), al = tw * (1 - api.calm(x, y, 40));
        if (al < 0.05) return; c.fillStyle = 'rgba(220,255,120,' + (0.18 * al) + ')'; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); c.fillStyle = 'rgba(250,255,200,' + (0.9 * al) + ')'; c.fillRect(x - 1, y - 1, 2, 2); });
      // god-light: a beam from above and a warm pool where the pointer rests
      if (pOn && px > -900) { var beam = c.createLinearGradient(0, 0, 0, py); beam.addColorStop(0, 'rgba(255,230,160,0)'); beam.addColorStop(1, 'rgba(255,220,140,.16)');
        c.fillStyle = beam; c.beginPath(); c.moveTo(px - 30 + (px - W / 2) * 0.1, 0); c.lineTo(px + 30 + (px - W / 2) * 0.1, 0); c.lineTo(px + 130, py); c.lineTo(px - 130, py); c.fill();
        var gl = c.createRadialGradient(px, py, 0, px, py, 170); gl.addColorStop(0, 'rgba(255,225,150,.32)'); gl.addColorStop(0.5, 'rgba(255,200,120,.12)'); gl.addColorStop(1, 'rgba(255,200,120,0)');
        c.fillStyle = gl; c.fillRect(px - 170, py - 170, 340, 340); }
      c.restore();
      // glass: condensation, reflection, rim; a few drops slide down
      c.drawImage(glass, 0, 0, W, H);
      drips.forEach(function (dp) { dp.y += dp.v * dt; if (dp.y > H + 10) { var n = newDrip(); dp.x = n.x; dp.y = -10; dp.v = n.v; }
        var tr = c.createLinearGradient(0, dp.y - 60, 0, dp.y); tr.addColorStop(0, 'rgba(210,250,235,0)'); tr.addColorStop(1, 'rgba(210,250,235,.18)');
        c.fillStyle = tr; c.fillRect(dp.x - dp.r * 0.5, dp.y - 60, dp.r, 60);
        c.fillStyle = 'rgba(220,255,240,.35)'; c.beginPath(); c.arc(dp.x, dp.y, dp.r, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(dp.x - dp.r * 0.35, dp.y - dp.r * 0.35, dp.r * 0.3, 0, 7); c.fill(); });
      c.drawImage(calmL, 0, 0, W, H);
    }
  };
});
