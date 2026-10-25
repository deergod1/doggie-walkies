"""
The glass bird: the first thing she ever made, for her little brother (sister) (docs/story.md).

A plump little songbird of clear, faintly aqua glass, cut in big flat facets like the game's
other low-poly props: a round body sitting flat on the floor, a round head with a short beak,
folded wings and a stubby tail raised behind. Two beads of dark glass for its eyes, and inside
its chest a small amber core that glows (the game lights it). The splash screen shows it, and
it breaks (src/game/splash.js).

It comes already broken: next to the whole bird the file holds the same bird cut into SHARDS
pieces along its facets, each one closed by a fan of fracture faces towards a point inside it.
Put together they make the whole bird again (the splash swaps them in when it is hit). The same
cuts can be glued back with gold for the ending.

Faces -Y in Blender, +Z up; one unit = one game cell. About 0.45 tall, 0.66 from beak to tail.

Objects (exported, glTF +Y up, the bird facing +Z):
    GlassBird          the whole bird: GlassBirdGlass, the eyes GlassBirdEye
    GlassBirdCore      the amber core inside its chest: GlassBirdCore
    GlassBirdShards    an empty, with GlassBirdShard.000 ... : the outside (GlassBirdGlass, an
                       eye's GlassBirdEye) and the fracture faces (GlassBirdBreak)

Headless:
    Blender -b --python blender/glassbird.py -- assets/glassbird.glb blender/glassbird.blend \
        blender/previews/glassbird-preview.png
"""
import math
from pathlib import Path
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import creature as K
import figure as F

NAME, CORE_NAME, SHARDS_NAME = "GlassBird", "GlassBirdCore", "GlassBirdShards"
SCENE, COLLECTION, STAGE = "GlassBird", "GlassBirdAsset", "GlassBirdStage"
V = Vector

GLASS_HEX, EYE_HEX, BREAK_HEX, CORE_HEX = "#bfeee6", "#10161c", "#e4fbf6", "#ffa640"
VOXEL = 0.004
TRIANGLES = 300          # the whole bird's facets
SHARDS = 34              # pieces it breaks into
SEED = 7

# --- body plan ---------------------------------------------------------------------------------
BODY_C, BODY_R = (0, 0.03, 0.165), (0.135, 0.19, 0.152)
HEAD_C, HEAD_R = (0, -0.13, 0.312), (0.1, 0.1, 0.097)
BEAK = ((0, -0.215, 0.31), (0, -0.3, 0.3), 0.03, 0.004)
TAIL_O, TAIL_UP = V((0, 0.19, 0.225)), math.radians(42)
WING_O, WING_DOWN = V((0.118, 0.045, 0.19)), math.radians(20)
EYE_DIR, EYE_R = V((0.74, -0.5, 0.36)).normalized(), 0.021
CORE_C, CORE_R = V((0, 0.0, 0.17)), 0.058


def bird_sdf(P):
    d = K.ellipsoid(P, BODY_C, BODY_R)
    d = K.smax(d, -(P[..., 2] - 0.014), 0.03)                          # it sits flat
    d = K.smin(d, K.ellipsoid(P, HEAD_C, HEAD_R), 0.045)
    d = K.smin(d, K.round_cone(P, *BEAK), 0.016)
    along = (0, math.cos(TAIL_UP), math.sin(TAIL_UP))
    thick = (0, -math.sin(TAIL_UP), math.cos(TAIL_UP))
    tail = K.ellipsoid(K.local(P, TAIL_O, ((1, 0, 0), along, thick)), (0, 0.085, 0), (0.062, 0.115, 0.03))
    d = K.smin(d, tail, 0.045)
    for s in (-1, 1):                                                   # the folded wings
        o = V((s * WING_O.x, WING_O.y, WING_O.z))
        along = (0, math.cos(WING_DOWN), -math.sin(WING_DOWN))
        up = (0, math.sin(WING_DOWN), math.cos(WING_DOWN))
        wing = K.ellipsoid(K.local(P, o, ((1, 0, 0), along, up)), (0, 0.04, 0), (0.036, 0.15, 0.085))
        d = K.smin(d, wing, 0.008)
    return d


