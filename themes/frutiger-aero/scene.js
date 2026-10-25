// Aero scene. sceneColors: 0 sky top, 1 sky mid, 2 horizon haze, 3 grass light,
// 4 grass deep, 5 aqua tint, 6 cloud white, 7 sun glow.
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d');
  var S = (api.palette && api.palette.scene) || [];
  var C = {
    top: S[0] || '#1585d8', mid: S[1] || '#58c4f3', low: S[2] || '#d8f7ff',
    g1: S[3] || '#aaea5c', g2: S[4] || '#2b9c46', aqua: S[5] || '#41d9cf',
    cloud: S[6] || '#ffffff', sun: S[7] || '#fffbe3'
  };
  var P = api.params || {};
  var R = api.random;
  var W = 0, H = 0, scl = 1, sclC = 1;
  var sun = { x: 0, y: 0 };
  var sky = null, hills = null, bub = null, cloudSpr = [];
  var bubbles = [], clouds = [];

  function mk(w, h) { return new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); }
  function calm(x, y, f) { return api.calm ? api.calm(x, y, f || 40) : 0; }

  // glossy bubble sprite, drawn once
  function makeBubble() {
    var s = 160, r = s / 2 - 3, c = mk(s, s), g = c.getContext('2d'), cx = s / 2, cy = s / 2;
    var f = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    f.addColorStop(0, 'rgba(255,255,255,0.03)');
    f.addColorStop(0.7, api.rgba(C.aqua, 0.12));
    f.addColorStop(0.93, 'rgba(255,255,255,0.38)');
    f.addColorStop(1, 'rgba(255,255,255,0.8)');
    g.fillStyle = f; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3.4;
    for (var i = 0; i < 48; i++) {
      var a0 = i / 48 * Math.PI * 2, a1 = (i + 1.3) / 48 * Math.PI * 2;
      var hue = (i / 48 * 360 + 200) % 360;
      var al = 0.16 + 0.4 * Math.pow(Math.max(0, Math.sin(a0 - 0.4)), 2);
      g.strokeStyle = 'hsla(' + hue.toFixed(0) + ',95%,62%,' + al.toFixed(3) + ')';
      g.beginPath(); g.arc(cx, cy, r - 2.6, a0, a1); g.stroke();
    }
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(cx, cy, r - 0.6, 0, Math.PI * 2); g.stroke();
    g.save(); g.translate(cx - r * 0.36, cy - r * 0.42); g.rotate(-0.7); g.scale(1, 0.55);
    var h = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.44);
    h.addColorStop(0, 'rgba(255,255,255,0.95)'); h.addColorStop(0.45, 'rgba(255,255,255,0.55)'); h.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = h; g.beginPath(); g.arc(0, 0, r * 0.44, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.97)'; g.beginPath(); g.arc(cx - r * 0.5, cy - r * 0.48, r * 0.07, 0, Math.PI * 2); g.fill();
    g.lineWidth = r * 0.07; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.arc(cx, cy, r * 0.78, 0.25, 1.05); g.stroke();
    return c;
  }

  // puffy cloud sprite
  function makeCloud() {
    var w = 360, h = 150, c = mk(w, h), g = c.getContext('2d');
    var n = 7 + Math.floor(R() * 4);
    for (var i = 0; i < n; i++) {
      var k = i / (n - 1);
      var px = w * (0.18 + 0.64 * k) + (R() - 0.5) * 30;
      var pr = 28 + R() * 34 * (1 - Math.abs(k - 0.5) * 1.2);
      var py = h * 0.64 - pr * 0.45 + (R() - 0.5) * 10;
      var gr = g.createRadialGradient(px, py - pr * 0.25, pr * 0.1, px, py, pr);
      gr.addColorStop(0, api.rgba(C.cloud, 0.97)); gr.addColorStop(0.62, api.rgba(C.cloud, 0.8)); gr.addColorStop(1, api.rgba(C.cloud, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  function place() {
    var f = api.free ? api.free(40) : null;
    if (f && f.w > 40 && f.h > 40) { sun.x = f.x + f.w * 0.72; sun.y = f.y + Math.min(f.h * 0.3, H * 0.22); }
    else { sun.x = W * 0.78; sun.y = H * 0.16; }
    sun.y = Math.min(sun.y, H * 0.4);
  }

  function buildSky() {
    sky = mk(W, H); var g = sky.getContext('2d');
    var lg = g.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, C.top); lg.addColorStop(0.5, C.mid); lg.addColorStop(0.82, C.low); lg.addColorStop(1, C.low);
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    var D = Math.max(W, H);
    var ag = g.createRadialGradient(W * 0.1, H * 0.75, 0, W * 0.1, H * 0.75, D * 0.6);
    ag.addColorStop(0, api.rgba(C.aqua, 0.35)); ag.addColorStop(1, api.rgba(C.aqua, 0));
    g.fillStyle = ag; g.fillRect(0, 0, W, H);
    var sg = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, D * 0.55);
    sg.addColorStop(0, api.rgba(C.sun, 0.95)); sg.addColorStop(0.07, api.rgba(C.sun, 0.6));
    sg.addColorStop(0.35, api.rgba(C.sun, 0.16)); sg.addColorStop(1, api.rgba(C.sun, 0));
    g.fillStyle = sg; g.fillRect(0, 0, W, H);
    g.save(); g.rotate(-0.32);
    var sh = g.createLinearGradient(0, H * 0.12, 0, H * 0.34);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.11)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fillRect(-W, 0, W * 3, H * 0.5);
    g.restore();
  }

  function hill(g, base, amp, f1, ph, cTop, cBot, sheen) {
    var pts = [], top = H;
    for (var x = 0; x <= W + 8; x += 8) {
      var u = x / W * Math.PI;
      var y = base - amp * (0.6 * Math.sin(u * f1 + ph) + 0.4 * Math.sin(u * f1 * 2.3 + ph * 1.7));
      pts.push(x, y); if (y < top) top = y;
    }
    g.beginPath(); g.moveTo(0, H);
    for (var i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.lineTo(W + 8, H); g.closePath();
    var lg = g.createLinearGradient(0, top, 0, H);
    lg.addColorStop(0, cTop); lg.addColorStop(1, cBot);
    g.fillStyle = lg; g.fill();
    g.save(); g.clip();
    g.beginPath();
    for (var j = 0; j < pts.length; j += 2) { if (j === 0) g.moveTo(pts[j], pts[j + 1]); else g.lineTo(pts[j], pts[j + 1]); }
    g.lineJoin = 'round';
    g.lineWidth = sheen; g.strokeStyle = 'rgba(255,255,255,0.22)'; g.stroke();
    g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
    g.restore();
  }

  function buildHills() {
    hills = mk(W, H); var g = hills.getContext('2d');
    var hz = g.createLinearGradient(0, H * 0.62, 0, H * 0.84);
    hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, 'rgba(255,255,255,0.45)');
    g.fillStyle = hz; g.fillRect(0, H * 0.62, W, H * 0.22);
    hill(g, H * 0.81, H * 0.05, 1.6, 0.8, api.mix(C.g1, C.low, 0.55), api.mix(C.g2, C.low, 0.45), H * 0.02);
    hill(g, H * 0.87, H * 0.06, 1.2, 2.4, C.g1, C.g2, H * 0.03);
    hill(g, H * 0.95, H * 0.045, 0.9, 4.1, api.mix(C.g1, '#ffffff', 0.12), api.mix(C.g2, '#0b4a2a', 0.3), H * 0.035);
  }

  function initBubbles() {
    var area = W * H / (1600 * 900);
    var n = Math.round((P.bubbles || 28) * Math.min(1.4, Math.max(0.5, area)) * (api.preview ? 0.6 : 1));
    bubbles = [];
    for (var i = 0; i < n; i++) {
      var z = Math.pow(R(), 1.6) * 0.85 + 0.15;
      bubbles.push({ z: z, u: R(), off: R() * 10000, sp: 10 + 38 * z, ph: R() * 6.28, wf: 0.25 + R() * 0.35, amp: 8 + 26 * z });
    }
    bubbles.sort(function (a, b) { return a.z - b.z; });
  }

  function initClouds() {
    clouds = [];
    var n = api.preview ? 3 : 5;
    for (var j = 0; j < n; j++) clouds.push({ s: cloudSpr[j % cloudSpr.length], u: R(), v: 0.06 + R() * 0.38, sc: 0.5 + R() * 0.8, sp: 3 + R() * 6, a: 0.65 + R() * 0.3 });
  }

  function resize(w, h) {
    W = Math.max(1, w); H = Math.max(1, h);
    scl = Math.min(1.3, Math.max(0.6, Math.min(W, H) / 800));
    sclC = Math.max(0.6, Math.min(1.4, W / 1400));
    place(); buildSky(); buildHills(); initBubbles();
  }

  bub = makeBubble();
  for (var ci = 0; ci < 4; ci++) cloudSpr.push(makeCloud());
  initClouds();
  resize(api.width, api.height);

  return {
    resize: resize,
    zones: function () { place(); buildSky(); },
    frame: function (t, dt) {
      if (!sky) return;
      ctx.drawImage(sky, 0, 0, W, H);

      // slow light rays from the sun
      var D = Math.sqrt(W * W + H * H);
      ctx.save(); ctx.translate(sun.x, sun.y);
      var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, D * 0.9);
      rg.addColorStop(0, 'rgba(255,255,255,0.3)'); rg.addColorStop(0.45, 'rgba(255,255,255,0.08)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      var base = t * 0.015;
      for (var i = 0; i < 9; i++) {
        var a = base + i / 9 * Math.PI * 2 + Math.sin(t * 0.21 + i) * 0.04;
        var w = 0.045 + 0.03 * Math.sin(i * 2.3 + t * 0.3);
        ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 0.4 + i * 1.7);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, D, a - w, a + w); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // drifting clouds
      for (var c = 0; c < clouds.length; c++) {
        var k = clouds[c], cw = 360 * k.sc * sclC, ch = 150 * k.sc * sclC;
        var span = W + cw;
        var cx = ((k.u * span + t * k.sp) % span) - cw;
        var cy = k.v * H;
        ctx.globalAlpha = k.a * (1 - 0.45 * calm(cx + cw / 2, cy + ch / 2, 60));
        ctx.drawImage(k.s, cx, cy, cw, ch);
      }
      ctx.globalAlpha = 1;

      ctx.drawImage(hills, 0, 0, W, H);

      // glossy bubbles rising at different depths
      for (var b = 0; b < bubbles.length; b++) {
        var q = bubbles[b], r = (8 + 58 * q.z * q.z) * scl;
        var bs = H + r * 2 + 40;
        var y = H + r - ((q.off + t * q.sp) % bs);
        var x = q.u * W + Math.sin(t * q.wf + q.ph) * q.amp;
        var al = (0.35 + 0.65 * q.z) * (1 - 0.7 * calm(x, y, r + 20));
        if (al <= 0.02) continue;
        var sq = 1 + 0.04 * Math.sin(t * 1.3 + q.ph);
        ctx.globalAlpha = al;
        ctx.drawImage(bub, x - r * sq, y - r / sq, r * 2 * sq, r * 2 / sq);
      }
      ctx.globalAlpha = 1;
    }
  };
});
