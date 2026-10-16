import * as THREE from 'three';
import { ANIMALS, pickTarget, stepToward, nextLine } from '../game/wander.js';
import { mulberry32 } from '../game/random.js';
import { canvasTexture } from './textures.js';

const SPHERE = new THREE.SphereGeometry(1, 18, 12);
const mats = new Map();
const M = (c) => { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 })); return mats.get(c); };
function add(p, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true;
  p.add(m);
  return m;
}
const ball = (p, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = add(p, SPHERE, mat, x, y, z); m.scale.set(r * sx, r * sy, r * sz); return m; };

let heartTex;
const heartTexture = () => (heartTex ??= canvasTexture(128, 128, (g) => {
  g.fillStyle = '#ff6f9c'; g.strokeStyle = '#fff'; g.lineWidth = 8;
  g.beginPath(); g.moveTo(64, 108);
  g.bezierCurveTo(10, 70, 12, 22, 44, 22); g.bezierCurveTo(56, 22, 62, 32, 64, 40);
  g.bezierCurveTo(66, 32, 72, 22, 84, 22); g.bezierCurveTo(116, 22, 118, 70, 64, 108);
  g.closePath(); g.stroke(); g.fill();
}));

function legs(body, mat, y, xs, zs, len) {
  const out = [];
  for (const x of xs) for (const z of zs) {
    const hip = new THREE.Group(); hip.position.set(x, y, z); body.add(hip);
    add(hip, new THREE.CapsuleGeometry(0.075, len, 4, 8), mat, 0, -len / 2, 0);
    out.push(hip);
  }
  return out;
}

function buildModel(a) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const c = M(a.color), white = M('#fff8f0'), dark = M('#2e2430'), pink = M('#ff9db8');
  let legList, tail;
  if (a.kind === 'cat') {
    const torso = add(body, new THREE.CapsuleGeometry(0.28, 0.55, 6, 12), c, 0, 0.5, 0); torso.rotation.x = Math.PI / 2;
    ball(body, 0.3, c, 0, 0.82, 0.48);
    for (const s of [-1, 1]) {
      const ear = add(body, new THREE.ConeGeometry(0.1, 0.2, 4), c, s * 0.15, 1.1, 0.46); ear.rotation.z = -s * 0.25;
      ball(body, 0.045, dark, s * 0.11, 0.86, 0.74);
      for (const k of [-1, 1]) { const w = add(body, new THREE.CylinderGeometry(0.006, 0.006, 0.28, 4), white, s * 0.2, 0.76 + k * 0.03, 0.72); w.rotation.z = Math.PI / 2 + k * 0.15 * s; }
    }
    ball(body, 0.035, pink, 0, 0.8, 0.78);
    legList = legs(body, c, 0.38, [-0.14, 0.14], [-0.25, 0.25], 0.26);
    tail = new THREE.Group(); tail.position.set(0, 0.6, -0.45); body.add(tail);
    const t = add(tail, new THREE.CapsuleGeometry(0.06, 0.55, 4, 8), c, 0, 0.3, -0.05); t.rotation.x = -0.25;
  } else if (a.kind === 'dog') {
    const torso = add(body, new THREE.CapsuleGeometry(0.32, 0.6, 6, 12), c, 0, 0.58, 0); torso.rotation.x = Math.PI / 2;
    ball(body, 0.24, white, 0, 0.5, 0.18, 1, 0.9, 1.4);
    ball(body, 0.32, c, 0, 0.95, 0.52);
    ball(body, 0.16, white, 0, 0.86, 0.78, 1.1, 0.85, 1);
    ball(body, 0.05, dark, 0, 0.92, 0.92);
    for (const s of [-1, 1]) {
      ball(body, 0.045, dark, s * 0.12, 1.02, 0.79);
      const ear = ball(body, 0.12, M(a.color === '#e8b77a' ? '#d39a5c' : '#6e4a33'), s * 0.26, 0.98, 0.44, 0.55, 1.3, 0.8); ear.rotation.z = s * 0.4;
    }
    legList = legs(body, c, 0.42, [-0.16, 0.16], [-0.28, 0.28], 0.3);
    tail = new THREE.Group(); tail.position.set(0, 0.75, -0.5); body.add(tail);
    const t = add(tail, new THREE.TorusGeometry(0.12, 0.055, 6, 14, Math.PI * 1.4), c); t.rotation.y = Math.PI / 2;
  } else {
    const torso = add(body, new THREE.CapsuleGeometry(0.3, 0.45, 6, 12), c, 0, 0.5, 0); torso.rotation.x = Math.PI / 2;
    ball(body, 0.3, c, 0, 0.82, 0.42, 1.1, 0.95, 1);
    ball(body, 0.13, white, 0, 0.76, 0.68, 1, 0.8, 1.2);
    ball(body, 0.045, dark, 0, 0.79, 0.82);
    ball(body, 0.25, dark, 0, 0.88, 0.58, 1.25, 0.32, 0.5);
    for (const s of [-1, 1]) {
      ball(body, 0.05, white, s * 0.12, 0.9, 0.7);
      ball(body, 0.1, white, s * 0.16, 0.98, 0.62, 1, 0.4, 0.3);
      add(body, new THREE.ConeGeometry(0.09, 0.14, 8), c, s * 0.2, 1.12, 0.36);
    }
    legList = legs(body, dark, 0.36, [-0.15, 0.15], [-0.2, 0.2], 0.24);
    tail = new THREE.Group(); tail.position.set(0, 0.5, -0.45); body.add(tail);
    for (let i = 0; i < 5; i++) ball(tail, 0.15 - i * 0.008, i % 2 ? dark : c, 0, 0.05 + i * 0.07, -0.1 - i * 0.13, 1, 1, 0.8);
  }
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false, opacity: 0 }));
  heart.scale.setScalar(0.6); heart.position.y = 1.5;
  root.add(heart);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, legs: legList, tail, heart };
}

