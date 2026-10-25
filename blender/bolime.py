"""
Bolime: a big, see-through blob of slime with eyes, from the kids' sketch.

A round body of lime green slime you can see into (the game draws its skin translucent:
core/enemies.js BOLIME `shell`), a squiggly core floating inside it, two eye stalks on top with a
round eye on each tip and a little V of slime between them. It gets about only by hopping, and it
fights by jumping onto you: whoever is under it when it comes down is swallowed (game/engulf.js),
inside it, until they break out or it spits them out again.
Faces -Y in Blender, +Z up; one unit = one game cell, about 1.35 cells tall (1.75 to the eyes):
the hero fits inside.

Rig: root, body (the lower half: squash and stretch), top (the upper half, the V), core (the
squiggle inside), stalk.L, stalk.R (the eye stalks, the eyes on their tips).

Clips, 30 fps, in place:
    BolimeHop     24-frame loop: squashes, springs up and comes down, wobbling (its gait).
    BolimePounce  5 s: crouches, leaps from frame 12 (extras.ride_frame), comes down at frame 30
                  (extras.hit_frame) squashed wide, gulps and churns while it holds whom it caught,
                  and spits them out from frame 132 (extras.release_frame).
    BolimeDeath   1.5 s: shudders, bursts flat and melts into a puddle. Held.

Headless:
    Blender -b --python blender/bolime.py -- assets/bolime.glb blender/bolime.blend \
        blender/previews/bolime-preview.png
"""
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import character as C
import creature as K

NAME, RIG_NAME = "Bolime", "BolimeRig"
SCENE, COLLECTION, STAGE = "Bolime", "BolimeAsset", "BolimeStage"
FPS, D, TAU = K.FPS, K.D, K.TAU
V = Vector
CLIPS = ("BolimeHop", "BolimePounce", "BolimeDeath")

SKIN_HEX, CORE_HEX, STALK_HEX, EYE_HEX, PUPIL_HEX = "#8ae048", "#3e8a2a", "#6cc23a", "#f4f8d8", "#141a0c"
MATERIALS = (("BolimeSkin", SKIN_HEX, 0.15), ("BolimeCore_glow", CORE_HEX, 0.9), ("BolimeStalk", STALK_HEX, 0),
             ("BolimeEyes", EYE_HEX, 0), ("BolimePupils", PUPIL_HEX, 0))
SKIN_M, CORE_M, STALK_M, EYE_M, PUPIL_M = range(len(MATERIALS))

VOXEL, FINE = 0.01, 0.005
HOP_FRAMES, HOP_SPEED = 24, 0.9
POUNCE_FRAMES, RIDE, HIT, RELEASE = 150, 12, 30, 132
DEATH_FRAMES = 45

# --- body plan -----------------------------------------------------------------
BODY_C, BODY_R = V((0, 0, 0.66)), (0.56, 0.54, 0.68)
STALKS = {s: [V((s * 0.15, -0.02, 1.2)), V((s * 0.2, -0.05, 1.42)), V((s * 0.26, -0.08, 1.6))] for s in (-1, 1)}
EYE_R = 0.075
TUFT = [[V((s * 0.03, -0.02, 1.26)), V((s * 0.11, -0.05, 1.42))] for s in (-1, 1)]
# the squiggle inside it (the sketch's): up through its middle in a zigzag
CORE = [V((0.0, 0.0, 0.3)), V((0.16, -0.05, 0.42)), V((-0.14, -0.02, 0.56)), V((0.15, 0.03, 0.7)), V((-0.12, 0.0, 0.84)),
        V((0.06, -0.03, 0.96))]


def body_sdf(P):
    d = K.ellipsoid(P, BODY_C, BODY_R)
    d = K.smax(d, -(P[..., 2] - 0.02), 0.08)          # it sits on the floor, flat underneath
    for pts in TUFT:                                   # the little V on top
        d = K.smin(d, K.round_cone(P, pts[0], pts[1], 0.06, 0.025), 0.05)
    return d


