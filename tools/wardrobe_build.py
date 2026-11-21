import bpy, bmesh, math, sys, json, os
from mathutils import Vector
MP='/home/claude/outf/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Modular Parts/'
BASE='/home/claude/ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_'
HR='/home/claude/ubc/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/'
ACC='/home/claude/concertonline/assets/accessories/'
FEST='/home/claude/char/fest/'
NEON={'midnight':(1,.12,.6),'cyber':(0,.95,1),'sakura':(1,.55,.85),'solar':(1,.7,.1),'aurora':(.55,1,.25),'mono':(.55,.25,1)}
# Y cao theo giới (xương thật)
H={'Female':dict(crop=1.07,thigh_mid=0.70,knee=0.52,shoe=0.13,boot=0.50,elbow_x=0.36),
   'Male':dict(crop=1.08,thigh_mid=0.72,knee=0.54,shoe=0.14,boot=0.52,elbow_x=0.38)}

def imp(path):
    b=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
    new=[o for o in bpy.data.objects if o not in b]
    drop=[o for o in new if o.type=='MESH' and o.name.startswith('Icosphere')]
    for o in drop: bpy.data.objects.remove(o)
    return [o for o in new if o not in drop]
def meshes(objs): return [o for o in objs if o.type=='MESH']
def roots(objs): return [o for o in objs if o.parent is None]

def cut_keep(o,z=None,x=None,keep='above'):
    """cắt bằng mặt phẳng z=const (giữ trên/dưới) hoặc |x|=const (giữ trong/ngoài)"""
    bm=bmesh.new(); bm.from_mesh(o.data)
    geom=bm.verts[:]+bm.edges[:]+bm.faces[:]
    if z is not None:
        bmesh.ops.bisect_plane(bm,geom=geom,plane_co=(0,0,z),plane_no=(0,0,1),clear_inner=(keep=='above'),clear_outer=(keep=='below'))
    else:
        # giữ phần có |x|<x : cắt hai mặt phẳng ±x
        for s in (1,-1):
            geom=bm.verts[:]+bm.edges[:]+bm.faces[:]
            bmesh.ops.bisect_plane(bm,geom=geom,plane_co=(s*x,0,0),plane_no=(s,0,0),clear_outer=True)
    bm.to_mesh(o.data); bm.free(); o.data.update()

def drop_faces(o,pred):
    bm=bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
    mw=o.matrix_world
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if pred(mw@f.calc_center_median(),f)],context='FACES')
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    bm.to_mesh(o.data); bm.free(); o.data.update()

def mat_tex(mat,img,emis=None,strength=4.0,double=True):
    nt=mat.node_tree; bs=nt.nodes['Principled BSDF']
    for n in nt.nodes:
        if n.type=='TEX_IMAGE' and n.image and 'BaseColor' in n.image.name: n.image=img
    if emis is not None:
        t=nt.nodes.new('ShaderNodeTexImage'); t.image=emis; nt.links.new(t.outputs['Color'],bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value=strength
    mat.use_backface_culling=False
_img={}
def image(p):
    if p not in _img: _img[p]=bpy.data.images.load(p)
    return _img[p]
def recolor_obj(o,atlas,color,hasem):
    img=image(FEST+f'{atlas}_{color}_bc.png'); em=image(FEST+f'T_Ranger_{color}_em.png') if hasem else None
    for k,m in enumerate(o.data.materials):
        if m and not m.name.startswith('MI_Regular'):
            m=m.copy(); o.data.materials[k]=m; mat_tex(m,img,em)

def widen(o,k):
    for v in o.data.vertices:
        z=v.co.z; f=max(0.0,min(1.0,(z-0.60)/0.30)); f=f*f*(3-2*f)
        v.co.x*=1+(k-1)*f
    o.data.update()
def waistband(o,ztop=0.93,band=0.115,grow=1.02):
    cut_keep(o,z=ztop,keep='below')
    bm=bmesh.new(); bm.from_mesh(o.data); bm.edges.ensure_lookup_table()
    edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-ztop)<0.004 for v in e.verts)]
    r=bmesh.ops.extrude_edge_only(bm,edges=edges)
    nv=[e for e in r['geom'] if isinstance(e,bmesh.types.BMVert)]
    for v in nv: v.co.z+=band; v.co.x*=grow; v.co.y*=grow
    bm.to_mesh(o.data); bm.free(); o.data.update()
