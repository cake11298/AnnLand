import * as THREE from 'three';
import {
  PALETTE as P, CANDY, ATTRACTIONS, GATE, SIGN, CUPCAKES, GIFT_SPOTS, SPOKES, RING_PATH, TAU,
  generateTrees, isClear,
} from '../game/layout.js';
import { BIRTHDAY } from '../game/state.js';
import { mulberry32 } from '../game/random.js';
import { textTexture, glowTexture, stripeTexture, swirlTexture, FONT_TC } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const matCache = new Map();
const M = (color, opts) => {
  if (opts) return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...opts });
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 }));
  return matCache.get(color);
};
const SPHERE = new THREE.SphereGeometry(1, 20, 14);

function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function ball(parent, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = add(parent, SPHERE, mat, x, y, z);
  m.scale.set(r * sx, r * sy, r * sz);
  return m;
}
function cylBetween(parent, a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = add(parent, new THREE.CylinderGeometry(r, r, dir.length(), 10), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return m;
}

const DAY = { top: new THREE.Color('#8fd0ff'), bottom: new THREE.Color('#fff0f4') };
const DUSK = { top: new THREE.Color('#231e4d'), bottom: new THREE.Color('#f39ab7') };

export function buildWorld(scene) {
  const rng = mulberry32(20261008);
  const animated = [];
  const colliders = [];
  const collide = (x, z, r) => colliders.push({ x, z, r });
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff4c2', emissive: '#ffd36b', emissiveIntensity: 0.5, roughness: 0.3 });

  // Sky, fog, light
  const skyU = { top: { value: DAY.top.clone() }, bottom: { value: DAY.bottom.clone() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); \n#include <colorspace_fragment>\n }',
  }));
  scene.add(sky);
  scene.fog = new THREE.Fog(DAY.bottom.clone(), 70, 230);

  const hemi = new THREE.HemisphereLight('#ffffff', '#ffd3e2', 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e6', 2.4);
  sun.position.set(30, 55, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 160 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun);

  // Ground & paths
  const ground = add(scene, new THREE.CircleGeometry(300, 64), M('#a9dda0'));
  ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  const lawn = add(scene, new THREE.CircleGeometry(44, 80), M(P.grass), 0, 0.02, 0);
  lawn.rotation.x = -Math.PI / 2; lawn.castShadow = false;
  const pathMat = M(P.path);
  const ring = add(scene, new THREE.RingGeometry(RING_PATH.inner, RING_PATH.outer, 80), pathMat, 0, 0.05, 0);
  ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
  for (const s of SPOKES) {
    const len = Math.hypot(s.x, s.z) - RING_PATH.outer + 1;
    const strip = add(scene, new THREE.PlaneGeometry(3.4, len), pathMat, 0, 0.04, 0);
    strip.rotation.x = -Math.PI / 2;
    const a = Math.atan2(s.x, s.z);
    strip.rotation.z = a; strip.castShadow = false;
    const mid = RING_PATH.outer - 1 + len / 2;
    strip.position.set(Math.sin(a) * mid, 0.04, Math.cos(a) * mid);
    strip.rotation.set(-Math.PI / 2, 0, a);
  }
  // little stepping dots on ring
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU, r = (RING_PATH.inner + RING_PATH.outer) / 2;
    const d = add(scene, new THREE.CircleGeometry(0.28, 12), M(CANDY[i % CANDY.length]), Math.sin(a) * r, 0.07, Math.cos(a) * r);
    d.rotation.x = -Math.PI / 2; d.castShadow = false;
  }

  const cake = buildCake(scene, animated, rng);
  collide(0, 0, ATTRACTIONS.cake.r);
  const ferris = buildFerris(scene, animated, bulbMat);
  collide(ATTRACTIONS.ferris.x, ATTRACTIONS.ferris.z, ATTRACTIONS.ferris.r);
  const carousel = buildCarousel(scene, animated, bulbMat);
  collide(ATTRACTIONS.carousel.x, ATTRACTIONS.carousel.z, ATTRACTIONS.carousel.r);
  buildGate(scene, animated);
  collide(-GATE.pillarX, GATE.z, 1.2); collide(GATE.pillarX, GATE.z, 1.2);
  buildSign(scene);
  collide(SIGN.x, SIGN.z, SIGN.r);
  for (const c of CUPCAKES) { buildCupcake(scene, c, rng); collide(c.x, c.z, 1.9); }
  for (const t of generateTrees(rng)) { buildTree(scene, t); if (t.inner) collide(t.x, t.z, 0.9 * t.s); }
  buildBunting(scene, colliders);
  buildBalloons(scene, animated, rng);
  buildClouds(scene, animated, rng);
  const gifts = GIFT_SPOTS.map((s, i) => buildGift(scene, animated, s, i));

  function setDusk(k) {
    skyU.top.value.copy(DAY.top).lerp(DUSK.top, k);
    skyU.bottom.value.copy(DAY.bottom).lerp(DUSK.bottom, k);
    scene.fog.color.copy(skyU.bottom.value);
    hemi.intensity = 1.5 - k * 0.95;
    sun.intensity = 2.4 - k * 2.0;
    bulbMat.emissiveIntensity = 0.5 + k * 2.5;
    cake.light.intensity = (cake.lit / BIRTHDAY.age) * (8 + k * 40);
  }

  return {
    colliders, gifts, cake, setDusk, ferris, carousel,
    update(t, dt) { for (const f of animated) f(t, dt); },
  };
}

