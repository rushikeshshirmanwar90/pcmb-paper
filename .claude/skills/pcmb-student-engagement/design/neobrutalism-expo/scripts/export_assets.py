#!/usr/bin/env python3
"""
Turn generated artwork (e.g. from the canvas-design skill) into app-ready Expo assets.

STILL  : python export_assets.py still master.png --name empty-tests --dp 220x180 --out assets/illustrations
ANIM   : python export_assets.py anim frames_dir/ --name badge-unlock --dp 160x160 --fps 20 --out assets/illustrations [--gif]
CHECK  : add --palette "#1A1A1A,#FFFFFF,#FF7A6B,..." to warn when artwork drifts off the preset palette.

What it does
- trims transparent margins, fits the art into the target box (dp) with an inner safe padding
- writes name.webp / name@2x.webp / name@3x.webp (Metro picks the right scale from require('./name.webp'))
- animations: animated WebP that PLAYS ONCE by default (motion budget), optional GIF fallback
- enforces size budgets (still @3x <= 150 KB, animation <= 450 KB) and prints a registry line
- renders design/graphics/previews/name.preview.png: light canvas, dark canvas (dark variant), 64dp thumbnail
Requires Pillow (pip install pillow). Nothing here touches the network.
"""
import argparse, glob, io, os, sys
from PIL import Image, ImageDraw

STILL_BUDGET_KB = 150
ANIM_BUDGET_KB = 450

def hex_rgb(h):
    h = h.strip().lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def trim(img):
    if img.mode != 'RGBA':
        return img
    box = img.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    return img.crop(box) if box else img

