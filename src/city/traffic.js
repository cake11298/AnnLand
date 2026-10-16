import * as THREE from 'three';
import { X_STREETS, Z_STREETS, KING_Z, STREETCAR_STOPS, signal, stopDistance, pushRect } from '../game/cityLayout.js';
import { textTexture } from '../world/textures.js';

const CAR_COLORS = ['#e8507e', '#ffd65c', '#9fd6ff', '#f4f1ea', '#2d3142', '#97e0c0', '#c4aef2', '#ff7d6b', '#b9c0c9', '#f4f1ea'];
const XS = X_STREETS.map((s) => s.x), ZS = Z_STREETS.map((s) => s.z);
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const LANE = 3.5;

function carPos(c) {
  return c.axis === 'x' ? { x: c.s, z: c.line + c.dir * LANE } : { x: c.line - c.dir * LANE, z: c.s };
}

// 前方可用距離 → 目標速度
function follow(c, avail, vmax, decel, accel, dt) {
  const desired = Math.min(vmax, Math.sqrt(2 * decel * 0.5 * Math.max(0, avail)));
  c.v += THREE.MathUtils.clamp(desired - c.v, -decel * dt, accel * dt);
  if (c.v < 0) c.v = 0;
}

function redLimit(c, front, crossings, green) {
  if (green) return Infinity;
  const d = stopDistance(c.s + c.dir * front, c.dir, crossings);
  const brake = (c.v * c.v) / 28;
  return d >= brake - 0.6 || c.v < 1 ? d : Infinity;
}

function streetcarGroup() {
  const g = new THREE.Group();
  const red = M('#d6262f'), white = M('#f4f1ea'), dark = M('#2b2b31');
  const glass = new THREE.MeshStandardMaterial({ color: '#a9c9e0', transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.2, depthWrite: false });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(2.5, 0.5, 14), dark, 0, 0.3, 0);
  add(new THREE.BoxGeometry(2.8, 1.3, 16), red, 0, 1.2, 0);
  add(new THREE.BoxGeometry(2.86, 0.2, 16.06), white, 0, 1.9, 0);
  add(new THREE.BoxGeometry(2.7, 1.25, 15.8), glass, 0, 2.6, 0);
  add(new THREE.BoxGeometry(2.8, 0.35, 16), red, 0, 3.4, 0);
  for (let z = -7.6; z <= 7.6; z += 3.8) for (const x of [-1.36, 1.36]) add(new THREE.BoxGeometry(0.12, 1.25, 0.3), dark, x, 2.6, z);
  const pan = add(new THREE.BoxGeometry(0.1, 1.4, 0.1), dark, 0, 4.1, -2);
  pan.rotation.x = 0.6;
  const tex = textTexture({ w: 512, h: 128, bg: '#1c1d22', radius: 16, lines: [{ text: '504 KING', size: 70, y: 0.55, color: '#ffb02e' }] });
  for (const z of [8.02, -8.02]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    s.position.set(0, 3.0, z);
    if (z < 0) s.rotation.y = Math.PI;
    g.add(s);
  }
  return g;
}

