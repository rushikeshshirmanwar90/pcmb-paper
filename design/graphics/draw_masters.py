#!/usr/bin/env python3
"""
Draws the student look's illustration masters (Desk Brutalism, see philosophy.md).
Each asset is drawn in dp coordinates at 10x (2x supersampling of the 5x master),
then downsampled to the 3x master in masters/<name>.png (transparent background).

  python3 design/graphics/draw_masters.py          # all assets
  python3 design/graphics/draw_masters.py offline  # one asset

Then export with neobrutalism-expo/scripts/export_assets.py (see export.sh).
"""
import math, random, sys
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).parent / 'masters'
SS = 10  # px per dp while drawing (5x master × 2 supersampling)

INK = (18, 18, 18, 255)
WHITE = (255, 255, 255, 255)
YELLOW = (247, 199, 68, 255)
YELLOW_SOFT = (252, 237, 190, 255)
PINK = (244, 154, 217, 255)
MINT = (134, 222, 152, 255)
LAVENDER = (191, 163, 255, 255)
SKY = (143, 211, 255, 255)

LINE = 2.0      # dp outline
SHADOW = 3.0    # dp hard shadow (down-right)


class Art:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new('RGBA', (int(w * SS), int(h * SS)), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    # ── coordinate helpers ────────────────────────────────────────────────
    @staticmethod
    def p(pts):
        return [(x * SS, y * SS) for x, y in pts]

    @staticmethod
    def lw(dp=LINE):
        return max(1, round(dp * SS))

    # ── primitives: each draws its hard shadow, fill and ink outline ──────
    def poly(self, pts, fill, shadow=True, outline=True):
        if shadow:
            self.d.polygon(self.p([(x + SHADOW, y + SHADOW) for x, y in pts]), fill=INK)
        self.d.polygon(self.p(pts), fill=fill)
        if outline:
            self.stroke(pts + [pts[0]])

    def rrect(self, x0, y0, x1, y1, r, fill, shadow=True):
        if shadow:
            self.d.rounded_rectangle([(x0 + SHADOW) * SS, (y0 + SHADOW) * SS, (x1 + SHADOW) * SS, (y1 + SHADOW) * SS], r * SS, fill=INK)
        self.d.rounded_rectangle([x0 * SS, y0 * SS, x1 * SS, y1 * SS], r * SS, fill=fill, outline=INK, width=self.lw())

    def circle(self, cx, cy, r, fill, shadow=True):
        if shadow:
            self.d.ellipse([(cx - r + SHADOW) * SS, (cy - r + SHADOW) * SS, (cx + r + SHADOW) * SS, (cy + r + SHADOW) * SS], fill=INK)
        self.d.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], fill=fill, outline=INK, width=self.lw())

    def dot(self, cx, cy, r, fill=INK):
        self.d.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], fill=fill)

    def stroke(self, pts, dp=LINE, color=INK):
        w = self.lw(dp)
        self.d.line(self.p(pts), fill=color, width=w, joint='curve')
        for x, y in (pts[0], pts[-1]):  # round caps
            self.d.ellipse([x * SS - w / 2, y * SS - w / 2, x * SS + w / 2, y * SS + w / 2], fill=color)

    def ellipse_pts(self, cx, cy, rx, ry, rot=0.0, n=120):
        c, s = math.cos(rot), math.sin(rot)
        return [(cx + rx * math.cos(t) * c - ry * math.sin(t) * s, cy + rx * math.cos(t) * s + ry * math.sin(t) * c) for t in (2 * math.pi * i / n for i in range(n))]

    def sparkle(self, cx, cy, r, fill=YELLOW, shadow=True):
        k = r * 0.28
        pts = [(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k), (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)]
        self.poly(pts, fill, shadow=shadow)

    def scallop(self, cx, cy, r, points=14, depth=0.10):
        n = points * 10
        return [(cx + r * (1 - depth / 2 + depth / 2 * math.cos(a * points)) * math.cos(a), cy + r * (1 - depth / 2 + depth / 2 * math.cos(a * points)) * math.sin(a)) for a in (2 * math.pi * i / n for i in range(n))]

    def star(self, cx, cy, r, rot=-math.pi / 2, inner=0.45):
        pts = []
        for i in range(10):
            rr = r if i % 2 == 0 else r * inner
            a = rot + i * math.pi / 5
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        return pts

    def save(self, name):
        OUT.mkdir(parents=True, exist_ok=True)
        master = self.img.resize((self.w * 5, self.h * 5), Image.LANCZOS)
        master.save(OUT / f'{name}.png')
        print('master', name, master.size)


