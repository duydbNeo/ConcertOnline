import bpy
U1='/home/claude/ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'
U2='/home/claude/ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=U1); arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
b=set(bpy.data.actions); bpy.ops.import_scene.gltf(filepath=U2)
want={'Idle_Loop':'idle','Dance_Loop':'dance','Idle_Talking_Loop':'talk','Walk_Loop':'walk','Idle_FoldArms_Loop':'fold','Yes':'yes','Jog_Fwd_Loop':'jog','A_TPose':'tpose'}
for o in [o for o in bpy.data.objects if o.type=='MESH']: bpy.data.objects.remove(o)
arm.animation_data_create(); arm.animation_data.action=None
n=0
for a in list(bpy.data.actions):
    base=a.name.split('|')[-1]
    if base in want:
        tr=arm.animation_data.nla_tracks.new(); tr.name=want[base]
        st=tr.strips.new(want[base],0,a); n+=1
        print('KEEP',a.name,'->',want[base],tuple(a.frame_range))
for a in list(bpy.data.actions):
    if not a.name.split('|')[-1] in want: bpy.data.actions.remove(a)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type=='ARMATURE': o.select_set(True)
bpy.ops.export_scene.gltf(filepath='/home/claude/kit/anim.glb',export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_extras=False)
print('DONE',n)