def sdf_at(p):
    return float(bird_sdf(np.asarray([tuple(p)], np.float32))[0])


# --- the whole bird ----------------------------------------------------------------------------
def materials():
    out = {}
    for name, hex_color, emission, roughness in (("GlassBirdGlass", GLASS_HEX, 0, 0.04), ("GlassBirdEye", EYE_HEX, 0, 0.08),
                                                 ("GlassBirdBreak", BREAK_HEX, 0, 0.12), ("GlassBirdCore", CORE_HEX, 1.2, 0.4)):
        mat = K.material(name, hex_color, emission, roughness)
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Subsurface Weight"].default_value = 0
        if name in ("GlassBirdGlass", "GlassBirdBreak"):
            bsdf.inputs["Transmission Weight"].default_value = 1
            bsdf.inputs["IOR"].default_value = 1.45
        if name == "GlassBirdEye":
            bsdf.inputs["Specular IOR Level"].default_value = 0.8
        out[name] = mat
    return out


def faceted_shell():
    """The bird's SDF meshed, then collapsed to TRIANGLES big flat facets."""
    me = F._sdf_to_mesh("GlassBirdDense", bird_sdf, (-0.2, -0.33, -0.02), (0.2, 0.4, 0.47), VOXEL)
    obj = bpy.data.objects.new("GlassBirdDense", me)
    bpy.context.scene.collection.objects.link(obj)
    me.calc_loop_triangles()
    mod = obj.modifiers.new("Facets", "DECIMATE")
    mod.decimate_type, mod.use_collapse_triangulate = "COLLAPSE", True
    mod.ratio = TRIANGLES / len(me.loop_triangles)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    low = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph), depsgraph=depsgraph)
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(me)
    bm = bmesh.new()
    bm.from_mesh(low)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    co = np.array([tuple(v.co) for v in bm.verts], np.float64)
    tris = np.array([[v.index for v in f.verts] for f in bm.faces], np.int64)
    bm.free()
    bpy.data.meshes.remove(low)
    return co, tris


def eye_beads():
    """Where the eyes sit (on the head, a little sunk in) and their triangles."""
    beads = []
    for s in (-1, 1):
        d = V((s * EYE_DIR.x, EYE_DIR.y, EYE_DIR.z))
        t = 0.0
        while sdf_at(V(HEAD_C) + d * t) < 0:
            t += 0.001
        beads.append(V(HEAD_C) + d * (t - 0.007))
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=EYE_R)
    co = np.array([tuple(v.co) for v in bm.verts], np.float64)
    tris = np.array([[v.index for v in f.verts] for f in bm.faces], np.int64)
    bm.free()
    return [(np.asarray(tuple(c)) + co * (1, 0.85, 1), tris) for c in beads]


def make_mesh(name, parts, mats, coll):
    """parts: (co, tris, material name); one mesh, flat shaded."""
    me = bpy.data.meshes.new(name)
    names = []
    co_all, tri_all, mat_all, n = [], [], [], 0
    for co, tris, mat in parts:
        if mat not in names:
            names.append(mat)
        co_all.append(co)
        tri_all.append(tris + n)
        mat_all += [names.index(mat)] * len(tris)
        n += len(co)
    me.from_pydata(np.concatenate(co_all).tolist(), [], np.concatenate(tri_all).tolist())
    for m in names:
        me.materials.append(mats[m])
    me.polygons.foreach_set("material_index", np.asarray(mat_all, np.int32))
    bm = bmesh.new()                                                    # parts share their seams
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.to_mesh(me)
    bm.free()
    me.update()
    me.validate()
    me.shade_flat()
    obj = bpy.data.objects.new(name, me)
    coll.objects.link(obj)
    return obj


