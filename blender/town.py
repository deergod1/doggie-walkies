"""Seven low-poly town services, matching props.py's texture-free terrain palette.

One unit = one game cell; character height is about 1.1. Z up, fronts face
-Y (glTF +Z), origin at ground-centred building footprint. Single joined mesh
per asset, flat normals, linear vertex colours, no textures/UVs/modifiers.
Emissive lanterns / forge are a second material, the windows' panes a third
("<name>_window": the game lights them at night only). Signs use geometry, not text.

Headless:
    Blender -b --python blender/town.py -- [output-directory]
MCP / Blender (build does not clear unrelated objects):
    import sys; sys.path.insert(0, '<repo>/blender')
    import town; objects = town.build(); town.export(objects, '<repo>/assets')

main() creates a NEW presentation scene, exports town.glb, town/*.glb and a
JSON manifest to assets/, saves blender/town.blend, then renders
blender/previews/town-preview.png plus individual thumbnails in
blender/previews/town/. Preview floor, labels, camera and lights never export.
The exports are models only; they do not implement gameplay or collision.
"""
import hashlib
import json
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

sys.path.insert(0, str(Path(__file__).resolve().parent))
import props

COLLECTION = 'CubeCrawlerTown'
SEED = 4815
WOOD = '#82603b'
TIMBER = '#573c2b'
EDGE = '#ac8154'
CREAM = '#dfd0ad'
STONE = '#939393'
STONE_DARK = '#606060'
IRON = '#484852'
BRASS = '#c5a25a'
HAY = '#c6a45c'
DARK = '#302d2c'
GLASS = '#698b87'
GLOW = '#ffb65e'
ROOF_BLUE = ['#536b75', '#617a80', '#4b616b']
ROOF_GREEN = ['#64774e', '#74835b', '#5c6c48']
ROOF_RED = ['#a46349', '#b47553', '#955842']


def solid(m, points, offset, color):
    """Extrude a planar polygon into a closed solid, triangulating its caps."""
    a = [m.vert(p) for p in points]
    b = [m.vert(Vector(p) + Vector(offset)) for p in points]
    # Explicitly triangulate caps, including non-convex sign pictograms.
    for ids in (list(reversed(a)), b):
        vertices = [Vector(m.vertices[i]) for i in ids]
        lookup = {tuple(v): i for v, i in zip(vertices, ids)}
        for triangle in tessellate_polygon([vertices]):
            m.face([ids[v] if isinstance(v, int) else lookup[tuple(v)] for v in triangle], color)
    for i in range(len(a)):
        j = (i + 1) % len(a)
        m.face((a[i], a[j], b[j], b[i]), color)


def beam(m, a, b, width=0.1, color=TIMBER):
    m.tube([a, b], width / math.sqrt(2), color, n=4)


def move_part(m, start, center, yaw=0, scale=1):
    co, si = math.cos(yaw), math.sin(yaw)
    for i in range(start, len(m.vertices)):
        x, y, z = m.vertices[i]
        m.vertices[i] = (center[0] + scale * (x * co - y * si),
                         center[1] + scale * (x * si + y * co), center[2] + scale * z)


def crate(m, center, size=0.45):
    m.box(center, (size, size * 0.86, size), WOOD)
    x, y, z = center
    for dx in (-size * 0.4, size * 0.4):
        m.box((x + dx, y - size * 0.44, z), (0.045, 0.025, size * 1.03), EDGE)
    for dz in (-size * 0.4, size * 0.4):
        m.box((x, y - size * 0.44, z + dz), (size, 0.025, 0.045), EDGE)
    beam(m, (x - size * 0.38, y - size * 0.46, z - size * 0.34),
         (x + size * 0.38, y - size * 0.46, z + size * 0.34), 0.055, EDGE)


def barrel(m, center, radius=0.23, height=0.57):
    m.lathe(center, [(0, radius * 0.82), (height * 0.15, radius),
                    (height * 0.75, radius), (height, radius * 0.83)], WOOD, n=10, jitter=0.025)
    for z in (height * 0.17, height * 0.8):
        m.ring((center[0], center[1], center[2] + z), radius * 1.01, 0.022, IRON, n=10)


def pot(m, center, color, size=1):
    m.lathe(center, [(0, .065 * size), (.04 * size, .10 * size),
                    (.18 * size, .11 * size), (.24 * size, .055 * size),
                    (.28 * size, .065 * size)], color, n=8, jitter=.04)


def lantern(m, center, size=1):
    x, y, z = center
    m.lathe((x, y, z), [(0, .11 * size), (.025 * size, .13 * size),
                      (.04 * size, .12 * size)], IRON, n=6, jitter=0)
    m.lathe((x, y, z + .18 * size), [(0, .125 * size), (.06 * size, .14 * size),
                      (.11 * size, .06 * size)], IRON, n=6, jitter=0)
    # Exposed glass between separate caps (not hidden inside a metal solid).
    start = len(m.faces)
    m.lathe((x, y, z + .04 * size), [(0, .105 * size), (.14 * size, .105 * size)], GLOW, n=6, jitter=0)
    m.glows[start:] = [True] * (len(m.faces) - start)
    for dx in (-.075, .075):
        beam(m, (x + dx * size, y - .085 * size, z + .035 * size),
             (x + dx * size, y - .075 * size, z + .21 * size), .026 * size, IRON)
    m.ring((x, y, z + .32 * size), .047 * size, .012 * size, IRON, n=8, vertical=True)


def gable(m, x, y, w, d, eave, ridge, color=CREAM):
    solid(m, [(x - w / 2, y - d / 2, eave), (x + w / 2, y - d / 2, eave),
              (x, y - d / 2, ridge)], (0, d, 0), color)


