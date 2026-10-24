"""Theme builders: the dark forest (see themes.py).

    darkforest  Dark forest: wooded hills at night, tall firs and gnarled trees, lanterns,
                glowing mushrooms, old stones and the abandoned places of people long gone

Every builder is build_<prop>(m, variant) on a props.Mesh in attachment space (Blender: Z up;
the front of a landmark or a vignette faces -Y, glTF +Z).

Vignettes (themes.py vignette()) are small set pieces the generator scatters through the
forest's rooms (cubegen/vignettes.js): an abandoned shed, a collapsed cabin, a woodcutter's camp,
a wayside shrine, a stone circle, an overgrown wagon. Like landmarks they are bigger than a cell
and get colliders and occluders derived from their mesh.
"""
import math
from pathlib import Path
import sys

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from props import TAU, polar, IRON, BONE  # noqa: E402
from clutter_geo import (lit, xform, blade, flat_leaf, pebble, lantern_body, drape_roots, fern,  # noqa: E402
                         lily_pad, flatten_back, clamp_lip, clamp_ground)
from themes_geo import flame, wobble  # noqa: E402

# the night palette: everything a shade darker and bluer than the meadow's
FIR = ("#243e30", "#2a4636", "#1f382a")
FIR_UNDER = "#16261d"
FIR_TIP = "#33523f"
BARK_DARK = "#3a2e26"
BARK_BLACK = "#231d19"
OAK_LEAF = ("#22382a", "#2a4030", "#1c3024")
MOSS = ("#3a5a32", "#466a3a", "#2e4a2a")
MOSS_HANG = "#5a6a48"
LITTER = ("#5a4030", "#6e4a2e", "#4a3424", "#7a5634", "#5e4a36")
STEM = "#b4b8a8"
CAP_DARK = ("#3a3656", "#46385e", "#2e3a52")
GLOW_CYAN = "#7af0ff"
GLOW_TEAL = "#5affc8"
GLOW_VIOLET = "#c890ff"
GLOW_RUNE = "#8ab8ff"
LAMP = "#ffb85a"
CANDLE_LIGHT = "#ffc070"
PLANK = ("#5a4c40", "#4e4238", "#64564a", "#463a32")
PLANK_DARK = "#3e342c"
SHINGLE = ("#3a3430", "#443c36", "#322c28")
ROCK = ("#6a6e66", "#5c6058", "#767a70")
ROCK_DARK = "#4a4e48"
CANDLE = "#e8dcc0"
RAG = ("#6a2e2a", "#3e4a5a", "#7a6a4a")
CHAR = "#2a2420"


# --- helpers -------------------------------------------------------------------
def shroom(m, base, h, r, cap, under=None, glow_cap=False, n=7, lean=(0.0, 0.0), stem=STEM, dome=0.75, tiny=False):
    """A mushroom: a stem from `base` and a cap of radius r on top. under: the gills' colour
    (they glow); glow_cap: the whole cap glows (the small ones); tiny: as few triangles as can be
    (about 30, for patches of them)."""
    base = Vector(base)
    top = base + Vector((lean[0] * h, lean[1] * h, h))
    if tiny:
        m.tube([base, top], [r * 0.24, r * 0.16], stem, n=4)
        start = len(m.faces)
        m.lathe(top - Vector((0, 0, r * 0.06)), [(0, r * 0.3), (r * 0.16, r), (r * dome, 0)], cap, n=n, jitter=0.07,
                phase=m.rng.random())
        if glow_cap:
            lit(m, start)
        return top
    mid = base.lerp(top, 0.5) + Vector((lean[1] * 0.04, -lean[0] * 0.04, 0))
    m.tube([base, mid, top], [r * 0.24, r * 0.19, r * 0.16], stem, n=4)
    start = len(m.faces)
    m.lathe(top - Vector((0, 0, r * 0.06)), [(0, r * 0.25), (r * 0.14, r), (r * dome * 0.6, r * 0.72), (r * dome, 0)],
            cap, n=n, jitter=0.07, colors=[under or cap, cap, cap], phase=m.rng.random())
    if glow_cap:
        lit(m, start)
    elif under:
        # the gills: the first band after the bottom disc
        for i in range(start + 1, start + 1 + n):
            m.glows[i] = True
    return top


def spots(m, center, r, z, count, color, size=0.035):
    """Glowing flecks scattered over a cap."""
    start = len(m.faces)
    for k in range(count):
        a = k * 2.4 + m.rng.random()
        d = r * (0.25 + 0.45 * ((k * 0.618) % 1))
        m.blob(Vector((center[0], center[1], 0)) + Vector(polar(d, a, z - d * 0.35)), (size, size, size * 0.6), color,
               n=4)
    lit(m, start)


def plate(m, corners, t, color, shade=1.0):
    """A board through four top corners (going round), t thick downwards."""
    top = [m.vert(c) for c in corners]
    bot = [m.vert((c[0], c[1], c[2] - t)) for c in corners]
    m.face(top, color, shade=shade)
    m.face(list(reversed(bot)), color, shade=0.8 * shade)
    for i in range(4):
        j = (i + 1) % 4
        m.face((bot[i], bot[j], top[j], top[i]), color, shade=0.9 * shade)


def planks(m, a, b, z0, z1, colors=PLANK, t=0.045, skip=(), jag=0.0, width=0.16):
    """A wall of upright planks from a to b (XY), from z0 up to z1 (a number, or a function
    of the plank's share along the wall); skip: planks that are gone; jag: broken tops."""
    a, b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
    d = b - a
    n = max(1, round(d.length / width))
    ang = math.atan2(d.y, d.x)
    for i in range(n):
        if i in skip:
            continue
        u = (i + 0.5) / n
        c = a + d * u
        top = (z1(u) if callable(z1) else z1) - jag * m.rng.random()
        m.box((c.x, c.y, (z0 + top) / 2), (d.length / n * 0.92, t, top - z0), colors[i % len(colors)], tilt=ang)


def log(m, a, b, r, color=BARK_DARK, end="#7a6450", n=6):
    """A log lying from a to b, its cut ends lighter."""
    a, b = Vector(a), Vector(b)
    m.tube([a, a.lerp(b, 0.5) + Vector((0, 0, r * 0.05)), b], [r, r * 1.03, r * 0.95], color, n=n)
    for p, out in ((a, a - b), (b, b - a)):
        m.lathe(p, [(0, r * 0.8), (0.004, r * 0.75)], end, n=n, jitter=0.0, axis=tuple(out))


