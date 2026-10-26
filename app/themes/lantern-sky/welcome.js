/* Lantern Night welcome: letters drift up and kindle one by one, small lanterns rise behind. */
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d');
  var W = api.width, H = api.height;
  var S = api.palette.scene || [];
  var warm = S[2] || '#ffad4f', core = S[3] || '#fff0c8';
  var txt = String(api.text || 'LANTERN NIGHT');
  var chars = txt.split('');
  var delay = chars.map(function () { return api.random() * 1.1; });
  var glow = new OffscreenCanvas(48, 48);
  (function () {
    var g = glow.getContext('2d'), rg = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    rg.addColorStop(0, api.rgba(core, 1)); rg.addColorStop(0.2, api.rgba(warm, 0.8)); rg.addColorStop(1, api.rgba(warm, 0));
    g.fillStyle = rg; g.fillRect(0, 0, 48, 48);
  })();
  var lan = [];
  for (var i = 0; i < 9; i++) {
    lan.push({ x: 0.05 + api.random() * 0.9, y: api.random(), s: 4 + api.random() * 7, v: 0.025 + api.random() * 0.04, ph: api.random() * 6.283 });
  }
  return {
    resize: function (w, h) { W = w; H = h; },
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var intro = Math.min(1, t / 2.2), i;
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < lan.length; i++) {
        var L = lan[i];
        var yy = ((L.y - t * L.v) % 1 + 1) % 1;
        var py = H * (1.1 - yy * 1.3), px = L.x * W + Math.sin(t * 0.6 + L.ph) * 6;
        var a = intro * 0.75 * Math.min(1, yy * 4) * Math.min(1, (1 - yy) * 4) * (0.8 + 0.2 * Math.sin(t * 7 + L.ph));
        var gs = L.s * 3.2;
        ctx.globalAlpha = Math.max(0, a);
        ctx.drawImage(glow, px - gs / 2, py - gs / 2, gs, gs);
        ctx.fillStyle = api.rgba(warm, 0.9);
        ctx.fillRect(px - L.s * 0.3, py - L.s * 0.45, L.s * 0.6, L.s * 0.8);
      }
      ctx.globalCompositeOperation = 'source-over';
      var fs = Math.max(22, Math.min(44, W / (chars.length * 0.95)));
      ctx.font = '400 ' + fs + 'px "Palatino Linotype", Georgia, serif';
      ctx.textBaseline = 'middle';
      var sp = fs * 0.22, ws = chars.map(function (c) { return ctx.measureText(c).width; });
      var total = ws.reduce(function (p, w) { return p + w + sp; }, -sp);
      var x = (W - total) / 2, cy = H * 0.55;
      var gr = ctx.createLinearGradient(0, cy - fs * 0.6, 0, cy + fs * 0.6);
      gr.addColorStop(0, core); gr.addColorStop(1, warm);
      for (i = 0; i < chars.length; i++) {
        var k = Math.max(0, Math.min(1, (t - 0.25 - delay[i]) / 1.2));
        var e = 1 - Math.pow(1 - k, 3);
        if (e > 0) {
          ctx.globalAlpha = e;
          ctx.shadowColor = warm;
          ctx.shadowBlur = fs * (0.35 + 0.15 * Math.sin(t * 1.3 + i * 0.5));
          ctx.fillStyle = gr;
          ctx.fillText(chars[i], x, cy + (1 - e) * fs * 0.7);
        }
        x += ws[i] + sp;
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  };
});