# ─── Assets ────────────────────────────────────────────────────────────────

def welcome_hero():
    a = Art(260, 200)
    # Open notebook: two pages
    a.poly([(30, 120), (128, 108), (128, 178), (30, 186)], WHITE)
    a.poly([(128, 108), (226, 120), (226, 186), (128, 178)], YELLOW_SOFT)
    for i in range(4):
        y = 128 + i * 12
        a.stroke([(44, y + 3 - i * 0.6), (110, y - 4 - i * 0.6)], dp=1.6)
    a.stroke([(128, 108), (128, 178)])
    # Bar chart card, left
    a.rrect(22, 46, 86, 98, 8, MINT)
    for i, hgt in enumerate((14, 26, 20)):
        x = 34 + i * 16
        a.rrect(x, 88 - hgt, x + 10, 88, 2, WHITE, shadow=False)
    # Flask on the notebook
    flask = [(138, 52), (156, 52), (156, 76), (178, 112), (116, 112), (138, 76)]
    a.poly(flask, WHITE)
    liquid = [(128.5, 96), (165.5, 96), (174.5, 110), (119.5, 110)]
    a.d.polygon(a.p(liquid), fill=PINK)
    a.stroke(flask + [flask[0]])
    a.stroke([(129.5, 96), (164.5, 96)], dp=1.6)
    a.dot(140, 104, 2.2, INK)
    a.dot(152, 101, 1.6, INK)
    a.rrect(134, 44, 160, 54, 3, WHITE)
    # Atom badge, right
    a.circle(204, 64, 30, LAVENDER)
    for rot in (0, math.pi / 3, -math.pi / 3):
        a.stroke(a.ellipse_pts(204, 64, 21, 8, rot) + [a.ellipse_pts(204, 64, 21, 8, rot)[0]], dp=1.6)
    a.dot(204, 64, 4.5, YELLOW)
    a.d.ellipse([(204 - 4.5) * SS, (64 - 4.5) * SS, (204 + 4.5) * SS, (64 + 4.5) * SS], outline=INK, width=a.lw(1.6))
    a.sparkle(102, 26, 10)
    a.sparkle(236, 140, 8, PINK)
    a.save('welcome-hero')


def empty_tests():
    a = Art(170, 140)
    a.rrect(46, 18, 124, 126, 10, YELLOW)          # board
    a.rrect(54, 30, 116, 118, 6, WHITE, shadow=False)  # paper
    a.rrect(68, 10, 102, 26, 5, WHITE)             # clip
    for i in range(4):
        y = 50 + i * 15
        a.dot(66, y, 2.6, INK)
        a.stroke([(74, y), (104 - (i % 2) * 10, y)], dp=1.6)
    a.poly(a.star(132, 32, 16), LAVENDER)
    a.sparkle(34, 104, 7, PINK)
    a.save('empty-tests')


def all_caught_up():
    a = Art(170, 140)
    a.poly(a.scallop(85, 70, 50, points=14, depth=0.12), MINT)
    a.stroke([(64, 72), (79, 87), (107, 56)], dp=6)
    a.sparkle(138, 30, 11)
    a.sparkle(30, 112, 8)
    a.dot(144, 108, 3.5, INK)
    a.save('all-caught-up')


