// Portal Lab scene. sceneColors: [bg, core, portal, portalDeep, goo, gridLine]
// A wobbling green portal in the largest free area, a blueprint grid, and goo drips that fall in free space.
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var bg = S[0] || P.bg, core = S[1] || '#e9ffd0', green = S[2] || P.accent, deep = S[3] || '#2f9e3a', goo = S[4] || P.accent, line = S[5] || P.border;
  var W, H, grid, portal = { x: 0, y: 0, r: 80 }, drips = [], sparks = [], px = 0, py = 0;
  function layout() {
    W = api.width; H = api.height; grid = new OffscreenCanvas(Math.max(1, W), Math.max(1, H));
    var g = grid.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, W, H); g.strokeStyle = api.rgba(line, 0.7); g.lineWidth = 1;
    for (var x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
    for (var y = 0; y < H; y += 32) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
    var f = api.free(30); portal.r = Math.max(40, Math.min(150, Math.min(f.w, f.h) * 0.32)); portal.x = f.x + f.w / 2; portal.y = f.y + f.h * 0.45;
  }
  layout();
  function blob(r, t, k, wob) {
    ctx.beginPath();
    for (var i = 0; i <= 64; i++) { var a = i / 64 * Math.PI * 2, n = api.noise(Math.cos(a) * 1.5 + k, Math.sin(a) * 1.5 + t * 0.6), rr = r * (1 + (n - 0.5) * wob);
      var x = portal.x + Math.cos(a) * rr, y = portal.y + Math.sin(a) * rr * 0.9; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath();
  }
  return {
    resize: layout, zones: layout,
    pointer: function (e) { if (e.kind === 'move' && !e.overUI) { px = e.x; py = e.y; } },
    frame: function (t, dt) {
      ctx.drawImage(grid, 0, 0, W, H);
      var calm = api.calm(portal.x, portal.y, 120), a = 1 - 0.7 * calm;
      ctx.globalAlpha = a;
      var halo = ctx.createRadialGradient(portal.x, portal.y, portal.r * 0.5, portal.x, portal.y, portal.r * 2);
      halo.addColorStop(0, api.rgba(green, 0.35)); halo.addColorStop(1, api.rgba(green, 0)); ctx.fillStyle = halo; ctx.fillRect(portal.x - portal.r * 2, portal.y - portal.r * 2, portal.r * 4, portal.r * 4);
      blob(portal.r * 1.08, t, 0, 0.35); ctx.fillStyle = deep; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#0b1f0d'; ctx.stroke();
      blob(portal.r * 0.9, t * 1.3, 3, 0.3); ctx.fillStyle = green; ctx.fill();
      blob(portal.r * 0.55, t * 1.7, 7, 0.4); ctx.fillStyle = core; ctx.fill();
      ctx.save(); ctx.translate(portal.x, portal.y); ctx.strokeStyle = api.rgba(core, 0.8); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (var s = 0; s < 6; s++) { ctx.beginPath(); var a0 = s / 6 * Math.PI * 2 + t * 1.4; for (var k = 0; k < 18; k++) { var u = k / 17, ang = a0 + u * 2.4, rr = portal.r * (0.95 - u * 0.75);
        var x = Math.cos(ang) * rr, y = Math.sin(ang) * rr * 0.9; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); }
      ctx.restore();
      if (dt > 0 && api.random() < dt * 6) sparks.push({ a: api.random() * 6.28, r: portal.r * 1.1, v: 40 + api.random() * 60, life: 0 });
      sparks = sparks.filter(function (p) { p.life += dt; p.r += p.v * dt; return p.life < 1; });
      ctx.fillStyle = core; sparks.forEach(function (p) { ctx.globalAlpha = a * (1 - p.life); ctx.fillRect(portal.x + Math.cos(p.a) * p.r, portal.y + Math.sin(p.a) * p.r * 0.9, 3, 3); });
      ctx.globalAlpha = 1;
      if (dt > 0 && api.random() < dt * 0.8) { var dx = api.random() * W; if (api.calm(dx, 80, 40) < 0.2) drips.push({ x: dx, y: 56, l: 0, v: 0 }); }
      drips = drips.filter(function (d) { if (d.l < 26) d.l += 14 * dt; else { d.v += 600 * dt; d.y += d.v * dt; } return d.y < H + 30; });
      ctx.fillStyle = goo; drips.forEach(function (d) { var c = 1 - api.calm(d.x, d.y, 30); if (c < 0.1) return; ctx.globalAlpha = 0.85 * c;
        ctx.beginPath(); ctx.ellipse(d.x, d.y + d.l, 4, 6 + d.l * 0.2, 0, 0, 7); ctx.fill(); ctx.fillRect(d.x - 1.5, d.y, 3, d.l); });
      ctx.globalAlpha = 1;
      if (px) { ctx.strokeStyle = api.rgba(green, 0.35); ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(portal.x, portal.y); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]); }
    }
  };
});