# --- the shards --------------------------------------------------------------------------------
def clusters(co, tris):
    """Each triangle's shard: k-means over the facets' centres, then every piece made one
    connected patch (a stray island joins the neighbour it shares the most edges with)."""
    a, b, c = co[tris[:, 0]], co[tris[:, 1]], co[tris[:, 2]]
    centre = (a + b + c) / 3
    rng = np.random.default_rng(SEED)
    seeds = [int(rng.integers(len(centre)))]
    dist = np.linalg.norm(centre - centre[seeds[0]], axis=1)
    while len(seeds) < SHARDS:                                          # farthest-point seeds
        seeds.append(int(dist.argmax()))
        dist = np.minimum(dist, np.linalg.norm(centre - centre[seeds[-1]], axis=1))
    means = centre[seeds]
    for _ in range(12):
        label = np.linalg.norm(centre[:, None] - means[None], axis=2).argmin(axis=1)
        means = np.array([centre[label == k].mean(axis=0) if (label == k).any() else means[k] for k in range(SHARDS)])
    edges = {}
    for f, t in enumerate(tris):
        for i in range(3):
            edges.setdefault(tuple(sorted((t[i], t[(i + 1) % 3]))), []).append(f)
    near = [[] for _ in tris]
    for faces in edges.values():
        if len(faces) == 2:
            near[faces[0]].append(faces[1])
            near[faces[1]].append(faces[0])
    for _ in range(4):
        for k in range(SHARDS):
            faces = set(np.flatnonzero(label == k))
            parts = []
            while faces:
                stack, part = [faces.pop()], set()
                while stack:
                    f = stack.pop()
                    part.add(f)
                    for g in near[f]:
                        if g in faces:
                            faces.discard(g)
                            stack.append(g)
                parts.append(part)
            parts.sort(key=len, reverse=True)
            for part in parts[1:]:
                votes = {}
                for f in part:
                    for g in near[f]:
                        if label[g] != k:
                            votes[label[g]] = votes.get(label[g], 0) + 1
                if votes:
                    for f in part:
                        label[f] = max(votes, key=votes.get)
    return label


def fracture_point(co, tris):
    """Where a piece's fracture faces meet: the deepest point under the middle of its patch
    (a thin part, the tail: halfway through it)."""
    a, b, c = co[tris[:, 0]], co[tris[:, 1]], co[tris[:, 2]]
    cross = np.cross(b - a, c - a)
    area = np.linalg.norm(cross, axis=1) / 2
    m = (((a + b + c) / 3) * area[:, None]).sum(axis=0) / area.sum()
    n = cross.sum(axis=0)
    n = n / (np.linalg.norm(n) or 1)
    steps = [m - n * t for t in np.linspace(0, 0.075, 31)]
    depth = bird_sdf(np.asarray(steps, np.float32))
    return steps[int(depth.argmin())]


def shard_parts(co, tris, label, eyes):
    """Each piece: its facets, an eye if it holds one, and its fracture faces."""
    a, b, c = co[tris[:, 0]], co[tris[:, 1]], co[tris[:, 2]]
    centre = (a + b + c) / 3
    eye_of = {}
    for eye_co, eye_tris in eyes:
        mid = eye_co.mean(axis=0)
        eye_of.setdefault(int(label[np.linalg.norm(centre - mid, axis=1).argmin()]), []).append((eye_co, eye_tris))
    pieces = []
    for k in sorted(set(label.tolist())):
        mine = tris[label == k]
        used, local = np.unique(mine), None
        local = {int(v): i for i, v in enumerate(used)}
        outer_co = co[used]
        outer = np.vectorize(local.get)(mine)
        # the edges only one of its facets has: the patch's rim, in the facets' winding
        count = {}
        for t in outer:
            for i in range(3):
                e = (int(t[i]), int(t[(i + 1) % 3]))
                count[e] = count.get(e, 0) + 1
        rim = [e for e in count if (e[1], e[0]) not in count]
        p = fracture_point(outer_co, outer)
        apex = len(outer_co)
        inner = np.array([(e[1], e[0], apex) for e in rim], np.int64)
        parts = [(outer_co, outer, "GlassBirdGlass"), (np.vstack([outer_co, p]), inner, "GlassBirdBreak")]
        parts += [(eye_co, eye_tris, "GlassBirdEye") for eye_co, eye_tris in eye_of.get(k, [])]
        pieces.append(parts)
    return pieces


