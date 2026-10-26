// Playground welcome: toy alphabet blocks tumble in, land with a bounce and settle; every few seconds one
// block hops and spins. Colours, landing order and spin directions are seeded per mount.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var cols = S.slice(0, 6).length ? S.slice(0, 6) : [P.accent, P.accent2, '#ffd166', '#06d6a0', '#ef476f', '#8a5cf6'], ink = S[6] || P.text;
  var text = (api.text || 'PLAY').toUpperCase(), W, H, size, blocks = [];
  function layout() {
    W = api.width; H = api.height; size = Math.min(52, H * 0.42);
    var letters = text.split(''), n = letters.length, gap = size * 0.14;
    while (n * (size + gap) > W * 0.94 && size > 18) { size -= 2; gap = size * 0.14; }
    var total = n * size + (n - 1) * gap, x = (W - total) / 2 + size / 2;
    var order = letters.map(function (_, i) { return i; }).sort(function () { return api.random() - 0.5; });
    blocks = letters.map(function (ch, i) {
      return { ch: ch, x: x + i * (size + gap), delay: 0.1 + order.indexOf(i) * 0.11, spin: (api.random() < 0.5 ? -1 : 1) * (2 + api.random() * 3), c: cols[i % cols.length], tilt: (api.random() - 0.5) * 0.12 };
    });
  }
  layout();
  function land(u) { // 0..1 -> y offset factor (1 = high above, 0 = landed) with bounce
    if (u < 0.6) { var a = u / 0.6; return 1 - a * a; }
    var b = (u - 0.6) / 0.4; return Math.abs(Math.sin(b * Math.PI * 2)) * Math.pow(1 - b, 2) * 0.18;
  }
  var hopEvery = 2.6 + api.random() * 1.5, hopSeed = Math.floor(api.random() * 100);
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var ground = H * 0.82;
      ctx.fillStyle = api.rgba(ink, 0.08); ctx.beginPath(); ctx.roundRect(W * 0.08, ground + 3, W * 0.84, 6, 3); ctx.fill();
      var hopIdx = Math.floor(api.hash(Math.floor(t / hopEvery), hopSeed) * blocks.length), hopT = (t % hopEvery) / 0.7;
      blocks.forEach(function (b, i) {
        if (b.ch === ' ') return;
        var u = Math.min(1, Math.max(0, (t - b.delay) / 1.1)); if (u <= 0) return;
        var y = ground - size / 2 - land(u) * H, rot = (1 - Math.min(1, u / 0.6)) * b.spin + b.tilt * Math.min(1, u * 2);
        if (u >= 1 && i === hopIdx && hopT < 1) { y -= Math.sin(hopT * Math.PI) * size * 0.7; rot += hopT * Math.PI * 2 * (b.spin > 0 ? 1 : -1); }
        ctx.save(); ctx.translate(b.x, y); ctx.rotate(rot);
        var s = size, r = s * 0.18;
        ctx.fillStyle = api.mix(b.c, ink, 0.35); ctx.beginPath(); ctx.roundRect(-s / 2 + 3, -s / 2 + 4, s, s, r); ctx.fill();
        ctx.fillStyle = b.c; ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, r); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-s / 2 + 5, -s / 2 + 5, s - 10, s - 10, r * 0.6); ctx.stroke();
        ctx.font = '800 ' + Math.round(s * 0.62) + 'px "Trebuchet MS", "Arial Rounded MT Bold", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.strokeText(b.ch, 0, 2); ctx.fillText(b.ch, 0, 2);
        ctx.restore();
      });
    }
  };
});
