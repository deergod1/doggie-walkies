"""Theme builders: the slime marsh (see themes.py).

    slime   Slime marsh: green moss and pools of toxic slime under a sky that turns from day to
            night and back; drooping slime trees, goo mounds with things stuck in them, bubbling
            vents, and the craters the slime meteorites leave

Every builder is build_<prop>(m, variant) on a props.Mesh in attachment space (Blender: Z up;
the front of a landmark or a vignette faces -Y, glTF +Z).

The slime glows a little (its `_glow` faces): by day it hardly shows, at night (themes/index.js
`cycle`) it is what you see by.
"""
import math
from pathlib import Path
import sys

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from props import TAU, polar, BONE  # noqa: E402
from clutter_geo import lit, xform, blade, pebble, flatten_back, clamp_lip, clamp_ground, skull_lite, sword_lite, prism  # noqa: E402
from themes_geo import wobble  # noqa: E402

# the slime: bright and wet, a darker green under it, the glow of the fresh stuff
SLIME = ("#7ad040", "#8ae048", "#6cc23a")
SLIME_DEEP = "#3e7a2a"
SLIME_DARK = "#2e5a22"
GOO = "#b8ff5a"           # what glows
GOO_PALE = "#d8ff9a"
MOSS = ("#4a6a2e", "#567a34", "#3e5a28")
ROCK = ("#5a6052", "#4e5448", "#666c5c")
ROCK_DARK = "#3e4238"
BARK = "#3a3a2a"
BARK_DARK = "#2a2c20"
STALK = "#8a9a60"
METEOR = ("#3a3a34", "#2e302a", "#46463e")


# --- helpers -------------------------------------------------------------------
def drip(m, top, length, r, color=SLIME[0], glow=False):
    """A drop of slime running down from `top`: thin, then a bead at its end."""
    top = Vector(top)
    start = len(m.faces)
    m.tube([top, top + Vector((0, 0, -length * 0.6)), top + Vector((0, 0, -length))], [r, r * 0.55, r * 0.4], color, n=4)
    m.blob(top + Vector((0, 0, -length - r * 0.6)), (r * 1.1, r * 1.1, r * 1.4), color, n=4, jitter=0.05)
    if glow:
        lit(m, start)


def bubbles(m, center, r, count, color=GOO, size=0.03):
    """Glowing bubbles on the slime round `center` (within r)."""
    start = len(m.faces)
    for k in range(count):
        a = k * 2.4 + m.rng.random()
        d = r * (0.2 + 0.7 * ((k * 0.618) % 1))
        s = size * (0.6 + 0.6 * ((k * 0.37) % 1))
        m.lathe(Vector(center) + Vector(polar(d, a, 0)), [(0, s * 0.9), (s * 0.7, s), (s * 1.4, 0)], color, n=5, jitter=0.05)
    lit(m, start)


def goo_sheet(m, center, r, h, color, n=9, jitter=0.18):
    """A flat puddle of goo: a low, wobbly disc."""
    m.lathe(center, [(0, r * 0.96), (h * 0.6, r), (h, r * 0.7), (h * 1.1, 0)], color, n=n, jitter=jitter,
            colors=[SLIME_DEEP, color, color], phase=m.rng.random())


def crown(m, center, r, h, colors=SLIME, n=8):
    """A drooping crown of slime: a soft dome whose rim hangs down, drips under it."""
    c = Vector(center)
    m.lathe(c, [(-h * 0.55, r * 0.55), (-h * 0.35, r), (0, r * 0.98), (h * 0.45, r * 0.75), (h * 0.8, r * 0.38),
                (h, 0)], colors[0], n=n, jitter=0.1, colors=[SLIME_DEEP, colors[1], colors[0], colors[2]],
            phase=m.rng.random())


# =============================== cover ========================================
def build_slime_moss(m, v):
    for i in range(3 + v):
        p = polar(0.16 * (i > 0) + 0.02 * i, i * 2.3 + v, 0.0)
        r = 0.16 - 0.025 * i
        m.blob(p, (r, r * 0.85, 0.05 + 0.015 * (i == 0)), MOSS[i % 3], n=5)
    for k in range(3):
        a = k * 2.2 + v
        m.blob(polar(0.2, a, 0.03), (0.04, 0.035, 0.025), SLIME[k % 3], n=4)
    clamp_ground(m)


