// Ridgeline welcome: a ridge line draws itself across the card, a soft sun rises behind it (clipped so the
// canvas stays transparent), the title fades up as its tracking tightens, then two birds drift by. Seeded.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var sun = S[3] || '#ffd9a0', hor = S[2] || P.accent, mag = S[1] || P.accent2, bird = S[6] || '#f3a6b8';
  var text = (api.text || 'RIDGELINE').toUpperCase(), W, H, size, pts = [], seed = api.random() * 50;
  var birds = [{ o: api.random(), y: 0.62 + api.random() * 0.08, ph: api.random() * 6 }, { o: api.random(), y: 0.66 + api.random() * 0.1, ph: api.random() * 6 }];
  var sunU = api.random() < 0.5 ? 0.24 : 0.76;
  function layout() {
    W = api.width; H = api.height; size = Math.min(38, H * 0.26); pts = [];
    for (var i = 0; i <= 90; i++) {
      var u = i / 90;
      var y = H * 0.9 - (Math.sin(u * 7 + seed) * 0.5 + 0.5) * H * 0.08 - Math.pow(Math.abs(Math.sin(u * 3.1 + seed * 0.7)), 5) * H * 0.14 - api.noise(u * 9, seed) * H * 0.05;
      pts.push([u * W, y]);
    }
  }
  layout();
  function ease(k) { k = Math.max(0, Math.min(1, k)); return 1 - Math.pow(1 - k, 3); }
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var draw = ease(t / 1.6), rise = ease((t - 0.5) / 2.2), sx = W * sunU, sr = H * 0.14, sy = H * 0.98 - rise * H * 0.22;
      // sun + glow, clipped to the sky above the ridge
      ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0);
      for (var i = 0; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineTo(W, 0); ctx.closePath(); ctx.clip();
      var breathe = 0.85 + 0.15 * Math.sin(t * 0.8);
      var g = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 4);
      g.addColorStop(0, api.rgba(sun, 0.45 * rise * breathe)); g.addColorStop(0.4, api.rgba(hor, 0.18 * rise)); g.addColorStop(1, api.rgba(mag, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fillStyle = api.rgba(sun, 0.92 * rise); ctx.fill();
      ctx.restore();
      // ridge line drawing left to right
      var n = Math.max(1, Math.floor(draw * (pts.length - 1)));
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (var j = 1; j <= n; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.lineWidth = 1.6; ctx.strokeStyle = api.rgba(hor, 0.85); ctx.shadowColor = api.rgba(hor, 0.6); ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
      // title with tightening tracking
      var a = ease((t - 0.9) / 1.4), track = 6 + 16 * (1 - a), cy = H * 0.36;
      if (a > 0) {
        ctx.font = '600 ' + size + 'px Bahnschrift, "Segoe UI", sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        var widths = [], total = 0;
        for (var c = 0; c < text.length; c++) { var w = ctx.measureText(text[c]).width; widths.push(w); total += w + track; }
        var x = W / 2 - (total - track) / 2;
        ctx.fillStyle = api.rgba(P.text, a); ctx.shadowColor = api.rgba(hor, 0.55 * a); ctx.shadowBlur = 14;
        for (var d = 0; d < text.length; d++) { ctx.fillText(text[d], x, cy + (1 - a) * 8); x += widths[d] + track; }
        ctx.shadowBlur = 0;
      }
      // two birds drifting across after the intro
      var ba = ease((t - 2.4) / 1.5);
      if (ba > 0) {
        ctx.lineCap = 'round'; ctx.lineWidth = 1.3; ctx.strokeStyle = api.rgba(bird, 0.75 * ba);
        for (var b = 0; b < birds.length; b++) {
          var bd = birds[b], bx = ((bd.o + t * 0.025) % 1.2 - 0.1) * W, by = H * bd.y + Math.sin(t * 0.6 + bd.ph) * 3, wg = 5, lf = Math.sin(t * 5 + bd.ph) * 3;
          ctx.beginPath(); ctx.moveTo(bx - wg, by - lf); ctx.quadraticCurveTo(bx - 2, by - 1, bx, by); ctx.quadraticCurveTo(bx + 2, by - 1, bx + wg, by - lf); ctx.stroke();
        }
      }
    }
  };
});