def build_mesh(coll):
    parts = K.Parts()
    lo, hi = BODY_C - V((0.62, 0.62, 0.72)), BODY_C + V((0.62, 0.62, 0.9))
    parts.add("body", body_sdf, lo, hi, VOXEL, mat=SKIN_M)
    lo, hi = K.bounds(CORE, 0.08)
    parts.add("core", lambda P: K.tapered_tube(P, CORE, (0.05, 0.055, 0.055, 0.05, 0.045, 0.035)), lo, hi, FINE, mat=CORE_M)
    for s, pts in STALKS.items():
        side = "stalk.L" if s < 0 else "stalk.R"
        lo, hi = K.bounds(pts, 0.06)
        parts.add(side, lambda P, p=pts: K.tapered_tube(P, p, (0.04, 0.03, 0.026)), lo, hi, FINE, mat=STALK_M)
        eye = pts[-1] + V((0, 0, EYE_R * 0.7))
        parts.add(side, lambda P, c=eye: K.ellipsoid(P, c, (EYE_R, EYE_R, EYE_R)), eye - V((0.1,) * 3), eye + V((0.1,) * 3), FINE, mat=EYE_M)
        pupil = eye + V((0, -EYE_R * 0.84, 0.0))
        parts.add(side, lambda P, c=pupil: K.ellipsoid(P, c, (0.032, 0.016, 0.034)), pupil - V((0.05,) * 3), pupil + V((0.05,) * 3), FINE, mat=PUPIL_M)
    obj = parts.mesh(NAME, coll, MATERIALS)
    obj["enemy"] = "bolime"
    obj["body_color"] = SKIN_HEX
    obj["style"] = "smooth_clay"
    return obj, parts.owners


# --- rig / skin --------------------------------------------------------------
def build_rig(coll):
    fwd = (0, -1, 0)
    bones = [("root", (0, 0, 0), (0, -0.1, 0), None, False, (0, 0, 1)),
             ("body", (0, 0, 0.0), (0, 0, 0.62), "root", True, fwd),
             ("top", (0, 0, 0.62), (0, 0, 1.34), "body", True, fwd),
             ("core", (0, 0, 0.3), (0, 0, 0.96), "body", True, fwd)]
    for s, pts in STALKS.items():
        bones.append(("stalk.L" if s < 0 else "stalk.R", pts[0], pts[-1], "top", True, fwd))
    return K.armature(RIG_NAME, coll, bones, {"enemy": "bolime", "forward": "-Y", "attack_style": "pounce",
                                              "normal_speed": HOP_SPEED, "root_motion": False})


def compute_weights(obj, owners):
    P = K.mesh_points(obj)
    names = [b.name for b in obj.parent.data.bones if b.use_deform]
    W = np.zeros((len(P), len(names)), np.float32)
    for o in owners:
        lo, hi, kind = o["lo"], o["hi"], o["kind"]
        if kind != "body":
            W[lo:hi, names.index(kind)] = 1
            continue
        up = C.np_smoothstep(0.5, 0.9, P[lo:hi, 2])
        WB = np.zeros((hi - lo, len(names)), np.float32)
        WB[:, names.index("body")] = 1 - up
        WB[:, names.index("top")] = up
        W[lo:hi] = K.diffuse(obj, lo, hi, WB, 4)
    K.write_weights(obj, names, W)


def build():
    scene = K.creature_scene(SCENE)
    K.clear_collection(COLLECTION)
    coll = K.collection(COLLECTION, scene)
    rig = build_rig(coll)
    obj, owners = build_mesh(coll)
    obj.parent = rig
    obj.modifiers.new("Armature", "ARMATURE").object = rig
    compute_weights(obj, owners)
    for name, roughness in (("BolimeSkin", 0.12), ("BolimeCore_glow", 0.3), ("BolimeStalk", 0.25), ("BolimeEyes", 0.2),
                            ("BolimePupils", 0.2)):
        bsdf = bpy.data.materials[name].node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Roughness"].default_value = roughness
    # (the preview shows it see-through as the game does)
    skin = bpy.data.materials["BolimeSkin"]
    skin.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.55
    skin.surface_render_method = "BLENDED"
    return scene, rig, obj