def build_goo_puddle(m, v):
    goo_sheet(m, (0, 0, 0), 0.28 - 0.03 * v, 0.03, SLIME[v], n=9)
    goo_sheet(m, (0.2 - 0.1 * v, 0.12, 0), 0.1, 0.025, SLIME[(v + 1) % 3], n=6)
    bubbles(m, (0, 0, 0.032), 0.2, 3 + v, size=0.025)


# =============================== trees ========================================
def build_slime_tree(m, v):
    """A crooked tree whose crown is a drooping blob of slime: long drips hang off it, glowing
    bulbs of goo under it."""
    h = 2.6 + 0.3 * v
    s = len(m.vertices)
    m.tube([(0, 0, 0), (0.06, -0.02, h * 0.3), (-0.05, 0.03, h * 0.6), (0.02, 0.0, h * 0.82)],
           [0.12, 0.095, 0.075, 0.06], BARK, n=6)
    wobble(m, s, 0.04, freq=3.0, phase=v)
    for i in range(3):
        a = i * TAU / 3 + 0.5 * v
        m.tube([polar(0.3, a, 0.0), polar(0.14, a + 0.2, 0.08), (0, 0, 0.28)], [0.025, 0.045, 0.07], BARK_DARK, n=4)
    # two arms up into the crown
    for k in range(2):
        a = k * math.pi + 0.7 + v
        m.tube([(0, 0, h * 0.55), polar(0.18, a, h * 0.68), polar(0.26, a + 0.2, h * 0.8)], [0.05, 0.035, 0.02], BARK, n=4)
    crown(m, (0.0, 0.0, h * 0.86), 0.44, 0.55, n=8)
    if v:   # a second, smaller lobe
        crown(m, (0.18, -0.1, h * 0.86 + 0.42), 0.2, 0.25, n=5)
    # drips off the rim, some long
    for k in range(5 - v):
        a = k * TAU / (5 - v) + 0.3 + v
        drip(m, polar(0.38, a, h * 0.86 - 0.2), 0.25 + 0.35 * ((k * 0.618 + v * 0.3) % 1), 0.03, SLIME[k % 3])
    # glowing bulbs hanging under the crown
    start = len(m.faces)
    for k in range(3):
        a = k * TAU / 3 + 1.0 + v
        p = Vector(polar(0.22, a, h * 0.86 - 0.32))
        m.tube([p + Vector((0, 0, 0.12)), p + Vector((0, 0, 0.02))], 0.01, GOO, n=3)
        m.blob(p - Vector((0, 0, 0.05)), (0.06, 0.06, 0.075), GOO, n=5)
    lit(m, start)
    # the slime that ran down the trunk
    m.blob((0.0, -0.08, 0.04), (0.22, 0.2, 0.04), SLIME[1], n=6)
    m.anchors += [(0.0, 0.0, h * 0.6)]


# =============================== ground =======================================
def build_slime_mushrooms(m, v):
    """Slimy toadstools: pale stalks, caps of slime that drip, glowing underneath."""
    cluster = [(0.0, 0.0, 0.45, 0.16), (0.17, 0.09, 0.3, 0.11), (-0.14, 0.12, 0.24, 0.09), (0.05, -0.18, 0.2, 0.08)]
    for i, (x, y, h, r) in enumerate(cluster[:3 + v]):
        top = Vector((x, y, h))
        m.tube([(x, y, 0), (x + 0.02, y, h * 0.5), top], [r * 0.25, r * 0.2, r * 0.17], STALK, n=4)
        start = len(m.faces)
        m.lathe(top - Vector((0, 0, r * 0.08)), [(0, r * 0.3), (r * 0.12, r), (r * 0.5, r * 0.75), (r * 0.75, 0)],
                SLIME[i % 3], n=7 if i == 0 else 6, jitter=0.08, colors=[GOO, SLIME[i % 3], SLIME[(i + 1) % 3]],
                phase=m.rng.random())
        for f in range(start + 1, start + 1 + (7 if i == 0 else 6)):
            m.glows[f] = True
        if i < 2:
            drip(m, top + Vector(polar(r * 0.9, 1.0 + i, -r * 0.05)), 0.08 + 0.04 * i, 0.016, SLIME[i % 3])
    m.blob((0.0, 0.02, 0.0), (0.22, 0.2, 0.04), MOSS[v], n=5)
    clamp_ground(m)