def wheel(m, center, r=0.34, color=PLANK_DARK, spokes=4):
    """An upright cart wheel in the XZ plane (its axle along Y)."""
    m.ring(center, r, 0.03, color, n=10, section=3, vertical=True, yaw=0)
    for k in range(spokes):
        s = len(m.vertices)
        m.box((0, 0, 0), (2 * r - 0.04, 0.03, 0.035), color)
        xform(m, s, rot=(0, k * math.pi / spokes, 0), offset=center)
    m.lathe(center, [(-0.05, 0.05), (0.05, 0.05)], color, n=5, axis=(0, 1, 0))


def moss_on(m, center, size, k=0):
    m.blob(center, (size, size * 0.85, size * 0.35), MOSS[k % 3], n=5)


def stone(m, center, h, r, lean=(0.0, 0.0), colors=ROCK, n=6):
    """A rough standing stone with moss at its foot."""
    s = len(m.vertices)
    m.lathe((0, 0, 0), [(0, r * 0.95), (h * 0.25, r), (h * 0.7, r * 0.8), (h * 0.92, r * 0.45), (h, 0)],
            colors[0], n=n, jitter=0.16, colors=list(colors), phase=m.rng.random())
    xform(m, s, rot=(lean[0], lean[1], m.rng.random() * TAU), offset=center)
    moss_on(m, (center[0], center[1], center[2] + 0.04), r * 1.15, int(h * 10))


def hanging_lantern(m, at, drop=0.25, s=1.0):
    """A lantern hanging on a short chain under `at`."""
    x, y, z = at
    m.tube([(x, y, z), (x, y, z - drop)], 0.008, IRON, n=3)
    lantern_body(m, (x, y, z - drop - 0.11 * s), s=s, glow=LAMP)


# =============================== cover ========================================
def build_leaf_litter(m, v):
    for i in range(10 + v):
        a = i * 2.39 + v
        d = 0.05 + 0.24 * ((i * 0.618) % 1)
        x, y, _ = polar(d, a)
        flat_leaf(m, (x, y), 0.11 + 0.03 * (i % 3), 0.035, a * 1.7, 0.004 * (i % 4), LITTER[i % len(LITTER)])
    for k in range(2):
        a = k * 2.8 + v
        m.tube([polar(0.22, a, 0.01), polar(0.02, a + 0.4, 0.02), polar(0.2, a + 1.1, 0.012)], 0.008, BARK_DARK, n=3)


def build_glowcap_patch(m, v):
    for i in range(5):
        a = i * 2.4 + v * 0.9
        d = 0.04 + 0.2 * ((i * 0.618 + v * 0.3) % 1)
        h = 0.08 + 0.05 * ((i * 3 + v) % 4) / 3
        shroom(m, polar(d, a), h, 0.035 + 0.012 * ((i + v) % 3), "#9af4ff", glow_cap=True, n=5,
               lean=(0.15 * math.cos(a), 0.15 * math.sin(a)), stem="#c8d0c4", tiny=True)
    m.lathe((0, 0, 0), [(0, 0.24), (0.012, 0.2)], MOSS[0], n=5, jitter=0.25)


def build_moss_mound(m, v):
    for i in range(3):
        p = polar(0.13 * (i > 0), i * 2.3 + v, 0.0)
        r = 0.16 - 0.03 * i
        m.blob(p, (r, r * 0.9, 0.07 + 0.02 * (i == 0)), MOSS[i], n=6)
    for k in range(3):
        a = k * 2.1 + v
        m.tube([polar(0.26, a, 0.0), polar(0.14, a + 0.3, 0.05), polar(0.04, a + 0.5, 0.06)], [0.01, 0.014, 0.006],
               BARK_DARK, n=3)
    clamp_ground(m)


# =============================== trees ========================================
def build_dark_fir_tree(m, v):
    h = 4.4 - 0.5 * v
    m.tube([(0, 0, 0), (0.02, 0.01, h * 0.5), (-0.01, 0.02, h)], [0.1, 0.07, 0.02], BARK_BLACK, n=6)
    for i in range(3):
        a = i * TAU / 3 + v
        m.tube([polar(0.28, a, 0.0), polar(0.12, a + 0.2, 0.1), (0, 0, 0.3)], [0.03, 0.05, 0.07], BARK_DARK, n=4)
    tiers = 6 - v
    for i in range(tiers):
        t = i / (tiers - 1)
        r = 0.45 * (1 - 0.7 * t)
        z = h * (0.2 + 0.66 * t)
        th = h * 0.27 * (1 - 0.3 * t)
        m.lathe((0.015 * (i % 2), -0.012 * (i % 3), z), [(0, r * 0.72), (th * 0.16, r), (th, 0)], FIR[i % 3], n=8,
                jitter=0.14, phase=i * 0.7, colors=[FIR_UNDER, FIR[i % 3]])
    m.lathe((0, 0, h * 0.86), [(0, 0.08), (h * 0.14, 0)], FIR_TIP, n=6)
    for k in range(3):
        a = k * 2.1 + v
        p = Vector(polar(0.32, a, h * 0.32))
        m.tube([p, p + Vector((0.02, 0, -0.4))], [0.025, 0.004], MOSS_HANG, n=3)


def build_gnarled_tree(m, v):
    h = 3.3 + 0.3 * v
    s = len(m.vertices)
    m.tube([(0, 0, 0), (0.07, -0.03, h * 0.25), (-0.05, 0.04, h * 0.5), (0.04, 0.02, h * 0.72)],
           [0.15, 0.12, 0.1, 0.07], BARK_DARK, n=7)
    wobble(m, s, 0.03, freq=4.0, phase=v)
    for i in range(4):
        a = i * TAU / 4 + 0.4 * v
        m.tube([polar(0.36, a, 0.0), polar(0.2, a + 0.15, 0.08), (0, 0, 0.32)], [0.03, 0.055, 0.08], BARK_DARK, n=4)
    ends = []
    for i in range(4):
        a = i * TAU / 4 + 0.6 + v
        z0 = h * (0.48 + 0.07 * i)
        mid = polar(0.16, a, z0 + 0.25)
        end = polar(0.24, a + 0.35, z0 + 0.62)
        m.tube([(0.0, 0.0, z0), mid, end], [0.055, 0.035, 0.014], BARK_BLACK, n=4)
        ends.append(end)
    for i, e in enumerate(ends + [(0.03, 0.0, h * 0.9)]):
        m.blob(Vector(e) + Vector((0, 0, 0.12)), (0.21, 0.2, 0.22), OAK_LEAF[i % 3], n=7)
    for k in range(2 + v):
        a = k * 2.6 + v
        p = Vector(polar(0.2, a, h * 0.62))
        m.tube([p, p + Vector((0.01, 0.02, -0.5))], [0.02, 0.003], MOSS_HANG, n=3)