def roof(m, x, y, w, d, eave, ridge, colors, rows=4, columns=6):
    """Broad overlapping faceted shingles; deliberately coarse at game scale."""
    half = w / 2 + .22
    front, back = y - d / 2 - .23, y + d / 2 + .23
    for side in (-1, 1):
        for row in range(rows):
            a, b = row / rows, min(1, (row + 1) / rows + .025)
            for col in range(columns):
                ya = front + (back - front) * col / columns
                yb = front + (back - front) * (col + 1) / columns
                # Upper shingles sit above the next row; no coplanar overlap.
                lift = .06 + (rows - row) * .018
                za = ridge + (eave - ridge) * a + lift
                zb = ridge + (eave - ridge) * b + lift
                solid(m, [(x + side * half * a, ya, za), (x + side * half * b, ya, zb),
                          (x + side * half * b, yb, zb), (x + side * half * a, yb, za)],
                      (0, 0, -.055), colors[(col + row * 2) % len(colors)])
        for yy in (front - .012, back + .012):
            beam(m, (x, yy, ridge + .08), (x + side * half, yy, eave + .05), .1, TIMBER)
        beam(m, (x + side * half, front, eave), (x + side * half, back, eave), .11, TIMBER)
    beam(m, (x, front - .03, ridge + .10), (x, back + .03, ridge + .10), .13, colors[1])


def foundation(m, w, d, x=0, y=0):
    m.box((x, y, .11), (w + .12, d + .12, .22), STONE_DARK)
    # Irregular light stone blocks: a small accent band, not a noisy texture.
    for i in range(max(3, int(w / .48))):
        xx = x - w / 2 + .24 + i * .48
        m.box((xx, y - d / 2 - .075, .14), (.42, .075, .17), STONE, jitter=.01)


def house(m, w, d, eave, ridge, colors, plaster=CREAM, x=0, y=0):
    foundation(m, w, d, x, y)
    m.box((x, y, (eave + .2) / 2), (w, d, eave - .2), plaster)
    gable(m, x, y, w, d, eave, ridge, plaster)
    for xx in (x - w / 2, x + w / 2):
        for yy in (y - d / 2, y + d / 2):
            beam(m, (xx, yy, .18), (xx, yy, eave), .16)
    for z in (.3, eave):
        for yy in (y - d / 2 - .018, y + d / 2 + .018):
            m.box((x, yy, z), (w + .13, .14, .16), TIMBER)
        for xx in (x - w / 2 - .018, x + w / 2 + .018):
            m.box((xx, y, z), (.14, d, .16), TIMBER)
    for yy in (y - d / 2 - .05, y + d / 2 + .05):
        beam(m, (x - w / 2, yy, eave), (x, yy, ridge), .13)
        beam(m, (x + w / 2, yy, eave), (x, yy, ridge), .13)
        beam(m, (x, yy, eave), (x, yy, ridge), .13)
    roof(m, x, y, w, d, eave, ridge, colors)


def door(m, x, y, z=.22, w=.72, h=1.35):
    m.box((x, y - .035, z + h / 2), (w + .15, .10, h + .12), TIMBER)
    for i in range(5):
        m.box((x + w * ((i + .5) / 5 - .5), y - .10, z + h / 2),
              (w / 5 - .018, .06, h), WOOD if i % 2 else EDGE)
    for dz in (.24, h - .24):
        m.box((x, y - .145, z + dz), (w * .95, .035, .06), IRON)
    m.ring((x + w * .30, y - .17, z + h * .48), .043, .012, BRASS, n=8, vertical=True)
    m.box((x, y - .24, .10), (w + .24, .48, .20), STONE)


def window(m, x, y, z, w=.58, h=.65, flower=False):
    m.box((x, y - .045, z), (w + .14, .11, h + .14), TIMBER)
    m.box((x, y - .108, z), (w, .03, h), GLASS)
    m.glows[-4] = 2   # (its outer pane, the box's -Y face: lit at night)
    for dx in (-w * .27, w * .27):
        m.box((x + dx, y - .13, z), (.035, .04, h), CREAM)
    m.box((x, y - .13, z), (w, .04, .04), CREAM)
    for s in (-1, 1):
        m.box((x + s * (w / 2 + .14), y - .08, z), (.16, .085, h), WOOD)
        for dz in (-h * .3, h * .3):
            m.box((x + s * (w / 2 + .14), y - .13, z + dz), (.16, .025, .04), EDGE)
    m.box((x, y - .15, z - h / 2 - .09), (w + .26, .24, .1), EDGE)
    if flower:
        m.box((x, y - .23, z - h / 2 - .17), (w + .12, .22, .18), WOOD)
        for i in range(5):
            xx = x + (i - 2) * w / 5
            m.blob((xx, y - .24, z - h / 2), (.10, .09, .11), '#659449', n=5)
            m.blob((xx, y - .29, z - h / 2 + .06), (.044, .04, .043),
                   '#dca184' if i % 2 else '#e7cf7d', n=5)


