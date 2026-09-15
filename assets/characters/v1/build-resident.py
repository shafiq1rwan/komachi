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

COLORS = dict(skin='#d9a77f', hair='#4a3c36', jacket='#7f9b7a',
              shirt='#f3e6cf', pants='#6b6f7a', shoes='#4a4340',
              bag='#b98a5b', flap='#a3764a', eyes='#2f2a2a')

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

# Model at 3.4 authoring units, then bake to 0.35 game units before rigging.
box('Hip', (0, 0, 1.15), (.68, .39, .26), 'pants', 'hips')
for sign, side in ((-1, 'L'), (1, 'R')):
    x = sign * .235
    box('Trouser upper ' + side, (x, 0, .91), (.34, .38, .53), 'pants', 'thigh.'+side, .025)
    box('Trouser lower ' + side, (x, 0, .46), (.31, .35, .46), 'pants', 'shin.'+side, .022)
    box('Shoe ' + side, (x, -.075, .13), (.35, .51, .26), 'shoes', 'foot.'+side, .065)

# A cream inset between the two open jacket panels.
box('Cream undershirt', (0, -.006, 1.65), (.69, .43, .91), 'shirt', bevel=.045)
box('Jacket back', (0, .16, 1.68), (.85, .2, .96), 'jacket', bevel=.04)
for sign in (-1, 1):
    panel = box('Jacket front', (sign*.267, -.155, 1.65), (.31, .21, .94), 'jacket', bevel=.025)
    panel.rotation_euler.y = sign * -.045
    # Broad triangular lapels, visible even at modest zoom.
    v = [(sign*.09, -.29, 2.12), (sign*.32, -.27, 2.04), (sign*.18, -.285, 1.86),
         (sign*.09, -.24, 2.12), (sign*.32, -.22, 2.04), (sign*.18, -.235, 1.86)]
    mesh_part('Jacket lapel', v, [(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)], 'jacket')
ellipsoid('Neck', (0, 0, 2.14), (.16,.16,.19), 'skin', 'chest', 8, 4)

arm_points = {}
for sign, side in ((-1, 'L'), (1, 'R')):
    shoulder = (sign*.43, 0, 2.015)
    elbow = (sign*.62, 0, 1.66)
    wrist = (sign*.78, -.012, 1.36)
    arm_points[side] = (shoulder, elbow, wrist)
    segment('Upper sleeve '+side, shoulder, elbow, .29, .36, 'jacket', 'upper_arm.'+side, .025)
    segment('Lower sleeve '+side, elbow, wrist, .255, .31, 'jacket', 'forearm.'+side, .018)
    ellipsoid('Mitten hand '+side, (sign*.815, -.012, 1.28), (.145,.145,.19), 'skin', 'hand.'+side, 8, 4)

ellipsoid('Faceted head', (0, -.012, 2.68), (.565,.445,.60), 'skin', segments=12, rings=8)
for sign in (-1,1):
    ellipsoid('Ear', (sign*.53, .002, 2.58), (.115,.095,.16), 'skin', segments=8, rings=4)
    eye = box('Eye', (sign*.186, -.443, 2.66), (.064,.025,.134), 'eyes', 'head', .022)

# A fitted polygonal cap: shallow forehead, lower sides and nape; no hidden full sphere.
n = 16
cap_rings = 5
vertices = [(0, .025, 3.39)]
for ring in range(cap_rings):
    for i in range(n):
        a = 2*math.pi*i/n
        front = max(0, math.cos(a))
        theta = (2.04 - .89*front**3) * (ring+1)/cap_rings
        vertices.append((.635*math.sin(theta)*math.sin(a),
                         .025-.535*math.sin(theta)*math.cos(a),
                         2.69+.70*math.cos(theta)))
faces = [(0,1+i,1+(i+1)%n) for i in range(n)]
for ring in range(cap_rings-1):
    for i in range(n):
        a,b = 1+ring*n+i, 1+ring*n+(i+1)%n
        faces.append((a,a+n,b+n,b))
mesh_part('Hair cap', vertices, faces, 'hair', 'head')
# Three asymmetric wedges imply the reference's swept fringe, without fine strands.
for verts in [
    [(-.44,-.385,3.05),(-.10,-.475,3.12),(-.37,-.477,2.79),(-.35,-.36,3.00)],
    [(-.20,-.475,3.13),(.21,-.465,3.13),(-.20,-.522,2.86),(-.10,-.43,3.02)],
    [(.16,-.457,3.12),(.46,-.35,3.04),(.43,-.422,2.86),(.24,-.39,3.00)]]:
    mesh_part('Swept fringe', verts, [(0,1,2),(0,3,1),(1,3,2),(2,3,0)], 'hair', 'head')

# Satchel is attached to the chest so it follows torso sway; broad strap front and back.
bag = box('Satchel', (.48,-.17,1.26), (.38,.29,.43), 'bag', bevel=.035)
bag.rotation_euler.y = -.10
box('Satchel flap', (.48,-.324,1.365), (.37,.035,.20), 'flap', bevel=.018)
box('Satchel clasp', (.49,-.349,1.31), (.065,.018,.09), 'shoes', bevel=.007)
segment('Front strap', (-.32,-.29,2.075), (.50,-.345,1.45), .087,.025, 'bag','chest', .004)
segment('Back strap', (-.32,.28,2.075), (.50,.28,1.45), .087,.025, 'bag','chest', .004)
segment('Shoulder strap', (-.32,-.28,2.085), (-.32,.28,2.085), .087,.025, 'bag','chest', .004)

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
    s.world.node_tree.nodes['Background'].inputs[1].default_value = .35
    s.view_settings.view_transform = 'AgX'
    for name, loc, power, size in [('Key',(-.7,-1,1.4),25,1.2),('Fill',(.8,-.2,.7),6,1.0)]:
        data = bpy.data.lights.new(s.name+' '+name,'AREA')
        data.energy, data.shape, data.size = power,'DISK',size
        light = bpy.data.objects.new(data.name,data)
        s.collection.objects.link(light)
        light.location = loc
        aim(light,(0,0,.15))
    data = bpy.data.cameras.new(s.name+' camera')
    camera = bpy.data.objects.new(data.name,data)
    s.collection.objects.link(camera)
    camera.location = (.60,-1,.61)
    aim(camera,(0,0,.175))
    data.type = 'ORTHO'
    data.ortho_scale = .49
    s.camera = camera
    mesh = bpy.data.meshes.new(s.name+' ground')
    mesh.from_pydata([(-200,-200,-.001),(200,-200,-.001),(200,200,-.001),(-200,200,-.001)],[],[(0,1,2,3)])
    ground = bpy.data.objects.new(s.name+' ground',mesh)
    s.collection.objects.link(ground)
    ground.data.materials.append(material(s.name+' cream','#f7efe2'))
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
sheetcam.location = (0,-1.5,.55)
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