def build_bare_tree(m, v):
    h = 2.9 + 0.35 * v
    s = len(m.vertices)
    m.tube([(0, 0, 0), (-0.04, 0.03, h * 0.35), (0.05, -0.02, h * 0.7), (0.0, 0.03, h)],
           [0.11, 0.085, 0.055, 0.012], BARK_BLACK, n=6)
    wobble(m, s, 0.035, freq=3.2, phase=v * 2)
    for i in range(3):
        a = i * TAU / 3 + v
        m.tube([polar(0.32, a, 0.0), polar(0.15, a + 0.2, 0.08), (0, 0, 0.26)], [0.025, 0.045, 0.07], BARK_BLACK, n=4)
    for i in range(6):
        a = i * 2.4 + v * 0.5
        z = h * (0.35 + 0.1 * i)
        p = Vector(polar(0.18, a, z + 0.22))
        end = Vector(polar(0.3, a + 0.3, z + 0.55 - 0.05 * i))
        m.tube([(0, 0, z), p, end], [0.04, 0.025, 0.006], BARK_BLACK, n=4)
        if i % 2 == 0:
            m.tube([p, p + Vector(polar(0.14, a - 0.7, 0.2))], [0.014, 0.004], BARK_BLACK, n=3)
    p = Vector(polar(0.24, 1.0 + v, h * 0.5))
    m.tube([p, p + Vector((0.0, 0.01, -0.45))], [0.022, 0.003], MOSS_HANG, n=3)


# =============================== mushrooms ====================================
def build_glow_mushrooms(m, v):
    cluster = [(0.0, 0.0, 0.55, 0.17), (0.18, 0.08, 0.38, 0.12), (-0.13, 0.15, 0.3, 0.1), (0.04, -0.19, 0.24, 0.085)]
    for i, (x, y, h, r) in enumerate(cluster[:3 + v]):
        a = math.atan2(y, x) if i else 0.0
        top = shroom(m, (x, y, 0), h, r, CAP_DARK[i % 3], under=GLOW_TEAL, n=7 if i == 0 else 6,
                     lean=(0.12 * math.cos(a) * (i > 0), 0.12 * math.sin(a) * (i > 0)))
        if i == 0:
            spots(m, top, r, top.z + r * 0.62, 2, "#b8fff0", size=0.03)
    moss_on(m, (0.02, 0.02, 0.0), 0.2)
    clamp_ground(m)


def build_giant_glowshroom(m, v):
    h = 1.45 + 0.2 * v
    s = len(m.vertices)
    m.tube([(0, 0, 0), (0.05, 0.0, h * 0.4), (-0.03, 0.03, h * 0.75), (0.02, 0.01, h)], [0.13, 0.1, 0.085, 0.075],
           STEM, n=7)
    wobble(m, s, 0.02, freq=2.5, phase=v)
    start = len(m.faces)
    m.lathe((0.02, 0.01, h - 0.08), [(0, 0.12), (0.06, 0.44), (0.22, 0.38), (0.4, 0.2), (0.48, 0)], CAP_DARK[v],
            n=10, jitter=0.06, colors=[GLOW_VIOLET, CAP_DARK[v], CAP_DARK[(v + 1) % 3], CAP_DARK[v]])
    for i in range(start + 1, start + 11):
        m.glows[i] = True
    spots(m, (0.02, 0.01, h - 0.08), 0.4, h + 0.3, 3, "#e8d0ff", size=0.045)
    for k in range(2):
        a = k * 2.3 + 0.5 + v
        shroom(m, polar(0.3, a, 0.0), 0.16 + 0.06 * k, 0.06, CAP_DARK[k % 3], under=GLOW_VIOLET, n=6)
    for k in range(3):
        a = k * TAU / 3 + 0.3
        m.tube([polar(0.3, a, 0.0), polar(0.12, a + 0.2, 0.06), (0, 0, 0.2)], [0.02, 0.04, 0.06], "#9aa090", n=3)


def build_mossy_stump(m, v):
    h = 0.42 + 0.1 * v
    m.lathe((0, 0, 0), [(0, 0.3), (0.08, 0.24), (h * 0.8, 0.22), (h, 0.21)], BARK_DARK, n=8, jitter=0.1,
            colors=[BARK_DARK, BARK_BLACK, BARK_DARK])
    m.lathe((0, 0, h), [(0, 0.2), (0.012, 0.16), (0.02, 0)], "#6a5444", n=8, jitter=0.05)
    m.blob((0.05, -0.02, h + 0.02), (0.17, 0.14, 0.05), MOSS[1], n=5)
    for i in range(4):
        a = i * TAU / 4 + v
        m.tube([polar(0.4, a, 0.0), polar(0.24, a + 0.2, 0.07), (0, 0, 0.18)], [0.025, 0.045, 0.06], BARK_DARK, n=4)
    # glowing shelf fungus on the bark
    for k in range(3):
        a = 0.8 + k * 0.7 + v
        z = 0.12 + 0.11 * k
        c = Vector(polar(0.2, a, z))
        start = len(m.faces)
        m.lathe(c, [(0, 0.02), (0.012, 0.09 - 0.015 * k), (0.03, 0.06), (0.04, 0)], "#6a7a62", n=6, jitter=0.1,
                colors=[GLOW_TEAL, "#7a8a70", "#6a7a62"])
        for i in range(start + 1, start + 7):
            m.glows[i] = True


# =============================== lights and stones ============================
def build_lantern_post(m, v):
    h = 1.5 + 0.15 * v
    s = len(m.vertices)
    m.tube([(0, 0, 0), (0.03, 0.01, h * 0.5), (-0.02, 0.0, h)], [0.05, 0.042, 0.034], PLANK_DARK, n=5)
    wobble(m, s, 0.015, freq=3.0, phase=v)
    m.tube([(-0.02, 0, h - 0.1), (0.15, 0, h - 0.02), (0.27, 0, h - 0.07)], 0.02, PLANK_DARK, n=4)
    hanging_lantern(m, (0.27, 0, h - 0.07), drop=0.1, s=1.25)
    for k in range(3):
        pebble(m, polar(0.12, k * 2.1 + v, 0.0), 0.07, ROCK[k % 3])
    blade(m, (-0.035, 0.0, h - 0.18), (-0.06, -0.02, h - 0.48), 0.035, RAG[v], ref=(0, 1, 0))