def sign(m, center, kind, color, size=1):
    """Thick hanging plaque with a large, raised pictogram in its front face."""
    x, y, z = center
    w, h = .73 * size, .59 * size
    beam(m, (x + w / 2 + .13, y + .08, z + h),
         (x - w / 2 - .08, y + .08, z + h), .09, TIMBER)
    beam(m, (x + w / 2 + .13, y + .08, z + .18),
         (x + w / 2 + .13, y + .08, z + h), .09, TIMBER)
    for dx in (-w * .3, w * .3):
        beam(m, (x + dx, y, z + h / 2), (x + dx, y, z + h), .028, IRON)
    m.box(center, (w + .08, .10, h + .08), EDGE)
    m.box((x, y - .064, z), (w, .035, h), color)
    start = len(m.vertices)
    iy = -.09
    if kind == 'bed':
        m.box((0, iy, -.05), (.50, .065, .11), CREAM)
        for xx in (-.23, .23):
            m.box((xx, iy, -.06), (.05, .07, .30), CREAM)
        m.box((-.135, iy - .025, .055), (.12, .065, .09), CREAM)
        # Separate small healing cross in the top corner.
        m.box((.15, iy, .16), (.14, .05, .043), CREAM)
        m.box((.15, iy, .16), (.043, .05, .14), CREAM)
    elif kind == 'paw':
        m.blob((0, iy - .018, -.07), (.15, .045, .115), CREAM, n=7)
        for xx, zz in ((-.20, .06), (-.08, .16), (.08, .16), (.20, .06)):
            m.blob((xx, iy - .025, zz), (.058, .035, .075), CREAM, n=6)
    elif kind == 'horse':
        outline = [(-.20, iy, -.18), (.13, iy, -.18), (.17, iy, -.07),
                   (.06, iy, .02), (.22, iy, .07), (.18, iy, .18),
                   (.04, iy, .21), (.01, iy, .30), (-.07, iy, .18),
                   (-.16, iy, .12), (-.21, iy, -.03)]
        # Non-convex silhouette is explicitly triangulated by solid().
        solid(m, outline, (0, -.025, 0), CREAM)
        m.blob((.105, iy - .035, .14), (.019, .012, .02), TIMBER, n=5)
    elif kind == 'anvil':
        solid(m, [(-.26, iy, .13), (.27, iy, .13), (.20, iy, .015),
                  (.06, iy, -.035), (.06, iy, -.14), (.17, iy, -.19),
                  (-.16, iy, -.19), (-.08, iy, -.12), (-.08, iy, .02),
                  (-.23, iy, .04)], (0, -.035, 0), CREAM)
        beam(m, (-.16, iy - .015, .20), (-.03, iy - .015, .31), .034, BRASS)
    elif kind == 'coin':
        m.lathe((0, iy, 0), [(0, .17), (.035, .17)], BRASS, n=10, jitter=0, axis=(0, -1, 0))
        m.ring((0, iy - .04, 0), .12, .012, EDGE, n=10, vertical=True)
    elif kind == 'potion':
        m.box((0, iy, .15), (.085, .06, .13), CREAM)
        m.blob((0, iy, -.06), (.15, .055, .16), CREAM, n=7)
        m.box((0, iy - .04, .20), (.13, .05, .05), BRASS)
    elif kind == 'leaf':
        m.leaf((-.15, iy, -.18), (.18, iy, .19), .16, CREAM)
        beam(m, (-.13, iy - .06, -.13), (.12, iy - .06, .14), .025, EDGE)
    move_part(m, start, center, scale=size)


def build_tent(m, v):
    w, d = 2.7 + .12 * v, 2.25
    eave, ridge = 1.78 + .035 * v, 2.55 + .06 * v
    accent = ['#b78e49', '#7b8a62', '#a86450'][v]
    cloth = '#e3d3af'
    # Thin solid canvas roof with slightly hanging edges and broad stripes.
    half, front, back = w / 2 + .20, -d / 2 - .38, d / 2 + .15
    for i in range(10):
        xa, xb = -half + i * half / 5, -half + (i + 1) * half / 5
        za, zb = ridge - abs(xa) / half * (ridge - eave), ridge - abs(xb) / half * (ridge - eave)
        color = accent if i % 2 else cloth
        solid(m, [(xa, front, za), (xb, front, zb), (xb, back, zb), (xa, back, za)], (0, 0, -.035), color)
        # Five-point canvas valance; each stripe ends in a broad scallop.
        solid(m, [(xa, front, za), (xb, front, zb), (xb, front, zb - .14),
                  ((xa + xb) / 2, front, (za + zb) / 2 - .23), (xa, front, za - .14)],
              (0, .028, 0), color)
    beam(m, (0, front, ridge + .025), (0, back, ridge + .025), .075, EDGE)
    for xx in (-w / 2, w / 2):
        for yy in (front + .05, d / 2):
            beam(m, (xx, yy, 0), (xx, yy, eave + .06), .095, TIMBER)
            m.lathe((xx, yy, eave + .06), [(0, .085), (.09, .06), (.15, 0)], BRASS, n=6, jitter=0)
    # Closed back and rear side curtains; open frontage keeps the stock readable.
    solid(m, [(-w / 2, d / 2, .10), (w / 2, d / 2, .10), (w / 2, d / 2, eave),
              (0, d / 2, ridge), (-w / 2, d / 2, eave)], (0, .035, 0), cloth)
    for s in (-1, 1):
        m.box((s * w / 2, .50, .94), (.035, 1.23, 1.68), accent)
        # Gathered front fabric tied to the pole.
        solid(m, [(s * w / 2, front + .12, eave), (s * (w / 2 - .34), front + .12, eave - .12),
                  (s * (w / 2 - .09), front + .12, .68), (s * w / 2, front + .12, .45)],
              (0, .05, 0), cloth)
        beam(m, (s * (w / 2 - .12), front + .08, .74), (s * (w / 2 + .04), front + .08, .74), .045, EDGE)
    m.box((0, -.77, .47), (w - .30, .60, .82), WOOD)
    for i in range(9):
        xx = (i - 4) * (w - .30) / 9
        m.box((xx, -1.085, .45), ((w - .30) / 9 - .016, .035, .75), EDGE if i % 3 == 0 else WOOD)
    m.box((0, -.78, .91), (w - .17, .69, .10), EDGE)
    # A small draped front banner, same canvas family as the roof.
    m.box((.10, -1.13, .63), (.61, .028, .47), accent)
    if v == 0:
        for x in (-.70, -.30):
            crate(m, (x, -.77, 1.10), .30)
            for i in range(3):
                m.blob((x + (i - 1) * .085, -.81, 1.29), (.052, .05, .06), '#b16443', n=6)
        for x in (.18, .45, .72):
            pot(m, (x, -.75, .96), '#b77b53', .8 + x * .35)
        barrel(m, (w / 2 + .18, .25, 0), .23)
        kind = 'coin'
    elif v == 1:
        for i in range(4):
            x = -.78 + i * .40
            pot(m, (x, -.78, .96), '#997b57', .8)
            for j in range(2):
                m.leaf((x, -.78, 1.14), (x + (-1 if j else 1) * .13, -.76, 1.42 + .08 * (i % 2)), .075, '#659449')
        crate(m, (-w / 2 - .05, .45, .24), .48)
        kind = 'leaf'
    else:
        for i in range(6):
            x = -.88 + i * .33
            col = ['#688a87', '#a27793', '#b69a54'][i % 3]
            pot(m, (x, -.78, .96), col, .65 + .12 * (i % 3))
            m.box((x, -.78, 1.15 + .034 * (i % 3)), (.055, .055, .055), WOOD)
        crate(m, (w / 2 + .09, .45, .24), .48)
        kind = 'potion'
    # Rear shelf and bundled supplies, visible between canopy and counter.
    m.box((0, .74, .92), (w - .25, .31, .09), EDGE)
    for i in range(3):
        m.blob((-.72 + i * .68, .65, 1.13), (.17, .14, .19), '#bcab83', n=7)
    lantern(m, (-w / 2 + .10, front + .13, 1.36), .72)
    sign(m, (.55, front - .04, 1.45), kind, accent, .58)