def build():
    scene = K.creature_scene(SCENE)
    K.clear_collection(COLLECTION)
    coll = K.collection(COLLECTION, scene)
    mats = materials()
    co, tris = faceted_shell()
    eyes = eye_beads()
    bird = make_mesh(NAME, [(co, tris, "GlassBirdGlass")] + [(c, t, "GlassBirdEye") for c, t in eyes], mats, coll)
    bird["style"] = "glass"
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=CORE_R)
    core_co = np.array([tuple(v.co + CORE_C) for v in bm.verts], np.float64)
    core_tris = np.array([[v.index for v in f.verts] for f in bm.faces], np.int64)
    bm.free()
    core = make_mesh(CORE_NAME, [(core_co, core_tris, "GlassBirdCore")], mats, coll)
    shards = bpy.data.objects.new(SHARDS_NAME, None)
    coll.objects.link(shards)
    label = clusters(co, tris)
    pieces = []
    for i, parts in enumerate(shard_parts(co, tris, label, eyes)):
        piece = make_mesh(f"GlassBirdShard.{i:03d}", parts, mats, coll)
        piece.parent = shards
        pieces.append(piece)
    return scene, bird, core, shards, pieces


# --- checks --------------------------------------------------------------------------------------
def validate(bird, pieces):
    """Every piece closed (each edge shared by exactly two of its faces), and all the pieces'
    outsides together are the whole bird's."""
    report = {"triangles": len(bird.data.polygons), "shards": len(pieces), "shard_triangles": 0}
    outside = 0
    for piece in pieces:
        bm = bmesh.new()
        bm.from_mesh(piece.data)
        open_edges = [e for e in bm.edges if len(e.link_faces) != 2]
        bm.free()
        assert not open_edges, f"{piece.name}: {len(open_edges)} open edges"
        glass = piece.data.materials.find("GlassBirdGlass")
        outside += sum(1 for p in piece.data.polygons if p.material_index == glass)
        report["shard_triangles"] += len(piece.data.polygons)
    glass = bird.data.materials.find("GlassBirdGlass")
    whole = sum(1 for p in bird.data.polygons if p.material_index == glass)
    assert outside == whole, f"the shards have {outside} outside facets, the bird {whole}"
    return report


