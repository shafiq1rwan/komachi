"""Reference-landmark polygon mesh for the three-view Komachi character sheet.

Coordinates below are authored in the displayed reference's 1774 x 887 space.
Front centre = x330, side spine = x876, soles = y788, crown = y76.
One authoring unit = 210 reference pixels. This module builds editable surfaces;
the caller handles the rig, studio, reference planes and glTF export.
"""
import math
import bpy
from mathutils import Vector

PX = 210.0
HEIGHT = 712 / PX

def z(py):
    return (788-py)/PX

def x(px):
    return (px-330)/PX

def depth(px):
    return (px-876)/PX

def build(mesh_part, ellipsoid, box, linear_hex, colors):
    def mesh(name, vertices, faces, color, bone='chest'):
        obj=mesh_part(name,vertices,faces,color,bone)
        obj['reference']='human-orthographic-reference.png'
        return obj

    def surface(name, loops, color, bone='chest', cap=True):
        n=len(loops[0])
        vertices=[p for loop in loops for p in loop]
        faces=[]
        for j in range(len(loops)-1):
            for i in range(n):
                a=j*n+i; b=j*n+(i+1)%n
                faces.append((a,b,b+n,a+n))
        if cap:
            faces.extend([tuple(reversed(range(n))),tuple(range((len(loops)-1)*n,len(loops)*n))])
        return mesh(name,vertices,faces,color,bone)

    def octagon(cx,cy,zz,w,d,bevel):
        return [(cx-w/2+bevel,cy-d/2,zz),(cx+w/2-bevel,cy-d/2,zz),
                (cx+w/2,cy-d/2+bevel,zz),(cx+w/2,cy+d/2-bevel,zz),
                (cx+w/2-bevel,cy+d/2,zz),(cx-w/2+bevel,cy+d/2,zz),
                (cx-w/2,cy+d/2-bevel,zz),(cx-w/2,cy-d/2+bevel,zz)]

    def bone_blend(obj, upper, lower, joint, radius):
        a=obj.vertex_groups[upper]
        b=obj.vertex_groups.new(name=lower)
        for v in obj.data.vertices:
            t=max(0,min(1,(joint+radius-v.co.z)/(2*radius)))
            a.add([v.index],1-t,'REPLACE')
            if t>0:
                b.add([v.index],t,'REPLACE')

    # Face loops combine front widths and side-view forehead, cheek and jaw depths.
    # Extra front columns make broad, softly changing cheek planes instead of a box.
    head_rows=[
        (339, .25, 818,924), (329,.355,797,940), (311,.421,779,956),
        (282,.448,764,973), (247,.452,768,980), (213,.443,777,975),
        (180,.362,794,957), (145,.242,825,930)]
    face_loops=[]
    for py,w,front,back in head_rows:
        fy,by=depth(front),depth(back)
        d=by-fy
        face_loops.append([
            (-w*.64,fy+d*.025,z(py)),(-w*.24,fy,z(py)),(w*.24,fy,z(py)),(w*.64,fy+d*.025,z(py)),
            (w*.94,fy+d*.16,z(py)),(w,fy+d*.39,z(py)),(w*.88,fy+d*.76,z(py)),
            (w*.51,by,z(py)),(-w*.51,by,z(py)),(-w*.88,fy+d*.76,z(py)),
            (-w,fy+d*.39,z(py)),(-w*.94,fy+d*.16,z(py))])
    surface('Face - traced jaw and cheek planes',face_loops,'skin','head')
    ellipsoid('Neck',(0,depth(878),z(348)),(.15,.145,.13),'skin','chest',12,6)
    for sign in (-1,1):
        # Ear positions are cross-checked against the side profile, not guessed from front.
        ellipsoid('Ear', (sign*.515,depth(889),z(276)),(.119,.102,.148),'skin','head',10,6)
        verts=[]
        for yy in (depth(765),depth(767)):
            for i in range(16):
                a=2*math.pi*i/16
                verts.append((sign*(46.5/PX)+.046*math.cos(a),yy,
                              z(258)+.046*math.sin(a)+(.042 if math.sin(a)>=0 else -.042)))
        faces=[tuple(reversed(range(16))),tuple(range(16,32))]
        faces.extend((i,(i+1)%16,(i+1)%16+16,i+16) for i in range(16))
        mesh('Eyes - inset rounded capsules',verts,faces,'eyes','head')

    # Hair: an asymmetric cut edge and staggered polygon rings, with a swept part.
    # Each entry is the visible bottom of the hair at 15-degree angular intervals.
    hair_edge_y=[210,168,216,243,280,288,305,333,332,329,328,332,
                 332,329,333,335,323,305,291,282,275,251,240,233]
    n=len(hair_edge_y)
    loops=[]
    for r in range(1,7):
        loop=[]
        t=r/6
        for i,py in enumerate(hair_edge_y):
            a=2*math.pi*i/n
            if r<6:
                a+=(.044 if r%2 else -.044)
            theta=math.acos(max(-1,min(1,(z(py)-2.71)/.68)))*t
            radius=math.sin(theta)**.72
            xx=.71*radius*math.sin(a)+.04*(1-radius)
            yy=.065+(-.625 if math.cos(a)>0 else -.665)*radius*math.cos(a)
            zz=2.71+.68*math.cos(theta)
            loop.append((xx,yy,zz))
        loops.append(loop)
    hair=surface('Hair - swept crown and full nape',loops,'hair','head',False)
    # Fill the crown with a gently off-centre highest point.
    crown=mesh('Hair crown',[(.04,.045,HEIGHT)]+loops[0],
               [(0,i+1,(i+1)%n+1) for i in range(n)],'hair','head')
    for obj in (hair,crown):
        rgba=linear_hex(colors['hair'])
        for p in obj.data.polygons:
            gain=.945+.07*((p.index*19)%13)/12
            for li in p.loop_indices:
                obj.data.color_attributes['Color'].data[li].color=tuple(c*gain for c in rgba[:3])+(1,)
    # A shallow tapered lock follows the underlying hair surface at the brow.
    mesh('Hair - small swept fringe',[(x(364),-.446,z(173)),(x(316),-.559,z(216)),
                                   (x(284),-.576,z(231)),(x(299),-.571,z(209)),
                                   (x(341),-.510,z(181))],[(0,1,2,3,4)],'hair','head')

    # Shirt is shaped as a tapered cloth volume with a rounded crew neckline.
    shirt_rows=[(554,.65,.37),(506,.65,.395),(424,.60,.41),(379,.52,.35),(365,.32,.29)]
    surface('Undershirt', [octagon(0,.018,z(py),w,d,.06) for py,w,d in shirt_rows],'shirt')
    # Jacket: open at centre-front, sloped shoulders, continuous side and back surfaces.
    jacket_rows=[(560,.49,.225,.14),(515,.477,.232,.14),(453,.447,.238,.13),
                 (401,.401,.228,.14),(372,.337,.195,.155),(352,.194,.163,.155)]
    vs=[]
    for py,w,d,gap in jacket_rows:
        zz=z(py)
        vs.extend([(-gap,-d-.012,zz),(-w*.56,-d,zz),(-w+.03,-d*.83,zz),
                   (-w,-d*.38,zz),(-w,d*.42,zz),(-w*.76,d*.9,zz),
                   (-w*.35,d,zz),(w*.35,d,zz),(w*.76,d*.9,zz),
                   (w,d*.42,zz),(w,-d*.38,zz),(w-.03,-d*.83,zz),
                   (w*.56,-d,zz),(gap,-d-.012,zz)])
    fs=[]
    for j in range(len(jacket_rows)-1):
        for i in range(13):
            a=j*14+i
            fs.append((a,a+1,a+15,a+14))
    jacket=mesh('Jacket - open continuous shell',vs,fs,'jacket')
    mod=jacket.modifiers.new('Cloth edge thickness','SOLIDIFY');mod.thickness=.012
    bpy.context.view_layer.objects.active=jacket
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # Collar ring follows the neck, with two small folded points on the front.
    for sign in (-1,1):
        vs=[(sign*.15,-.174,z(350)),(sign*.31,-.208,z(369)),
            (sign*.294,-.264,z(392)),(sign*.199,-.246,z(376))]
        collar=mesh('Folded collar',vs,[(0,1,2,3)],'jacket')
        mod=collar.modifiers.new('Collar thickness','SOLIDIFY');mod.thickness=.012
        bpy.context.view_layer.objects.active=collar
        bpy.ops.object.modifier_apply(modifier=mod.name)
    mesh('Collar back',[(-.17,.15,z(352)),(.17,.15,z(352)),(.22,.2,z(369)),(-.22,.2,z(369))],[(0,1,2,3)],'jacket')

    arm_points={}
    for sign,side in ((-1,'L'),(1,'R')):
        # Cross sections perpendicular to the arm eliminate the old stepped shoulders.
        centers=[(sign*.353,0,z(378)),(sign*.438,0,z(398)),
                 (sign*.56,0,z(440)),(sign*.672,0,z(480)),(sign*.785,0,z(516))]
        loops=[]
        for idx,(cx,cy,zz) in enumerate(centers):
            w=[.29,.33,.32,.31,.30][idx]
            d=[.335,.36,.35,.32,.305][idx]
            loop=octagon(cx,cy,zz,w,d,.037)
            loops.append([(xx,yy,h+sign*.50*(xx-cx)) for xx,yy,h in loop])
        sleeve=surface('Sleeve - '+side,loops,'jacket','upper_arm.'+side)
        bone_blend(sleeve,'upper_arm.'+side,'forearm.'+side,z(452),.13)
        hand=ellipsoid('Hand - '+side,(sign*.824,-.007,z(549)),(.132,.143,.185),'skin','hand.'+side,10,5)
        hand.rotation_euler.y=sign*-.27
        arm_points[side]=((sign*.347,0,z(379)),(sign*.595,0,z(452)),(sign*.79,0,z(522)))

    # Trousers are a single connected pelvis and two seamless, gently spreading legs.
    left_loops=[];right_loops=[]
    for sign,side in ((-1,'L'),(1,'R')):
        loops=[]
        for py,cx,w,d in [(568,.216,.435,.425),(589,.236,.425,.425),
                          (625,.253,.415,.41),(660,.273,.423,.407),
                          (695,.297,.428,.401),(727,.304,.435,.39)]:
            loops.append(octagon(sign*cx,.024,z(py),w,d,.039))
        leg=surface('Trousers - '+side,loops,'pants','thigh.'+side,False)
        bone_blend(leg,'thigh.'+side,'shin.'+side,z(661),.115)
        # Hidden top is buried in the connected waistband, no separate visible hip block.
        surface('Ankle - '+side,[octagon(sign*.304,.024,z(718),.24,.28,.04),
                                octagon(sign*.304,.024,z(745),.24,.28,.04)],'skin','foot.'+side)
        shoe=surface('Shoe - '+side,[
            octagon(sign*.307,-.065,0,.425,. sixty if False else .60,.065),
            octagon(sign*.307,-.065,z(768),.425,.60,.065),
            octagon(sign*.307,-.045,z(750),.382,.53,.068),
            octagon(sign*.307,.014,z(736),.275,.34,.055)],'shoes','foot.'+side)
    surface('Trousers waistband',[octagon(0,.024,z(550),.85,.405,.07),
                                  octagon(0,.024,z(581),.85,.425,.07)],'pants','hips')

    # Compact satchel with its shoulder strap wrapping over the body, not suspended in air.
    bag=box('Satchel body',(.421,.048,z(536)),(.305,.35,.42),'bag','chest',.032)
    bag.rotation_euler.y=-.16
    # Flap and clasp face away from the body, matching the visible left-side view.
    flap=box('Satchel flap',(.584,.043,z(522)),(.025,.325,.205),'flap','chest',.010)
    flap.rotation_euler.y=-.16
    box('Satchel clasp',(.603,.033,z(539)),(.020,.069,.088),'shoes','chest',.004)
    def ribbon(name,points,width):
        verts=[]
        for i,p in enumerate(points):
            t=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
            edge=Vector((-t.z,0,t.x)).normalized()*width/2
            verts.extend([tuple(Vector(p)-edge),tuple(Vector(p)+edge)])
        obj=mesh(name,verts,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(points)-1)],'bag')
        mod=obj.modifiers.new('Strap thickness','SOLIDIFY');mod.thickness=.008
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    ribbon('Strap front',[(-.292,-.202,z(352)),(-.26,-.256,z(380)),(-.09,-.259,z(431)),
                          (.14,-.266,z(481)),(.30,-.244,z(512))],.103)
    ribbon('Strap back',[(-.292,.183,z(352)),(-.245,.240,z(385)),(.035,.247,z(447)),
                         (.365,.224,z(515))],.103)
    # This bridge has a horizontal width axis even though its tangent follows depth.
    mesh('Strap across shoulder',[(-.34,-.205,z(352)),(-.24,-.205,z(352)),
                                  (-.24,.19,z(350)),(-.34,.19,z(350))],[(0,1,2,3)],'bag')
    return arm_points