def build_inn(m, v):
    w, d, eave, ridge = 3.55, 2.9, 3.28, 4.43
    house(m, w, d, eave, ridge, ROOF_BLUE)
    front = -d / 2
    # Overhanging upper floor band and asymmetric braced timber framing.
    m.box((0, front - .06, 1.88), (w + .15, .20, .20), TIMBER)
    m.box((w / 2 + .055, 0, 1.88), (.20, d, .20), TIMBER)
    for x in (-1.15, .05, 1.12):
        beam(m, (x, front - .07, 1.9), (x, front - .07, eave), .11)
    for x in (-1.72, 1.15):
        beam(m, (x, front - .08, 1.98), (x + .5, front - .08, 2.57), .09)
    for yy in (-.72, .72):
        beam(m, (w / 2 + .035, yy, .30), (w / 2 + .035, yy, eave), .12)
        beam(m, (w / 2 + .045, yy - .55, 1.95), (w / 2 + .045, yy, 2.55), .09)
    door(m, -.28, front, w=.80, h=1.38)
    window(m, -1.18, front, 1.05, .52, .68)
    window(m, 1.02, front, 1.05, .62, .68)
    for x in (-.66, .68):
        window(m, x, front, 2.62, .61, .69, flower=True)
    # Side windows (rotate a front-oriented detail into the +X wall).
    for yy in (-.69, .70):
        start = len(m.vertices)
        window(m, 0, 0, 2.62, .53, .65)
        move_part(m, start, (w / 2, yy, 0), math.pi / 2)
    # Small pitched entrance porch, warm light and resting bench.
    roof(m, -.28, front - .37, 1.2, .65, 1.64, 1.98, ROOF_BLUE, rows=2, columns=2)
    for x in (-.93, .37):
        beam(m, (x, front - .79, .1), (x, front - .79, 1.67), .11)
    lantern(m, (.62, front - .23, 1.48), .8)
    sign(m, (-1.44, front - .34, 1.85), 'bed', '#536b75', .96)
    m.box((1.12, front - .51, .40), (.95, .40, .1), EDGE)
    m.box((1.12, front - .28, .65), (.95, .09, .35), WOOD)
    for x in (.77, 1.48):
        m.box((x, front - .51, .21), (.09, .32, .38), TIMBER)
    barrel(m, (-w / 2 - .28, .43, 0))
    # Stone chimney offset from ridge, with a visible black chimney opening.
    x, y = 1.05, .55
    m.box((x, y, 3.62), (.43, .44, 2.13), STONE_DARK)
    for z in (3.80, 4.16, 4.53):
        m.box((x - .03, y - .235, z), (.30, .055, .17), STONE)
    m.box((x, y, 4.70), (.57, .56, .14), STONE)
    m.box((x, y, 4.78), (.32, .31, .018), DARK)


def fence(m, a, b, posts=3, height=.77, skip_first=False):
    a, b = Vector(a), Vector(b)
    for i in range(int(skip_first), posts):
        p = a.lerp(b, i / (posts - 1))
        m.box((p.x, p.y, height / 2), (.12, .12, height), TIMBER)
        m.lathe((p.x, p.y, height), [(0, .085), (.10, 0)], EDGE, n=4, jitter=0, phase=math.pi / 4)
    for z in (height * .39, height * .80):
        beam(m, (a.x, a.y, z), (b.x, b.y, z), .085, EDGE)


