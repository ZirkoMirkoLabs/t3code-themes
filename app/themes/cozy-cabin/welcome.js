// Cozy Cabin welcome: a warm amber glow kindles behind the title, the title settles with tightening tracking,
// and soft snow drifts down in front at two depths. Seeded.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [], R = api.random, TAU = Math.PI * 2;
  var snow = S[5] || '#e8f0fc', amber = S[6] || '#ffb357';
  var text = api.text || 'Cozy Cabin', W, H, size;
  var flakes = []; for (var i = 0; i < 40; i++) flakes.push({ x: R(), y: R(), r: 0.8 + R() * 2, v: 0.04 + R() * 0.08, ph: R() * TAU });
  function layout() { W = api.width; H = api.height; size = Math.min(44, H * 0.32); }
  layout();
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H * 0.52, kin = Math.min(1, t / 1.6), fl = kin * (0.85 + 0.1 * Math.sin(t * 6.3) * Math.sin(t * 2.7));
      var rr = Math.min(W * 0.42, 240), g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, api.rgba(amber, 0.3 * fl)); g.addColorStop(1, api.rgba(amber, 0));
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.45); ctx.translate(-cx, -cy); ctx.fillStyle = g; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); ctx.restore();
      // title settles with tightening tracking
      var tin = Math.min(1, Math.max(0, (t - 0.4) / 1.8)), ease = 1 - Math.pow(1 - tin, 3), track = 2 + 14 * (1 - ease);
      ctx.font = '400 ' + size + 'px "Palatino Linotype", Georgia, serif'; ctx.textBaseline = 'middle';
      var ws = [], tot = 0; for (var c = 0; c < text.length; c++) { var w = ctx.measureText(text[c]).width; ws.push(w); tot += w + track; }
      tot -= track; var x = cx - tot / 2;
      ctx.shadowColor = api.rgba(amber, 0.55); ctx.shadowBlur = 18; ctx.fillStyle = api.rgba(P.text, ease);
      for (var b = 0; b < text.length; b++) { ctx.fillText(text[b], x, cy - (1 - ease) * 8); x += ws[b] + track; }
      ctx.shadowBlur = 0;
      for (var p = 0; p < flakes.length; p++) { // drifting snow
        var o = flakes[p], py = ((o.y + t * o.v) % 1) * H, px = o.x * W + Math.sin(t * 0.8 + o.ph) * 8;
        ctx.globalAlpha = (0.35 + 0.4 * (o.r / 2.8)) * Math.min(1, t / 1.2);
        ctx.fillStyle = snow; ctx.beginPath(); ctx.arc(px, py, o.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  };
});
