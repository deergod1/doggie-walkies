"""Clutter builders: frozen, swamp, nests, mines, ruins, volcanic, abyss (see clutter.py).

Every builder is build_<prop>(m, variant) on a props.Mesh in attachment space.
"""
import math
from pathlib import Path
import sys

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import props  # noqa: E402
from props import (TAU, polar, STONE_DARK, WOOD, BARK, ICE, MOSS, SWAMP, WEB, BONE, SLATE,  # noqa: E402
                   RUIN, RUIN_LIGHT, BASALT, OBSIDIAN, IRON)
from clutter_geo import *  # noqa: E402,F401,F403


# --- frozen -------------------------------------------------------------------
def build_frost_crust(m, v):
    for i in range(5 + v):
        start = len(m.vertices)
        m.shard((0, 0, 0), 0.03, 0.07 + 0.06 * m.rng.random(), (ICE, ICE_LIGHT, "#ffffff")[i % 3], n=4)
        xform(m, start, rot=(m.rng.uniform(-0.6, 0.6), m.rng.uniform(-0.6, 0.6), i),
              offset=polar(0.2 * ((i * 0.618) % 1) + 0.03, i * 2.4 + v))
    clamp_ground(m)


def build_ice_chips(m, v):
    for i in range(7 + v):
        s = 0.04 + 0.04 * m.rng.random()
        m.box(polar(0.22 * ((i * 0.618) % 1) + 0.03, i * 2.4 + v, s * 0.35), (s * 1.2, s, s * 0.7),
              (ICE, ICE_LIGHT, ICE_DEEP)[i % 3], tilt=m.rng.random() * TAU, jitter=s * 0.2)


def build_frost_crystals(m, v):
    m.blob((0, 0, 0), (0.3, 0.08, 0.25), ICE_DEEP, n=6)
    for i in range(6 + v):
        x, z = 0.25 * math.cos(i * 2.4), 0.2 * math.sin(i * 2.4) * ((i * 0.618) % 1 + 0.3)
        d = (m.rng.uniform(-0.4, 0.4), 1, m.rng.uniform(-0.2, 0.6))
        h = 0.18 + m.rng.random() * 0.2
        m.lathe((x, 0.0, z), [(0, 0.04), (h * 0.6, 0.045), (h, 0)], (ICE, ICE_LIGHT)[i % 2], n=5, jitter=0.1,
                axis=d)
    flatten_back(m)


def build_ice_floe(m, v):
    for i in range(2 + v):
        c = polar(0.2 * (i > 0), i * 2.5 + v)
        prism(m, ngon(m, c, 0.2 - 0.05 * i, 6, jitter=0.22, phase=i), -0.07, 0.03 + 0.012 * i, ICE_DEEP,
              top=("#e6eef1", ICE_LIGHT)[i % 2])


def build_frozen_adventurer(m, v):
    m.lathe((0, 0, 0), [(0, 0.3), (0.3, 0.33), (0.7, 0.28), (0.85, 0.18), (0.92, 0)], ICE, n=7, jitter=0.12,
            colors=[ICE, ICE_LIGHT, ICE, ICE_LIGHT])
    helmet(m, (0.02, -0.03, 0.83), rot=(0.12, 0, 0), color=IRON)
    m.box((0.02, -0.25, 0.72), (0.13, 0.05, 0.11), "#b8c8d0")
    for s in (-1, 1):
        m.box((0.02 + s * 0.035, -0.278, 0.74), (0.025, 0.012, 0.02), "#3a4a5a")
        m.box((s * 0.09, -0.3, 0.05), (0.09, 0.12, 0.1), LEATHER)
    if v == 0:
        m.tube([(0.2, -0.18, 0.55), (0.32, -0.24, 0.62), (0.36, -0.22, 0.78)], [0.04, 0.035, 0.03], "#6a4a3a", n=4)
        m.box((0.36, -0.22, 0.8), (0.06, 0.06, 0.06), "#b8c8d0")
        sword_lite(m, (0.36, -0.22, 0.82), rot=(0.1, 0.15, 0), length=0.45)
    else:
        m.tube([(-0.2, -0.2, 0.5), (-0.3, -0.27, 0.38), (-0.33, -0.25, 0.25)], [0.04, 0.035, 0.03], "#6a4a3a", n=4)
        m.lathe((-0.33, -0.3, 0.3), [(0, 0.15), (0.03, 0.15), (0.05, 0.06)], "#7a3a30", n=8, axis=(0.3, -1, 0))


def build_ice_pillar(m, v):
    h = 1.25 + 0.3 * v
    m.lathe((0, 0, 0), [(0, 0.24), (h * 0.12, 0.2), (h * 0.45, 0.13), (h * 0.7, 0.15), (h * 0.9, 0.12),
                        (h, 0.05)], ICE, n=7, jitter=0.14, colors=[ICE_DEEP, ICE, ICE_LIGHT, ICE, ICE_LIGHT])
    for i in range(3):
        m.shard(polar(0.25, i * 2.2 + v), 0.06, 0.2 + 0.08 * i, (ICE_LIGHT, ICE)[i % 2], n=5)


def build_frozen_drape(m, v):
    w = 0.4 + 0.04 * v
    m.box((0, -0.075, 0.025), (2 * w, 0.15, 0.05), ICE_LIGHT, jitter=0.01)
    drop = 0.45 + 0.15 * v
    m.box((0, 0.035, -drop / 2 + 0.05), (2 * w * 0.94, 0.07, drop), ICE, jitter=0.04)
    m.lathe((-w, 0.02, 0.0), [(0, 0.04), (2 * w, 0.04)], ICE_LIGHT, n=6, axis=(1, 0, 0), jitter=0.1)
    for i in range(5 + v):
        x = -w + 2 * w * (i + 0.5) / (5 + v)
        length = 0.12 + m.rng.random() * 0.3
        m.lathe((x, 0.04, -drop + 0.06), [(0, 0.035), (-length * 0.3, 0.022), (-length, 0)],
                (ICE, ICE_LIGHT)[i % 2], n=5, jitter=0.1)
    clamp_lip(m)


# --- swamp --------------------------------------------------------------------
def build_moss_carpet(m, v):
    for i in range(3):
        r = 0.15 - 0.02 * i
        m.blob(polar(0.14 * (i > 0), i * 2.3 + v, 0.0), (r, r * 0.85, 0.045), (SWAMP, "#5a6a32", MOSS)[i],
               n=6, jitter=0.2)
    clamp_ground(m)
    for i in range(4):
        x, y, _ = polar(0.1 + 0.05 * i, i * 1.9 + v)
        h = 0.07 + 0.04 * m.rng.random()
        m.tube([(x, y, 0.02), (x, y, h)], 0.005, "#6a7a3a", n=3)
        m.box((x, y, h), (0.015, 0.015, 0.02), ("#c84a3a", "#d8c050")[v])


def build_tiny_glowcaps(m, v):
    for i in range(4):
        props.mushroom(m, polar(0.15 * (i > 0) + 0.02 * i, i * 2.4 + v), 0.08 + 0.05 * ((i * 0.618) % 1), 0.045,
                       ("#667b3d", "#5a5a7a")[v], stem="#b1b989", glow=True, n=5)


