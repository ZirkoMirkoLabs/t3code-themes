# T3 Code Themes

Ten animated, code-only themes for [T3 Code](https://github.com/pingdotgg/t3code), by Zirko Mirko Labs.

Each theme is a small folder of plain files. A theme sets the colours, fonts and panel style, draws a live animated background and plays a short title animation. All the art is drawn in code. There are no image or video files, and the code makes no network requests.

| | | |
|---|---|---|
| ![Golden Hour](themes/rooftop-dusk/thumb.jpg)<br>**Golden Hour** · the city exhales before the lights come on | ![Ridgeline](themes/ridgeline/thumb.jpg)<br>**Ridgeline** · last light over the far ridges | ![Koi Pond](themes/koi-pond/thumb.jpg)<br>**Koi Pond** · still water, slow thoughts |
| ![Lantern Night](themes/lantern-sky/thumb.jpg)<br>**Lantern Night** · make a wish and let it rise | ![Cozy Cabin](themes/cozy-cabin/thumb.jpg)<br>**Cozy Cabin** · warm windows, quiet snow | ![Great Wave](themes/great-wave/thumb.jpg)<br>**Great Wave** · a woodblock sea (light) |
| ![Summer Meadow](themes/meadow-breeze/thumb.jpg)<br>**Summer Meadow** · the wind knows the way home (light) | ![Aero](themes/frutiger-aero/thumb.jpg)<br>**Aero** · glossy bubbles, blue sky (light) | ![Blue Tide](themes/blue-tide/thumb.jpg)<br>**Blue Tide** · the sea is glowing tonight |
| ![Silk](themes/silk-flow/thumb.jpg)<br>**Silk** · folds of light, slowly breathing | | |

## What is in a theme

```
themes/<id>/
  theme.json   colours, fonts, shape, panel style and scene settings (format "t3theme/1")
  scene.js     the animated background, drawn on a canvas
  welcome.js   the title animation shown above the prompt
  thumb.jpg    640x400 preview for the theme picker
```

## Safety

Theme code is treated as untrusted. The runtime runs `scene.js` and `welcome.js` in a Web Worker inside a sandboxed iframe with an opaque origin and a Content Security Policy that blocks all network access. Theme code cannot read the page, cookies, chats or keys. A scene that hangs is stopped, and a scene that is too heavy is first drawn at a lower resolution, then frozen. Reduced-motion settings pause it.

Scenes keep the areas behind the sidebar, messages and composer calm, so text stays readable. Every palette is checked for WCAG contrast.

## Using them

T3 Code has no built-in theme support yet. These themes run on the T3 Skins runtime, a separate window that wraps the official client without changing it. If T3 Code adds theme support, these folders are meant to drop straight in.

## License

MIT. See [LICENSE](LICENSE).
