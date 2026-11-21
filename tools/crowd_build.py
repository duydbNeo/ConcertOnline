import bpy, bmesh, json, sys, math, re, base64, struct, os
import numpy as np
from mathutils import Vector
G=sys.argv[sys.argv.index('--')+1]; gk='F' if G=='Female' else 'M'
AS='/home/claude/concertonline/assets/char/'
ANIM=sys.argv[sys.argv.index('--')+2]
OUT=sys.argv[sys.argv.index('--')+3]
CAT=json.load(open('/home/claude/concertonline/src/wardrobe.json'))['v3']['G'][gk]
VAR={'F':[(0,0,0,0),(2,4,1,1),(4,2,0,3),(5,3,0,2)],'M':[(2,0,0,0),(1,2,0,1),(5,1,1,0),(3,3,0,1)]}[gk]
TARGET={'skin':900,'top':520,'bot':520,'shoe':180,'hair':320}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=AS+f'kit_{G}.glb')
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
objs={re.sub(r'\.\d+$','',o.name):o for o in bpy.data.objects if o.type=='MESH'}
before=set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=ANIM)
act=[a for a in bpy.data.actions if a.name.split('|')[-1]=='idle'][0]
for o in [o for o in bpy.data.objects if o.type=='ARMATURE' and o!=arm]: bpy.data.objects.remove(o)
arm.animation_data_create(); arm.animation_data.action=act
bpy.context.scene.frame_set(8)
dg=bpy.context.evaluated_depsgraph_get()
# ---- texture
def load(n): return bpy.data.images.load(AS+'tex/'+n)
def arr(img):
    w,h=img.size; a=np.array(img.pixels[:],dtype=np.float32).reshape(h,w,4); return a
TX={'peasant':arr(load('peasant_midnight.jpg')),'ranger':arr(load('ranger_midnight.jpg')),'ranger_em':arr(load('ranger_midnight_em.jpg')),'skin':arr(load(f'skin_{G}.jpg'))}
def samp(a,uv):
    h,w=a.shape[:2]; x=int((uv[0]%1.0)*(w-1)); y=int((uv[1]%1.0)*(h-1)); y=h-1-y  # glTF uv origin top-left, Blender bottom-left (importer flips) -> sample flipped
    return a[y,x]
def lum(c): return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def w2g(v): return (v.x, v.z, -v.y)
LEFT=re.compile(r'(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)')
def side_of(name):
    if not LEFT.search(name): return 0
    if name.endswith('_l'): return 3   # +x
    if name.endswith('_r'): return 2   # -x
    return 0
def covered(p, cover):
    x,y=abs(p[0]),p[1]
    for k,a,b in cover:
        if k=='y':
            lim=0.22 if y>1.0 else 0.31
            if a<=y<=b and x<lim: return True
        else:
            if a<=x<=b and x>=0.2: return True
    return False
def part_mesh(obj, ratio, cover=None):
    """trả về danh sách tam giác (pos, nor, uv, part) đã tạo dáng + decimate"""
    ev=obj.evaluated_get(dg); me=bpy.data.meshes.new_from_object(ev)
    # tọa độ rest
    rest=[w2g(obj.matrix_world@v.co) for v in obj.data.vertices]
    names=[g.name for g in obj.vertex_groups]
    bm=bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    if cover:
        dele=[f for f in bm.faces if all(covered(rest[v.index],cover) for v in f.verts)]
        bmesh.ops.delete(bm,geom=dele,context='FACES')
        # bỏ đỉnh mồ côi
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    bm.to_mesh(me); bm.free()
    o2=bpy.data.objects.new('tmp_'+obj.name,me); bpy.context.scene.collection.objects.link(o2)
    for n in names: o2.vertex_groups.new(name=n)
    o2.matrix_world=obj.matrix_world.copy()
    tris=sum(len(p.vertices)-2 for p in me.polygons)
    if ratio<1.0 and tris>0:
        m=o2.modifiers.new('d','DECIMATE'); m.ratio=max(0.02,min(1.0,ratio))
    bpy.context.view_layer.update()
    ev2=o2.evaluated_get(bpy.context.evaluated_depsgraph_get()); m2=ev2.to_mesh()
    m2.calc_loop_triangles(); uvl=m2.uv_layers.active
    try: nor=m2.corner_normals
    except Exception: nor=None
    out=[]
    # chọn nhóm xương trội cho từng đỉnh
    side=[]
    for v in m2.vertices:
        s={0:0.0,2:0.0,3:0.0}
        for g in v.groups:
            nm=o2.vertex_groups[g.group].name if g.group<len(o2.vertex_groups) else ''
            s[side_of(nm)]+=g.weight
        side.append(max(s,key=s.get))
    for t in m2.loop_triangles:
        for li,vi in zip(t.loops,t.vertices):
            p=w2g(o2.matrix_world@m2.vertices[vi].co)
            n=(nor[li].vector if nor is not None else m2.vertices[vi].normal)
            n=w2g(o2.matrix_world.to_3x3()@n); l=math.sqrt(n[0]**2+n[1]**2+n[2]**2) or 1
            uv=tuple(uvl.data[li].uv) if uvl else (0,0)
            out.append((p,(n[0]/l,n[1]/l,n[2]/l),uv,side[vi]))
    ntri=len(m2.loop_triangles)
    ev2.to_mesh_clear(); bpy.data.objects.remove(o2); bpy.data.meshes.remove(me)
    return out,ntri