def build_swamp_lilies(m, v):
    for i in range(3):
        lily_pad(m, polar(0.18 * (i > 0) + 0.02 * i, i * 2.3 + v, 0.0), 0.14 - 0.02 * i,
                 ("#3a5a2a", "#46622e", "#324e26")[i], notch=m.rng.random() * TAU, rim="#2a4020")
    for i in range(1 + v):
        start = len(m.faces)
        m.blob(polar(0.05 * i, 1 + i * 2.6, 0.06), (0.035, 0.035, 0.06), "#c8ff9a", n=5)
        lit(m, start)


def build_algae_mat(m, v):
    m.lathe((0, 0, -0.008), [(0, 0.3), (0.012, 0.26), (0.02, 0)], "#5a7a2a", n=10, jitter=0.3,
            colors=["#4a6a22"])
    m.lathe(polar(0.18, 1 + v, -0.006), [(0, 0.16), (0.012, 0.13), (0.018, 0)], "#7a9a3a", n=8, jitter=0.3)
    for i in range(3):
        m.blob(polar(0.12 + 0.05 * i, i * 2.1 + v, 0.012), (0.025, 0.025, 0.015), "#a8c060", n=4)


def build_fungal_tree(m, v):
    h = 2.1 + 0.35 * v
    cap = ("#5f6f3a", "#6a557a")[v]
    trunk = [(0, 0, 0), (0.06, 0.02, h * 0.3), (-0.04, 0.05, h * 0.6), (0.02, 0, h * 0.85)]
    m.tube(trunk, [0.13, 0.1, 0.085, 0.07], "#9a9a78", n=7)
    for i in range(3):
        m.tube([polar(0.32, i * 2.1 + v, 0.0), (0, 0, 0.25)], [0.04, 0.09], "#8a8a68", n=5)
    caps = [((0.02, 0, h * 0.83), 0.42, 0.45)]
    for i in range(2):
        c = Vector(polar(0.2, i * 2.8 + v, h * (0.45 + 0.2 * i)))
        m.tube([Vector(trunk[1 + i]), c], [0.05, 0.03], "#9a9a78", n=5)
        caps.append((tuple(c), 0.22 - 0.03 * i, 0.22))
    for c, r, ch in caps:
        m.lathe(c, [(0, r * 0.25), (ch * 0.06, r), (ch * 0.25, r * 0.8), (ch * 0.5, 0)], cap, n=10, jitter=0.06,
                colors=["#8fff7a", cap, cap], glow_bands=(0,))
    for i in range(4):
        m.box(polar(0.22, i * 1.6, h * 0.83 + 0.1 - 0.02 * i), (0.05, 0.05, 0.03), "#c8d090", tilt=i)


def build_hanging_moss(m, v):
    m.blob((0, -0.08, 0.0), (0.32, 0.12, 0.05), MOSS, n=6)
    for i in range(7 + v):
        x = -0.3 + 0.6 * i / (6 + v) + m.rng.uniform(-0.03, 0.03)
        drop = 0.3 + m.rng.random() * 0.5
        pts = [(x, 0.03, 0.02), (x + m.rng.uniform(-0.04, 0.04), 0.06, -drop * 0.35),
               (x + m.rng.uniform(-0.04, 0.04), 0.07, -drop * 0.7), (x, 0.065, -drop)]
        m.tube(pts, [0.025, 0.02, 0.012, 0.003], (MOSS, "#6a7a3a", SWAMP)[i % 3], n=3)
    clamp_lip(m)


def build_acid_foam(m, v):
    for i in range(6 + v):
        r = 0.04 + 0.05 * ((i * 0.618) % 1)
        start = len(m.faces)
        m.blob(polar(0.24 * ((i * 0.41) % 1) + 0.03 * (i > 0), i * 2.4 + v, 0.0), (r, r, r * 0.8),
               ("#a8e060", "#c8f080")[i % 2], n=5, jitter=0.08)
        if i % 3 == 0:
            lit(m, start)


def build_mangrove_roots(m, v):
    m.lathe((0, 0, 0.45), [(0, 0.1), (0.4, 0.09), (0.7 + 0.1 * v, 0.06)], "#5a4a3a", n=7, jitter=0.08)
    for i in range(5 + v):
        a = i * TAU / (5 + v) + 0.3
        pts = [(0, 0, 0.6), polar(0.18, a, 0.55), polar(0.33, a + 0.1, 0.3), polar(0.38, a + 0.15, 0.0)]
        m.tube(pts, [0.045, 0.04, 0.035, 0.03], ("#5a4a3a", "#6a5a46")[i % 2], n=4)
    for i in range(2):
        m.blob(polar(0.12, i * 3 + v, 1.15 + 0.1 * v), (0.22, 0.2, 0.14), (SWAMP, "#5a6a32")[i], n=7)


def build_puffballs(m, v):
    m.blob((0, 0, 0.0), (0.28, 0.24, 0.04), MOSS, n=6)
    clamp_ground(m)
    for i in range(4 + v):
        r = 0.12 - 0.02 * i
        m.blob(polar(0.17 * (i > 0), i * 2.4 + v, r * 0.85), (r, r, r * 0.9), ("#d8d0b8", "#c8b898")[i % 2], n=6)


def build_pitcher_plant(m, v):
    for i in range(4):
        blade(m, (0, 0, 0.01), polar(0.18, i * TAU / 4 + v, 0.04), 0.04, "#5a7a2a")
    for i in range(3):
        a = i * 2.3 + v
        x, y, _ = polar(0.12, a)
        h = 0.3 + 0.08 * i
        m.lathe((x, y, 0), [(0, 0.03), (h * 0.35, 0.07), (h * 0.8, 0.055), (h, 0.075)], "#2a1a2a", n=7,
                colors=["#7a8a3a", "#8a3a5a", "#9a4a6a"])
        blade(m, (x, y, h), (x - 0.06 * math.cos(a), y - 0.06 * math.sin(a), h + 0.1), 0.05, "#8a3a5a")


# --- nests --------------------------------------------------------------------
def build_web_floor(m, v):
    c = Vector((0.03 * v, -0.02, 0.008))
    k = 6 + v
    ends = [c + Vector(polar(0.3 * m.rng.uniform(0.85, 1.05), TAU * i / k + v)) for i in range(k)]
    for e in ends:
        m.tube([c, e], 0.005, WEB, n=3)
    for t in (0.4, 0.75):
        m.tube([c.lerp(e, t) for e in ends] + [c.lerp(ends[0], t)], 0.004, "#c7c1ce", n=3)


