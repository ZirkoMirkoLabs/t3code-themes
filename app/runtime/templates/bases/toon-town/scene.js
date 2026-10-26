// Toon Town: outlined clouds drift across a cartoon sky, a grinning sun spins in free space, hills roll below.
// Clouds fade where they pass behind text (api.calm); the sun sits in the largest free area (api.free).
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d');
  var P = api.palette, S = P.scene || [];
  var C = { skyTop: S[0] || '#7cc8ff', skyBot: S[1] || '#e4f6ff', hillA: S[2] || '#86dc5c', hillB: S[3] || '#4fbf4a',
    cloud: S[4] || '#ffffff', sun: S[5] || P.accent2, ink: S[6] || P.text };
  var W = 0, H = 0, sun = { x: 0, y: 0, r: 50 }, clouds = [], birds = [], dots = null, mx = 0, my = 0, tmx = 0, tmy = 0;
  var nClouds = api.params.clouds || 8, nBirds = api.params.birds || 4;
  function layout() {
    W = api.width; H = api.height; dots = null;
    var f = api.free(24);
    if (f.w < 140 || f.h < 140) f = { x: W * 0.6, y: 20, w: W * 0.4, h: H * 0.4 };
    sun.r = Math.max(34, Math.min(62, f.w * 0.13));
    sun.x = f.x + f.w - sun.r * 2.3; sun.y = f.y + Math.min(f.h * 0.3, sun.r * 2.5);
  }
  function makeCloud(initial) {
    var d = api.random(), puffs = [], n = 3 + Math.floor(api.random() * 3);
    for (var i = 0; i < n; i++) puffs.push({ dx: (i - (n - 1) / 2) * 34 + (api.random() - 0.5) * 10, dy: -Math.sin((i + 0.5) / n * Math.PI) * (16 + api.random() * 14), r: 24 + api.random() * 16 });
    return { x: initial ? api.random() * (W + 300) - 150 : -200, y: 50 + api.random() * H * 0.5, s: 0.55 + d * 0.75, v: 10 + d * 22, puffs: puffs, bob: api.random() * 6 };
  }
  function makeBird() { return { x: api.random() * W, y: 60 + api.random() * H * 0.35, v: 30 + api.random() * 30, ph: api.random() * 6, s: 0.7 + api.random() * 0.6 }; }
  layout();
  for (var i = 0; i < nClouds; i++) clouds.push(makeCloud(true));
  for (var j = 0; j < nBirds; j++) birds.push(makeBird());
  clouds.sort(function (a, b) { return a.s - b.s; });

  // Comic halftone dots in the upper sky, cached (only redrawn on resize / zone change).
  function halftone() {
    dots = new OffscreenCanvas(Math.max(1, Math.round(W)), Math.max(1, Math.round(H * 0.55)));
    var d = dots.getContext('2d'); d.fillStyle = 'rgba(255,255,255,.4)';
    for (var yy = 12; yy < H * 0.55; yy += 18) for (var xx = (yy % 36 ? 21 : 12); xx < W; xx += 18) {
      var k = (1 - yy / (H * 0.55)) * 2.4; if (k > 0.3 && api.calm(xx, yy, 40) < 0.5) { d.beginPath(); d.arc(xx, yy, k, 0, 7); d.fill(); }
    }
  }
  function drawCloud(c, t) {
    var x = c.x + mx * 14 * c.s, y = c.y + Math.sin(t * 0.6 + c.bob) * 3 + my * 6 * c.s;
    var a = 1 - 0.8 * api.calm(x, y, 90);
    if (a < 0.03) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(c.s, c.s);
    ctx.lineWidth = 4.5 / c.s; ctx.strokeStyle = C.ink; ctx.fillStyle = C.cloud; ctx.lineJoin = 'round';
    var w = c.puffs.length * 34 + 26;
    function shape() { ctx.beginPath(); ctx.roundRect(-w / 2, -8, w, 34, 17); c.puffs.forEach(function (p) { ctx.moveTo(p.dx + p.r, p.dy); ctx.arc(p.dx, p.dy, p.r, 0, Math.PI * 2); }); }
    shape(); ctx.stroke(); shape(); ctx.fill(); // strokes first, fills after: one clean silhouette
    ctx.globalAlpha = a * 0.6; ctx.strokeStyle = C.skyBot; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();
    var p0 = c.puffs[0]; ctx.arc(p0.dx, p0.dy, p0.r * 0.6, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    ctx.restore();
  }
  function drawSun(t) {
    var x = sun.x + mx * 8, y = sun.y + my * 5, r = sun.r;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.25);
    ctx.lineWidth = 3.5; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round';
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2, l = r * (1.55 + 0.12 * Math.sin(t * 3 + i));
      ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.13) * r * 1.12, Math.sin(a - 0.13) * r * 1.12);
      ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.lineTo(Math.cos(a + 0.13) * r * 1.12, Math.sin(a + 0.13) * r * 1.12); ctx.closePath();
      ctx.fillStyle = i % 2 ? C.sun : api.mix(C.sun, '#ff8a00', 0.35); ctx.fill(); ctx.stroke();
    }
    ctx.rotate(-t * 0.25);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = C.sun; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
    var blink = (t % 4.2) < 0.14 ? 0.15 : 1;
    ctx.fillStyle = C.ink; ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.12, r * 0.09, r * 0.14 * blink, 0, 0, Math.PI * 2); ctx.ellipse(r * 0.32, -r * 0.12, r * 0.09, r * 0.14 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = api.rgba(P.accent, 0.35); ctx.beginPath(); ctx.arc(-r * 0.55, r * 0.18, r * 0.14, 0, 7); ctx.arc(r * 0.55, r * 0.18, r * 0.14, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.arc(0, r * 0.08, r * 0.42, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
    ctx.restore();
  }
  function hill(base, amp, freq, phase, color, par) {
    ctx.beginPath(); ctx.moveTo(-20, H + 20);
    for (var x = -20; x <= W + 36; x += 16) {
      var y = H - base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.35 + my * par;
      ctx.lineTo(x + mx * par, y);
    }
    ctx.lineTo(W + 40, H + 20); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
  }
  function drawBird(b, t) {
    var a = 1 - 0.9 * api.calm(b.x, b.y, 60); if (a < 0.05) return;
    var f = Math.sin(t * 9 + b.ph) * 7 * b.s;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(b.x - 12 * b.s, b.y - f); ctx.quadraticCurveTo(b.x - 5 * b.s, b.y - 4 * b.s, b.x, b.y);
    ctx.quadraticCurveTo(b.x + 5 * b.s, b.y - 4 * b.s, b.x + 12 * b.s, b.y - f); ctx.stroke(); ctx.restore();
  }
  function frame(t, dt) {
    mx += (tmx - mx) * Math.min(1, dt * 2); my += (tmy - my) * Math.min(1, dt * 2);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.skyTop); g.addColorStop(0.75, C.skyBot); g.addColorStop(1, C.skyBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (!dots) halftone();
    ctx.drawImage(dots, 0, 0, W, H * 0.55);
    drawSun(t);
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i]; c.x += c.v * dt;
      if (c.x - 220 > W) { var s = c.s; clouds[i] = makeCloud(false); clouds[i].s = s; }
      drawCloud(clouds[i], t);
    }
    birds.forEach(function (b) { b.x += b.v * dt; if (b.x > W + 30) { b.x = -30; b.y = 60 + api.random() * H * 0.35; } drawBird(b, t); });
    hill(120, 22, 0.006, 1.3, C.hillA, 6);
    hill(70, 16, 0.009, 4.1, C.hillB, 12);
  }
  return {
    frame: frame,
    resize: layout,
    zones: layout,
    pointer: function (e) { if (e.kind === 'move') { tmx = e.x / Math.max(1, W) * 2 - 1; tmy = e.y / Math.max(1, H) * 2 - 1; } }
  };
});