def no_mistakes():
    a = Art(170, 140)
    a.circle(80, 74, 48, WHITE)
    a.d.ellipse([(80 - 34) * SS, (74 - 34) * SS, (80 + 34) * SS, (74 + 34) * SS], fill=PINK, outline=INK, width=a.lw())
    a.d.ellipse([(80 - 20) * SS, (74 - 20) * SS, (80 + 20) * SS, (74 + 20) * SS], fill=WHITE, outline=INK, width=a.lw())
    a.d.ellipse([(80 - 8) * SS, (74 - 8) * SS, (80 + 8) * SS, (74 + 8) * SS], fill=PINK, outline=INK, width=a.lw())
    # Arrow into the centre
    a.stroke([(82, 72), (140, 22)], dp=4)
    a.poly([(140, 22), (128, 22), (134, 14), (146, 10)], YELLOW, shadow=False)
    a.poly([(140, 22), (140, 34), (148, 28), (152, 16)], YELLOW, shadow=False)
    a.sparkle(30, 26, 8)
    a.save('no-mistakes')


def assessment_result():
    a = Art(150, 130)
    a.poly([(56, 8), (74, 8), (82, 56), (66, 62)], LAVENDER)
    a.poly([(94, 8), (76, 8), (68, 56), (84, 62)], LAVENDER)
    a.circle(75, 80, 38, YELLOW)
    a.d.ellipse([(75 - 27) * SS, (80 - 27) * SS, (75 + 27) * SS, (80 + 27) * SS], fill=YELLOW_SOFT, outline=INK, width=a.lw())
    a.poly(a.star(75, 81, 17), WHITE, shadow=False)
    a.sparkle(126, 40, 9, PINK)
    a.sparkle(22, 104, 7)
    a.save('assessment-result')


def offline():
    a = Art(160, 130)
    # Cloud as union: draw shadow blobs, then fills, then one outline pass via ellipses
    blobs = ((52, 62, 22), (82, 48, 28), (112, 62, 20))
    base = (40, 62, 124, 84)
    for cx, cy, r in blobs:
        a.d.ellipse([(cx - r + SHADOW) * SS, (cy - r + SHADOW) * SS, (cx + r + SHADOW) * SS, (cy + r + SHADOW) * SS], fill=INK)
    a.d.rounded_rectangle([(base[0] + SHADOW) * SS, (base[1] + SHADOW) * SS, (base[2] + SHADOW) * SS, (base[3] + SHADOW) * SS], 11 * SS, fill=INK)
    w = a.lw()
    for cx, cy, r in blobs:
        a.d.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], fill=INK)
    a.d.rounded_rectangle([base[0] * SS, base[1] * SS, base[2] * SS, base[3] * SS], 11 * SS, fill=INK)
    for cx, cy, r in blobs:
        a.d.ellipse([(cx - r) * SS + w, (cy - r) * SS + w, (cx + r) * SS - w, (cy + r) * SS - w], fill=SKY)
    a.d.rounded_rectangle([base[0] * SS + w, base[1] * SS + w, base[2] * SS - w, base[3] * SS - w], 11 * SS - w, fill=SKY)
    # Unplugged: a plug (left) and a socket (right) with a little gap of sparks between
    a.stroke([(64, 84), (64, 100)], dp=2.4)
    a.rrect(55, 100, 73, 114, 3, WHITE)
    a.stroke([(60, 114), (60, 121)], dp=2)
    a.stroke([(68, 114), (68, 121)], dp=2)
    a.stroke([(104, 84), (104, 104)], dp=2.4)
    a.rrect(94, 104, 114, 122, 3, YELLOW)
    a.dot(100, 113, 1.8)
    a.dot(108, 113, 1.8)
    for x0, y0, x1, y1 in ((80, 106, 85, 110), (79, 116, 86, 116), (80, 122, 85, 118)):
        a.stroke([(x0, y0), (x1, y1)], dp=1.8)
    a.save('offline')