def build_husk_scraps(m, v):
    for i in range(3 + v):
        s = len(m.vertices)
        r = 0.09 - 0.015 * i
        m.lathe((0, 0, 0), [(0, r), (r * 0.4, r * 0.8), (r * 0.6, 0)], ("#6e6070", "#8a7a6a", "#5a4e5c")[i % 3],
                n=6, jitter=0.15)
        xform(m, s, rot=(m.rng.uniform(-0.6, 0.6), m.rng.uniform(-0.6, 0.6), 0),
              offset=polar(0.2 * (i > 0), i * 2.4 + v, 0.0))
    for i in range(2):
        a = Vector(polar(0.12, 1 + i * 3, 0.015))
        m.tube([a, a + Vector(polar(0.12, 2 + i, 0.03))], [0.015, 0.01], "#5a4e5c", n=4)
        m.box(a, (0.03, 0.03, 0.03), "#6e6070", tilt=i)
    clamp_ground(m)


def build_web_sheet(m, v):
    c = Vector((0.08 - 0.16 * v, 0.08, 0.05))
    ends = [Vector((0.6 * math.cos(a), 0.01, 0.48 * math.sin(a))) for a in
            (TAU * i / 8 + 0.2 + m.rng.uniform(-0.1, 0.1) for i in range(8))]
    for e in ends:
        m.tube([e, c], 0.005, WEB, n=3)
    for t in (0.25, 0.45, 0.68, 0.9):
        pts = [c.lerp(e, t) + Vector((0, 0, -0.02 * t)) for e in ends]
        m.tube(pts + [pts[0]], 0.0038, "#c7c1ce" if t > 0.5 else WEB, n=3)


def build_shed_exoskeleton(m, v):
    m.blob((0.12, 0, 0.11), (0.17, 0.14, 0.11), HUSK, n=7)
    m.blob((-0.08, 0, 0.08), (0.1, 0.09, 0.07), "#9a8a72", n=6)
    for s in (-1, 1):
        for k, ang in enumerate((2.4, 1.9, 1.3, 0.8)):
            ang = s * (ang + 0.1 * v * (k % 2))
            hip = Vector((-0.1 + 0.035 * k, s * 0.06, 0.08))
            knee = hip + Vector(polar(0.17, ang, 0.1))
            foot = hip + Vector(polar(0.35, ang + 0.1 * s, -0.08))
            m.tube([hip, knee, foot], [0.018, 0.014, 0.006], "#8a7a62", n=4)


def build_web_pillar(m, v):
    h = 1.3 + 0.25 * v
    m.lathe((0, 0, 0), [(0, 0.24), (h * 0.12, 0.15), (h * 0.4, 0.1), (h * 0.55, 0.14), (h * 0.75, 0.09),
                        (h * 0.92, 0.13), (h, 0.2)], WEB, n=7, jitter=0.15,
            colors=["#d0c8d6", WEB, "#c7c1ce", WEB, "#d0c8d6", WEB])
    m.blob((0.04, -0.04, h * 0.55), (0.16, 0.15, 0.22), "#d8d2de", n=7)
    for i in range(6):
        z = (0.15, h - 0.1)[i % 2]
        m.tube([(0, 0, z), polar(0.42, i * TAU / 6 + v, 0.0 if i % 2 == 0 else h)], 0.004, WEB, n=3)


def build_wall_eggs(m, v):
    for i in range(6 + v):
        f = (i * 0.618) % 1 + 0.4
        m.blob((0.17 * math.cos(i * 2.4) * f, 0.03, 0.15 * math.sin(i * 2.4) * f), (0.08, 0.09, 0.1),
               (WEB, "#ccc4d0")[i % 2], n=6)
    for i in range(4):
        a = i * TAU / 4 + 0.4
        m.tube([(0, 0.05, 0), (0.42 * math.cos(a), 0.005, 0.36 * math.sin(a))], 0.004, WEB, n=3)
    flatten_back(m)


def build_hanging_egg_sacs(m, v):
    for i in range(2 + v):
        x, y, _ = polar(0.15 * (i > 0), i * 2.5)
        length = 0.15 + 0.2 * i
        m.tube([(x, y, 0), (x, y, -length)], 0.005, WEB, n=3)
        r = 0.13 - 0.02 * i
        c = (x, y, -length - r * 1.4)
        m.blob(c, (r, r * 0.95, r * 1.45), (WEB, "#ccc4d0")[i % 2], n=7)
        for k in range(2):
            m.blob((c[0] + r * 0.6 * math.cos(k * 2.5), c[1] + r * 0.6 * math.sin(k * 2.5), c[2] + 0.05 * k),
                   (r * 0.45, r * 0.45, r * 0.55), "#e0dae6", n=4)


def build_webbed_crate(m, v):
    props.build_crate(m, v)
    for i, z in enumerate((0.1, 0.24, 0.38)):
        pts = [Vector((0.27 * math.cos(a), 0.26 * math.sin(a), z + 0.04 * math.sin(a * 2 + i)))
               for a in (TAU * k / 4 + math.pi / 4 + 0.2 * i for k in range(4))]
        m.tube(pts + [pts[0]], 0.006, WEB, n=3)
    for i in range(3):
        a = i * 2.1 + v
        m.tube([polar(0.2, a, 0.48), polar(0.42, a + 0.3, 0.0)], 0.004, WEB, n=3)
    m.blob((0.0, 0.0, 0.5), (0.18, 0.16, 0.03), "#d0c8d6", n=6)


# --- mines --------------------------------------------------------------------
def build_ore_chips(m, v):
    for i in range(6):
        s = 0.05 + 0.04 * m.rng.random()
        m.box(polar(0.22 * ((i * 0.618) % 1) + 0.03, i * 2.4 + v, s * 0.3), (s * 1.2, s, s * 0.6),
              (SLATE, "#4a4a54", "#6a6a76")[i % 3], tilt=m.rng.random() * TAU, jitter=s * 0.15)
    for i in range(3):
        m.box(polar(0.12 + 0.06 * i, i * 2.2 + 1 + v, 0.02), (0.035, 0.03, 0.03), ("#d8b04a", "#8fa8ff")[v], tilt=i)


def build_coal_scatter(m, v):
    for i in range(6 + v):
        pebble(m, polar(0.22 * ((i * 0.618) % 1) + 0.03 * (i > 0), i * 2.4 + v), 0.035 + 0.025 * m.rng.random(),
               ("#262628", "#3a3a3e", "#1c1c1e")[i % 3], n=5)


def build_wall_lantern(m, v):
    m.box((0, 0.015, 0.1), (0.1, 0.03, 0.16), IRON)
    m.tube([(0, 0.02, 0.12), (0, 0.18, 0.15), (0, 0.24, 0.12)], [0.013, 0.012, 0.01], IRON, n=4)
    m.tube([(0, 0.24, 0.12), (0, 0.24, 0.05)], 0.006, IRON, n=3)
    lantern_body(m, (0, 0.24, -0.06), s=0.9 + 0.15 * v)
    flatten_back(m)


