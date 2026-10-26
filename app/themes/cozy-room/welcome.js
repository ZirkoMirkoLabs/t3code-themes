// Cozy Room welcome: the "stay cozy" neon sign writes itself in, stutters on like an old tube, then hums.
// Flicker timing and the idle stutters are seeded per mount, so it never plays the same way twice.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, W, H;
  var neon = P.accent || '#ff6fb1', core = '#fff3f8';
  var keys = [], t0 = 1.5 + api.random() * 0.3, next = 6 + api.random() * 8, stutter = null;
  for (var i = 0, tt = t0; i < 5; i++) { keys.push([tt, i % 2 ? 1 : 0.15 + api.random() * 0.25]); tt += 0.05 + api.random() * 0.12; }
  keys.push([keys[keys.length - 1][0] + 0.08, 1]);
  function layout() { W = api.width; H = api.height; }
  layout();
  function seg(t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function heart(x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  }
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var text = api.text || 'stay cozy', fs = Math.min(46, H * 0.36);
      ctx.font = fs + 'px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      var tw = ctx.measureText(text).width, hs = fs * 0.24, total = tw + hs * 3.2, x0 = (W - total) / 2, y = H * 0.52, hx = x0 + tw + hs * 2;
      // power: off while writing, then the tube catches with a few stutters, then an occasional seeded flicker
      var on = 0;
      if (t >= t0) { on = 1; for (var i = 0; i < keys.length; i++) if (t >= keys[i][0]) on = keys[i][1]; }
      if (t > next && !stutter) { stutter = { t: t, d: 0.18 + api.random() * 0.2 }; next = t + 7 + api.random() * 14; }
      if (stutter) { var u = (t - stutter.t) / stutter.d; if (u > 1) stutter = null; else on *= u < 0.3 ? 0.25 : u < 0.55 ? 1 : 0.4; }
      var hum = 0.92 + 0.08 * Math.sin(t * 2.3);
      // the unlit glass tube is written in first, left to right
      var w = ease(seg(t, 0.1, 1.4));
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 10, 0, (total + 20) * w, H); ctx.clip();
      ctx.strokeStyle = api.rgba(neon, 0.22); ctx.lineWidth = 2.4; ctx.strokeText(text, x0, y); heart(hx, y, hs); ctx.stroke();
      ctx.restore();
      if (on > 0.05) {
        var a = on * hum;
        ctx.shadowColor = neon; ctx.shadowBlur = 24;
        ctx.strokeStyle = api.rgba(neon, 0.5 * a); ctx.lineWidth = 5; ctx.strokeText(text, x0, y); heart(hx, y, hs); ctx.stroke();
        ctx.shadowBlur = 8; ctx.strokeStyle = api.rgba(neon, 0.95 * a); ctx.lineWidth = 2.4; ctx.strokeText(text, x0, y); heart(hx, y, hs); ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = api.rgba(core, 0.75 * a); ctx.lineWidth = 1; ctx.strokeText(text, x0, y); heart(hx, y, hs); ctx.stroke();
      }
    }
  };
});
