// Aero welcome: glossy gradient title with a sheen sweep, an aqua swoosh and rising bubbles.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d');
  var R = api.random, W = api.width, H = api.height, dpr = api.dpr || 1;
  var S = (api.palette && api.palette.scene) || [];
  var ACC = api.palette.accent || '#0a6fc2', AQ = S[5] || '#41d9cf', MID = S[1] || '#58c4f3';
  var text = api.text || 'Aero';
  var tilt = (R() - 0.5) * 0.08, sweep = 4.5 + R() * 3;
  var bubbles = [];
  for (var i = 0; i < 14; i++) bubbles.push({ u: R(), d: R() * 1.4, r: 3 + R() * 9, sp: 10 + R() * 22, ph: R() * 6.28, off: R() * 400 });
  var tc = null, tg = null;
  function mkText() {
    tc = new OffscreenCanvas(Math.max(1, Math.ceil(W * dpr)), Math.max(1, Math.ceil(H * dpr)));
    tg = tc.getContext('2d');
  }
  mkText();

  function bubble(x, y, r, a) {
    if (a <= 0.01) return;
    ctx.globalAlpha = a;
    var g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.8, api.rgba(AQ, 0.28)); g.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.32, r * 0.18, -0.7, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
  }

  return {
    resize: function (w, h) { W = w; H = h; dpr = api.dpr || 1; mkText(); },
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var k = Math.min(1, t / 1.8), e = 1 - Math.pow(1 - k, 3);

      for (var i = 0; i < bubbles.length; i++) {
        var b = bubbles[i];
        var ap = Math.min(1, Math.max(0, (t - b.d) / 0.6));
        var y = H + b.r - ((b.off + t * b.sp) % (H + b.r * 2));
        var x = b.u * W + Math.sin(t * 0.8 + b.ph) * 8;
        bubble(x, y, b.r * (0.6 + 0.4 * ap), 0.75 * ap);
      }

      // glossy title on its own layer so the sheen only lights the letters
      var size = Math.min(64, H * 0.5, W / Math.max(3, text.length) * 1.4);
      tg.save(); tg.scale(dpr, dpr);
      tg.clearRect(0, 0, W, H);
      tg.font = '600 ' + size.toFixed(1) + 'px "Segoe UI", system-ui, sans-serif';
      tg.textAlign = 'center'; tg.textBaseline = 'middle';
      var cy = H * 0.46;
      var g = tg.createLinearGradient(0, cy - size * 0.5, 0, cy + size * 0.5);
      g.addColorStop(0, MID); g.addColorStop(0.55, ACC); g.addColorStop(1, api.mix(ACC, AQ, 0.45));
      tg.fillStyle = g; tg.fillText(text, W / 2, cy);
      tg.globalCompositeOperation = 'source-atop';
      var gl = tg.createLinearGradient(0, cy - size * 0.5, 0, cy);
      gl.addColorStop(0, 'rgba(255,255,255,0.6)'); gl.addColorStop(1, 'rgba(255,255,255,0.05)');
      tg.fillStyle = gl; tg.fillRect(0, cy - size * 0.6, W, size * 0.6);
      var ph = ((t - 1.2) % sweep + sweep) % sweep / 1.4;
      if (t > 1.2 && ph < 1) {
        var sx = -W * 0.3 + ph * W * 1.6;
        var sg = tg.createLinearGradient(sx - 40, 0, sx + 40, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.85)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        tg.fillStyle = sg; tg.fillRect(sx - 40, 0, 80, H);
      }
      tg.globalCompositeOperation = 'source-over';
      tg.restore();

      ctx.save();
      ctx.translate(W / 2, H / 2 + (1 - e) * 16);
      ctx.rotate(tilt * (1 - e));
      var sc = 0.86 + 0.14 * e;
      ctx.scale(sc, sc);
      ctx.translate(-W / 2, -H / 2);
      ctx.globalAlpha = e;
      ctx.shadowColor = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 16;
      ctx.drawImage(tc, 0, 0, W, H);
      ctx.shadowBlur = 0;

      // aqua swoosh under the title
      var sw = Math.min(W * 0.5, size * text.length * 0.7) * e;
      var sy = cy + size * 0.62;
      var swg = ctx.createLinearGradient(W / 2 - sw, 0, W / 2 + sw, 0);
      swg.addColorStop(0, api.rgba(AQ, 0)); swg.addColorStop(0.5, api.rgba(AQ, 0.9)); swg.addColorStop(1, api.rgba(ACC, 0));
      ctx.strokeStyle = swg; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W / 2 - sw, sy + 4);
      ctx.quadraticCurveTo(W / 2, sy - 6 + Math.sin(t * 0.9) * 2, W / 2 + sw, sy + 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  };
});
