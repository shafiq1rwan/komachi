"""Build the Komachi resident with Blender's background Python API.

Run: blender --background --factory-startup --python scripts/build-resident.py
Coordinates while authoring: Z up, -Y forward. GLB exports Y up, +Z forward.
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'characters'
PREVIEW = ROOT / 'docs' / 'characters'
OUT.mkdir(parents=True, exist_ok=True)
PREVIEW.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.name = 'Resident - editable rig'
scene.render.fps = 24
scene.unit_settings.system = 'METRIC'
parts = []

COLORS = dict(skin='#dca77d', hair='#60483f', jacket='#818d7c',
              shirt='#efe0c9', pants='#626778', shoes='#50433a',
              bag='#b68b51', flap='#b18651', eyes='#493c30')

def linear_hex(h):
    rgb = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c < .04045 else ((c + .055) / 1.055)**2.4 for c in rgb) + (1,)

mat = bpy.data.materials.new('Resident - palette vertex colors')
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .95
bsdf.inputs['Specular IOR Level'].default_value = 0
vc = mat.node_tree.nodes.new('ShaderNodeVertexColor')
vc.layer_name = 'Color'
mat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])

def finish(obj, name, color, bone):
    obj.name = name
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    attr = obj.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    rgba = linear_hex(COLORS[color])
    for item in attr.data:
        item.color = rgba
    for p in obj.data.polygons:
        p.use_smooth = False
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    region = obj.vertex_groups.new(name='region_' + color)
    region.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    parts.append(obj)
    return obj

def box(name, loc, size, color, bone='chest', bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Single bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, color, bone)

def ellipsoid(name, loc, scale, color, bone='head', segments=12, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, color, bone)

def mesh_part(name, vertices, faces, color, bone='chest'):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    return finish(obj, name, color, bone)

def segment(name, start, end, width, depth, color, bone, bevel=.015):
    start, end = Vector(start), Vector(end)
    obj = box(name, (start + end) / 2, (width, depth, (end-start).length), color, bone, bevel)
    obj.rotation_euler = (end-start).to_track_quat('Z', 'Y').to_euler()
    return obj

def rings_mesh(name, rings, color, bone='chest'):
    """Connected beveled rectangular cross sections: no seams at animated joints."""
    verts = []
    for x,y,z,w,d,b in rings:
        verts.extend([(x-w/2+b,y-d/2,z),(x+w/2-b,y-d/2,z),
                      (x+w/2,y-d/2+b,z),(x+w/2,y+d/2-b,z),
                      (x+w/2-b,y+d/2,z),(x-w/2+b,y+d/2,z),
                      (x-w/2,y+d/2-b,z),(x-w/2,y-d/2+b,z)])
    faces = [tuple(reversed(range(8)))]
    for j in range(len(rings)-1):
        for i in range(8):
            a=j*8+i; b=j*8+(i+1)%8
            faces.append((a,b,b+8,a+8))
    faces.append(tuple(range((len(rings)-1)*8,len(rings)*8)))
    return mesh_part(name,verts,faces,color,bone)

def blend_bones(obj, upper, lower, joint_z, radius):
    """Blend a continuous limb around the bend while leaving the silhouette intact."""
    a=obj.vertex_groups[upper]
    b=obj.vertex_groups.new(name=lower)
    for v in obj.data.vertices:
        t=max(0,min(1,(joint_z+radius-v.co.z)/(2*radius)))
        a.add([v.index],1-t,'REPLACE')
        if t:
            b.add([v.index],t,'REPLACE')

# Model at 3.4 authoring units, then bake to 0.35 game units before rigging.
box('Hip', (0, 0, 1.105), (.72, .40, .23), 'pants', 'hips', .015)
for sign, side in ((-1, 'L'), (1, 'R')):
    leg = rings_mesh('Continuous trouser '+side, [
        (sign*.22,0,1.19,.38,.40,.045),
        (sign*.24,0,.94,.37,.39,.045),
        (sign*.255,0,.73,.37,.375,.045),
        (sign*.27,0,.60,.38,.365,.043),
        (sign*.29,-.012,.29,.40,.36,.040)], 'pants','thigh.'+side)
    blend_bones(leg,'thigh.'+side,'shin.'+side,.68,.12)
    box('Ankle '+side,(sign*.29,0,.257),(.22,.25,.105),'skin','foot.'+side,.015)
    rings_mesh('Faceted shoe '+side, [
        (sign*.29,-.078,0,.43,.53,.065),
        (sign*.29,-.078,.105,.43,.53,.065),
        (sign*.29,-.060,.20,.37,.46,.075),
        (sign*.29,.006,.245,.28,.30,.05)], 'shoes','foot.'+side)

# A cream inset between the two open jacket panels.
box('Cream undershirt', (0, -.002, 1.58), (.70, .405, .92), 'shirt', bevel=.045)
# One continuous open jacket shell, with a sloped shoulder and lightly flared hem.
verts=[]
jacket_rings=[(1.12,.45,.228,.15),(1.36,.44,.235,.145),
              (1.80,.405,.23,.16),(2.015,.35,.185,.17),(2.10,.22,.145,.17)]
for z,w,d,gap in jacket_rings:
    verts.extend([(-gap,-d-.007,z),(-w+.045,-d,z),(-w,-d+.05,z),
                  (-w,d-.05,z),(-w+.05,d,z),(w-.05,d,z),
                  (w,d-.05,z),(w,-d+.05,z),(w-.045,-d,z),(gap,-d-.007,z)])
faces=[]
for j in range(len(jacket_rings)-1):
    for i in range(9):
        a=j*10+i
        faces.append((a,a+1,a+11,a+10))
jacket=mesh_part('Continuous open jacket',verts,faces,'jacket')
solid=jacket.modifiers.new('Cloth thickness','SOLIDIFY')
solid.thickness=.012
bpy.context.view_layer.objects.active=jacket
bpy.ops.object.modifier_apply(modifier=solid.name)
for sign in (-1, 1):
    # Small laid-down collar rather than the first version's oversized lapels.
    v = [(sign*.15,-.173,2.105),(sign*.335,-.224,2.025),(sign*.225,-.259,1.94),
         (sign*.15,-.15,2.105),(sign*.335,-.201,2.025),(sign*.225,-.236,1.94)]
    mesh_part('Jacket lapel', v, [(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)], 'jacket')
ellipsoid('Neck', (0, 0, 2.125), (.18,.16,.17), 'skin', 'chest', 10, 4)

arm_points = {}
for sign, side in ((-1, 'L'), (1, 'R')):
    shoulder = (sign*.365, 0, 1.995)
    elbow = (sign*.59, 0, 1.635)
    wrist = (sign*.77, -.005, 1.32)
    arm_points[side] = (shoulder, elbow, wrist)
    sleeve=rings_mesh('Continuous sleeve '+side,[
        (sign*.345,0,2.025,.235,.30,.045),
        (sign*.445,0,1.92,.29,.36,.045),
        (sign*.565,0,1.70,.29,.34,.035),
        (sign*.64,0,1.565,.28,.32,.03),
        (sign*.77,-.005,1.34,.26,.285,.025)],'jacket','upper_arm.'+side)
    centers=[sign*x for x in (.345,.445,.565,.64,.77)]
    for vertex in sleeve.data.vertices:
        vertex.co.z += sign*.48*(vertex.co.x-centers[vertex.index//8])
    blend_bones(sleeve,'upper_arm.'+side,'forearm.'+side,1.635,.11)
    ellipsoid('Mitten hand '+side, (sign*.815, -.012, 1.21), (.135,.135,.18), 'skin', 'hand.'+side, 8, 4)

# Broad front planes and rounded-square jaw matching the front reference.
rings_mesh('Faceted face',[
    (0,-.032,2.155,.47,.39,.10),
    (0,-.048,2.22,.78,.58,.13),
    (0,-.056,2.33,1.00,.69,.16),
    (0,-.056,2.66,1.09,.76,.16),
    (0,-.010,2.95,.94,.65,.17),
    (0,.015,3.13,.70,.50,.17),
    (0,.02,3.22,.39,.34,.10)],'skin','head')
for sign in (-1,1):
    ellipsoid('Ear', (sign*.535,-.13,2.48), (.12,.105,.15), 'skin', segments=8, rings=4)
    # Extruded capsules sit directly on the flat face, without projecting blocks.
    ev=[]
    for y in (-.443,-.432):
        for i in range(12):
            a=2*math.pi*i/12
            ev.append((sign*.218+.043*math.cos(a),y,2.57+.043*math.sin(a)+(.043 if math.sin(a)>0 else -.043)))
    ef=[tuple(reversed(range(12))),tuple(range(12,24))]
    ef.extend((i,(i+1)%12,(i+1)%12+12,i+12) for i in range(12))
    mesh_part('Inset capsule eye',ev,ef,'eyes','head')

# A fitted polygonal cap: shallow forehead, lower sides and nape; no hidden full sphere.
n = 20
cap_rings = 5
vertices = [(.06,.035,3.39)]
# Integrated hairline: a swept diagonal fringe and a full rounded nape.
hairline=[2.86,3.02,2.87,2.65,2.43,2.24,2.20,2.24,2.25,2.24,
          2.24,2.22,2.23,2.25,2.24,2.25,2.38,2.55,2.64,2.72]
for ring in range(cap_rings):
    for i in range(n):
        a = 2*math.pi*i/n
        if ring < cap_rings-1:
            a += .065 * (1 if ring%2 else -1)
        end_theta=math.acos((hairline[i]-2.76)/.63)
        theta=end_theta*(ring+1)/cap_rings
        radius=math.sin(theta)**.65
        vertices.append((.69*radius*math.sin(a)+.035*(1-radius),
                         .055-.565*radius*math.cos(a),2.76+.63*math.cos(theta)))
faces = [(0,1+i,1+(i+1)%n) for i in range(n)]
for ring in range(cap_rings-1):
    for i in range(n):
        a,b = 1+ring*n+i, 1+ring*n+(i+1)%n
        faces.append((a,a+n,b+n,b))
hair=mesh_part('Integrated swept hair', vertices, faces, 'hair', 'head')
hair_color=linear_hex(COLORS['hair'])
for poly in hair.data.polygons:
    value=.94+.09*((poly.index*37)%17)/16
    for loop in poly.loop_indices:
        hair.data.color_attributes['Color'].data[loop].color=tuple(c*value for c in hair_color[:3])+(1,)
# Very shallow secondary fringe follows the cap rather than jutting out like spikes.
mesh_part('Small swept lock', [(.17,-.438,3.055),(-.19,-.518,2.76),
                             (-.07,-.515,2.81),(.12,-.447,3.02)],[(0,1,2),(0,2,3)],'hair','head')

# Satchel is attached to the chest so it follows torso sway; broad strap front and back.
bag = box('Satchel', (.445,-.10,1.215), (.34,.31,.43), 'bag', bevel=.032)
bag.rotation_euler.y = -.16
flap=box('Satchel flap', (.452,-.266,1.31), (.33,.03,.20), 'flap', bevel=.012)
flap.rotation_euler.y=-.16
box('Satchel clasp', (.487,-.287,1.255), (.063,.015,.085), 'shoes', bevel=.004)
# Flat ribbon laid over the chest, curved around the shoulder in short connected spans.
def ribbon(name, points, width):
    v=[]
    for i,p in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        edge=Vector((-tangent.z,0,tangent.x)).normalized()*width/2
        v.extend([tuple(Vector(p)-edge),tuple(Vector(p)+edge)])
    f=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)]
    return mesh_part(name,v,f,'bag')
ribbon('Broad front strap',[(-.30,-.265,2.09),(-.23,-.278,1.935),(-.04,-.277,1.69),
                            (.19,-.27,1.45),(.36,-.287,1.30)],.095)
ribbon('Broad back strap',[(-.30,.185,2.09),(-.25,.243,1.96),(.02,.255,1.65),(.40,.255,1.33)],.095)
segment('Shoulder strap',(-.30,-.265,2.09),(-.30,.18,2.09),.095,.014,'bag','chest',.002)

# Join all color regions into one mesh / material for one render primitive.
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.object
body.name = 'ResidentMesh'
scene.cursor.location = (0,0,0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
SCALE = .35 / 3.39
body.scale = (SCALE,)*3
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# Recalculate outward normals for the custom lapels and cap.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')

bpy.ops.object.armature_add(enter_editmode=True, location=(0,0,0))
rig = bpy.context.object
rig.name = 'KomachiResident'
rig.data.name = 'ResidentSkeleton'
rig.data.edit_bones.remove(rig.data.edit_bones[0])
def bone(name, head, tail, parent=None):
    b = rig.data.edit_bones.new(name)
    b.head, b.tail = Vector(head)*SCALE, Vector(tail)*SCALE
    if parent:
        b.parent = rig.data.edit_bones[parent]
    return b
bone('root',(0,0,0),(0,0,.25))
bone('hips',(0,0,1.15),(0,0,1.45),'root')
bone('chest',(0,0,1.45),(0,0,2.14),'hips')
bone('head',(0,0,2.14),(0,0,3.15),'chest')
for sign, side in ((-1,'L'),(1,'R')):
    x = sign*.235
    bone('thigh.'+side,(x,0,1.15),(x,0,.68),'hips')
    bone('shin.'+side,(x,0,.68),(x,0,.24),'thigh.'+side)
    bone('foot.'+side,(x,0,.24),(x,-.27,.12),'shin.'+side)
    shoulder,elbow,wrist = arm_points[side]
    bone('upper_arm.'+side,shoulder,elbow,'chest')
    bone('forearm.'+side,elbow,wrist,'upper_arm.'+side)
    bone('hand.'+side,wrist,(sign*.835,-.012,1.17),'forearm.'+side)
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front = True
rig.data.display_type = 'STICK'
body.parent = rig
mod = body.modifiers.new('Resident skeleton', 'ARMATURE')
mod.object = rig
rig['description'] = 'Komachi human resident. Rest A-pose. Y-up / +Z-forward after GLB export.'
rig['height_game_units'] = .35
rig['palette'] = json.dumps(COLORS)

def reset_pose():
    for p in rig.pose.bones:
        p.rotation_mode = 'XYZ'
        p.rotation_euler = (0,0,0)
        p.location = (0,0,0)

def action(name, length, walk=False):
    rig.animation_data_create()
    rig.animation_data.action = None
    reset_pose()
    a = bpy.data.actions.new(name)
    rig.animation_data.action = a
    for frame in range(1, length+1, 3):
        t = (frame-1)/(length-1)*2*math.pi
        reset_pose()
        # Rest arms are lowered slightly for the animated stance.
        for sign,side in ((-1,'L'),(1,'R')):
            rig.pose.bones['upper_arm.'+side].rotation_euler.z = sign*-.18
            if walk:
                phase = t if sign == 1 else t+math.pi
                rig.pose.bones['thigh.'+side].rotation_euler.x = .34*math.sin(phase)
                rig.pose.bones['shin.'+side].rotation_euler.x = -.42*max(0,math.sin(phase))
                rig.pose.bones['upper_arm.'+side].rotation_euler.x = -.23*math.sin(phase)
                rig.pose.bones['forearm.'+side].rotation_euler.x = -.07
        rig.pose.bones['hips'].location.y = (.018*(1-math.cos(2*t)) if walk else .007*math.sin(t))*SCALE
        rig.pose.bones['chest'].rotation_euler.y = .035*math.sin(t) if walk else .012*math.sin(t)
        for p in rig.pose.bones:
            p.keyframe_insert(data_path='rotation_euler', frame=frame, group=p.name)
            p.keyframe_insert(data_path='location', frame=frame, group=p.name)
    a.use_fake_user = True
    slot = rig.animation_data.action_slot
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, a)
    strip.action_slot = slot
    track.mute = True
    return a

action('Idle', 49)
action('Walk', 25, True)
rig.animation_data.action = None
reset_pose()
scene.frame_set(1)
scene.frame_end = 49

# Camera and lighting are kept in the editable source, excluded from GLB selection.
def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = linear_hex(color)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = linear_hex(color)
    p.inputs['Roughness'].default_value = 1
    return m

def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def setup_studio(s, width, height):
    s.render.engine = 'CYCLES'
    s.cycles.samples = 32
    s.cycles.use_denoising = True
    s.render.resolution_x, s.render.resolution_y = width,height
    s.render.resolution_percentage = 100
    s.render.image_settings.file_format = 'PNG'
    s.world = bpy.data.worlds.new(s.name+' world')
    s.world.use_nodes = True
    s.world.node_tree.nodes['Background'].inputs[0].default_value = (.75,.80,.85,1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value = .8
    s.view_settings.view_transform = 'Standard'
    for name, loc, power, size in [('Key',(-.7,-1,1.4),10,1.2),('Fill',(.8,-.2,.7),3,1.0)]:
        data = bpy.data.lights.new(s.name+' '+name,'AREA')
        data.energy, data.shape, data.size = power,'DISK',size
        light = bpy.data.objects.new(data.name,data)
        s.collection.objects.link(light)
        light.location = loc
        aim(light,(0,0,.15))
    data = bpy.data.cameras.new(s.name+' camera')
    camera = bpy.data.objects.new(data.name,data)
    s.collection.objects.link(camera)
    camera.location = (.60,-1,.54)
    aim(camera,(0,0,.175))
    data.type = 'ORTHO'
    data.ortho_scale = .49
    s.camera = camera
    mesh = bpy.data.meshes.new(s.name+' ground')
    mesh.from_pydata([(-200,-200,-.001),(200,-200,-.001),(200,200,-.001),(-200,200,-.001)],[],[(0,1,2,3)])
    ground = bpy.data.objects.new(s.name+' ground',mesh)
    s.collection.objects.link(ground)
    groundmat=material(s.name+' cream','#f7efe2')
    groundshader=groundmat.node_tree.nodes.get('Principled BSDF')
    groundshader.inputs['Emission Color'].default_value=linear_hex('#f7efe2')
    groundshader.inputs['Emission Strength'].default_value=.20
    ground.data.materials.append(groundmat)
    return camera

camera = setup_studio(scene, 1100, 1100)
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'komachi-resident.glb'), export_format='GLB',
    use_selection=True, export_animations=True, export_animation_mode='ACTIONS',
    export_force_sampling=True, export_skins=True, export_yup=True,
    export_cameras=False, export_lights=False)
body.data.calc_loop_triangles()
stats = {'height':round(body.dimensions.z,6),'vertices':len(body.data.vertices),
         'triangles':len(body.data.loop_triangles),'bones':len(rig.data.bones),
         'materials':len(body.data.materials),'animations':['Idle','Walk'],
         'export_forward':'+Z','export_up':'+Y'}
(OUT/'komachi-resident.stats.json').write_text(json.dumps(stats,indent=2)+'\n')

# Pack the original reference as a viewport-only modeling aid.
reference_path = PREVIEW/'human-resident-reference.png'
if reference_path.exists():
    ref = bpy.data.objects.new('Reference - generated turnaround', None)
    scene.collection.objects.link(ref)
    ref.empty_display_type = 'IMAGE'
    ref.data = bpy.data.images.load(str(reference_path))
    ref.data.pack()
    ref.empty_display_size = 1.0
    ref.location = (0,.32,.20)
    ref.rotation_euler = (math.pi/2,0,0)
    ref.hide_render = True
    ref.hide_set(True)

# Turnaround scene uses static copies of the bind mesh, leaving the rig untouched.
sheet = bpy.data.scenes.new('Resident - turnaround')
sheetcam = setup_studio(sheet, 1800, 800)
sheetcam.location = (0,-1.5,.25)
aim(sheetcam,(0,0,.174))
sheetcam.data.ortho_scale = 1.03
for x,angle,name in [(-.35,0,'Front'),(-.115,-math.pi/2,'Side'),(.12,math.pi,'Back'),(.35,-math.pi/4,'Three-quarter')]:
    obj = bpy.data.objects.new(name, body.data)
    sheet.collection.objects.link(obj)
    obj.location.x = x
    obj.rotation_euler.z = angle

bpy.context.window.scene = scene
# Start Blender in material preview, framed on the character.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.shading.type = 'MATERIAL'
            area.spaces.active.region_3d.view_distance = .70
            area.spaces.active.region_3d.view_location = Vector((0,0,.18))
            area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
scene.render.filepath = str(PREVIEW/'komachi-resident-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'komachi-resident.blend'))
bpy.ops.render.render(write_still=True)
bpy.context.window.scene = sheet
sheet.render.filepath = str(PREVIEW/'komachi-resident-turnaround.png')
bpy.ops.render.render(write_still=True)
print('RESIDENT_STATS',json.dumps(stats))
bpy.context.window.scene=scene
rig.animation_data.action=bpy.data.actions['Walk']
rig.animation_data.action_slot=rig.animation_data.nla_tracks['Walk'].strips[0].action_slot
scene.frame_set(7)
scene.render.filepath=str(PREVIEW/'komachi-resident-walk.png')
bpy.ops.render.render(write_still=True)
