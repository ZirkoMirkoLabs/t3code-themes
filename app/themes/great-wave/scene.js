// Great Wave: an ukiyo-e woodblock seascape (2D canvas). A towering prussian-blue wave curls over in the
// largest free area, its foam lip breaking into clawed fingers that flex and curl; smaller swells roll
// beneath, a tiny snow-capped mountain sits on the horizon and washi grain covers everything. Text zones
// get a paper wash so the UI stays calm.
// sceneColors: [0] paper, [1] dusk sky band, [2] prussian deep, [3] mid blue, [4] light blue,
//              [5] foam cream, [6] ink line, [7] seal red.
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var PAPER = S[0] || '#efe6d0', DUSK = S[1] || '#d8c7a2', DEEP = S[2] || '#16365e', MID = S[3] || '#2d5d8f',
    LIGHT = S[4] || '#7fa6c9', FOAM = S[5] || '#fbf7ec', INK = S[6] || '#0f2140';
  var CURL = api.params.curl || 1, N = 48;
  var W = 1, H = 1, sky = null, grainPat = null, horizon = 0, midY = 0, frontY = 0;
  var wave = { x: 0, y: 0, s: 100 }, fuji = { x: 0, w: 60 };
  var sx = new Float32Array(N + 1), sy = new Float32Array(N + 1), sa = new Float32Array(N + 1), sh = new Float32Array(N + 1);
  var spray = [];
  for (var i = 0; i < 150; i++) spray.push({ u: 0.4 + api.random() * 0.6, p: api.random(), v: 0.05 + api.random() * 0.1,
    r: 0.7 + api.random() * 2, dx: -0.1 - api.random() * 0.5, dy: -0.3 + api.random() * 0.5 });

  function mk(w, h) { return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))) : null; }
  (function makeGrain() {
    var c = mk(160, 160); if (!c) return;
    var g = c.getContext('2d');
    for (var k = 0; k < 1500; k++) {
      g.fillStyle = api.random() < 0.55 ? api.rgba(INK, 0.03 + api.random() * 0.05) : 'rgba(255,255,255,0.10)';
      g.fillRect(api.random() * 160, api.random() * 160, 0.6 + api.random() * 1.4, 0.6 + api.random() * 0.8);
    }
    g.lineWidth = 0.6;
    for (var f = 0; f < 36; f++) {
      var x = api.random() * 160, y = api.random() * 160, l = 10 + api.random() * 30;
      g.strokeStyle = api.rgba(INK, 0.03 + api.random() * 0.03);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y + (api.random() - 0.5) * 6, x + l, y + (api.random() - 0.5) * 4); g.stroke();
    }
    grainPat = ctx.createPattern(c, 'repeat');
  })();

  function drawFuji(g) {
    var x = fuji.x, w = fuji.w, h = w * 0.34, b = horizon + 1, top = b - h, tw = w * 0.09;
    g.beginPath(); g.moveTo(x - w / 2, b);
    g.quadraticCurveTo(x - w * 0.2, b - h * 0.35, x - tw, top);
    g.lineTo(x + tw, top);
    g.quadraticCurveTo(x + w * 0.2, b - h * 0.35, x + w / 2, b);
    g.closePath(); g.fillStyle = api.mix(MID, PAPER, 0.35); g.fill();
    g.lineWidth = 1; g.strokeStyle = api.rgba(INK, 0.55); g.stroke();
    // snow cap with a jagged lower edge
    var d = h * 0.42, spread = (w / 2 - tw) * Math.pow(d / h, 1.4);
    g.beginPath(); g.moveTo(x - tw, top); g.lineTo(x + tw, top); g.lineTo(x + tw + spread, top + d);
    var steps = 6;
    for (var k = 1; k < steps; k++) {
      var px = x + tw + spread - (2 * (tw + spread)) * k / steps;
      g.lineTo(px, top + d * (k % 2 ? 0.55 : 0.95));
    }
    g.lineTo(x - tw - spread, top + d); g.closePath();
    g.fillStyle = FOAM; g.fill(); g.lineWidth = 0.8; g.strokeStyle = api.rgba(INK, 0.5); g.stroke();
  }

  function paintBack(g) {
    var gr = g.createLinearGradient(0, 0, 0, horizon);
    gr.addColorStop(0, api.mix(DUSK, INK, 0.12)); gr.addColorStop(0.3, DUSK); gr.addColorStop(0.8, PAPER); gr.addColorStop(1, api.mix(PAPER, '#ffffff', 0.25));
    g.fillStyle = gr; g.fillRect(0, 0, W, horizon + 1);
    // flat stylised cloud bands
    g.fillStyle = api.rgba(api.mix(DUSK, PAPER, 0.6), 0.75);
    for (var c = 0; c < 3; c++) {
      var cy = horizon * (0.22 + c * 0.17), cx = W * (0.2 + 0.3 * c), cw = W * 0.18, ch = 4 + c * 2;
      g.beginPath(); g.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2); g.fill();
    }
    // pale distant sea
    var sg = g.createLinearGradient(0, horizon, 0, H);
    sg.addColorStop(0, api.mix(LIGHT, PAPER, 0.55)); sg.addColorStop(1, api.mix(MID, PAPER, 0.4));
    g.fillStyle = sg; g.fillRect(0, horizon, W, H - horizon);
    drawFuji(g);
  }

  function bake() {
    var dpr = api.dpr || 1; sky = mk(W * dpr, H * dpr);
    if (!sky) return;
    var g = sky.getContext('2d'); g.scale(dpr, dpr); paintBack(g);
  }

  function layout() {
    W = api.width; H = api.height;
    horizon = Math.round(H * 0.6); frontY = horizon + (H - horizon) * 0.58; midY = horizon + (frontY - horizon) * 0.42;
    var f = api.free(24);
    if (!f || f.w < 160 || f.h < 160) f = { x: W * 0.5, y: 0, w: W * 0.5, h: H };
    var s = Math.max(70, Math.min(460, Math.min(f.w * 0.55, (frontY - Math.max(f.y, 20)) * 0.9)));
    wave.s = s; wave.x = f.x + f.w * 0.62; wave.y = frontY + s * 0.15;
    fuji.w = Math.max(50, s * 0.5); fuji.x = Math.max(fuji.w * 0.6, Math.min(W - fuji.w * 0.6, wave.x - s * 0.95));
    bake();
  }

  // rolling swell band with woodblock contour lines and small clawed crests
  function row(y0, amp, wl, ph, body, line, foam, lines) {
    var x, s, L;
    ctx.beginPath(); ctx.moveTo(-10, H + 2);
    for (x = -10; x <= W + 12; x += 6) { s = 0.5 + 0.5 * Math.sin((x / wl + ph) * Math.PI * 2); ctx.lineTo(x, y0 - amp * s * s * s); }
    ctx.lineTo(W + 12, H + 2); ctx.closePath();
    ctx.fillStyle = body; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = line; ctx.stroke();
    ctx.lineWidth = 0.9; ctx.strokeStyle = api.rgba(LIGHT, 0.6);
    for (L = 1; L <= lines; L++) {
      ctx.beginPath();
      for (x = -10; x <= W + 12; x += 8) { s = 0.5 + 0.5 * Math.sin((x / wl + ph - L * 0.06) * Math.PI * 2); var yy = y0 + L * amp * 0.5 - amp * 0.7 * s * s * s; x <= -10 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      ctx.stroke();
    }
    if (!foam) return;
    ctx.fillStyle = FOAM;
    var n0 = Math.floor(ph) - 1, n1 = Math.ceil(W / wl + ph) + 1;
    for (var n = n0; n <= n1; n++) {
      var cx = (n + 0.25 - ph) * wl, cy = y0 - amp;
      if (cx < -30 || cx > W + 30) continue;
      for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx - k * amp * 0.35 - amp * 0.1, cy + k * amp * 0.12 + amp * 0.05, Math.max(0.8, amp * (0.16 - k * 0.03)), 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function spine(t) {
    var s = wave.s, T = (4.0 + 0.2 * Math.sin(t * 0.42)) * CURL, sumW = 0, k, u;
    for (k = 0; k < N; k++) { u = k / N; sumW += 0.25 + Math.pow(u, 1.6); }
    var x = wave.x + s * 0.42 + Math.sin(t * 0.3) * s * 0.015, y = wave.y, a = -1.75;
    for (k = 0; k <= N; k++) {
      u = k / N;
      sx[k] = x; sy[k] = y; sa[k] = a; sh[k] = s * (0.2 * Math.pow(1 - u, 1.15) + 0.008);
      var ds = s * 1.8 / N * (1 - 0.62 * u);
      x += Math.cos(a) * ds; y += Math.sin(a) * ds;
      a -= T * (0.25 + Math.pow(u, 1.6)) / sumW;
    }
  }
  function ox(k, f) { return sx[k] - Math.sin(sa[k]) * sh[k] * f; }
  function oy(k, f) { return sy[k] + Math.cos(sa[k]) * sh[k] * f; }
  function tongue(f0, f1, k0, k1) {
    var k; ctx.beginPath(); ctx.moveTo(ox(k0, f0), oy(k0, f0));
    for (k = k0 + 1; k <= k1; k++) ctx.lineTo(ox(k, f0), oy(k, f0));
    for (k = k1; k >= k0; k--) ctx.lineTo(ox(k, f1), oy(k, f1));
    ctx.closePath();
  }
  function flow(f, k0, k1) { ctx.beginPath(); ctx.moveTo(ox(k0, f), oy(k0, f)); for (var k = k0 + 1; k <= k1; k++) ctx.lineTo(ox(k, f), oy(k, f)); ctx.stroke(); }
  function claw(bx, by, ax, ay, px, py, L, bw) {
    var tx = bx + ax * L + px * L * 0.4, ty = by + ay * L + py * L * 0.4;
    ctx.beginPath(); ctx.moveTo(bx - px * bw, by - py * bw);
    ctx.quadraticCurveTo(bx + ax * L * 0.7 - px * bw * 0.4, by + ay * L * 0.7 - py * bw * 0.4, tx, ty);
    ctx.quadraticCurveTo(bx + ax * L * 0.4 + px * bw * 1.3, by + ay * L * 0.4 + py * bw * 1.3, bx + px * bw, by + py * bw);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function bigWave(t) {
    var s = wave.s, kb = Math.round(N * 0.32), k, m;
    // long back slope rising from the right
    ctx.beginPath(); ctx.moveTo(wave.x + s * 1.4, H + 2); ctx.lineTo(wave.x + s * 1.4, wave.y - s * 0.02);
    ctx.quadraticCurveTo(wave.x + s * 0.8, wave.y - s * 0.05, ox(kb, 1), oy(kb, 1));
    for (k = kb; k >= 0; k--) ctx.lineTo(ox(k, 1), oy(k, 1));
    ctx.lineTo(sx[0], H + 2); ctx.closePath(); ctx.fillStyle = DEEP; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = api.rgba(LIGHT, 0.55);
    for (m = 1; m <= 3; m++) {
      ctx.beginPath(); ctx.moveTo(wave.x + s * 1.4, wave.y + s * 0.05 * m);
      ctx.quadraticCurveTo(wave.x + s * (0.85 - 0.05 * m), wave.y + s * (0.04 * m - 0.03), ox(Math.max(0, kb - 3 * m), 0.6), oy(Math.max(0, kb - 3 * m), 0.6));
      ctx.stroke();
    }
    // the curling tongue: deep body, lighter inner band, flowing line work
    tongue(1, -1, 0, N); ctx.fillStyle = DEEP; ctx.fill();
    tongue(-0.25, -1, 0, N); ctx.fillStyle = MID; ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = api.rgba(LIGHT, 0.9);
    flow(-0.7, 2, N - 4); flow(-0.45, 2, N - 6); flow(0.1, 1, N - 3); flow(0.45, 1, N - 8);
    // foam lip with a scalloped inner edge
    var kf = Math.round(N * 0.38);
    ctx.beginPath(); ctx.moveTo(ox(kf, 1), oy(kf, 1));
    for (k = kf + 1; k <= N; k++) ctx.lineTo(ox(k, 1), oy(k, 1));
    for (k = N; k >= kf; k--) { var f1 = 1 - 0.75 * Math.min(1, (k - kf) / 6) + 0.08 * Math.sin(k * 1.7 + t * 2); ctx.lineTo(ox(k, f1), oy(k, f1)); }
    ctx.closePath(); ctx.fillStyle = FOAM; ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = INK; tongue(1, -1, 0, N); ctx.stroke();
    // clawed foam fingers that flex and curl
    ctx.fillStyle = FOAM; ctx.strokeStyle = api.rgba(INK, 0.8); ctx.lineWidth = 0.9;
    var F = 16;
    for (var j = 0; j < F; j++) {
      var u = 0.4 + 0.58 * j / (F - 1); k = Math.round(u * N);
      var a = sa[k], dx = Math.cos(a), dy = Math.sin(a), nx = -Math.sin(a), ny = Math.cos(a);
      var bx = ox(k, 0.95), by = oy(k, 0.95), c = 0.55 + 0.3 * Math.sin(t * 0.9 + j * 1.3);
      var ax = nx * Math.cos(c) + dx * Math.sin(c), ay = ny * Math.cos(c) + dy * Math.sin(c);
      var L = s * (0.06 + 0.035 * Math.sin(t * 1.1 + j * 2.1)) * (1.2 - 0.5 * u), bw = s * 0.016;
      claw(bx, by, ax, ay, dx, dy, L, bw);
      var mx = bx + ax * L * 0.45, my = by + ay * L * 0.45;
      for (var q = -1; q <= 1; q += 2) {
        var cb = c + q * 0.55;
        claw(mx, my, nx * Math.cos(cb) + dx * Math.sin(cb), ny * Math.cos(cb) + dy * Math.sin(cb), dx, dy, L * 0.5, bw * 0.55);
      }
    }
    // drifting spray dots thrown off the lip
    ctx.lineWidth = 0.6;
    for (var i = 0; i < spray.length; i++) {
      var o = spray[i], ks = Math.round(o.u * N), age = (t * o.v + o.p) % 1;
      var x = ox(ks, 1) + o.dx * s * 0.6 * age, y = oy(ks, 1) + o.dy * s * 0.5 * age + age * age * s * 0.25;
      var al = (1 - age) * Math.min(1, age * 6) * (1 - api.calm(x, y, 40) * 0.8);
      if (al <= 0.02) continue;
      ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(x, y, o.r * (1 - age * 0.4), 0, 6.283);
      ctx.fillStyle = FOAM; ctx.fill(); ctx.strokeStyle = api.rgba(INK, 0.45); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // paper wash over text zones so the UI stays calm
  function wash() {
    var z = api.zones || [];
    ctx.fillStyle = api.rgba(PAPER, 0.18);
    for (var i = 0; i < z.length; i++) {
      var r = z[i]; if (r.kind === 'topbar') continue;
      for (var e = 24; e >= 0; e -= 8) ctx.fillRect(r.x - e, r.y - e, r.w + e * 2, r.h + e * 2);
    }
  }

  layout();
  return {
    resize: layout,
    zones: layout,
    frame: function (t) {
      if (sky) ctx.drawImage(sky, 0, 0, W, H); else paintBack(ctx);
      row(horizon + 3, 2.5, 40, t * 0.04, api.mix(LIGHT, PAPER, 0.3), api.rgba(INK, 0.3), false, 0);
      row(midY, 8, 110, t * 0.06, api.mix(MID, PAPER, 0.25), api.rgba(INK, 0.55), true, 1);
      spine(t); bigWave(t);
      row(frontY, 20, 220, t * 0.08 + 0.37, DEEP, INK, true, 2);
      wash();
      if (grainPat) { ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W, H); }
    }
  };
});
