// A compact Japanese commuter carriage, with actual window openings and a closed roof.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { box, colorize, mergeMesh } from './geometry.js';

export function buildOpeningTrain(floor, doors) {
  const train = new THREE.Group(); train.name = 'Opening_Commuter_Train';
  const shell = [], seats = [];
  const cream = '#e5e8df', teal = '#438c81', steel = '#a5afae';
  const glass = new THREE.MeshStandardMaterial({ color: '#a6d5d4', transparent: true, opacity: 0.23, roughness: 0.16, metalness: 0.12, depthWrite: false, side: THREE.DoubleSide });
  const cabGlass = glass.clone(); cabGlass.color.set('#527c89'); cabGlass.opacity = 0.52;
  function pane(parent, w, h, x, y, z, ry = 0, cab = false) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cab ? cabGlass : glass);
    mesh.name = 'Transparent_Window'; mesh.position.set(x, y, z); mesh.rotation.y = ry; parent.add(mesh);
  }
  function rounded(w, h, d, radius, color, x, y, z) {
    const g = new RoundedBoxGeometry(w, h, d, 2, radius); g.translate(x, y, z); return colorize(g, color);
  }
  shell.push(box(4.03, 0.06, 1.02, '#777e7b', 0, floor - 0.03, 0));
  // Continuous shallow barrel roof, flush with the side walls and cab pillars.
  const profile = new THREE.Shape();
  profile.moveTo(-0.535, floor + 0.54); profile.lineTo(-0.535, floor + 0.555);
  profile.quadraticCurveTo(-0.525, floor + 0.65, -0.4, floor + 0.65);
  profile.lineTo(0.4, floor + 0.65); profile.quadraticCurveTo(0.525, floor + 0.65, 0.535, floor + 0.555);
  profile.lineTo(0.535, floor + 0.54); profile.closePath();
  const roof = new THREE.ExtrudeGeometry(profile, { depth: 4.03, bevelEnabled: false, curveSegments: 5 });
  roof.rotateY(Math.PI / 2); roof.translate(-2.015, 0, 0); shell.push(colorize(roof, '#d1d8d3'));
  // Roof equipment and a seam down each shoulder give the silhouette a commuter-train profile.
  for (const x of [-0.92, 0.92]) {
    shell.push(rounded(0.64, 0.055, 0.44, 0.025, '#929e9b', x, floor + 0.672, 0));
    for (let k = -2; k <= 2; k++) shell.push(box(0.018, 0.006, 0.31, '#6b7a78', x + k * 0.08, floor + 0.702, 0));
  }
  for (const z of [-0.515, 0.515]) {
    const front = z > 0;
    for (const side of [-1, 1]) {
      const x = side * 1.035;
      shell.push(box(1.41, 0.235, 0.034, cream, x, floor + 0.1175, z));
      shell.push(box(1.41, 0.065, 0.041, teal, x, floor + 0.16, z));
      shell.push(box(1.41, 0.065, 0.034, cream, x, floor + 0.5275, z));
      for (const dx of [-0.675, 0, 0.675]) shell.push(box(0.055, 0.26, 0.04, steel, x + dx, floor + 0.365, z));
      for (const dx of [-0.338, 0.338]) pane(train, 0.62, 0.255, x + dx, floor + 0.365, z);
      shell.push(box(1.41, 0.018, 0.045, steel, x, floor + 0.237, z));
      // Longitudinal benches face the aisle, below the window line.
      seats.push(rounded(1.18, 0.055, 0.20, 0.018, '#679789', x, floor + 0.10, Math.sign(z) * 0.37));
      seats.push(rounded(1.18, 0.13, 0.035, 0.012, '#558779', x, floor + 0.175, Math.sign(z) * 0.465));
      for (const dx of [-0.47, 0.47]) seats.push(box(0.035, 0.08, 0.14, '#636e6a', x + dx, floor + 0.04, Math.sign(z) * 0.37));
    }
    shell.push(box(0.66, 0.035, 0.04, steel, 0, floor + 0.55, z));
    for (const side of [-1, 1]) {
      const door = new THREE.Group(); door.position.set(side * 0.165, floor, z + (front ? 0.025 : -0.025));
      const frame = [box(0.33, 0.235, 0.026, cream, 0, 0.1175, 0), box(0.33, 0.052, 0.026, cream, 0, 0.514, 0), box(0.33, 0.065, 0.032, teal, 0, 0.16, 0)];
      for (const dx of [-0.147, 0.147]) frame.push(box(0.036, 0.26, 0.028, steel, dx, 0.365, 0));
      frame.push(box(0.008, 0.065, 0.034, '#56665f', -side * 0.13, 0.21, 0.01));
      door.add(mergeMesh(frame, true)); pane(door, 0.258, 0.253, 0, 0.362, 0.001); train.add(door);
      if (front) doors.push(door);
    }
  }
  for (const side of [-1, 1]) {
    // Rounded cab cheeks and broad front glass replace the old flat end wall.
    shell.push(rounded(0.30, 0.24, 1.035, 0.025, cream, side * 1.865, floor + 0.12, 0));
    shell.push(box(0.012, 0.065, 0.985, teal, side * 2.016, floor + 0.16, 0));
    for (const z of [-0.515, 0.515]) shell.push(box(0.29, 0.065, 0.04, teal, side * 1.865, floor + 0.16, z));
    for (const z of [-0.475, 0.475]) shell.push(box(0.30, 0.31, 0.075, cream, side * 1.865, floor + 0.395, z));
    pane(train, 0.865, 0.255, side * 2.017, floor + 0.373, 0, Math.PI / 2, true);
    shell.push(box(0.035, 0.06, 1.02, cream, side * 1.998, floor + 0.523, 0));
    shell.push(box(0.025, 0.025, 0.90, '#425756', side * 2.016, floor + 0.243, 0));
    shell.push(box(0.025, 0.255, 0.018, '#425756', side * 2.02, floor + 0.373, 0));
    shell.push(box(0.018, 0.035, 0.29, '#344b45', side * 2.02, floor + 0.525, 0));
    // A small cab bulkhead and dashboard keep the end from reading as an empty tram.
    shell.push(box(0.025, 0.50, 0.96, '#c5cec7', side * 1.65, floor + 0.25, 0));
    shell.push(box(0.20, 0.035, 0.75, '#566c66', side * 1.87, floor + 0.26, 0));
    for (const z of [-0.325, 0.325]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.045, 0.1), new THREE.MeshStandardMaterial({ color: side > 0 ? '#fff0c4' : '#da7365', emissive: side > 0 ? '#ffe2a0' : '#bc4234', emissiveIntensity: 0.7 }));
      lamp.position.set(side * 2.015, floor + 0.205, z); train.add(lamp);
    }
    shell.push(box(0.07, 0.05, 0.18, '#424e4e', side * 2.025, floor - 0.055, 0));
    // Visible bogies and paired wheelsets below the carriage.
    shell.push(box(0.58, 0.055, 0.65, '#3e4b4b', side * 1.22, 0.07, 0));
    for (const dx of [-0.19, 0.19]) for (const z of [-0.33, 0.33]) {
      const wheel = new THREE.CylinderGeometry(0.072, 0.072, 0.045, 12); wheel.rotateX(Math.PI / 2); wheel.translate(side * 1.22 + dx, 0.065, z); shell.push(colorize(wheel, '#303a3a'));
    }
  }
  train.add(mergeMesh(shell, true));
  const benches = mergeMesh(seats, true); benches.name = 'Interior_Benches'; train.add(benches);
  const inside = new THREE.PointLight('#fff2d4', 0.45, 2.5, 1.5); inside.position.set(0, floor + 0.47, 0); train.add(inside);
  return train;
}
