// Silk welcome: a ribbon of fine threads sweeps in from the left and settles into a slow ripple, then the
// title fades up with its tracking easing in. Ribbon phase and curl are seeded so it never plays the same twice.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var plum = S[1] || '#4b1f5e', indigo = S[2] || '#2b2b7c', peach = S[3] || P.accent, hi = S[4] || '#ffe8da';
  var text = api.text || 'Silk', W, H, size;
  var ph = api.random() * 6.28, curl = 0.7 + api.random() * 0.6, threads = 22;
  function layout() { W = api.width; H = api.height; size = Math.min(44, H * 0.32); }
  layout();
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var cy = H * 0.52, sweep = Math.min(1, t / 1.6), ease = 1 - Math.pow(1 - sweep, 3), reach = W * ease;
      var g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, api.rgba(plum, 0)); g.addColorStop(0.3, api.rgba(indigo, 0.55)); g.addColorStop(0.7, api.rgba(peach, 0.6)); g.addColorStop(1, api.rgba(peach, 0));
      ctx.strokeStyle = g; ctx.lineWidth = 1;
      for (var i = 0; i < threads; i++) {
        var f = i / (threads - 1), off = (f - 0.5) * H * 0.42;
        ctx.globalAlpha = 0.25 + 0.55 * Math.sin(f * Math.PI);
        ctx.beginPath();
        for (var x = 0; x <= reach; x += 8) {
          var u = x / W;
          var y = cy + off * (0.55 + 0.45 * Math.sin(u * 5 * curl + ph + t * 0.4)) + Math.sin(u * 6.3 + ph + t * 0.6 + f * 0.8) * H * 0.12;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // title
      var a = Math.max(0, Math.min(1, (t - 0.9) / 1.2)), track = 2 + 14 * (1 - a);
      if (a > 0) {
        ctx.font = '300 ' + size + 'px "Segoe UI", system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        var ws = [], total = 0;
        for (var c = 0; c < text.length; c++) { var w = ctx.measureText(text[c]).width; ws.push(w); total += w + track; }
        total -= track; var tx = W / 2 - total / 2;
        ctx.globalAlpha = a; ctx.fillStyle = '#fbf6fa'; ctx.shadowColor = api.rgba(hi, 0.5); ctx.shadowBlur = 16;
        for (var d = 0; d < text.length; d++) { ctx.fillText(text[d], tx, cy); tx += ws[d] + track; }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
    }
  };
});
