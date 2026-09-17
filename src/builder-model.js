// Builder authoring: a separate derivative of Kenney Mini Characters (CC0).
// Called by the asset workshop, not by the town's frame loop.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function dressBuilder(gltf) {
  const root = gltf.scene;
  root.name = 'Komachi_Builder';
  root.userData = { ...root.userData, builder: true, source: 'Kenney Mini Characters, character-male-b.glb, CC0', description: 'Separate builder derivative with fitted hard hat and reflective workwear' };
  const hsl = {}, c = new THREE.Color();
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry.clone(), uv = g.attributes.uv, pos = g.attributes.position;
    const texture = o.material.map, canvas = document.createElement('canvas');
    canvas.width = texture.image.width; canvas.height = texture.image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(texture.image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = [], skinVertices = [];
    for (let i = 0; i < pos.count; i++) {
      const x = Math.min(canvas.width - 1, Math.floor(uv.getX(i) * canvas.width)), y = Math.min(canvas.height - 1, Math.floor(uv.getY(i) * canvas.height)), offset = (y * canvas.width + x) * 4;
      c.setRGB(pixels[offset] / 255, pixels[offset + 1] / 255, pixels[offset + 2] / 255).convertSRGBToLinear();
      c.getHSL(hsl);
      const skin = hsl.h > .03 && hsl.h < .09 && hsl.s > .35 && hsl.l > .5;
      if (skin) skinVertices.push(i);
      if (o.name === 'body-mesh') {
        let weight = -1, joint = 0;
        for (let k = 0; k < 4; k++) if (g.attributes.skinWeight.getComponent(i, k) > weight) { weight = g.attributes.skinWeight.getComponent(i, k); joint = g.attributes.skinIndex.getComponent(i, k); }
        const bone = o.skeleton.bones[joint].name;
        const shade = Math.min(1.12, Math.max(.75, hsl.l / .4));
        // This source's hand atlas column is distinct from its sleeve column. The
        // original skin is dark, so the residents' light-skin heuristic misses it.
        const hand = bone.startsWith('arm') && uv.getX(i) > .8 && uv.getX(i) < .88;
        if (hand) {
          const side = Math.sign(pos.getX(i)), dx = side * pos.getX(i) - .2095, dz = pos.getZ(i) + .012;
          const along = dx * .902 + dz * .432, across = -dx * .432 + dz * .902;
          // A compact mitten silhouette, retaining the source skin weights.
          pos.setXYZ(i, side * (.2095 + along * .8 * .902 - across * .86 * .432), .2875 + (pos.getY(i) - .2875) * .86, -.012 + along * .8 * .432 + across * .86 * .902);
          c.set('#d9c3a1');
        } else if (!skin) {
          c.set(bone.startsWith('leg') ? (pos.getY(i) < .045 ? '#4a4340' : '#626778') : bone.startsWith('arm') ? '#626778' : '#e9a25a');
          c.multiplyScalar(shade);
        }
      }
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.deleteAttribute('uv'); g.deleteAttribute('uv1'); g.deleteAttribute('tangent');
    // Tuck the upper hairstyle inside the faceted shell; leave the fringe and face intact.
    if (o.name === 'head-mesh') for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i); if (y <= .59) continue;
      const x = pos.getX(i), z = pos.getZ(i) + .005;
      const radius = Math.sqrt((x / .255) ** 2 + (z / .205) ** 2);
      const limit = .92 * Math.sqrt(Math.max(0, 1 - ((y - .595) / .165) ** 2));
      if (radius > limit) { pos.setX(i, x * limit / radius); pos.setZ(i, z * limit / radius - .005); }
    }
    g.computeVertexNormals(); o.geometry = g; o.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 });
    o.userData.skinVertices = skinVertices;
    o.castShadow = true; o.frustumCulled = false;
  });
  root.updateMatrixWorld(true);
  const head = root.getObjectByName('head'), torso = root.getObjectByName('torso');
  const helmet = new THREE.Group(); helmet.name = 'Builder_HardHat'; head.add(helmet);
  const yellow = new THREE.MeshStandardMaterial({ color: '#e8cf7a', roughness: .78, flatShading: true });
  const edge = new THREE.MeshStandardMaterial({ color: '#c8aa53', roughness: .85 });
  const dark = new THREE.MeshStandardMaterial({ color: '#71654a', roughness: 1 });
  function attach(parent, name, geometry, material, position) {
    const m = new THREE.Mesh(geometry, material); m.name = name;
    // Author in model coordinates, then place on the animated bone.
    const local = parent.worldToLocal(new THREE.Vector3(...position)); m.position.copy(local);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const leather = new THREE.MeshStandardMaterial({ color: '#d9c3a1', roughness: .96, flatShading: true });
  const cuffMat = new THREE.MeshStandardMaterial({ color: '#a3764a', roughness: .96 });
  for (const side of [-1, 1]) {
    const arm = root.getObjectByName(side > 0 ? 'arm-left' : 'arm-right');
    const cuff = new RoundedBoxGeometry(.035, .11, .102, 1, .009); cuff.rotateY(-side * .447);
    attach(arm, `Glove_Cuff_${side}`, cuff, cuffMat, [side * .213, .2875, -.01]);
    const thumb = new RoundedBoxGeometry(.061, .051, .052, 1, .016); thumb.rotateY(-side * .8);
    attach(arm, `Glove_Thumb_${side}`, thumb, leather, [side * .238, .276, .048]);
  }
  const dome = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(.255, .165, .205);
  attach(helmet, 'Helmet_Shell', dome, yellow, [0, .595, -.005]);
  const brim = new THREE.CylinderGeometry(1, 1, .014, 24); brim.scale(.275, 1, .24);
  attach(helmet, 'Helmet_Brim', brim, yellow, [0, .596, .014]);
  const rim = new THREE.CylinderGeometry(1, 1, .01, 24); rim.scale(.254, 1, .204);
  attach(helmet, 'Helmet_Rim', rim, edge, [0, .588, -.005]);
  const ridgePoints = Array.from({ length: 13 }, (_, i) => {
    const angle = .12 + i / 12 * (Math.PI - .24);
    return new THREE.Vector3(0, .595 + .17 * Math.sin(angle), -.005 + .208 * Math.cos(angle));
  });
  const ridge = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ridgePoints), 16, .012, 6, false);
  // Geometry is already in model coordinates.
  ridge.translate(0, -.595, 0);
  attach(helmet, 'Helmet_Centre_Ridge', ridge, yellow, [0, .595, 0]);
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
    const vent = new THREE.BoxGeometry(.004, .012, .026);
    const z = -.05 + k * .045, x = side * .255 * Math.sqrt(1 - ((.623 - .595) / .165) ** 2 - ((z + .005) / .205) ** 2);
    attach(helmet, `Helmet_Vent_${side}_${k}`, vent, dark, [x, .623, z]);
  }
  const reflective = new THREE.MeshStandardMaterial({ color: '#f7efe2', roughness: .8 });
  for (const z of [.097, -.145]) {
    for (const x of [-.048, .048]) attach(torso, `Vest_Strip_${x}_${z}`, new RoundedBoxGeometry(.018, .115, .008, 1, .002), reflective, [x, .276, z]);
    attach(torso, `Vest_Band_${z}`, new RoundedBoxGeometry(.155, .017, .008, 1, .002), reflective, [0, .232, z]);
  }
  return gltf;
}
