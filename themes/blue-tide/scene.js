// Blue Tide: a bioluminescent beach at night (2D canvas). A Milky Way band with dust lanes rises from the
// horizon on the right over a dark sea; waves roll in and their breaking crests glow electric cyan, then wash
// up the wet sand as glowing foam lines that fade. Sky, band, water reflection and sand are cached in resize().
// sceneColors: [0] sky zenith, [1] horizon haze, [2] deep sea, [3] wet sand,
//              [4] bioluminescent cyan, [5] Milky Way core, [6] star blue-white.
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var C = { sky: S[0] || '#02040d', haze: S[1] || '#0d1d38', sea: S[2] || '#020b17', sand: S[3] || '#07131c',
    glow: S[4] || '#3ff2ff', core: S[5] || '#e9dcff', star: S[6] || '#cfe6ff' };
  var prm = api.params || {}, PERIOD = prm.period || 13, NW = 4;
  var foamCol = api.mix(C.glow, '#ffffff', 0.45);
  var W = 1, H = 1, hz = 1, shore = 1, layer = null, stars = [], specks = [], meteor = null, nextMeteor = 3 + api.random() * 6;
  function R(a, b) { return a + api.random() * (b - a); }
  function gauss() { return (api.random() + api.random() + api.random() - 1.5) / 1.5; }
  function sstep(a, b, x) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }

  function build() {
    W = api.width; H = api.height; hz = Math.round(H * 0.55); shore = Math.round(H * 0.79);
    var d = api.dpr || 1, i, u, o, x, y, r, rg;
    layer = new OffscreenCanvas(Math.max(1, Math.ceil(W * d)), Math.max(1, Math.ceil(H * d)));
    var g = layer.getContext('2d'); g.scale(d, d);
    var sky = new OffscreenCanvas(Math.max(1, Math.ceil(W)), Math.max(1, hz));
    var s = sky.getContext('2d');
    var sg = s.createLinearGradient(0, 0, 0, hz);
    sg.addColorStop(0, C.sky); sg.addColorStop(0.65, api.mix(C.sky, C.haze, 0.45)); sg.addColorStop(1, C.haze);
    s.fillStyle = sg; s.fillRect(0, 0, W, hz);
    // Milky Way: rises from the horizon on the right and arcs up-left
    var f = api.free(20);
    var ax = Math.min(W * 0.92, Math.max(W * 0.58, f.x + f.w * 0.75)), ay = hz + 10, bx = W * 0.2, by = -H * 0.12;
    var dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = -dx / L;
    var bw = Math.max(60, Math.min(W, H) * 0.15);
    s.globalCompositeOperation = 'lighter';
    for (i = 0; i < 300; i++) {
      u = Math.pow(api.random(), 1.25); o = gauss() * bw * (0.7 + 0.5 * u);
      x = ax + dx * u + nx * o; y = ay + dy * u + ny * o; r = R(bw * 0.25, bw * 0.9) * (1 - u * 0.4);
      var warm = Math.max(0, 1 - u * 1.6);
      var col = api.mix(api.mix('#5a7cff', C.core, 0.35 + 0.65 * warm), '#ffcf9a', warm * 0.35);
      rg = s.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, api.rgba(col, 0.045 + warm * 0.05)); rg.addColorStop(1, api.rgba(col, 0));
      s.fillStyle = rg; s.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (i = 0; i < 1500; i++) { // dense star dust inside the band
      u = api.random(); o = gauss() * bw * 0.9;
      x = ax + dx * u + nx * o; y = ay + dy * u + ny * o;
      s.fillStyle = api.rgba(api.random() < 0.3 ? C.core : C.star, R(0.12, 0.55));
      var sz = api.random() < 0.9 ? 0.7 : 1.3; s.fillRect(x, y, sz, sz);
    }
    s.globalCompositeOperation = 'source-over';
    for (i = 0; i < 150; i++) { // dark dust lanes wandering along the core
      u = api.random() * 0.85; o = (api.noise(u * 6, 3.1) - 0.5) * bw * 0.9 + gauss() * bw * 0.12;
      x = ax + dx * u + nx * o; y = ay + dy * u + ny * o; r = R(bw * 0.08, bw * 0.3);
      rg = s.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, api.rgba(C.sky, 0.45)); rg.addColorStop(1, api.rgba(C.sky, 0));
      s.fillStyle = rg; s.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (i = 0; i < 650; i++) { // field stars
      x = api.random() * W; y = Math.pow(api.random(), 1.15) * hz;
      s.fillStyle = api.rgba(C.star, R(0.1, 0.5) * (0.4 + 0.6 * (1 - y / hz)));
      s.fillRect(x, y, 0.8, 0.8);
    }
    var hg = s.createLinearGradient(0, hz - 44, 0, hz);
    hg.addColorStop(0, api.rgba(C.haze, 0)); hg.addColorStop(1, api.rgba(api.mix(C.haze, C.glow, 0.12), 0.7));
    s.fillStyle = hg; s.fillRect(0, hz - 44, W, 44);
    g.drawImage(sky, 0, 0, W, hz);
    // ocean, with a faint mirrored sky
    var og = g.createLinearGradient(0, hz, 0, shore);
    og.addColorStop(0, api.mix(C.haze, C.sea, 0.55)); og.addColorStop(1, C.sea);
    g.fillStyle = og; g.fillRect(0, hz, W, shore - hz + 1);
    g.save(); g.globalAlpha = 0.18; g.globalCompositeOperation = 'lighter';
    g.translate(0, hz); g.scale(1, -(shore - hz) / hz); g.drawImage(sky, 0, -hz, W, hz); g.restore();
    for (i = 0; i < 110; i++) { // ripple breaks in the reflection
      y = hz + (shore - hz) * Math.pow(api.random(), 1.5); x = api.random() * W;
      g.fillStyle = api.rgba(C.sea, R(0.25, 0.6)); g.fillRect(x, y, R(30, 160) * (0.4 + (y - hz) / (shore - hz)), 1);
    }
    // wet sand with a faint sheen of the sky
    var sd = g.createLinearGradient(0, shore, 0, H);
    sd.addColorStop(0, api.mix(C.sand, C.haze, 0.35)); sd.addColorStop(1, api.mix(C.sand, '#000000', 0.4));
    g.fillStyle = sd; g.fillRect(0, shore, W, H - shore);
    g.save(); g.globalAlpha = 0.07; g.globalCompositeOperation = 'lighter';
    g.translate(0, shore); g.scale(1, -(H - shore) / hz); g.drawImage(sky, 0, -hz, W, hz); g.restore();
    var vg = g.createRadialGradient(W * 0.6, H * 0.45, Math.min(W, H) * 0.3, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // live sprites, with their calm factor cached
    stars = [];
    for (i = 0; i < 110; i++) {
      x = api.random() * W; y = Math.pow(api.random(), 1.3) * (hz - 8);
      stars.push({ x: x, y: y, r: R(0.6, 1.7), a: R(0.35, 1), s: R(0.6, 2.4), p: R(0, 6.28), k: 1 - 0.85 * api.calm(x, y, 40) });
    }
    specks = [];
    for (i = 0; i < 80; i++) {
      x = api.random() * W; y = R(shore - (shore - hz) * 0.25, shore + (H - shore) * 0.4);
      specks.push({ x: x, y: y, s: R(0.4, 1.3), p: R(0, 6.28), k: 1 - 0.85 * api.calm(x, y, 40) });
    }
  }

  function waveY(x, base, amp, sd) { return base + amp * (Math.sin(x * 0.0045 + sd * 3.7) * 0.6 + Math.sin(x * 0.013 + sd * 1.9) * 0.4); }
  function seg(x0, y0, x1, y1, a, w) {
    ctx.strokeStyle = api.rgba(C.glow, a * 0.16); ctx.lineWidth = w * 5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = api.rgba(foamCol, a * 0.9); ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  function crest(base, amp, sd, inten, w, t) {
    var step = 22;
    for (var x = -step; x < W + step; x += step) {
      var y0 = waveY(x, base, amp, sd), y1 = waveY(x + step, base, amp, sd);
      var n = api.noise(x * 0.01 + sd * 13.1, sd * 2.3 + t * 0.25);
      var a = inten * (0.15 + 0.85 * sstep(0.3, 0.75, n)) * (1 - 0.8 * api.calm(x, y0, 50));
      if (a > 0.02) seg(x, y0, x + step, y1, a, w);
    }
  }
  function runup(sd) { return (H - shore) * (0.22 + 0.2 * api.hash(sd, 1.7)); }
  function foamY(x, base, sd) { return base + 8 * Math.sin(x * 0.007 + sd) + 5 * Math.sin(x * 0.019 + sd * 2.1); }
  function foam(base, sd, alpha, t) {
    var step = 16;
    for (var x = -step; x < W + step; x += step) {
      var y0 = foamY(x, base, sd), y1 = foamY(x + step, base, sd);
      var n = api.noise(x * 0.02 + sd * 5.7, sd * 0.7 + t * 0.1);
      var a = alpha * (0.2 + 0.8 * sstep(0.25, 0.7, n)) * (1 - 0.8 * api.calm(x, y0, 50));
      if (a > 0.02) seg(x, y0, x + step, y1, a, 1.2);
    }
  }

  build();
  return {
    resize: build,
    zones: build,
    frame: function (t, dt) {
      var i, a;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(layer, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < stars.length; i++) {
        var st = stars[i]; a = st.a * st.k * (0.55 + 0.45 * Math.sin(t * st.s + st.p));
        ctx.fillStyle = api.rgba(C.star, a); ctx.fillRect(st.x - st.r / 2, st.y - st.r / 2, st.r, st.r);
        if (st.r > 1.45) { ctx.fillStyle = api.rgba(C.star, a * 0.25); ctx.fillRect(st.x - st.r * 2.5, st.y - 0.3, st.r * 5, 0.6); ctx.fillRect(st.x - 0.3, st.y - st.r * 2.5, 0.6, st.r * 5); }
      }
      var span = shore - hz;
      ctx.lineCap = 'round';
      for (var w = 0; w < NW; w++) {
        var ph = t / PERIOD + w / NW, cyc = Math.floor(ph), f = ph - cyc, sd = cyc * 7.13 + w * 3.31, prev = sd - 7.13;
        if (f < 0.6) { var ta = 1 - f / 0.6; foam(shore + runup(prev), prev, ta * ta * 0.5, t); }
        if (f < 0.78) {
          var p = f / 0.78;
          crest(hz + span * Math.pow(p, 1.7), 1 + 10 * p * p, sd, 0.08 + 0.92 * sstep(0.45, 0.9, p), 0.6 + 1.6 * p, t);
        } else {
          var q = (f - 0.78) / 0.22;
          foam(shore + runup(sd) * (1 - (1 - q) * (1 - q)), sd, (1 - q * 0.5) * 0.9, t);
        }
      }
      for (i = 0; i < specks.length; i++) {
        var k = specks[i]; a = Math.pow(Math.max(0, Math.sin(t * k.s + k.p)), 10) * k.k;
        if (a > 0.03) { ctx.fillStyle = api.rgba(C.glow, a); ctx.fillRect(k.x, k.y, 1.6, 1.6); }
      }
      if (dt > 0) {
        nextMeteor -= dt;
        if (!meteor && nextMeteor <= 0) { meteor = { x: R(W * 0.35, W * 0.95), y: R(0, hz * 0.35), vx: -R(380, 560), vy: R(120, 220), life: 0, max: R(0.7, 1.1) }; nextMeteor = R(8, 18); }
      }
      if (meteor) {
        var m = meteor; m.life += dt;
        var mx = m.x + m.vx * m.life, my = m.y + m.vy * m.life, mk = Math.sin(Math.PI * Math.min(1, m.life / m.max)) * (1 - 0.85 * api.calm(mx, my, 40));
        var tx = mx - m.vx * 0.18, ty = my - m.vy * 0.18, gr = ctx.createLinearGradient(mx, my, tx, ty);
        gr.addColorStop(0, api.rgba('#ffffff', 0.9 * mk)); gr.addColorStop(1, api.rgba(C.star, 0));
        ctx.strokeStyle = gr; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
        if (m.life >= m.max || my > hz) meteor = null;
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  };
});