function buildCake(scene, animated, rng) {
  const g = new THREE.Group();
  scene.add(g);
  add(g, new THREE.CylinderGeometry(7.3, 7.0, 0.4, 56), M('#ffffff', { roughness: 0.25 }), 0, 0.2, 0);
  const tiers = [
    { r: 6, h: 2.4, c: P.pink, f: P.white },
    { r: 4.4, h: 2.2, c: P.cream, f: P.pink },
    { r: 2.9, h: 2, c: P.lilac, f: P.white },
  ];
  let y = 0.4;
  for (const t of tiers) {
    add(g, new THREE.CylinderGeometry(t.r, t.r, t.h, 56), M(t.c, { roughness: 0.75 }), 0, y + t.h / 2, 0);
    const top = y + t.h;
    const rim = add(g, new THREE.TorusGeometry(t.r - 0.05, 0.26, 10, 64), M(t.f), 0, top, 0);
    rim.rotation.x = Math.PI / 2;
    const beads = Math.round(t.r * 6);
    for (let i = 0; i < beads; i++) {
      const a = (i / beads) * TAU;
      ball(g, 0.22, M(t.f), Math.cos(a) * (t.r + 0.04), y + 0.2, Math.sin(a) * (t.r + 0.04));
    }
    const drips = Math.round(t.r * 4);
    for (let i = 0; i < drips; i++) {
      const a = (i / drips) * TAU + rng() * 0.1;
      ball(g, 0.3, M(t.f), Math.cos(a) * t.r, top - 0.35 - rng() * 0.35, Math.sin(a) * t.r, 0.9, 1.7, 0.6).rotation.y = -a;
    }
    for (let i = 0; i < 36; i++) {
      const a = rng() * TAU, hh = y + 0.5 + rng() * (t.h - 1.1);
      ball(g, 0.07, M(CANDY[i % CANDY.length]), Math.cos(a) * (t.r + 0.01), hh, Math.sin(a) * (t.r + 0.01), 1, 2, 1).rotation.z = rng() * 3;
    }
    y = top;
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const x = Math.cos(a) * 5.2, z = Math.sin(a) * 5.2;
    ball(g, 0.4, M(P.berry, { roughness: 0.35 }), x, 3.15, z, 1, 1.15, 1);
    add(g, new THREE.ConeGeometry(0.22, 0.2, 6), M(P.leaf), x, 3.6, z);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.3;
    ball(g, 0.34, M(P.white), Math.cos(a) * 3.65, 5.15, Math.sin(a) * 3.65, 1, 0.8, 1);
    ball(g, 0.14, M(P.berry), Math.cos(a) * 3.65, 5.5, Math.sin(a) * 3.65);
  }

  const topY = y;
  const flames = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffc44d' });
  const flameCore = new THREE.MeshBasicMaterial({ color: '#fff6d8' });
  const wick = M('#3a2a2a');
  for (let i = 0; i < BIRTHDAY.age; i++) {
    const a = (i / BIRTHDAY.age) * TAU;
    const x = Math.cos(a) * 2.2, z = Math.sin(a) * 2.2;
    add(g, new THREE.CylinderGeometry(0.11, 0.11, 1.1, 10), M(CANDY[i % 5]), x, topY + 0.55, z);
    add(g, new THREE.CylinderGeometry(0.025, 0.025, 0.18, 6), wick, x, topY + 1.19, z);
    const f = new THREE.Group();
    f.position.set(x, topY + 1.42, z);
    const outer = new THREE.Mesh(SPHERE, flameMat); outer.scale.set(0.13, 0.25, 0.13); f.add(outer);
    const inner = new THREE.Mesh(SPHERE, flameCore); inner.scale.set(0.06, 0.12, 0.06); inner.position.y = -0.05; f.add(inner);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb347', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(0.9, 0.9, 1); f.add(halo);
    g.add(f);
    flames.push(f);
  }
  const light = new THREE.PointLight('#ffb36b', 8, 30, 1.2);
  light.position.set(0, topY + 2.2, 0);
  g.add(light);

  const topper = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture({ w: 512, h: 512, lines: [
    { text: String(BIRTHDAY.age), size: 300, y: 0.42, color: P.gold, stroke: '#ffffff', strokeWidth: 26 },
    { text: BIRTHDAY.name, size: 110, y: 0.82, color: P.rose, stroke: '#ffffff', strokeWidth: 18 },
  ] }), transparent: true }));
  topper.scale.set(3.6, 3.6, 1);
  topper.position.set(0, topY + 3.6, 0);
  g.add(topper);

  const celebrateText = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture({ w: 1024, h: 320, lines: [
    { text: `Happy Birthday, ${BIRTHDAY.name}!`, size: 112, y: 0.38, color: '#ffffff', stroke: P.rose, strokeWidth: 22 },
    { text: `${BIRTHDAY.dateLabel}, ${BIRTHDAY.year}`, size: 66, y: 0.78, color: P.butter, stroke: '#5b2a5e', strokeWidth: 14 },
  ] }), transparent: true, depthTest: false }));
  celebrateText.scale.set(16, 5, 1);
  celebrateText.position.set(0, 16, 0);
  celebrateText.visible = false;
  celebrateText.renderOrder = 10;
  g.add(celebrateText);

  const api = {
    group: g, flames, light, topper, celebrateText, topY, lit: BIRTHDAY.age,
    setLit(n) { api.lit = n; flames.forEach((f, i) => { f.visible = i < n; }); },
  };
  animated.push((t) => {
    flames.forEach((f, i) => {
      f.scale.set(1, 1 + Math.sin(t * 18 + i * 1.7) * 0.14, 1);
      f.rotation.z = Math.sin(t * 9 + i) * 0.08;
    });
    topper.position.y = topY + 3.6 + Math.sin(t * 1.5) * 0.15;
    if (celebrateText.visible) celebrateText.position.y = 16 + Math.sin(t * 1.2) * 0.4;
  });
  api.setLit(0);
  return api;
}

