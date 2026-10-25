"""Blender-native checks: geometry, repeatability and the actual GLB contract.

    Blender --background --python blender/tests/test_town.py

Tests write only to a temporary directory, not the checked-in exports.
"""
import json
from pathlib import Path
import struct
import sys
import tempfile

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import town


def fingerprint(objects):
    return [(obj.name, [tuple(v.co) for v in obj.data.vertices],
             [tuple(p.vertices) for p in obj.data.polygons],
             [tuple(c.color) for c in obj.data.color_attributes['Color'].data]) for obj in objects]


def read_glb(path):
    data = Path(path).read_bytes()
    magic, version, length = struct.unpack_from('<4sII', data)
    assert magic == b'glTF' and version == 2 and length == len(data), path
    chunk_length, chunk_type = struct.unpack_from('<II', data, 12)
    assert chunk_type == 0x4E4F534A, path
    return json.loads(data[20:20 + chunk_length])


def check_glb(path, reports):
    gltf = read_glb(path)
    expected = {r['name']: r for r in reports}
    assert not gltf.get('images') and not gltf.get('textures')
    assert not gltf.get('animations') and not gltf.get('skins') and not gltf.get('cameras')
    roots = gltf['scenes'][gltf.get('scene', 0)]['nodes']
    nodes = [gltf['nodes'][i] for i in roots]
    assert {n['name'] for n in nodes} == set(expected)
    assert len(nodes) == len(gltf['nodes']) == len(reports)
    for node in nodes:
        assert node.get('translation', [0, 0, 0]) == [0, 0, 0]
        assert node.get('rotation', [0, 0, 0, 1]) == [0, 0, 0, 1]
        assert node.get('scale', [1, 1, 1]) == [1, 1, 1]
        extras = node['extras']
        report = expected[node['name']]
        assert extras['service'] == report['service'] and extras['stock'] == report['stock']
        assert extras['attach'] == 'ground' and extras['blocking'] is True
        assert extras['front'] == '+Z' and extras['units'] == 'cells'
        assert extras['cube_crawler_town'] is True
        primitives = gltf['meshes'][node['mesh']]['primitives']
        # vertex colour, emissive lantern/forge, and for the houses with windows their panes
        windows = node['name'] in ('town_inn_a', 'town_pet_shop_a', 'town_blacksmith_a')
        assert len(primitives) == (3 if windows else 2), node['name']
        triangle_count, min_y, max_y = 0, float('inf'), -float('inf')
        for primitive in primitives:
            assert primitive.get('mode', 4) == 4
            attrs = primitive['attributes']
            assert 'COLOR_0' in attrs and 'NORMAL' in attrs and 'TEXCOORD_0' not in attrs
            accessor = gltf['accessors'][attrs['POSITION']]
            min_y, max_y = min(min_y, accessor['min'][1]), max(max_y, accessor['max'][1])
            triangle_count += gltf['accessors'][primitive['indices']]['count'] // 3
            material = gltf['materials'][primitive['material']]
            assert not material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        assert triangle_count == report['triangles'], node['name']
        assert abs(min_y) < 1e-6 and abs(max_y - report['size'][2]) < .001
        glowing = [gltf['materials'][p['material']] for p in primitives
                   if any(gltf['materials'][p['material']].get('emissiveFactor', []))]
        names = sorted(m['name'] for m in glowing)
        assert names == [node['name'] + '_glow'] + ([node['name'] + '_window'] if windows else []), names


def main():
    bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
    objects = town.build()
    first = fingerprint(objects)
    objects = town.build()
    assert first == fingerprint(objects), 'Procedural rebuild must be deterministic'
    report = town.validate(objects)
    # Export from a showroom layout and ensure the layout is restored afterwards.
    for i, obj in enumerate(objects):
        obj.location = (i * 5, 2, 0)
    locations = [tuple(o.location) for o in objects]
    with tempfile.TemporaryDirectory(prefix='cube-town-test-') as directory:
        town.export(objects, directory)
        check_glb(Path(directory) / 'town.glb', report)
        for obj, item in zip(objects, report):
            check_glb(Path(directory) / 'town' / (obj.name + '.glb'), [item])
        assert locations == [tuple(o.location) for o in objects]
    print(f"PASS: seven deterministic assets, {sum(r['triangles'] for r in report)} triangles; "
          'combined and individual GLBs have ground pivots, Y-up bounds, vertex colours and service extras')


if __name__ == '__main__':
    main()