def horse(m, center, color, yaw=0):
    """Small faceted horse peering out of a stall; static decorative geometry."""
    start = len(m.vertices)
    m.blob((0, .12, .80), (.23, .44, .28), color, n=8, jitter=.04)
    for x in (-.15, .15):
        for y in (-.14, .40):
            beam(m, (x, y, .10), (x, y, .74), .085, color)
            m.box((x, y, .055), (.105, .13, .11), DARK)
    m.tube([(0, -.19, .80), (0, -.35, 1.13)], [.18, .12], color, n=7)
    m.blob((0, -.45, 1.19), (.15, .24, .16), color, n=8, jitter=.03)
    m.blob((0, -.65, 1.11), (.135, .13, .10), '#bca383', n=6, jitter=.02)
    for x in (-.083, .083):
        m.leaf((x, -.33, 1.29), (x, -.30, 1.51), .055, color)
        m.blob((x * 1.64, -.45, 1.24), (.026, .026, .025), DARK, n=5)
    m.tube([(0, -.25, 1.25), (0, -.11, 1.02), (0, .12, .91)], [.07, .06, .025], TIMBER, n=5)
    m.tube([(0, .49, .90), (.03, .71, .44)], [.05, .025], TIMBER, n=5)
    # Halter straps.
    beam(m, (-.14, -.52, 1.18), (.14, -.52, 1.18), .035, EDGE)
    move_part(m, start, center, yaw)


def build_stable(m, v):
    w, d, eave, ridge = 3.85, 2.5, 2.06, 3.10
    foundation(m, w, d)
    m.box((0, d / 2, 1.09), (w, .13, 1.88), WOOD)
    for s in (-1, 1):
        m.box((s * w / 2, .27, 1.08), (.13, d - .55, 1.86), WOOD)
    gable(m, 0, 0, w, d, eave, ridge, '#a58a60')
    for yy in (-d / 2 - .04, d / 2 + .04):
        for xx in (-w / 2, -w / 6, w / 6, w / 2):
            beam(m, (xx, yy, .13), (xx, yy, eave + .02), .16)
        beam(m, (-w / 2, yy, eave), (w / 2, yy, eave), .17)
        for s in (-1, 1):
            beam(m, (s * w / 2, yy, eave), (0, yy, ridge), .15)
            beam(m, (s * w / 2, yy, eave - .46), (s * (w / 2 - .44), yy, eave), .11)
    roof(m, 0, 0, w, d, eave, ridge, ROOF_RED)
    front = -d / 2
    for xx in (-w / 6, w / 6):
        m.box((xx, -.07, .60), (.08, 2.05, .85), TIMBER)
    for i in range(3):
        x = (i - 1) * w / 3
        # Stall half-doors keep heads visible.
        for j in range(5):
            m.box((x + (j - 2) * .215, front - .05, .47), (.20, .08, .66), WOOD)
        for z in (.25, .67):
            m.box((x, front - .11, z), (1.08, .06, .08), EDGE)
        beam(m, (x - .48, front - .14, .23), (x + .48, front - .14, .67), .065, TIMBER)
        if i < 2:
            horse(m, (x, -.59, .20), '#916547' if i == 0 else '#c4b698', yaw=(-.07 if i else .09))
        else:
            for j in range(2):
                m.box((x, .13 + j * .5, .40), (.70, .43, .38), HAY, jitter=.018)
                m.box((x, .13 + j * .5, .41), (.055, .44, .4), '#948252')
    sign(m, (.0, front - .24, 2.22), 'horse', '#8c6746', .95)
    # Hitching rail and trough, in front of the stalls.
    fence(m, (-1.67, -2.08, 0), (.02, -2.08, 0), posts=2)
    m.box((1.24, -1.90, .30), (.98, .48, .38), WOOD)
    m.box((1.24, -1.90, .50), (.83, .34, .025), '#638585')
    barrel(m, (-w / 2 - .27, .38, 0), .22)
    lantern(m, (w / 2 - .17, front - .12, 1.35), .72)


def kennel(m, center, color):
    x, y, z = center
    m.box((x, y, z + .31), (.71, .70, .62), WOOD)
    gable(m, x, y, .71, .70, z + .61, z + .92, WOOD)
    roof(m, x, y, .71, .70, z + .60, z + .91, [color] * 3, rows=2, columns=2)
    # Deep shadowed entrance silhouette and raised trim.
    m.box((x, y - .361, z + .21), (.32, .035, .42), DARK)
    m.blob((x, y - .381, z + .42), (.16, .026, .11), DARK, n=8, jitter=0)
    for dx in (-.195, .195):
        m.box((x + dx, y - .39, z + .23), (.055, .055, .46), EDGE)


def rabbit(m, center):
    x, y, z = center
    m.blob((x, y, z + .13), (.15, .17, .13), '#d9d0b5', n=7)
    m.blob((x, y - .12, z + .23), (.10, .095, .10), '#e6dfcb', n=7)
    for dx in (-.043, .043):
        m.blob((x + dx, y - .07, z + .40), (.033, .035, .16), '#d9d0b5', n=6)
        m.blob((x + dx, y - .183, z + .253), (.013, .014, .014), DARK, n=5)
    m.blob((x, y + .15, z + .13), (.057, .05, .055), CREAM, n=6)


def cat(m, center):
    x, y, z = center
    col = '#c39660'
    m.blob((x, y, z + .17), (.13, .11, .19), col, n=7)
    m.blob((x, y - .025, z + .39), (.13, .115, .115), col, n=7)
    for dx in (-.08, .08):
        m.lathe((x + dx, y - .015, z + .46), [(0, .066), (.15, 0)], col, n=4, jitter=0)
        m.blob((x + dx * .63, y - .13, z + .40), (.018, .015, .021), DARK, n=5)
    m.tube([(x + .10, y + .05, z + .12), (x + .24, y + .10, z + .15),
            (x + .29, y + .10, z + .34)], [.045, .035, .022], col, n=5)


