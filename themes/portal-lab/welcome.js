// Portal Lab welcome: a portal splats open, the title's letters shoot out of it and land with a wobble.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var green = S[2] || P.accent, core = S[1] || '#e9ffd0', ink = '#0b1f0d', text = api.text || 'Portal Lab', W, H, size, L = [];
  function layout() { W = api.width; H = api.height; size = Math.min(50, H * 0.4); ctx.font = '700 ' + size + 'px "Comic Sans MS", "Trebuchet MS", sans-serif';
    while (ctx.measureText(text).width > W * 0.8 && size > 16) { size -= 2; ctx.font = '700 ' + size + 'px "Comic Sans MS", "Trebuchet MS", sans-serif'; }
    var x = (W - ctx.measureText(text).width) / 2 + 20; L = [];
    for (var i = 0; i < text.length; i++) { var w = ctx.measureText(text[i]).width; L.push({ ch: text[i], x: x + w / 2, d: 0.5 + i * 0.06 + api.random() * 0.08, spin: (api.random() - 0.5) * 6 }); x += w; } }
  layout();
  return { resize: layout, frame: function (t) {
    ctx.clearRect(0, 0, W, H);
    var ox = (W - ctx.measureText(text).width) / 2 - 12, oy = H * 0.58, open = Math.min(1, t / 0.45), pr = size * 0.75 * (open < 1 ? open * 1.15 : 1 + 0.04 * Math.sin(t * 5));
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(t * 2); ctx.beginPath();
    for (var i = 0; i <= 40; i++) { var a = i / 40 * 6.283, r = pr * (1 + (api.noise(Math.cos(a) * 2, Math.sin(a) * 2 + t) - 0.5) * 0.4); if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = green; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, pr * 0.45, 0, 7); ctx.fillStyle = core; ctx.fill(); ctx.restore();
    ctx.font = '700 ' + size + 'px "Comic Sans MS", "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    L.forEach(function (l, i) { var u = Math.max(0, Math.min(1, (t - l.d) / 0.55)); if (u <= 0 || l.ch === ' ') return;
      var e = 1 - Math.pow(1 - u, 3), x = ox + (l.x - ox) * e, y = oy - Math.sin(u * Math.PI) * size * 0.9 + (u >= 1 ? Math.sin(t * 3 + i) * 2 : 0);
      ctx.save(); ctx.translate(x, y); ctx.rotate((1 - e) * l.spin); ctx.scale(0.3 + 0.7 * e, 0.3 + 0.7 * e);
      ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.strokeText(l.ch, 0, 0); ctx.fillStyle = i % 3 === 0 ? green : i % 3 === 1 ? core : (S[4] || P.accent2); ctx.fillText(l.ch, 0, 0); ctx.restore(); });
  } };
});