def skin_cover(body,rules):
    def pred(c,f):
        ax=abs(c.x)
        for r in rules:
            if r[0]=='y' and r[1]<=c.z<=r[2] and ax<(0.22 if c.z>1.0 else 0.31): return True
            if r[0]=='x' and r[1]<=ax<=r[2] and ax>=0.2: return True
        return False
    drop_faces(body,pred)

TOPS=['tank','tee','crop_jacket','vest','jacket']
BOTTOMS=['pants','shorts','cargo','capri']
SHOES=['sneakers','boots','bare']
def dress(g,spec,xoff,add_acc=True):
    h=H[g]; objs=[]
    base=imp(BASE+f'{g}_FullBody.gltf'); objs+=base
    body=[o for o in meshes(base) if o.name.lower().startswith('superhero')][0]
    for o in meshes(base):
        if o.name in('Eyes','Eyebrows'): continue
    cover=[]
    # --- áo
    t=spec['top']; tc=spec['topc']
    def part(file,atlas,color,hasem,fn=None,skip=None):
        p=imp(MP+f'{g}_{file}.gltf'); ms=meshes(p)
        for o in ms:
            if skip and skip(o): o.hide_render=True; o.hide_viewport=True; continue
            drop_faces(o,lambda c,f,o=o: o.data.materials[f.material_index].name.startswith('MI_Regular') if f.material_index<len(o.data.materials) else False)
            if fn: fn(o)
            if 'Legs' in file and g=='Female': widen(o,1.13)
            if 'Legs' in file: waistband(o)
            recolor_obj(o,atlas,color,hasem)
        return p
    keep=[]
    if t=='tank':
        keep+=part('Peasant_Body','T_PeasantG',tc,False,lambda o:cut_keep(o,z=h['crop'],keep='above')); cover.append(('y',h['crop'],1.50))
    elif t=='tank_long':
        keep+=part('Peasant_Body','T_PeasantG',tc,False); cover.append(('y',0.95,1.50))
    elif t=='tee':
        keep+=part('Peasant_Body','T_PeasantG',tc,False); keep+=part('Peasant_Arms','T_PeasantG',tc,False,lambda o:cut_keep(o,x=h['elbow_x']))
        cover+=[('y',0.95,1.50),('x',0.2,h['elbow_x'])]
    elif t=='crop_jacket':
        keep+=part('Ranger_Body','T_Ranger',tc,True,lambda o:cut_keep(o,z=h['crop'],keep='above') if o.name.endswith('Body') else None,skip=lambda o:'Belt' in o.name)
        keep+=part('Ranger_Arms','T_Ranger',tc,True,skip=lambda o:False); cover+=[('y',h['crop'],1.50),('x',0.2,0.60)]
    elif t=='vest':
        keep+=part('Ranger_Body','T_Ranger',tc,True); cover+=[('y',0.95,1.50)]
    elif t=='jacket':
        keep+=part('Ranger_Body','T_Ranger',tc,True); keep+=part('Ranger_Arms','T_Ranger',tc,True); cover+=[('y',0.95,1.50),('x',0.2,0.60)]
    # --- quần
    b=spec['bot']; bc=spec['botc']
    if b=='pants': keep+=part('Peasant_Legs','T_PeasantG',bc,False); cover.append(('y',0.44,1.05))
    elif b=='cargo': keep+=part('Ranger_Legs','T_Ranger',bc,True); cover.append(('y',0.42,1.05))
    elif b=='shorts': keep+=part('Ranger_Legs','T_Ranger',bc,True,lambda o:cut_keep(o,z=h['thigh_mid'],keep='above')); cover.append(('y',h['thigh_mid'],1.05))
    elif b=='capri': keep+=part('Peasant_Legs','T_PeasantG',bc,False,lambda o:cut_keep(o,z=h['knee'],keep='above')); cover.append(('y',h['knee'],1.05))
    # --- giày
    s=spec['shoe']; sc=spec['shoec']
    fn='Ranger_Feet' if g=='Female' else 'Ranger_Feet_Boots'
    if s=='boots': keep+=part(fn,'T_Ranger',sc,True); cover.append(('y',-0.05,h['boot']))
    elif s=='sneakers': keep+=part('Peasant_Feet','T_PeasantG',sc,False,lambda o:cut_keep(o,z=h['shoe'],keep='below')); cover.append(('y',-0.05,h['shoe']))
    if spec.get('belt') and t not in('vest','jacket'): keep+=part('Ranger_Body','T_Ranger',spec.get('beltc',tc),True,skip=lambda o:'Belt' not in o.name)
    if spec.get('pauldron'): keep+=part('Ranger_Acc_Pauldron'+('s' if g=='Female' else ''),'T_Ranger',spec.get('pauldronc',tc),True)
    if spec.get('bracer') and t not in('jacket','crop_jacket'): keep+=part('Ranger_Arms','T_Ranger',spec.get('bracerc',tc),True,skip=lambda o:'Bracer' not in o.name)
    if spec.get('hood'): keep+=part('Ranger_Head_Hood','T_Ranger',spec.get('hoodc',tc),True)
    objs+=keep
    skin_cover(body,cover)
    # --- tóc
    hf,hcol=spec['hair'],spec['hairc']
    if hf:
        hp=imp(HR+hf+'.gltf'); objs+=hp
        for o in meshes(hp):
            for k,m in enumerate(o.data.materials):
                if m:
                    m=m.copy(); o.data.materials[k]=m; bs=m.node_tree.nodes.get('Principled BSDF')
                    if bs:
                        mix=m.node_tree.nodes.new('ShaderNodeMix'); mix.data_type='RGBA'; mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=1.0
                        mix.inputs[7].default_value=(*hcol,1)
                        src=bs.inputs['Base Color'].links[0].from_socket if bs.inputs['Base Color'].links else None
                        if src: m.node_tree.links.new(src,mix.inputs[6])
                        else: mix.inputs[6].default_value=(1,1,1,1)
                        m.node_tree.links.new(mix.outputs[2],bs.inputs['Base Color'])
    # --- phụ kiện
    if add_acc:
        arm=[o for o in base if o.type=='ARMATURE'][0]
        def bp(n): return arm.matrix_world@arm.data.bones[n].head_local
        for nm in spec.get('acc',{}):
            a=imp(ACC+nm+'.glb')
            slot={'headphones':'head','sunglasses':'head','cat_ears':'head','non_la':'head','flower_crown':'head','bandana':'head','top_hat':'head','necklace':'neck','wings':'back','wristband':'wrist','lightstick':'hand','heart_lightstick':'hand'}[nm]
            if slot=='head': pos=bp('Head')+Vector((0,0,0.075))
            elif slot=='neck': pos=bp('neck_01')+Vector((0,-0.01,-0.02))
            elif slot=='back': pos=bp('spine_03')+Vector((0,0.09,-0.02))
            elif slot=='wrist': pos=(bp('lowerarm_r')+bp('hand_r'))*0.5
            else: pos=bp('hand_r')
            for o in roots(a): o.location=pos
            for o in a: o['_acc']=1
            objs+=a
    for o in roots(objs):
        if o.type in('ARMATURE','MESH','EMPTY') and not o.get('_acc'): o.location.x+=xoff
        elif o.get('_acc'): o.location.x+=xoff
    return objs

def scene_setup(w,h,cam_z=0.95,dist=9.0,lens=50):
    bpy.ops.object.light_add(type='AREA',location=(2,-4,4)); bpy.context.object.data.energy=800; bpy.context.object.data.size=6
    bpy.ops.object.light_add(type='AREA',location=(-3,-3,2)); bpy.context.object.data.energy=350; bpy.context.object.data.size=4
    bpy.ops.object.light_add(type='AREA',location=(0,3,3)); bpy.context.object.data.energy=500; bpy.context.object.data.size=5
    wd=bpy.data.worlds.new('w'); wd.use_nodes=True; wd.node_tree.nodes['Background'].inputs[0].default_value=(0.02,0.015,0.06,1); bpy.context.scene.world=wd
    bpy.ops.object.camera_add(location=(0,-dist,cam_z),rotation=(math.radians(90),0,0)); bpy.context.scene.camera=bpy.context.object; bpy.context.object.data.lens=lens
    s=bpy.context.scene; s.render.engine='BLENDER_EEVEE'; s.render.resolution_x=w; s.render.resolution_y=h; s.view_settings.view_transform='Standard'
