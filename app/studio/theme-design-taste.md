# Design taste

North star: the result should feel like a premium tool with a beautiful wallpaper, in the spirit of Linear, Raycast, Arc, Things, Zed or a well-loved editor theme such as Rosé Pine, Tokyo Night or Kanagawa. It should not look like a screensaver, a children's illustration or a canvas tutorial. The person stares at this app all day. Make it calm and confident, and add one moment of delight.

## 1. Atmosphere, not illustration
- Figurative objects drawn in code look like clip-art: a planet made of a circle and ovals, a house made of rectangles, an outlined character. Don't build the scene out of them.
- Evoke the subject with light, colour, depth, texture and motion: soft gradients, glows, fog, bokeh, caustics, aurora, rain on glass, dust in a light beam, a horizon line, a fine grid, halftone, dithering, film grain.
- If a recognisable object is essential, render it as light and form, never as outline plus flat fill.
  - A planet: a large sphere shaded with a radial gradient, a soft terminator, a thin atmospheric rim light, partly cropped by the canvas edge.
  - A city or diner: a distant silhouette band, a few warm lit windows and a neon glow reflected on the ground.
  - Crop it, make it big and soft-edged, and keep it slightly out of focus. Cropping reads as cinematic; a whole small object in the middle reads as a sticker.
- Test every frame: would a good designer ship it as a desktop wallpaper? If it looks like a drawing exercise, remove shapes until it doesn't.

## 2. Composition
- Use one light source or focal glow. Place it in api.free(), off-centre or bleeding off an edge, and re-place it in zones() and resize().
- Build 2–3 depth layers: a dim, slow far layer, a mid layer and an optional sparse near layer. Gentle parallax only.
- Keep the value range narrow. Most of the frame stays within about 8 % lightness of bg. Only the focal point is bright. In dark themes nothing outshines the focal point; in light themes there are no muddy greys.
- Empty space is not flat space. Give quiet areas faint texture: grain at 2–4 % alpha, a slow gradient, distant haze. This also hides gradient banding.
- Under text zones the scene fades to almost plain bg (use api.calm()).

## 3. Palette: neutral chrome, mood in the scene
Think like Linear's theme system: a tinted neutral base, one accent and a contrast level. Derive everything else from those.
- **Chrome stays near-neutral.** bg, surface and border are low-saturation tints of the scene's hue (HSL saturation about 5–25 %). The scene may be rich; the UI is the frame around it.
  - Dark: bg lightness 6–11 %; surface 3–5 % lighter, same hue; border about 10 % above surface; text lightness 88–94 %; muted 60–70 %.
  - Light: bg lightness 96–99 %; surface white or 2 % off bg; border 10–14 % darker than bg; text lightness 10–18 %; muted 40–48 %.
- **One accent** carries action: the send button, focus ring, selected marker and links. It is saturated enough to read as "press me" and appears in small amounts. accent2 is a quiet analogous neighbour for rare highlights. Never use two loud colours.
- codeBg is one step deeper than surface (dark) or a hair darker than bg (light). codeText is the text colour or slightly softer.
- selection is a muted tint of the accent, never a bright fill.
- sceneColors may be more saturated than the chrome. They carry the mood.
- Proven families to start from, shifting the hue toward the subject:
  - Rosé Pine: base #191724, surface #1f1d2e, text #e0def4, muted #908caa, accents #ebbcba, #9ccfd8, #f6c177.
  - Tokyo Night: #1a1b26, #24283b, #c0caf5, #7aa2f7, #bb9af7.
  - Kanagawa: #1f1f28, #2a2a37, #dcd7ba, #7e9cd8, #c0a36e.
  - Nord: #2e3440, #3b4252, #eceff4, #88c0d0.
  - Vesper: #101010, #1c1c1c, #ffffff, #ffc799.
  - Catppuccin Latte (light): #eff1f5, #e6e9ef, #4c4f69, #8839ef.
  - Solarized Light: #fdf6e3, #eee8d5, #586e75, #268bd2.
- Avoid pure #000 or #fff bg, saturated mid-tone backgrounds, neon on neon, rainbow scenes and the default purple-to-pink gradient.

## 4. Typography
- ui: "Segoe UI", system-ui, sans-serif. Always readable and never decorative.
- display: usually the UI face, used heavier. Use a characterful face only when the subject owns it: Georgia or "Palatino Linotype" for editorial, café or literary; Bahnschrift for industrial, tech or sci-fi; "Cascadia Mono" for terminal. Impact, "Arial Black" and "Comic Sans MS" only when the user asks for cartoon or comic.
- mono: "Cascadia Mono" or Consolas. "Lucida Console" or "Courier New" only for retro typewriter or terminal subjects.
- heroStyle "plain" is the default and almost always right. Use "gradient" for luminous, airy themes, "glow" only for neon or CRT, and "outline" or "shadow" only for cartoon or comic.
- uppercase false and textGlow false unless the subject is a terminal, CRT or neon sign.