def subject_physics():
    a = Art(48, 48)
    a.circle(23, 23, 19, LAVENDER)
    for rot in (0, math.pi / 3, -math.pi / 3):
        pts = a.ellipse_pts(23, 23, 14, 5.2, rot)
        a.stroke(pts + [pts[0]], dp=1.6)
    a.d.ellipse([(23 - 3.6) * SS, (23 - 3.6) * SS, (23 + 3.6) * SS, (23 + 3.6) * SS], fill=YELLOW, outline=INK, width=a.lw(1.6))
    a.save('subject-physics')


def subject_chemistry():
    a = Art(48, 48)
    flask = [(19, 6), (27, 6), (27, 17), (39, 38), (7, 38), (19, 17)]
    a.poly(flask, WHITE)
    a.d.polygon(a.p([(13.4, 28), (32.6, 28), (37.8, 36.6), (8.2, 36.6)]), fill=MINT)
    a.stroke(flask + [flask[0]])
    a.stroke([(14.6, 28), (31.4, 28)], dp=1.6)
    a.dot(20, 33, 1.6)
    a.save('subject-chemistry')


def subject_maths():
    a = Art(48, 48)
    a.poly([(7, 40), (7, 8), (39, 40)], PINK)
    a.poly([(14, 33), (14, 24), (23, 33)], WHITE, shadow=False)
    # Ruler ticks along the upright edge, clear of the outline
    for i, y in enumerate((14, 19, 24, 29, 34)):
        a.stroke([(12, y), (14 if i % 2 else 16, y)], dp=1.2)
    a.sparkle(38, 12, 4, YELLOW)
    a.save('subject-maths')


def subject_biology():
    a = Art(48, 48)
    leaf = []
    for i in range(41):
        t = i / 40
        leaf.append((8 + 32 * t, 40 - 32 * t - 11 * math.sin(math.pi * t)))
    for i in range(41):
        t = 1 - i / 40
        leaf.append((8 + 32 * t, 40 - 32 * t + 11 * math.sin(math.pi * t)))
    a.poly(leaf, MINT)
    a.stroke([(17, 31), (31, 17)], dp=1.6)
    for t in (0.3, 0.65):
        x, y = 17 + 14 * t, 31 - 14 * t
        a.stroke([(x, y), (x - 1.5, y - 3.5)], dp=1.3)
        a.stroke([(x, y), (x + 3.5, y + 1.5)], dp=1.3)
    a.save('subject-biology')