function buildFerris(scene, animated, bulbMat) {
  const { x, z } = ATTRACTIONS.ferris;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.atan2(-x, -z);
  scene.add(g);
  const H = 11.6, R = 8;
  const white = M(P.white), pink = M(P.pink), lilac = M(P.lilac);
  add(g, new THREE.BoxGeometry(11, 0.4, 5.4), M(P.cream), 0, 0.2, 0);
  for (const s of [-1, 1]) {
    cylBetween(g, V(-4.5, 0.3, s * 2.3), V(0, H, s * 1.3), 0.24, white);
    cylBetween(g, V(4.5, 0.3, s * 2.3), V(0, H, s * 1.3), 0.24, white);
  }
  const wheel = new THREE.Group();
  wheel.position.y = H;
  g.add(wheel);
  const hub = add(wheel, new THREE.CylinderGeometry(0.7, 0.7, 2.8, 20), M(P.butter));
  hub.rotation.x = Math.PI / 2;
  for (const zz of [-0.9, 0.9]) {
    add(wheel, new THREE.TorusGeometry(R, 0.2, 10, 80), pink, 0, 0, zz);
    add(wheel, new THREE.TorusGeometry(R * 0.55, 0.12, 8, 56), lilac, 0, 0, zz);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      cylBetween(wheel, V(0, 0, zz), V(Math.cos(a) * R, Math.sin(a) * R, zz), 0.08, white);
    }
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      const b = new THREE.Mesh(SPHERE, bulbMat);
      b.scale.setScalar(0.16);
      b.position.set(Math.cos(a) * (R + 0.25), Math.sin(a) * (R + 0.25), zz);
      wheel.add(b);
    }
  }
  const cabins = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const axle = add(wheel, new THREE.CylinderGeometry(0.1, 0.1, 1.9, 8), white, Math.cos(a) * R, Math.sin(a) * R, 0);
    axle.rotation.x = Math.PI / 2;
    const cab = new THREE.Group();
    cab.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    wheel.add(cab);
    const c = CANDY[i % CANDY.length];
    add(cab, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), white, 0, -0.15, 0);
    add(cab, new THREE.ConeGeometry(1.1, 0.55, 16), M(c), 0, -0.55, 0);
    for (let k = 0; k < 4; k++) {
      const a2 = (k / 4) * TAU + Math.PI / 4;
      add(cab, new THREE.CylinderGeometry(0.04, 0.04, 1.7, 6), white, Math.cos(a2) * 0.8, -1.65, Math.sin(a2) * 0.8);
    }
    add(cab, new THREE.CylinderGeometry(0.95, 0.75, 0.8, 18, 1, true), M(c, { side: THREE.DoubleSide }), 0, -2.4, 0);
    add(cab, new THREE.CylinderGeometry(0.75, 0.75, 0.06, 18), M(P.cream), 0, -2.78, 0);
    cabins.push(cab);
  }
  animated.push((t, dt) => {
    wheel.rotation.z += dt * 0.14;
    for (const c of cabins) c.rotation.z = -wheel.rotation.z;
  });
  return { group: g, wheel, cabins };
}

