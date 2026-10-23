"""Build the original PachiAruCG seated character with Blender 4.3+.

Run: blender -b --python tools/build-character.py
Authoring coordinates use the browser's metres / Y up / facing -Z. The helper
converts them to Blender Z up; glTF restores the browser coordinates on export.
No reference photograph or rendered screenshot is included in this asset.
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def p(v):
    x, y, z = v
    return Vector((x, -z, y))

def srgb(n):
    return n / 12.92 if n <= .04045 else ((n + .055) / 1.055) ** 2.4

def material(name, color, rough=.7, metal=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    rgb = tuple(srgb(int(color[i:i+2],16) / 255) for i in (0,2,4))
    bsdf.inputs['Base Color'].default_value = (*rgb,1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if name == 'Warm peach skin':
        bsdf.inputs['Subsurface Weight'].default_value = .085
        bsdf.inputs['Subsurface Radius'].default_value = (.5,.25,.12)
    mat.diffuse_color = (*rgb,1)
    return mat

skin = material('Warm peach skin','F1BD91',.61)
shirt = material('Ivory cotton','F4EFE5',.89)
seam = material('Cotton stitching','D9D3C8',.92)
trouser = material('Ink blue wool','303D50',.88)
shoe = material('Soft black leather','272C32',.39)
sole = material('Charcoal rubber','202329',.9)
tie = material('Quiet blue tie','657A91',.83)
eye_mat = material('Eyes','242126',.31)
mouth_mat = material('Mouth interior','652A2C',.88)
rim = material('Unbranded glasses','39322E',.36)

def smooth(obj, mat=None):
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    return obj

def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata([p(v) for v in vertices],[],faces)
    data.update()
    obj = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    return smooth(obj,mat)

def ellipsoid(name, center, scale, mat, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=p(center))
    obj=bpy.context.object
    obj.name=name
    obj.scale=(scale[0],scale[2],scale[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return smooth(obj,mat)

def curve(name, points, radius, mat, resolution=3):
    data=bpy.data.curves.new(name,'CURVE')
    data.dimensions='3D'
    data.resolution_u=12
    data.bevel_depth=radius
    data.bevel_resolution=resolution
    spline=data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for bp,co in zip(spline.bezier_points,points):
        bp.co=p(co)
        bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return smooth(obj,mat)

def loft(name, sections, mat, sides=32):
    # Each section is (center, halfwidth, halfdepth), with parallel transport
    # keeping the cross sections smoothly oriented through bent joints.
    verts=[];faces=[]
    centers=[Vector(c) for c,_,_ in sections]
    for i,(co,a,b) in enumerate(sections):
        tangent=(centers[min(i+1,len(centers)-1)]-centers[max(0,i-1)]).normalized()
        u=Vector((1,0,0))
        u=(u-tangent*u.dot(tangent)).normalized()
        v=tangent.cross(u).normalized()
        for j in range(sides):
            theta=j*2*math.pi/sides
            q=Vector(co)+u*math.cos(theta)*a+v*math.sin(theta)*b
            verts.append(tuple(q))
        if i:
            for j in range(sides):
                k=(j+1)%sides
                faces.append(((i-1)*sides+j,(i-1)*sides+k,i*sides+k,i*sides+j))
    faces.append(tuple(range(sides-1,-1,-1)))
    faces.append(tuple((len(sections)-1)*sides+j for j in range(sides)))
    return mesh(name,verts,faces,mat)

def union(name, objects, mat, voxel=.008, iterations=4, decimate=.6):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    obj=bpy.context.object;obj.name=name
    remesh=obj.modifiers.new('Sculpted continuous surface','REMESH')
    remesh.mode='VOXEL';remesh.voxel_size=voxel;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    modifier=obj.modifiers.new('Relaxed cloth and joints','SMOOTH')
    modifier.factor=.65;modifier.iterations=iterations
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    if decimate < 1:
        modifier=obj.modifiers.new('Mobile topology','DECIMATE');modifier.ratio=decimate
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return smooth(obj,mat)

def rounded_box(name, center, scale, mat, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p(center))
    obj=bpy.context.object;obj.name=name
    obj.scale=(scale[0],scale[2],scale[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=obj.modifiers.new('Soft sewn edge','BEVEL');mod.width=bevel;mod.segments=4
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return smooth(obj,mat)

# Sculpted pear-shaped body with a gentle cloth roll at the waist. The neck and
# sleeves fuse into this surface rather than intersecting as separate primitives.
torso=loft('Shirt sculpt',[
    ((0,.535,.735),.13,.13),((0,.56,.735),.171,.155),
    ((0,.64,.72),.191,.171),((0,.73,.715),.202,.172),
    ((0,.82,.715),.191,.153),((0,.91,.715),.178,.138),
    ((0,.98,.715),.18,.12),((0,1.015,.72),.145,.095),
    ((0,1.04,.72),.092,.072),((0,1.045,.72),.06,.055)
],shirt,48)
shirt_parts=[torso]
arm_sections={}
for side,suffix in [(-1,'L'),(1,'R')]:
    elbow=(side*.255,.825,.425)
    wrist=(side*(.26 if side<0 else .16),.81,.33 if side<0 else .29)
    shoulder=(side*.17,1.00,.695)
    arm_sections[suffix]=(shoulder,elbow,wrist)
    shirt_parts.append(loft('Sleeve sculpt '+suffix,[
        ((side*.14,1.00,.705),.095,.095),
        ((side*.195,.975,.66),.092,.088),
        ((side*.232,.92,.565),.083,.077),
        ((side*.253,.86,.455),.076,.073),
        ((side*.255,.845,.435),.076,.073)
    ],shirt))
body=union('Shirt',shirt_parts,shirt,voxel=.006,iterations=5,decimate=.35)

arms=[]
for side,suffix in [(-1,'L'),(1,'R')]:
    shoulder,elbow,wrist=arm_sections[suffix]
    x=wrist[0]
    forearm=loft('Forearm '+suffix,[
        ((side*.255,.86,.46),.063,.063),
        ((side*.255,.83,.415),.066,.067),
        ((side*.244,.815,.37),.063,.061),
        ((x*.98,.815,wrist[2]+.035),.048,.043),
        (wrist,.038,.036),
        ((x,.807,wrist[2]-.025),.038,.034),
    ],skin)
    hand_parts=[forearm,
      ellipsoid('Palm '+suffix,(x,.808,wrist[2]-.046),(.052,.035,.067),skin),
      ellipsoid('Thumb '+suffix,(x-side*.037,.814,wrist[2]-.065),(.028,.026,.039),skin)]
    # Four short, soft fingers emerge from the same sculpted hand mesh.
    for finger in range(4):
        fx=x+(finger-1.5)*.021
        finger_z=wrist[2]-.095+abs(finger-1.5)*.007
        hand_parts.append(ellipsoid('Finger', (fx,.80,finger_z),(.014,.026,.029),skin,20,12))
    arms.append(union('SkinArm_'+suffix,hand_parts,skin,voxel=.0038,iterations=3,decimate=.30))
    # The rolled hem gives the sleeve believable cloth thickness at the skin.
    cuff=loft('RolledCuff_'+suffix,[
      ((side*.252,.867,.469),.078,.076),
      ((side*.255,.85,.44),.079,.077),
      ((side*.255,.839,.425),.074,.073)
    ],shirt)
    arms.append(cuff)

# A single smoothly blended trouser mesh; the thighs sit above the cushion,
# with knees forward and shins descending to feet entirely above the floor.
pants_parts=[ellipsoid('Seated trouser hip',(0,.535,.73),(.18,.105,.18),trouser)]
for side,suffix in [(-1,'L'),(1,'R')]:
    pants_parts.append(loft('Trouser leg '+suffix,[
      ((side*.093,.54,.74),.105,.094),
      ((side*.115,.53,.64),.11,.098),
      ((side*.128,.51,.48),.102,.094),
      ((side*.14,.49,.34),.096,.091),
      ((side*.145,.455,.295),.092,.089),
      ((side*.145,.385,.28),.081,.078),
      ((side*.145,.27,.269),.074,.072),
      ((side*.145,.16,.255),.067,.064),
      ((side*.145,.105,.25),.066,.061)
    ],trouser))
pants=union('Trousers',pants_parts,trouser,voxel=.0065,iterations=5,decimate=.35)

details=[]
for side,suffix in [(-1,'L'),(1,'R')]:
    x=side*.145
    upper=union('Shoes_'+suffix,[
      ellipsoid('Shoe upper',(x,.081,.195),(.079,.060,.133),shoe),
      ellipsoid('Shoe toe',(x,.071,.103),(.080,.047,.075),shoe)
    ],shoe,voxel=.0045,iterations=3,decimate=.4)
    details.append(upper)
    details.append(rounded_box('Sole_'+suffix,(x,.027,.175),(.167,.035,.283),sole,.018))
    # A small leather vamp seam reads as a shoe instead of a black ball.
    details.append(curve('Shoe seam '+suffix,[(x-.055,.105,.12),(x,.121,.105),(x+.055,.105,.12)],.0018,sole,2))

# Slightly flattened face, rounded jaw and cheeks. Cross sections vary through
# the silhouette: the head has sculpted proportions instead of a sphere scale.
head=loft('HeadSurface',[
    ((0,1.075,.71),.045,.045),((0,1.09,.705),.10,.108),
    ((0,1.12,.705),.15,.15),((0,1.18,.711),.198,.187),
    ((0,1.25,.72),.224,.209),((0,1.33,.735),.227,.212),
    ((0,1.405,.745),.207,.194),((0,1.47,.750),.165,.155),
    ((0,1.52,.750),.103,.098),((0,1.548,.748),.028,.027),
    ((0,1.55,.748),.003,.003)
],skin,64)
bpy.context.view_layer.objects.active=head
sub=head.modifiers.new('Sculpt subdivision','SUBSURF');sub.levels=2
bpy.ops.object.modifier_apply(modifier=sub.name)
reduction=head.modifiers.new('Mobile smooth head topology','DECIMATE');reduction.ratio=.45
bpy.ops.object.modifier_apply(modifier=reduction.name)
neck=ellipsoid('NeckSurface',(0,1.055,.72),(.071,.091,.067),skin)

facial=[]
for side,suffix in [(-1,'L'),(1,'R')]:
    center=(side*.079,1.326,.529)
    eye=ellipsoid('Eye_'+suffix,center,(.014,.026,.008),eye_mat,32,20)
    eye.shape_key_add(name='Basis')
    key=eye.shape_key_add(name='Blink')
    for vertex in key.data:
        vertex.co.z *= .075
    facial.append(eye)

# A deformable mouth surface: one mesh and true morph targets, never expression
# screenshots or swapping complete face meshes.
mouth_vertices=[(0,1.204,.517)]
mouth_faces=[]
rings=4;sides=48
for ri in range(1,rings+1):
    r=ri/rings
    for j in range(sides):
        theta=j*2*math.pi/sides
        x=math.cos(theta)*.035*r
        y=1.204+math.sin(theta)*.0045*r
        mouth_vertices.append((x,y,.516+x*x*.18))
for j in range(sides): mouth_faces.append((0,1+j,1+(j+1)%sides))
for ri in range(1,rings):
    for j in range(sides):
        k=(j+1)%sides
        a=1+(ri-1)*sides+j;b=1+(ri-1)*sides+k
        c=1+ri*sides+k;d=1+ri*sides+j
        mouth_faces.append((a,b,c,d))
mouth=mesh('Mouth',mouth_vertices,[tuple(reversed(face)) for face in mouth_faces],mouth_mat)
mouth.shape_key_add(name='Basis')
for name in ['Smile','Open','Frown']:
    key=mouth.shape_key_add(name=name)
    for i,vert in enumerate(key.data):
        if i==0: vert.co=p((0,1.198,.513));continue
        ri=(i-1)//sides+1;r=ri/rings;theta=((i-1)%sides)*2*math.pi/sides
        width=.038 if name=='Smile' else .027 if name=='Open' else .035
        height=.019 if name=='Smile' else .032 if name=='Open' else .004
        x=math.cos(theta)*width*r
        curve_y=(.012 if name=='Smile' else -.012 if name=='Frown' else 0)*(x/width)**2
        y=1.198+math.sin(theta)*height*r+curve_y
        vert.co=p((x,y,.513+x*x*.18))
facial.append(mouth)

# Tailored folds, collar and placket. Geometry is shallow and follows the body;
# it does not replace the continuously skinned shirt underneath.
def collar_flap(name, coords):
    obj=mesh(name,coords,[(0,1,2,3)],shirt)
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Collar thickness','SOLIDIFY');mod.thickness=.006
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=obj.modifiers.new('Rounded collar edge','BEVEL');mod.width=.005;mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj
details.extend([
 collar_flap('Collar_L',[(-.065,1.05,.658),(-.006,1.033,.63),(-.045,.97,.593),(-.102,1.007,.63)]),
 collar_flap('Collar_R',[(.006,1.033,.63),(.065,1.05,.658),(.102,1.007,.63),(.045,.97,.593)]),
 curve('Front placket',[(0,.965,.581),(0,.89,.561),(0,.79,.543),(0,.68,.545),(0,.58,.58)],.005,shirt,3),
 curve('Left shoulder seam',[(-.09,1.03,.66),(-.17,1.01,.644),(-.222,.957,.59)],.0018,seam,2),
 curve('Right shoulder seam',[(.09,1.03,.66),(.17,1.01,.644),(.222,.957,.59)],.0018,seam,2),
])
tie_mesh=mesh('Tie',[
 (-.019,1.02,.621),(.019,1.02,.621),(.014,.986,.597),(-.014,.986,.597),
 (-.014,.986,.595),(.014,.986,.595),(.026,.79,.533),(0,.755,.533),(-.026,.79,.533)
],[(0,1,2,3),(4,5,6,7,8)],tie)
bpy.context.view_layer.objects.active=tie_mesh
mod=tie_mesh.modifiers.new('Woven tie thickness','SOLIDIFY');mod.thickness=.004
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=tie_mesh.modifiers.new('Soft tie edge','BEVEL');mod.width=.003;mod.segments=2
bpy.ops.object.modifier_apply(modifier=mod.name)
details.append(tie_mesh)
for y,z in [(.92,.571),(.84,.55),(.70,.544),(.61,.563)]:
    details.append(ellipsoid('Shirt button',(0,y,z-.003),(.004,.004,.0025),seam,12,8))

glass_parts=[]
for side in [-1,1]:
    pts=[]
    for j in range(17):
        theta=j*2*math.pi/16
        pts.append((side*.079+math.cos(theta)*.056,1.326+math.sin(theta)*.045,.509+abs(math.cos(theta))*.008))
    glass_parts.append(curve('Round frame',pts,.0048,rim,3))
    glass_parts.append(curve('Glasses temple',[(side*.133,1.332,.516),(side*.188,1.329,.57),(side*.214,1.318,.66)],.004,rim,3))
glass_parts.append(curve('Glasses bridge',[(-.023,1.329,.51),(0,1.336,.506),(.023,1.329,.51)],.004,rim,3))
bpy.ops.object.select_all(action='DESELECT')
for obj in glass_parts: obj.select_set(True)
bpy.context.view_layer.objects.active=glass_parts[0]
bpy.ops.object.join();glasses=bpy.context.object;glasses.name='Glasses'
glasses['defaultHidden']=True

# Rig in the seated rest pose. Distance-based skinning blends across each joint.
bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0))
rig=bpy.context.object;rig.name='CharacterRig'
rig.data.edit_bones.remove(rig.data.edit_bones[0])
bone_specs={
 'Hips':((0,.53,.74),(0,.65,.72),None),
 'Spine':((0,.65,.72),(0,.85,.715),'Hips'),
 'Chest':((0,.85,.715),(0,1.02,.72),'Spine'),
 'Neck':((0,1.02,.72),(0,1.11,.72),'Chest'),
 'Head':((0,1.11,.72),(0,1.49,.745),'Neck'),
}
for side,suffix in [(-1,'L'),(1,'R')]:
    shoulder,elbow,wrist=arm_sections[suffix]
    bone_specs.update({
      'UpperArm_'+suffix:(shoulder,elbow,'Chest'),
      'Forearm_'+suffix:(elbow,wrist,'UpperArm_'+suffix),
      'Hand_'+suffix:(wrist,(wrist[0],.80,wrist[2]-.10),'Forearm_'+suffix),
      'Thigh_'+suffix:((side*.10,.535,.73),(side*.145,.49,.31),'Hips'),
      'Shin_'+suffix:((side*.145,.49,.31),(side*.145,.105,.25),'Thigh_'+suffix),
      'Foot_'+suffix:((side*.145,.105,.25),(side*.145,.065,.085),'Shin_'+suffix),
    })
for name,(head_co,tail_co,parent) in bone_specs.items():
    bone=rig.data.edit_bones.new(name);bone.head=p(head_co);bone.tail=p(tail_co)
    if parent: bone.parent=rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True

def segment_distance(point,a,b):
    v=b-a;t=max(0,min(1,(point-a).dot(v)/v.length_squared))
    return (point-(a+v*t)).length

def bind(obj, bones, fixed=None):
    groups={name:obj.vertex_groups.new(name=name) for name in bones}
    for vertex in obj.data.vertices:
        point=obj.matrix_world@vertex.co
        if fixed:
            groups[fixed].add([vertex.index],1,'REPLACE');continue
        ranked=[]
        for name in bones:
            a,b,_=bone_specs[name]
            dist=segment_distance(point,p(a),p(b))
            ranked.append((dist,name))
        ranked.sort()
        closest=ranked[:3]
        weights=[math.exp(-((dist-closest[0][0])/.065)**2*2) for dist,_ in closest]
        total=sum(weights)
        for weight,(_,name) in zip(weights,closest):
            if weight/total>.005: groups[name].add([vertex.index],weight/total,'REPLACE')
    mod=obj.modifiers.new('Seated character skin','ARMATURE');mod.object=rig
    obj.parent=rig

bind(body,['Hips','Spine','Chest','UpperArm_L','UpperArm_R'])
bind(pants,['Hips','Thigh_L','Thigh_R','Shin_L','Shin_R'])
bind(head,['Head'],fixed='Head');bind(neck,['Neck','Head','Chest'])
for obj in arms:
    suffix='L' if obj.name.endswith('L') else 'R'
    bind(obj,['UpperArm_'+suffix,'Forearm_'+suffix,'Hand_'+suffix])
for obj in facial+[glasses]: bind(obj,['Head'],fixed='Head')
for obj in details:
    suffix='L' if obj.name.endswith('L') else 'R'
    if obj.name.startswith(('Shoes_','Sole_','Shoe seam')):
        bind(obj,['Foot_'+suffix],fixed='Foot_'+suffix)
    else:
        bind(obj,['Spine','Chest','UpperArm_L','UpperArm_R'])

rig['design']='Original PachiAruCG adult; bald; eyes and mouth only; seated rest pose'
rig['worldForward']='-Z'
rig['units']='metres'
rig['restPose']='seated; no baked animation; bones and facial morph targets animate continuously'
ROOT.joinpath('assets').mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/character.glb'),export_format='GLB',
    export_animations=False,export_skins=True,export_morph=True,export_extras=True,
    export_yup=True,export_texcoords=False,export_normals=True,export_materials='EXPORT',
    export_cameras=False,export_lights=False)
stats={'meshes':len([o for o in bpy.data.objects if o.type=='MESH']),
       'vertices':sum(len(o.data.vertices) for o in bpy.data.objects if o.type=='MESH'),
       'triangles':sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in bpy.data.objects if o.type=='MESH'),
       'bones':len(bone_specs),'glb_bytes':ROOT.joinpath('assets/character.glb').stat().st_size,
       'bone_names':list(bone_specs)}
print('CHARACTER_BUILD_STATS '+json.dumps(stats))
