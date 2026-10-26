// Summer Meadow: a deep blue summer sky with huge sunlit cumulus drifting slowly, cloud shadows sliding over
// rolling hills, a lone tree on the crest, tall grass swaying in travelling waves of wind, wildflowers,
// dandelion seeds and light motes. Sky, hills and tree are cached; only clouds, grass and particles animate.
// sceneColors: [0 sky top, 1 sky horizon, 2 cloud light, 3 cloud shade, 4 far hill, 5 near hill, 6 grass light, 7 flower]
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d');
  var P = api.palette, S = P.scene || [];
  var skyTop = S[0] || '#1c58c4', skyLow = S[1] || '#9ad6f5', cLight = S[2] || '#ffffff', cShade = S[3] || '#9db3d8',
      hFar = S[4] || '#7cb8a4', hNear = S[5] || '#3e8c3c', gLight = S[6] || '#9ad857', flower = S[7] || '#ffd84a';
  var rnd = api.random, W = 1, H = 1, bg = null, clouds = [], blades = [], flowers = [], seeds = [], land = null;
  var sunX = 0, sunY = 0, treeX = 0;
  var rows = [api.mix(hNear, '#1f5a2c', 0.35), hNear, api.mix(hNear, gLight, 0.45)];
  var petals = [flower, '#ffffff', '#ff9fb8', '#c7a8ff'];

  function mk(w, h) { var c = new OffscreenCanvas(Math.max(1, Math.ceil(w * api.dpr)), Math.max(1, Math.ceil(h * api.dpr))); var x = c.getContext('2d'); x.scale(api.dpr, api.dpr); return { c: c, x: x }; }
  function farY(x) { return H * 0.6 + Math.sin(x * 0.004 + 1.3) * H * 0.025 + Math.sin(x * 0.011 + 0.4) * H * 0.012; }
  function midY(x) { var d = (x - treeX) / (W * 0.28); return H * 0.71 - H * 0.075 * Math.exp(-d * d) + Math.sin(x * 0.006 + 2.1) * H * 0.012; }
  function nearY(x) { return H * 0.8 + Math.sin(x * 0.0035 + 0.6) * H * 0.03 + Math.sin(x * 0.009) * H * 0.01; }

  function hill(x, fy, top, bot) {
    var g = x.createLinearGradient(0, H * 0.5, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot);
    x.beginPath(); x.moveTo(0, H); for (var i = 0; i <= W; i += 8) x.lineTo(i, fy(i)); x.lineTo(W, H); x.closePath(); x.fillStyle = g; x.fill();
  }

  function drawTree(x, tx, ty) {
    var s = Math.max(0.6, Math.min(1.4, H / 800));
    x.fillStyle = '#3b3a26';
    x.beginPath(); x.moveTo(tx - 6 * s, ty + 4); x.quadraticCurveTo(tx - 3 * s, ty - 40 * s, tx - 10 * s, ty - 78 * s);
    x.lineTo(tx + 6 * s, ty - 80 * s); x.quadraticCurveTo(tx + 4 * s, ty - 40 * s, tx + 8 * s, ty + 4); x.closePath(); x.fill();
    var puffs = [];
    for (var i = 0; i < 26; i++) { var a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()); puffs.push([tx + Math.cos(a) * r * 62 * s, ty - 112 * s + Math.sin(a) * r * 40 * s, (16 + rnd() * 16) * s]); }
    var tones = ['#1f4d26', '#2f6b2f', '#4c8f39', '#79b84a'];
    for (var k = 0; k < 4; k++) {
      x.fillStyle = tones[k];
      puffs.forEach(function (p) { var o = k * 4 * s; x.beginPath(); x.arc(p[0] + o * 0.8, p[1] - o, p[2] * (1 - k * 0.18), 0, Math.PI * 2); x.fill(); });
    }
    x.fillStyle = 'rgba(20,40,20,0.22)'; x.beginPath(); x.ellipse(tx - 20 * s, ty + 3, 70 * s, 6 * s, 0, 0, Math.PI * 2); x.fill();
  }

  function makeCloud(scale) {
    var cw = 520 * scale, ch = 300 * scale, L = mk(cw, ch), x = L.x, puffs = [], n = 14;
    for (var i = 0; i < n; i++) {
      var u = i / (n - 1), r = (40 + rnd() * 40) * scale * (1 - Math.abs(u - 0.5) * 0.9);
      puffs.push([cw * (0.12 + u * 0.76) + (rnd() - 0.5) * 30 * scale, ch * 0.7 - r * (0.6 + rnd() * 0.9) * (1 - Math.abs(u - 0.5)) - 10 * scale, r * 1.15]);
    }
    for (var j = 0; j < 6; j++) puffs.push([cw * (0.3 + rnd() * 0.4), ch * (0.25 + rnd() * 0.2), (45 + rnd() * 35) * scale]);
    // shaded underside, then sunlit volumes lit from the upper right
    puffs.forEach(function (p) { x.fillStyle = api.mix(cShade, skyTop, 0.12); x.beginPath(); x.arc(p[0], p[1] + p[2] * 0.12, p[2], 0, Math.PI * 2); x.fill(); });
    puffs.forEach(function (p) {
      var g = x.createRadialGradient(p[0] + p[2] * 0.35, p[1] - p[2] * 0.45, p[2] * 0.1, p[0], p[1], p[2]);
      g.addColorStop(0, cLight); g.addColorStop(0.55, api.mix(cLight, cShade, 0.25)); g.addColorStop(1, api.rgba(cShade, 0));
      x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1] - p[2] * 0.05, p[2] * 0.98, 0, Math.PI * 2); x.fill();
    });
    x.globalCompositeOperation = 'destination-out';
    var fl = x.createLinearGradient(0, ch * 0.72, 0, ch); fl.addColorStop(0, 'rgba(0,0,0,0)'); fl.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = fl; x.fillRect(0, ch * 0.72, cw, ch * 0.28); x.globalCompositeOperation = 'source-over';
    return { c: L.c, w: cw, h: ch };
  }

  function build() {
    W = api.width; H = api.height;
    var f = api.free ? api.free(30) : { x: W * 0.5, y: 0, w: W * 0.5, h: H };
    treeX = Math.max(W * 0.56, Math.min(W * 0.9, f.x + f.w * 0.62));
    sunX = Math.max(W * 0.55, Math.min(W * 0.92, f.x + f.w * 0.75)); sunY = H * 0.1;
    var L = mk(W, H), x = L.x;
    var g = x.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, skyTop); g.addColorStop(0.45, api.mix(skyTop, skyLow, 0.45)); g.addColorStop(1, skyLow);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    var sg = x.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.7);
    sg.addColorStop(0, 'rgba(255,250,225,0.75)'); sg.addColorStop(0.15, 'rgba(255,244,200,0.3)'); sg.addColorStop(1, 'rgba(255,244,200,0)');
    x.fillStyle = sg; x.fillRect(0, 0, W, H);
    var hz = x.createLinearGradient(0, H * 0.48, 0, H * 0.64); hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, 'rgba(240,250,255,0.45)');
    x.fillStyle = hz; x.fillRect(0, H * 0.48, W, H * 0.16);
    hill(x, farY, api.mix(hFar, skyLow, 0.3), hFar);
    hill(x, midY, api.mix(hNear, gLight, 0.35), api.mix(hNear, '#1f5a2c', 0.2));
    drawTree(x, treeX, midY(treeX));
    hill(x, nearY, api.mix(hNear, gLight, 0.2), api.mix(hNear, '#173f22', 0.45));
    bg = L.c;
    land = new Path2D(); land.moveTo(0, H); for (var i = 0; i <= W; i += 16) land.lineTo(i, farY(i)); land.lineTo(W, H); land.closePath();
    clouds = [];
    var specs = [[1.25, 0.08], [0.95, 0.22], [0.7, 0.05], [0.55, 0.3], [1.05, 0.14]];
    specs.forEach(function (sp, i) { var c = makeCloud(sp[0] * Math.max(0.6, Math.min(1.5, W / 1500))); c.x0 = rnd(); c.y = H * sp[1]; c.v = 4 + (1.3 - sp[0]) * 5; c.i = i; clouds.push(c); });
    blades = [];
    var n = Math.min(330, Math.round(W / 4.5));
    for (var b = 0; b < n; b++) {
      var bx = rnd() * (W + 40) - 20, d = rnd(), row = d < 0.4 ? 0 : d < 0.75 ? 1 : 2;
      var by = nearY(bx) + (H - nearY(bx)) * (0.05 + d * 0.95) + 6;
      blades.push({ x: bx, y: by, h: (24 + rnd() * 34 + d * 46) * Math.max(0.7, H / 900), w: 1.2 + d * 2.2, p: rnd() * 6.28, row: row, calm: 0 });
    }
    blades.sort(function (a, b2) { return a.y - b2.y; });
    flowers = [];
    for (var k = 0; k < Math.round(W / 28); k++) { var fx = rnd() * W, fd = rnd(); flowers.push({ x: fx, y: nearY(fx) + (H - nearY(fx)) * (0.1 + fd * 0.8) + 4, r: 2 + fd * 3, c: petals[Math.floor(rnd() * petals.length)], p: rnd() * 6.28, h: 14 + fd * 30, calm: 0 }); }
    seeds = [];
    for (var m = 0; m < 70; m++) seeds.push({ x0: rnd(), y0: 0.25 + rnd() * 0.7, v: 0.012 + rnd() * 0.03, a: 10 + rnd() * 30, f: 0.3 + rnd() * 0.6, p: rnd() * 6.28, seed: m < 28, r: 0.8 + rnd() * 1.8 });
    zoneCalm();
  }

  function zoneCalm() {
    blades.forEach(function (b) { b.calm = api.calm(b.x, b.y - b.h * 0.5, 40); });
    flowers.forEach(function (fl) { fl.calm = api.calm(fl.x, fl.y, 40); });
  }

  function wind(x, t) { var g = Math.sin(x * 0.0045 - t * 1.25); return 0.35 + 0.65 * Math.max(0, g) * Math.max(0, g); }

  build();
  return {
    resize: build,
    zones: function () { zoneCalm(); },
    frame: function (t) {
      ctx.drawImage(bg, 0, 0, W, H);
      // clouds drift right and wrap
      clouds.forEach(function (c) {
        var span = W + c.w * 1.2, x = ((c.x0 * span + t * c.v) % span) - c.w * 0.6;
        ctx.drawImage(c.c, x, c.y, c.w, c.h);
      });
      // cloud shadows sliding over the land
      ctx.save(); ctx.clip(land);
      for (var s = 0; s < 2; s++) {
        var span2 = W * 1.6, sx = ((s * 0.55 * span2 + t * 9) % span2) - W * 0.3, sy = H * (0.72 + s * 0.08);
        var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.22);
        sg.addColorStop(0, 'rgba(18,48,40,0.2)'); sg.addColorStop(1, 'rgba(18,48,40,0)');
        ctx.fillStyle = sg; ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.28); ctx.translate(-sx, -sy);
        ctx.fillRect(sx - W * 0.22, sy - W * 0.22, W * 0.44, W * 0.44); ctx.restore();
      }
      ctx.restore();
      // grass: one path per depth row, plus a highlight pass where the wind wave crests
      var hi = new Path2D();
      for (var r = 0; r < 3; r++) {
        ctx.beginPath();
        for (var i = 0; i < blades.length; i++) {
          var b = blades[i]; if (b.row !== r) continue;
          var wv = wind(b.x, t), amp = (1 - 0.65 * b.calm);
          var bend = (wv * 0.55 + Math.sin(t * 2.1 + b.p) * 0.08) * b.h * amp;
          var tx = b.x + bend, ty = b.y - b.h * (1 - 0.18 * wv * amp);
          ctx.moveTo(b.x - b.w, b.y); ctx.quadraticCurveTo(b.x + bend * 0.25, b.y - b.h * 0.55, tx, ty);
          ctx.quadraticCurveTo(b.x + bend * 0.25 + b.w * 0.4, b.y - b.h * 0.55, b.x + b.w, b.y);
          if (wv > 0.72 && r > 0) { hi.moveTo(b.x - b.w * 0.5, b.y - b.h * 0.3); hi.quadraticCurveTo(b.x + bend * 0.3, b.y - b.h * 0.6, tx, ty); hi.lineTo(b.x + b.w * 0.5, b.y - b.h * 0.3); }
        }
        ctx.fillStyle = rows[r]; ctx.fill();
      }
      ctx.fillStyle = api.rgba(gLight, 0.55); ctx.fill(hi);
      // wildflowers riding the grass
      for (var k = 0; k < flowers.length; k++) {
        var fl = flowers[k], fw = wind(fl.x, t) * (1 - 0.65 * fl.calm), fxp = fl.x + fw * fl.h * 0.4, fyp = fl.y - fl.h;
        ctx.strokeStyle = rows[1]; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(fl.x, fl.y); ctx.quadraticCurveTo(fl.x, fl.y - fl.h * 0.5, fxp, fyp); ctx.stroke();
        ctx.fillStyle = fl.c; ctx.beginPath(); ctx.arc(fxp, fyp, fl.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f2a830'; ctx.beginPath(); ctx.arc(fxp, fyp, fl.r * 0.38, 0, Math.PI * 2); ctx.fill();
      }
      // dandelion seeds and light motes on the breeze
      for (var m = 0; m < seeds.length; m++) {
        var o = seeds[m], px = ((o.x0 + t * o.v) % 1.1 - 0.05) * W;
        var py = (o.y0 - ((t * o.v * 0.35) % 0.8)) * H + Math.sin(t * o.f + o.p) * o.a;
        if (py < -10) py += H * 0.8;
        var al = (1 - 0.85 * api.calm(px, py, 40));
        if (al < 0.05) continue;
        if (o.seed) {
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.75 * al).toFixed(3) + ')'; ctx.lineWidth = 0.8; ctx.beginPath();
          for (var q = 0; q < 6; q++) { var an = q * 1.047 + t * 0.4 + o.p; ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(an) * 4, py + Math.sin(an) * 4); }
          ctx.moveTo(px, py); ctx.lineTo(px - 2, py + 6); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(255,248,210,' + (0.5 * al * (0.6 + 0.4 * Math.sin(t * 1.7 + o.p))).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(px, py, o.r, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  };
});
