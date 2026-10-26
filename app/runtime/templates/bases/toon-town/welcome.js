// Toon Town welcome: letters drop in one by one with squash-and-stretch, then a ball hops across them.
// Colour order, timing and the ball's start are seeded per mount, so it never plays exactly the same twice.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var ink = S[6] || P.text, cols = [P.accent, S[7] || '#38c6c0', P.accent2, S[2] || '#86dc5c', '#8a6cff'];
  for (var i = cols.length - 1; i > 0; i--) { var j = Math.floor(api.random() * (i + 1)); var tmp = cols[i]; cols[i] = cols[j]; cols[j] = tmp; }
  var text = api.text || 'Hello!', letters = [], size = 54, W, H, base;
  function font(s) { return '700 ' + s + 'px "Comic Sans MS", "Trebuchet MS", sans-serif'; }
  function layout() {
    W = api.width; H = api.height; size = Math.min(60, H * 0.42);
    ctx.font = font(size); while (ctx.measureText(text).width > W * 0.9 && size > 18) { size -= 2; ctx.font = font(size); }
    var total = ctx.measureText(text).width, x = (W - total) / 2; base = H * 0.74; letters = [];
    for (var k = 0; k < text.length; k++) { var ch = text[k], w = ctx.measureText(ch).width; letters.push({ ch: ch, x: x + w / 2, delay: 0.15 + k * 0.07 + api.random() * 0.05, col: cols[k % cols.length], tilt: (api.random() - 0.5) * 0.2 }); x += w; }
  }
  layout();
  function drop(t) { // y offset (negative = above) and squash for a letter dropping with two bounces
    if (t <= 0) return { y: -H * 1.2, sq: 1 };
    if (t < 0.45) { var u = t / 0.45; return { y: -H * 1.2 * (1 - u * u), sq: 1 + u * 0.15 }; }
    if (t < 0.6) { var v = (t - 0.45) / 0.15; return { y: 0, sq: 1 - Math.sin(v * Math.PI) * 0.28 }; }
    if (t < 0.85) { var w = (t - 0.6) / 0.25; return { y: -Math.sin(w * Math.PI) * size * 0.35, sq: 1 }; }
    if (t < 0.95) { var z = (t - 0.85) / 0.1; return { y: 0, sq: 1 - Math.sin(z * Math.PI) * 0.12 }; }
    return { y: 0, sq: 1 };
  }
  var hopSeed = Math.floor(api.random() * 6);
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      ctx.font = font(size); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
      var landed = 0, vis = [];
      letters.forEach(function (L, k) {
        if (L.ch === ' ') return;
        vis.push(L);
        var lt = (t - L.delay) / 0.9, e = drop(lt);
        if (lt > 1) landed++;
        var wave = lt > 1 ? Math.sin(t * 2.2 + k * 0.6) * 2.5 : 0;
        ctx.save(); ctx.translate(L.x, base + e.y + wave); ctx.rotate(L.tilt * Math.min(1, Math.max(0, lt))); ctx.scale(1 / Math.sqrt(e.sq), e.sq);
        ctx.lineWidth = Math.max(5, size * 0.17); ctx.strokeStyle = ink; ctx.strokeText(L.ch, 0, 0);
        ctx.fillStyle = L.col; ctx.fillText(L.ch, 0, 0);
        ctx.restore();
      });
      // once everything has landed, a ball hops from letter to letter
      var start = letters.length ? letters[letters.length - 1].delay + 0.9 : 1;
      if (t > start && vis.length > 1) {
        var n = vis.length, hop = (t - start) * 2.2 + hopSeed, cyc = 2 * n - 2, idx = Math.floor(hop) % cyc, f = hop % 1;
        var a = idx < n - 1 ? idx : cyc - idx, b = idx < n - 1 ? a + 1 : a - 1;
        var x = vis[a].x + (vis[b].x - vis[a].x) * f, y = base - size * 0.92 - Math.sin(f * Math.PI) * size * 0.55;
        var sq = f < 0.08 || f > 0.92 ? 0.78 : 1;
        ctx.save(); ctx.translate(x, y); ctx.scale(1 / sq, sq);
        ctx.beginPath(); ctx.arc(0, 0, size * 0.13, 0, Math.PI * 2); ctx.fillStyle = P.accent2; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
        ctx.restore();
      }
      if (landed < vis.length) for (var s = 0; s < 7; s++) { // sparkles while letters land
        var sx = W * api.noise(t * 2 + s * 9, s), sy = H * 0.1 + H * 0.5 * api.noise(s * 4, t * 2);
        ctx.fillStyle = cols[s % cols.length]; ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 4 + s);
        ctx.fillRect(-1.5, -6, 3, 12); ctx.fillRect(-6, -1.5, 12, 3); ctx.restore();
      }
    }
  };
});