function buildCarousel(scene, animated, bulbMat) {
  const { x, z } = ATTRACTIONS.carousel;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  add(g, new THREE.CylinderGeometry(6.4, 6.7, 0.6, 48), M(P.cream), 0, 0.3, 0);
  const rot = new THREE.Group();
  rot.position.y = 0.6;
  g.add(rot);
  add(rot, new THREE.CylinderGeometry(6, 6, 0.25, 48), M(P.pink), 0, 0.12, 0);
  add(rot, new THREE.CylinderGeometry(0.6, 0.6, 5.6, 20), M(P.butter), 0, 2.8, 0);
  add(rot, new THREE.CylinderGeometry(6.6, 6.6, 0.8, 48), M(P.butter), 0, 5.6, 0);
  add(rot, new THREE.ConeGeometry(7.1, 3, 48), new THREE.MeshStandardMaterial({ map: stripeTexture([P.pink, '#ffffff'], 24), roughness: 0.6 }), 0, 7.5, 0);
  ball(rot, 0.45, M(P.butter), 0, 9.15, 0);
  add(rot, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), M(P.white), 0, 9.9, 0);
  const flag = add(rot, new THREE.ConeGeometry(0.3, 0.7, 3), M(P.rose), 0.35, 10.2, 0);
  flag.rotation.z = -Math.PI / 2;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    ball(rot, 0.4, M(i % 2 ? P.white : P.lilac), Math.cos(a) * 6.75, 5.05, Math.sin(a) * 6.75, 1, 0.8, 1);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + 0.13;
    const b = new THREE.Mesh(SPHERE, bulbMat);
    b.scale.setScalar(0.15);
    b.position.set(Math.cos(a) * 6.62, 5.6, Math.sin(a) * 6.62);
    rot.add(b);
  }
  const gold = M(P.gold, { metalness: 0.4, roughness: 0.35 });
  const ponies = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const px = Math.cos(a) * 4.2, pz = Math.sin(a) * 4.2;
    add(rot, new THREE.CylinderGeometry(0.07, 0.07, 5, 8), gold, px, 2.7, pz);
    const p = new THREE.Group();
    p.position.set(px, 2, pz);
    p.rotation.y = -a;
    rot.add(p);
    const c = M(CANDY[i % CANDY.length]);
    const body = add(p, new THREE.CapsuleGeometry(0.42, 1.0, 6, 14), c);
    body.rotation.x = Math.PI / 2;
    const neck = add(p, new THREE.CapsuleGeometry(0.2, 0.5, 4, 10), c, 0, 0.45, -0.7);
    neck.rotation.x = 0.6;
    ball(p, 0.32, c, 0, 0.85, -0.95, 0.9, 0.9, 1.2);
    for (const s of [-1, 1]) add(p, new THREE.ConeGeometry(0.08, 0.22, 6), c, s * 0.14, 1.15, -0.9);
    const mane = add(p, new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), M(P.white), 0, 0.75, -0.65);
    mane.rotation.x = 0.6;
    add(p, new THREE.BoxGeometry(0.6, 0.12, 0.6), M(P.rose), 0, 0.45, 0);
    for (const [lx, lz] of [[-0.22, -0.5], [0.22, -0.5], [-0.22, 0.5], [0.22, 0.5]]) add(p, new THREE.CylinderGeometry(0.07, 0.06, 0.7, 6), c, lx, -0.55, lz);
    const tail = add(p, new THREE.CapsuleGeometry(0.08, 0.45, 4, 8), M(P.white), 0, 0.05, 0.85);
    tail.rotation.x = -0.6;
    ponies.push(p);
  }
  animated.push((t, dt) => {
    rot.rotation.y += dt * 0.45;
    ponies.forEach((p, i) => { p.position.y = 2 + Math.sin(t * 2 + i * 1.3) * 0.35; });
  });
  return { group: g, rot, ponies };
}

