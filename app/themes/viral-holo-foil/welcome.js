// "RARE PULL" foil stamp: the title card flips in edge-on, a rarity star pops above it with a ray burst,
// then the embossed foil lettering keeps shifting hue (tilt) with a periodic shine sweep. Seeded foil type
// (Prism / Cosmos / Gold), sparkle layout and sweep timing, so no two pulls play the same.
T3Welcome(function (api) {
  var c = api.canvas.getContext('2d'), P = api.palette, W, H;
  var FOILS = [
    ['PRISM', ['#5ee7ff', '#a98bff', '#ff6fd8', '#ffd36e', '#5ee7ff']],
    ['COSMOS', ['#8f7bff', '#5ee7ff', '#ffffff', '#ff6fd8', '#8f7bff']],
    ['GOLD', ['#b98425', '#ffd36e', '#fff4cf', '#e0a53a', '#b98425']]
  ];
  var pick = FOILS[Math.floor(api.random() * 3)], seed = api.random() * 6.28, sweepOff = api.random() * 2;
  var serial = '001';
  var sparks = [];
  for (var i = 0; i < 22; i++) sparks.push({ x: api.random(), y: api.random(), p: api.random() * 6.28, s: 2 + api.random() * 4 });
  function resize() { W = api.width; H = api.height; }
  resize();
  function star(x, y, r, inner) {
    c.beginPath();
    for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4 - Math.PI / 2, rr = k % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  }
  function grad(x0, x1, shift) {
    var g = c.createLinearGradient(x0, 0, x1, 0), s = pick[1];
    for (var k = 0; k < s.length; k++) g.addColorStop(((k / (s.length - 1)) + shift + 10) % 1, s[k]);
    return g;
  }
  function rainbow(x0, x1, shift) {
    // gradient stops must be sorted, so build a wrapped hue band instead of shifting stops
    var g = c.createLinearGradient(x0 - (x1 - x0) * shift, 0, x1 - (x1 - x0) * shift + (x1 - x0), 0), s = pick[1];
    for (var k = 0; k < 9; k++) g.addColorStop(k / 8, s[k % (s.length - 1)]);
    return g;
  }
  return {
    resize: resize,
    frame: function (t) {
      c.clearRect(0, 0, W, H);
      var cx = W / 2, u = Math.min(1, Math.max(0, t / 1.3)), e = 1 - Math.pow(1 - u, 3);
      var size = Math.min(62, W * 0.12), ty = H * 0.56;
      var font = '900 ' + size + 'px "Arial Black", Bahnschrift, Impact, sans-serif';
      c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
      if ('letterSpacing' in c) c.letterSpacing = Math.round(size * 0.06) + 'px';
      var tw = Math.min(c.measureText(api.text).width, W * 0.9);
      var tilt = Math.sin(t * 0.55 + seed) * 0.5 + 0.5;

      // 1. foil-stamped title, flipping in from edge-on
      c.save();
      c.translate(cx, ty); c.scale(Math.max(0.02, Math.sin(e * Math.PI / 2)), 1);
      c.fillStyle = rainbow(-tw / 2, tw / 2, tilt * 0.5);
      c.fillText(api.text, 0, 0, W * 0.9);
      // diffraction grating + shine sweep, painted only onto the lettering
      c.globalCompositeOperation = 'source-atop';
      c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 1;
      c.beginPath();
      for (var x = -tw / 2 - 60; x < tw / 2 + 60; x += 5) { c.moveTo(x, -size); c.lineTo(x + size * 0.7, size); }
      c.stroke();
      var cyc = (t - 1.1 + sweepOff) % 3.4, sx = -tw / 2 - 80 + (cyc / 0.9) * (tw + 160);
      if (t > 1.1 && cyc < 0.9) {
        var sg = c.createLinearGradient(sx - 40, 0, sx + 40, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.95)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = sg; c.save(); c.transform(1, 0, -0.5, 1, 0, 0); c.fillRect(sx - 60, -size, 120, size * 2); c.restore();
      }
      // emboss: light top edge and a hard drop shadow sit behind the foil
      c.globalCompositeOperation = 'destination-over';
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillText(api.text, -1, -1.5, W * 0.9);
      c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillText(api.text, 2, 4, W * 0.9);
      c.restore();
      c.globalCompositeOperation = 'source-over';

      // 2. rarity star with pop + ray burst
      var su = Math.min(1, Math.max(0, (t - 0.75) / 0.5)), pop = su < 1 ? 1 + Math.sin(su * Math.PI) * 0.45 : 1;
      var sy = H * 0.17, sr = Math.min(22, H * 0.12) * su * pop;
      var burst = Math.max(0, 1 - Math.abs(t - 1.2) / 0.7);
      if (burst > 0) {
        c.save(); c.translate(cx, sy); c.strokeStyle = 'rgba(255,244,207,' + (burst * 0.7).toFixed(3) + ')'; c.lineWidth = 1.5;
        for (var k = 0; k < 16; k++) { var a = k * Math.PI / 8 + seed, r0 = 16 + (1 - burst) * 40, r1 = r0 + 18 + burst * 30; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke(); }
        c.restore();
      }
      if (sr > 0.5) {
        c.save(); c.translate(cx, sy); c.rotate(Math.sin(t * 0.8 + seed) * 0.12);
        c.shadowColor = pick[1][1]; c.shadowBlur = 14;
        star(0, 0, sr, 0.3); c.fillStyle = grad(-sr, sr, tilt * 0.6); c.fill();
        c.shadowBlur = 0; star(0, 0, sr * 0.5, 0.3); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill();
        c.restore();
        // thin collector lines either side of the star
        var la = Math.min(1, Math.max(0, (t - 1.0) / 0.6));
        c.strokeStyle = rainbow(cx - 160, cx + 160, tilt); c.globalAlpha = 0.7 * la; c.lineWidth = 1;
        c.beginPath(); c.moveTo(cx - 36, sy); c.lineTo(cx - 36 - 120 * la, sy); c.moveTo(cx + 36, sy); c.lineTo(cx + 36 + 120 * la, sy); c.stroke();
        c.globalAlpha = 1;
      }

      // 3. sparkles around the stamp
      for (var j = 0; j < sparks.length; j++) {
        var s = sparks[j], a2 = Math.pow(Math.max(0, Math.sin(t * 1.7 + s.p)), 8) * e;
        if (a2 < 0.03) continue;
        var px = cx + (s.x - 0.5) * (tw + 90), py = H * 0.28 + s.y * H * 0.55;
        c.globalAlpha = a2; star(px, py, s.s * (0.6 + a2 * 0.6), 0.22); c.fillStyle = '#ffffff'; c.fill();
      }
      c.globalAlpha = 1;

      // 4. card metadata line
      var mu = Math.min(1, Math.max(0, (t - 1.4) / 0.6));
      if (mu > 0) {
        c.font = '600 11px Bahnschrift, "Segoe UI", sans-serif';
        if ('letterSpacing' in c) c.letterSpacing = '3px';
        c.fillStyle = P.muted; c.globalAlpha = mu;
        c.fillText(pick[0] + ' FOIL  ✦  No. ' + serial + ' / ' + serial + '  ✦  1 OF 1', cx, H * 0.88);
        c.globalAlpha = 1;
      }
    }
  };
});