## 5. Shape and material
Pick one material and let the values follow from it:
- **Default (clean):** radius 10–14, borderWidth 1, density normal, shadow soft, decor none, topbar glass or solid.
- **Glass (space, ocean, night):** surface glass, glass 0.82–0.9, blur 12–20, shadow soft.
- **Paper (café, notebook, editorial):** surface paper, glass 0.94–0.98, blur 0, radius 8–12, overlay grain.
- **Terminal / CRT:** radius 0–6, topbar accent-line; overlay scanlines only for CRT.
- **Toy / cartoon (only when asked):** radius 16–22, borderWidth 2–3, shadow hard.

decor is almost always none, and borderWidth is 1. Double outlines, stitched borders and thick coloured frames look dated. Use them only when the subject literally has that motif. Never mix materials, for example a hard cartoon shadow on frosted glass.

## 6. Motion
- Keep motion slow, continuous and low-amplitude, with periods of 8–40 s. Move light and air (breathing glows, drifting fog, shimmering caustics, falling rain) rather than objects hopping around.
- One rare, quiet event every 20–60 s: a meteor, a car's headlights sweeping past, a flicker of neon. Seed it.
- Soft scenes look better at fps 24–30 and resolution 0.6–0.8, which also saves budget.
- The still frame (motion "still") must look like a finished poster.
- When interactive, the pointer nudges the world (a light follows, fog parts, water ripples). No cursor trails.

## 7. Techniques that look expensive
- Layered large radial gradients with globalCompositeOperation 'lighter' or 'screen', cached in resize().
- A mesh-gradient feel: 3–5 big blurred colour fields (pre-rendered sprites) drifting slowly.
- A cached noise tile drawn as a pattern at low alpha for grain.
- WebGL fbm fog, aurora, nebula or caustics with smooth palette mapping (mix between sceneColors, never raw rainbow).
- Bokeh: 20–60 soft discs of varied size and low alpha, from cached radial-gradient sprites.
- God rays: long thin gradient wedges at 3–6 % alpha. A horizon: a 1 px highlight with a soft glow above it.
- Ordered dither or halftone for retro and print subjects.

These look cheap: hard-edged primitives with strokes, evenly spaced identical particles, pure-colour fills, text drawn into the scene, drop shadows on everything, jittery noise and anything centred and small.

## 8. The welcome moment
- Make a restrained title card. Set api.text in the display face at 28–44 px with letter-spacing of 0.02–0.15 em.
- Reveal it over 1.2–2.5 s with ease-out: fade with a slight blur-to-sharp, a mask wipe, or a light sweep across the letters.
- Add at most one small motif in the theme's material: a line that draws itself, particles condensing, a neon tube warming up, ink spreading. Then idle very quietly with a slow shimmer or breathing glow.
- Leave most of the canvas transparent. The real heading sits just below it.
- No heavy drop shadows and no bouncing letters, unless the subject is cartoon.

## 9. Honouring the user's instructions
- Every explicit request must be visible in a still frame at 1×. Add a selfCheck line for each: "Custom: inked outlines → 2.5 px wobbling ink on the horizon and sign".
- If a request goes against this taste, for example outlines or a busy scene, the user wins. Do it well: consistent line weight of at least 2 px, real hand wobble from noise, and named colours each given a visible role.

## 10. selfCheck must include
- "Concept: …", the one image in a single sentence.
- How the chrome stays neutral and where the accent is used.
- Why the scene reads as atmosphere, not clip-art.
- That the still frame is complete and the focal point sits in free space.

## 11. Hybrid themes (AI picture + atmos layer)
- Write the image prompt like a photo brief: subject, medium, time of day, light direction, two or three colours, and the mood. "Cinematic photograph" or "airbrushed illustration" both work. A list of adjectives does not.
- Composition decides readability. Put the subject in the right third or bleeding off an edge, keep the centre-left calm, and leave sky or soft ground where the chat sits.
- The code layer completes the picture; it doesn't repeat it. If the video already has falling rain, use drops on the glass. If the picture is still, the code supplies the motion (snow, mist, spindrift). Use one to three effects, anchored to real points in the picture: the lamp, the sun, the horizon.
- Take the palette from the picture: its calmest dark (or light) tone for bg, and its signature light for the accent.