function buildGate(scene, animated) {
  const g = new THREE.Group();
  g.position.set(GATE.x, 0, GATE.z);
  scene.add(g);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 8; k++) add(g, new THREE.CylinderGeometry(0.75, 0.75, 1.0, 24), M(k % 2 ? P.white : P.pink), s * GATE.pillarX, 0.5 + k, 0);
    ball(g, 1.05, M(P.butter), s * GATE.pillarX, 8.6, 0);
    const cols = [P.pink, P.butter, P.mint, P.lilac, P.sky];
    cols.forEach((c, i) => {
      const a = (i / cols.length) * TAU;
      const bx = s * GATE.pillarX + Math.cos(a) * 1.3, by = 11.2 + (i % 2) * 0.8, bz = Math.sin(a) * 1.3;
      const b = ball(g, 0.75, M(c, { roughness: 0.25 }), bx, by, bz, 1, 1.18, 1);
      cylBetween(g, V(bx, by - 0.85, bz), V(s * GATE.pillarX, 9.5, 0), 0.015, M('#ddd'));
      animated.push((t) => { b.position.y = by + Math.sin(t * 1.6 + i + s) * 0.15; });
    });
  }
  const tex = textTexture({
    w: 1024, h: 256, bg: P.rose, border: '#ffffff', radius: 60,
    lines: [
      { text: 'ANN LAND', size: 120, y: 0.42, color: '#ffffff' },
      { text: `Happy 21st Birthday  ·  ${BIRTHDAY.dateLabel}, ${BIRTHDAY.year}`, size: 48, y: 0.76, color: P.butter },
    ],
  });
  const side = M(P.rose);
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  add(g, new THREE.BoxGeometry(14, 3.4, 0.35), [side, side, side, side, faceMat, faceMat], 0, 7.4, 0);
}