def build_pet_shop(m, v):
    w, d, eave, ridge = 2.6, 2.35, 2.16, 3.14
    house(m, w, d, eave, ridge, ROOF_GREEN, '#d6caaa')
    front = -d / 2
    door(m, -.53, front, w=.63, h=1.25)
    window(m, .65, front, 1.20, .65, .68, flower=True)
    # A side window on -X, behind the bird perch.
    start = len(m.vertices)
    window(m, 0, 0, 1.25, .5, .56)
    move_part(m, start, (-w / 2, .62, 0), -math.pi / 2)
    sign(m, (.10, front - .24, 2.20), 'paw', '#637650', .92)
    # Canvas porch over the pet pen: simple chunky striped green/cream lean-to.
    for i in range(6):
        xa, xb = -1.46 + i * .49, -1.46 + (i + 1) * .49
        solid(m, [(xa, front - .06, 1.87), (xb, front - .06, 1.87),
                  (xb, front - .86, 1.65), (xa, front - .86, 1.65)], (0, 0, -.035),
              '#849366' if i % 2 else CREAM)
    for x in (-1.40, 1.40):
        beam(m, (x, front - .85, .03), (x, front - .85, 1.71), .09)
    lantern(m, (-1.04, front - .20, 1.28), .65)
    # Small outside kennels, pet bowls, and enclosed rabbit pen.
    kennel(m, (1.84, -.33, .02), '#6c7e55')
    kennel(m, (1.84, .61, .02), '#6c7e55')
    cat(m, (1.82, -.73, .02))
    fence(m, (.20, -2.06, 0), (1.35, -2.06, 0), posts=3, height=.55)
    fence(m, (1.35, -2.06, 0), (1.35, -1.36, 0), posts=2, height=.55, skip_first=True)
    rabbit(m, (.55, -1.71, .02))
    rabbit(m, (.96, -1.65, .02))
    for x, y in ((1.78, -.97), (.32, -1.94)):
        m.lathe((x, y, .02), [(0, .12), (.08, .16), (.08, .11), (.035, .085)], '#997b57', n=8, jitter=0)
    # Side-wall bird perch, framed like the existing timber props.
    beam(m, (-1.52, .14, .03), (-1.52, .14, 1.31), .09)
    beam(m, (-1.77, .14, 1.24), (-1.27, .14, 1.24), .07, EDGE)
    m.blob((-1.59, .13, 1.40), (.07, .08, .14), '#829c8c', n=6)
    m.blob((-1.59, .08, 1.54), (.07, .07, .06), '#829c8c', n=6)
    m.leaf((-1.59, -.0, 1.53), (-1.59, -.10, 1.51), .035, HAY)


def anvil(m, center):
    x, y, z = center
    m.lathe((x, y, z), [(0, .22), (.36, .19)], WOOD, n=8, jitter=.06)
    m.box((x, y, z + .41), (.38, .31, .10), IRON)
    m.box((x, y, z + .51), (.20, .22, .15), IRON)
    m.box((x, y, z + .63), (.48, .29, .12), '#778083')
    solid(m, [(x - .23, y - .13, z + .58), (x - .23, y + .13, z + .58),
              (x - .56, y + .015, z + .68), (x - .56, y - .015, z + .68)],
          (0, 0, .065), '#778083')
    m.box((x + .17, y, z + .699), (.065, .065, .007), DARK)


def build_blacksmith(m, v):
    w, d, eave, ridge = 2.5, 2.5, 2.14, 3.15
    house(m, w, d, eave, ridge, ROOF_RED, '#ada99c', x=-.75)
    front = -d / 2
    door(m, -1.30, front, w=.65, h=1.28)
    window(m, -.25, front, 1.25, .48, .56)
    # A side window on -X, over the crate.
    start = len(m.vertices)
    window(m, 0, 0, 1.25, .48, .56)
    move_part(m, start, (-.75 - w / 2, -.05, 0), -math.pi / 2)
    sign(m, (-1.26, front - .30, 2.21), 'anvil', '#65574c', .95)
    # Lean-to workshop on +X: front open, stone forge against back wall.
    x0, x1, yf, yb = .5, 2.55, -.35, 1.25
    for i in range(5):
        ya, ye = yf + (yb - yf) * i / 5, yf + (yb - yf) * (i + 1) / 5
        solid(m, [(x0, ya, 2.00), (x1, ya, 1.70), (x1, ye, 1.70), (x0, ye, 2.00)],
              (0, 0, -.085), ROOF_RED[i % 3])
    for yy in (yf, yb):
        beam(m, (x1 - .08, yy, 0), (x1 - .08, yy, 1.73), .15)
        beam(m, (x0, yy, 2.0), (x1, yy, 1.70), .13)
    m.box((1.40, 1.19, .82), (1.80, .13, 1.64), STONE_DARK)
    m.box((1.22, .80, .37), (1.10, .77, .74), STONE_DARK)
    m.box((1.22, .76, .74), (1.22, .88, .13), STONE)
    # Two stone cheeks and lintel leave an actually recessed orange furnace mouth.
    for xx in (.74, 1.70):
        m.box((xx, .80, 1.10), (.20, .68, .63), STONE)
    m.box((1.22, .80, 1.38), (1.14, .68, .22), STONE_DARK)
    start = len(m.faces)
    m.box((1.22, 1.055, 1.06), (.80, .07, .46), '#ffb65e')
    m.box((1.22, .73, .865), (.71, .44, .09), '#ffb65e')
    for i in range(5):
        m.shard((.97 + i * .12, .72, .90), .060, .13 + .06 * (i % 3), '#ffb65e', n=5, glow=True)
    m.glows[start:] = [True] * (len(m.faces) - start)
    # Coal nuggets at the front lip.
    for i in range(5):
        m.blob((.96 + i * .13, .51, .86), (.063, .064, .048), DARK, n=5)
    # Tall stepped forge chimney: distinctive readable silhouette.
    m.box((1.22, .88, 2.32), (.72, .64, 1.85), STONE_DARK)
    m.box((1.22, .88, 3.27), (.86, .78, .16), STONE)
    m.box((1.22, .88, 3.36), (.43, .36, .025), DARK)
    for zz in (1.7, 2.05, 2.40, 2.75, 3.07):
        m.box((1.14 + .05 * (int(zz * 10) % 2), .547, zz), (.38, .035, .13), STONE)
    anvil(m, (1.25, -.76, .01))
    # Hammer resting across the anvil, tongs, bellows and a quench tub.
    beam(m, (1.18, -.78, .71), (1.50, -.87, .71), .055, EDGE)
    m.box((1.14, -.76, .74), (.13, .21, .13), IRON)
    barrel(m, (2.17, -.45, 0), .24, .50)
    m.lathe((2.17, -.45, .51), [(0, .195), (.005, .195)], '#6d8c91', n=10, jitter=0)
    m.blob((1.95, .60, .69), (.34, .23, .09), '#77533e', n=6, jitter=0)
    beam(m, (1.67, .58, .68), (1.52, .58, .84), .065, IRON)
    for xx in (2.1, 2.26):
        beam(m, (xx, 1.10, .80), (xx, 1.10, 1.36), .025, IRON)
    crate(m, (-2.22, .66, .23), .45)
    lantern(m, (-.81, front - .17, 1.35), .65)


