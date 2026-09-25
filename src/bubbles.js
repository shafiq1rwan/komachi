// Komachi — speech bubbles (Phase 6). A talk pairs two residents for a while; each frame the overlay draws one cream bubble
// over whoever is "speaking" (the two alternate every second or so) with pulsing dots or a small pictogram for the topic.
// No text, ever. Hidden when zoomed far out. Purely visual: talks are started by sim.js and end on their own.
import * as THREE from 'three';
import { S } from './state.js';
import { camera, cam } from './scene.js';

export const talks = [];   // { a, b, topic, until, t0 }
const ICONS = {
  dots: '<i class="d"></i><i class="d"></i><i class="d"></i>',
  food: '<svg viewBox="0 0 24 24"><path d="M3 11h18a9 9 0 0 1-18 0z" fill="#7a706a"/><path d="M6 8c1-2 3-2 4 0M11 8c1-2 3-2 4 0" stroke="#7a706a" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M4 12 12 5l8 7v8H4z" fill="#d98b7a"/><path d="M10 20v-6h4v6" fill="#fbf6ee"/></svg>',
  weather: '<svg viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1 .6-7.95A5.5 5.5 0 0 1 18.2 11 3.5 3.5 0 0 1 18 18z" fill="#8fb0c9"/></svg>',
  shop: '<svg viewBox="0 0 24 24"><path d="M4 9h16l-1-4H5z" fill="#5f9c98"/><path d="M5 9v11h14V9" fill="#fbf6ee" stroke="#5f9c98" stroke-width="1.6"/><path d="M10 20v-6h4v6" fill="#5f9c98"/></svg>',
  train: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="13" rx="3" fill="#8fae78"/><rect x="8" y="7" width="8" height="4" fill="#fbf6ee"/><circle cx="9" cy="14" r="1.3" fill="#fbf6ee"/><circle cx="15" cy="14" r="1.3" fill="#fbf6ee"/><path d="M8 17l-2 3M16 17l2 3" stroke="#8fae78" stroke-width="1.6"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.5 12 20 12 20z" fill="#e9a8b3"/></svg>',
};
export const TOPICS = Object.keys(ICONS).filter(k => k !== 'dots');
/** start a talk between a and b (residents); topic from TOPICS or null for dots; until in game hours */
export function startTalk(a, b, topic, until) {
  endTalk(a); endTalk(b);
  const t = { a, b, topic: topic && ICONS[topic] ? topic : null, until, t0: S.T }; talks.push(t); a.talk = t; b.talk = t; return t;
}
export function endTalk(r) { const t = r && r.talk; if (!t) return; const i = talks.indexOf(t); if (i >= 0) talks.splice(i, 1); if (t.a) t.a.talk = null; if (t.b) t.b.talk = null; }
const v = new THREE.Vector3();
let el = null;
export function updateBubbles(realT) {
  if (!el) el = document.getElementById('bubbles'); if (!el) return;
  for (let i = talks.length - 1; i >= 0; i--) { const t = talks[i]; if (S.T >= t.until || t.a.state === 'away' || t.b.state === 'away' || !t.a.mesh.visible || !t.b.mesh.visible || t.a.mesh.position.distanceTo(t.b.mesh.position) > 1.2) { talks.splice(i, 1); t.a.talk = null; t.b.talk = null; } }
  // one element per talk, kept between frames so the pop-in plays once; only its place and content change
  const live = new Set(talks);
  for (const child of [...el.children]) if (!live.has(child.__talk)) child.remove();
  if (cam.view > 20) { for (const child of [...el.children]) child.remove(); return; }
  for (const t of talks) {
    const beat = Math.floor((realT + t.t0 * 37) / 1.1) % 2, who = beat ? t.b : t.a;   // the speakers alternate
    who.mesh.getWorldPosition(v); v.y += who.passenger ? 0.34 : 0.5; v.project(camera);
    let node = t.node; if (!node || node.parentNode !== el) { node = document.createElement('div'); node.className = 'bubble'; node.__talk = t; t.node = node; el.appendChild(node); }
    const off = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2; node.style.display = off ? 'none' : '';
    if (off) continue;
    node.style.left = ((v.x + 1) / 2 * innerWidth).toFixed(1) + 'px'; node.style.top = ((1 - v.y) / 2 * innerHeight).toFixed(1) + 'px';
    const showIcon = t.topic && Math.floor((realT + t.t0 * 37) / 2.2) % 2 === 0, key = showIcon ? t.topic : 'dots';   // the topic shows half the time, dots between
    if (node.__key !== key) { node.__key = key; node.innerHTML = ICONS[key]; node.classList.toggle('icon', !!showIcon); }
  }
}