def build_standing_stone(m, v):
    h = 1.35 + 0.2 * v
    s = len(m.vertices)
    m.lathe((0, 0, 0), [(0, 0.24), (h * 0.3, 0.26), (h * 0.7, 0.2), (h * 0.92, 0.11), (h, 0)], ROCK[v], n=6,
            jitter=0.12, colors=[ROCK[v], ROCK[(v + 1) % 3], ROCK[(v + 2) % 3], ROCK_DARK], phase=0.3)
    start = len(m.faces)
    for k, (x, z, w, hh) in enumerate(((-0.05, 0.45, 0.025, 0.2), (0.05, 0.5, 0.025, 0.12), (0.0, 0.62, 0.11, 0.022),
                                       (-0.03, 0.8, 0.07, 0.022), (0.04, 0.88, 0.022, 0.12))):
        m.box((x, -0.2, z * h / 1.35), (w, 0.07, hh), GLOW_RUNE)
    lit(m, start)
    xform(m, s, rot=(0.06 - 0.12 * v, 0.05, 0), pivot=(0, 0, 0))
    m.blob((0.0, 0.05, 0.03), (0.3, 0.27, 0.08), MOSS[v], n=6)
    m.blob((0.1, 0.0, h * 0.75), (0.1, 0.13, 0.05), MOSS[2], n=4)


def build_rotten_log(m, v):
    L = 0.8 + 0.08 * v
    a, b = Vector((-L / 2, -0.04, 0.13)), Vector((L / 2, 0.05, 0.11))
    m.tube([a, a.lerp(b, 0.5) + Vector((0, 0.02, 0.01)), b], [0.13, 0.14, 0.12], BARK_DARK, n=7)
    for p in (a, b):
        m.lathe(p, [(0, 0.1), (0.004, 0.06)], "#4a3a2e", n=7, jitter=0.15, axis=tuple(b - a))
    m.blob((0.05, 0.0, 0.24), (0.28, 0.1, 0.04), MOSS[0], n=6)
    m.tube([(0.15, 0.06, 0.12), (0.32, 0.22, 0.18)], [0.04, 0.01], BARK_DARK, n=4)
    for k in range(3):
        x = -0.25 + 0.18 * k + 0.08 * v
        shroom(m, (x, -0.06 + 0.04 * (k % 2), 0.22), 0.06 + 0.02 * (k % 2), 0.03, "#9af4ff", glow_cap=True, n=5,
               stem="#c8d0c4", tiny=True)
    fern(m, v, ("#2a3a24", "#34482c", "#2e4228"), fronds=2, size=0.3)


def build_twig_charm(m, v):
    h = 1.3 + 0.1 * v
    m.tube([(0, 0, 0), (0.02, 0.0, h * 0.6), (-0.01, 0.01, h)], [0.03, 0.026, 0.02], BARK_BLACK, n=4)
    m.tube([(-0.25, 0, h - 0.12), (0, 0, h - 0.08), (0.25, 0, h - 0.13)], 0.014, BARK_BLACK, n=3)
    for k, x in enumerate((-0.2, 0.0, 0.2)[:2 + v]):
        top = h - 0.12 - 0.02 * (k % 2)
        m.tube([(x, 0, top), (x, 0, top - 0.12)], 0.003, "#8a7a5a", n=3)
        z = top - 0.12
        # a little figure of twigs: a body, arms, legs and a knot for a head
        m.tube([(x, 0, z), (x, 0, z - 0.2)], 0.008, "#6a5440", n=3)
        m.tube([(x - 0.07, 0, z - 0.05), (x + 0.07, 0, z - 0.07)], 0.006, "#6a5440", n=3)
        for s in (-1, 1):
            m.tube([(x, 0, z - 0.2), (x + s * 0.05, 0, z - 0.3)], 0.006, "#6a5440", n=3)
        m.blob((x, 0, z + 0.025), (0.03, 0.03, 0.03), BONE, n=4)
    blade(m, (0.0, 0.0, h - 0.06), (0.03, -0.02, h - 0.4), 0.03, RAG[(v + 1) % 3], ref=(0, 1, 0))
    for k in range(2):
        pebble(m, polar(0.09, k * 3 + v, 0.0), 0.05, ROCK[k])


def build_dark_fern(m, v):
    fern(m, v, ("#22301e", "#2c4026", "#263a22"), fronds=6 + v, size=0.5)


def build_bramble(m, v):
    for k in range(4 + v):
        a = k * 1.7 + v
        p0 = Vector(polar(0.05, a, 0.0))
        p1 = Vector(polar(0.22, a + 0.4, 0.28 + 0.06 * (k % 2)))
        p2 = Vector(polar(0.36, a + 0.9, 0.12))
        m.tube([p0, p1, p2], [0.016, 0.012, 0.005], "#3a2a26", n=3)
        for t in (0.3, 0.6):
            q = p0.lerp(p1, t) if t < 0.5 else p1.lerp(p2, t)
            blade(m, q, q + Vector(polar(0.05, a + 1.6 * t, 0.02)), 0.006, "#5a4a3a")
        if k % 2 == 0:
            m.blob(p1 + Vector((0, 0, 0.03)), (0.025, 0.025, 0.025), "#4a1a2a", n=4)
        m.leaf(p1, p1 + Vector(polar(0.09, a - 0.5, 0.03)), 0.03, "#2a3a26")


# =============================== wall, lip, ceiling, water ====================
def build_shelf_fungus(m, v):
    for k, (x, z, r) in enumerate(((-0.14, 0.0, 0.24), (0.12, 0.2 + 0.04 * v, 0.18), (-0.02, -0.22, 0.14))):
        outline = [(x + r * math.cos(math.pi * i / 8), r * math.sin(math.pi * i / 8)) for i in range(9)]
        lo = [m.vert((px, py, z)) for px, py in outline]
        hi = [m.vert((px, py * 0.94, z + 0.06 + 0.02 * (i % 2))) for i, (px, py) in enumerate(outline)]
        center_lo = m.vert((x, r * 0.28, z - 0.015))
        center_hi = m.vert((x, r * 0.28, z + 0.12))
        for i in range(8):
            j = i + 1
            m.face((lo[j], lo[i], center_lo), GLOW_TEAL, glow=True)
            m.face((hi[i], hi[j], center_hi), ("#5a6a52", "#4e5e4a", "#66765c")[k])
            m.face((lo[i], lo[j], hi[j], hi[i]), "#8a9a78", glow=True)
        m.face((lo[0], hi[0], center_hi, center_lo), "#4e5e4a")
        m.face((lo[8], center_lo, center_hi, hi[8]), "#4e5e4a")
    flatten_back(m)


def build_root_drape(m, v):
    drape_roots(m, v, BARK_DARK, "#2a2018", count=5)
    for k in range(2 + v):
        x = -0.25 + 0.25 * k
        m.tube([(x, 0.0, 0.02), (x + 0.02, 0.07, -0.1), (x - 0.01, 0.08, -0.45 - 0.1 * k)], [0.02, 0.014, 0.003],
               MOSS_HANG, n=3)
    m.blob((0.0, -0.1, 0.02), (0.3, 0.1, 0.04), MOSS[v], n=5)
    clamp_lip(m)


