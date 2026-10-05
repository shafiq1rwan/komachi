// Small, reusable station details kept outside the boarding animation.
import * as THREE from 'three';
import { box, mergeMesh } from './geometry.js';

export function dressOpeningStation(root, floor) {
  const cream = '#d6d4c7', teal = '#529489', dark = '#455651';
  const g = [];
  const add = (w, h, d, color, x, y, z) => g.push(box(w, h, d, color, x, y, z));
  // The far wall and shallow service ledge give the track a finished enclosure.
  add(8, .22, .035, teal, 0, .83, -.83);
  add(8, .09, .12, '#aaa99c', 0, .06, -.79);
  for (let x = -4; x <= 4; x += .42) add(.006, 1.7, .006, '#b9b7aa', x, .85, -.846);
  for (const y of [.32, .62, 1.02, 1.42]) add(8, .006, .006, '#b9b7aa', 0, y, -.846);
  // Floor joints are shallow geometry, with clear space around the boarding route.
  for (let x = -4; x <= 4; x += .42) add(.005, .002, 1.36, '#aaa99c', x, floor + .002, 1.49);
  for (const z of [1.12, 1.55, 1.98]) add(8, .002, .005, '#aaa99c', 0, floor + .002, z);
  add(8, .12, .18, '#aaa99c', 0, 1.72, -.72);
  // Open cutaway ceiling: beams frame the shot without hiding the characters.
  for (const x of [-3.5, -1.9, 1.9, 3.5]) {
    add(.12, .13, 2.85, cream, x, 1.72, .55);
    add(.17, .06, .17, '#aaa99c', x, floor + .03, 1.94);
    if (Math.abs(x) === 1.9) add(.12, .10, .12, cream, x, 1.625, 1.94);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: '#fff0d8', emissive: '#ffdf9f', emissiveIntensity: .8, roughness: 1 });
  for (const x of [-2.6, 0, 2.6]) {
    add(.76, .06, .19, dark, x, 1.64, -.32);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.68, .035, .17), lampMat);
    lamp.position.set(x, 1.615, -.30); root.add(lamp);
  }
  // End-of-platform amenities stay behind the pedestrian lanes.
  const vx = 1.38, vz = 1.94;
  add(.31, .61, .25, teal, vx, floor + .305, vz);
  add(.245, .34, .015, '#344a4e', vx, floor + .39, vz + .132);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    add(.038, .074, .023, ['#e7c768', '#d6d4c7', '#bd795d', '#87a6b0'][col], vx - .084 + col * .056, floor + .29 + row * .10, vz + .15);
  }
  add(.18, .047, .016, '#263b3c', vx, floor + .09, vz + .134);
  add(.025, .04, .018, '#e7c768', vx + .12, floor + .19, vz + .137);
  for (const [x, color] of [[.86, '#b4b3a2'], [1.08, '#698f83']]) {
    add(.17, .28, .19, color, x, floor + .14, vz);
    add(.12, .05, .014, '#354442', x, floor + .215, vz + .103);
    add(.07, .035, .016, '#ece7d7', x, floor + .12, vz + .103);
  }
  // Framed travel posters use the same flat geometry as the town.
  for (const [x, accent] of [[-1.33, '#829a78'], [1.32, '#bd795d']]) {
    add(.37, .49, .035, dark, x, 1.09, -.811);
    add(.325, .445, .012, '#eee4cc', x, 1.09, -.786);
    add(.285, .24, .009, '#87a6b0', x, 1.15, -.774);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(.034, 12), new THREE.MeshStandardMaterial({ color: '#e7c768', roughness: 1 }));
    sun.position.set(x + .085, 1.225, -.76); root.add(sun);
    for (let n = 0; n < 3; n++) {
      add(.065, .08 + n * .025, .012, accent, x - .09 + n * .09, 1.10, -.763);
      add(.075, .023, .014, dark, x - .09 + n * .09, 1.15 + n * .012, -.755);
    }
    add(.22, .013, .01, teal, x, .95, -.774);
    add(.16, .009, .01, '#aaa99c', x, .915, -.774);
  }
  // A chunky clock with a legible face, hour marks and fixed morning hands.
  const clock = new THREE.Group(); clock.position.set(.94, 1.35, -.77);
  for (const [radius, color, z] of [[.125, dark, 0], [.109, '#eee4cc', .005]]) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    face.position.z = z; clock.add(face);
  }
  const clockParts = [];
  for (let n = 0; n < 12; n++) {
    const a = n * Math.PI / 6;
    clockParts.push(box(.008, .015, .005, dark, Math.sin(a) * .09, Math.cos(a) * .09, .01));
  }
  const hands = [[.047, -.5], [.069, .9]];
  for (const [length, angle] of hands) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(.009, length, .006), new THREE.MeshStandardMaterial({ color: dark }));
    hand.rotation.z = angle; hand.position.set(-Math.sin(angle) * length / 2, Math.cos(angle) * length / 2, .014); clock.add(hand);
  }
  clock.add(mergeMesh(clockParts, true)); root.add(clock);
  const mesh = mergeMesh(g, true); root.add(mesh);
  // Gentle local fill makes the station readable independently of the town sun.
  const fill = new THREE.PointLight('#cadcee', 1.5, 7, 1.5);
  fill.position.set(-2, 1.35, 1.3); root.add(fill);
}
