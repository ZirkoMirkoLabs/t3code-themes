"""Record smooth MP4 clips of themes from the player page.

Needs Python with Playwright (pip install playwright), Google Chrome and ffmpeg on PATH.
1. From the repo folder:  python -m http.server 8791
2. In a second terminal:   python tools/record-clips.py clips 6 koi-pond,cozy-cabin --title
Options: --title shows the title animation, --size 1920x1080 sets the frame, --warm 6 waits
before recording when there is no title. Writes clips/<id>.mp4 (H.264, 30 fps, crf 17).
"""
import asyncio, base64, os, subprocess, sys

args = sys.argv[1:]
out, secs, ids = args[0], float(args[1]), args[2].split(',')
title = '--title' in args
W, H = map(int, (args[args.index('--size') + 1] if '--size' in args else '1920x1080').split('x'))
warm = float(args[args.index('--warm') + 1]) if '--warm' in args else 6.0
os.makedirs(out, exist_ok=True)

from playwright.async_api import async_playwright


async def one(browser, tid):
    page = await browser.new_page(viewport={'width': W, 'height': H})
    url = f'http://127.0.0.1:8791/?theme={tid}&wallpaper&title={"1" if title else "0"}'
    await page.goto(url)
    await page.wait_for_timeout(int((0 if title else warm) * 1000) + 800)
    cdp = await page.context.new_cdp_session(page)
    frames = []

    def on_frame(ev):
        frames.append((ev['metadata']['timestamp'], ev['data']))
        asyncio.ensure_future(cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']}))

    cdp.on('Page.screencastFrame', on_frame)
    await cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 92, 'maxWidth': W, 'maxHeight': H, 'everyNthFrame': 1})
    await page.wait_for_timeout(int(secs * 1000) + 300)
    await cdp.send('Page.stopScreencast')
    await page.close()
    fdir = os.path.join(out, '_f_' + tid)
    os.makedirs(fdir, exist_ok=True)
    lines = []
    for k, (ts, data) in enumerate(frames):
        fn = os.path.join(fdir, f'{k:05d}.jpg')
        with open(fn, 'wb') as f:
            f.write(base64.b64decode(data))
        dur = (frames[k + 1][0] - ts) if k + 1 < len(frames) else 1 / 30
        lines.append(f"file '{fn.replace(os.sep, '/')}'\nduration {max(dur, 0.001):.4f}")
    lines.append(f"file '{os.path.join(fdir, f'{len(frames) - 1:05d}.jpg').replace(os.sep, '/')}'")
    lst = os.path.join(fdir, 'list.txt')
    open(lst, 'w').write('\n'.join(lines))
    mp4 = os.path.join(out, tid + '.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-t', str(secs),
                    '-vf', f'fps=30,scale={W}:{H}:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow',
                    '-movflags', '+faststart', mp4], check=True)
    print(tid, len(frames), 'frames ->', mp4, flush=True)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel='chrome', args=['--use-angle=d3d11', '--disable-renderer-backgrounding'])
        for k in range(0, len(ids), 2):
            await asyncio.gather(*[one(browser, t) for t in ids[k:k + 2]])
        await browser.close()

asyncio.run(main())