def build_hanging_lantern(m, v):
    m.ring((0, 0, -0.03), 0.04, 0.008, IRON, n=6, section=3)
    m.tube([(0, 0, -0.06), (0.0, 0.0, -0.3 - 0.1 * v)], 0.007, IRON, n=3)
    lantern_body(m, (0, 0, -0.42 - 0.1 * v), s=1.35, glow=LAMP)
    m.tube([(0, 0, -0.06), (0.12, 0.0, -0.02)], 0.01, BARK_DARK, n=3)


def build_black_lilies(m, v):
    for i in range(3 + v):
        lily_pad(m, polar(0.2 * (i > 0) + 0.03 * i, i * 2.3 + v, 0.0), 0.14 - 0.02 * i,
                 ("#1e2e26", "#24362c", "#1a2822", "#2a3a2e")[i], notch=m.rng.random() * TAU, rim="#141e1a")
    start = len(m.faces)
    for k in range(2):
        c = Vector(polar(0.12, k * 3 + v, 0.012))
        m.lathe(c, [(0, 0.03), (0.04, 0.035), (0.08, 0)], "#c8fff0", n=5)
    lit(m, start)


# =============================== vignettes ====================================
def build_abandoned_shed(m, v):
    """A small plank shed, its roof sagging, its door hanging open; a lantern still burns by it."""
    w, d = 0.8, 0.6   # half width (x), half depth (y)
    front, back = 1.3, 1.05
    height = lambda y: front + (back - front) * (y + d) / (2 * d)   # noqa: E731
    planks(m, (-w, d), (w, d), 0.0, back, jag=0.06, skip=(3,) if v else ())
    planks(m, (-w, -d), (-w, d), 0.0, lambda u: height(-d + 2 * d * u), jag=0.04)
    planks(m, (w, -d), (w, d), 0.0, lambda u: height(-d + 2 * d * u), jag=0.08, skip=(2 + v,))
    # the front: planks left and right of the doorway
    planks(m, (-w, -d), (-0.2, -d), 0.0, front, jag=0.04)
    planks(m, (0.35, -d), (w, -d), 0.0, front, jag=0.05)
    m.box((0.075, -d, front - 0.06), (0.6, 0.06, 0.1), PLANK_DARK)
    # the door, hanging open on one hinge
    m.box((0.35 + 0.26 * math.cos(-1.1 - 0.3 * v), -d + 0.26 * math.sin(-1.1 - 0.3 * v), 0.52),
          (0.5, 0.04, 1.0), PLANK[2], tilt=-1.1 - 0.3 * v)
    for x, y in ((-w, -d), (w, -d), (-w, d), (w, d)):
        m.box((x, y, height(y) / 2), (0.09, 0.09, height(y)), PLANK_DARK)
    # the roof: two sagging halves of shingles, a hole between them
    for k, (x0, x1, sag) in enumerate(((-w - 0.15, -0.05, 0.05), (0.1 + 0.1 * v, w + 0.15, 0.1))):
        corners = [(x0, -d - 0.2, front + 0.08), (x1, -d - 0.2, front + 0.08 - sag),
                   (x1, d + 0.15, back + 0.06 - sag * 0.5), (x0, d + 0.15, back + 0.06)]
        plate(m, corners, 0.06, SHINGLE[k])
        for r in range(3):
            t = (r + 0.5) / 3
            z = front + 0.1 + (back - front) * t - sag * (0.5 if k else 0.3)
            m.box(((x0 + x1) / 2, -d - 0.2 + (2 * d + 0.35) * t, z), (x1 - x0, 0.1, 0.03), SHINGLE[(r + k) % 3])
    m.blob((-0.5, 0.1, back + 0.2), (0.25, 0.3, 0.06), MOSS[0], n=6)
    m.blob((0.55, -0.3, front), (0.2, 0.18, 0.05), MOSS[1], n=5)
    # a dark window on the left, a warm light behind its broken shutter
    start = len(m.faces)
    m.box((-w - 0.01, -0.05, 0.8), (0.04, 0.26, 0.22), LAMP)
    lit(m, start)
    m.box((-w - 0.04, -0.17, 0.8), (0.03, 0.12, 0.3), PLANK[3], tilt=0.4)
    # the lantern on a nail by the door, a barrel and a bucket
    hanging_lantern(m, (-0.32, -d - 0.04, 1.08), drop=0.06, s=1.1)
    m.lathe((w + 0.3, 0.25, 0), [(0, 0.17), (0.35, 0.2), (0.7, 0.16)], PLANK[1], n=8, jitter=0.03,
            colors=[PLANK[1], PLANK[0]])
    for z in (0.12, 0.58):
        m.ring((w + 0.3, 0.25, z), 0.19, 0.012, IRON, n=8, section=3)
    m.lathe((w + 0.25, -0.35, 0), [(0, 0.08), (0.18, 0.1)], PLANK[2], n=6)
    # vines up the corners
    for x, y in ((-w, -d), (w, d)):
        m.tube([(x - 0.05, y - 0.05, 0), (x - 0.04, y - 0.06, 0.6), (x + 0.02, y - 0.05, 1.1)], [0.02, 0.014, 0.004],
               "#2e4226", n=3)


