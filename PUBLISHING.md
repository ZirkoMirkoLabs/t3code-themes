# Publishing guide

This folder is the clean copy for publishing. It holds only the 10 theme folders, the README and the licence. Nothing in it comes from the launcher, the key store, settings or any chat.

## 1. Check before every push

Run this from this folder. It must print `clean`:

```
grep -rnIiE "sk-[a-z0-9]{10}|ghp_|AIza|bearer |api[_-]?key|secret|password|token|\b[A-Z]:[\\/][^/]|/Users/|@gmail|localhost|127\.0\.0\.1" . --exclude=PUBLISHING.md --exclude-dir=.git || echo clean
```

Also look at every `thumb.jpg`: it must show only the scene, never the app, a sidebar or chat titles.

Add new themes by copying only `theme.json`, `scene.js`, `welcome.js` and `thumb.jpg`. Never copy a whole theme folder from the working project: it can hold `media/`, receipts or reports.

## 2. Your own repo (done)

The repo is public at https://github.com/ZirkoMirkoLabs/t3code-themes, with the topics `t3code`, `themes`, `wallpaper` and `canvas`. GitHub Pages serves the player from `main` at https://zirkomirkolabs.github.io/t3code-themes/.

To update it: change files here, run the check in step 1, commit, then push as ZirkoMirkoLabs.

Thumbnails and clips come from the player, never from the app: `?theme=<id>&wallpaper` gives a clean scene, and `tools/record-clips.py` records video.

## 3. Offer it to T3 Code (pingdotgg/t3code)

T3 Code has no theme system yet, so an unrequested pull request that adds one is likely to be closed. Ask first:

1. Open a **Discussion** (or an **Issue** if Discussions are off) on `pingdotgg/t3code` titled "Proposal: animated themes (format t3theme/1)".
2. Keep it short: what a theme is (the 4 files), the safety model (sandboxed worker, no network), a GIF, and a link to your repo.
3. Ask whether they want (a) a theme hook in the app, (b) a community themes list or (c) neither.
4. Open a pull request only after a maintainer says yes, in the shape they ask for. Keep it small: the hook first, themes after.

If they say no, nothing is lost: the repo stays yours, and you can share it on its own.

## 4. What is not published

The runtime, launcher and Skin Studio stay private for now. They contain the encrypted key store, provider settings and local paths. Publishing them needs its own clean-up and scan; do not add them to this repo as they are.
