// Atmos: the live code layer of a hybrid theme. The AI picture (and its video loop) is the backdrop; this scene
// draws only light and particles on a transparent canvas, anchored to points in that picture.
// params: fx (list of effects), img [w, h] and pos [x, y] of the backdrop (object-fit: cover), plus per-effect values.
// params.colors (or sceneColors): 0 = main light, 1 = secondary light, 2 = particles, 3/4 = petals or leaves.
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [], prm = api.params || {}, R = api.random;
  prm = Object.assign({}, prm);
  function finite(v, fallback, lo, hi) { return typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback; }
  var fx = Object.create(null); (Array.isArray(prm.fx) ? prm.fx : ['motes']).slice(0, 16).forEach(function (n) { if (['stars','meteor','motes','snow','petals','leaves','mist','sand','rays','glows','grid','rainglass','fogglass','ripples','gust'].indexOf(n) >= 0) fx[n] = true; });
  ['from', 'raysFrom', 'mistBand', 'sandBand', 'pos', 'cone', 'occlude'].forEach(function (key) { var v = prm[key], count = key === 'cone' || key === 'occlude' ? 3 : 2; if (!Array.isArray(v) || v.length < count || !v.slice(0, count).every(function (x) { return typeof x === 'number' && Number.isFinite(x); })) delete prm[key]; else { prm[key] = v.slice(0, count).map(function (x) { return Math.max(-2, Math.min(4, x)); }); if (count === 3) prm[key][2] = Math.max(0.001, prm[key][2]); } });
  prm.glows = (Array.isArray(prm.glows) ? prm.glows : []).slice(0, 16).filter(function (g) { return Array.isArray(g) && g.length >= 3 && g.slice(0, 3).every(function (x) { return typeof x === 'number' && Number.isFinite(x); }); }).map(function (g) { return [finite(g[0], 0.5, -2, 3), finite(g[1], 0.5, -2, 3), finite(g[2], 0.2, 0.001, 3), finite(g[3], 0.3, 0, 1), g[4]]; });
  ['sky','parallax','starDrift','moteAlpha','moteSize','wind','mistAlpha','rayAlpha','horizon','vanish','fogAlpha'].forEach(function (key) { if (prm[key] != null) prm[key] = finite(prm[key], undefined, key === 'wind' ? -200 : 0, key === 'wind' ? 200 : key === 'parallax' || key === 'moteSize' ? 4 : 1); });
  var W = api.width, H = api.height, lite = api.preview ? 0.4 : 1;
  var IW = finite(prm.img && prm.img[0], 1920, 1, 16384), IH = finite(prm.img && prm.img[1], 1080, 1, 16384), POS = prm.pos || [0.5, 0.5];
  var COL = Array.isArray(prm.colors) ? prm.colors : S; // particle colours; sceneColors hold the picture's own tones (used for contrast checks)
  var C0 = COL[0] || P.accent, C1 = COL[1] || P.accent2, C2 = COL[2] || P.text, C3 = COL[3] || P.accent, C4 = COL[4] || C3;
  var box = { x: 0, y: 0, w: W, h: H };
  // picture (u, v in 0..1) → screen, matching the backdrop's object-fit: cover
  function fit() { var k = Math.max(W / IW, H / IH); box.w = IW * k; box.h = IH * k; box.x = (W - box.w) * POS[0]; box.y = (H - box.h) * POS[1]; }
  function px(u) { return box.x + u * box.w; }
  function py(v) { return box.y + v * box.h; }
  function quiet(x, y) { return 1 - api.calm(x, y, 60) * 0.75; }
  function sprite(col, r, core) {
    var c = new OffscreenCanvas(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, api.rgba(col, 1)); gr.addColorStop(core || 0.35, api.rgba(col, 0.4)); gr.addColorStop(1, api.rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
  }
  var dot0 = sprite(C0, 32), dot1 = sprite(C1, 32), dot2 = sprite(C2, 16, 0.5), white = sprite('#ffffff', 16, 0.3), flake = prm.snowColor ? sprite(prm.snowColor, 16, 0.3) : white;
  function n(v, d) { return Math.round(finite(v, d, 0, 500) * lite); }

  /* ---- stars: fixed to the picture's sky, twinkling ---- */
  var stars = [];
  if (fx.stars) for (var i = 0; i < n(prm.stars, 140); i++) stars.push({ u: R(), v: R() * (prm.sky || 0.5), z: 0.3 + R() * 0.7, ph: R() * 6.3, sp: 0.6 + R() * 1.8, big: R() < 0.06 });
  function drawStars(t) {
    var oc = prm.occlude, ocx = oc ? px(oc[0]) : 0, ocy = oc ? py(oc[1]) : 0, ocr = oc ? oc[2] * box.h : 0; // a planet hides the stars behind it
    var par = prm.parallax ? prm.parallax : 0, ox = (api.pointer.x / W - 0.5) * par, oy = (api.pointer.y / H - 0.5) * par;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], drift = prm.starDrift ? (t * prm.starDrift * s.z) % 1 : 0;
      var x = px((s.u + drift) % 1) - ox * s.z * 20, y = py(s.v) - oy * s.z * 20;
      if (oc && (x - ocx) * (x - ocx) + (y - ocy) * (y - ocy) < ocr * ocr) continue;
      var a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph))) * s.z * quiet(x, y);
      if (a < 0.03) continue;
      var r = (s.big ? 2.2 : 1) * (0.6 + s.z);
      ctx.globalAlpha = a; ctx.drawImage(white, x - r * 2, y - r * 2, r * 4, r * 4);
      if (s.big) { ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - r * 5, y - 0.5, r * 10, 1); ctx.fillRect(x - 0.5, y - r * 5, 1, r * 10); }
    }
  }
  /* ---- meteor: rare, seeded ---- */
  var met = null, nextMet = 6 + R() * 18;
  function drawMeteor(t, dt) {
    if (!met && t > nextMet && dt > 0) { var a = 0.35 + R() * 0.35; met = { x: px(0.25 + R() * 0.7), y: py(R() * (prm.sky || 0.4) * 0.6), a: a, t0: t, len: 140 + R() * 120, sp: 900 + R() * 500 }; nextMet = t + 18 + R() * 30; }
    if (!met) return;
    var k = (t - met.t0) / 0.9; if (k > 1) { met = null; return; }
    var d = met.sp * (t - met.t0), hx = met.x - Math.cos(met.a) * d, hy = met.y + Math.sin(met.a) * d;
    var tx = hx + Math.cos(met.a) * met.len, ty = hy - Math.sin(met.a) * met.len, al = Math.sin(k * Math.PI) * quiet(hx, hy);
    var g = ctx.createLinearGradient(hx, hy, tx, ty); g.addColorStop(0, api.rgba('#ffffff', 0.9 * al)); g.addColorStop(1, api.rgba(C1, 0));
    ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.globalAlpha = al; ctx.drawImage(white, hx - 6, hy - 6, 12, 12);
  }
  /* ---- motes: dust in a lamp beam, plankton, pollen ---- */
  var motes = [];
  if (fx.motes) for (i = 0; i < n(prm.motes, 90); i++) motes.push({ x: R() * W, y: R() * H, z: 0.25 + R() * 0.75, ph: R() * 6.3, vy: (prm.rise ? -1 : 1) * (4 + R() * 10) });
  function drawMotes(t, dt) {
    var cone = prm.cone, cx = cone ? px(cone[0]) : 0, cy = cone ? py(cone[1]) : 0, cr = cone ? cone[2] * box.h : 1;
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      m.y += m.vy * m.z * dt; m.x += Math.sin(t * 0.25 + m.ph) * 6 * m.z * dt;
      if (fx.gust && gust.on) { var dx = m.x - api.pointer.x, dy = m.y - api.pointer.y, dd = dx * dx + dy * dy; if (dd < 14400) { m.x += dx / Math.sqrt(dd + 1) * 40 * dt; m.y += dy / Math.sqrt(dd + 1) * 40 * dt; } }
      if (m.y < -10) m.y = H + 10; if (m.y > H + 10) m.y = -10; if (m.x < -10) m.x = W + 10; if (m.x > W + 10) m.x = -10;
      var a = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.8 + m.ph * 3))) * m.z * quiet(m.x, m.y) * (prm.moteAlpha != null ? prm.moteAlpha : 0.7);
      if (cone) { var ddx = (m.x - cx) / cr, ddy = (m.y - cy) / (cr * 1.4); a *= Math.max(0, 1 - Math.sqrt(ddx * ddx + ddy * ddy)) * 1.6; }
      if (a < 0.02) continue;
      var r = (1.2 + m.z * 3) * (prm.moteSize != null ? prm.moteSize : 1);
      ctx.globalAlpha = Math.min(1, a); ctx.drawImage(dot2, m.x - r * 2, m.y - r * 2, r * 4, r * 4);
    }
  }
  /* ---- snow: three depths ---- */
  var flakes = [];
  if (fx.snow) for (i = 0; i < n(prm.snow, 150); i++) flakes.push({ x: R() * W, y: R() * H, z: 0.2 + R() * 0.8, ph: R() * 6.3 });
  function drawSnow(t, dt) {
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.y += (12 + 38 * f.z) * dt; f.x += (Math.sin(t * 0.5 + f.ph) * 10 + (prm.wind != null ? prm.wind : 6)) * f.z * dt + gust.vx * f.z * dt;
      if (f.y > H + 8) { f.y = -8; f.x = R() * W; } if (f.x > W + 8) f.x = -8; if (f.x < -8) f.x = W + 8;
      var a = (0.25 + f.z * 0.6) * quiet(f.x, f.y); if (a < 0.03) continue;
      var r = 0.8 + f.z * f.z * 3.2;
      ctx.globalAlpha = a; ctx.drawImage(flake, f.x - r * 2, f.y - r * 2, r * 4, r * 4);
    }
  }
  /* ---- petals / leaves: 3D flutter ---- */
  var petals = [];
  if (fx.petals || fx.leaves) for (i = 0; i < n(prm.petals, fx.leaves ? 7 : 28); i++) petals.push(newPetal(true));
  function newPetal(any) {
    var src = prm.from || [1, 0];
    return { x: any ? R() * W : px(src[0]) - R() * W * 0.5, y: any ? R() * H : py(src[1]) - 20 - R() * 80, z: 0.4 + R() * 0.6, rot: R() * 6.3, spin: 0.6 + R() * 1.6, flip: R() * 6.3, ph: R() * 6.3, col: R() < 0.5 ? C3 : C4 };
  }
  function drawPetals(t, dt) {
    var leaf = !!fx.leaves;
    for (var i = 0; i < petals.length; i++) {
      var p = petals[i];
      p.y += (leaf ? 22 : 26) * (0.5 + p.z) * dt; p.x += (Math.sin(t * 0.7 + p.ph) * 18 - (prm.wind != null ? prm.wind : 14)) * p.z * dt + gust.vx * p.z * dt;
      p.rot += p.spin * 0.4 * dt; p.flip += p.spin * dt;
      if (p.y > H + 30 || p.x < -40 || p.x > W + 40) { var q = newPetal(false); q.x = R() * (W + 200); q.y = -30; petals[i] = q; continue; }
      var s = (leaf ? 9 : 6) * (0.6 + p.z), sx = Math.cos(p.flip), a = (0.55 + p.z * 0.45) * quiet(p.x, p.y);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(sx, 1);
      ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.beginPath();
      if (leaf) { ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.9, -s * 0.2, 0, s); ctx.quadraticCurveTo(-s * 0.9, -s * 0.2, 0, -s); }
      else { ctx.moveTo(0, s); ctx.bezierCurveTo(s * 0.9, s * 0.2, s * 0.6, -s * 0.8, s * 0.15, -s * 0.7); ctx.lineTo(0, -s * 0.45); ctx.lineTo(-s * 0.15, -s * 0.7); ctx.bezierCurveTo(-s * 0.6, -s * 0.8, -s * 0.9, s * 0.2, 0, s); }
      ctx.fill();
      ctx.globalAlpha = a * 0.25; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.1, s * 0.18, s * 0.5, 0, 0, 6.3); ctx.fill();
      ctx.restore();
    }
  }
  /* ---- mist: wide soft banks drifting sideways ---- */
  var banks = [];
  if (fx.mist) for (i = 0; i < 6; i++) banks.push({ u: R(), v: (prm.mistBand || [0.5, 0.85])[0] + R() * ((prm.mistBand || [0.5, 0.85])[1] - (prm.mistBand || [0.5, 0.85])[0]), w: 0.35 + R() * 0.4, sp: (0.004 + R() * 0.006) * (R() < 0.5 ? -1 : 1), a: 0.5 + R() * 0.5 });
  function drawMist(t) {
    for (var i = 0; i < banks.length; i++) {
      var b = banks[i], u = ((b.u + t * b.sp) % 1.6 + 1.6) % 1.6 - 0.3, x = px(u), y = py(b.v), w = b.w * box.w, h = w * 0.16;
      ctx.globalAlpha = b.a * (prm.mistAlpha != null ? prm.mistAlpha : 0.14) * (0.75 + 0.25 * Math.sin(t * 0.1 + i));
      ctx.drawImage(dot0, x - w / 2, y - h / 2, w, h);
    }
  }
  /* ---- sand: spindrift streaks low over the dunes ---- */
  var grains = [];
  if (fx.sand) for (i = 0; i < n(prm.sand, 160); i++) grains.push({ x: R() * W, v: (prm.sandBand || [0.6, 1])[0] + R() * ((prm.sandBand || [0.6, 1])[1] - (prm.sandBand || [0.6, 1])[0]), z: 0.3 + R() * 0.7, ph: R() * 6.3, gust: R() });
  function drawSand(t, dt) {
    var wave = 0.5 + 0.5 * Math.sin(t * 0.18);
    ctx.strokeStyle = C2; ctx.lineCap = 'round';
    for (var i = 0; i < grains.length; i++) {
      var g = grains[i], sp = (60 + 160 * g.z) * (0.4 + wave * 0.9);
      g.x -= sp * dt; if (g.x < -30) { g.x = W + 30; g.v = (prm.sandBand || [0.6, 1])[0] + R() * ((prm.sandBand || [0.6, 1])[1] - (prm.sandBand || [0.6, 1])[0]); }
      var y = py(g.v) + Math.sin(t * 2 + g.ph + g.x * 0.01) * 3, a = 0.25 * g.z * (0.3 + wave) * quiet(g.x, y); if (a < 0.02) continue;
      ctx.globalAlpha = a; ctx.lineWidth = 0.6 + g.z; ctx.beginPath(); ctx.moveTo(g.x, y); ctx.lineTo(g.x + sp * 0.08, y + 0.5); ctx.stroke();
    }
  }
  /* ---- rays: god rays from above ---- */
  function drawRays(t) {
    var src = prm.raysFrom || [0.6, -0.1], sx = px(src[0]), sy = py(src[1]);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 6; i++) {
      var ang = 1.1 + i * 0.12 + Math.sin(t * 0.07 + i * 1.7) * 0.05, len = box.h * 1.3, wdt = 30 + 40 * ((i * 37) % 5) / 5;
      var ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
      var g = ctx.createLinearGradient(sx, sy, ex, ey); g.addColorStop(0, api.rgba(C0, (prm.rayAlpha != null ? prm.rayAlpha : 0.06) * (0.6 + 0.4 * Math.sin(t * 0.2 + i)))); g.addColorStop(1, api.rgba(C0, 0));
      ctx.fillStyle = g; ctx.globalAlpha = 1; ctx.beginPath();
      ctx.moveTo(sx, sy); ctx.lineTo(ex - Math.sin(ang) * wdt, ey + Math.cos(ang) * wdt); ctx.lineTo(ex + Math.sin(ang) * wdt, ey - Math.cos(ang) * wdt); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  /* ---- glow: breathing (or flickering) light at points in the picture ---- */
  function drawGlows(t) {
    var gl = prm.glows || [];
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < gl.length; i++) {
      var g = gl[i], x = px(g[0]), y = py(g[1]), r = g[2] * box.h, a = g[3] || 0.3;
      var k = g[4] === 'flicker' ? 0.82 + 0.18 * Math.max(Math.sin(t * 9.1 + i), Math.sin(t * 13.7 + i * 2)) * (Math.sin(t * 0.9 + i) > 0.92 ? 0.3 : 1) : 0.8 + 0.2 * Math.sin(t * 0.6 + i * 2);
      ctx.globalAlpha = a * k; ctx.drawImage(i % 2 ? dot1 : dot0, x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  /* ---- grid: synthwave floor scrolling toward you ---- */
  function drawGrid(t) {
    var hy = py(prm.horizon != null ? prm.horizon : 0.87), vx = px(prm.vanish != null ? prm.vanish : 0.5), depth = H - hy; if (depth < 8) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, hy, W, depth); ctx.clip();
    var fade = ctx.createLinearGradient(0, hy, 0, H); fade.addColorStop(0, api.rgba(C0, 0)); fade.addColorStop(0.25, api.rgba(C0, 0.5)); fade.addColorStop(1, api.rgba(C0, 0.9));
    ctx.strokeStyle = fade; ctx.globalAlpha = 0.55;
    for (var pass = 0; pass < 2; pass++) {
      ctx.lineWidth = pass ? 1 : 4; ctx.globalAlpha = pass ? 0.7 : 0.12; ctx.beginPath();
      for (var i = -24; i <= 24; i++) { ctx.moveTo(vx + i * 6, hy); ctx.lineTo(vx + i * W * 0.09, H + 40); }
      var off = (t * 0.35) % 1;
      for (var j = 0; j < 14; j++) { var z = (j + 1 - off) / 14, y = hy + depth * z * z; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 0.6; ctx.fillStyle = api.rgba(C0, 0.9); ctx.fillRect(0, hy - 0.5, W, 1);
  }
  /* ---- glass: rain beads and slow sliding drops on the window ---- */
  var beads = [], sliders = [];
  if (fx.rainglass) { for (i = 0; i < n(prm.beads, 120); i++) beads.push({ x: R() * W, y: R() * H, r: 0.8 + Math.pow(R(), 3) * 3.5, c: R() < 0.5 }); for (i = 0; i < n(prm.sliders, 7); i++) sliders.push({ x: R() * W, y: R() * H, r: 2 + R() * 2.5, v: 0, wait: R() * 8, c: R() < 0.5 }); }
  // a bead: dark refracted body, a white highlight up-left and a neon-tinted caustic below
  function bead(x, y, r, a, c) {
    ctx.globalAlpha = a * 0.55; ctx.fillStyle = api.rgba(P.bg, 0.6); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
    ctx.globalAlpha = a; ctx.drawImage(white, x - r * 0.9, y - r * 1.1, r * 1.2, r * 1.2);
    ctx.globalAlpha = a * 0.5; ctx.drawImage(c ? dot0 : dot1, x - r * 1.2, y - r * 0.2, r * 2.4, r * 1.6);
  }
  function drawGlass(t, dt) {
    for (var i = 0; i < beads.length; i++) { var b = beads[i], q = quiet(b.x, b.y); if (q > 0.2) bead(b.x, b.y, b.r, 0.5 * q, b.c); }
    for (i = 0; i < sliders.length; i++) {
      var s = sliders[i];
      if (s.wait > 0) s.wait -= dt; else { s.v = Math.min(140, s.v + 60 * dt); s.y += s.v * dt; s.x += Math.sin(s.y * 0.05) * 0.3 * dt * 30; }
      if (s.y > H + 10) { s.y = -10 - R() * H * 0.5; s.x = R() * W; s.v = 0; s.wait = 2 + R() * 10; }
      var q2 = quiet(s.x, s.y);
      if (s.v > 0) { var g = ctx.createLinearGradient(s.x, s.y - 80, s.x, s.y); g.addColorStop(0, api.rgba('#ffffff', 0)); g.addColorStop(1, api.rgba('#ffffff', 0.18 * q2)); ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = s.r * 0.8; ctx.beginPath(); ctx.moveTo(s.x, s.y - 80); ctx.lineTo(s.x, s.y); ctx.stroke(); }
      bead(s.x, s.y, s.r, 0.8 * q2, s.c);
    }
  }
  /* ---- fogged glass: the pointer wipes a clear trail that slowly fogs over again ---- */
  var fog = null, fg = null, FS = 0.25;
  function makeFog() { fog = new OffscreenCanvas(Math.max(2, Math.round(W * FS)), Math.max(2, Math.round(H * FS))); fg = fog.getContext('2d'); fg.fillStyle = api.rgba(prm.fogColor || P.bg, 1); fg.fillRect(0, 0, fog.width, fog.height); }
  function wipe(x, y) {
    if (!fg) return; fg.globalCompositeOperation = 'destination-out';
    var r = 26 * FS, g = fg.createRadialGradient(x * FS, y * FS, 0, x * FS, y * FS, r); g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    fg.fillStyle = g; fg.beginPath(); fg.arc(x * FS, y * FS, r, 0, 6.3); fg.fill(); fg.globalCompositeOperation = 'source-over';
  }
  function drawFog(t, dt) {
    if (!fog) makeFog();
    if (dt > 0) { fg.globalAlpha = Math.min(1, dt * 0.08); fg.fillStyle = api.rgba(prm.fogColor || P.bg, 1); fg.fillRect(0, 0, fog.width, fog.height); fg.globalAlpha = 1; }
    ctx.globalAlpha = prm.fogAlpha != null ? prm.fogAlpha : 0.22; ctx.imageSmoothingEnabled = true; ctx.drawImage(fog, 0, 0, W, H);
  }
  /* ---- ripples where you click (water themes) ---- */
  var rings = [];
  function drawRings(t) {
    for (var i = rings.length - 1; i >= 0; i--) {
      var r = rings[i], k = (t - r.t0) / 2.2; if (k > 1 || k < 0) { rings.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - k) * 0.45; ctx.strokeStyle = C0; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, 8 + k * 90, 0, 6.3); ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.25; ctx.beginPath(); ctx.arc(r.x, r.y, 4 + k * 55, 0, 6.3); ctx.stroke();
    }
  }
  var gust = { vx: 0, on: false, lx: 0 }, now = 0;
  fit();
  return {
    resize: function (w, h) {
      if (w === W && h === H) return;
      var sx = w / W, sy = h / H;
      [motes, flakes, petals, beads, sliders, rings].forEach(function (list) { list.forEach(function (p) { p.x *= sx; p.y *= sy; }); });
      grains.forEach(function (g) { g.x *= sx; });
      W = w; H = h; fit(); if (fog) { fog.width = fog.height = 1; } fog = null; fg = null;
    },
    zones: function () {},
    pointer: function (e) {
      if (e.overUI) { gust.on = false; return; }
      if (e.kind === 'move') { gust.vx = Math.max(-120, Math.min(120, (e.x - gust.lx) * 6)); gust.lx = e.x; gust.on = true; if (fx.fogglass) wipe(e.x, e.y); }
      if (e.kind === 'down' && fx.ripples && rings.length < 6) rings.push({ x: e.x, y: e.y, t0: now });
    },
    frame: function (t, dt) {
      now = t; gust.vx *= Math.pow(0.2, dt || 0);
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
      if (fx.fogglass) drawFog(t, dt);
      if (fx.rays) drawRays(t);
      if (fx.glows) drawGlows(t);
      if (fx.stars) drawStars(t);
      if (fx.meteor) drawMeteor(t, dt);
      if (fx.grid) drawGrid(t);
      if (fx.mist) drawMist(t);
      if (fx.sand) drawSand(t, dt);
      if (fx.motes) drawMotes(t, dt);
      if (fx.snow) drawSnow(t, dt);
      if (fx.petals || fx.leaves) drawPetals(t, dt);
      if (fx.rainglass) drawGlass(t, dt);
      if (fx.ripples) drawRings(t);
      ctx.globalAlpha = 1;
    }
  };
});