def build_goo_mound(m, v):
    """A mound of slime with something stuck in it: a skull and bones, or a sword."""
    m.lathe((0, 0, 0), [(0, 0.36), (0.12, 0.38), (0.3, 0.3), (0.45, 0.16), (0.52, 0)], SLIME[v], n=8, jitter=0.1,
            colors=[SLIME_DEEP, SLIME[v], SLIME[(v + 1) % 3], SLIME[v]], phase=m.rng.random())
    if v == 0:
        skull_lite(m, (0.08, -0.22, 0.24), scale=1.1, yaw=0.3)
        m.tube([(-0.2, -0.25, 0.12), (-0.05, -0.3, 0.3)], [0.018, 0.015], BONE, n=4)
    else:
        sword_lite(m, (0.05, -0.05, 0.42), (0.35, -0.2, 0.3), length=0.5)
    bubbles(m, (0, 0, 0.5), 0.12, 2, size=0.03)
    for k in range(3):
        a = k * 2.1 + v
        drip(m, polar(0.3, a, 0.3), 0.12, 0.022, SLIME[k % 3])
    m.blob((0, 0, 0.0), (0.42, 0.42, 0.03), SLIME_DEEP, n=7)
    clamp_ground(m)


def build_slimed_rock(m, v):
    """A boulder with slime poured over its top and running down."""
    m.lathe((0, 0, 0), [(0, 0.34), (0.2, 0.38), (0.45, 0.3), (0.62, 0.14), (0.68, 0)], ROCK[v], n=7, jitter=0.16,
            colors=list(ROCK), phase=m.rng.random())
    m.lathe((0.02, 0.0, 0.5), [(0, 0.24), (0.06, 0.26), (0.14, 0.16), (0.2, 0)], SLIME[v], n=7, jitter=0.15,
            colors=[SLIME_DEEP, SLIME[v], SLIME[(v + 1) % 3]])
    for k in range(4):
        a = k * TAU / 4 + v
        p = Vector(polar(0.24, a, 0.52))
        m.tube([p, p + Vector(polar(0.06, a, -0.18)), p + Vector(polar(0.1, a, -0.34 + 0.05 * k))], [0.04, 0.03, 0.015],
               SLIME[k % 3], n=4)
    bubbles(m, (0.02, 0, 0.7), 0.1, 2, size=0.022)


def build_bubble_vent(m, v):
    """A ring of crusted slime round a hole the goo bubbles out of."""
    m.lathe((0, 0, 0), [(0, 0.36), (0.08, 0.34), (0.16, 0.22), (0.12, 0.14), (0.04, 0.12)], SLIME_DARK, n=9,
            jitter=0.12, colors=[SLIME_DARK, SLIME_DEEP, MOSS[1], SLIME_DEEP])
    start = len(m.faces)
    m.lathe((0, 0, 0.04), [(0, 0.13), (0.03, 0.12), (0.035, 0)], GOO, n=7, jitter=0.05)
    lit(m, start)
    start = len(m.faces)
    for k in range(3 + v):
        a = k * 2.2 + v
        s = 0.04 + 0.015 * (k % 2)
        m.blob(Vector(polar(0.05 * (k > 0), a, 0.1 + 0.12 * k)), (s, s, s), GOO_PALE, n=4, jitter=0.04)
    lit(m, start)
    for k in range(3):
        pebble(m, polar(0.34, k * 2.1 + v, 0.0), 0.05, ROCK[k % 3])


def build_slime_reeds(m, v):
    """Reeds by the goo, their heads furred with slime."""
    for k in range(6 + v):
        a = k * 2.4 + v
        base = Vector(polar(0.05 + 0.15 * ((k * 0.618) % 1), a, 0))
        h = 0.55 + 0.25 * ((k * 0.37) % 1)
        tip = base + Vector(polar(0.08, a, h))
        blade(m, base, tip, 0.016, MOSS[k % 3], ref=(math.cos(a), math.sin(a), 0))
        if k % 2 == 0:
            m.tube([base.lerp(tip, 0.7), tip + Vector((0, 0, 0.06))], [0.022, 0.016], SLIME_DEEP, n=4)
    m.blob((0, 0, 0.0), (0.2, 0.18, 0.03), SLIME_DARK, n=5)
    clamp_ground(m)