def build_ore_vein(m, v):
    glow, alt = (("#8fa8ff", "#7a8aa8"), ("#c08fff", "#8a7aa8"))[v]
    m.blob((0, 0, 0), (0.34, 0.09, 0.22), SLATE, n=7)
    m.blob((0.18, 0, -0.12), (0.16, 0.07, 0.12), "#4a4a54", n=6)
    for i in range(6):
        f = (i * 0.618) % 1 + 0.3
        x, z = 0.24 * math.cos(i * 2.4) * f, 0.17 * math.sin(i * 2.4) * f
        d = (m.rng.uniform(-0.5, 0.5), 1, m.rng.uniform(-0.3, 0.5))
        h = 0.14 + 0.16 * m.rng.random()
        start = len(m.faces)
        m.lathe((x, 0.0, z), [(0, 0.035), (h * 0.6, 0.04), (h, 0)], glow if i % 2 == 0 else alt, n=5, jitter=0.1,
                axis=d)
        if i % 2 == 0:
            lit(m, start)
    flatten_back(m)


def build_hanging_lantern(m, v):
    m.box((0, 0, -0.02), (0.12, 0.06, 0.04), IRON)
    links, r = 3 + v, 0.035
    chain(m, (0, 0, -0.03), links, r=r, t=0.008)
    bottom = -0.03 - r * 1.6 - (links - 1) * r * 2.5 - r * 1.6
    lantern_body(m, (0, 0, bottom - 0.15))


def build_pickaxe_in_rock(m, v):
    props.rock(m, v, radius=0.3, height=0.42, color=SLATE)
    s = len(m.vertices)
    m.tube([(0, 0, 0), (0, 0, 0.6)], [0.022, 0.02], WOOD, n=5)
    m.tube([(-0.22, 0, -0.05), (-0.1, 0, 0.0), (0.0, 0, 0.01), (0.1, 0, 0.0), (0.2, 0, -0.06)],
           [0.008, 0.022, 0.03, 0.022, 0.01], IRON, n=4)
    xform(m, s, rot=(0, 0.7 + 0.2 * v, 0.4), offset=(0.0, 0.0, 0.34))


def build_ore_pile(m, v):
    for i in range(7 + v):
        r = 0.12 - 0.008 * i
        c = polar(0.2 * ((i * 0.618) % 1) + 0.04 * (i > 0), i * 2.4 + v)
        m.lathe(c, [(0, r * 0.8), (r * 0.6, r), (r * 1.2, r * 0.35)], (SLATE, "#4a4a54", "#6a6a76")[i % 3], n=5,
                jitter=0.25)
    m.lathe((0.02, 0, 0.08), [(0, 0.1), (0.08, 0.11), (0.15, 0.04)], "#4a4a54", n=6, jitter=0.25)
    for i in range(3):
        m.shard(polar(0.12, i * 2.1 + v, 0.08), 0.03, 0.1, ("#8fa8ff", "#c08fff")[(i + v) % 2], n=4)


def build_wheelbarrow(m, v):
    m.lathe((0, 0, 0.2), [(0, 0.12), (0.18, 0.2)], WOOD, n=4, phase=math.pi / 4, jitter=0)
    xform(m, 0, scale=(1.5, 1.0, 1.0), offset=(0.02, 0, 0))
    m.box((0.02, 0, 0.36), (0.36, 0.22, 0.02), ("#4a4a54", DIRT)[v])
    m.ring((0.36, 0, 0.1), 0.1, 0.022, IRON, n=10, vertical=True)
    m.box((0.36, 0, 0.1), (0.04, 0.08, 0.04), WOOD)
    for s in (-1, 1):
        m.tube([(0.36, s * 0.05, 0.1), (0.1, s * 0.14, 0.2), (-0.42, s * 0.16, 0.3)], [0.018, 0.018, 0.015],
               WOOD, n=4)
        m.box((-0.18, s * 0.14, 0.08), (0.03, 0.03, 0.16), WOOD)


def build_plank_stack(m, v):
    for layer in range(4 + v):
        for k in range(2):
            m.box((m.rng.uniform(-0.03, 0.03), -0.08 + 0.16 * k + m.rng.uniform(-0.01, 0.01), 0.06 + layer * 0.045),
                  (0.8, 0.14, 0.04), (WOOD, "#9a7448", "#82603b")[(layer + k) % 3], tilt=m.rng.uniform(-0.06, 0.06))
    for x in (-0.3, 0.3):
        m.box((x, 0, 0.02), (0.08, 0.36, 0.04), BARK)


def build_sacks(m, v):
    for i in range(2 + v):
        c = polar(0.15 * (i > 0), i * 2.6 + v)
        r = 0.15 - 0.02 * i
        color = (BURLAP, "#8a7552", "#b09a72")[i]
        m.blob((c[0], c[1], r * 1.2), (r, r * 0.85, r * 1.25), color, n=7, jitter=0.1)
        m.lathe((c[0], c[1], r * 2.3), [(0, r * 0.35), (r * 0.25, r * 0.25), (r * 0.45, r * 0.4)], color, n=5)
        m.ring((c[0], c[1], r * 2.4), r * 0.27, 0.01, "#5a4a32", n=6)


def build_tipped_cart(m, v):
    props.build_ore_cart(m, v)
    xform(m, 0, rot=(math.pi / 2 - 0.1, 0, 0.0), offset=(0, 0.27, 0))
    for i in range(4 + v):
        pebble(m, polar(0.18 + 0.06 * i, 4.4 + 0.45 * i), 0.07 - 0.008 * i, (SLATE, "#4a4a54")[i % 2], n=5)


def build_dynamite_crate(m, v):
    m.box((0, 0, 0.02), (0.46, 0.34, 0.04), WOOD)
    for s in (-1, 1):
        m.box((s * 0.22, 0, 0.13), (0.03, 0.34, 0.22), WOOD)
        m.box((0, s * 0.155, 0.13), (0.44, 0.03, 0.22), "#9a7448")
    m.box((0, -0.172, 0.15), (0.12, 0.006, 0.08), "#b8322a")
    for i in range(6):
        x, z = -0.15 + 0.06 * i, 0.1 + 0.03 * (i % 2)
        m.tube([(x, -0.12, z), (x + 0.01, 0.12, z)], 0.025, "#b8322a", n=5)
        m.tube([(x + 0.01, 0.12, z), (x + 0.02, 0.17, z + 0.06)], 0.004, "#3a3a3a", n=3)
    if v:
        s = len(m.vertices)
        m.box((0, 0, 0), (0.04, 0.34, 0.44), "#82603b")
        xform(m, s, rot=(0, -0.35, 0), offset=(0.32, 0, 0.2))


def build_pulley_hook(m, v):
    m.box((0, 0, -0.03), (0.3, 0.1, 0.06), WOOD)
    m.tube([(0, 0, -0.06), (0, 0, -0.12)], 0.012, IRON, n=4)
    m.box((0, 0, -0.18), (0.05, 0.12, 0.14), IRON)
    m.ring((0, 0, -0.18), 0.07, 0.015, WOOD, n=8, vertical=True)
    length = 0.6 + 0.25 * v
    for x in (-0.07, 0.07):
        m.tube([(x, 0, -0.18), (x * 0.4, 0, -length)], 0.008, "#b09a72", n=3)
    m.box((0, 0, -length), (0.05, 0.05, 0.04), IRON)
    m.tube([(0, 0, -length), (0, 0, -length - 0.08), (0.05, 0, -length - 0.14), (0.09, 0, -length - 0.1)],
           [0.014, 0.014, 0.012, 0.006], IRON, n=4)


