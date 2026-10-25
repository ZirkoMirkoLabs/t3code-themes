// Koi Pond: top-down zen pond (2D canvas). Cached water floor + vignette, moving caustic net (masked out of
// text zones), koi on smooth Lissajous paths with undulating bodies and flowing fins, lily pads with lotus,
// drifting cherry petals and ripple rings on pointer move/click.
// sceneColors: [0 deep water, 1 shallow water, 2 caustic light, 3 koi orange, 4 koi white, 5 koi black, 6 lily pad, 7 lotus pink]
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var C = {
    deep: S[0] || '#03201d', shallow: S[1] || '#0e4c44', light: S[2] || '#bff5e4', orange: S[3] || '#ff7a2f',
    white: S[4] || '#f6efe4', black: S[5] || '#15110f', pad: S[6] || '#2f6b3a', pink: S[7] || '#f4a3c4', gold: '#f2c14e'
  };
  var R = api.random, TAU = Math.PI * 2, PR = api.params || {};
  var W = 1, H = 1, K = 1, base = null, vig = null, mask = null, cau = null, cc = null;
  var fish = [], pads = [], petals = [], rings = [], now = 0, lastRip = -9, lastX = -999, lastY = -999;

  function mk(w, h) { return new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); }

  // ---------- koi setup ----------
  var kinds = ['kohaku', 'orange', 'showa', 'ogon', 'kohaku', 'orange', 'showa'];
  var nKoi = Math.max(3, Math.min(7, PR.koi || 6));
  for (var i = 0; i < nKoi; i++) {
    var kind = kinds[i % kinds.length], spots = [];
    var baseCol = kind === 'kohaku' ? C.white : kind === 'orange' ? C.orange : kind === 'showa' ? C.black : C.gold;
    var spotCols = kind === 'kohaku' ? [C.orange, '#e5482a'] : kind === 'orange' ? [C.white, '#ffb067'] : kind === 'showa' ? [C.gold, C.white, C.orange] : ['#fff2c4', C.orange];
    for (var s = 0; s < 4 + Math.floor(R() * 3); s++) spots.push({ u: 0.05 + R() * 0.7, o: (R() - 0.5) * 1.2, r: 0.45 + R() * 0.55, c: spotCols[Math.floor(R() * spotCols.length)] });
    fish.push({
      base: baseCol, spots: spots, len: 0, lk: 0.8 + R() * 0.45, depth: R(),
      cx: 0.32 + R() * 0.36, cy: 0.32 + R() * 0.36, ax: 0.26 + R() * 0.2, ay: 0.24 + R() * 0.16,
      fx: 0.8 + R() * 0.5, fy: 1.1 + R() * 0.7, p1: R() * TAU, p2: R() * TAU, sp: (0.04 + R() * 0.025) * (R() < 0.5 ? 1 : -1),
      wig: 3.5 + R() * 2, ph: R() * TAU
    });
  }
  fish.sort(function (a, b) { return b.depth - a.depth; }); // deepest first
  for (var p = 0; p < (PR.petals || 16); p++) petals.push({ x: R(), y: R(), r: 3 + R() * 3, a: R() * TAU, va: (R() - 0.5) * 0.8, vx: 0.006 + R() * 0.008, vy: 0.003 + R() * 0.005, ph: R() * TAU });

  function pathPos(f, s) { return [(f.cx + f.ax * Math.sin(s * f.fx + f.p1)) * W, (f.cy + f.ay * Math.sin(s * f.fy + f.p2)) * H]; }

  // ---------- layout / cached layers ----------
  function placePads() {
    pads = []; var n = PR.pads || 6, tries = 0;
    while (pads.length < n && tries < 160) {
      tries++;
      var x = R() * W, y = R() * H, r = (30 + R() * 34) * K;
      if (api.calm(x, y, 30) > 0.15 && tries < 140) continue;
      var ok = true;
      for (var j = 0; j < pads.length; j++) { var q = pads[j]; if (Math.hypot(q.x - x, q.y - y) < (q.r + r) * 1.05) { ok = false; break; } }
      if (!ok) continue;
      pads.push({ x: x, y: y, r: r, rot: R() * TAU, notch: R() * TAU, ph: R() * TAU, lotus: false, tint: R() });
    }
    for (var k = 0; k < Math.min(2, pads.length); k++) pads[k].lotus = true;
  }
  function buildMask() {
    mask = mk(W * 0.5, H * 0.5); var m = mask.getContext('2d');
    m.scale(0.5, 0.5); m.fillStyle = '#000'; m.shadowColor = '#000'; m.shadowBlur = 40;
    (api.zones || []).forEach(function (z) { m.fillRect(z.x, z.y, z.w, z.h); });
  }
  function buildBase() {
    base = mk(W, H); var b = base.getContext('2d');
    var g = b.createRadialGradient(W * 0.6, H * 0.42, 0, W * 0.55, H * 0.5, Math.max(W, H) * 0.8);
    g.addColorStop(0, C.shallow); g.addColorStop(0.55, api.mix(C.shallow, C.deep, 0.6)); g.addColorStop(1, C.deep);
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    for (var i = 0; i < 24; i++) { // depth mottling
      var x = R() * W, y = R() * H, r = (0.08 + R() * 0.22) * Math.max(W, H);
      var c = R() < 0.55 ? C.deep : api.mix(C.shallow, C.light, 0.12);
      var lg = b.createRadialGradient(x, y, 0, x, y, r);
      lg.addColorStop(0, api.rgba(c, 0.16 + R() * 0.12)); lg.addColorStop(1, api.rgba(c, 0));
      b.fillStyle = lg; b.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (var k = 0; k < 160; k++) { // pebbles on the floor
      var px = R() * W, py = R() * H, pr = (2 + R() * 7) * K;
      b.beginPath(); b.ellipse(px, py, pr, pr * (0.6 + R() * 0.3), R() * TAU, 0, TAU);
      b.fillStyle = api.rgba(R() < 0.5 ? C.deep : C.light, 0.05 + R() * 0.05); b.fill();
    }
    vig = mk(W, H); var v = vig.getContext('2d');
    var vg = v.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.35, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    v.fillStyle = vg; v.fillRect(0, 0, W, H);
    cau = mk(W * 0.5, H * 0.5); cc = cau.getContext('2d');
  }
  function layout() {
    W = api.width; H = api.height; K = Math.max(0.55, Math.min(1.3, Math.min(W, H) / 800));
    for (var i = 0; i < fish.length; i++) fish[i].len = (70 + 45 * fish[i].lk) * K;
    buildBase(); buildMask(); placePads();
  }
  layout();

  // ---------- drawing ----------
  function caustics(t) {
    cc.clearRect(0, 0, cau.width, cau.height);
    cc.save(); cc.scale(0.5, 0.5); cc.lineCap = 'round';
    var L = Math.hypot(W, H), angs = [0.35, 1.45, 2.55];
    for (var f = 0; f < 3; f++) {
      var a = angs[f] + Math.sin(t * 0.03 + f) * 0.08, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
      for (var i = 0; i < 9; i++) {
        var off = ((i + 0.5) / 9 - 0.5) * L;
        cc.beginPath();
        for (var s = 0; s <= 30; s++) {
          var u = s / 30 - 0.5, w = Math.sin(u * 11 + t * 0.45 + i * 1.7 + f) * 26 + Math.sin(u * 27 - t * 0.7 + i * 2.9) * 9;
          var x = W / 2 + dx * u * L + nx * (off + w), y = H / 2 + dy * u * L + ny * (off + w);
          if (s) cc.lineTo(x, y); else cc.moveTo(x, y);
        }
        cc.lineWidth = 3 + 2 * Math.sin(t * 0.6 + i + f * 2);
        cc.strokeStyle = api.rgba(C.light, 0.07 + 0.04 * Math.sin(t * 0.5 + i * 1.3 + f));
        cc.stroke();
      }
    }
    cc.restore();
    cc.globalCompositeOperation = 'destination-out'; cc.globalAlpha = 0.85;
    cc.drawImage(mask, 0, 0); cc.globalAlpha = 1; cc.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(cau, 0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
  }

  function spine(f, t) {
    var s = t * f.sp, seg = f.len / 13, pts = [pathPos(f, s)], prev = pts[0], acc = 0, ds = 0.0015 * Math.sign(f.sp);
    for (var k = 0; k < 400 && pts.length < 14; k++) {
      s -= ds; var q = pathPos(f, s), d = Math.hypot(q[0] - prev[0], q[1] - prev[1]); acc += d; prev = q;
      if (acc >= seg) { pts.push(q); acc = 0; }
    }
    while (pts.length < 14) pts.push(pts[pts.length - 1].slice());
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      var tx = a[0] - b[0], ty = a[1] - b[1], tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      var u = i / (pts.length - 1), lat = Math.sin(t * f.wig - u * 4.5 + f.ph) * f.len * 0.045 * (0.2 + u);
      out.push({ x: pts[i][0] - ty * lat, y: pts[i][1] + tx * lat, tx: tx, ty: ty, u: u });
    }
    return out;
  }
  function width(u) { return Math.sin(Math.min(1, (u + 0.1) / 0.4) * Math.PI / 2) * (1 - 0.82 * Math.max(0, Math.min(1, (u - 0.3) / 0.7))); }
  function bodyPath(c, sp, mw, ox, oy) {
    var L = [], Rr = [], h = sp[0];
    for (var i = 0; i < sp.length; i++) { var q = sp[i], w = mw * width(q.u); L.push([q.x - q.ty * w + ox, q.y + q.tx * w + oy]); Rr.push([q.x + q.ty * w + ox, q.y - q.tx * w + oy]); }
    var pts = [[h.x + h.tx * mw * 0.45 + ox, h.y + h.ty * mw * 0.45 + oy]].concat(L, Rr.reverse());
    c.beginPath();
    var n = pts.length, m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
    c.moveTo(m0[0], m0[1]);
    for (var k = 0; k < n; k++) { var a = pts[k], b = pts[(k + 1) % n]; c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    c.closePath();
  }
  function fin(c, x, y, ang, len, wd, col) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -wd, len, -wd * 0.2); c.quadraticCurveTo(len * 0.6, wd * 0.6, 0, 0);
    c.fillStyle = col; c.fill(); c.restore();
  }
  function drawKoi(f, t) {
    var sp = spine(f, t), h = sp[0], mw = f.len * 0.12, calm = api.calm(h.x, h.y, 60);
    var vis = (0.6 + 0.4 * (1 - f.depth)) * (1 - 0.6 * calm), fade = f.depth * 0.35;
    var bodyCol = api.mix(f.base, C.shallow, fade), finCol = api.rgba(api.mix(f.base === C.black ? C.white : f.base, C.shallow, fade), 0.38);
    var sh = (6 + (1 - f.depth) * 10) * K;
    ctx.globalAlpha = 0.25 * vis; ctx.fillStyle = '#000'; bodyPath(ctx, sp, mw, sh, sh * 1.2); ctx.fill();
    ctx.globalAlpha = vis;
    // fins under the body
    var pf = sp[3], flap = Math.sin(t * 3 + f.ph) * 0.35, ha = Math.atan2(pf.ty, pf.tx);
    fin(ctx, pf.x - pf.ty * mw * 0.7, pf.y + pf.tx * mw * 0.7, ha + Math.PI * 0.72 - flap, mw * 1.5, mw * 0.6, finCol);
    fin(ctx, pf.x + pf.ty * mw * 0.7, pf.y - pf.tx * mw * 0.7, ha - Math.PI * 0.72 + flap, mw * 1.5, -mw * 0.6, finCol);
    var tl = sp[sp.length - 1], ta = Math.atan2(-tl.ty, -tl.tx), sw = Math.sin(t * f.wig - 4.5 + f.ph) * 0.4;
    fin(ctx, tl.x, tl.y, ta + 0.35 + sw, mw * 2.3, mw * 0.9, finCol);
    fin(ctx, tl.x, tl.y, ta - 0.35 + sw, mw * 2.3, -mw * 0.9, finCol);
    // body + patterned spots
    bodyPath(ctx, sp, mw, 0, 0); ctx.fillStyle = bodyCol; ctx.fill();
    ctx.save(); ctx.clip();
    for (var i = 0; i < f.spots.length; i++) {
      var o = f.spots[i], q = sp[Math.round(o.u * (sp.length - 1))], w = mw * width(q.u);
      ctx.beginPath(); ctx.ellipse(q.x - q.ty * w * o.o, q.y + q.tx * w * o.o, mw * o.r * 1.6, mw * o.r, Math.atan2(q.ty, q.tx), 0, TAU);
      ctx.fillStyle = api.mix(o.c, C.shallow, fade); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(sp[0].x, sp[0].y); for (var j = 1; j < 9; j++) ctx.lineTo(sp[j].x, sp[j].y);
    ctx.lineWidth = mw * 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke();
    ctx.restore();
    bodyPath(ctx, sp, mw, 0, 0); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.stroke();
    var e = sp[1], ew = mw * width(e.u) * 0.6;
    ctx.fillStyle = 'rgba(10,10,10,0.75)';
    ctx.beginPath(); ctx.arc(e.x - e.ty * ew, e.y + e.tx * ew, 1.3 * K, 0, TAU); ctx.arc(e.x + e.ty * ew, e.y - e.tx * ew, 1.3 * K, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function lotus(x, y, r, t, ph) {
    var layers = [[8, 1, 0], [7, 0.75, 0.4], [5, 0.5, 0.9]], br = Math.sin(t * 0.4 + ph) * 0.04;
    for (var l = 0; l < layers.length; l++) {
      var n = layers[l][0], len = r * layers[l][1] * (1 + br), rot = layers[l][2] + t * 0.02;
      for (var i = 0; i < n; i++) {
        var a = rot + i * TAU / n;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        var g = ctx.createLinearGradient(0, 0, len, 0); g.addColorStop(0, '#fff4f7'); g.addColorStop(1, api.mix(C.pink, '#d9568a', l === 0 ? 0.35 : 0));
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.36, len, 0); ctx.quadraticCurveTo(len * 0.5, len * 0.36, 0, 0);
        ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(160,40,90,0.25)'; ctx.stroke(); ctx.restore();
      }
    }
    ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, TAU); ctx.fillStyle = '#f2c94c'; ctx.fill();
  }
  function drawPads(t) {
    for (var i = 0; i < pads.length; i++) {
      var q = pads[i], x = q.x + Math.sin(t * 0.05 + q.ph) * 6 * K, y = q.y + Math.cos(t * 0.04 + q.ph) * 5 * K, a = q.notch + Math.sin(t * 0.03 + q.ph) * 0.15;
      var calm = api.calm(x, y, 30), al = 1 - 0.55 * calm;
      ctx.globalAlpha = 0.32 * al; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.moveTo(x + 7 * K, y + 9 * K); ctx.arc(x + 7 * K, y + 9 * K, q.r, a + 0.2, a + TAU - 0.2); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = al;
      var g = ctx.createRadialGradient(x - q.r * 0.25, y - q.r * 0.25, 0, x, y, q.r);
      var pc = api.mix(C.pad, '#6aa84f', q.tint * 0.35);
      g.addColorStop(0, api.mix(pc, '#a8d68a', 0.35)); g.addColorStop(1, api.mix(pc, '#173d22', 0.4));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, q.r, a + 0.2, a + TAU - 0.2); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(12,40,20,0.45)'; ctx.stroke();
      ctx.beginPath();
      for (var v = 1; v < 10; v++) { var va = a + 0.2 + v * (TAU - 0.4) / 10; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(va) * q.r * 0.9, y + Math.sin(va) * q.r * 0.9); }
      ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(210,240,190,0.16)'; ctx.stroke();
      if (q.lotus) lotus(x + q.r * 0.15, y - q.r * 0.1, q.r * 0.62, t, q.ph);
      ctx.globalAlpha = 1;
    }
  }
  function drawPetals(t, dt) {
    for (var i = 0; i < petals.length; i++) {
      var o = petals[i];
      o.x = (o.x + o.vx * dt + 1) % 1; o.y = (o.y + o.vy * dt + 1) % 1; o.a += o.va * dt;
      var x = o.x * W + Math.sin(t * 0.3 + o.ph) * 12, y = o.y * H + Math.cos(t * 0.25 + o.ph) * 8, r = o.r * K;
      var al = 1 - 0.6 * api.calm(x, y, 20);
      ctx.save(); ctx.translate(x, y); ctx.rotate(o.a + t * 0.1);
      ctx.globalAlpha = 0.25 * al; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(3, 4, r, r * 0.62, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.9 * al; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(-r * 0.2, -r * 0.9, r, -r * 0.25);
      ctx.lineTo(r * 0.6, 0); ctx.lineTo(r, r * 0.25); ctx.quadraticCurveTo(-r * 0.2, r * 0.9, -r, 0);
      ctx.fillStyle = api.mix(C.pink, '#ffffff', 0.35); ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function drawRings() {
    for (var i = rings.length - 1; i >= 0; i--) {
      var g = rings[i], age = now - g.t0;
      if (age < 0) continue;
      if (age > g.life || age < -1) { rings.splice(i, 1); continue; }
      var k = age / g.life, r = g.size * (0.15 + 0.85 * Math.sqrt(k)), al = (1 - k) * g.a;
      ctx.lineWidth = 1.6; ctx.strokeStyle = api.rgba(C.light, al);
      ctx.beginPath(); ctx.arc(g.x, g.y, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = api.rgba(C.light, al * 0.5);
      ctx.beginPath(); ctx.arc(g.x, g.y, r * 0.7, 0, TAU); ctx.stroke();
    }
  }
  function ripple(x, y, size, a, delay) { if (rings.length < 30) rings.push({ x: x, y: y, t0: now + (delay || 0), size: size * K, a: a, life: 2.4 }); }

  return {
    resize: layout,
    zones: function () { buildMask(); placePads(); },
    pointer: function (e) {
      if (e.overUI) return;
      if (e.kind === 'down') { ripple(e.x, e.y, 120, 0.55, 0); ripple(e.x, e.y, 90, 0.4, 0.25); ripple(e.x, e.y, 60, 0.3, 0.5); }
      else if (e.kind === 'move' && Math.hypot(e.x - lastX, e.y - lastY) > 60 && now - lastRip > 0.2) {
        ripple(e.x, e.y, 55, 0.3, 0); lastX = e.x; lastY = e.y; lastRip = now;
      }
    },
    frame: function (t, dt) {
      if (now - t > 1) rings.length = 0;
      now = t;
      ctx.drawImage(base, 0, 0, W, H);
      for (var i = 0; i < fish.length; i++) drawKoi(fish[i], t);
      caustics(t);
      drawPads(t);
      drawPetals(t, dt || 0);
      drawRings();
      ctx.drawImage(vig, 0, 0, W, H);
    }
  };
});