function buildSign(scene) {
  const g = new THREE.Group();
  g.position.set(SIGN.x, 0, SIGN.z);
  g.rotation.y = Math.atan2(-SIGN.x, 24 - SIGN.z);
  scene.add(g);
  for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.12, 0.12, 3, 8), M(P.white), s * 1.9, 1.5, 0);
  const tex = textTexture({
    w: 1024, h: 512, bg: P.butter, radius: 70, border: '#ffffff',
    lines: [
      { text: BIRTHDAY.dateLabel, size: 190, y: 0.4, color: P.rose },
      { text: `Happy Birthday Ann · ${BIRTHDAY.year}`, size: 78, y: 0.77, color: '#7a3f63' },
    ],
  });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  const side = M(P.butter);
  add(g, new THREE.BoxGeometry(5, 2.5, 0.25), [side, side, side, side, face, face], 0, 3, 0);
}

function buildCupcake(scene, c, rng) {
  const g = new THREE.Group();
  g.position.set(c.x, 0, c.z);
  g.scale.setScalar(1.25);
  scene.add(g);
  const liner = new THREE.MeshStandardMaterial({ map: stripeTexture([P.sky, '#ffffff'], 20), roughness: 0.7 });
  add(g, new THREE.CylinderGeometry(1.4, 1.05, 1.5, 20), liner, 0, 0.75, 0);
  const f = M(rng() < 0.5 ? P.pink : P.cream);
  ball(g, 1.45, f, 0, 1.75, 0, 1, 0.5, 1);
  ball(g, 1.05, f, 0, 2.3, 0, 1, 0.55, 1);
  ball(g, 0.65, f, 0, 2.75, 0, 1, 0.6, 1);
  ball(g, 0.3, M(P.berry, { roughness: 0.3 }), 0, 3.3, 0);
  for (let i = 0; i < 26; i++) {
    const a = rng() * TAU, h = rng();
    const r = 1.35 - h * 0.7;
    const s = ball(g, 0.05, M(CANDY[i % CANDY.length]), Math.cos(a) * r, 1.95 + h * 0.75, Math.sin(a) * r, 1, 2.4, 1);
    s.rotation.set(rng() * 3, rng() * 3, rng() * 3);
  }
}

function buildTree(scene, t) {
  const g = new THREE.Group();
  g.position.set(t.x, 0, t.z);
  g.scale.setScalar(t.s);
  scene.add(g);
  if (t.type === 'lollipop') {
    add(g, new THREE.CylinderGeometry(0.12, 0.12, 3.4, 8), M(P.white), 0, 1.7, 0);
    const c = CANDY[Math.floor(Math.abs(t.x * 7 + t.z * 3)) % CANDY.length];
    const face = new THREE.MeshStandardMaterial({ map: swirlTexture('#ffffff', c), roughness: 0.3 });
    const disc = add(g, new THREE.CylinderGeometry(1.2, 1.2, 0.35, 32), [M(c), face, face], 0, 4.4, 0);
    disc.rotation.x = Math.PI / 2;
    disc.rotation.z = Math.atan2(t.x, t.z);
    g.rotation.y = Math.atan2(t.x, t.z);
    disc.rotation.set(Math.PI / 2, 0, 0);
  } else {
    add(g, new THREE.CylinderGeometry(0.22, 0.3, 1.8, 8), M('#c99a77'), 0, 0.9, 0);
    ball(g, 1.5, M(P.leaf), 0, 2.8, 0);
    ball(g, 1.05, M('#93dba6'), 0.7, 3.6, 0.3);
    ball(g, 0.9, M('#6ec488'), -0.6, 3.4, -0.4);
  }
}