# --- ruins (masonry stays neutral like props.py's ruins) -------------------------
def build_broken_tiles(m, v):
    for i in range(5 + v):
        s = 0.11 + 0.04 * m.rng.random()
        m.box(polar(0.2 * ((i * 0.618) % 1) + 0.04 * (i > 0), i * 2.4 + v, 0.015), (s, s * m.rng.uniform(0.6, 1.0), 0.03),
              (RUIN, RUIN_LIGHT, STONE_MID)[i % 3], tilt=m.rng.random() * 0.6 + i * 0.4, jitter=0.006)
    for i in range(2):
        pebble(m, polar(0.26, i * 3 + v), 0.03, RUIN_LIGHT, n=4)


def build_sand_drift(m, v):
    m.lathe((0, 0, 0), [(0, 0.2), (0.03, 0.16), (0.06, 0.08), (0.07, 0)], SAND, n=8, jitter=0.15,
            colors=["#b09660", SAND, "#d8c090"])
    xform(m, 0, scale=(1.6, 0.9, 1.0), rot=(0, 0, 0.3 * v))
    m.lathe(polar(0.18, 2.5 + v), [(0, 0.08), (0.02, 0.05), (0.03, 0)], SAND, n=6, jitter=0.2)


def build_wall_relief(m, v):
    m.box((0, 0.03, 0), (0.7, 0.06, 0.56), RUIN, jitter=0.01)
    for z in (-0.25, 0.25):
        m.box((0, 0.065, z), (0.72, 0.03, 0.05), RUIN_LIGHT)
    for x in (-0.33, 0.33):
        m.box((x, 0.065, 0), (0.05, 0.03, 0.46), RUIN_LIGHT)
    if v == 0:
        m.lathe((0, 0.06, 0.02), [(0, 0.11), (0.03, 0.1), (0.045, 0.06)], RUIN_LIGHT, n=10, axis=(0, 1, 0))
        for i in range(8):
            a = i * TAU / 8
            m.box((0.17 * math.cos(a), 0.075, 0.02 + 0.15 * math.sin(a)), (0.04, 0.03, 0.04), RUIN_LIGHT, tilt=a)
    else:
        m.blob((0.0, 0.07, 0.15), (0.05, 0.025, 0.055), RUIN_LIGHT, n=5)
        m.box((0.0, 0.075, 0.0), (0.1, 0.03, 0.2), RUIN_LIGHT)
        m.box((0.0, 0.075, -0.15), (0.14, 0.03, 0.1), RUIN_LIGHT)
        m.tube([(-0.04, 0.078, 0.07), (-0.12, 0.078, 0.12), (-0.14, 0.078, 0.2)], 0.016, RUIN_LIGHT, n=4)
        m.tube([(0.04, 0.078, 0.07), (0.1, 0.078, 0.03)], 0.016, RUIN_LIGHT, n=4)
        m.tube([(0.11, 0.082, -0.2), (0.11, 0.082, 0.21)], 0.012, RUIN_LIGHT, n=4)
    m.box((0.22, 0.062, -0.12), (0.2, 0.012, 0.012), STONE_DARK, tilt=0.6)
    flatten_back(m)


def build_urn(m, v):
    h = 0.55
    prof = [(0, 0.09), (h * 0.08, 0.14), (h * 0.35, 0.2), (h * 0.6, 0.17), (h * 0.78, 0.08), (h * 0.9, 0.065),
            (h, 0.1)]
    bands = [TERRA, "#7a4428", TERRA, TERRA, "#b8784a", TERRA]
    if v == 0:
        m.lathe((0, 0, 0), prof, "#3a2418", n=9, jitter=0.03, colors=bands)
        for s in (-1, 1):
            m.tube([(s * 0.06, 0, h * 0.88), (s * 0.16, 0, h * 0.85), (s * 0.17, 0, h * 0.68), (s * 0.15, 0, h * 0.6)],
                   0.016, TERRA, n=4)
    else:
        m.lathe((0, 0, 0), prof[:4], "#3a2418", n=9, jitter=0.03, colors=bands)
        m.vertices[-9:] = [(x, y, z + m.rng.uniform(-0.09, 0.02)) for x, y, z in m.vertices[-9:]]
        for i in range(3):
            s = len(m.vertices)
            prism(m, [(0, 0), (0.09, 0.01), (0.05, 0.07)], 0, 0.015, TERRA, top=("#b8784a", TERRA)[i % 2])
            xform(m, s, rot=(0, 0, i * 2.1), offset=polar(0.28, i * 1.3 + 0.5))


def build_toppled_column(m, v):
    m.lathe((-0.42, 0, 0.19), [(0, 0.19), (0.5, 0.19), (0.52, 0.17)], RUIN, n=12, jitter=0.03,
            axis=(1, 0.08, 0), colors=[RUIN, RUIN_LIGHT])
    m.lathe((0.14, 0.14, 0.17), [(0, 0.17), (0.24, 0.17)], RUIN_LIGHT, n=12, jitter=0.03,
            axis=(0.7, -0.7 + 0.3 * v, 0))
    m.box((0.22, -0.22, 0.09), (0.24, 0.22, 0.18), RUIN, tilt=0.4, jitter=0.02)
    for i in range(3):
        pebble(m, polar(0.3, 2.0 + i * 0.5), 0.045, (RUIN, RUIN_LIGHT)[i % 2], n=4)


def build_obelisk_broken(m, v):
    m.box((0, 0, 0.06), (0.5, 0.5, 0.12), RUIN, jitter=0.01)
    h = 1.3 + 0.4 * v
    m.lathe((0, 0, 0.12), [(0, 0.27), (h * 0.9, 0.2), (h, 0.19)], RUIN, n=4, jitter=0, phase=math.pi / 4,
            colors=[RUIN_LIGHT, RUIN])
    m.vertices[-4:] = [(x, y, z + m.rng.uniform(-0.18, 0.04)) for x, y, z in m.vertices[-4:]]
    for i in range(3):
        m.box((0, -0.178, 0.4 + 0.25 * i), (0.08, 0.02, 0.1), STONE_DARK)
    m.lathe((0.15, -0.2, 0.09), [(0, 0.12), (0.22, 0.0)], RUIN, n=4, axis=(1, -0.4, 0.1), phase=math.pi / 4,
            jitter=0.05)


def build_hanging_censer(m, v):
    m.ring((0, 0, -0.03), 0.04, 0.01, BRASS, n=6, vertical=True)
    length = 0.45 + 0.2 * v
    for i in range(3):
        m.tube([(0, 0, -0.06), polar(0.11, i * TAU / 3, -length)], 0.005, BRASS, n=3)
    m.lathe((0, 0, -length - 0.12), [(0, 0.03), (0.04, 0.09), (0.1, 0.12), (0.12, 0.11), (0.08, 0.06)], BRASS,
            n=8, colors=[BRASS, "#8a6a38", BRASS, "#3a2a18"])
    for i in range(2):
        start = len(m.faces)
        m.shard(polar(0.03 * i, i * 3, -length - 0.05), 0.035, 0.08 + 0.04 * i, "#ffb050", n=4)
        lit(m, start)