def tri_count(obj): return sum(len(p.vertices)-2 for p in obj.data.polygons)
def find(n): return objs.get(n)
res={'pivot':None,'variants':[]}
pb=arm.pose.bones['upperarm_l']; sh=w2g(arm.matrix_world@pb.head)
res['pivot']=[abs(sh[0]),sh[1]]
hand=w2g(arm.matrix_world@arm.pose.bones['hand_l'].head)
for vi,(ti,bi,si,hi) in enumerate(VAR):
    top=CAT['tops'][ti]; bot=CAT['bottoms'][bi]; shoe=CAT['shoes'][si]; hair=CAT['hair'][hi]
    cover=[(k,a,b) for k,a,b in top['cover']+bot['cover']+shoe['cover']]
    V=[]   # (pos,nor,part,cls,shade)
    def add(items, cls, atlas, name):
        if not items: return
        L=[]
        for p,n,uv,sd in items:
            c=samp(TX[atlas],uv) if atlas in TX else (0.5,0.5,0.5,1)
            L.append(lum(c))
        mean=max(1e-3,sum(L)/len(L))
        for (p,n,uv,sd),l in zip(items,L):
            c=cls
            if atlas=='ranger' and cls in (0,3,4):
                em=samp(TX['ranger_em'],uv)
                if lum(em)>0.35: c=5
            sh=max(0.55,min(1.5,l/mean)) if atlas in ('peasant','ranger','skin') else 1.0
            V.append((p,n,sd,c,sh))
    for pn in top['parts']:
        o=find(pn)
        if o: it,_=part_mesh(o, TARGET['top']/max(1,tri_count(o))/len(top['parts'])*1.0); add(it,0,top['atlas'] if top['atlas']in TX else 'peasant',pn)
    for pn in bot['parts']:
        o=find(pn)
        if o:
            it,_=part_mesh(o, TARGET['bot']/max(1,tri_count(o))/len(bot['parts']))
            if pn=='bot_skirt_1': add(it,5,'none',pn)
            else: add(it,3,bot['atlas'] if bot['atlas']in TX else 'none',pn)
    for pn in shoe['parts']:
        o=find(pn)
        if o: it,_=part_mesh(o, TARGET['shoe']/max(1,tri_count(o))); add(it,4,shoe['atlas'] if shoe['atlas']in TX else 'peasant',pn)
    for pn in hair['parts']:
        o=find(pn)
        if o: it,_=part_mesh(o, TARGET['hair']/max(1,tri_count(o))); add(it,2,'none',pn)
    so=find(CAT['skin'])
    it,_=part_mesh(so, TARGET['skin']/max(1,tri_count(so)), cover=cover); add(it,1,'skin','skin')
    # gậy sáng ở tay +x
    R=0.016; Lz=0.55; segs=6; base=Vector((hand[0],hand[1]-0.02,hand[2]+0.02))
    for s in range(segs):
        a0=2*math.pi*s/segs; a1=2*math.pi*(s+1)/segs
        def P(a,h): return (base.x+R*math.cos(a), base.y+h, base.z+R*math.sin(a))
        def Nn(a): return (math.cos(a),0,math.sin(a))
        quad=[(P(a0,-0.12),Nn(a0)),(P(a1,-0.12),Nn(a1)),(P(a1,Lz),Nn(a1)),(P(a0,-0.12),Nn(a0)),(P(a1,Lz),Nn(a1)),(P(a0,Lz),Nn(a0))]
        for p,n in quad: V.append((p,n,3,7,1.0))
    # hàn đỉnh
    idx={}; pos=[];nor=[];part=[];cls=[];shade=[];ind=[]
    for p,n,sd,c,sh in V:
        k=(round(p[0]*400),round(p[1]*400),round(p[2]*400),round(n[0]*8),round(n[1]*8),round(n[2]*8),sd,c,round(sh*20))
        if k not in idx:
            idx[k]=len(pos); pos.append(p); nor.append(n); part.append(sd); cls.append(c); shade.append(sh)
        ind.append(idx[k])
    print(G,vi,'verts',len(pos),'tris',len(ind)//3)
    def b64(a): return base64.b64encode(a.tobytes()).decode()
    res['variants'].append({'g':gk,'n':len(pos),'pos':b64(np.array(pos,dtype=np.float32)),'nor':b64(np.array(nor,dtype=np.float32)),
        'part':b64(np.array(part,dtype=np.uint8)),'cls':b64(np.array(cls,dtype=np.uint8)),'shade':b64(np.array([min(255,int(s*127)) for s in shade],dtype=np.uint8)),'idx':b64(np.array(ind,dtype=np.uint16))})
json.dump(res,open(OUT,'w'),separators=(',',':'))
print('WROTE',OUT,os.path.getsize(OUT))