# =============================== wall, lip, water =============================
def build_slime_seep(m, v):
    """Slime seeping out of a crack in the cliff and running down it."""
    for k in range(3 + v):
        x = -0.25 + 0.22 * k
        top = 0.3 - 0.08 * (k % 2)
        length = 0.4 + 0.2 * ((k * 0.618) % 1)
        start = len(m.faces)
        m.tube([(x, 0.0, top), (x + 0.02, 0.035, top - length * 0.5), (x - 0.01, 0.03, top - length)],
               [0.045, 0.035, 0.02], SLIME[k % 3], n=4)
        m.blob((x - 0.01, 0.03, top - length - 0.02), (0.035, 0.035, 0.045), GOO, n=4)
        if k % 2 == 0:
            lit(m, start)
    m.blob((0, 0.0, 0.3), (0.32, 0.06, 0.06), SLIME_DEEP, n=6)
    flatten_back(m)


def build_slime_drip(m, v):
    """Slime over the edge of a ledge, hanging down in long drips."""
    m.blob((0, -0.08, 0.0), (0.32, 0.12, 0.045), SLIME[v], n=6, jitter=0.15)
    for i in range(4 + v):
        x = -0.28 + 0.56 * i / (3 + v) + m.rng.uniform(-0.03, 0.03)
        drop = 0.25 + 0.4 * ((i * 0.618 + v * 0.2) % 1)
        pts = [(x, -0.1, 0.02), (x + 0.01, 0.04, 0.02), (x, 0.07, -0.08), (x - 0.01, 0.075, -drop)]
        m.tube(pts, [0.035, 0.035, 0.028, 0.012], SLIME[i % 3], n=4)
        start = len(m.faces)
        m.blob((x - 0.01, 0.075, -drop - 0.03), (0.026, 0.026, 0.035), GOO, n=4)
        lit(m, start)
    clamp_lip(m)


def build_goo_pads(m, v):
    """Floating rafts of thick goo on the slime, a bubble or two on them."""
    for i in range(3 + v):
        c = polar(0.2 * (i > 0) + 0.03 * i, i * 2.3 + v, 0.0)
        r = 0.13 - 0.02 * i
        outline = [(c[0] + r * (1 + 0.15 * math.sin(3 * k + i)) * math.cos(TAU * k / 9),
                    c[1] + r * (1 + 0.15 * math.sin(3 * k + i)) * math.sin(TAU * k / 9)) for k in range(9)]
        prism(m, outline, -0.02, 0.025, SLIME_DEEP, top=SLIME[i % 3])
    bubbles(m, (0, 0, 0.025), 0.2, 2 + v, size=0.028)


