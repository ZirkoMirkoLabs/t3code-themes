// Template "gradient-orbs": large soft colour fields drifting on slow Lissajous paths, plus faint grain.
// Minimal and calm; works for light and dark. sceneColors: [base, orb1, orb2, orb3, orb4]
// params: { count: 3-8, speed: 0.2-2, size: 0.5-1.6, grain: 0-1 }
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var base = S[0] || P.bg, cols = (S.slice(1).length ? S.slice(1) : [P.accent, P.accent2, api.mix(P.accent, P.accent2, 0.5)]);
  var n = Math.max(3, Math.min(8, api.params.count || 5)), sp = api.params.speed || 0.6, sz = api.params.size || 1, grain = api.params.grain == null ? 0.4 : api.params.grain;
  var W = 0, H = 0, orbs = [], sprites = {}, noiseTex = null;
  function sprite(c) { if (sprites[c]) return sprites[c]; var s = new OffscreenCanvas(256, 256), g = s.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, api.rgba(c, 0.85)); gr.addColorStop(0.5, api.rgba(c, 0.4)); gr.addColorStop(1, api.rgba(c, 0)); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return (sprites[c] = s); }
  function layout() {
    W = api.width; H = api.height; orbs = [];
    for (var i = 0; i < n; i++) orbs.push({ c: cols[i % cols.length], ax: 0.25 + api.random() * 0.35, ay: 0.2 + api.random() * 0.3, fx: 0.05 + api.random() * 0.08, fy: 0.04 + api.random() * 0.07, ph: api.random() * 6.28, r: (0.28 + api.random() * 0.25) * Math.max(W, H) * sz, cx: api.random(), cy: api.random() });
    noiseTex = new OffscreenCanvas(128, 128); var g = noiseTex.getContext('2d'), im = g.createImageData(128, 128);
    for (var k = 0; k < im.data.length; k += 4) { var v = api.random() * 255; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 18; } g.putImageData(im, 0, 0);
  }
  layout();
  return {
    resize: layout,
    frame: function (t) {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = api.light ? 'source-over' : 'lighter';
      orbs.forEach(function (o) {
        var x = W * (o.cx + Math.sin(t * o.fx * sp + o.ph) * o.ax), y = H * (o.cy + Math.cos(t * o.fy * sp + o.ph * 1.3) * o.ay);
        ctx.globalAlpha = (api.light ? 0.55 : 0.6) * (1 - 0.6 * api.calm(x, y, 200));
        ctx.drawImage(sprite(o.c), x - o.r, y - o.r, o.r * 2, o.r * 2);
      });
      ctx.globalCompositeOperation = 'source-over';
      if (grain > 0) { ctx.globalAlpha = grain; var p = ctx.createPattern(noiseTex, 'repeat'); ctx.fillStyle = p; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    }
  };
});
