// Event Horizon welcome: an anamorphic light beam sweeps in, then the title decodes letter by letter out of
// scrambled glyphs while its tracking tightens; a small eclipsed ring glows behind it. Scramble order is seeded.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var hot = S[1] || '#fff1d6', warm = S[2] || P.accent, cool = S[3] || P.accent2;
  var text = (api.text || 'EVENT HORIZON').toUpperCase(), W, H, size, glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/\\|';
  var order = []; for (var i = 0; i < text.length; i++) order.push(i);
  for (var k = order.length - 1; k > 0; k--) { var j = Math.floor(api.random() * (k + 1)); var tmp = order[k]; order[k] = order[j]; order[j] = tmp; }
  var reveal = []; order.forEach(function (idx, n) { reveal[idx] = 0.7 + n * (1.3 / text.length) + api.random() * 0.15; });
  var motes = []; for (var m = 0; m < 26; m++) motes.push({ x: api.random(), y: api.random(), v: 0.01 + api.random() * 0.03, r: 0.5 + api.random() * 1.2 });
  function layout() { W = api.width; H = api.height; size = Math.min(40, H * 0.3); }
  layout();
  function font(s) { return '300 ' + s + 'px Bahnschrift, "DIN Alternate", "Segoe UI", sans-serif'; }
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H * 0.56;
      // eclipsed ring behind the title
      var ringIn = Math.min(1, Math.max(0, (t - 0.2) / 1.2)), rr = H * 0.34;
      if (ringIn > 0) {
        var g = ctx.createRadialGradient(cx, cy, rr * 0.8, cx, cy, rr * 1.6);
        g.addColorStop(0, api.rgba(warm, 0.0)); g.addColorStop(0.2, api.rgba(warm, 0.22 * ringIn)); g.addColorStop(1, api.rgba(warm, 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fillStyle = P.bg; ctx.fill();
        ctx.lineWidth = 1.4; ctx.strokeStyle = api.rgba(hot, 0.85 * ringIn); ctx.stroke();
      }
      // anamorphic beam
      var beam = Math.min(1, t / 0.9), pulse = 0.75 + 0.25 * Math.sin(t * 1.3);
      var bx = -W * 0.3 + (cx + W * 0.3) * (1 - Math.pow(1 - beam, 3));
      var bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, api.rgba(cool, 0)); bg.addColorStop(Math.max(0.01, Math.min(0.99, bx / W)), api.rgba(hot, 0.85 * pulse)); bg.addColorStop(1, api.rgba(cool, 0));
      ctx.fillStyle = bg; ctx.fillRect(0, cy - 1, W, 2);
      ctx.globalAlpha = 0.25 * pulse; ctx.fillRect(0, cy - 5, W, 10); ctx.globalAlpha = 1;
      // motes drifting through the beam
      motes.forEach(function (o) { var x = ((o.x + t * o.v) % 1) * W, y = cy + (o.y - 0.5) * H * 0.7; ctx.fillStyle = api.rgba(hot, 0.35 * (1 - Math.abs(o.y - 0.5) * 2)); ctx.fillRect(x, y, o.r, o.r); });
      // decoding title, tracking condenses from wide to final
      var track = 4 + 18 * Math.max(0, 1 - (t - 0.6) / 2.2);
      ctx.font = font(size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      var widths = []; var total = 0;
      for (var a = 0; a < text.length; a++) { var w = ctx.measureText(text[a]).width; widths.push(w); total += w + track; }
      total -= track; var x = cx - total / 2;
      for (var b = 0; b < text.length; b++) {
        var ch = text[b], rt = reveal[b];
        if (ch !== ' ' && t > rt - 0.6) {
          var done = t >= rt, shown = done ? ch : glyphs[Math.floor(api.hash(b, Math.floor(t * 18)) * glyphs.length)];
          ctx.fillStyle = done ? '#f4f6fb' : api.rgba(cool, 0.75);
          ctx.shadowColor = api.rgba(warm, done ? 0.55 : 0.2); ctx.shadowBlur = done ? 14 : 4;
          ctx.fillText(shown, x, cy);
        }
        x += widths[b] + track;
      }
      ctx.shadowBlur = 0;
    }
  };
});
