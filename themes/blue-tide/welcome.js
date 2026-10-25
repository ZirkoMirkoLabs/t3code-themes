// Blue Tide welcome: a glowing cyan wave line rolls in from a seeded side, each letter of the title surfaces
// as the wave passes under it, then the line breathes and bioluminescent specks drift upward.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var glow = S[4] || P.accent, star = S[6] || '#cfe6ff', foam = api.mix(glow, '#ffffff', 0.45);
  var text = (api.text || 'BLUE TIDE').toUpperCase(), W, H, size;
  var dir = api.random() < 0.5 ? 1 : -1, seed = api.random() * 100;
  var specks = []; for (var i = 0; i < 30; i++) specks.push({ x: api.random(), y: api.random(), v: 0.02 + api.random() * 0.05, p: api.random() * 6.28, r: 0.8 + api.random() * 1.4 });
  function layout() { W = api.width; H = api.height; size = Math.min(42, H * 0.32); }
  layout();
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var cy = H * 0.46, ly = H * 0.8, e = 1 - Math.pow(1 - Math.min(1, t / 1.8), 3);
      var head = dir > 0 ? W * e : W * (1 - e);
      // wave line
      ctx.lineCap = 'round';
      for (var pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        for (var x = 0; x <= W; x += 8) {
          var on = dir > 0 ? x <= head : x >= head; if (!on) continue;
          var env = Math.sin(Math.PI * x / W), y = ly + env * 4 * Math.sin(x * 0.03 + t * 1.2 + seed);
          if ((dir > 0 && x === 0) || (dir < 0 && x - 8 < head)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        var br = 0.7 + 0.3 * Math.sin(t * 1.1);
        ctx.strokeStyle = pass ? api.rgba(foam, 0.85 * br) : api.rgba(glow, 0.18 * br); ctx.lineWidth = pass ? 1.4 : 7;
        ctx.stroke();
      }
      // letters surface as the wave passes beneath them
      ctx.font = '300 ' + size + 'px Bahnschrift, "Segoe UI", sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      var track = size * 0.26, widths = [], total = 0;
      for (var a = 0; a < text.length; a++) { var w = ctx.measureText(text[a]).width; widths.push(w); total += w + track; }
      total -= track; var lx = W / 2 - total / 2;
      for (var b = 0; b < text.length; b++) {
        var mid = lx + widths[b] / 2, at = 1.8 * (1 - Math.cbrt(1 - (dir > 0 ? mid / W : 1 - mid / W)));
        var k = Math.max(0, Math.min(1, (t - at - 0.1) / 0.7));
        if (k > 0 && text[b] !== ' ') {
          var shimmer = 0.45 + 0.25 * Math.sin(t * 1.4 - b * 0.55);
          ctx.globalAlpha = k; ctx.fillStyle = '#eefcff';
          ctx.shadowColor = api.rgba(glow, shimmer); ctx.shadowBlur = 16;
          ctx.fillText(text[b], lx, cy + (1 - k) * (1 - k) * 14);
        }
        lx += widths[b] + track;
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      // drifting specks
      for (var s = 0; s < specks.length; s++) {
        var o = specks[s], sy = H - ((o.y + t * o.v) % 1) * H, al = Math.min(1, t / 2) * (0.25 + 0.5 * Math.pow(Math.max(0, Math.sin(t * 1.7 + o.p)), 4));
        ctx.fillStyle = api.rgba(s % 3 ? glow : star, al * (sy / H)); ctx.fillRect(o.x * W, sy, o.r, o.r);
      }
    }
  };
});
