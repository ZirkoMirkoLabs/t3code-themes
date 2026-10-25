// Koi Pond welcome: a ripple opens the water, two koi (one orange, one white) circle the title in a slow
// yin-yang orbit, the title surfaces with tightening tracking, and a few cherry petals drift past. Seeded.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [], R = api.random, TAU = Math.PI * 2;
  var light = S[2] || '#bff5e4', orange = S[3] || '#ff7a2f', white = S[4] || '#f6efe4', pink = S[7] || '#f4a3c4';
  var text = api.text || 'Koi Pond', W, H, size, dir = R() < 0.5 ? 1 : -1, ph = R() * TAU;
  var petals = []; for (var i = 0; i < 9; i++) petals.push({ x: R(), y: R(), r: 2.5 + R() * 2.5, v: 0.02 + R() * 0.03, a: R() * TAU });
  function layout() { W = api.width; H = api.height; size = Math.min(44, H * 0.32); }
  layout();
  function koi(cx, cy, rx, ry, th, col, spot, al) {
    ctx.globalAlpha = al;
    for (var i = 11; i >= 0; i--) {
      var a = th - dir * i * 0.045, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry, u = i / 11;
      var r = size * 0.16 * Math.sin(Math.min(1, (u + 0.12) / 0.4) * Math.PI / 2) * (1 - 0.75 * Math.max(0, (u - 0.3) / 0.7));
      if (i === 11) { // tail fan
        ctx.fillStyle = api.rgba(col, 0.4); ctx.beginPath(); ctx.ellipse(x, y, r * 3.2, r * 1.4, a + Math.PI / 2 + Math.sin(th * 9) * 0.4, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = (spot && (i === 2 || i === 3 || i === 6)) ? orange : col;
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H * 0.52, rx = Math.min(W * 0.42, 220), ry = H * 0.36;
      for (var k = 0; k < 3; k++) { // opening ripples
        var age = t - k * 0.35; if (age <= 0 || age > 3) continue;
        var q = age / 3; ctx.lineWidth = 1.4; ctx.strokeStyle = api.rgba(light, 0.5 * (1 - q));
        ctx.beginPath(); ctx.ellipse(cx, cy, rx * (0.2 + q), ry * (0.2 + q), 0, 0, TAU); ctx.stroke();
      }
      var fin = Math.min(1, Math.max(0, (t - 0.4) / 1.4)), th = ph + dir * t * 0.55;
      koi(cx, cy, rx, ry, th, orange, false, 0.9 * fin);
      koi(cx, cy, rx, ry, th + Math.PI, white, true, 0.9 * fin);
      // title surfaces with tightening tracking
      var tin = Math.min(1, Math.max(0, (t - 0.6) / 1.8)), ease = 1 - Math.pow(1 - tin, 3), track = 2 + 16 * (1 - ease);
      ctx.font = 'italic 400 ' + size + 'px "Palatino Linotype", Georgia, serif'; ctx.textBaseline = 'middle';
      var ws = [], tot = 0; for (var c = 0; c < text.length; c++) { var w = ctx.measureText(text[c]).width; ws.push(w); tot += w + track; }
      tot -= track; var x = cx - tot / 2;
      ctx.shadowColor = api.rgba(light, 0.45); ctx.shadowBlur = 16; ctx.fillStyle = api.rgba(P.text, ease);
      for (var b = 0; b < text.length; b++) { ctx.fillText(text[b], x, cy + (1 - ease) * 8); x += ws[b] + track; }
      ctx.shadowBlur = 0;
      for (var p = 0; p < petals.length; p++) { // drifting petals
        var o = petals[p], px = ((o.x + t * o.v) % 1) * W, py = o.y * H + Math.sin(t + o.a) * 6;
        ctx.save(); ctx.translate(px, py); ctx.rotate(o.a + t * 0.6); ctx.globalAlpha = 0.75 * Math.min(1, t / 1.5);
        ctx.fillStyle = api.mix(pink, '#ffffff', 0.3); ctx.beginPath(); ctx.ellipse(0, 0, o.r, o.r * 0.6, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  };
});