export function buildAnimals(scene, colliders) {
  const rng = mulberry32(108);
  const list = ANIMALS.map((data) => {
    const m = buildModel(data);
    const start = pickTarget(rng);
    m.root.position.set(start.x, 0, start.z);
    m.root.scale.setScalar(data.kind === 'dog' ? 1.25 : 1.15);
    scene.add(m.root);
    return { ...m, data, target: pickTarget(rng), idle: rng() * 3, heading: rng() * 6.28, walkT: rng() * 10, timer: 0, pet: 0, petCount: 0, speed: 0.9 + rng() * 0.4 };
  });

  function nearest(p, range) {
    let best = null, bd = range;
    for (const a of list) { const d = Math.hypot(a.root.position.x - p.x, a.root.position.z - p.z); if (d < bd) { bd = d; best = a; } }
    return best;
  }

  function interact(a, p) {
    a.pet = 1.6; a.idle = 2.5;
    a.heading = Math.atan2(p.x - a.root.position.x, p.z - a.root.position.z);
    return nextLine(a.data, a.petCount++);
  }

  function update(dt, t, playerPos) {
    for (const a of list) {
      const pos = a.root.position;
      let moving = false;
      if (a.pet > 0) a.pet -= dt;
      else if (a.idle > 0) a.idle -= dt;
      else {
        a.timer += dt;
        const r = stepToward(pos, a.target, a.speed, dt);
        pos.x = r.x; pos.z = r.z;
        if (r.heading !== null) a.heading = r.heading;
        moving = true;
        if (r.arrived || a.timer > 14) { a.target = pickTarget(rng); a.timer = 0; a.idle = 1.5 + rng() * 4; }
      }
      for (const c of colliders) {
        const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.5;
        if (d < min && d > 1e-4) { pos.x = c.x + (dx / d) * min; pos.z = c.z + (dz / d) * min; }
      }
      if (playerPos) {
        const dx = pos.x - playerPos.x, dz = pos.z - playerPos.z, d = Math.hypot(dx, dz);
        if (d < 1.3 && d > 1e-4) { pos.x = playerPos.x + (dx / d) * 1.3; pos.z = playerPos.z + (dz / d) * 1.3; }
      }
      let diff = a.heading - a.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      a.root.rotation.y += diff * Math.min(1, dt * 5);
      if (moving) a.walkT += dt * 7;
      const sw = moving ? Math.sin(a.walkT) * 0.5 : 0;
      a.legs.forEach((l, i) => { l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? sw : -sw); });
      const hop = a.pet > 0 ? Math.abs(Math.sin((1.6 - a.pet) * 7.5)) * 0.45 : 0;
      a.body.position.y = hop + (moving ? Math.abs(Math.sin(a.walkT)) * 0.05 : 0);
      a.tail.rotation.y = Math.sin(t * (a.pet > 0 ? 18 : a.data.kind === 'dog' ? 10 : 3)) * (a.pet > 0 ? 0.7 : 0.3);
      const hk = Math.max(0, a.pet / 1.6);
      a.heart.material.opacity = hk > 0 ? Math.min(1, hk * 3) : 0;
      a.heart.position.y = 1.5 + (1 - hk) * 0.8;
    }
  }

  return { list, nearest, interact, update };
}