SPECS = [
    ('town_merchant_a', build_tent, 0, 'merchant', 'provisions'),
    ('town_merchant_b', build_tent, 1, 'merchant', 'herbs'),
    ('town_merchant_c', build_tent, 2, 'merchant', 'potions'),
    ('town_inn_a', build_inn, 0, 'inn', 'sleep_heal'),
    ('town_stable_a', build_stable, 0, 'stable', 'horses'),
    ('town_pet_shop_a', build_pet_shop, 0, 'pet_shop', 'pets'),
    ('town_blacksmith_a', build_blacksmith, 0, 'blacksmith', 'equipment'),
]


def build(scene=None):
    scene = scene or bpy.context.scene
    collection = bpy.data.collections.get(COLLECTION) or bpy.data.collections.new(COLLECTION)
    if collection.name not in scene.collection.children:
        scene.collection.children.link(collection)
    objects = []
    for name, builder, variant, service, stock in SPECS:
        seed = SEED + int.from_bytes(hashlib.sha256(name.encode()).digest()[:8], 'big')
        m = props.Mesh(random.Random(seed))
        builder(m, variant)
        obj = props.finish(m, name, 'ground', {'max_radius': None, 'blocking': True,
                           'light': GLOW, 'intensity': 1.5 if service == 'blacksmith' else .7}, collection)
        # Keep the ordinary props material; export can share it with terrain props.
        obj['cube_crawler_town'] = True
        obj['service'] = service
        obj['stock'] = stock
        obj['units'] = 'cells'
        obj['front'] = '+Z'  # exported glTF axis, NOT Blender authoring axis
        obj['sway'] = 0.0
        obj['variant'] = chr(97 + variant)
        objects.append(obj)
    return objects


def validate(objects):
    report = []
    assert len(objects) == 7 and len({o.name for o in objects}) == 7
    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        lo = [min(v.co[i] for v in mesh.vertices) for i in range(3)]
        hi = [max(v.co[i] for v in mesh.vertices) for i in range(3)]
        assert abs(lo[2]) < 1e-6, (obj.name, lo)
        assert tuple(obj.scale) == (1, 1, 1) and tuple(obj.rotation_euler) == (0, 0, 0)
        assert obj.parent is None and not obj.modifiers and not mesh.uv_layers
        assert not any(p.use_smooth for p in mesh.polygons)
        assert props.COLOR_ATTRIBUTE in mesh.color_attributes
        assert 300 <= len(mesh.loop_triangles) <= 6500, (obj.name, len(mesh.loop_triangles))
        assert all(math.isfinite(c) for v in mesh.vertices for c in v.co)
        for tri in mesh.loop_triangles:
            a, b, c = (mesh.vertices[i].co for i in tri.vertices)
            assert (b - a).cross(c - a).length > 1e-10, obj.name
        assert len(mesh.materials) in (2, 3) and any(p.material_index == 1 for p in mesh.polygons)
        # the houses' windows: their panes the third material (lit at night)
        assert (len(mesh.materials) == 3) == any(p.material_index == 2 for p in mesh.polygons), obj.name
        if len(mesh.materials) == 3:
            assert mesh.materials[2].name == obj.name + '_window', obj.name
        # Collision/placement hints include props; not a replacement for proper colliders.
        obj['footprint'] = [round(hi[0] - lo[0], 4), round(hi[1] - lo[1], 4)]
        obj['height'] = round(hi[2], 4)
        report.append({'name': obj.name, 'service': obj['service'], 'stock': obj['stock'],
                       'triangles': len(mesh.loop_triangles), 'size': [round(b - a, 3) for a, b in zip(lo, hi)],
                       'bounds_blender': [lo, hi], 'radius': obj['radius'], 'front_gltf': '+Z',
                       'glb': f'town/{obj.name}.glb'})
    return report


