// Golden Hour (rooftop-dusk): anime-film golden hour above a city rooftop. Cached layers: sky + sun bloom,
// two drifting cumulus layers (lit tops, violet undersides, glowing rims), skyline with haze, foreground
// water tower, poles and wires. Live: sun breathing, windows slowly lighting up, birds, soft lens flare.
// sceneColors: [0] sky top violet, [1] sky rose, [2] horizon gold, [3] sun core, [4] cloud shadow,
// [5] cloud lit, [6] silhouette ink, [7] window light.
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var C = {
    top: S[0] || '#2c2160', mid: S[1] || '#d9789a', low: S[2] || '#ffc070', sun: S[3] || '#fff3cf',
    shade: S[4] || '#7d5a92', lit: S[5] || '#ffd9a3', ink: S[6] || '#1b1230', win: S[7] || '#ffcf7a'
  };
  var speed = (api.params && api.params.cloudSpeed) || 1;
  var W = 0, H = 0, D = 1, horizon = 0, sx = 0, sy = 0;
  var sky, far, near, city, fg, windows = [], birds = [];
  var seed = Math.floor(api.random() * 1e9), TAU = Math.PI * 2;

  function prng(s) {
    return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function layer(w, h, d) {
    var c = new OffscreenCanvas(Math.max(1, Math.ceil(w * d)), Math.max(1, Math.ceil(h * d)));
    var g = c.getContext('2d'); g.scale(d, d); return { c: c, g: g, w: w, h: h };
  }

  function buildSky() {
    sky = layer(W, H, 1); var g = sky.g;
    var gr = g.createLinearGradient(0, 0, 0, horizon);
    gr.addColorStop(0, C.top); gr.addColorStop(0.42, api.mix(C.top, C.mid, 0.55)); gr.addColorStop(0.78, C.mid); gr.addColorStop(1, C.low);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = C.low; g.fillRect(0, horizon, W, H - horizon);
    var r = Math.max(W, H) * 0.8, b = g.createRadialGradient(sx, sy, 0, sx, sy, r);
    b.addColorStop(0, api.rgba(C.sun, 0.9)); b.addColorStop(0.06, api.rgba(C.low, 0.65)); b.addColorStop(0.3, api.rgba(C.low, 0.2)); b.addColorStop(1, api.rgba(C.low, 0));
    g.fillStyle = b; g.fillRect(0, 0, W, H);
    var R = prng(seed + 1);
    for (var i = 0; i < 9; i++) { // thin high cirrus streaks
      var y = H * (0.06 + R() * 0.3), x = R() * W, w = W * (0.18 + R() * 0.35), h = 1.5 + R() * 4;
      var cg = g.createLinearGradient(x, 0, x + w, 0);
      cg.addColorStop(0, api.rgba(C.lit, 0)); cg.addColorStop(0.5, api.rgba(C.lit, 0.1 + R() * 0.14)); cg.addColorStop(1, api.rgba(C.lit, 0));
      g.fillStyle = cg; g.beginPath(); g.ellipse(x + w / 2, y, w / 2, h, -0.04, 0, TAU); g.fill();
    }
    g.beginPath(); g.arc(sx, sy, Math.max(10, H * 0.03), 0, TAU); g.fillStyle = api.rgba(C.sun, 0.95); g.fill();
  }

  function buildClouds(LW, n, scale, baseY, k, alpha, haze) {
    var L = layer(LW, H, 1), g = L.g, R = prng(seed + k);
    var lit = api.mix(api.mix(C.lit, C.sun, 0.3), C.mid, haze), body = api.mix(api.mix(C.lit, C.mid, 0.5), C.mid, haze);
    var under = api.mix(api.mix(C.shade, C.top, 0.25), C.mid, haze * 0.8);
    for (var i = 0; i < n; i++) {
      var cw = W * (0.14 + R() * 0.14) * scale, ch = Math.min(H * 0.55, cw * (0.7 + R() * 0.6));
      var cx = cw * 0.9 + 24 + (LW - cw * 1.8 - 48) * ((i + 0.5 + (R() - 0.5) * 0.5) / n), by = baseY + (R() - 0.5) * H * 0.05;
      var puffs = [], rows = 5 + Math.floor(R() * 3), lean = (R() - 0.5) * cw * 0.3;
      for (var r = 0; r < rows; r++) {
        var f = r / (rows - 1), rw = cw * (0.5 - f * 0.3), y = by - f * ch, cnt = 2 + Math.floor((1 - f) * 4);
        for (var j = 0; j < cnt; j++) {
          var px = cx + lean * f + (cnt === 1 ? 0 : (j / (cnt - 1) - 0.5) * rw * 2) + (R() - 0.5) * cw * 0.06;
          var pr = cw * (0.12 + (1 - f) * 0.07) * (0.75 + R() * 0.5);
          puffs.push([px, y - pr * 0.15, pr]);
        }
      }
      var top = by - ch - cw * 0.2, bot = by + cw * 0.05;
      g.save(); g.globalAlpha = alpha;
      g.beginPath(); g.rect(0, 0, LW, by + cw * 0.03); g.clip(); // flat cumulus base
      g.beginPath(); puffs.forEach(function (p) { g.moveTo(p[0] + p[2], p[1]); g.arc(p[0], p[1], p[2], 0, TAU); });
      var vg = g.createLinearGradient(0, top, 0, bot);
      vg.addColorStop(0, lit); vg.addColorStop(0.5, body); vg.addColorStop(1, under);
      g.shadowColor = api.rgba(C.sun, 0.55); g.shadowBlur = 22; g.fillStyle = vg; g.fill(); g.shadowBlur = 0;
      g.clip();
      puffs.forEach(function (p) { // shaded crevices under each puff
        var hx = p[0] - p[2] * 0.2, hy = p[1] + p[2] * 0.75, rg = g.createRadialGradient(hx, hy, 0, hx, hy, p[2] * 0.85);
        rg.addColorStop(0, api.rgba(C.shade, 0.32)); rg.addColorStop(1, api.rgba(C.shade, 0));
        g.fillStyle = rg; g.fillRect(hx - p[2], hy - p[2], p[2] * 2, p[2] * 2);
      });
      puffs.forEach(function (p) { // sunlit caps
        var hx = p[0] + p[2] * 0.2, hy = p[1] - p[2] * 0.6, rg = g.createRadialGradient(hx, hy, 0, hx, hy, p[2] * 0.9);
        rg.addColorStop(0, api.rgba(C.sun, 0.5)); rg.addColorStop(1, api.rgba(C.sun, 0));
        g.fillStyle = rg; g.fillRect(hx - p[2], hy - p[2], p[2] * 2, p[2] * 2);
      });
      g.restore();
    }
    return L;
  }

  function buildCity() {
    city = layer(W, H, D); var g = city.g, R = prng(seed + 7); windows = [];
    function row(base, minH, maxH, minW, maxW, col, winP) {
      var x = -10;
      while (x < W + 10) {
        var bw = minW + R() * (maxW - minW), bh = minH + R() * (maxH - minH);
        if (R() < 0.12) bh *= 1.7;
        g.fillStyle = col; g.fillRect(x, base - bh, bw + 1, H - base + bh);
        if (R() < 0.22) g.fillRect(x + bw * 0.4, base - bh * 1.18, 2, bh * 0.18);
        if (winP > 0) for (var wy = base - bh + 6; wy < base - 4; wy += 7) for (var wx = x + 4; wx < x + bw - 5; wx += 6)
          if (R() < winP && windows.length < 380) windows.push([wx, wy, R(), R(), api.calm ? api.calm(wx, wy, 40) : 0]);
        x += bw + (R() < 0.3 ? R() * 8 : 0);
      }
    }
    row(horizon + H * 0.01, H * 0.03, H * 0.09, W * 0.018, W * 0.045, api.mix(C.ink, C.mid, 0.5), 0);
    var hz = g.createLinearGradient(0, horizon - H * 0.05, 0, horizon + H * 0.07);
    hz.addColorStop(0, api.rgba(C.low, 0)); hz.addColorStop(0.6, api.rgba(C.low, 0.35)); hz.addColorStop(1, api.rgba(C.mid, 0.15));
    g.fillStyle = hz; g.fillRect(0, horizon - H * 0.05, W, H * 0.12);
    row(horizon + H * 0.07, H * 0.04, H * 0.13, W * 0.024, W * 0.06, api.mix(C.ink, C.shade, 0.28), 0.38);
  }

  function wire(g, x0, y0, x1, y1, sag) {
    var prev = null;
    for (var i = 0; i <= 40; i++) {
      var f = i / 40, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f + sag * 4 * f * (1 - f);
      if (prev) { g.globalAlpha = 0.9 * (1 - 0.75 * (api.calm ? api.calm(x, y, 30) : 0)); g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(x, y); g.stroke(); }
      prev = [x, y];
    }
    g.globalAlpha = 1;
  }

  function buildFg() {
    fg = layer(W, H, D); var g = fg.g, roof = H * 0.9;
    g.fillStyle = C.ink; g.fillRect(0, roof, W, H - roof);
    g.fillStyle = api.rgba(C.low, 0.45); g.fillRect(0, roof, W, 1.5);
    // water tower
    var tx = W * 0.83, tw = Math.max(46, H * 0.11), legTop = roof - H * 0.11, tankH = H * 0.12, tankTop = legTop - tankH;
    g.strokeStyle = C.ink; g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(tx - tw * 0.42, legTop); g.lineTo(tx - tw * 0.5, roof); g.moveTo(tx + tw * 0.42, legTop); g.lineTo(tx + tw * 0.5, roof);
    g.moveTo(tx - tw * 0.14, legTop); g.lineTo(tx - tw * 0.17, roof); g.moveTo(tx + tw * 0.14, legTop); g.lineTo(tx + tw * 0.17, roof);
    g.moveTo(tx - tw * 0.46, legTop + (roof - legTop) * 0.5); g.lineTo(tx + tw * 0.46, legTop + (roof - legTop) * 0.5);
    g.moveTo(tx - tw * 0.44, legTop); g.lineTo(tx + tw * 0.48, roof); g.moveTo(tx + tw * 0.44, legTop); g.lineTo(tx - tw * 0.48, roof);
    g.stroke();
    g.fillStyle = C.ink; g.fillRect(tx - tw * 0.5, legTop - 3, tw, 4);
    g.fillRect(tx - tw * 0.45, tankTop, tw * 0.9, tankH);
    g.beginPath(); g.moveTo(tx - tw * 0.5, tankTop + 1); g.lineTo(tx, tankTop - tw * 0.32); g.lineTo(tx + tw * 0.5, tankTop + 1); g.closePath(); g.fill();
    g.fillRect(tx - 1, tankTop - tw * 0.42, 2, tw * 0.12);
    var side = sx > tx ? 1 : -1; // rim light on the sun-facing edge
    g.fillStyle = api.rgba(C.low, 0.55); g.fillRect(tx + side * tw * 0.45 - (side > 0 ? 1.5 : 0), tankTop, 1.5, tankH);
    g.strokeStyle = api.rgba(C.low, 0.25); g.lineWidth = 1;
    for (var b = 1; b < 4; b++) { g.beginPath(); g.moveTo(tx - tw * 0.45, tankTop + tankH * b / 4); g.lineTo(tx + tw * 0.45, tankTop + tankH * b / 4); g.stroke(); }
    // utility poles + sagging wires
    var p1 = W * 0.6, p1t = H * 0.34, p2 = W * 1.02, p2t = H * 0.3;
    g.fillStyle = C.ink;
    g.fillRect(p1 - 3, p1t, 6, H - p1t); g.fillRect(p1 - 26, p1t + 10, 52, 3); g.fillRect(p1 - 20, p1t + 26, 40, 3);
    g.fillRect(p2 - 4, p2t, 8, H - p2t); g.fillRect(p2 - 30, p2t + 10, 60, 3);
    g.strokeStyle = C.ink; g.lineWidth = 1.1;
    [-24, -8, 8, 24].forEach(function (o, i) {
      wire(g, p1 + o, p1t + 10, p2 + o * 1.1, p2t + 10, H * (0.05 + i * 0.008));
      wire(g, -20, H * 0.43 + o * 0.4, p1 + o, p1t + 10, H * (0.07 + i * 0.01));
    });
    wire(g, p1 - 18, p1t + 26, p2 - 18, p2t + 10, H * 0.08);
  }

  function makeBirds() {
    var R = prng(seed + 11); birds = [];
    for (var i = 0; i < 7; i++) birds.push({ x: R(), y: 0.16 + R() * 0.24, v: 10 + R() * 12, s: 3 + R() * 3.5, f: 4 + R() * 3, p: R() * TAU, bob: 4 + R() * 8 });
  }

  function layout() {
    W = api.width; H = api.height; D = Math.min(2, api.dpr || 1); horizon = H * 0.72;
    var f = api.free ? api.free(24) : null;
    if (!f || f.w < 40) f = { x: W * 0.5, y: 0, w: W * 0.5, h: H };
    sx = f.x + f.w * 0.55; sy = Math.min(horizon - H * 0.12, Math.max(H * 0.32, f.y + f.h * 0.5));
    buildSky();
    far = buildClouds(W * 1.7, 6, 0.6, horizon - H * 0.03, 3, 0.75, 0.35);
    near = buildClouds(W * 1.6, 3, 1.25, horizon - H * 0.07, 5, 1, 0);
    buildCity(); buildFg(); makeBirds();
  }

  function drift(L, off) {
    off = ((off % L.w) + L.w) % L.w;
    ctx.drawImage(L.c, -off, 0, L.w, H);
    if (L.w - off < W) ctx.drawImage(L.c, L.w - off, 0, L.w, H);
  }

  layout();

  return {
    resize: layout,
    zones: layout,
    frame: function (t) {
      ctx.drawImage(sky.c, 0, 0, W, H);
      drift(far, t * 2.2 * speed + W * 0.3);
      drift(near, t * 4 * speed);
      // breathing warm bloom over the clouds near the sun
      var br = 0.85 + 0.15 * Math.sin(t * 0.35), gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.55);
      gr.addColorStop(0, api.rgba(C.sun, 0.45 * br)); gr.addColorStop(0.25, api.rgba(C.low, 0.16 * br)); gr.addColorStop(1, api.rgba(C.low, 0));
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(city.c, 0, 0, W, H);
      // windows slowly switching on and off (long, offset cycles)
      ctx.fillStyle = C.win;
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i], k = Math.sin((t / 160 + w[2]) * TAU), on = Math.min(1, Math.max(0, (k + 0.15) * 2.5));
        if (on > 0.02) { ctx.globalAlpha = on * (0.5 + 0.45 * w[3]) * (1 - 0.6 * w[4]); ctx.fillRect(w[0], w[1], 2.5, 3.5); }
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(fg.c, 0, 0, W, H);
      // birds
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      for (var b = 0; b < birds.length; b++) {
        var o = birds[b], span = W + 200, x = ((o.x * span + t * o.v) % span) - 100, y = H * o.y + Math.sin(t * 0.5 + o.p) * o.bob;
        var fl = Math.sin(t * o.f + o.p), s = o.s, calm = api.calm ? api.calm(x, y, 40) : 0;
        ctx.globalAlpha = 0.85 * (1 - 0.8 * calm);
        ctx.beginPath(); ctx.moveTo(x - s * 2, y - s * fl * 0.8); ctx.quadraticCurveTo(x - s, y - s * (0.4 + fl * 0.4), x, y);
        ctx.quadraticCurveTo(x + s, y - s * (0.4 + fl * 0.4), x + s * 2, y - s * fl * 0.8); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // soft lens flare: anamorphic streak + ghosts along the sun-centre axis
      ctx.globalCompositeOperation = 'lighter';
      var sl = W * 0.35, sg = ctx.createLinearGradient(sx - sl, 0, sx + sl, 0);
      sg.addColorStop(0, api.rgba(C.low, 0)); sg.addColorStop(0.5, api.rgba(C.sun, 0.28 * br)); sg.addColorStop(1, api.rgba(C.low, 0));
      ctx.fillStyle = sg; ctx.fillRect(sx - sl, sy - 1.5, sl * 2, 3);
      var cx = W * 0.5, cy = H * 0.5, ghosts = [[0.35, 0.025, C.sun], [0.6, 0.06, C.low], [0.85, 0.035, C.mid], [1.2, 0.09, C.lit], [1.45, 0.04, '#9fd0ff']];
      for (var gI = 0; gI < ghosts.length; gI++) {
        var gh = ghosts[gI], gx = sx + (cx - sx) * gh[0], gy = sy + (cy - sy) * gh[0], rr = H * gh[1];
        var a = 0.09 * br * (1 - (api.calm ? api.calm(gx, gy, 60) : 0));
        if (a < 0.005) continue;
        var rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, rr);
        rg.addColorStop(0, api.rgba(gh[2], a * 0.4)); rg.addColorStop(0.75, api.rgba(gh[2], a)); rg.addColorStop(1, api.rgba(gh[2], 0));
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(gx, gy, rr, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  };
});