# =============================== landmarks ====================================
def build_meteor_crater(m, v):
    """Where a slime meteorite came down: a ring of thrown-up rock round a pool of goo, the
    meteorite itself half sunk in it and still glowing, slime splashed all round."""
    R = 1.25
    # the rim: lumps of rock thrown up, a gap in front (where you walk up to it)
    for k in range(16):
        a = -math.pi / 2 + 0.55 + (TAU - 1.1) * k / 15
        p = Vector(polar(R * (0.92 + 0.08 * ((k * 0.618) % 1)), a, 0.0))
        h = 0.32 + 0.22 * ((k * 0.37) % 1)
        s = len(m.vertices)
        m.lathe((0, 0, 0), [(0, 0.24), (h * 0.5, 0.22), (h, 0.08)], ROCK[k % 3], n=5, jitter=0.2,
                colors=[ROCK[k % 3], ROCK_DARK], phase=m.rng.random())
        xform(m, s, rot=(0.25 * math.cos(a), 0.25 * math.sin(a), m.rng.random()), offset=p)
    # the pool of goo in the middle
    goo_sheet(m, (0, 0.05, 0), R * 0.78, 0.05, SLIME[0], n=12, jitter=0.08)
    # the meteorite: a black, cracked rock, glowing goo in its cracks
    c = Vector((0.05, 0.25, 0.35))
    s = len(m.vertices)
    m.lathe((0, 0, -0.35), [(0, 0.3), (0.2, 0.5), (0.55, 0.52), (0.85, 0.32), (1.0, 0)], METEOR[0], n=8, jitter=0.18,
            colors=list(METEOR), phase=0.4)
    xform(m, s, rot=(0.3, -0.2, 0.5), offset=c)
    start = len(m.faces)
    for k in range(6):
        a = k * TAU / 6 + 0.3
        z = 0.15 + 0.12 * (k % 3)
        p = c + Vector(polar(0.5, a, z - 0.2))
        m.box(p, (0.05, 0.05, 0.28), GOO, tilt=a)
    m.blob(c + Vector((0, 0, 0.62)), (0.12, 0.12, 0.06), GOO, n=5)
    lit(m, start)
    # splashes of slime thrown about
    for k in range(7):
        a = k * TAU / 7 + 0.2
        p = polar(R * (0.45 + 0.3 * ((k * 0.618) % 1)), a, 0.0)
        m.blob(p, (0.16, 0.12, 0.04), SLIME[k % 3], n=5)
    bubbles(m, (0.0, 0.0, 0.06), R * 0.6, 7, size=0.05)
    for k in range(4):
        a = -math.pi / 2 + 0.9 + k * 0.7
        drip(m, c + Vector(polar(0.45, a, 0.25)), 0.18, 0.04, SLIME[k % 3])


def build_giant_slime_tree(m, v):
    """An old slime tree as big as a house: a twisted trunk, roots in the goo, a crown that hangs
    down all round in curtains of slime, glowing bulbs as big as lanterns."""
    h = 4.2
    s = len(m.vertices)
    m.tube([(0, 0, 0), (0.1, -0.05, h * 0.3), (-0.08, 0.06, h * 0.55), (0.04, 0.0, h * 0.78)],
           [0.36, 0.3, 0.24, 0.18], BARK, n=8)
    wobble(m, s, 0.07, freq=2.2, phase=0.5)
    for i in range(6):
        a = i * TAU / 6 + 0.25
        m.tube([polar(1.0, a, 0.0), polar(0.6, a + 0.15, 0.18), polar(0.25, a + 0.2, 0.5)], [0.05, 0.1, 0.16],
               BARK_DARK, n=5)
    for k in range(4):
        a = k * TAU / 4 + 0.6
        m.tube([(0, 0, h * 0.5), polar(0.45, a, h * 0.62), polar(0.75, a + 0.25, h * 0.74)], [0.13, 0.09, 0.05], BARK,
               n=5)
    crown(m, (0.0, 0.0, h * 0.82), 1.35, 1.3, n=12)
    crown(m, (0.45, -0.3, h * 0.82 + 1.0), 0.6, 0.6, n=8)
    crown(m, (-0.5, 0.35, h * 0.82 + 0.85), 0.55, 0.55, n=8)
    # curtains of slime from the rim (none in front, over where you walk up)
    for k in range(18):
        a = k * TAU / 18
        if abs(math.atan2(math.sin(a + math.pi / 2), math.cos(a + math.pi / 2))) < 0.45:
            continue
        length = 0.5 + 0.9 * ((k * 0.618) % 1)
        drip(m, polar(1.22, a, h * 0.82 - 0.6), length, 0.06, SLIME[k % 3])
    start = len(m.faces)
    for k in range(6):
        a = k * TAU / 6 + 0.4
        p = Vector(polar(0.8, a, h * 0.82 - 0.85))
        m.tube([p + Vector((0, 0, 0.3)), p + Vector((0, 0, 0.05))], 0.02, GOO, n=3)
        m.blob(p - Vector((0, 0, 0.08)), (0.13, 0.13, 0.16), GOO, n=6)
    lit(m, start)
    # the goo pooled round its roots
    goo_sheet(m, (0, 0, 0), 1.1, 0.04, SLIME[1], n=12, jitter=0.1)
    bubbles(m, (0, 0, 0.045), 0.9, 6, size=0.05)
