# Publishing guide

This folder is the clean copy for publishing. It holds the player and its themes, the app in `app/` (made by `scripts/export_app.py`), the README and the licence. Nothing in it comes from the launcher, the key store, settings or any chat.

## 1. Check before every push

Run this from this folder. It must print `clean`:

```
grep -rnIiE "sk-[a-z0-9]{10}|ghp_|AIza|bearer |api[_-]?key|secret|password|token|\b[A-Z]:[\\/][^/]|/Users/|@gmail|localhost|127\.0\.0\.1" . --exclude=PUBLISHING.md --exclude-dir=.git || echo clean
```

Also look at every `thumb.jpg`: it must show only the scene, never the app, a sidebar or chat titles.

Add themes by editing the lists in `scripts/export_app.py` and re-running it. Never copy a whole theme folder from the working project: it can hold `media/`, receipts or reports.

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

## 4. The app (`app/`)

`app/` is made by `scripts/export_app.py` in the working project, never copied by hand. It copies an allow-list only:
- launcher code, without `.profile/` (keys, settings, session) or `node_modules/`;
- the runtime and theme studio, without thread briefs;
- the playground, rewritten with sample projects;
- the 15 themes and 2 skins, allow-listed files only (no receipts, plans or source videos).

The same script refreshes the front-page player's `themes/` and `player/sandbox.js`.

It leaves out the dashboard (it reads local T3 threads), the AI image skins and backups. Re-run the export, the check in step 1 and the tests in `app/README.md` before every push.