def build_altar(m, v):
    m.box((0, 0, 0.05), (0.8, 0.5, 0.1), RUIN)
    m.box((0, 0, 0.3), (0.66, 0.38, 0.4), RUIN_LIGHT, jitter=0.01)
    m.box((0, 0, 0.535), (0.76, 0.46, 0.07), RUIN)
    m.box((0, -0.195, 0.3), (0.4, 0.02, 0.22), STONE_DARK)
    m.box((0, -0.205, 0.3), (0.12, 0.02, 0.12), RUIN_LIGHT)
    if v:
        m.lathe((0.2, 0.05, 0.57), [(0, 0.08), (0.05, 0.1), (0.07, 0.06)], RUIN_LIGHT, n=7)
    else:
        for i in range(3):
            m.box(polar(0.42, -0.6 + 0.35 * i, 0.05), (0.1, 0.08, 0.08), (RUIN, RUIN_LIGHT)[i % 2], tilt=i)


def build_collapsed_arch(m, v):
    for i in range(3):
        m.box((-0.25, 0, 0.2 + i * 0.4), (0.26, 0.26, 0.38), (RUIN, RUIN_LIGHT)[i % 2], tilt=0.03 * i, jitter=0.01)
    cx, cz, radius = 0.2, 1.3, 0.45
    for k in range(4 - v):
        a = math.pi - (k + 0.5) * 0.42
        s = len(m.vertices)
        m.box((0, 0, 0), (0.14, 0.26, 0.2), RUIN_LIGHT)
        xform(m, s, rot=(0, math.pi / 2 - a, 0), offset=(cx + radius * math.cos(a), 0, cz + radius * math.sin(a)))
    m.box((0.22, 0.1, 0.1), (0.22, 0.26, 0.2), RUIN, tilt=0.5, jitter=0.02)
    m.box((0.3, -0.22, 0.07), (0.16, 0.2, 0.14), RUIN_LIGHT, tilt=1.1, jitter=0.02)


def build_stone_tablet(m, v):
    m.box((0, 0, 0.31), (0.44, 0.09, 0.62), RUIN, jitter=0.01)
    m.lathe((0, -0.045, 0.6), [(0, 0.22), (0.09, 0.22)], RUIN, n=10, axis=(0, 1, 0))
    for i in range(4):
        m.box((0, -0.05, 0.18 + 0.1 * i), (0.3 - 0.06 * (i % 2), 0.012, 0.025), STONE_DARK)
    xform(m, 0, rot=(0.15 + 0.1 * v, 0, 0.2 * v))
    for i in range(2):
        pebble(m, polar(0.25, 4.5 + i * 0.6), 0.05, (RUIN, RUIN_LIGHT)[i], n=4)


# --- volcanic -------------------------------------------------------------------
def build_cinders(m, v):
    for i in range(6 + v):
        pebble(m, polar(0.22 * ((i * 0.618) % 1) + 0.03 * (i > 0), i * 2.4 + v), 0.04 + 0.02 * m.rng.random(),
               ("#2a2626", "#3a3030")[i % 2], n=4)
    for i in range(4):
        start = len(m.faces)
        m.box(polar(0.1 + 0.05 * i, i * 2.2 + 0.5 + v, 0.012), (0.025, 0.02, 0.02), ("#ff6a20", "#ffb050")[i % 2],
              tilt=i)
        lit(m, start)


def build_pumice_chips(m, v):
    for i in range(6 + v):
        pebble(m, polar(0.22 * ((i * 0.618) % 1) + 0.03 * (i > 0), i * 2.4 + v), 0.04 + 0.03 * m.rng.random(),
               ("#9a9a9a", "#8a8a8a", "#b0b0b0")[i % 3], n=5)


def build_magma_seep(m, v):
    m.blob((0, 0, 0.18), (0.26, 0.1, 0.12), BASALT, n=6)
    m.blob((0.05, 0, -0.25), (0.22, 0.09, 0.1), "#2a2a2a", n=6)
    start = len(m.faces)
    m.tube([(0.0, 0.07, 0.15), (0.04, 0.055, 0.05), (-0.03, 0.05, -0.08), (0.02, 0.06, -0.2)],
           [0.03, 0.025, 0.022, 0.03], "#ff6a20", n=4)
    m.blob((0.03, 0.06, -0.24), (0.07, 0.05, 0.05), "#ffb050", n=5)
    if v:
        m.tube([(-0.12, 0.06, 0.12), (-0.15, 0.05, 0.0), (-0.12, 0.05, -0.1)], [0.022, 0.018, 0.012], "#ff6a20", n=4)
    lit(m, start)
    flatten_back(m)


def build_lava_crust(m, v):
    for i in range(3 + v):
        c = polar(0.2 * (i > 0) + 0.03 * i, i * 2.4 + v)
        outline = ngon(m, c, 0.15 - 0.02 * i, 6, jitter=0.2, phase=i)
        start = len(m.faces)
        prism(m, [(c[0] + (x - c[0]) * 1.12, c[1] + (y - c[1]) * 1.12) for x, y in outline], -0.05, 0.012,
              "#ff5a1a", top="#ffb050")
        lit(m, start)
        prism(m, outline, -0.02, 0.04 + 0.01 * i, "#2a2220", top=("#3a3030", "#2a2626")[i % 2])


def build_sulfur_vent(m, v):
    w = 0.24 + 0.04 * v
    m.lathe((0, 0, 0), [(0, 0.3), (0.12, 0.22), (w, 0.12), (w, 0.08), (0.08, 0.04)], "#3a3430", n=9,
            jitter=0.15, colors=["#4a4440", "#3a3430", "#1a1614", "#141210"])
    for i in range(5):
        m.blob(polar(0.13, i * TAU / 5 + v, w - 0.02), (0.05, 0.05, 0.03), (SULFUR, "#e8d860")[i % 2], n=4)
    for i in range(3):
        m.shard(polar(0.26, i * 2.1 + v, 0.0), 0.03, 0.1 + 0.03 * i, SULFUR, n=4)


def build_rope_lava(m, v):
    m.blob((0, 0, 0), (0.36, 0.3, 0.06), BASALT, n=7)
    clamp_ground(m)
    for k in range(3):
        r = 0.1 + 0.09 * k
        pts = [polar(r, -1.1 + 2.2 * t / 5 + v, 0.05 + 0.01 * math.sin(t)) for t in range(6)]
        m.tube(pts, [0.035, 0.05, 0.055, 0.05, 0.045, 0.02], ("#3a3a3a", "#444444", "#2e2e2e")[k], n=5)


def build_fire_crystal(m, v):
    crystal_cluster(m, v, "#ff8a3a", "#a04020", base=BASALT)


