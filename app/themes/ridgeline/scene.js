// Ridgeline: Firewatch-style layered flat mountain ranges at sunset (2D canvas, cached layers).
// sceneColors: [0] sky top, [1] sky mid magenta, [2] horizon orange, [3] sun core, [4] far-ridge haze,
// [5] nearest ridge, [6] fog, [7] birds. Sky, sun and every ridge are cached in resize()/zones(); per frame
// only drawImage with pointer parallax, drifting fog sprites in the valleys, a sun pulse and a small flock.
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var C = { top: S[0] || '#1a0b2e', mid: S[1] || '#6b1f5c', hor: S[2] || '#ff7a45', sun: S[3] || '#ffd9a0',
    haze: S[4] || '#e0567a', near: S[5] || '#140a22', fog: S[6] || '#f3a6b8', bird: S[7] || '#1a0d24' };
  var NL = Math.max(5, Math.min(8, api.params.layers || 7)), PAD = 36;
  var W = 1, H = 1, sky = null, fog = null, layers = [], sunX = 0, sunY = 0, sunR = 60, hz = 0;
  var mx = 0, my = 0, tmx = 0, tmy = 0, seed = api.random() * 100, flockOff = api.random();
  var seedInt = 1 + Math.floor(api.random() * 2147483000), rs = seedInt;
  function rnd() { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; }
  var birds = [];
  for (var b = 0; b < 7; b++) birds.push({ dx: (b - 3) * 16 + (api.random() - 0.5) * 14, dy: Math.abs(b - 3) * 6 + (api.random() - 0.5) * 8, ph: api.random() * 6.28, s: 0.75 + api.random() * 0.45 });

  function mk(w, h) { return new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); }
  function ridge(i, x, base, amp) {
    var f = 0.0022 * (1 + i * 0.28), s = seed + i * 3.7;
    var y = Math.sin(x * f + s) * 0.45 + Math.sin(x * f * 2.17 + s * 1.3) * 0.2 + (api.noise(x * f * 2.6 + s, s) - 0.5) * 0.7;
    y -= Math.pow(Math.abs(Math.sin(x * f * 0.6 + s * 0.7)), 7) * 0.9;
    return base + y * amp;
  }
  function build() {
    rs = seedInt;
    W = Math.max(1, api.width); H = Math.max(1, api.height); hz = H * 0.6;
    var f = api.free(30);
    if (!f || f.w < 120 || f.h < 120) f = { x: W * 0.5, y: 0, w: W * 0.5, h: H };
    sunR = Math.max(36, Math.min(130, Math.min(W, H) * 0.11));
    sunX = f.x + f.w * 0.55; sunY = hz - sunR * 0.15;
    // sky, stars and the sun
    sky = mk(W, H); var s = sky.getContext('2d');
    var g = s.createLinearGradient(0, 0, 0, hz + H * 0.1);
    g.addColorStop(0, C.top); g.addColorStop(0.45, C.mid); g.addColorStop(0.8, api.mix(C.haze, C.hor, 0.5)); g.addColorStop(1, C.hor);
    s.fillStyle = g; s.fillRect(0, 0, W, H);
    for (var k = 0; k < 90; k++) { var sx = rnd() * W, sy = Math.pow(rnd(), 2) * hz * 0.45; s.fillStyle = api.rgba('#ffffff', 0.12 + rnd() * 0.4 * (1 - sy / (hz * 0.45))); s.fillRect(sx, sy, 1.1, 1.1); }
    var sg = s.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 7);
    sg.addColorStop(0, api.rgba(C.sun, 0.7)); sg.addColorStop(0.18, api.rgba(C.hor, 0.4)); sg.addColorStop(0.5, api.rgba(C.haze, 0.12)); sg.addColorStop(1, api.rgba(C.haze, 0));
    s.fillStyle = sg; s.fillRect(0, 0, W, H);
    s.beginPath(); s.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    var dg = s.createRadialGradient(sunX, sunY - sunR * 0.3, sunR * 0.1, sunX, sunY, sunR);
    dg.addColorStop(0, '#fff6e4'); dg.addColorStop(1, C.sun); s.fillStyle = dg; s.fill();
    // ridges, far (0) to near (NL-1)
    layers = [];
    var far = api.mix(C.haze, C.hor, 0.35);
    for (var i = 0; i < NL; i++) {
      var k2 = i / (NL - 1), base = hz - H * 0.02 + Math.pow(k2, 1.15) * H * 0.3, amp = H * (0.07 + k2 * 0.09);
      var col = api.mix(far, C.near, Math.pow(k2, 0.75));
      var w = W + PAD * 2, pts = [], top = H;
      for (var x = 0; x <= w + 4; x += 4) { var y = ridge(i, x - PAD, base, amp); pts.push(y); if (y < top) top = y; }
      top = Math.floor(top - (i >= NL - 2 ? 60 : 4));
      var ch = H - top + 20, cv = mk(w, ch), c = cv.getContext('2d');
      c.beginPath(); c.moveTo(0, ch);
      for (var p = 0; p < pts.length; p++) c.lineTo(p * 4, pts[p] - top);
      c.lineTo(w, ch); c.closePath(); c.fillStyle = col; c.fill();
      // valley haze at the base and a sunward rim glow, clipped to the ridge
      c.save(); c.clip();
      var vg = c.createLinearGradient(0, base - top - amp, 0, base - top + amp * 1.4);
      vg.addColorStop(0, api.rgba(C.fog, 0)); vg.addColorStop(1, api.rgba(C.fog, 0.22 * (1 - k2 * 0.6)));
      c.fillStyle = vg; c.fillRect(0, 0, w, ch);
      var rg = c.createRadialGradient(sunX + PAD, sunY - top, sunR, sunX + PAD, sunY - top, sunR * 6);
      rg.addColorStop(0, api.rgba(C.hor, 0.35 * (1 - k2))); rg.addColorStop(1, api.rgba(C.hor, 0));
      c.fillStyle = rg; c.fillRect(0, 0, w, ch);
      c.restore();
      // pines on the two nearest ridges
      if (i >= NL - 2) {
        var big = i === NL - 1 ? 1 : 0.5; c.fillStyle = col;
        for (var tx = 0; tx < w; tx += (5 + rnd() * 12) * big + 2) {
          if (api.noise(tx * 0.01 + i, seed) < 0.38) continue;
          var gy = pts[Math.min(pts.length - 1, Math.round(tx / 4))] - top + 3, th = (14 + rnd() * 30) * big, tw = th * 0.28;
          c.beginPath();
          for (var tier = 0; tier < 4; tier++) { var ty = gy - th * (tier / 4), ww = tw * (1 - tier * 0.2); c.moveTo(tx - ww, ty); c.lineTo(tx, ty - th * 0.42); c.lineTo(tx + ww, ty); }
          c.fill(); c.fillRect(tx - 0.8, gy - th * 0.2, 1.6, th * 0.25);
        }
      }
      layers.push({ cv: cv, top: top, base: base, amp: amp, k: k2 });
    }
    // fog sprite that wraps horizontally
    var fw = Math.ceil(W * 1.4), fh = Math.ceil(Math.max(40, H * 0.1)); fog = mk(fw, fh); var fc = fog.getContext('2d');
    for (var j = 0; j < 28; j++) {
      var bx = (j / 28) * fw + rnd() * 40, by = fh * (0.45 + (rnd() - 0.5) * 0.25), rx = 60 + rnd() * 140, ry = fh * (0.22 + rnd() * 0.18);
      for (var rep = -1; rep <= 1; rep++) {
        fc.save(); fc.translate(bx + rep * fw, by); fc.scale(1, ry / rx);
        var fg = fc.createRadialGradient(0, 0, 0, 0, 0, rx); fg.addColorStop(0, api.rgba(C.fog, 0.5)); fg.addColorStop(1, api.rgba(C.fog, 0));
        fc.fillStyle = fg; fc.fillRect(-rx, -rx, rx * 2, rx * 2); fc.restore();
      }
    }
  }
  function drawFog(t, i, L, shift, oy) {
    var fw = fog.width, fh = fog.height * (0.8 + L.k * 0.6), off = (t * (5 + i * 3) + i * 211) % fw;
    var y = L.base + L.amp * 0.35 + oy - L.top - fh * 0.5, x0 = -off + shift;
    ctx.globalAlpha = 0.26 + 0.1 * Math.sin(t * 0.3 + i * 1.7);
    for (var c = -1; c <= 1; c++) ctx.drawImage(fog, x0 + c * fw, y, fw, fh);
    ctx.globalAlpha = 1;
  }
  function drawBirds(t) {
    var cxF = ((flockOff + t * 0.012) % 1) * (W + 300) - 150, cyF = hz * 0.42 + Math.sin(t * 0.15) * hz * 0.06;
    ctx.lineCap = 'round';
    for (var n = 0; n < birds.length; n++) {
      var bd = birds[n], x = cxF + bd.dx * (1 + 0.1 * Math.sin(t * 0.4 + bd.ph)), y = cyF + bd.dy + Math.sin(t * 0.7 + bd.ph) * 3;
      var a = 0.85 * (1 - api.calm(x, y, 40)); if (a < 0.03) continue;
      var wing = 5.5 * bd.s, lift = Math.sin(t * 5 * (0.9 + bd.s * 0.2) + bd.ph) * wing * 0.55;
      ctx.beginPath(); ctx.moveTo(x - wing, y - lift);
      ctx.quadraticCurveTo(x - wing * 0.4, y - wing * 0.2 - lift * 0.3, x, y);
      ctx.quadraticCurveTo(x + wing * 0.4, y - wing * 0.2 - lift * 0.3, x + wing, y - lift);
      ctx.lineWidth = 1.3 * bd.s; ctx.strokeStyle = api.rgba(C.bird, a); ctx.stroke();
    }
  }
  build();
  return {
    resize: build,
    zones: build,
    pointer: function (e) { if (e.kind === 'move' && !e.overUI) { tmx = e.x / W * 2 - 1; tmy = e.y / H * 2 - 1; } },
    frame: function (t, dt) {
      var a = Math.min(1, (dt || 0) * 1.2); mx += (tmx - mx) * a; my += (tmy - my) * a;
      ctx.drawImage(sky, 0, 0, W, H);
      var pulse = 0.5 + 0.5 * Math.sin(t * 0.5), R3 = sunR * 3.2;
      ctx.globalCompositeOperation = 'lighter';
      var gr = ctx.createRadialGradient(sunX, sunY, sunR, sunX, sunY, R3);
      gr.addColorStop(0, api.rgba(C.hor, 0.08 + 0.06 * pulse)); gr.addColorStop(1, api.rgba(C.hor, 0));
      ctx.fillStyle = gr; ctx.fillRect(sunX - R3, sunY - R3, R3 * 2, R3 * 2);
      ctx.globalCompositeOperation = 'source-over';
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i], shift = -mx * PAD * 0.9 * L.k, oy = L.top - my * 8 * L.k;
        ctx.drawImage(L.cv, -PAD + shift, oy);
        if (i === 1) drawBirds(t);
        if (i > 0 && i < layers.length - 1) drawFog(t, i, L, shift, oy);
      }
    }
  };
});