function buildBunting(scene, colliders) {
  const R = 15, top = 5.6;
  const angles = [30, 90, 150, 210, 270, 330].map((d) => (d * Math.PI) / 180);
  const pts = angles.map((a) => V(Math.sin(a) * R, top, Math.cos(a) * R));
  pts.forEach((p) => {
    add(scene, new THREE.CylinderGeometry(0.1, 0.12, top, 8), M(P.white), p.x, top / 2, p.z);
    ball(scene, 0.22, M(P.butter), p.x, top + 0.1, p.z);
    colliders.push({ x: p.x, z: p.z, r: 0.35 });
  });
  const pos = [], col = [];
  const lineMat = new THREE.LineBasicMaterial({ color: '#ffffff' });
  const cl = new THREE.Color();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const at = (t) => V(a.x + (b.x - a.x) * t, top - 1.3 * 4 * t * (1 - t), a.z + (b.z - a.z) * t);
    const linePts = [];
    for (let k = 0; k <= 24; k++) linePts.push(at(k / 24));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), lineMat));
    const n = 16;
    for (let k = 0; k < n; k++) {
      const t1 = (k + 0.12) / n, t2 = (k + 0.88) / n;
      const p1 = at(t1), p2 = at(t2), m = at((t1 + t2) / 2);
      m.y -= 0.75;
      pos.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, m.x, m.y, m.z);
      cl.set(CANDY[(k + i) % CANDY.length]);
      for (let v = 0; v < 3; v++) col.push(cl.r, cl.g, cl.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const flags = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 }));
  flags.castShadow = true;
  scene.add(flags);
}

function makeBalloon(color) {
  const g = new THREE.Group();
  ball(g, 0.65, M(color, { roughness: 0.22, emissive: color, emissiveIntensity: 0.08 }), 0, 0, 0, 1, 1.18, 1);
  const knot = add(g, new THREE.ConeGeometry(0.1, 0.18, 8), M(color), 0, -0.82, 0);
  knot.rotation.x = Math.PI;
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, -0.9, 0), V(0.1, -2, 0.05), V(-0.05, -3.2, 0)]), new THREE.LineBasicMaterial({ color: '#ffffff' })));
  return g;
}

function buildBalloons(scene, animated, rng) {
  let placed = 0, tries = 0;
  while (placed < 26 && tries < 600) {
    tries++;
    const a = rng() * TAU, r = 8 + rng() * 30;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (Math.hypot(x - ATTRACTIONS.ferris.x, z - ATTRACTIONS.ferris.z) < 10) continue;
    if (Math.hypot(x - ATTRACTIONS.carousel.x, z - ATTRACTIONS.carousel.z) < 8) continue;
    if (Math.hypot(x, z) < 9) continue;
    const b = makeBalloon(CANDY[placed % CANDY.length]);
    const by = 5 + rng() * 3.5, ph = rng() * TAU;
    b.position.set(x, by, z);
    scene.add(b);
    animated.push((t) => {
      b.position.y = by + Math.sin(t * 0.9 + ph) * 0.45;
      b.rotation.z = Math.sin(t * 0.7 + ph) * 0.08;
    });
    placed++;
  }
}

function buildClouds(scene, animated, rng) {
  const mat = M('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(SPHERE, mat);
      m.scale.setScalar(2 + rng() * 2);
      m.position.set(k * 2.6 - n * 1.3, rng() * 1.2, rng() * 1.5);
      g.add(m);
    }
    const a = rng() * TAU, r = 30 + rng() * 50, y = 28 + rng() * 14;
    g.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    scene.add(g);
    const speed = 0.012 + rng() * 0.02;
    animated.push((t, dt) => {
      const ang = Math.atan2(g.position.x, g.position.z) + dt * speed;
      g.position.x = Math.sin(ang) * r; g.position.z = Math.cos(ang) * r;
    });
  }
}