# --- motion ------------------------------------------------------------------
# lift: the whole of it off the floor; wide / tall: the body's squash and stretch; top: the upper
# half's own (wobbling a beat behind); lean: forward (x); stalk / spread: the eye stalks; churn:
# the core turning inside it
def params(**kw):
    p = {"lift": 0.0, "wide": 1.0, "tall": 1.0, "topwide": 1.0, "toptall": 1.0, "lean": 0.0, "toplean": 0.0, "stalk": [0.0, 0.0],
         "spread": [0.0, 0.0], "churn": 0.0, "corescale": 1.0}
    p.update(kw)
    return p


def solver(rig, fn):
    skel = C.Skeleton(rig)

    def solve(f, lift):
        p = fn(f)
        poses, bases = {}, {}
        bases["root"] = skel.set("root", poses, Matrix.Translation((0, 0, lift + p["lift"])) @ skel.rest["root"])
        bases["body"] = K.pose_local(skel, "body", poses, Matrix.Rotation(p["lean"], 4, "X") @ Matrix.Diagonal((p["wide"], p["tall"], p["wide"], 1)))
        bases["top"] = K.pose_local(skel, "top", poses, Matrix.Rotation(p["toplean"], 4, "X")
                                    @ Matrix.Diagonal((p["topwide"], p["toptall"], p["topwide"], 1)))
        c = p["corescale"]
        bases["core"] = K.pose_local(skel, "core", poses, Matrix.Rotation(p["churn"], 4, "Y") @ Matrix.Diagonal((c, c, c, 1)))
        for k, name in enumerate(("stalk.L", "stalk.R")):
            sgn = -1 if k == 0 else 1
            bases[name] = K.pose_local(skel, name, poses, Matrix.Rotation(p["stalk"][k], 4, "X") @ Matrix.Rotation(sgn * p["spread"][k], 4, "Y"))
        return bases
    return solve


def hop(f):
    u = f / HOP_FRAMES
    # squash (0-0.2), spring up and fly (0.2-0.75), come down and squash (0.75-0.9), settle
    air = C.smoothstep(0.18, 0.26, u) * (1 - C.smoothstep(0.7, 0.78, u))
    arc = math.sin(math.pi * min(1, max(0, (u - 0.2) / 0.55))) if 0.2 < u < 0.75 else 0.0
    squash = math.exp(-((u - 0.1) / 0.07) ** 2) + math.exp(-((u - 0.82) / 0.06) ** 2)
    wob = math.sin(TAU * 2 * u)
    return params(lift=0.28 * arc, wide=1 + 0.18 * squash - 0.07 * air, tall=1 - 0.2 * squash + 0.12 * air,
                  topwide=1 + 0.05 * wob, toptall=1 - 0.04 * wob, toplean=D(5) * math.sin(TAU * u + 0.6),
                  stalk=[D(18) * squash - D(10) * air, D(16) * squash - D(12) * air], spread=[D(8) * air, D(8) * air],
                  churn=TAU * u)


def pounce(f):
    k, t = C.keyframes, f / FPS
    ride, hit, release = RIDE / FPS, HIT / FPS, RELEASE / FPS
    crouch = k((0, 0), (ride - 0.05, 1), (ride, 0.3), (ride + 0.1, 0))(t)
    fly = k((0, 0), (ride, 0), (ride + 0.1, 1), (hit - 0.08, 1), (hit, 0))(t)
    land = k((0, 0), (hit - 0.02, 0), (hit + 0.05, 1), (hit + 0.3, 0.2), (hit + 0.5, 0))(t)
    # holding: slow gulps, the core churning; then spitting out (a heave forward)
    hold = C.smoothstep(hit + 0.3, hit + 0.6, t) * (1 - C.smoothstep(release - 0.1, release, t))
    gulp = math.sin(TAU * (t - hit) / 0.8) * hold
    spit = k((0, 0), (release - 0.05, 0), (release + 0.15, 1), (release + 0.45, 0.2), (5.0, 0))(t)
    return params(wide=1 + 0.28 * crouch - 0.12 * fly + 0.35 * land + 0.06 * gulp + 0.1 * hold - 0.1 * spit,
                  tall=1 - 0.3 * crouch + 0.22 * fly - 0.32 * land - 0.05 * gulp - 0.05 * hold + 0.15 * spit,
                  topwide=1 + 0.06 * math.sin(TAU * (t - hit) / 0.8 + 1.2) * hold, toptall=1 + 0.04 * gulp,
                  lean=D(-8) * crouch + D(6) * fly + D(14) * spit, toplean=D(-10) * crouch + D(8) * fly + D(12) * spit,
                  stalk=[D(28) * crouch - D(22) * fly + D(20) * land + D(8) * gulp, D(26) * crouch - D(24) * fly + D(22) * land - D(8) * gulp],
                  spread=[D(10) * fly + D(16) * land, D(10) * fly + D(16) * land], churn=TAU * t * (0.5 + 1.5 * hold),
                  corescale=1 + 0.12 * hold + 0.05 * gulp)


