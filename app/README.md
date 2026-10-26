# T3 Code Themes: the app

A Themes add-on for [T3 Code](https://github.com/pingdotgg/t3code). It opens the real T3 Code client in its own window and adds a **Themes** button at the bottom right. Pick a theme and the whole app changes: colours, fonts, panels, an animated background and a title animation. The official app is not modified.

It ships with 17 themes. **Cozy Room** is the default: a rainy night room with a black cat who lives on your desk. The cat walks behind the composer, paws the Send button, naps on its cushion and wakes up when you type. [Watch the 50-second video](../media/themes-proposal.mp4).

## Install (3 steps)

1. Install **T3 Code** (stable or nightly) and **Node.js LTS** from https://nodejs.org. On Windows, Node is only needed for the first download; on macOS and Linux, `start.sh` also uses it to start the app.
2. Open T3 Code and keep it running.
3. Double-click **`START.cmd`** (macOS/Linux: run `sh start.sh` in this folder). The first launch downloads Electron and ffmpeg (about 200 MB, 1–3 minutes). Later launches open straight away.

The launcher finds your T3 install and its running server by itself. On the first launch, T3 asks you once to approve the "T3 Code Themes" client.

## Using it

- **Themes** (bottom right) or **Skin ▸ Theme library…** (Ctrl+Shift+L) opens the library. Search, hover a card to play it live, click to apply, star to favourite.
- The footer sets motion (**Live / Calm / Still**), intensity, **Focus** and the **Title card**. **Turn off** restores plain T3.
- **Export / Import** shares a theme as one `.t3skin` file. Imported code is validated again and runs only in the sandbox.
- **Create** makes a new theme from a description such as "a lofi night vibe with an interactive cat":
  - **Local templates** are free and instant, with no AI.
  - **Claude Code CLI** and **Codex CLI** use the account you are signed in to.
  - **Claude API** uses your own Anthropic key.
  - **Open in T3 thread** writes the theme in a T3 chat.
- **Skin Studio** (Ctrl+Shift+K) makes picture and video backgrounds. You can use your own image or video for free, or an AI provider with your own key.

Keys you enter are encrypted and stored only on your computer, in `launcher/.profile/`, which git ignores. This repo contains no keys.

## What a theme is

```
themes/<id>/
  theme.json   colours, fonts, shape, panel style, scene settings (format "t3theme/1")
  scene.js     the animated background
  welcome.js   the title animation
  thumb.jpg    640x400 preview
  media/       optional backdrop picture and video loop
```

The theme API is documented in `studio/theme-master-prompt.md`. A theme can be written by hand the same way the generator writes it. `skins/` holds the older picture-and-particle skins.

## Safety

Theme code is treated as untrusted. `scene.js` and `welcome.js` run in a Web Worker inside a sandboxed iframe with an opaque origin and a Content Security Policy that blocks all network access. They cannot see the T3 page, cookies, chats or keys; they only get a canvas, the size, the time, the pointer and the safe zones (where text is). A scene that hangs is stopped, and one that is too heavy runs at a lower resolution, then freezes.

Cozy Room's cat is drawn in a separate click-through layer above the app, so it never blocks a click. The only thing it can do to the app is toggle a paw icon on the Send button. The room follows the window: when T3 centres the composer on the new-thread page, the cat stays in the room instead of climbing onto it.

Every theme is checked for WCAG contrast and repaired if it falls short. If a T3 update breaks the selector map (`runtime/selectors.js`), the add-on falls back to colours only.

## Run the playground locally

```
node tools/preview-server.mjs
```

Then open http://127.0.0.1:43872/. Add `?theme=koi-pond` to open a theme, or `?view=chat` to show a conversation.

## Tests

```
node tools/test-themes.cjs          # format, sharing, hostile packs
node tools/theme-tech-checks.cjs    # validator, paths, zip
node launcher/main.test.cjs         # launcher
```