export class Traffic {
  constructor(scene, rng) {
    this.cars = [];
    this.lanes = [];
    const add = (axis, line, dir, n, min, max) => {
      const lane = [];
      for (let i = 0; i < n; i++) {
        const c = { axis, line, dir, min, max, s: min + ((i + rng() * 0.6) / n) * (max - min), v: 8, vmax: 10 + rng() * 3, blocked: 0, honkT: 0, color: CAR_COLORS[(rng() * CAR_COLORS.length) | 0] };
        lane.push(c); this.cars.push(c);
      }
      this.lanes.push(lane);
    };
    for (const x of XS) for (const d of [1, -1]) add('z', x, d, 2, -215, 103);
    for (const z of ZS) if (z !== KING_Z) for (const d of [1, -1]) add('x', z, d, 3, -215, 215);

    const n = this.cars.length;
    const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); return m; };
    this.headMat = M('#fff6d8', { emissive: '#fff1c2', emissiveIntensity: 0.2 });
    this.tailMat = M('#c4202a', { emissive: '#ff2a2a', emissiveIntensity: 0.3 });
    this.meshes = [
      mk(new THREE.BoxGeometry(2.1, 0.9, 4.4).translate(0, 0.78, 0), M('#ffffff', { roughness: 0.35, metalness: 0.3 })),
      mk(new THREE.BoxGeometry(1.8, 0.75, 2.3).translate(0, 1.58, -0.25), M('#2b3445', { roughness: 0.25, metalness: 0.5 })),
      mk(new THREE.BoxGeometry(2.0, 0.55, 3.9).translate(0, 0.3, 0), M('#1c1d22')),
      mk(new THREE.BoxGeometry(1.7, 0.22, 0.1).translate(0, 0.9, 2.22), this.headMat),
      mk(new THREE.BoxGeometry(1.7, 0.2, 0.1).translate(0, 0.95, -2.22), this.tailMat),
    ];
    const col = new THREE.Color();
    this.cars.forEach((c, i) => this.meshes[0].setColorAt(i, col.set(c.color)));
    this.dummy = new THREE.Object3D();

    this.streetcars = [1, -1].map((dir, i) => {
      const group = streetcarGroup();
      scene.add(group);
      return { dir, s: dir * (i ? 60 : -100), v: 0, wait: 0, lastStop: null, group, line: KING_Z, axis: 'x', lane: KING_Z + dir * LANE };
    });
  }

  setNight(k) { this.headMat.emissiveIntensity = 0.2 + k * 2.2; this.tailMat.emissiveIntensity = 0.3 + k * 1.4; }

  nearestStreetcar(p) {
    return this.streetcars.find((sc) => Math.abs(p.x - sc.s) < 9 && Math.abs(p.z - sc.lane) < 5.5) ?? null;
  }

  update(dt, t, player, riding) {
    const sig = signal(t);
    const ev = { honk: false, bell: false };
    for (const lane of this.lanes) {
      for (const c of lane) {
        let gap = Infinity;
        for (const o of lane) { if (o === c) continue; const d = (o.s - c.s) * c.dir; if (d > 0 && d < gap) gap = d; }
        let avail = gap - 7;
        avail = Math.min(avail, redLimit(c, 2.2, c.axis === 'x' ? XS : ZS, c.axis === 'x' ? sig.ew : sig.ns));
        const pos = carPos(c);
        let blocked = false;
        if (player) {
          const along = c.axis === 'x' ? player.x - pos.x : player.z - pos.z;
          const lat = c.axis === 'x' ? player.z - pos.z : player.x - pos.x;
          const ahead = along * c.dir - 2.2;
          if (Math.abs(lat) < 2.4 && ahead > -1.5 && ahead < 9) { avail = Math.min(avail, ahead - 1.6); blocked = true; }
        }
        follow(c, avail, c.vmax, 26, 7, dt);
        c.blocked = blocked && c.v < 0.5 ? c.blocked + dt : 0;
        c.honkT -= dt;
        if (c.blocked > 1.6 && c.honkT <= 0) { c.honkT = 5; ev.honk = true; }
      }
    }
    for (const c of this.cars) {
      c.s += c.v * c.dir * dt;
      if (c.s > c.max) c.s = c.min; else if (c.s < c.min) c.s = c.max;
    }
    this.cars.forEach((c, i) => {
      const p = carPos(c);
      this.dummy.position.set(p.x, 0, p.z);
      this.dummy.rotation.set(0, c.axis === 'x' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI), 0);
      this.dummy.updateMatrix();
      for (const m of this.meshes) m.setMatrixAt(i, this.dummy.matrix);
      if (player) {
        const r = c.axis === 'x' ? { x0: p.x - 2.3, x1: p.x + 2.3, z0: p.z - 1.15, z1: p.z + 1.15 } : { x0: p.x - 1.15, x1: p.x + 1.15, z0: p.z - 2.3, z1: p.z + 2.3 };
        pushRect(player, r, 0.5);
      }
    });
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
    if (this.meshes[0].instanceColor) this.meshes[0].instanceColor.needsUpdate = false;

    for (const sc of this.streetcars) {
      if (sc.wait > 0) { sc.wait -= dt; sc.v = 0; }
      else {
        let avail = Infinity, stopAt = null;
        for (const x of STREETCAR_STOPS) {
          if (x === sc.lastStop) continue;
          const d = (x - sc.s) * sc.dir;
          if (d > -0.3 && d < avail) { avail = d; stopAt = x; }
        }
        if (stopAt != null && avail < 0.35 && sc.v < 0.6) { sc.wait = 3.5; sc.lastStop = stopAt; ev.bell = true; }
        avail = Math.min(avail, redLimit(sc, 8, XS, sig.ew));
        if (player && riding !== sc) {
          const ahead = (player.x - sc.s) * sc.dir - 8;
          if (Math.abs(player.z - sc.lane) < 2.6 && ahead > -1.5 && ahead < 12) avail = Math.min(avail, ahead - 1.6);
        }
        for (const o of this.streetcars) { if (o === sc || o.dir !== sc.dir) continue; const d = (o.s - sc.s) * sc.dir; if (d > 0) avail = Math.min(avail, d - 20); }
        follow(sc, avail, 9, 10, 3, dt);
        sc.s += sc.v * sc.dir * dt;
        if (sc.s > 215) { sc.s = -215; sc.lastStop = null; } else if (sc.s < -215) { sc.s = 215; sc.lastStop = null; }
      }
      sc.group.position.set(sc.s, 0, sc.lane);
      sc.group.rotation.y = sc.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (player && riding !== sc) pushRect(player, { x0: sc.s - 8.1, x1: sc.s + 8.1, z0: sc.lane - 1.5, z1: sc.lane + 1.5 }, 0.5);
    }
    return ev;
  }
}