def build_collapsed_cabin(m, v):
    """A log cabin fallen in on itself; its chimney still stands, mushrooms glow in the rubble."""
    w, d = 0.95, 0.75
    for k in range(5):
        z = 0.1 + 0.19 * k
        log(m, (-w - 0.1, d, z), (w + 0.1, d, z), 0.1)
    for k in range(4 - v):
        z = 0.1 + 0.19 * k
        log(m, (-w, -d - 0.1, z), (-w, d + 0.1, z), 0.095)
    for k in range(2):
        z = 0.1 + 0.19 * k
        log(m, (-w - 0.1, -d, z), (-0.3, -d, z), 0.095)
        log(m, (0.3, -d, z), (w + 0.1, -d, z), 0.095)
    log(m, (w, -d - 0.05, 0.1), (w, d + 0.05, 0.1), 0.095)
    # the right wall's logs, fallen out on the ground
    for k in range(3):
        y = -0.5 + 0.35 * k
        log(m, (w + 0.2, y, 0.09), (w + 0.6 - 0.1 * k, y + 0.6, 0.09), 0.085)
    # the roof: one half fallen in, leaning on the back wall; a beam across
    plate(m, [(-w - 0.15, d + 0.15, 1.15), (w + 0.1, d + 0.15, 1.05), (w - 0.1, -0.3, 0.12), (-w + 0.05, -0.2, 0.25)],
          0.07, SHINGLE[0])
    m.tube([(-w - 0.1, -0.1, 0.4), (0.2, -0.2, 0.9), (w + 0.2, -0.25, 0.75)], 0.06, BARK_DARK, n=5)
    # the chimney at the back corner
    for k in range(9):
        m.box((-w + 0.25, d + 0.15, 0.12 + 0.22 * k), (0.42 - 0.02 * (k > 6), 0.36, 0.22), ROCK[k % 3], jitter=0.02)
    m.box((-w + 0.25, d + 0.15, 2.05), (0.3, 0.26, 0.1), ROCK_DARK)
    # what grows in there now
    for k, (x, y) in enumerate(((0.2, 0.1), (-0.3, 0.25), (0.55, 0.4), (0.0, -0.45))):
        shroom(m, (x, y, 0.0), 0.22 + 0.08 * (k % 2), 0.09, CAP_DARK[k % 3], under=GLOW_TEAL, n=6)
    for k in range(4):
        shroom(m, (-0.4 + 0.25 * k, d - 0.12, 0.98), 0.06, 0.03, "#9af4ff", glow_cap=True, n=5, stem="#c8d0c4")
    fern(m, v, ("#22301e", "#2c4026", "#263a22"), fronds=4, size=0.35)
    m.blob((0.3, 0.3, 0.6), (0.3, 0.25, 0.05), MOSS[1], n=5)


def build_woodcutter_camp(m, v):
    """A woodcutter's camp, long cold: a lean-to over the woodpile, the block with the axe still in
    it, a sawhorse and a ring of stones; a lantern on a stake."""
    # the lean-to
    for x in (-0.95, 0.15):
        m.tube([(x, 0.45, 0), (x + 0.02, 0.45, 1.25)], 0.05, PLANK_DARK, n=5)
        m.tube([(x, -0.2, 0), (x, -0.2, 0.75)], 0.045, PLANK_DARK, n=5)
    plate(m, [(-1.1, -0.35, 0.8), (0.3, -0.35, 0.8), (0.3, 0.6, 1.32), (-1.1, 0.6, 1.32)], 0.05, SHINGLE[1])
    m.blob((-0.4, 0.1, 1.12), (0.4, 0.28, 0.05), MOSS[0], n=6)
    # the woodpile under it
    for row in range(3):
        for k in range(5 - row):
            x = -0.85 + 0.2 * k + 0.1 * row
            m.tube([(x, -0.1, 0.07 + 0.13 * row), (x, 0.4, 0.07 + 0.13 * row)], 0.065, BARK_DARK, n=5)
            m.lathe((x, -0.11, 0.07 + 0.13 * row), [(0, 0.055), (0.004, 0.03)], "#7a6450", n=5, axis=(0, -1, 0))
    # the chopping block and the axe
    m.lathe((0.75, -0.3, 0), [(0, 0.2), (0.32, 0.18), (0.34, 0.16)], BARK_DARK, n=8, jitter=0.06,
            colors=[BARK_DARK, "#7a6450"])
    m.tube([(0.7, -0.3, 0.34), (0.55, -0.32, 0.78)], 0.018, "#6a5036", n=4)
    m.box((0.72, -0.3, 0.37), (0.16, 0.03, 0.1), "#6a6e74", tilt=0.1)
    # the sawhorse with a log on it
    for x in (0.55, 1.05):
        for s in (-1, 1):
            m.tube([(x, 0.35 + 0.18 * s, 0), (x, 0.35 - 0.05 * s, 0.5)], 0.025, PLANK_DARK, n=4)
    log(m, (0.4, 0.33, 0.5), (1.2, 0.36, 0.52), 0.09)
    # the fire ring, long cold
    for k in range(8):
        pebble(m, polar(0.28, k * TAU / 8, 0.0), 0.07, ROCK[k % 3])
    for k in range(3):
        a = k * 2.1 + v
        m.tube([polar(0.2, a, 0.04), polar(0.18, a + math.pi, 0.08)], 0.035, CHAR, n=4)
    # the lantern on its stake
    m.tube([(-0.55, -0.6, 0), (-0.55, -0.6, 0.85)], 0.025, PLANK_DARK, n=4)
    m.tube([(-0.55, -0.6, 0.85), (-0.4, -0.6, 0.88)], 0.015, IRON, n=3)
    hanging_lantern(m, (-0.4, -0.6, 0.88), drop=0.06, s=1.1)


def build_wayside_shrine(m, v):
    """A little roofed shrine on a post, candles burning in it and at its foot."""
    m.box((0, 0, 0.12), (0.6, 0.6, 0.24), ROCK[0], jitter=0.02)
    m.box((0, 0, 0.27), (0.5, 0.5, 0.06), ROCK[2])
    m.tube([(0, 0.05, 0.3), (0, 0.05, 0.95)], 0.06, PLANK_DARK, n=5)
    # the niche: back, sides, floor and a pitched roof
    m.box((0, 0.17, 1.2), (0.46, 0.05, 0.5), PLANK[0])
    for s in (-1, 1):
        m.box((s * 0.21, 0.02, 1.2), (0.04, 0.3, 0.5), PLANK[1])
    m.box((0, 0.02, 0.96), (0.5, 0.36, 0.05), PLANK[3])
    for s in (-1, 1):
        plate(m, [(0, -0.2, 1.62), (0, 0.27, 1.62), (s * 0.34, 0.27, 1.38), (s * 0.34, -0.2, 1.38)], 0.04, SHINGLE[0])
    # inside: a small figure of wood and candles
    m.lathe((0, 0.08, 0.99), [(0, 0.05), (0.18, 0.04), (0.24, 0.035), (0.3, 0)], "#7a6a52", n=5)
    for k, x in enumerate((-0.12, 0.12)):
        m.lathe((x, -0.04, 0.99), [(0, 0.022), (0.08 + 0.03 * k, 0.02)], CANDLE, n=5)
        flame(m, (x, -0.04, 1.07 + 0.03 * k), 0.06, CANDLE_LIGHT, r=0.014)
    # candles and offerings at its foot
    for k in range(4 + v):
        a = -1.2 + 0.6 * k
        x, y, _ = polar(0.38, a - math.pi / 2)
        h = 0.08 + 0.04 * (k % 2)
        m.lathe((x, y, 0), [(0, 0.03), (h, 0.026)], CANDLE, n=5)
        flame(m, (x, y, h), 0.05, CANDLE_LIGHT, r=0.012)
    m.lathe((0.32, 0.25, 0), [(0, 0.06), (0.05, 0.09), (0.07, 0.085)], "#8a6a4a", n=6)
    blade(m, (0.21, -0.17, 1.4), (0.24, -0.2, 1.05), 0.03, RAG[0], ref=(1, 0, 0))
    blade(m, (-0.21, -0.17, 1.4), (-0.25, -0.2, 1.1), 0.03, RAG[1], ref=(1, 0, 0))