def pattern_doodles(variant='light'):
    """Faint doodles; the light variant uses ink, the dark one cream. No shadows (it's a texture)."""
    W, H = 400, 220
    a = Art(W, H)
    color = INK if variant == 'light' else (246, 241, 231, 255)
    rnd = random.Random(7)
    cells = [(x, y) for x in range(12, W - 12, 64) for y in range(14, H - 14, 52)]
    kinds = ['star', 'dot', 'squiggle', 'atom', 'flask', 'graph', 'plus', 'times', 'equals', 'root', 'divide', 'ring']
    for i, (x, y) in enumerate(cells):
        x += rnd.uniform(4, 40)
        y += rnd.uniform(4, 30)
        k = kinds[(i * 5 + rnd.randrange(3)) % len(kinds)]
        lw = 1.6
        if k == 'star':
            q = 7
            pts = [(x, y - q), (x + q * 0.28, y - q * 0.28), (x + q, y), (x + q * 0.28, y + q * 0.28), (x, y + q), (x - q * 0.28, y + q * 0.28), (x - q, y), (x - q * 0.28, y - q * 0.28)]
            a.stroke(pts + [pts[0]], dp=lw, color=color)
        elif k == 'dot':
            a.dot(x, y, 2.6, color)
        elif k == 'squiggle':
            a.stroke([(x + j * 3, y + 3 * math.sin(j * 1.2)) for j in range(9)], dp=lw, color=color)
        elif k == 'atom':
            for rot in (0, math.pi / 3, -math.pi / 3):
                pts = a.ellipse_pts(x, y, 9, 3.4, rot, n=48)
                a.stroke(pts + [pts[0]], dp=1.2, color=color)
        elif k == 'flask':
            f = [(x - 3, y - 9), (x + 3, y - 9), (x + 3, y - 3), (x + 9, y + 8), (x - 9, y + 8), (x - 3, y - 3)]
            a.stroke(f + [f[0]], dp=lw, color=color)
        elif k == 'graph':
            a.stroke([(x - 9, y - 9), (x - 9, y + 8), (x + 10, y + 8)], dp=lw, color=color)
            a.stroke([(x - 6, y + 4), (x - 1, y - 1), (x + 3, y + 2), (x + 9, y - 6)], dp=lw, color=color)
        elif k == 'plus':
            a.stroke([(x - 6, y), (x + 6, y)], dp=lw, color=color); a.stroke([(x, y - 6), (x, y + 6)], dp=lw, color=color)
        elif k == 'times':
            a.stroke([(x - 5, y - 5), (x + 5, y + 5)], dp=lw, color=color); a.stroke([(x - 5, y + 5), (x + 5, y - 5)], dp=lw, color=color)
        elif k == 'equals':
            a.stroke([(x - 6, y - 3), (x + 6, y - 3)], dp=lw, color=color); a.stroke([(x - 6, y + 3), (x + 6, y + 3)], dp=lw, color=color)
        elif k == 'root':
            a.stroke([(x - 9, y + 1), (x - 6, y), (x - 2, y + 7), (x + 2, y - 8), (x + 11, y - 8)], dp=lw, color=color)
        elif k == 'divide':
            a.stroke([(x - 6, y), (x + 6, y)], dp=lw, color=color); a.dot(x, y - 5, 1.6, color); a.dot(x, y + 5, 1.6, color)
        elif k == 'ring':
            a.d.ellipse([(x - 5) * SS, (y - 5) * SS, (x + 5) * SS, (y + 5) * SS], outline=color, width=a.lw(lw))
    # sparkles drawn as outlines in the doodle colour
    for i in range(6):
        x, y = rnd.uniform(20, W - 20), rnd.uniform(16, H - 16)
        k = 6
        pts = [(x, y - k), (x + k * 0.28, y - k * 0.28), (x + k, y), (x + k * 0.28, y + k * 0.28), (x, y + k), (x - k * 0.28, y + k * 0.28), (x - k, y), (x - k * 0.28, y - k * 0.28)]
        a.stroke(pts + [pts[0]], dp=1.4, color=color)
    # a few accent dots
    for i, c in enumerate((YELLOW, PINK, MINT, LAVENDER, YELLOW, MINT)):
        a.dot(rnd.uniform(16, W - 16), rnd.uniform(14, H - 14), 3.4, c)
    # Faint: the whole layer at low opacity (accents a little stronger than ink lines)
    alpha = a.img.getchannel('A').point(lambda v: int(v * (0.2 if variant == 'light' else 0.16)))
    a.img.putalpha(alpha)
    a.save('pattern-doodles' + ('' if variant == 'light' else '-dark'))


ASSETS = {
    'welcome-hero': welcome_hero,
    'empty-tests': empty_tests,
    'all-caught-up': all_caught_up,
    'no-mistakes': no_mistakes,
    'assessment-result': assessment_result,
    'offline': offline,
    'subject-physics': subject_physics,
    'subject-chemistry': subject_chemistry,
    'subject-maths': subject_maths,
    'subject-biology': subject_biology,
    'pattern-doodles': lambda: (pattern_doodles('light'), pattern_doodles('dark')),
}

if __name__ == '__main__':
    for name in (sys.argv[1:] or ASSETS):
        ASSETS[name]()
