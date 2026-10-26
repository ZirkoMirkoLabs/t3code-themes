// Template "wordmark": the theme title animated in one of several styles, seeded per mount.
// params: { style: neon|bounce|type|wave|scramble|stamp, font: sans|serif|mono|round|display }
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette;
  var style = api.params.style || 'wave', text = api.text || 'Hello', W, H, size;
  var FONTS = { sans: '600 {s}px "Segoe UI", system-ui, sans-serif', serif: 'italic 500 {s}px Georgia, "Palatino Linotype", serif', mono: '600 {s}px Consolas, ui-monospace, monospace',
    round: '700 {s}px "Trebuchet MS", "Comic Sans MS", sans-serif', display: '300 {s}px Bahnschrift, "DIN Alternate", "Segoe UI", sans-serif' };
  var fontTpl = FONTS[api.params.font] || FONTS.sans, glyphs = '#%&*+=<>/\\|ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  var seed = api.random() * 100, cols = [P.accent, P.accent2, api.mix(P.accent, P.accent2, 0.5)];
  function font(s) { return fontTpl.replace('{s}', s); }
  function layout() { W = api.width; H = api.height; size = Math.min(56, H * 0.42); ctx.font = font(size); while (ctx.measureText(text).width > W * 0.9 && size > 16) { size -= 2; ctx.font = font(size); } }
  layout();
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H); ctx.font = font(size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      var widths = [], total = 0; for (var i = 0; i < text.length; i++) { widths.push(ctx.measureText(text[i]).width); total += widths[i]; }
      var x = (W - total) / 2, cy = H * 0.55;
      for (var k = 0; k < text.length; k++) {
        var ch = text[k], d = k * 0.06, u = Math.max(0, Math.min(1, (t - 0.2 - d) / 0.6)), y = cy, a = u, col = cols[k % cols.length];
        if (style === 'bounce') { y = cy - (1 - u) * H * 0.6 + (u >= 1 ? Math.sin(t * 2 + k * 0.5) * 2 : -Math.sin(u * Math.PI) * 10); a = u > 0 ? 1 : 0; }
        else if (style === 'type') { a = t > 0.3 + k * 0.07 ? 1 : 0; col = P.text; }
        else if (style === 'wave') { y = cy + Math.sin(t * 2.4 - k * 0.45 + seed) * 6 * u; }
        else if (style === 'scramble') { if (t < 0.4 + d * 4) ch = glyphs[Math.floor(api.hash(k, Math.floor(t * 16)) * glyphs.length)]; col = t < 0.4 + d * 4 ? P.accent2 : P.text; a = 1; }
        else if (style === 'stamp') { var sc = 1 + (1 - u) * 1.5; ctx.save(); ctx.globalAlpha = u; ctx.translate(x + widths[k] / 2, cy); ctx.scale(sc, sc); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(ch, 0, 0); ctx.restore(); x += widths[k]; continue; }
        else if (style === 'neon') { var flick = t < 1.2 ? (api.hash(k, Math.floor(t * 20)) > 0.5 ? 1 : 0.2) : 0.9 + 0.1 * Math.sin(t * 9 + k); a = flick; ctx.shadowColor = col; ctx.shadowBlur = 16; }
        ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillText(ch, x, y); ctx.shadowBlur = 0; x += widths[k];
      }
      ctx.globalAlpha = 1;
      if (style === 'type' && Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = P.accent; ctx.fillRect(Math.min(x, (W - total) / 2 + total * Math.min(1, (t - 0.3) / (text.length * 0.07))) + 3, cy - size * 0.4, size * 0.08 + 2, size * 0.8); }
    }
  };
});