def fit(img, w, h, pad):
    """Scale img to fit inside (w,h) minus pad on each side; center on a transparent canvas."""
    iw, ih = w - 2 * pad, h - 2 * pad
    s = min(iw / img.width, ih / img.height)
    res = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    canvas.paste(res, ((w - res.width) // 2, (h - res.height) // 2), res)
    return canvas

def webp_bytes(img, **kw):
    """Smallest of lossless vs high-quality lossy (flat illustrations often win lossless)."""
    best = None
    for opts in ({'lossless': True, 'method': 6}, {'quality': 90, 'method': 6, 'alpha_quality': 95}):
        b = io.BytesIO(); img.save(b, 'WEBP', **opts, **kw); data = b.getvalue()
        if best is None or len(data) < len(best): best = data
    return best

def palette_drift(img, palette, tol=40):
    """Share of opaque pixels farther than `tol` (RGB distance) from every palette color."""
    pal = [hex_rgb(c) for c in palette]
    small = img.convert('RGBA').resize((min(200, img.width), min(200, img.height)))
    data = small.get_flattened_data() if hasattr(small, 'get_flattened_data') else small.getdata()
    px = [p for p in data if p[3] > 200]
    if not px: return 0.0
    off = sum(1 for (r, g, b, a) in px if min((r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2 for R, G, B in pal) > tol * tol)
    return off / len(px)

def to_dark(img, ink='#1A1A1A', cream='#F6F1E7', tol=70):
    """Dark-mode variant for flat art. Only ink that is CONNECTED TO THE SILHOUETTE EDGE (outlines, hard shadows)
    becomes cream so the shape survives on a dark canvas; ink drawn inside shapes (text lines, check marks,
    faces) stays dark because it sits on a light fill."""
    from collections import deque
    ir, ig, ib = hex_rgb(ink); cr, cg, cb = hex_rgb(cream)
    out = img.copy(); px = out.load(); w, h = out.size
    def is_ink(x, y):
        r, g, b, a = px[x, y]
        return a > 8 and (r - ir) ** 2 + (g - ig) ** 2 + (b - ib) ** 2 <= tol * tol
    seen = bytearray(w * h); q = deque()
    for y in range(h):
        for x in range(w):
            if not is_ink(x, y): continue
            edge = x in (0, w - 1) or y in (0, h - 1) or any(px[nx, ny][3] <= 8 for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)))
            if edge: seen[y * w + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and is_ink(nx, ny):
                seen[ny * w + nx] = 1; q.append((nx, ny))
    for i, flag in enumerate(seen):
        if flag:
            x, y = i % w, i // w; a = px[x, y][3]; px[x, y] = (cr, cg, cb, a)
    return out

def preview(img, path, light='#FCF4EA', dark='#17161A', dark_img=None):
    w, h = img.size
    thumb = img.copy(); thumb.thumbnail((64 * 3, 64 * 3), Image.LANCZOS)
    sheet = Image.new('RGBA', (w * 2 + thumb.width + 80, max(h, thumb.height) + 40), hex_rgb(light) + (255,))
    d = ImageDraw.Draw(sheet)
    d.rectangle([w + 20, 0, w * 2 + 40, sheet.height], fill=hex_rgb(dark) + (255,))
    di = dark_img or img
    sheet.paste(img, (10, 20), img); sheet.paste(di, (w + 30, 20), di); sheet.paste(thumb, (w * 2 + 60, 20), thumb)
    sheet.convert('RGB').save(path)

def registry_line(name, dp, alt, animated=False, dark=False):
    key = ''.join(p.capitalize() if i else p for i, p in enumerate(name.split('-')))
    parts = [f"src: require('./{name}.webp')"]
    if dark: parts.append(f"dark: require('./{name}-dark.webp')")
    if animated: parts.append(f"end: require('./{name}-end.webp')")
    parts += [f'width: {dp[0]}', f'height: {dp[1]}', f'alt: {alt!r}']
    if animated: parts.append('animated: true')
    return f"  {key}: {{ {', '.join(parts)} }},"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['still', 'anim'])
    ap.add_argument('src')
    ap.add_argument('--name', required=True)
    ap.add_argument('--dp', required=True, help='target box in dp, e.g. 220x180')
    ap.add_argument('--out', default='assets/illustrations')
    ap.add_argument('--pad', type=float, default=0.06, help='inner safe padding, fraction of the short side')
    ap.add_argument('--fps', type=int, default=20)
    ap.add_argument('--loop', type=int, default=1, help='animated WebP loop count; 1 = play once, 0 = forever (avoid)')
    ap.add_argument('--gif', action='store_true', help='also write a GIF (bigger, 1-bit alpha; for sharing, not in-app)')
    ap.add_argument('--palette', default='', help='comma-separated preset hexes for a drift check')
    ap.add_argument('--alt', default='', help='accessibility label; empty = decorative')
    ap.add_argument('--previews', default='design/graphics/previews', help='where preview sheets go (kept out of the app bundle)')
    ap.add_argument('--dark', action='store_true', help='also write name-dark*.webp with ink recolored to cream (stills only)')
    a = ap.parse_args()

    dw, dh = (int(x) for x in a.dp.lower().split('x'))
    os.makedirs(a.out, exist_ok=True); os.makedirs(a.previews, exist_ok=True)
    report = []

    if a.mode == 'still':
        master = trim(Image.open(a.src).convert('RGBA'))
        if master.width < dw * 3 or master.height < dh * 3:
            print(f'! master {master.width}x{master.height} is smaller than @3x target {dw*3}x{dh*3}; upscaling will blur. Render the master bigger.', file=sys.stderr)
        for s in (1, 2, 3):
            w, h = dw * s, dh * s
            img = fit(master, w, h, round(min(w, h) * a.pad))
            data = webp_bytes(img)
            fn = os.path.join(a.out, f'{a.name}{"" if s == 1 else f"@{s}x"}.webp')
            open(fn, 'wb').write(data); report.append((fn, len(data)))
            if a.dark:
                dimg = to_dark(img); ddata = webp_bytes(dimg)
                dfn = os.path.join(a.out, f'{a.name}-dark{"" if s == 1 else f"@{s}x"}.webp')
                open(dfn, 'wb').write(ddata); report.append((dfn, len(ddata)))
            if s == 3:
                preview(img, os.path.join(a.previews, f'{a.name}.preview.png'), dark_img=to_dark(img) if a.dark else None); top = img
        kb3 = max(sz for fn, sz in report if '@3x' in fn) / 1024
        status = 'OK' if kb3 <= STILL_BUDGET_KB else f'OVER BUDGET ({STILL_BUDGET_KB} KB): simplify, flatten colors, or lower --dp'
    else:
        files = sorted(glob.glob(os.path.join(a.src, '*.png'))) if os.path.isdir(a.src) else []
        if not files:
            gif = Image.open(a.src); files = []
            frames_src = []
            try:
                while True: frames_src.append(gif.convert('RGBA')); gif.seek(gif.tell() + 1)
            except EOFError: pass
        else:
            frames_src = [Image.open(f).convert('RGBA') for f in files]
        if len(frames_src) < 2: sys.exit('need at least 2 frames')
        dur = round(1000 / a.fps)
        total_ms = dur * len(frames_src)
        if total_ms > 1500: print(f'! animation is {total_ms} ms; the motion budget allows ≤ 900 ms for celebrations, ≤ 1500 ms otherwise', file=sys.stderr)
        # use one shared crop box so frames don't jitter
        boxes = [f.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox() for f in frames_src]
        boxes = [b for b in boxes if b]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        frames_src = [f.crop(box) for f in frames_src]
        for s in (2, 3):
            w, h = dw * s, dh * s
            frames = [fit(f, w, h, round(min(w, h) * a.pad)) for f in frames_src]
            b = io.BytesIO()
            frames[0].save(b, 'WEBP', save_all=True, append_images=frames[1:], duration=dur, loop=a.loop, lossless=False, quality=88, method=6)
            fn = os.path.join(a.out, f'{a.name}@{s}x.webp'); open(fn, 'wb').write(b.getvalue()); report.append((fn, len(b.getvalue())))
            end = webp_bytes(frames[-1])                       # final frame as a still (reduced motion / after playing)
            efn = os.path.join(a.out, f'{a.name}-end{"" if s == 2 else "@3x"}.webp'); open(efn, 'wb').write(end); report.append((efn, len(end)))
            if s == 3:
                top = frames[-1]
                preview(frames[-1], os.path.join(a.previews, f'{a.name}.preview.png'))
                if a.gif:
                    gfn = os.path.join(a.out, f'{a.name}.gif')
                    g = [fr.convert('RGBA') for fr in frames]
                    g[0].save(gfn, save_all=True, append_images=g[1:], duration=dur, disposal=2, optimize=True)  # no loop key = play once
                    report.append((gfn, os.path.getsize(gfn)))
        # base name for require(): point it at @2x (Metro picks @3x on dense screens)
        os.replace(os.path.join(a.out, f'{a.name}@2x.webp'), os.path.join(a.out, f'{a.name}.webp'))
        report[0] = (os.path.join(a.out, f'{a.name}.webp'), report[0][1])
        kb = max(sz for fn, sz in report if fn.endswith('.webp') and '-end' not in fn) / 1024
        status = 'OK' if kb <= ANIM_BUDGET_KB else f'OVER BUDGET ({ANIM_BUDGET_KB} KB): fewer frames, lower fps, smaller --dp'

    for fn, size in report: print(f'{size/1024:7.1f} KB  {fn}')
    print('budget:', status)
    if a.palette:
        drift = palette_drift(top, a.palette.split(','))
        print(f'palette drift: {drift:.0%} of pixels off-palette' + ('  (OK)' if drift < 0.12 else '  ← regenerate with only the preset colors'))
    print('registry (add to src/assets/illustrations/index.ts):\n' + registry_line(a.name, (dw, dh), a.alt, a.mode == 'anim', a.mode == 'still' and a.dark))

if __name__ == '__main__':
    main()