def death(f):
    t = f / FPS
    shudder = math.sin(TAU * 13 * t) * (1 - C.smoothstep(0.15, 0.4, t))
    burst = C.smoothstep(0.3, 0.6, t)
    melt = C.smoothstep(0.5, 1.3, t)
    return params(wide=1 + 0.08 * shudder + 0.35 * burst + 0.25 * melt, tall=1 - 0.08 * shudder - 0.45 * burst - 0.35 * melt,
                  topwide=1 + 0.2 * melt, toptall=1 - 0.5 * melt, stalk=[D(80) * melt, D(65) * melt], spread=[D(30) * melt, D(45) * melt],
                  churn=D(40) * burst, corescale=1 - 0.5 * melt)


def animate(rig, obj):
    rig.animation_data_create()
    K.ground_clip(rig, obj, "BolimeHop", solver(rig, hop), HOP_FRAMES, cyclic=True, extras={"speed": HOP_SPEED})
    a = K.ground_clip(rig, obj, "BolimePounce", solver(rig, pounce), POUNCE_FRAMES,
                      extras={"attack_style": "pounce", "ride_frame": RIDE, "hit_frame": HIT, "hit_time": HIT / FPS,
                              "release_frame": RELEASE})
    a.pose_markers.new("Land").frame = HIT
    a.pose_markers.new("Release").frame = RELEASE
    K.ground_clip(rig, obj, "BolimeDeath", solver(rig, death), DEATH_FRAMES,
                  extras={"hold_last_frame": True, "hold_from": 1.3}, settle_from=round(1.1 * FPS))
    K.register(rig, CLIPS)


# --- previews ----------------------------------------------------------------
def preview(scene, rig, path):
    shots = [("BolimeHop", 0, (2.2, -3.0, 1.6)), ("BolimeHop", 12, (-3.0, -1.2, 1.4)),
             ("BolimePounce", 8, (2.6, -2.2, 1.4)), ("BolimePounce", 22, (3.0, -1.0, 1.2)),
             ("BolimePounce", 60, (2.4, -2.6, 1.8)), ("BolimeDeath", DEATH_FRAMES, (2.2, -2.2, 2.2))]
    K.contact_sheet(scene, rig, shots, path, (0, 0, 0.75), size=360, cols=3)
    return [path]


def main(export_path=None, blend_path=None, preview_path=None):
    scene, rig, obj = build()
    K.decimate(obj)
    animate(rig, obj)
    report = K.validate(rig, obj, CLIPS, held=("BolimeDeath",))
    K.setup_stage(scene, "Bolime", STAGE, (0, 0, 0.75), 2.4, camera=(2.2, -3.0, 1.6))
    rig.animation_data.action = bpy.data.actions[CLIPS[0]]
    scene.frame_start, scene.frame_end = 0, HOP_FRAMES - 1
    scene.frame_set(0)
    if export_path:
        K.export_gltf(rig, obj, export_path)
    if blend_path:
        K.save_blend(scene, blend_path, (COLLECTION, STAGE), CLIPS, "Bolime", NAME, (0, 0, 0.75), 2.6)
    if preview_path:
        report["previews"] = [str(p) for p in preview(scene, rig, preview_path)]
    print("Bolime:", report)
    return rig, obj, report


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    root = Path(__file__).resolve().parent
    main(export_path=args[0] if args else str(root.parent / "assets" / "bolime.glb"),
         blend_path=args[1] if len(args) > 1 else str(root / "bolime.blend"),
         preview_path=args[2] if len(args) > 2 else None)