# --- previews ------------------------------------------------------------------------------------
def dark_stage(scene):
    """The splash's look, near enough: black, a narrow light from above, a dark glossy floor."""
    world = bpy.data.worlds.get("GlassBirdDark") or bpy.data.worlds.new("GlassBirdDark")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.005, 0.006, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1
    coll = K.collection("GlassBirdDarkStage", scene)
    me = bpy.data.meshes.new("GlassBirdFloor")
    me.from_pydata([(-6, -6, -0.001), (6, -6, -0.001), (6, 6, -0.001), (-6, 6, -0.001)], [], [(0, 1, 2, 3)])
    floor = K.material("GlassBirdFloor", "#050607", 0, 0.18)
    floor.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0
    me.materials.append(floor)
    coll.objects.link(bpy.data.objects.new("GlassBirdFloor", me))
    for name, loc, energy, size in (("GlassBirdSpot", (0.15, 0.1, 2.4), 260, 0.5), ("GlassBirdRim", (0.4, 1.6, 0.9), 40, 0.8)):
        light = bpy.data.lights.new(name, "SPOT")
        light.energy, light.shadow_soft_size, light.spot_size, light.spot_blend = energy, size, math.radians(32), 0.6
        obj = bpy.data.objects.new(name, light)
        coll.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (V((0, 0, 0.2)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    core_light = bpy.data.lights.new("GlassBirdCoreLight", "POINT")
    core_light.energy, core_light.color, core_light.shadow_soft_size = 0.6, (1, 0.6, 0.25), 0.05
    obj = bpy.data.objects.new("GlassBirdCoreLight", core_light)
    obj.location = CORE_C
    coll.objects.link(obj)
    return world, coll


def preview(scene, bird, core, shards, pieces, path):
    """Two dark shots (the splash's look), the facets on the grey stage from three sides, and
    the shards pulled apart."""
    grey_world, grey_coll = scene.world, bpy.data.collections[STAGE]
    dark_world, dark_coll = dark_stage(scene)
    cam = scene.camera
    cam.data.type, cam.data.lens = "PERSP", 70
    target = V((0, 0.02, 0.2))
    explode = [(p, p.matrix_world.translation.copy()) for p in pieces]
    centre = V((0, 0.02, 0.18))
    mid = {p: V(np.asarray([tuple(v.co) for v in p.data.vertices]).mean(axis=0)) for p in pieces}

    def setup(dark, apart, location):
        scene.world = dark_world if dark else grey_world
        grey_coll.hide_render, dark_coll.hide_render = dark, not dark
        bird.hide_render = apart
        for p in pieces:
            p.hide_render = not apart
            p.location = (mid[p] - centre) * 0.9 if apart else V()
        cam.location = location
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()

    shots = [(True, False, (-2.2, 0.0, 0.42)), (True, False, (-1.5, -1.5, 0.75)),
             (False, False, (-2.2, 0.0, 0.25)), (False, False, (0.0, -2.2, 0.35)),
             (False, False, (-0.8, 0.6, 2.2)), (False, True, (-2.0, -2.0, 1.4))]
    size, cols = 420, 3
    rows = (len(shots) + cols - 1) // cols
    sheet = np.ones((rows * size, cols * size, 4), np.float32)
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.eevee.use_raytracing = True
    with tempfile.TemporaryDirectory(prefix="glassbird-") as directory:
        for i, (dark, apart, location) in enumerate(shots):
            setup(dark, apart, location)
            scene.render.filepath = str(Path(directory) / f"{i}.png")
            bpy.ops.render.render(write_still=True, scene=scene.name)
            img = bpy.data.images.load(scene.render.filepath)
            px = np.array(img.pixels[:], np.float32).reshape(size, size, 4)
            bpy.data.images.remove(img)
            r, c = rows - 1 - i // cols, i % cols
            sheet[r * size:(r + 1) * size, c * size:(c + 1) * size] = px
    setup(False, False, (-2.2, 0.0, 0.25))
    scene.world, dark_coll.hide_render = grey_world, True
    out = bpy.data.images.new("GlassBirdSheet", cols * size, rows * size, alpha=True)
    out.pixels = sheet.ravel()
    out.filepath_raw = str(path)
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    bpy.data.collections.remove(dark_coll)
    return [path]


def export(objects, path):
    path = str(Path(path).resolve())
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    view_layer = bpy.context.view_layer
    for o in view_layer.objects:
        if o is not None:
            o.select_set(False)
    for o in objects:
        o.select_set(True)
    view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, use_active_scene=True,
                              export_yup=True, export_extras=True, export_normals=True, export_texcoords=False,
                              export_animations=False, export_cameras=False, export_lights=False)
    for o in objects:
        o.select_set(False)


def main(export_path=None, blend_path=None, preview_path=None):
    scene, bird, core, shards, pieces = build()
    report = validate(bird, pieces)
    K.setup_stage(scene, "GlassBird", STAGE, (0, 0, 0.2), 0.9, camera=(-2.2, 0.0, 0.25))
    if export_path:
        export([bird, core, shards, *pieces], export_path)
    if blend_path:
        for p in pieces:
            p.hide_set(True)
        K.save_blend(scene, blend_path, (COLLECTION, STAGE), (), "Glass Bird", NAME, (0, 0, 0.2), 1.2)
    if preview_path:
        report["previews"] = [str(p) for p in preview(scene, bird, core, shards, pieces, preview_path)]
    print("Glass bird:", report)
    return bird, report


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    root = Path(__file__).resolve().parent
    main(export_path=args[0] if args else str(root.parent / "assets" / "glassbird.glb"),
         blend_path=args[1] if len(args) > 1 else str(root / "glassbird.blend"),
         preview_path=args[2] if len(args) > 2 else None)
