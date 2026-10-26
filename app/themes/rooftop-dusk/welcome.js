// Golden Hour welcome: a low sun rises at one side over a thin gold horizon, a lens streak sweeps across,
// the title fades up letter by letter in warm serif with a gold glow, and a few seeded birds cross. Then idle.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var gold = S[2] || '#ffc070', sun = S[3] || '#fff3cf', rose = S[1] || '#d9789a', ink = S[6] || '#1b1230';
  var text = api.text || 'Golden Hour', W, H, size, TAU = Math.PI * 2;
  var delays = []; for (var i = 0; i < text.length; i++) delays.push(0.7 + i * 0.07 + api.random() * 0.25);
  var birds = []; for (var b = 0; b < 4; b++) birds.push({ x: api.random(), y: 0.12 + api.random() * 0.28, v: 0.025 + api.random() * 0.03, s: 2.5 + api.random() * 2.5, p: api.random() * TAU });
  var sunU = api.random() < 0.5 ? 0.12 + api.random() * 0.1 : 0.78 + api.random() * 0.1;
  function layout() { W = api.width; H = api.height; size = Math.min(44, H * 0.32); }
  layout();
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, line = H * 0.78, base = H * 0.6;
      // sun rising at one side, clipped by the horizon
      var e = 1 - Math.pow(1 - Math.min(1, t / 2.4), 3), br = 0.9 + 0.1 * Math.sin(t * 0.8);
      var sx = W * sunU, r = H * 0.13, sy = line + r * 1.2 - e * r * 2.2;
      var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4.5);
      g.addColorStop(0, api.rgba(sun, 0.5 * e * br)); g.addColorStop(0.3, api.rgba(gold, 0.2 * e)); g.addColorStop(1, api.rgba(rose, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, line); ctx.clip();
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fillStyle = api.rgba(sun, 0.85 * e); ctx.fill(); ctx.restore();
      // horizon line grows from the centre
      var lw = W * 0.86 * Math.min(1, t / 1.3);
      var hg = ctx.createLinearGradient(cx - lw / 2, 0, cx + lw / 2, 0);
      hg.addColorStop(0, api.rgba(gold, 0)); hg.addColorStop(0.5, api.rgba(gold, 0.75)); hg.addColorStop(1, api.rgba(gold, 0));
      ctx.fillStyle = hg; ctx.fillRect(cx - lw / 2, line, lw, 1.3);
      // lens streak sweeps once, then rests faintly through the sun
      var sw = Math.min(1, Math.max(0, (t - 0.4) / 1.6)), stx = -W * 0.2 + sw * (sx + W * 0.2), sa = 0.25 + 0.35 * (1 - sw);
      var sg = ctx.createLinearGradient(stx - W * 0.3, 0, stx + W * 0.3, 0);
      sg.addColorStop(0, api.rgba(gold, 0)); sg.addColorStop(0.5, api.rgba(sun, sa * e * br)); sg.addColorStop(1, api.rgba(gold, 0));
      ctx.fillStyle = sg; ctx.fillRect(stx - W * 0.3, sy - 1, W * 0.6, 2);
      // title, letter by letter
      ctx.font = 'italic 400 ' + size + 'px "Palatino Linotype", Palatino, Georgia, serif';
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      var track = size * 0.05, widths = [], total = 0;
      for (var a = 0; a < text.length; a++) { var w = ctx.measureText(text[a]).width; widths.push(w); total += w + track; }
      total -= track; var x = cx - total / 2;
      for (var c = 0; c < text.length; c++) {
        var k = Math.min(1, Math.max(0, (t - delays[c]) / 0.9)), ke = 1 - Math.pow(1 - k, 3);
        if (k > 0 && text[c] !== ' ') {
          ctx.globalAlpha = ke; ctx.fillStyle = '#fff4e6';
          ctx.shadowColor = api.rgba(gold, 0.7); ctx.shadowBlur = 6 + 12 * ke * br;
          ctx.fillText(text[c], x, base + (1 - ke) * 10);
        }
        x += widths[c] + track;
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      // birds drifting across the top
      ctx.strokeStyle = api.rgba(api.light ? ink : '#fff4e6', 0.7); ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      for (var d = 0; d < birds.length; d++) {
        var o = birds[d], bx = ((o.x + t * o.v) % 1.2 - 0.1) * W, by = H * o.y + Math.sin(t * 0.7 + o.p) * 3, fl = Math.sin(t * 5 + o.p), s = o.s;
        ctx.beginPath(); ctx.moveTo(bx - s * 2, by - s * fl * 0.8); ctx.quadraticCurveTo(bx - s, by - s * (0.4 + fl * 0.4), bx, by);
        ctx.quadraticCurveTo(bx + s, by - s * (0.4 + fl * 0.4), bx + s * 2, by - s * fl * 0.8); ctx.stroke();
      }
    }
  };
});
