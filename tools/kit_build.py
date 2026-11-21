import bpy, bmesh, math, sys, json, os
from mathutils import Vector
src=open('/home/claude/char/wardrobe_build.py').read().split("TOPS=[")[0]   # lấy các hàm: imp, cut_keep, drop_faces, widen, waistband
exec(src)
OUT='/home/claude/kit/'
g=sys.argv[sys.argv.index('--')+1]
h=H[g]
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- vật liệu theo vai trò (không texture: game tự gán)
def solid(name,col,rough=0.6,metal=0.0,em=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; bs=m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value=(*col,1); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    if em: bs.inputs['Emission Color'].default_value=(*em,1); bs.inputs['Emission Strength'].default_value=3.0
    return m
M_RANGER=solid('atlas_ranger',(.8,.8,.8)); M_PEASANT=solid('atlas_peasant',(.8,.8,.8)); M_SOLID=solid('solid',(.1,.1,.15)); M_TRIM=solid('trim',(1,.1,.6),em=(1,.1,.6))
def small(path,size,out,mode='RGB',q=82): return out
skinp=BASE+f'{g}_FullBody.gltf'
SK={'Female':'T_Superhero_Female_Light_BaseColor.png','Male':'T_Superhero_Male_Ligh.png'}[g]
BCD='/home/claude/ubc/Universal Base Characters[Standard]/Base Characters/Textures/'
os.makedirs('/home/claude/kit/tex',exist_ok=True)
skin_img=bpy.data.images.load(small(BCD+SK,1024,'/home/claude/kit/tex/skin_%s.jpg'%g))
M_SKIN=solid('skin',(1,1,1),0.55); n=M_SKIN.node_tree; t=n.nodes.new('ShaderNodeTexImage'); t.image=skin_img; n.links.new(t.outputs['Color'],n.nodes['Principled BSDF'].inputs['Base Color'])
eye_img=bpy.data.images.load(BCD+'T_Eye_Brown.png'); M_EYE=solid('eyes',(1,1,1),0.1); n=M_EYE.node_tree; t=n.nodes.new('ShaderNodeTexImage'); t.image=eye_img; n.links.new(t.outputs['Color'],n.nodes['Principled BSDF'].inputs['Base Color'])
M_BROW=solid('brow',(.03,.02,.02),0.7)
hair_tex={}
for k in ('1','2'):
    p=small(BCD+f'T_Hair_{k}_BaseColor.png',1024,f'/home/claude/kit/tex/hair{k}.png',mode='RGBA'); hair_tex[k]=bpy.data.images.load(p)
def hair_mat(k):
    m=bpy.data.materials.new(f'hair{k}'); m.use_nodes=True; nt=m.node_tree; bs=nt.nodes['Principled BSDF']
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=hair_tex[k]; nt.links.new(t.outputs['Color'],bs.inputs['Base Color']); nt.links.new(t.outputs['Alpha'],bs.inputs['Alpha'])
    bs.inputs['Roughness'].default_value=0.5; m.blend_method='CLIP'; return m

# ---- thân gốc + xương
base=imp(skinp)
arm=[o for o in base if o.type=='ARMATURE'][0]; arm.name='Armature'
for o in meshes(base):
    ln=o.name.lower()
    if ln.startswith('superhero'): o.name='skin'; o.data.materials.clear(); o.data.materials.append(M_SKIN)
    elif ln=='eyes': o.name='eyes'; o.data.materials.clear(); o.data.materials.append(M_EYE)
    elif ln=='eyebrows': o.name='brows'; o.data.materials.clear(); o.data.materials.append(M_BROW)
catalog={'gender':g,'units':'m','skin':{'mesh':'skin'},'face':['eyes','brows'],'tops':{},'bottoms':{},'shoes':{},'extras':{},'hair':{}}

def adopt(ms,names,mat):
    """gắn mesh vào bộ xương chung, đổi tên, gán vật liệu"""
    out=[]
    for o,nm in zip(ms,names):
        old=[mod for mod in o.modifiers if mod.type=='ARMATURE']
        for mod in old: o.modifiers.remove(mod)
        mw=o.matrix_world.copy(); o.parent=arm; o.matrix_parent_inverse=arm.matrix_world.inverted(); o.matrix_world=mw
        am=o.modifiers.new('Armature','ARMATURE'); am.object=arm
        o.name=nm; o.data.name=nm
        o.data.materials.clear(); o.data.materials.append(mat)
        out.append(nm)
    return out
def part(file,names,mat,fn=None,skip=None,only=None):
    p=imp(MP+f'{g}_{file}.gltf'); ms=meshes(p); keep=[]; arms_p=[o for o in p if o.type=='ARMATURE']
    for o in ms:
        if (skip and skip(o)) or (only and not only(o)): continue
        drop_faces(o,lambda c,f,o=o: o.data.materials[f.material_index].name.startswith('MI_Regular') if f.material_index<len(o.data.materials) else False)
        if fn: fn(o)
        keep.append(o)
    for o in [o for o in ms if o not in keep]: bpy.data.objects.remove(o)
    nm=[names+'_'+('_'.join(o.name.split('_')[2:]) or 'a').lower() for o in keep]
    nm=[n.replace('_ranger','').replace('_peasant','') for n in nm]
    res=adopt(keep,[f'{names}_{i}' for i in range(len(keep))],mat)
    for o in arms_p: bpy.data.objects.remove(o)
    return res

# --- áo
T=catalog['tops']
T['crop_tank']=dict(name='Tank crop',atlas='peasant',cover=[['y',h['crop'],1.5]],parts=part('Peasant_Body','top_crop_tank',M_PEASANT,lambda o:cut_keep(o,z=h['crop'],keep='above')))
T['tank_long']=dict(name='Tank dài',atlas='peasant',cover=[['y',0.95,1.5]],parts=part('Peasant_Body','top_tank_long',M_PEASANT))
T['tee']=dict(name='Áo thun',atlas='peasant',cover=[['y',0.95,1.5],['x',0.2,h['elbow_x']]],parts=part('Peasant_Body','top_tee_b',M_PEASANT)+part('Peasant_Arms','top_tee_s',M_PEASANT,lambda o:cut_keep(o,x=h['elbow_x'])))
T['vest']=dict(name='Gile',atlas='ranger',cover=[['y',0.95,1.5]],parts=part('Ranger_Body','top_vest',M_RANGER))
T['crop_jacket']=dict(name='Jacket crop',atlas='ranger',cover=[['y',h['crop'],1.5],['x',0.2,0.6]],parts=part('Ranger_Body','top_cjk_b',M_RANGER,lambda o:cut_keep(o,z=h['crop'],keep='above'),skip=lambda o:'Belt' in o.name)+part('Ranger_Arms','top_cjk_s',M_RANGER))
T['jacket']=dict(name='Jacket',atlas='ranger',cover=[['y',0.95,1.5],['x',0.2,0.6]],parts=part('Ranger_Body','top_jk_b',M_RANGER)+part('Ranger_Arms','top_jk_s',M_RANGER))
# --- quần
def legs(file,nm,mat,cut=None):
    def fn(o):
        if cut: cut_keep(o,z=cut,keep='above')
        if g=='Female': widen(o,1.13)
        waistband(o)
    return part(file,nm,mat,fn)
B=catalog['bottoms']
B['pants']=dict(name='Quần dài',atlas='peasant',cover=[['y',0.44,1.05]],parts=legs('Peasant_Legs','bot_pants',M_PEASANT))
B['cargo']=dict(name='Quần cargo',atlas='ranger',cover=[['y',0.42,1.05]],parts=legs('Ranger_Legs','bot_cargo',M_RANGER))
B['shorts']=dict(name='Quần short',atlas='ranger',cover=[['y',h['thigh_mid'],1.05]],parts=legs('Ranger_Legs','bot_shorts',M_RANGER,h['thigh_mid']))
B['capri']=dict(name='Quần capri',atlas='peasant',cover=[['y',h['knee'],1.05]],parts=legs('Peasant_Legs','bot_capri',M_PEASANT,h['knee']))
# --- giày
S=catalog['shoes']
fn_boot='Ranger_Feet' if g=='Female' else 'Ranger_Feet_Boots'
S['sneakers']=dict(name='Sneaker',atlas='peasant',cover=[['y',-0.05,h['shoe']]],parts=part('Peasant_Feet','shoe_sneakers',M_PEASANT,lambda o:cut_keep(o,z=h['shoe'],keep='below')))
S['boots']=dict(name='Ủng neon',atlas='ranger',cover=[['y',-0.05,h['boot']]],parts=part(fn_boot,'shoe_boots',M_RANGER))
# --- món ghép
E=catalog['extras']
E['belt']=dict(name='Đai lưng',atlas='ranger',slot='waist',parts=part('Ranger_Body','ex_belt',M_RANGER,only=lambda o:'Belt' in o.name))
E['pauldron']=dict(name='Giáp vai',atlas='ranger',slot='shoulder',parts=part('Ranger_Acc_Pauldron'+('s' if g=='Female' else ''),'ex_pauldron',M_RANGER))
E['bracer']=dict(name='Bảo vệ cổ tay',atlas='ranger',slot='arm',parts=part('Ranger_Arms','ex_bracer',M_RANGER,only=lambda o:'Bracer' in o.name))
E['hood']=dict(name='Mũ trùm',atlas='ranger',slot='head',parts=part('Ranger_Head_Hood','ex_hood',M_RANGER))
# --- tóc
HAIRS=[('Hair_Long','Tóc dài','1',['Female']),('Hair_Buns','Tóc búi','2',['Female','Male']),('Hair_BuzzedFemale','Tóc cắt sát','1',['Female']),('Hair_SimpleParted','Tóc rẽ ngôi','1',['Female','Male']),('Hair_Buzzed','Đầu cạo','1',['Male']),('Hair_Beard','Râu','1',['Male'])]
mats={k:hair_mat(k) for k in ('1','2')}
for f,label,tk,gs in HAIRS:
    if g not in gs: continue
    p=imp(HR+f+'.gltf'); ms=meshes(p); arms_p=[o for o in p if o.type=='ARMATURE']
    res=adopt(ms,[f'hair_{f[5:].lower()}_{i}' for i in range(len(ms))],mats[tk])
    for o in arms_p: bpy.data.objects.remove(o)
    catalog['hair'][f[5:].lower()]=dict(name=label,tex=tk,slot='hair',parts=res)

# --- váy xếp ly (chỉ nữ): dựng mới, gán trọng số pelvis/thigh
if g=='Female':
    N=48; R=7; z0,z1=1.0,0.66
    bm=bmesh.new(); rings=[]
    for r in range(R+1):
        t=r/R; z=z0+(z1-z0)*t; rad=0.205+0.12*t**0.9
        ring=[]
        for i in range(N):
            a=2*math.pi*i/N; pl=1+0.07*math.sin(a*16)*t
            ring.append(bm.verts.new((rad*pl*math.cos(a)*1.08,rad*pl*math.sin(a)*0.92,z)))
        rings.append(ring)
    for r in range(R):
        for i in range(N): bm.faces.new((rings[r][i],rings[r][(i+1)%N],rings[r+1][(i+1)%N],rings[r+1][i]))
    me=bpy.data.meshes.new('bot_skirt_0'); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('bot_skirt_0',me); bpy.context.scene.collection.objects.link(o)
    for p_ in me.polygons: p_.use_smooth=True
    sd=o.modifiers.new('s','SOLIDIFY'); sd.thickness=0.004
    vgp=o.vertex_groups.new(name='pelvis'); vgl=o.vertex_groups.new(name='thigh_l'); vgr=o.vertex_groups.new(name='thigh_r')
    for r in range(R+1):
        t=r/R
        for i in range(N):
            v=r*N+i; x=me.vertices[v].co.x; side=vgl if x>0 else vgr
            w=min(1.0,t*1.1); wt=w if abs(x)>0.04 else 0.0
            vgp.add([v],1-wt,'REPLACE')
            if wt>0: side.add([v],wt,'REPLACE')
    res=adopt([o],['bot_skirt_0'],M_SOLID)
    # viền neon ở gấu váy
    bpy.ops.mesh.primitive_torus_add(major_radius=0.325,minor_radius=0.008,major_segments=48,minor_segments=6,location=(0,0,z1+0.004))
    tr=bpy.context.object; tr.scale=(1.08,0.92,1); bpy.ops.object.transform_apply(scale=True)
    vg=tr.vertex_groups.new(name='thigh_l'); vg2=tr.vertex_groups.new(name='thigh_r')
    for v in tr.data.vertices: (vg if v.co.x>0 else vg2).add([v.index],1.0,'REPLACE')
    res2=adopt([tr],['bot_skirt_1'],M_TRIM)
    catalog['bottoms']['skirt']=dict(name='Váy xếp ly',atlas='solid',cover=[['y',0.66,1.05]],parts=res+res2,trim=True)

# --- xuất
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type in('MESH','ARMATURE'): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT+f'kit_{g}.glb',export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_image_format='JPEG',export_jpeg_quality=80,export_extras=False,export_apply=False)
tris={}
for o in meshes(bpy.data.objects): tris[o.name]=sum(len(p.vertices)-2 for p in o.data.polygons)
catalog['tris']=tris
json.dump(catalog,open(OUT+f'catalog_{g}.json','w'),ensure_ascii=False,indent=1)
print('KIT',g,'meshes',len(tris),'tris',sum(tris.values()))
