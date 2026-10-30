// Gummy letters: each glyph drops (seeded order and delay), bounces with squash, settles on a spring jiggle,
// then idles with soft breathing and the odd happy hop. Candy colours from sceneColors (mint, cherry, grape, tangerine).
T3Welcome(function (api) {
  var c = api.canvas.getContext('2d'), S = api.palette.scene || [], rnd = api.random, W, H;
  var cols = [S[0] || '#5ef2c2', S[3] || '#ff4f7b', S[4] || '#a77bff', S[5] || '#ffb347'];
  var text = String(api.text || 'poke an idea'), letters = [], size, floorY, lastT = 0, hopAt = 4 + rnd() * 2;
  var font = '900 SIZEpx "Segoe UI Black", "Arial Black", sans-serif';
  function layout() {
    W = api.width; H = api.height;
    size = Math.min(64, H * 0.46, (W * 0.9) / Math.max(4, text.length * 0.66));
    floorY = H * 0.78;
    c.font = font.replace('SIZE', size.toFixed(1));
    var widths = text.split('').map(function (ch) { return c.measureText(ch).width + size * 0.03; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0), x = (W - total) / 2, ci = Math.floor(rnd() * 4);
    var old = letters; letters = [];
    text.split('').forEach(function (ch, i) {
      var o = old[i];
      letters.push(o && o.ch === ch ? Object.assign(o, { x: x + widths[i] / 2, w: widths[i] }) : {
        ch: ch, x: x + widths[i] / 2, w: widths[i], y: -size * (1 + rnd() * 1.5), vy: 0, delay: 0.1 + i * 0.07 + rnd() * 0.25,
        sq: 0, sv: 0, col: ch === ' ' ? null : cols[(ci + i) % 4], rot: (rnd() - 0.5) * 0.5, rv: 0, landed: 0, ph: rnd() * 6.3
      });
      x += widths[i];
    });
  }
  layout();
  function draw(L, t) {
    if (!L.col || L.y < -size * 2) return;
    var breathe = L.landed ? Math.sin(t * 2.1 + L.ph) * 0.025 : 0, sq = L.sq + breathe;
    var sx = 1 + sq * 0.6, sy = 1 - sq;
    // floor shadow + candy glow pool
    var lift = Math.max(0, floorY - L.y), sh = Math.max(0.15, 1 - lift / (H * 0.8));
    var g0 = c.createRadialGradient(L.x, floorY + 4, 0, L.x, floorY + 4, L.w * 0.7);
    g0.addColorStop(0, api.rgba(L.col, 0.35 * sh)); g0.addColorStop(1, api.rgba(L.col, 0));
    c.fillStyle = g0; c.fillRect(L.x - L.w, floorY - 8, L.w * 2, 24);
    c.save(); c.translate(L.x, L.y); c.rotate(L.rot); c.scale(sx, sy);
    c.font = font.replace('SIZE', size.toFixed(1)); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.shadowColor = api.rgba(L.col, 0.75); c.shadowBlur = size * 0.35;
    var g = c.createLinearGradient(0, -size * 0.8, 0, 0);
    g.addColorStop(0, api.mix(L.col, '#ffffff', 0.55)); g.addColorStop(0.35, L.col); g.addColorStop(1, api.mix(L.col, '#000000', 0.45));
    c.globalAlpha = 0.92; c.fillStyle = g; c.fillText(L.ch, 0, 0);
    c.shadowBlur = 0; c.globalAlpha = 1;
    // gel rim + gloss
    c.lineWidth = Math.max(1, size * 0.035); c.strokeStyle = api.rgba(api.mix(L.col, '#ffffff', 0.6), 0.55); c.strokeText(L.ch, 0, 0);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath(); c.ellipse(-L.w * 0.16, -size * 0.56, size * 0.07, size * 0.035, -0.4, 0, 6.3); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.arc(L.w * 0.14, -size * 0.2, size * 0.025, 0, 6.3); c.fill();
    c.restore();
  }
  return {
    resize: layout,
    frame: function (t, dt) {
      if (dt === undefined) dt = t - lastT; lastT = t; dt = Math.min(Math.max(dt, 0), 0.05);
      var still = api.motion === 'still';
      c.clearRect(0, 0, W, H);
      if (t > hopAt && !still) { var L0 = letters[Math.floor(rnd() * letters.length)]; if (L0 && L0.col && L0.landed) { L0.vy = -size * 7; L0.rv = (rnd() - 0.5) * 3; } hopAt = t + 2.5 + rnd() * 3; }
      for (var i = 0; i < letters.length; i++) {
        var L = letters[i];
        if (still) { L.y = floorY; L.sq = 0; L.rot = 0; L.landed = 1; draw(L, t); continue; }
        if (t < L.delay) continue;
        for (var n = 0; n < 2; n++) {
          var h = dt / 2;
          L.vy += size * 38 * h; L.y += L.vy * h;
          if (L.y >= floorY) {
            L.y = floorY;
            if (L.vy > size * 2) { L.sv += Math.min(L.vy / size, 14) * 0.9; L.vy = -L.vy * 0.42; L.rv = -L.rot * 6; }
            else { L.vy = 0; L.landed = 1; }
          }
          L.sv += (-L.sq * 260 - L.sv * 9) * h; L.sq += L.sv * h; L.sq = Math.max(-0.35, Math.min(0.45, L.sq));
          L.rv += (-L.rot * 40 - L.rv * 6) * h; L.rot += L.rv * h;
        }
        draw(L, t);
      }
    }
  };
});
