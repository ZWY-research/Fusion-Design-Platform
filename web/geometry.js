import * as THREE from 'three';

// Unified case boundary for future loaders. All lengths are metres; no physics outputs.
export const defaultCase = { schemaVersion: 1, configuration: 'tokamak', caseId: 'custom', geometry: { R0: 3, a: 1, kappa: 1.7, delta: 0.3 } };
export function validateGeometry(p) {
  if (!Object.values(p).every(Number.isFinite)) return '参数必须是有限数值。';
  if (p.R0 < 1 || p.R0 > 8 || p.a < .2 || p.a > 2 || p.kappa < 1 || p.kappa > 2.5 || Math.abs(p.delta) > .6) return '参数超出当前几何工作台范围。';
  if (p.R0 - p.a < .5) return '需要 R₀ − a ≥ 0.5 m，以保留简化中心结构空间。';
  if (p.R0 - 1.28 * p.a < .2) return 'TF 线圈内侧需保留至少 0.2 m 的中心结构空间。';
  return '';
}
// Cylindrical (R, phi, Z): x=R cos(phi), y=R sin(phi), z=Z.
// Analytic D-shape, not a magnetic equilibrium or a fitted SPARC boundary.
export function boundary(p, theta, scale = 1) {
  return [p.R0 + scale * p.a * Math.cos(theta + Math.asin(p.delta) * Math.sin(theta)), scale * p.kappa * p.a * Math.sin(theta)];
}
export function surface(p, scale, sweep) {
  const vertices = [], indices = [], nt = 48, np = 80;
  for (let j = 0; j <= np; j++) for (let i = 0; i <= nt; i++) {
    const phi = j / np * sweep, [r, z] = boundary(p, i / nt * Math.PI * 2, scale);
    vertices.push(r * Math.cos(phi), r * Math.sin(phi), z);
    if (i < nt && j < np) { const n = j * (nt + 1) + i; indices.push(n, n + nt + 1, n + 1, n + 1, n + nt + 1, n + nt + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
export function buildDevice(p, cutaway) {
  const root = new THREE.Group(), layers = {};
  for (const id of ['plasma', 'vessel', 'tf', 'pf', 'cs']) { layers[id] = new THREE.Group(); layers[id].name = id; root.add(layers[id]); }
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .38, metalness: .45, side: THREE.DoubleSide, ...extra });
  const add = (layer, geometry, mat) => { const mesh = new THREE.Mesh(geometry, mat); layers[layer].add(mesh); return mesh; };
  add('plasma', surface(p, 1, Math.PI * 2), material('#55d8c0', { emissive: '#137a72', emissiveIntensity: .45, metalness: .15 }));
  add('vessel', surface(p, 1.13, cutaway ? Math.PI * 1.5 : Math.PI * 2), material('#7f9cad', { transparent: true, opacity: .19, depthWrite: false }));
  // TF loops are schematic closed D-shaped tubes in poloidal planes.
  for (let j = 0; j < 16; j++) {
    const phi = j / 16 * Math.PI * 2;
    if (cutaway && phi > Math.PI * 1.5) continue;
    const points = Array.from({ length: 65 }, (_, i) => { const [r, z] = boundary(p, i / 64 * 2 * Math.PI, 1.28); return new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), z); });
    add('tf', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 64, .065 * p.a, 6, true), material('#bb8760'));
  }
  for (const sign of [-1, 1]) for (const level of [.72, 1.25]) {
    const mesh = add('pf', new THREE.TorusGeometry(p.R0 + (level === .72 ? .98 : -.1) * p.a, .085 * p.a, 8, 80), material('#b8a47b'));
    mesh.position.z = sign * level * p.kappa * p.a;
  }
  const csRadius = Math.min(.35 * p.R0, (p.R0 - 1.28 * p.a) * .75);
  const cs = add('cs', new THREE.CylinderGeometry(csRadius, csRadius, p.kappa * p.a * 2.8, 32), material('#a8b8c7'));
  cs.rotation.x = Math.PI / 2;
  return { root, layers };
}
export function disposeDevice(root) { root.traverse(o => { o.geometry?.dispose(); if (o.material) o.material.dispose(); }); }
