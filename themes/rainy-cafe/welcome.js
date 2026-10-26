// Rainy Café welcome: a cup draws itself in one ink line, latte art blooms into a heart, steam curls rise,
// and the title is written in soft italic. Steam shapes and timing are seeded per mount.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var ink = P.text, rose = P.accent, sage = P.accent2, cream = S[2] || '#fbeee6';
  var W, H, steam = [];
  for (var i = 0; i < 3; i++) steam.push({ off: (i - 1) * 12, ph: api.random() * 6, amp: 4 + api.random() * 4, speed: 0.5 + api.random() * 0.4 });
  function layout() { W = api.width; H = api.height; }
  layout();
  function seg(t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var title = api.text || 'a quiet corner';
      ctx.font = 'italic 30px Georgia, "Palatino Linotype", serif';
      var tw = ctx.measureText(title).width, cupW = 64, gap = 26, total = cupW + gap + tw;
      var cx = (W - total) / 2 + cupW / 2, cy = H * 0.62;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // saucer + cup + handle, drawn on with a dash offset
      var draw = ease(seg(t, 0.1, 1.4)), L = 420;
      ctx.setLineDash([L * draw, L]); ctx.lineWidth = 2.4; ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(cx - 44, cy + 26); ctx.quadraticCurveTo(cx, cy + 40, cx + 44, cy + 26);
      ctx.moveTo(cx - 32, cy - 14); ctx.lineTo(cx - 28, cy + 12); ctx.quadraticCurveTo(cx, cy + 30, cx + 28, cy + 12); ctx.lineTo(cx + 32, cy - 14);
      ctx.moveTo(cx + 30, cy - 6); ctx.bezierCurveTo(cx + 50, cy - 10, cx + 50, cy + 12, cx + 27, cy + 10);
      ctx.stroke(); ctx.setLineDash([]);
      // cup rim and coffee surface
      var fill = ease(seg(t, 1.0, 1.6));
      if (fill > 0) {
        ctx.globalAlpha = fill;
        ctx.beginPath(); ctx.ellipse(cx, cy - 14, 32, 7, 0, 0, Math.PI * 2); ctx.fillStyle = '#9b6b55'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.4; ctx.stroke();
        // latte heart blooms
        var bloom = ease(seg(t, 1.5, 2.4)), hs = 7 * bloom;
        if (hs > 0.2) {
          ctx.fillStyle = cream; ctx.beginPath();
          ctx.moveTo(cx, cy - 11 + hs * 0.25);
          ctx.bezierCurveTo(cx - hs * 1.6, cy - 14 - hs * 0.2, cx - hs * 0.5, cy - 14 - hs * 0.8, cx, cy - 14 - hs * 0.25);
          ctx.bezierCurveTo(cx + hs * 0.5, cy - 14 - hs * 0.8, cx + hs * 1.6, cy - 14 - hs * 0.2, cx, cy - 11 + hs * 0.25);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // steam
      var st = seg(t, 1.8, 3.0);
      steam.forEach(function (s) {
        ctx.strokeStyle = api.rgba(sage, 0.55 * st); ctx.lineWidth = 2; ctx.beginPath();
        for (var k = 0; k <= 24; k++) { var u = k / 24, y = cy - 26 - u * 52, x = cx + s.off + Math.sin(u * 6 + t * s.speed * 3 + s.ph) * s.amp * (0.4 + u);
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.globalAlpha = 1; ctx.stroke();
      });
      // title written left to right
      var w = ease(seg(t, 0.8, 2.6));
      ctx.save(); ctx.beginPath(); ctx.rect(cx + cupW / 2 + gap - 4, 0, (tw + 8) * w, H); ctx.clip();
      ctx.fillStyle = ink; ctx.textBaseline = 'middle'; ctx.fillText(title, cx + cupW / 2 + gap, cy - 4);
      ctx.restore();
      // underline flourish in the accent
      var u2 = ease(seg(t, 2.2, 3.0));
      if (u2 > 0) { ctx.strokeStyle = rose; ctx.lineWidth = 2; ctx.beginPath(); var x0 = cx + cupW / 2 + gap, y0 = cy + 18;
        ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + tw * 0.5 * u2, y0 + 6, x0 + tw * u2, y0 - 2); ctx.stroke(); }
    }
  };
});
