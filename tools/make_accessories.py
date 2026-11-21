"""Dựng phụ kiện concert bằng Blender (bpy) và xuất glTF.
Quy ước: đơn vị mét, người cao ~1.7 m. Gốc (origin) của mỗi vật là điểm gắn vào xương:
  head  = tâm đầu (ngang tai), hướng mặt là -Y trong Blender (= +Z trong glTF)
  back  = giữa lưng trên, hand = lòng bàn tay, neck = gốc cổ, wrist = cổ tay.
Chạy: python make_accessories.py <thư mục xuất>"""
import bpy, math, sys, os, json

OUT = sys.argv[-1] if len(sys.argv) > 1 else 'out'
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, metal=0.0, rough=0.5, emit=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    return m


def put(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def torus(R, r, loc=(0, 0, 0), rot=(0, 0, 0), seg=40, rseg=16):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=rseg, location=loc, rotation=rot)
    return bpy.context.object


def cyl(r, h, loc=(0, 0, 0), rot=(0, 0, 0), v=24, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=v, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=h, vertices=v, location=loc, rotation=rot)
    return bpy.context.object


def sph(r, loc=(0, 0, 0), scale=(1, 1, 1), seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=seg // 2, location=loc)
    o = bpy.context.object
    o.scale = scale
    return o


def box(size, loc=(0, 0, 0), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    return o


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    return o


def export(o, name):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_materials='EXPORT')
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    return tris


def build(name, fn):
    reset()
    o = fn()
    return export(o, name)


# ---- từng phụ kiện -------------------------------------------------------
def headphones():
    band = torus(0.108, 0.006, loc=(0, 0, 0.02), rot=(math.pi / 2, 0, 0))
    band.scale = (1, 1, 1.0)
    # chỉ giữ nửa trên: cắt bằng cách dịch xuống và xóa phần dưới
    bpy.context.view_layer.objects.active = band
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.bisect(plane_co=(0, 0, 0.0), plane_no=(0, 0, 1), clear_inner=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    put(band, mat('band', (0.07, 0.07, 0.09), 0.6, 0.35))
    parts = [band]
    for s in (-1, 1):
        cup = cyl(0.045, 0.03, loc=(s * 0.1, 0, 0), rot=(0, math.pi / 2, 0))
        put(cup, mat('cup', (0.08, 0.08, 0.1), 0.5, 0.4)); parts.append(cup)
        ring = torus(0.04, 0.004, loc=(s * 0.118, 0, 0), rot=(0, math.pi / 2, 0))
        put(ring, mat('ringglow', (0.1, 0.9, 1.0), 0.0, 0.3, emit=(0.1, 0.9, 1.0), strength=3.0)); parts.append(ring)
    return join(parts, 'headphones')


def sunglasses():
    parts = []
    fm = mat('frame', (0.03, 0.03, 0.04), 0.4, 0.3)
    lens = mat('lens', (0.9, 0.2, 0.7), 0.9, 0.08)
    for s in (-1, 1):
        rim = torus(0.032, 0.004, loc=(s * 0.04, -0.095, 0.01), rot=(math.pi / 2, 0, 0), seg=32, rseg=8)
        put(rim, fm); parts.append(rim)
        l = cyl(0.031, 0.003, loc=(s * 0.04, -0.095, 0.01), rot=(math.pi / 2, 0, 0), v=32)
        put(l, lens); parts.append(l)
        arm = box((0.003, 0.1, 0.004), loc=(s * 0.078, -0.045, 0.012))
        put(arm, fm); parts.append(arm)
    bridge = box((0.02, 0.004, 0.004), loc=(0, -0.095, 0.02)); put(bridge, fm); parts.append(bridge)
    return join(parts, 'sunglasses')


def cat_ears():
    parts = []
    bandm = mat('hb', (0.1, 0.1, 0.12), 0.2, 0.5)
    pink = mat('inner', (1.0, 0.35, 0.65), 0.0, 0.6, emit=(1.0, 0.2, 0.55), strength=0.6)
    arc = torus(0.1, 0.006, loc=(0, 0, 0.03), rot=(math.pi / 2, 0, 0))
    bpy.context.view_layer.objects.active = arc
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.bisect(plane_co=(0, 0, 0.03), plane_no=(0, 0, 1), clear_inner=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    put(arc, bandm); parts.append(arc)
    for s in (-1, 1):
        e = cyl(0.04, 0.09, loc=(s * 0.06, 0.0, 0.13), rot=(0, s * 0.35, 0), v=4, r2=0.001)
        put(e, bandm); parts.append(e)
        i = cyl(0.026, 0.07, loc=(s * 0.06, -0.012, 0.128), rot=(0, s * 0.35, 0), v=4, r2=0.001)
        put(i, pink); parts.append(i)
    return join(parts, 'cat_ears')


def non_la():
    """Nón lá Việt Nam: nón chóp, vành rộng, quai."""
    cone = cyl(0.21, 0.17, loc=(0, 0, 0.16), v=48, r2=0.012)
    put(cone, mat('palm', (0.86, 0.74, 0.48), 0.0, 0.85))
    bpy.context.view_layer.objects.active = cone
    parts = [cone]
    for k in range(5):  # vòng khung nón
        z = 0.08 + k * 0.03
        r = 0.21 * (1 - (z - 0.075) / 0.17)
        ring = torus(max(r, 0.02), 0.0016, loc=(0, 0, z), seg=48, rseg=6)
        put(ring, mat('rib', (0.55, 0.42, 0.24), 0.0, 0.8)); parts.append(ring)
    for s in (-1, 1):
        strap = cyl(0.004, 0.22, loc=(s * 0.1, -0.02, -0.04), rot=(0.15, 0, s * 0.12), v=8)
        put(strap, mat('silk', (0.9, 0.15, 0.25), 0.0, 0.4)); parts.append(strap)
    return join(parts, 'non_la')


def flower_crown():
    parts = []
    vine = torus(0.104, 0.005, loc=(0, 0, 0.04), seg=40, rseg=6)
    put(vine, mat('vine', (0.15, 0.45, 0.2), 0.0, 0.8)); parts.append(vine)
    cols = [(1, .35, .6), (1, .85, .3), (0.95, .95, 1), (.75, .45, 1), (1, .55, .25)]
    for i in range(12):
        a = i / 12 * math.tau
        c = cols[i % len(cols)]
        f = sph(0.016, loc=(math.cos(a) * 0.106, math.sin(a) * 0.106, 0.045), scale=(1, 1, 0.7))
        put(f, mat('petal%d' % (i % 5), c, 0.0, 0.5, emit=c, strength=0.35)); parts.append(f)
        ctr = sph(0.006, loc=(math.cos(a) * 0.106, math.sin(a) * 0.106, 0.053))
        put(ctr, mat('ctr', (1, 0.8, 0.1), 0.0, 0.5)); parts.append(ctr)
    return join(parts, 'flower_crown')


def lightstick():
    handle = cyl(0.014, 0.12, loc=(0, 0, 0), rot=(math.pi / 2, 0, 0), v=20)
    put(handle, mat('grip', (0.06, 0.06, 0.08), 0.5, 0.4))
    tube = cyl(0.02, 0.28, loc=(0, -0.2, 0), rot=(math.pi / 2, 0, 0), v=20)
    put(tube, mat('glow', (0.5, 0.95, 1.0), 0.0, 0.2, emit=(0.1, 0.9, 1.0), strength=6.0, alpha=1.0))
    tip = sph(0.022, loc=(0, -0.345, 0))
    put(tip, mat('glow2', (0.5, 0.95, 1.0), 0.0, 0.2, emit=(0.1, 0.9, 1.0), strength=6.0))
    return join([handle, tube, tip], 'lightstick')


def heart_lightstick():
    handle = cyl(0.013, 0.2, loc=(0, 0.05, 0), rot=(math.pi / 2, 0, 0), v=20)
    put(handle, mat('grip', (0.9, 0.9, 0.95), 0.6, 0.3))
    parts = [handle]
    hm = mat('heart', (1.0, 0.3, 0.6), 0.0, 0.25, emit=(1.0, 0.1, 0.5), strength=5.0)
    for s in (-1, 1):
        lobe = sph(0.045, loc=(s * 0.034, -0.17, 0.02), scale=(1, 0.5, 1)); put(lobe, hm); parts.append(lobe)
    cone = cyl(0.075, 0.1, loc=(0, -0.15, -0.025), rot=(math.pi / 2, 0, math.pi), v=24, r2=0.004)
    cone.scale = (1, 1, 1)
    put(cone, hm); parts.append(cone)
    return join(parts, 'heart_lightstick')


def wings():
    """Cánh lông vũ xòe quạt, gắn sau lưng; hai cánh đối xứng, mỗi cánh 9 lông xếp tầng."""
    parts = []
    mm = mat('feather', (0.96, 0.96, 1.0), 0.0, 0.3, emit=(0.45, 0.65, 1.0), strength=0.9)
    tip = mat('feather_tip', (1.0, 0.7, 0.95), 0.0, 0.3, emit=(1.0, 0.4, 0.9), strength=1.2)
    for s in (-1, 1):
        for layer, (n, base, L0) in enumerate(((9, 0.12, 0.42), (8, 0.1, 0.32))):
            for k in range(n):
                a = math.radians(-18 + k * (96 / (n - 1)))
                L = L0 * (0.62 + 0.38 * math.sin(math.radians(25 + k * 140 / (n - 1)))) * (1 - 0.1 * layer)
                root = (s * 0.05, 0.1 + 0.012 * layer, 0.14 - 0.02 * layer)
                d = (s * math.cos(a), 0, math.sin(a))
                c = (root[0] + d[0] * L / 2, root[1], root[2] + d[2] * L / 2)
                f = sph(0.5, loc=c, scale=(L, 0.006, 0.045 + 0.012 * (1 - layer)), seg=14)
                f.rotation_euler = (0, (-a) if s == 1 else (math.pi + a), 0)
                put(f, tip if k >= n - 2 else mm); parts.append(f)
    return join(parts, 'wings')


def necklace():
    chain = torus(0.085, 0.0025, loc=(0, -0.02, -0.03), seg=48, rseg=6)
    chain.scale = (1, 0.8, 1.15)
    put(chain, mat('gold', (1.0, 0.76, 0.34), 1.0, 0.22))
    pend = sph(0.015, loc=(0, -0.09, -0.12), scale=(1, 0.5, 1.4))
    put(pend, mat('gem', (0.2, 0.9, 1.0), 0.2, 0.05, emit=(0.1, 0.8, 1.0), strength=1.5))
    return join([chain, pend], 'necklace')


def wristband():
    b = torus(0.032, 0.008, rot=(0, math.pi / 2, 0), seg=28, rseg=10)
    put(b, mat('wb', (1.0, 0.25, 0.7), 0.0, 0.6, emit=(1.0, 0.1, 0.6), strength=1.2))
    return join([b], 'wristband')


def bandana():
    parts = []
    m = mat('bd', (0.9, 0.12, 0.15), 0.0, 0.8)
    band = torus(0.102, 0.012, loc=(0, 0, 0.065), seg=48, rseg=8)
    band.scale = (1, 1.05, 0.5)
    put(band, m); parts.append(band)
    knot = sph(0.02, loc=(0, 0.1, 0.065)); put(knot, m); parts.append(knot)
    for s in (-1, 1):
        t = box((0.015, 0.003, 0.07), loc=(s * 0.014, 0.115, 0.03), rot=(0, 0, s * 0.3)); put(t, m); parts.append(t)
    return join(parts, 'bandana')


def top_hat():
    brim = cyl(0.14, 0.008, loc=(0, 0, 0.1), v=40)
    crown = cyl(0.085, 0.16, loc=(0, 0, 0.18), v=40)
    put(brim, mat('felt', (0.05, 0.05, 0.07), 0.1, 0.7)); put(crown, mat('felt', (0.05, 0.05, 0.07), 0.1, 0.7))
    rib = cyl(0.087, 0.03, loc=(0, 0, 0.13), v=40)
    put(rib, mat('rib', (0.1, 0.9, 1.0), 0.2, 0.3, emit=(0.1, 0.9, 1.0), strength=2.0))
    return join([brim, crown, rib], 'top_hat')


ITEMS = {
    # tên: (hàm dựng, điểm gắn, tên xương gợi ý theo thứ tự ưu tiên, offset [x,y,z] theo mét trong hệ glTF)
    'headphones':      (headphones, 'head', ['head'], [0, 0.02, 0]),
    'sunglasses':      (sunglasses, 'head', ['head'], [0, 0.02, 0]),
    'cat_ears':        (cat_ears, 'head', ['head'], [0, 0.03, 0]),
    'non_la':          (non_la, 'head', ['head'], [0, 0.08, 0]),
    'flower_crown':    (flower_crown, 'head', ['head'], [0, 0.07, 0]),
    'bandana':         (bandana, 'head', ['head'], [0, 0.05, 0]),
    'top_hat':         (top_hat, 'head', ['head'], [0, 0.1, 0]),
    'necklace':        (necklace, 'neck', ['neck_01', 'neck', 'spine_05'], [0, 0, 0]),
    'wings':           (wings, 'back', ['spine_05', 'spine_04', 'chest'], [0, 0, -0.1]),
    'wristband':       (wristband, 'wrist', ['lowerarm_r', 'forearm_r', 'hand_r'], [0, 0, 0]),
    'lightstick':      (lightstick, 'hand', ['hand_r', 'hand.R', 'RightHand'], [0, 0, 0]),
    'heart_lightstick': (heart_lightstick, 'hand', ['hand_r', 'hand.R', 'RightHand'], [0, 0, 0]),
}

manifest = {'units': 'm', 'note': 'origin của mỗi mô hình là điểm gắn. Tên xương thử lần lượt, so khớp không phân biệt hoa thường và bỏ ký tự . _ -', 'items': {}}
for name, (fn, slot, bones, off) in ITEMS.items():
    tris = build(name, fn)
    manifest['items'][name] = {'file': name + '.glb', 'slot': slot, 'bones': bones, 'offset': off, 'tris': tris}
    print(name, tris, 'tris')
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
