// Template "starfield": parallax star layers with twinkle, occasional shooting stars and an optional
// shaded planet with a ring placed in the largest free area. sceneColors: [space, starTint, planet, glow]
// params: { planet: true|false, ring: true|false, drift: 0-2, density: 0.3-2, shooting: true|false }
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var space = S[0] || P.bg, tint = S[1] || P.accent2, planetC = S[2] || P.accent, glow = S[3] || P.accent2;
  var pr = api.params, W = 0, H = 0, layers = [], planet = null, comet = null, nebula = null;
  function layout() {
    W = api.width; H = api.height; layers = [];
    var dens = pr.density || 1;
    for (var l = 0; l < 3; l++) { var a = []; for (var i = 0; i < W * H / 9000 * dens * (1 + l * 0.6); i++) a.push({ x: api.random() * W, y: api.random() * H, r: (0.4 + api.random() * 1.1) * (1.3 - l * 0.3), ph: api.random() * 6, c: api.random() < 0.25 ? tint : '#ffffff' }); layers.push(a); }
    var f = api.free(30);
    planet = pr.planet === false || f.w < 120 ? null : { x: f.x + f.w * 0.6, y: f.y + f.h * 0.4, r: Math.max(26, Math.min(110, Math.min(f.w, f.h) * 0.22)) };
    nebula = new OffscreenCanvas(Math.max(1, W >> 2), Math.max(1, H >> 2)); var g = nebula.getContext('2d');
    for (var k = 0; k < 5; k++) { var gx = api.random() * W / 4, gy = api.random() * H / 4, gr = g.createRadialGradient(gx, gy, 0, gx, gy, W / 6); gr.addColorStop(0, api.rgba(k % 2 ? glow : planetC, 0.12)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W / 4, H / 4); }
  }
  layout();
  function drawPlanet(t) {
    var p = planet, x = p.x, y = p.y, r = p.r;
    var halo = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 2.2); halo.addColorStop(0, api.rgba(glow, 0.35)); halo.addColorStop(1, api.rgba(glow, 0)); ctx.fillStyle = halo; ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
    function ring(front) { if (pr.ring === false) return; ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35); ctx.scale(1, 0.24); ctx.beginPath(); ctx.arc(0, 0, r * 1.9, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); ctx.lineWidth = r * 0.35; ctx.strokeStyle = api.rgba(api.mix(planetC, '#ffffff', 0.4), 0.5); ctx.stroke(); ctx.restore(); }
    ring(false);
    var g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, api.mix(planetC, '#ffffff', 0.35)); g.addColorStop(0.7, planetC); g.addColorStop(1, api.mix(planetC, space, 0.75));
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip(); ctx.globalAlpha = 0.18; ctx.strokeStyle = api.mix(planetC, space, 0.5); ctx.lineWidth = r * 0.12;
    for (var b = -3; b <= 3; b++) { ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 0.05 + b) * 4, y + b * r * 0.26, r * 1.1, r * 0.06, 0, 0, 7); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1;
    ring(true);
  }
  return {
    resize: layout, zones: layout,
    frame: function (t, dt) {
      ctx.fillStyle = space; ctx.fillRect(0, 0, W, H); ctx.drawImage(nebula, 0, 0, W, H);
      var drift = pr.drift == null ? 0.6 : pr.drift;
      layers.forEach(function (a, l) {
        a.forEach(function (s) {
          s.x -= drift * (l + 1) * 3 * dt; if (s.x < -2) s.x = W + 2;
          var c = api.calm(s.x, s.y, 40); if (c > 0.9) return;
          ctx.globalAlpha = (0.45 + 0.55 * Math.sin(t * (0.6 + l * 0.4) + s.ph)) * (1 - c * 0.85); ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, s.r, s.r);
        });
      });
      ctx.globalAlpha = 1;
      if (planet) drawPlanet(t);
      if (pr.shooting !== false && dt > 0) {
        if (!comet && api.random() < dt * 0.1) comet = { x: W * (0.3 + api.random() * 0.7), y: api.random() * H * 0.4, vx: -500 - api.random() * 300, vy: 150 + api.random() * 150, life: 0 };
        if (comet) { comet.life += dt; comet.x += comet.vx * dt; comet.y += comet.vy * dt; var a = Math.max(0, 1 - comet.life / 1.2) * (1 - api.calm(comet.x, comet.y, 40));
          var g = ctx.createLinearGradient(comet.x, comet.y, comet.x - comet.vx * 0.12, comet.y - comet.vy * 0.12); g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(comet.x, comet.y); ctx.lineTo(comet.x - comet.vx * 0.12, comet.y - comet.vy * 0.12); ctx.stroke(); if (comet.life > 1.2) comet = null; }
      }
    }
  };
});
