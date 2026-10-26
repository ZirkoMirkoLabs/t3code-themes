// Template "particles": a soft gradient sky with drifting particles and an optional ground silhouette.
// sceneColors: [skyTop, skyBottom, p1, p2, p3, ground]
// params: { kind: snow|petals|leaves|embers|bubbles|confetti|fireflies, density: 0.3-2, wind: -1..1, ground: true|false }
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var top = S[0] || P.bg, bot = S[1] || api.mix(P.bg, P.accent, 0.15), pc = [S[2] || P.accent, S[3] || P.accent2, S[4] || P.text], ground = S[5] || api.mix(P.bg, '#000000', 0.25);
  var kind = api.params.kind || 'snow', dens = api.params.density || 1, wind = api.params.wind || 0, W = 0, H = 0, parts = [], sky = null;
  var up = kind === 'embers' || kind === 'bubbles';
  function make(initial) {
    var p = { x: api.random() * W, y: initial ? api.random() * H : (up ? H + 10 : -10), z: 0.4 + api.random() * 0.6, a: api.random() * 6.28, s: (api.random() - 0.5) * 3, c: pc[Math.floor(api.random() * pc.length)], ph: api.random() * 6 };
    p.v = (kind === 'snow' ? 25 : kind === 'embers' ? -35 : kind === 'bubbles' ? -28 : kind === 'fireflies' ? 0 : 40) * (0.6 + api.random() * 0.8);
    p.r = (kind === 'snow' ? 1.5 + api.random() * 2.5 : kind === 'bubbles' ? 3 + api.random() * 7 : kind === 'embers' || kind === 'fireflies' ? 1.2 + api.random() * 1.8 : 4 + api.random() * 5) * p.z;
    return p;
  }
  function layout() {
    W = api.width; H = api.height; sky = null; parts = [];
    var n = Math.round(Math.min(220, W * H / 9000) * dens); for (var i = 0; i < n; i++) parts.push(make(true));
  }
  function bg() {
    sky = new OffscreenCanvas(Math.max(1, W >> 1), Math.max(1, H >> 1)); var g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, H / 2);
    gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, W / 2, H / 2);
    if (api.params.ground !== false) { g.fillStyle = ground; g.beginPath(); g.moveTo(0, H / 2);
      for (var x = 0; x <= W / 2; x += 8) g.lineTo(x, H / 2 - 22 - Math.sin(x * 0.012 + 1) * 10 - Math.sin(x * 0.031) * 5 - (api.noise(x * 0.05, 3) * 18)); g.lineTo(W / 2, H / 2); g.fill(); }
  }
  layout();
  return {
    resize: layout,
    frame: function (t, dt) {
      if (!sky) bg(); ctx.drawImage(sky, 0, 0, W, H);
      ctx.globalCompositeOperation = kind === 'embers' || kind === 'fireflies' ? 'lighter' : 'source-over';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (kind === 'fireflies') { p.x += Math.sin(t * 0.4 + p.ph) * 12 * dt; p.y += Math.cos(t * 0.3 + p.ph * 2) * 9 * dt; }
        else { p.y += p.v * dt * p.z; p.x += (wind * 30 + Math.sin(t * 0.8 + p.ph) * (kind === 'snow' ? 8 : 18)) * dt * p.z; }
        p.a += p.s * dt;
        if (p.y > H + 20 || p.y < -30 || p.x < -30 || p.x > W + 30) { parts[i] = make(false); continue; }
        var a = (1 - 0.9 * api.calm(p.x, p.y, 50)); if (a < 0.05) continue;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = a * (0.55 + 0.45 * p.z);
        if (kind === 'snow') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill(); }
        else if (kind === 'petals') { ctx.fillStyle = p.c; ctx.scale(1, 0.55 + 0.45 * Math.sin(t * 2 + p.ph)); ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.3, p.r * 0.7, 0, 0, 7); ctx.fill(); }
        else if (kind === 'leaves') { ctx.fillStyle = p.c; ctx.beginPath(); ctx.moveTo(-p.r * 1.4, 0); ctx.quadraticCurveTo(0, -p.r, p.r * 1.4, 0); ctx.quadraticCurveTo(0, p.r, -p.r * 1.4, 0); ctx.fill(); ctx.strokeStyle = api.rgba('#000000', 0.2); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.lineTo(p.r, 0); ctx.stroke(); }
        else if (kind === 'bubbles') { ctx.strokeStyle = api.rgba(p.c, 0.8); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(-p.r * 0.35, -p.r * 0.35, p.r * 0.2, 0, 7); ctx.fill(); }
        else if (kind === 'confetti') { ctx.fillStyle = p.c; ctx.scale(Math.sin(t * 3 + p.ph), 1); ctx.fillRect(-p.r * 0.5, -p.r, p.r, p.r * 2); }
        else { var g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 6); var fl = kind === 'fireflies' ? Math.pow(0.5 + 0.5 * Math.sin(t * 1.5 + p.ph), 3) : 0.6 + 0.4 * Math.sin(t * 4 + p.ph);
          g.addColorStop(0, api.rgba(p.c, 0.95 * fl)); g.addColorStop(0.3, api.rgba(p.c, 0.3 * fl)); g.addColorStop(1, api.rgba(p.c, 0)); ctx.fillStyle = g; ctx.fillRect(-p.r * 6, -p.r * 6, p.r * 12, p.r * 12); }
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  };
});
