// Template "vortex": a swirling portal in the largest free area. Glowing particles spiral inward along
// several arms around a bright core, with soft ripples. sceneColors: [bg, core, arm1, arm2, ripple]
// params: { arms: 2-6, speed: 0.3-2, twist: 0.5-3, size: 0.5-1.6 }
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var bg = S[0] || P.bg, core = S[1] || '#ffffff', a1 = S[2] || P.accent, a2 = S[3] || P.accent2, rip = S[4] || P.accent;
  var arms = Math.max(2, Math.min(6, api.params.arms || 3)), sp = api.params.speed || 1, tw = api.params.twist || 1.6, size = api.params.size || 1;
  var W = 0, H = 0, c = { x: 0, y: 0, r: 100 }, parts = [], dot = {};
  function sprite(col) { if (dot[col]) return dot[col]; var s = new OffscreenCanvas(32, 32), g = s.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, api.rgba(col, 1)); gr.addColorStop(0.35, api.rgba(col, 0.4)); gr.addColorStop(1, api.rgba(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return (dot[col] = s); }
  function layout() {
    W = api.width; H = api.height; var f = api.free(20); if (f.w < 120) f = { x: W * 0.5, y: 0, w: W * 0.5, h: H };
    c.r = Math.max(60, Math.min(260, Math.min(f.w, f.h) * 0.42)) * size; c.x = f.x + f.w / 2; c.y = f.y + f.h / 2;
    parts = []; for (var i = 0; i < 380; i++) parts.push({ arm: i % arms, d: api.random(), o: (api.random() - 0.5) * 0.5, v: 0.05 + api.random() * 0.12, s: 0.5 + api.random() * 1.2, col: api.random() < 0.5 ? a1 : a2 });
  }
  layout();
  return {
    resize: layout, zones: layout,
    frame: function (t, dt) {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      var halo = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 1.6); halo.addColorStop(0, api.rgba(a1, 0.35)); halo.addColorStop(0.5, api.rgba(a2, 0.12)); halo.addColorStop(1, api.rgba(a2, 0));
      ctx.fillStyle = halo; ctx.fillRect(c.x - c.r * 1.6, c.y - c.r * 1.6, c.r * 3.2, c.r * 3.2);
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 4; k++) { var rr = ((t * 0.25 * sp + k / 4) % 1) * c.r * 1.3; ctx.strokeStyle = api.rgba(rip, 0.18 * (1 - rr / (c.r * 1.3))); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(c.x, c.y, rr, rr * 0.92, t * 0.2, 0, 7); ctx.stroke(); }
      parts.forEach(function (p) {
        p.d -= p.v * dt * sp; if (p.d < 0.03) { p.d = 1; p.o = (api.random() - 0.5) * 0.5; }
        var ang = p.arm / arms * Math.PI * 2 + p.d * tw * Math.PI * 2 - t * 0.6 * sp + p.o, r = p.d * c.r * 1.25;
        var x = c.x + Math.cos(ang) * r, y = c.y + Math.sin(ang) * r * 0.92, a = Math.min(1, (1 - p.d) * 1.6) * (1 - 0.85 * api.calm(x, y, 40));
        if (a < 0.03) return; ctx.globalAlpha = a; var s = 6 + p.s * 6 * (1 - p.d * 0.5); ctx.drawImage(sprite(p.col), x - s / 2, y - s / 2, s, s);
      });
      ctx.globalAlpha = 1;
      var cg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 0.28); cg.addColorStop(0, api.rgba(core, 0.95)); cg.addColorStop(0.4, api.rgba(a1, 0.6)); cg.addColorStop(1, api.rgba(a1, 0));
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.28 * (1 + 0.05 * Math.sin(t * 3)), 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  };
});
