// A sports car built from three.js primitives, detailed for the view from behind: clear-coated
// paint, a tapered glasshouse, full-width tail-light bar that brightens under braking, diffuser
// with fins, quad exhausts, rear wing, number plate with the team logo, and turning wheels.
// Units are metres: about 4.5 m long, 1.95 m wide, 1.2 m tall. The car faces −z (away from a
// chase camera placed at +z).

import * as THREE from 'three';
import type { Livery } from '@/lib/oracleRace';

export type CarRig = { group: THREE.Group; wheels: THREE.Object3D[]; brake: THREE.MeshStandardMaterial; setBrake: (on: number) => void; dispose: () => void };

function plateTexture(l: Livery) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 60);
  g.fillStyle = l.body; g.fillRect(8, 8, 56, 48); g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(l.logo, 36, 34);
  g.fillStyle = '#111'; g.font = 'bold 38px monospace'; g.fillText(`ORC ${String(l.number).padStart(2, '0')}`, 160, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64); grad.addColorStop(0, 'rgba(0,0,0,0.75)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function buildSportsCar(l: Livery): CarRig {
  const group = new THREE.Group(); const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };
  const paint = keep(new THREE.MeshPhysicalMaterial({ color: l.body, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 }));
  const black = keep(new THREE.MeshStandardMaterial({ color: '#0b0b0d', roughness: 0.6, metalness: 0.2 }));
  const glass = keep(new THREE.MeshPhysicalMaterial({ color: '#0d1420', metalness: 0.2, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.88 }));
  const chrome = keep(new THREE.MeshStandardMaterial({ color: '#d8dde3', metalness: 1, roughness: 0.18 }));
  const brake = keep(new THREE.MeshStandardMaterial({ color: '#5a0a0a', emissive: '#ff1a1a', emissiveIntensity: 0.6 }));

  // Body: side profile extruded across the width, bevelled, with the upper part pulled in (tumblehome).
  const s = new THREE.Shape(); // x = along the car (−2.25 front … +2.25 rear), y = height
  s.moveTo(-2.25, 0.28); s.lineTo(-2.2, 0.55); s.quadraticCurveTo(-1.6, 0.7, -0.9, 0.78); s.quadraticCurveTo(-0.35, 1.18, 0.25, 1.17);
  s.quadraticCurveTo(1.3, 1.05, 1.95, 0.86); s.lineTo(2.25, 0.82); s.lineTo(2.28, 0.4); s.lineTo(2.2, 0.26); s.lineTo(-2.25, 0.28);
  const bodyGeo = keep(new THREE.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 5, curveSegments: 24 }));
  bodyGeo.translate(0, 0, -0.85); bodyGeo.rotateY(-Math.PI / 2); // (x, y, z) → (−z, y, x): x = width, z = length, rear at +z
  const pos = bodyGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) { const y = pos.getY(i); if (y > 0.74) pos.setX(i, pos.getX(i) * (1 - 0.32 * Math.min(1, (y - 0.74) / 0.42))); }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, paint); group.add(body);
  // Racing stripe along the top centre.
  const stripe = new THREE.Mesh(keep(new THREE.BoxGeometry(0.28, 0.012, 3.9)), keep(new THREE.MeshPhysicalMaterial({ color: l.stripe, clearcoat: 1, roughness: 0.3 })));
  stripe.position.set(0, 1.2, -0.1); group.add(stripe);
  // Rear window on the fastback, side windows.
  const rw = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.05, 0.62)), glass); rw.position.set(0, 1.04, 1.0); rw.rotation.x = -1.2; group.add(rw);
  for (const sx of [-1, 1]) { const sw = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.5, 0.3)), glass); sw.position.set(sx * 0.74, 0.98, -0.15); sw.rotation.y = sx * Math.PI / 2; sw.rotation.x = sx * 0.0; sw.rotation.z = 0; sw.rotateX(-sx * 0.3); group.add(sw); }
  // Tail: light bar, lamp clusters, number plate, diffuser, exhausts.
  const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(1.7, 0.045, 0.04)), brake); bar.position.set(0, 0.8, 2.37); group.add(bar);
  for (const sx of [-1, 1]) { const lamp = new THREE.Mesh(keep(new THREE.BoxGeometry(0.34, 0.1, 0.05)), brake); lamp.position.set(sx * 0.68, 0.72, 2.36); group.add(lamp); }
  const plate = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.52, 0.13)), keep(new THREE.MeshStandardMaterial({ map: keep(plateTexture(l)), roughness: 0.5 }))); plate.position.set(0, 0.52, 2.43); group.add(plate);
  const diffuser = new THREE.Mesh(keep(new THREE.BoxGeometry(1.6, 0.16, 0.35)), black); diffuser.position.set(0, 0.22, 2.25); group.add(diffuser);
  for (let k = -3; k <= 3; k += 1) { const fin = new THREE.Mesh(keep(new THREE.BoxGeometry(0.015, 0.16, 0.36)), black); fin.position.set(k * 0.18, 0.2, 2.3); group.add(fin); }
  for (const x of [-0.62, -0.46, 0.46, 0.62]) { const ex = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.055, 0.055, 0.2, 20, 1, true)), chrome); ex.rotation.x = Math.PI / 2; ex.position.set(x, 0.24, 2.42); group.add(ex);
    const inner = new THREE.Mesh(keep(new THREE.CircleGeometry(0.045, 20)), black); inner.position.set(x, 0.24, 2.5); group.add(inner); }
  // Rear wing on two struts.
  const wing = new THREE.Mesh(keep(new THREE.BoxGeometry(1.75, 0.03, 0.32)), black); wing.position.set(0, 1.28, 2.0); wing.rotation.x = 0.12; group.add(wing);
  for (const sx of [-1, 1]) { const st = new THREE.Mesh(keep(new THREE.BoxGeometry(0.04, 0.32, 0.12)), black); st.position.set(sx * 0.5, 1.1, 2.0); group.add(st);
    const end = new THREE.Mesh(keep(new THREE.BoxGeometry(0.02, 0.14, 0.36)), paint); end.position.set(sx * 0.88, 1.29, 2.0); group.add(end); }
  // Wheels: tyre, rim, five spokes, brake disc; they spin about x.
  const wheels: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.86, -1.4], [0.86, -1.4], [-0.88, 1.45], [0.88, 1.45]]) {
    const w = new THREE.Group(); w.position.set(x, 0.34, z);
    const tyre = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 32)), keep(new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 }))); tyre.rotation.z = Math.PI / 2; w.add(tyre);
    const spin = new THREE.Group(); w.add(spin);
    const rim = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.24, 0.24, 0.31, 32, 1, true)), chrome); rim.rotation.z = Math.PI / 2; spin.add(rim);
    for (let k = 0; k < 5; k += 1) { const sp = new THREE.Mesh(keep(new THREE.BoxGeometry(0.02, 0.44, 0.05)), chrome); sp.position.x = Math.sign(x) * 0.15; sp.rotation.x = (k * 2 * Math.PI) / 5; spin.add(sp); }
    const disc = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24)), keep(new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.8, roughness: 0.4 }))); disc.rotation.z = Math.PI / 2; disc.position.x = Math.sign(x) * 0.05; w.add(disc);
    group.add(w); wheels.push(spin);
  }
  // Contact shadow.
  const sh = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.6, 5.4)), keep(new THREE.MeshBasicMaterial({ map: keep(shadowTexture()), transparent: true, depthWrite: false })));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; group.add(sh);

  return {
    group, wheels, brake,
    setBrake: (on: number) => { brake.emissiveIntensity = 0.6 + 2.2 * Math.max(0, Math.min(1, on)); },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
