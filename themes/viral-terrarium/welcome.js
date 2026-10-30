// Hedge letters: a vine traces the title, leaves sprout along it in a seeded order, tiny blossoms open,
// then fireflies drift around the topiary. Intro about 2.8 s, then leaves rustle and fireflies idle.
T3Welcome(function (api) {
  var c = api.canvas.getContext('2d'), P = api.palette, S = P.scene, R = api.random, W, H, leaves = [], buds = [], flies = [], size, cache = null, shade = null;
  var LEAF = ['#2f7a3a', '#3f9446', '#58ad4c', '#76c25a', '#1f5e33'], BLOS = ['#ff8fb8', '#ffd45e', '#f4f1ff', '#b89cff'];
  var dir = R() < 0.5 ? 1 : -1;
  function build() {
    W = api.width; H = api.height; leaves = []; buds = []; flies = []; cache = null;
    var text = api.text || 'grow something small', font = '"Arial Black", Impact, "Segoe UI", sans-serif';
    var m = new OffscreenCanvas(Math.max(1, W), Math.max(1, H)), g = m.getContext('2d');
    size = Math.min(H * 0.62, 72); g.font = '900 ' + size + 'px ' + font;
    while (g.measureText(text).width > W * 0.92 && size > 14) { size -= 2; g.font = '900 ' + size + 'px ' + font; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(text, W / 2, H * 0.56);
    var d = g.getImageData(0, 0, m.width, m.height).data, step = Math.max(4, Math.round(size / 9));
    for (var y = 0; y < m.height; y += step) for (var x = 0; x < m.width; x += step) {
      var jx = x + (R() - 0.5) * step * 0.4, jy = y + (R() - 0.5) * step * 0.4;
      if (d[(y * m.width + x) * 4 + 3] > 128) {
        var u = dir > 0 ? x / W : 1 - x / W;
        leaves.push({ x: jx, y: jy, a: R() * 6.3, r: step * (0.5 + R() * 0.35), c: LEAF[(R() * LEAF.length) | 0], t0: 0.25 + u * 1.9 + R() * 0.45, ph: R() * 6 });
        if (R() < 0.05) buds.push({ x: jx, y: jy, c: BLOS[(R() * 4) | 0], t0: 2 + u * 0.7 + R() * 0.5, r: step * 0.6 });
      }
    }
    shade = new OffscreenCanvas(Math.max(1, W), Math.max(1, H)); var sg = shade.getContext('2d'); // one cached hedge shadow
    sg.filter = 'blur(6px)'; sg.font = g.font; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillStyle = 'rgba(0,16,8,.75)'; sg.fillText(text, W / 2, H * 0.56 + 4);
    sg.filter = 'none'; sg.lineJoin = 'round'; sg.lineWidth = step * 0.8; sg.strokeStyle = '#174a26'; sg.strokeText(text, W / 2, H * 0.56); var hb = sg.createLinearGradient(0, H * 0.56 - size / 2, 0, H * 0.56 + size / 2); hb.addColorStop(0, '#6fbf4f'); hb.addColorStop(0.5, '#2f7a3a'); hb.addColorStop(1, '#1a5a2c'); sg.fillStyle = hb; sg.fillText(text, W / 2, H * 0.56);
    for (var i = 0; i < 16; i++) flies.push({ x: R() * W, y: R() * H, ph: R() * 6, sp: 0.4 + R() * 0.8 });
  }
  build();
  function leaf(l, k, sway) {
    c.save(); c.translate(l.x, l.y); c.rotate(l.a + sway); c.scale(k, k);
    c.fillStyle = l.c; c.beginPath(); c.ellipse(0, 0, l.r, l.r * 0.5, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,214,120,.35)'; c.beginPath(); c.ellipse(-l.r * 0.2, -l.r * 0.12, l.r * 0.45, l.r * 0.18, 0, 0, 7); c.fill();
    c.restore();
  }
  return {
    resize: build,
    frame: function (t) {
      c.clearRect(0, 0, W, H);
      var settled = t > 3.4;
      // soft hedge shadow keeps the letters readable on any backdrop
      if (settled && !cache) { cache = new OffscreenCanvas(Math.max(1, W), Math.max(1, H)); var g = cache.getContext('2d'), o = c; c = g;
        leaves.forEach(function (l) { leaf(l, 1, 0); }); c = o; }
      c.save(); c.globalAlpha = Math.min(1, Math.max(0, (t - 0.2) / 2.4)); c.drawImage(shade, 0, 0); c.globalAlpha = 1;
      if (cache) c.drawImage(cache, 0, 0);
      else leaves.forEach(function (l) { var u = Math.max(0, Math.min(1, (t - l.t0) / 0.45)); if (u <= 0) return; var k = u < 1 ? Math.sin(u * 2.2) / Math.sin(2.2) * (1 + (1 - u) * 0.3) : 1; leaf(l, Math.min(1.25, k), (1 - u) * 1.2); });
      c.restore();
      // rustle: a travelling breeze re-tilts a band of leaves
      if (cache) { var bx = ((t * 0.12) % 1.4 - 0.2) * W; for (var i = 0; i < leaves.length; i += 3) { var l = leaves[i], dd = Math.abs(l.x - bx); if (dd < 40) leaf(l, 1.05, Math.sin(t * 5 + l.ph) * 0.4 * (1 - dd / 40)); } }
      // vine tip leading the growth
      if (t < 2.8) { var tipU = Math.min(1, t / 2.6), tx = dir > 0 ? W * (0.04 + 0.92 * tipU) : W * (0.96 - 0.92 * tipU);
        c.strokeStyle = api.rgba('#8fe36b', 0.8); c.lineWidth = 2; c.beginPath(); c.moveTo(tx - dir * 30, H * 0.56 + 10);
        c.bezierCurveTo(tx - dir * 18, H * 0.56 - 20, tx - dir * 6, H * 0.56 + 18, tx, H * 0.56 - 8 + Math.sin(t * 8) * 4); c.stroke(); }
      buds.forEach(function (b) { var u = Math.max(0, Math.min(1, (t - b.t0) / 0.6)); if (!u) return; var r = b.r * (u < 1 ? u * 1.3 : 1 + Math.sin(t * 2 + b.x) * 0.08);
        c.fillStyle = b.c; for (var p = 0; p < 5; p++) { var a = p * 1.2566 + t * 0.2; c.beginPath(); c.arc(b.x + Math.cos(a) * r * 0.6, b.y + Math.sin(a) * r * 0.6, r * 0.5, 0, 7); c.fill(); }
        c.fillStyle = '#ffcf4a'; c.beginPath(); c.arc(b.x, b.y, r * 0.35, 0, 7); c.fill(); });
      c.save(); c.globalCompositeOperation = 'lighter'; var fa = Math.min(1, Math.max(0, (t - 1.6) / 1.2));
      flies.forEach(function (f) { var x = f.x + Math.sin(t * f.sp + f.ph) * 24, y = f.y + Math.cos(t * f.sp * 1.4 + f.ph) * 14, tw = (0.5 + 0.5 * Math.sin(t * 3.3 + f.ph * 4)) * fa;
        var gr = c.createRadialGradient(x, y, 0, x, y, 9); gr.addColorStop(0, 'rgba(240,255,150,' + 0.85 * tw + ')'); gr.addColorStop(1, 'rgba(200,255,100,0)'); c.fillStyle = gr; c.fillRect(x - 9, y - 9, 18, 18); });
      c.restore();
    }
  };
});