def build_stone_circle(m, v):
    """Old stones in a ring round a flat stone with glowing runes."""
    count = 6
    for k in range(count):
        a = k * TAU / count + 0.3 * v + 0.2
        h = 0.95 + 0.35 * ((k * 0.618 + v * 0.3) % 1)
        if (k + v) % 5 == 4:
            # one fallen
            s = len(m.vertices)
            stone(m, (0, 0, 0), 0.9, 0.18)
            xform(m, s, rot=(0, 1.45, a + math.pi / 2), offset=polar(1.15, a, 0.16))
            continue
        stone(m, polar(1.15, a, 0.0), h, 0.2, lean=(0.08 * math.sin(a * 3), 0.08 * math.cos(a * 2)))
    m.box((0, 0, 0.06), (0.62, 0.5, 0.12), ROCK[1], jitter=0.02)
    start = len(m.faces)
    m.ring((0, 0, 0.13), 0.18, 0.018, GLOW_RUNE, n=10, section=3)
    for k in range(4):
        a = k * TAU / 4 + 0.4
        m.box(polar(0.2, a, 0.13), (0.05, 0.015, 0.012), GLOW_RUNE, tilt=a)
    lit(m, start)
    for k in range(5):
        a = k * 1.3 + v
        shroom(m, polar(0.65, a, 0.0), 0.07, 0.03, "#9af4ff", n=5, stem="#c8d0c4", tiny=True)


def build_overgrown_wagon(m, v):
    """A broken wagon, one wheel off, its load spilled; a lantern still hangs from its pole."""
    s = len(m.vertices)
    # the bed and its sides
    m.box((0, 0, 0.55), (1.5, 0.8, 0.06), PLANK[0])
    for y in (-0.4, 0.4):
        m.box((0, y, 0.7), (1.5, 0.04, 0.26), PLANK[1])
    m.box((0.75, 0, 0.7), (0.04, 0.8, 0.26), PLANK[2])
    # the wheels that held, on the far side
    for x in (-0.45, 0.5):
        wheel(m, (x, 0.46, 0.38))
    # tipped down on the near side, where its wheels came off
    xform(m, s, rot=(0.16, 0.0, 0.0), pivot=(0, 0.46, 0.04))
    # a lost wheel, lying in the grass
    s = len(m.vertices)
    wheel(m, (0, 0, 0), spokes=3)
    xform(m, s, rot=(1.45, 0, 0.4), offset=(0.15, -0.8, 0.06))
    # the shafts on the ground, the load spilled
    for y in (-0.25, 0.25):
        m.tube([(-0.75, y, 0.45), (-1.35, y * 1.2, 0.03)], 0.03, PLANK_DARK, n=4)
    for k, (x, y, z, r) in enumerate(((0.2, -0.05, 0.75, 0.0), (0.95, -0.35, 0.13, 0.4), (1.05, 0.15, 0.12, 0.9))):
        m.box((x, y, z), (0.28, 0.24, 0.24), PLANK[(k + 1) % 4], tilt=r)
    m.lathe((-0.3, -0.05, 0.58), [(0, 0.12), (0.18, 0.15), (0.32, 0.12)], "#8a7a5a", n=6, jitter=0.1)
    # a pole with the lantern
    m.tube([(0.7, 0.3, 0.5), (0.72, 0.3, 1.6)], 0.025, PLANK_DARK, n=4)
    m.tube([(0.72, 0.3, 1.6), (0.92, 0.3, 1.62)], 0.015, IRON, n=3)
    hanging_lantern(m, (0.92, 0.3, 1.62), drop=0.12, s=1.15)
    # the forest taking it back
    m.blob((0.0, 0.1, 0.62), (0.45, 0.3, 0.05), MOSS[0], n=6)
    fern(m, v, ("#22301e", "#2c4026", "#263a22"), fronds=5, size=0.45)
    for k in range(3):
        m.tube([(-0.6 + 0.4 * k, 0.43, 0.0), (-0.55 + 0.4 * k, 0.45, 0.5), (-0.4 + 0.4 * k, 0.4, 0.8)],
               [0.016, 0.01, 0.003], "#2e4226", n=3)
    clamp_ground(m)


# =============================== landmarks ====================================
def build_lantern_tree(m, v):
    """An ancient tree hung with lanterns: whoever lit them, they still burn."""
    h = 4.6
    s = len(m.vertices)
    m.tube([(0, 0, 0), (0.08, -0.05, 0.9), (-0.06, 0.05, 1.9), (0.04, 0.0, 2.8), (0.0, 0.02, 3.6)],
           [0.42, 0.34, 0.3, 0.24, 0.12], BARK_DARK, n=9)
    wobble(m, s, 0.05, freq=2.2, phase=0.4)
    for k in range(6):
        a = k * TAU / 6 + 0.3
        m.tube([polar(1.15, a, 0.0), polar(0.75, a + 0.15, 0.12), polar(0.4, a + 0.05, 0.4), (0, 0, 0.9)],
               [0.05, 0.09, 0.15, 0.2], BARK_DARK, n=5)
    ends = []
    for k in range(6):
        a = k * TAU / 6 + 0.9
        z0 = 2.0 + 0.3 * (k % 3)
        mid = polar(0.65, a + 0.1, z0 + 0.35)
        end = polar(1.08, a + 0.3, z0 + 0.45 + 0.2 * (k % 2))
        m.tube([(0, 0, z0), mid, end], [0.13, 0.08, 0.03], BARK_DARK, n=5)
        ends.append((Vector(mid), Vector(end)))
    for k, (mid, end) in enumerate(ends):
        m.blob(end + Vector((0, 0, 0.35)), (0.5, 0.48, 0.4), OAK_LEAF[k % 3], n=8)
        m.blob(mid + Vector((0, 0, 0.6)), (0.45, 0.45, 0.35), OAK_LEAF[(k + 1) % 3], n=7)
    m.blob((0, 0, h - 0.4), (0.7, 0.7, 0.5), OAK_LEAF[0], n=9)
    for k, (mid, end) in enumerate(ends):
        p = mid.lerp(end, 0.7)
        hanging_lantern(m, (p.x, p.y, p.z - 0.03), drop=0.25 + 0.15 * (k % 3), s=1.3)
        if k % 2:
            m.tube([mid, mid + Vector((0.02, 0, -0.7))], [0.03, 0.004], MOSS_HANG, n=3)
    for k in range(5):
        a = k * 1.3 + 0.5
        shroom(m, polar(0.55, a, 0.0), 0.12 + 0.05 * (k % 2), 0.05, "#9af4ff", glow_cap=True, n=5, stem="#c8d0c4")