def export(objects, directory):
    directory = Path(directory).resolve()
    (directory / 'town').mkdir(parents=True, exist_ok=True)
    report = validate(objects)
    props.export_gltf(objects, directory / 'town.glb')
    for obj in objects:
        props.export_gltf([obj], directory / 'town' / (obj.name + '.glb'))
    (directory / 'town' / 'manifest.json').write_text(json.dumps({'units': 'cells', 'up': 'Y',
        'front': '+Z', 'assets': report}, indent=2) + '\n')
    return report


def plain_material(name, color):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*props.linear(color), 1)
    shader.inputs['Roughness'].default_value = .92
    mat.diffuse_color = (*props.linear(color), 1)
    return mat


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def setup_preview(scene, objects):
    """Editable showroom, with seven separated models and a labelled camera view."""
    preview = bpy.data.collections.new('TownPreview_NOT_EXPORTED')
    scene.collection.children.link(preview)

    def link(name, data):
        obj = bpy.data.objects.new(name, data)
        preview.objects.link(obj)
        return obj

    # Back row buildings, front row merchant tents.
    positions = [(-6.0, -4.1, 0), (-1.0, -4.1, 0), (4.0, -4.1, 0),
                 (-8.1, 2.7, 0), (-2.8, 2.7, 0), (2.4, 2.7, 0), (8.1, 2.7, 0)]
    for obj, position in zip(objects, positions):
        obj.location = position
    mesh = bpy.data.meshes.new('PreviewFloor')
    mesh.from_pydata([(-200, -200, -.055), (200, -200, -.055), (200, 200, -.055), (-200, 200, -.055)], [], [(0, 1, 2, 3)])
    mesh.materials.append(plain_material('TownPreviewGround', '#c3c4b0'))
    link('TownPreviewFloor', mesh)
    labels = ['MERCHANT / PROVISIONS', 'MERCHANT / HERBS', 'MERCHANT / POTIONS',
              'INN / REST + HEAL', 'HORSE STABLE', 'PET SHOP', 'BLACKSMITH']
    for obj, label in zip(objects, labels):
        data = bpy.data.curves.new('Label_' + obj.name, 'FONT')
        data.body, data.align_x, data.size, data.extrude = label, 'CENTER', .24, 0
        data.materials.append(plain_material('TownPreviewInk', '#4f554e'))
        text = link('Label_' + obj.name, data)
        text.location = (obj.location.x, obj.location.y - 2.52, -.045)
    cam = link('TownPreviewCamera', bpy.data.cameras.new('TownPreviewCamera'))
    cam.location = (12, -26, 21)
    aim(cam, (0, 0, 1.0))
    cam.data.type, cam.data.ortho_scale = 'ORTHO', 27
    scene.camera = cam
    for name, location, energy, size in [
        ('TownKey', (-6, -10, 16), 2300, 9), ('TownFill', (10, -2, 11), 1500, 10),
        ('TownRim', (1, 9, 14), 2100, 8)]:
        light = link(name, bpy.data.lights.new(name, 'AREA'))
        light.location, light.data.energy, light.data.shape, light.data.size = location, energy, 'DISK', size
        aim(light, (0, 0, 0))
    world = bpy.data.worlds.new('TownPreviewWorld')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.65, .72, .80, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .55
    scene.world = world
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1800, 1150, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    # Material preview also shows vertex colours through the node material.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.shading.type = 'MATERIAL'
                area.spaces.active.region_3d.view_distance = 27
                area.spaces.active.region_3d.view_location = (0, 0, 1)
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.overlay.show_overlays = False
    return preview


def render_previews(scene, objects, preview, directory):
    directory = Path(directory)
    (directory / 'town').mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(directory / 'town-preview.png')
    bpy.ops.render.render(write_still=True)
    cam = scene.camera
    saved = (cam.location.copy(), cam.rotation_euler.copy(), cam.data.ortho_scale)
    labels = [o for o in preview.objects if o.type == 'FONT']
    try:
        for label in labels:
            label.hide_render = True
        scene.render.resolution_x = scene.render.resolution_y = 720
        reports = {r['name']: r for r in validate(objects)}
        for obj in objects:
            for other in objects:
                other.hide_render = other != obj
            lo, hi = [Vector(v) for v in reports[obj.name]['bounds_blender']]
            center = obj.location + Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z * .43))
            cam.location = center + Vector((6.8, -10, 7.2))
            aim(cam, center)
            cam.data.ortho_scale = max(hi.x - lo.x, hi.y - lo.y, hi.z) * 1.70
            scene.render.filepath = str(directory / 'town' / (obj.name + '.png'))
            bpy.ops.render.render(write_still=True)
    finally:
        for obj in objects:
            obj.hide_render = False
        for label in labels:
            label.hide_render = False
        cam.location, cam.rotation_euler, cam.data.ortho_scale = saved
        scene.render.resolution_x, scene.render.resolution_y = 1800, 1150
        scene.render.filepath = str(directory / 'town-preview.png')


def main(directory=None, render=True):
    directory, blends, previews = props.output_dirs(directory)
    scene = bpy.data.scenes.new('TownShowroom')
    if bpy.context.window:
        bpy.context.window.scene = scene
    objects = build(scene)
    report = export(objects, directory)
    preview = setup_preview(scene, objects)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[3]
    bpy.ops.wm.save_as_mainfile(filepath=str(blends / 'town.blend'))
    if render:
        render_previews(scene, objects, preview, previews)
    print(json.dumps(report, indent=2))
    return report


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(args) > 1:
        raise SystemExit('Usage: Blender -b --python blender/town.py -- [output-directory]')
    bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
    main(args[0] if args else None)
