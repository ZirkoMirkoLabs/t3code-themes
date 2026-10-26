'use strict';
// Image/video packs use the same validated UI tokens as code themes. Media stays in the v1 renderer.
const { validateTheme, lum } = require('./theme-validate.cjs');

function adaptSkin(skin) {
  if (!skin || !skin.palette?.bg || !skin.palette?.accent) throw Error('Skin needs background and accent colours');
  const visual = !!(skin.plate?.image || skin.plate?.video);
  const saved = skin.uiTheme || {};
  const raw = {
    name: skin.name, appearance: saved.appearance || (lum(skin.palette.bg) > 0.4 ? 'light' : 'dark'),
    palette: skin.palette,
    // Photographs/video can contain either extreme; do not pretend their extracted average is a guarantee.
    sceneColors: visual ? ['#000000', '#ffffff'] : (skin.scene?.colors || []),
    fonts: saved.fonts || {}, shape: saved.shape || { radius: 8, density: 'normal', borderWidth: 1 },
    ui: { surface: 'glass', glass: 0.94, blur: 12, shadow: 'none', topbar: 'solid',
      heroStyle: 'plain', hideStageArt: true, decor: 'none', textGlow: false, cursorLight: false },
    icons: { style: 'default', color: 'text' }, loader: { style: 'spin' },
    motion: { fps: 30, resolution: 0.75, interactive: false },
    textSafety: { scrim: visual ? 0.82 : 0.65, heroScrim: visual ? 0.8 : 0.5, blur: 6, busy: visual ? 'high' : 'medium' },
  };
  let checked = validateTheme(raw, () => null, { checkFiles: false });
  if (!checked.ok) {
    // A legacy/imported palette may have mutually incompatible surfaces. Keep its accent and artwork.
    const light = raw.appearance === 'light';
    raw.palette = { bg: light ? '#f5f5f4' : '#101214', surface: light ? '#ffffff' : '#191b1f',
      accent: skin.palette.accent, accent2: skin.palette.accent2 };
    checked = validateTheme(raw, () => null, { checkFiles: false });
  }
  if (!checked.ok) throw Error('Skin UI colours could not be made readable');
  const uiTheme = checked.theme;
  delete uiTheme.scene; delete uiTheme.welcome;
  return { ...skin, palette: uiTheme.palette, uiTheme };
}

module.exports = { adaptSkin };