const GIFT_COLORS = [
  [P.pink, P.white], [P.mint, P.rose], [P.lilac, P.butter], [P.butter, P.rose],
  [P.sky, P.white], [P.coral, P.butter], [P.white, P.pink], [P.rose, P.mint],
];

function buildGift(scene, animated, s, i) {
  const [c, rib] = GIFT_COLORS[i % GIFT_COLORS.length];
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  scene.add(g);
  const box = new THREE.Group();
  box.position.y = 1.4;
  g.add(box);
  const ribbon = M(rib, { roughness: 0.35 });
  add(box, new THREE.BoxGeometry(1.4, 1.2, 1.4), M(c, { roughness: 0.45 }));
  add(box, new THREE.BoxGeometry(1.56, 0.36, 1.56), M(c, { roughness: 0.45 }), 0, 0.72, 0);
  add(box, new THREE.BoxGeometry(0.3, 1.24, 1.44), ribbon);
  add(box, new THREE.BoxGeometry(1.44, 1.24, 0.3), ribbon);
  add(box, new THREE.BoxGeometry(0.32, 0.38, 1.6), ribbon, 0, 0.72, 0);
  add(box, new THREE.BoxGeometry(1.6, 0.38, 0.32), ribbon, 0, 0.72, 0);
  for (const sx of [-1, 1]) {
    const loop = add(box, new THREE.TorusGeometry(0.26, 0.09, 8, 20), ribbon, sx * 0.25, 1.1, 0);
    loop.rotation.z = sx * 0.7;
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 16, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 8;
  g.add(beam);
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.7, 40),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.08;
  g.add(halo);
  const gift = { id: i, color: c, group: g, box, beam, halo, x: s.x, z: s.z, collected: false, collectT: 0 };
  animated.push((t) => {
    if (gift.collected) return;
    box.rotation.y = t * 0.8 + i;
    box.position.y = 1.4 + Math.sin(t * 2 + i) * 0.25;
    halo.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.08);
  });
  return gift;
}

export function buildPlayer() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const w = M('#fffaf6', { roughness: 0.8 }), pk = M(P.pink), dark = M('#3b2b3a');
  const cheeks = [];
  ball(body, 0.62, w, 0, 0.78, 0, 1, 1.05, 0.95);
  ball(body, 0.56, w, 0, 1.72, 0);
  for (const s of [-1, 1]) {
    const ear = add(body, new THREE.CapsuleGeometry(0.13, 0.55, 6, 12), w, s * 0.24, 2.42, -0.02);
    ear.rotation.z = -s * 0.22;
    add(ear, new THREE.CapsuleGeometry(0.065, 0.4, 4, 8), pk, 0, 0, 0.08);
    ball(body, 0.075, dark, s * 0.2, 1.8, 0.49);
    cheeks.push(ball(body, 0.1, pk, s * 0.33, 1.62, 0.42, 1, 0.6, 0.5));
    ball(body, 0.22, pk, s * 0.28, 0.13, 0.15, 1, 0.6, 1.3);
    ball(body, 0.17, w, s * 0.6, 1.0, 0.12);
  }
  ball(body, 0.06, pk, 0, 1.68, 0.55);
  ball(body, 0.2, w, 0, 0.7, -0.6);
  const hat = add(body, new THREE.ConeGeometry(0.24, 0.62, 20), new THREE.MeshStandardMaterial({ map: stripeTexture([P.lilac, P.butter], 8), roughness: 0.6 }), 0.02, 2.5, 0.05);
  hat.rotation.z = 0.12;
  ball(body, 0.1, M(P.rose), 0.06, 2.84, 0.05);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, cheeks };
}