def build_lava_stalactite(m, v):
    m.blob((0, 0, 0), (0.24, 0.2, 0.05), BASALT, n=6)
    for i in range(3):
        length = (0.6 + 0.3 * v) * (1 if i == 0 else 0.5 + 0.1 * i)
        m.lathe(polar(0.13 if i else 0, i * 2.4), [(0, 0.08), (-length * 0.4, 0.06), (-length * 0.8, 0.03),
                (-length, 0)], BASALT, n=6, jitter=0.15, colors=["#3a3030", "#4a2a20", "#ff5a1a"], glow_bands=(2,))


def build_scorched_bones(m, v):
    m.lathe((0, 0, 0), [(0, 0.3), (0.01, 0.26), (0.02, 0)], "#2e2a28", n=8, jitter=0.2)
    skull_lite(m, (0.05, -0.05, 0.01), scale=0.9, yaw=0.5 + v, color="#7a6a58", dark="#1a1614")
    for i in range(3 + v):
        a = i * 1.3 + v
        bone_lite(m, polar(0.25, a, 0.03), polar(0.2, a + math.pi - 0.4, 0.04), color=("#5a4a3c", "#6a5a4a")[i % 2])


# --- abyss ----------------------------------------------------------------------
def build_void_flakes(m, v):
    for i in range(7 + v):
        s = len(m.vertices)
        prism(m, ngon(m, (0, 0), 0.05 + 0.025 * m.rng.random(), 3 + i % 2, jitter=0.3, phase=i), -0.006, 0.006,
              (OBSIDIAN, "#484252", ABYSS_ACCENT)[i % 3])
        xform(m, s, rot=(m.rng.uniform(-1.2, 1.2), m.rng.uniform(-0.5, 0.5), i),
              offset=polar(0.22 * ((i * 0.618) % 1) + 0.03, i * 2.4 + v, 0.02))
    clamp_ground(m)


def build_dangling_chains(m, v):
    m.lathe((0, -0.14, 0), [(0, 0.035), (0.12, 0.025), (0.16, 0)], IRON, n=5)
    m.ring((0, -0.14, 0.1), 0.03, 0.009, IRON, n=6, vertical=True, yaw=math.pi / 2)
    for x, links in (((-0.1, 5), (0.12, 4)) if v == 0 else ((0.0, 8),)):
        m.tube([(0, -0.14, 0.1), (x, 0.0, 0.03), (x, 0.06, 0.0)], 0.01, IRON, n=4)
        chain(m, (x, 0.06, 0.0), links, r=0.045, t=0.01, n=5, yaw=math.pi / 2)
        if v:
            m.ring((x, 0.06, -0.045 * 1.6 - links * 0.045 * 2.5 - 0.02), 0.06, 0.014, "#5a3a2a", n=8)


def build_void_crystal(m, v):
    crystal_cluster(m, v, "#a050ff", OBSIDIAN, base="#22202a")


def build_ritual_circle(m, v):
    start = len(m.faces)
    m.ring((0, 0, 0.006), 0.36, 0.008, "#ff3030", n=16)
    m.tube([polar(0.36, math.pi / 2 + i * 2 * TAU / 5, 0.006) for i in range(6)], 0.006, "#ff3030", n=3)
    lit(m, start)
    for i in range(3 + v):
        x, y, _ = polar(0.38, math.pi / 2 + i * TAU / (3 + v) + 0.3)
        h = 0.06 + 0.03 * (i % 2)
        m.lathe((x, y, 0), [(0, 0.028), (h, 0.025)], "#2a2030", n=5)
        start = len(m.faces)
        m.shard((x, y, h), 0.012, 0.04, "#ffb050", n=4)
        lit(m, start)


def build_wall_shackles(m, v):
    m.box((0, 0.015, 0.25), (0.34, 0.03, 0.09), IRON)
    for s in (-1, 1):
        x = s * 0.12
        links = 2 + v
        chain(m, (x, 0.05, 0.22), links, r=0.035, t=0.008, n=5)
        end = 0.22 - 0.035 * 1.6 - (links - 1) * 0.035 * 2.5 - 0.035 * 1.6
        m.ring((x, 0.06, end - 0.04), 0.05, 0.014, RUST, n=8, vertical=True, yaw=math.pi / 2 * (s > 0))
    flatten_back(m)


def build_wall_runes(m, v):
    m.blob((0, 0, 0), (0.3, 0.07, 0.36), OBSIDIAN, n=6, jitter=0.12)
    flatten_back(m)
    start = len(m.faces)
    for i in range(3):
        z, x0 = 0.18 - 0.17 * i, -0.06 + 0.02 * v - 0.02 * i
        m.tube([(x0, 0.075, z), (x0 + 0.06, 0.082, z + 0.06), (x0 + 0.12, 0.075, z)], 0.01, "#ff3030", n=3)
        m.tube([(x0 + 0.06, 0.082, z - 0.05), (x0 + 0.06, 0.082, z + 0.06)], 0.01, "#ff3030", n=3)
    lit(m, start)


def build_hovering_rock(m, v):
    for i in range(3):
        pebble(m, polar(0.15 * (i > 0), i * 2.4 + v), (0.07, 0.05, 0.045)[i], (OBSIDIAN, "#22202a", "#32303e")[i])
    z0 = 0.45 + 0.1 * v
    m.lathe((0, 0, z0), [(0, 0.0), (0.08, 0.12), (0.22, 0.26), (0.32, 0.22), (0.38, 0.1)], OBSIDIAN, n=7,
            jitter=0.18, colors=["#22202a", "#2a2834", OBSIDIAN, "#3a3448"])
    for i in range(2):
        m.shard(polar(0.3, i * 3 + v, z0 - 0.05 + 0.1 * i), 0.03, 0.08, ABYSS_ACCENT, n=4)


def build_weapon_graveyard(m, v):
    m.lathe((0, 0, 0), [(0, 0.38), (0.04, 0.3), (0.07, 0.0)], "#2a2834", n=8, jitter=0.2)
    for i in range(3 + v):
        a = i * 2.4 + v
        length = 0.45 + 0.1 * (i % 2)
        s = len(m.vertices)
        sword_lite(m, polar(0.18 * (i > 0) + 0.04 * i, a, length - 0.1),
                   rot=(math.pi + m.rng.uniform(-0.3, 0.3), m.rng.uniform(-0.3, 0.3), a), length=length,
                   blade_color=(STEEL, RUST)[i % 2], grip=("#3a2a2a", LEATHER)[i % 2])
        clamp_ground(m, s)


def build_broken_altar(m, v):
    m.box((0, 0, 0.05), (0.78, 0.5, 0.1), "#22202a")
    for s in (-1, 1):
        st = len(m.vertices)
        m.box((s * 0.17, 0, 0.3), (0.32, 0.4, 0.4), OBSIDIAN, jitter=0.02)
        m.box((s * 0.17, 0, 0.53), (0.36, 0.46, 0.07), "#32303e")
        xform(m, st, rot=(0, s * 0.12, s * 0.05), pivot=(s * 0.02, 0, 0.1))
    m.box((0, -0.3, 0.04), (0.1, 0.08, 0.06), "#32303e", tilt=0.5)
    if v:
        skull_lite(m, (0.17, 0.0, 0.58), scale=0.8, yaw=0.3)


