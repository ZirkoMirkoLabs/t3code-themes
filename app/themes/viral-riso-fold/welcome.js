// Riso title: three ink plates (yellow halftone, fluoro pink, blue) start badly misregistered, slide into
// register over ~2.4 s with seeded directions, then breathe a pixel out of register. Crop marks frame the sheet.
T3Welcome(function (api) {
  var c = api.canvas.getContext('2d'), P = api.palette, S = P.scene, W, H, R = api.random;
  var FONT = '"Bahnschrift Condensed", "Bahnschrift SemiBold Condensed", Impact, "Arial Narrow", sans-serif';
  var plates = [S[2], S[0], S[1]].map(function (col, i) {
    var a = R() * Math.PI * 2, d = 26 + R() * 34;
    return { col: col, dx: Math.cos(a) * d, dy: Math.sin(a) * d, rot: (R() - 0.5) * 0.12, delay: i * 0.22 + R() * 0.15, ph: R() * 6.28 };
  });
  var run = 'RUN #' + String(1 + Math.floor(R() * 999)).padStart(3, '0');
  var dots = new OffscreenCanvas(6, 6), dc = dots.getContext('2d'), pat;
  function resize() { W = api.width; H = api.height; }
  resize();
  function ease(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 4); }
  function fit(text) { var size = Math.min(H * 0.46, 96); c.font = '700 ' + size + 'px ' + FONT; var w = c.measureText(text).width; if (w > W * 0.86) size *= W * 0.86 / w; return size; }
  function crop(x, y, sx, sy, a) { c.globalAlpha = a; c.beginPath(); c.moveTo(x + sx * 4, y); c.lineTo(x + sx * 18, y); c.moveTo(x, y + sy * 4); c.lineTo(x, y + sy * 18); c.stroke(); }
  return {
    resize: resize,
    frame: function (t) {
      c.clearRect(0, 0, W, H);
      var text = (api.text || 'FOLD IT AGAIN').toUpperCase(), size = fit(text), cx = W / 2, cy = H * 0.5;
      if (!pat) { dc.fillStyle = S[2]; dc.beginPath(); dc.arc(3, 3, 2.1, 0, 7); dc.fill(); pat = c.createPattern(dots, 'repeat'); }
      c.font = '700 ' + size + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
      var tw = Math.min(c.measureText(text).width, W * 0.86);
      // crop marks + registration target
      var bx = (W - tw) / 2 - 22, by = cy - size * 0.62, bw = tw + 44, bh = size * 1.24, ca = ease(t / 0.8) * 0.75;
      c.strokeStyle = P.muted; c.lineWidth = 1.2;
      crop(bx, by, 1, 1, ca); crop(bx + bw, by, -1, 1, ca); crop(bx, by + bh, 1, -1, ca); crop(bx + bw, by + bh, -1, -1, ca);
      c.globalAlpha = ca; c.beginPath(); c.arc(bx + bw + 16, cy, 6, 0, 7); c.moveTo(bx + bw + 6, cy); c.lineTo(bx + bw + 26, cy); c.moveTo(bx + bw + 16, cy - 10); c.lineTo(bx + bw + 16, cy + 10); c.stroke();
      c.font = '700 12px ' + FONT; c.fillStyle = P.text; c.textAlign = 'left'; c.fillText(run + ' · 3 INKS · 0 REGRETS', bx, by + bh + 12);
      c.font = '700 ' + size + 'px ' + FONT; c.textAlign = 'center';
      c.globalCompositeOperation = 'screen';
      plates.forEach(function (pl, i) {
        var e = ease((t - pl.delay) / 2.2), off = 1 - e, wob = 1.2 * e;
        var x = cx + pl.dx * off + Math.sin(t * 0.9 + pl.ph) * wob, y = cy + pl.dy * off + Math.cos(t * 0.7 + pl.ph) * wob;
        c.save(); c.globalAlpha = Math.min(1, (t - pl.delay + 0.3) * 2.5) * (i === 0 ? 1 : 0.92);
        c.translate(x, y); c.rotate(pl.rot * off);
        c.fillStyle = i === 0 ? pat : pl.col; c.fillText(text, 0, 0, W * 0.86);
        c.restore();
      });
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
  };
});