def build_mossy_arch(m, v):
    """Two pillars of mossy stones and a rough arch between them; roots and glowing mushrooms."""
    for sx in (-1, 1):
        for k in range(6):
            r = 0.3 - 0.015 * k
            m.box((sx * 1.05 + 0.03 * math.sin(k * 2.1), 0.02 * math.cos(k * 1.7), 0.2 + 0.36 * k),
                  (2 * r + 0.08, 2 * r, 0.38), ROCK[(k + (sx > 0)) % 3], tilt=0.2 * math.sin(k + sx), jitter=0.03)
        m.blob((sx * 1.05, 0.0, 0.05), (0.42, 0.38, 0.1), MOSS[0], n=6)
    # the arch: wedges along a curve from one pillar to the other
    count = 9
    for k in range(count):
        t = k / (count - 1)
        a = math.pi * (1 - t)
        x, z = 1.05 * math.cos(a), 2.15 + 0.55 * math.sin(a)
        s = len(m.vertices)
        m.box((0, 0, 0), (0.46, 0.5, 0.34), ROCK[k % 3], jitter=0.02)
        xform(m, s, rot=(0, -(a - math.pi / 2), 0), offset=(x, 0, z))
    m.blob((0.0, 0.0, 2.85), (0.5, 0.3, 0.1), MOSS[1], n=6)
    m.blob((-0.6, 0.05, 2.65), (0.3, 0.28, 0.08), MOSS[2], n=5)
    # roots hanging from the arch, high over the way through
    for k in range(5):
        x = -0.6 + 0.3 * k
        top = 2.15 + 0.55 * math.sqrt(max(0.0, 1 - (x / 1.05) ** 2)) - 0.12
        m.tube([(x, 0.22, top), (x + 0.03, 0.24, top - 0.25), (x - 0.02, 0.22, top - 0.45 - 0.1 * (k % 2))],
               [0.025, 0.016, 0.004], BARK_DARK, n=3)
    # glowing mushrooms climbing the pillars
    for sx in (-1, 1):
        for k in range(3):
            shroom(m, (sx * (0.75 - 0.02 * k), -0.12 + 0.1 * k, 0.0), 0.16 + 0.07 * k, 0.07, CAP_DARK[k],
                   under=GLOW_CYAN, n=6, lean=(-sx * 0.2, 0))
        start = len(m.faces)
        for k in range(3):
            m.lathe((sx * 1.3, -0.1 + 0.12 * k, 0.6 + 0.4 * k), [(0, 0.02), (0.012, 0.08), (0.03, 0)], GLOW_CYAN,
                    n=5, axis=(sx, 0, 0.3))
        lit(m, start)


def build_forest_chapel(m, v):
    """A small chapel of grey stone, roofless and open at the front; candles burn on its step."""
    w, d = 0.95, 0.85
    wall = 0.18
    # the back wall with a pointed window, the bell gable over it
    for x0, x1 in ((-w, -0.22), (0.22, w)):
        m.box(((x0 + x1) / 2, d, 1.1), (x1 - x0, wall, 2.2), ROCK[0], jitter=0.02)
    m.box((0, d, 0.45), (0.44, wall, 0.9), ROCK[1])
    m.box((0, d, 1.95), (0.44, wall, 0.5), ROCK[1])
    start = len(m.faces)
    m.box((0, d + 0.02, 1.32), (0.36, 0.06, 0.7), CANDLE_LIGHT)
    lit(m, start)
    for s in (-1, 1):
        m.box((s * 0.14, d - 0.04, 1.72), (0.16, 0.08, 0.1), ROCK[2], tilt=0.0)
    m.box((0, d, 2.45), (0.7, wall, 0.5), ROCK[2])
    m.box((-0.2, d, 2.95), (0.12, wall, 0.5), ROCK[0])
    m.box((0.2, d, 2.95), (0.12, wall, 0.5), ROCK[0])
    m.box((0, d, 3.25), (0.55, wall + 0.04, 0.1), ROCK[1])
    m.lathe((0, d, 2.78), [(0, 0.12), (0.06, 0.12), (0.22, 0.08), (0.28, 0)], "#7a6a3a", n=7, axis=(0, 0, 1))
    # the side walls, broken down towards the front
    for sx in (-1, 1):
        for k in range(4):
            y = d - 0.25 - 0.4 * k
            top = 2.0 - 0.38 * k - 0.15 * ((k + (sx > 0)) % 2)
            m.box((sx * w, y, top / 2), (wall, 0.42, top), ROCK[(k + 1) % 3], jitter=0.03)
    # a beam or two of the old roof
    m.tube([(-w, 0.3, 2.0), (w, 0.4, 1.7)], 0.06, BARK_DARK, n=5)
    plate(m, [(-w - 0.1, d + 0.1, 2.3), (-0.1, d + 0.1, 2.85), (-0.1, 0.3, 2.45), (-w - 0.1, 0.3, 1.95)], 0.06,
          SHINGLE[0])
    # the altar stone inside, the step in front
    m.box((0, d - 0.35, 0.3), (0.8, 0.35, 0.6), ROCK[2], jitter=0.02)
    m.box((0, -d - 0.1, 0.06), (1.4, 0.3, 0.12), ROCK[1])
    for k in range(3):
        x = -0.25 + 0.25 * k
        m.lathe((x, d - 0.4, 0.6), [(0, 0.03), (0.1 + 0.04 * (k % 2), 0.027)], CANDLE, n=5)
        flame(m, (x, d - 0.4, 0.7 + 0.04 * (k % 2)), 0.06, CANDLE_LIGHT, r=0.015)
    for k in range(6):
        x = -0.6 + 0.24 * k
        h = 0.08 + 0.05 * (k % 3)
        m.lathe((x, -d - 0.12, 0.12), [(0, 0.03), (h, 0.026)], CANDLE, n=5)
        flame(m, (x, -d - 0.12, 0.12 + h), 0.05, CANDLE_LIGHT, r=0.012)
    # ivy and moss
    for sx in (-1, 1):
        m.tube([(sx * (w + 0.1), d - 0.2, 0), (sx * (w + 0.12), d - 0.3, 1.0), (sx * (w + 0.1), d - 0.5, 1.6)],
               [0.03, 0.02, 0.006], "#2e4226", n=3)
        m.blob((sx * w, d - 0.3, 1.95), (0.15, 0.3, 0.06), MOSS[0], n=5)
    m.blob((0.5, d, 2.72), (0.3, 0.14, 0.06), MOSS[1], n=5)
