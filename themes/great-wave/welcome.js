// Great Wave welcome: a brush line of little curling waves sweeps in, the title is printed letter by letter
// like woodblock impressions (seeded misregistration of the blue block), then a red seal stamps beside it.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var INK = S[6] || P.text, BLUE = S[2] || P.accent, LIGHT = S[4] || '#7fa6c9', FOAM = S[5] || '#fbf7ec', RED = S[7] || P.accent2;
  var text = api.text || 'Great Wave', W, H, size;
  var jit = [];
  for (var i = 0; i < text.length; i++) jit.push({ dx: (api.random() - 0.5) * 2.2, dy: (api.random() - 0.5) * 2.2, d: 0.5 + i * 0.08 + api.random() * 0.12 });
  var sealT = 0.6 + text.length * 0.08 + 0.35, sealRot = (api.random() - 0.5) * 0.14, wph = api.random() * 6.28;
  function layout() { W = api.width; H = api.height; size = Math.min(44, H * 0.32); }
  function ease(k) { k = Math.max(0, Math.min(1, k)); return 1 - Math.pow(1 - k, 3); }
  layout();
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var cy = H * 0.44, seal = size * 0.62;
      ctx.font = 'italic 400 ' + size + 'px Georgia, "Palatino Linotype", serif';
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      var widths = [], total = 0;
      for (var a = 0; a < text.length; a++) { var w = ctx.measureText(text[a]).width + 1; widths.push(w); total += w; }
      var x0 = W / 2 - (total + seal + 14) / 2, x1 = x0 + total + seal + 14;
      // rolling wave line under the title
      var prog = ease(t / 1.4), wy = cy + size * 0.78, wl = 34, amp = 5, ph = t * 0.35 + wph;
      ctx.beginPath();
      for (var x = x0; x <= x0 + (x1 - x0) * prog; x += 3) {
        var s = 0.5 + 0.5 * Math.sin(((x - x0) / wl - ph) * Math.PI * 2);
        x === x0 ? ctx.moveTo(x, wy - amp * s * s * s) : ctx.lineTo(x, wy - amp * s * s * s);
      }
      ctx.lineWidth = 1.6; ctx.strokeStyle = api.rgba(BLUE, 0.85); ctx.stroke();
      for (var n = 0; n < 40; n++) {
        var cx = x0 + (n + 0.25 + ph - Math.floor(ph)) * wl - wl;
        if (cx < x0 || cx > x0 + (x1 - x0) * prog) continue;
        ctx.beginPath(); ctx.arc(cx - 2, wy - amp + 1, 2, 0, Math.PI * 2);
        ctx.fillStyle = FOAM; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = api.rgba(BLUE, 0.8); ctx.stroke();
      }
      // letters printed one by one: blue block first, ink key block on top
      var lx = x0;
      for (var b = 0; b < text.length; b++) {
        var k = ease((t - jit[b].d) / 0.35);
        if (k > 0 && text[b] !== ' ') {
          ctx.globalAlpha = k * 0.55; ctx.fillStyle = LIGHT; ctx.fillText(text[b], lx + jit[b].dx, cy + jit[b].dy + (1 - k) * 4);
          ctx.globalAlpha = k; ctx.fillStyle = INK; ctx.fillText(text[b], lx, cy + (1 - k) * 4);
        }
        lx += widths[b];
      }
      ctx.globalAlpha = 1;
      // red seal stamp
      var sk = (t - sealT) / 0.25;
      if (sk > 0) {
        var e = ease(sk), sc = 1.5 - 0.5 * e, sxp = x0 + total + 14 + seal / 2;
        ctx.save(); ctx.translate(sxp, cy); ctx.rotate(sealRot); ctx.scale(sc, sc);
        ctx.globalAlpha = Math.min(1, sk) * 0.92; ctx.fillStyle = RED;
        ctx.fillRect(-seal / 2, -seal / 2, seal, seal);
        ctx.strokeStyle = FOAM; ctx.lineWidth = 1.6;
        ctx.strokeRect(-seal / 2 + 3, -seal / 2 + 3, seal - 6, seal - 6);
        ctx.beginPath(); ctx.arc(0, seal * 0.05, seal * 0.22, Math.PI * 0.9, Math.PI * 2.35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-seal * 0.3, seal * 0.25); ctx.lineTo(seal * 0.3, seal * 0.25); ctx.stroke();
        ctx.restore(); ctx.globalAlpha = 1;
      }
    }
  };
});