# --- lights for the dark depths: the spider nests and the buried ruins ---------
NEST_GLOW = "#d0a8ff"
DEW = "#bfe0ff"
CLAY = "#9a6a48"


def build_glow_spores(m, v):
    """Cover: a scrap of web on the ground, spores glowing in it."""
    m.lathe((0, 0, 0), [(0, 0.26), (0.01, 0.2), (0.015, 0)], WEB, n=7, jitter=0.25)
    start = len(m.faces)
    for i in range(6 + v):
        m.blob(polar(0.04 + 0.18 * ((i * 0.618) % 1), i * 2.4 + v, 0.03), (0.025, 0.025, 0.02), NEST_GLOW, n=4)
    lit(m, start)


def build_glow_eggs(m, v):
    """A clutch of pale eggs on a pad of web, lit from within."""
    m.lathe((0, 0, 0), [(0, 0.34), (0.015, 0.28), (0.03, 0)], WEB, n=8, jitter=0.2)
    start = len(m.faces)
    for i in range(5 + v):
        a, d, r = i * 2.4 + v, 0.05 + 0.18 * ((i * 0.618) % 1), 0.07 + 0.02 * (i % 3)
        m.blob(polar(d, a, r * 1.05), (r, r * 0.95, r * 1.2), NEST_GLOW, n=5)
    lit(m, start)
    for i in range(4):
        a = i * TAU / 4 + 0.3
        m.tube([polar(0.36, a, 0.0), polar(0.12, a + 0.2, 0.16)], 0.005, WEB, n=3)


def build_pale_fungus(m, v):
    """Pale fungus glowing on an old husk."""
    m.blob((0.0, 0.02, 0.06), (0.2, 0.13, 0.07), "#8a8070", n=6)
    bone_lite(m, polar(0.22, 1.2 + v, 0.02), polar(0.08, 2.4 + v, 0.04), r=0.015)
    start = len(m.faces)
    for i in range(4 + v):
        p = polar(0.04 + 0.16 * ((i * 0.618) % 1), i * 2.3 + v, 0.0)
        h = 0.1 + 0.06 * (i % 3)
        m.tube([p, (p[0], p[1], h)], 0.012, "#d8d0e8", n=4)
        m.lathe((p[0], p[1], h - 0.01), [(0, 0.015), (0.015, 0.05), (0.035, 0.035), (0.05, 0)], "#e8e0ff", n=6)
    lit(m, start)


def build_dew_web(m, v):
    """Wall: a web beaded with glowing dew."""
    for i in range(6):
        a = i * TAU / 6 + 0.2 * v
        m.tube([(0, 0.02, 0), (0.42 * math.cos(a), 0.005, 0.36 * math.sin(a))], 0.004, WEB, n=3)
    for k in (0.14, 0.27):
        pts = [(k * 1.15 * math.cos(i * TAU / 6 + 0.2 * v), 0.012, k * math.sin(i * TAU / 6 + 0.2 * v)) for i in range(7)]
        m.tube(pts, 0.003, WEB, n=3)
    start = len(m.faces)
    for i in range(9 + v):
        a, d = i * 2.4 + v, 0.08 + 0.3 * ((i * 0.618) % 1)
        m.blob((d * 1.1 * math.cos(a), 0.02, d * 0.9 * math.sin(a)), (0.022, 0.018, 0.024), DEW, n=4)
    lit(m, start)
    flatten_back(m)


def silk(m, v, glow):
    """Threads of silk over an edge, beads along them (glowing or dew-pale)."""
    m.blob((0.0, -0.08, 0.01), (0.26, 0.08, 0.02), WEB, n=5)
    beads = []
    for k in range(3 + v):
        x = -0.24 + 0.48 * k / (2 + v)
        drop = 0.35 + 0.25 * ((k * 0.618) % 1)
        m.tube([(x, -0.1, 0.02), (x, 0.02, 0.01), (x + 0.02, 0.04, -drop)], 0.005, WEB, n=3)
        beads += [(x + 0.01, 0.035, -drop * t) for t in (0.4, 0.75, 1.0)]
    start = len(m.faces)
    for b in beads:
        m.blob(b, (0.022, 0.022, 0.026), NEST_GLOW if glow else "#d8d4dc", n=4)
    if glow:
        lit(m, start)
    clamp_lip(m)


def build_glow_silk(m, v):
    """Lip: threads of silk over an edge, beads of glow along them."""
    silk(m, v, True)


def build_silk_drape(m, v):
    """Lip: threads of silk over an edge, pale beads of dew along them."""
    silk(m, v, False)


def build_oil_lamps(m, v):
    """Clay oil lamps on a broken step, their little flames still burning."""
    m.box((0, 0, 0.05), (0.62, 0.36, 0.1), RUIN, jitter=0.01)
    for i in range(3 + v):
        x = -0.22 + 0.44 * i / (2 + v)
        y = 0.04 * (i % 2)
        m.lathe((x, y, 0.1), [(0, 0.03), (0.025, 0.06), (0.05, 0.05), (0.055, 0.02)], CLAY, n=6)
        start = len(m.faces)
        m.shard((x + 0.04, y, 0.15), 0.018, 0.08 + 0.03 * (i % 2), "#ffb860", n=4)
        lit(m, start)


def build_wall_brazier(m, v):
    """Wall: an iron bowl on a bracket, burning."""
    m.box((0, 0.02, 0.0), (0.18, 0.04, 0.3), IRON)
    m.tube([(0, 0.02, -0.08), (0, 0.18, -0.02), (0, 0.24, 0.06)], 0.018, IRON, n=4)
    m.lathe((0, 0.26, 0.06), [(0, 0.04), (0.05, 0.12), (0.11, 0.16), (0.13, 0.15)], IRON, n=8,
            colors=[IRON, "#3a3a40", "#2a2a2e"])
    m.blob((0, 0.26, 0.17), (0.11, 0.11, 0.03), "#3a2a20", n=5)
    for i in range(3):
        start = len(m.faces)
        m.shard((0.05 * math.cos(i * 2.4), 0.26 + 0.05 * math.sin(i * 2.4), 0.17), 0.045, 0.2 + 0.08 * (i == v), "#ffa040",
                n=5, glow=True)
        lit(m, start)
    flatten_back(m)


def build_glyph_stone(m, v):
    """A fallen tablet, its glyphs still glowing."""
    s = len(m.vertices)
    m.box((0, 0, 0.08), (0.62, 0.38, 0.16), RUIN_LIGHT, jitter=0.01)
    start = len(m.faces)
    for i in range(4 + v):
        x, y = -0.2 + 0.4 * (i % 3) / 2, -0.09 + 0.18 * (i // 3)
        m.box((x, y, 0.165), (0.08 if i % 2 else 0.02, 0.02 if i % 2 else 0.08, 0.012), "#8ad8ff")
    lit(m, start)
    xform(m, s, rot=(0.06, -0.05, 0.3 * v))
    m.blob((0.25, 0.15, 0.02), (0.12, 0.1, 0.04), RUIN, n=4)
    clamp_ground(m)
