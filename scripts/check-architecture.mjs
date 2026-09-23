import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { housePlan } from '../src/architecture.js';

// Only the unused glow texture needs a canvas; geometry is checked without GL.
globalThis.location = { search: '?seed=1&look=rich' };
globalThis.document = { createElement: () => ({ getContext: () => ({
  createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
}) }) };
const { genRichBuilding } = await import('../src/rich-buildings.js');
const { mergeMesh } = await import('../src/geometry.js');
// Three.js consumes randomness for object UUIDs. Geometry must remain identical
// even when that global stream changes; UUIDs are deliberately excluded.

function generate(seed, level, variant) {
  const g = [], wg = [], u = { seed, variant };
  genRichBuilding({ type: 'res', level }, u, g, wg);
  const hash = createHash('sha256');
  let triangles = 0;
  for (const geo of [...g, ...wg]) {
    for (const name of ['position', 'normal', 'uv', 'color']) {
      const array = geo.attributes[name].array;
      assert.ok(array.every(Number.isFinite), `${name} must be finite`);
      hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
    }
    triangles += (geo.index?.count ?? geo.attributes.position.count) / 3;
  }
  // Exercise the same merger as the town: two meshes regardless of detail count.
  for (const parts of [g, wg]) {
    const mesh = mergeMesh(parts);
    assert.ok(mesh?.geometry.attributes.position.count > 0);
    mesh.geometry.dispose();
  }
  for (const geo of [...g, ...wg]) geo.dispose();
  return { hash: hash.digest('hex'), door: u.door, triangles };
}

const signatures = new Set(), widths = new Set(), walls = new Set();
let maxTriangles = 0, cases = 0;
const started = performance.now();
for (let i = 0; i < 64; i++) {
  const seed = i / 64;
  const p = housePlan(seed, 1, 'detached'), upgraded = housePlan(seed, 2, 'detached');
  assert.equal(p.floors, 1); assert.equal(upgraded.floors, 2);
  assert.equal(p.w, upgraded.w); assert.equal(p.d, upgraded.d);
  assert.equal(p.doorX, upgraded.doorX); assert.equal(p.wallIndex, upgraded.wallIndex);
  assert.ok(p.bay + p.windowWidth / 2 + 0.024 < p.w / 2, 'window frame fits wall');
  assert.ok(p.doorX + 0.1 < p.bay - p.windowWidth / 2 - 0.024, 'door clears window');
  assert.ok(p.w + 0.205 < 1 && p.d + 0.215 < 1, 'roof fits plot');
  widths.add(p.w); walls.add(p.wallIndex);
  for (const variant of ['detached', 'villa']) for (const level of [1, 2, 3]) {
    Math.random = () => 0.123;
    const first = generate(seed, level, variant);
    Math.random = () => 0.987;
    generate((seed + 0.317) % 1, level, variant); // rebuilding another unit cannot affect this one
    assert.deepEqual(generate(seed, level, variant), first);
    assert.equal(first.door.x, p.doorX);
    assert.equal(first.door.z, p.d / 2 + 0.025);
    assert.ok(first.triangles < 7000, 'bounded geometry budget');
    if (variant === 'villa') assert.equal(housePlan(seed, level, variant).floors, 1);
    signatures.add(first.hash); maxTriangles = Math.max(maxTriangles, first.triangles); cases++;
  }
}
assert.equal(widths.size, 3); assert.equal(walls.size, 5);
assert.ok(signatures.size >= 100, 'seeds produce varied geometry');
console.log(JSON.stringify({ cases, uniqueGeometry: signatures.size, maxTriangles, elapsedMs: Math.round(performance.now() - started) }));
