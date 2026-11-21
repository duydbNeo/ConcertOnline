import bpy,sys,json
U1='/home/claude/ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'
U2='/home/claude/ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb'
want=json.load(open(sys.argv[1])); out=sys.argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=U1); arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
bpy.ops.import_scene.gltf(filepath=U2)
for o in [o for o in bpy.data.objects if o.type=='MESH']: bpy.data.objects.remove(o)
arm.animation_data_create(); arm.animation_data.action=None
names=[]
for a in list(bpy.data.actions):
    base=a.name.split('|')[-1]; names.append(base)
    if base in want:
        tr=arm.animation_data.nla_tracks.new(); tr.name=want[base]
        tr.strips.new(want[base],0,a); print('KEEP',base,'->',want[base],tuple(a.frame_range))
for a in list(bpy.data.actions):
    if a.name.split('|')[-1] not in want: bpy.data.actions.remove(a)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type=='ARMATURE': o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_extras=False)
print('ALL',sorted(set(names)))
