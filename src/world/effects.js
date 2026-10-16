import * as THREE from 'three';
import { CANDY } from '../game/layout.js';
import { glowTexture } from './textures.js';

export class Confetti {
  constructor(scene, radius, count = 450) {
    this.radius = radius;
    this.count = count;
    this.boost = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.28), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), count);
    this.mesh.frustumCulled = false;
    this.d = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      this.d.push(this.spawn({}, Math.random() * 34));
      this.mesh.setColorAt(i, c.set(CANDY[i % CANDY.length]));
    }
    this.dummy = new THREE.Object3D();
    scene.add(this.mesh);
  }
  spawn(p, y) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * this.radius;
    return Object.assign(p, { x: Math.sin(a) * r, z: Math.cos(a) * r, y, v: 0.8 + Math.random() * 1.4, ph: Math.random() * 6.28, rx: 1 + Math.random() * 3, ry: 1 + Math.random() * 2 });
  }
  update(dt, t) {
    const k = 1 + this.boost * 1.6;
    const m = this.dummy;
    for (let i = 0; i < this.count; i++) {
      const p = this.d[i];
      p.y -= p.v * dt * k;
      if (p.y < 0.05) this.spawn(p, 30 + Math.random() * 6);
      m.position.set(p.x + Math.sin(t * 0.8 + p.ph) * 0.6, p.y, p.z + Math.cos(t * 0.6 + p.ph) * 0.6);
      m.rotation.set(t * p.rx + p.ph, t * p.ry, p.ph);
      m.updateMatrix();
      this.mesh.setMatrixAt(i, m.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export function textPoints(text, { width = 18, step = 4, font = '700 110px Fredoka, "Noto Sans TC", sans-serif' } = {}) {
  const W = 340, H = 140;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, W / 2, H / 2 + 4);
  const d = g.getImageData(0, 0, W, H).data;
  const s = width / W, pts = [];
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (d[(y * W + x) * 4 + 3] > 128) pts.push({ x: (x - W / 2) * s, y: (H / 2 - y) * s, z: 0 });
  return pts;
}

export function heartPoints(scale = 0.4, n = 150) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push({ x: 16 * Math.sin(t) ** 3 * scale, y: (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * scale, z: 0 });
  }
  return pts;
}

export class Puffs {
  constructor(scene) { this.scene = scene; this.items = []; this.pool = []; }
  spawn({ pos, vel, color = '#ffffff', size = 0.3, grow = 1, life = 1, opacity = 0.6, additive = false }) {
    const s = this.pool.pop() ?? new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false }));
    s.material.color.set(color);
    s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    s.position.set(pos.x, pos.y, pos.z);
    s.scale.setScalar(size);
    s.material.opacity = 0;
    this.scene.add(s);
    this.items.push({ s, vel: new THREE.Vector3(vel.x, vel.y, vel.z), size, grow, life, opacity, age: 0 });
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      const k = it.age / it.life;
      it.s.position.addScaledVector(it.vel, dt);
      it.vel.multiplyScalar(1 - Math.min(1, dt * 0.9));
      it.s.scale.setScalar(it.size + it.grow * it.age);
      it.s.material.opacity = it.opacity * (1 - k) * Math.min(1, it.age * 10);
      if (k >= 1) { this.scene.remove(it.s); this.pool.push(it.s); this.items.splice(i, 1); }
    }
  }
}

export class Lanterns {
  constructor(scene, radius, count = 40) {
    this.radius = radius; this.active = false; this.time = 0; this.items = [];
    const body = new THREE.CylinderGeometry(0.42, 0.3, 0.75, 14, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffb35c', side: THREE.DoubleSide });
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(body, mat));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffcf7a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(2.4);
      g.add(glow);
      g.visible = false;
      scene.add(g);
      this.items.push({ g, delay: 0, speed: 0, ph: 0, x: 0, z: 0 });
    }
  }
  release() {
    this.active = true; this.time = 0;
    for (const it of this.items) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.sqrt(Math.random()) * this.radius;
      Object.assign(it, { x: Math.sin(a) * r, z: Math.cos(a) * r, delay: Math.random() * 7, speed: 1.1 + Math.random() * 1.1, ph: Math.random() * 6.28 });
      it.g.position.set(it.x, 0.6, it.z);
      it.g.visible = false;
    }
  }
  update(dt) {
    if (!this.active) return;
    this.time += dt;
    for (const it of this.items) {
      const lt = this.time - it.delay;
      if (lt < 0) continue;
      it.g.visible = it.g.position.y < 90;
      it.g.position.set(it.x + Math.sin(lt * 0.6 + it.ph) * 0.8, 0.6 + lt * it.speed, it.z + Math.cos(lt * 0.5 + it.ph) * 0.8);
    }
  }
}

const FW_COLORS = ['#ff8fb1', '#ffd65c', '#97e0c0', '#c4aef2', '#9fd6ff', '#ffffff', '#ff7d6b'];

export class Fireworks {
  constructor(scene, onBoom) {
    this.scene = scene;
    this.bursts = [];
    this.auto = false;
    this.timer = 0;
    this.onBoom = onBoom;
  }
  burst(pos, { count = 160, speed = 10, size = 0.6, life = 2.4, palette, targets = null, gravity = 5 } = {}) {
    if (targets) { count = targets.length; gravity = 0.35; life = Math.max(life, 3.2); }
    const pal = palette ?? [FW_COLORS[(Math.random() * FW_COLORS.length) | 0], FW_COLORS[(Math.random() * FW_COLORS.length) | 0]];
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      positions.set([pos.x, pos.y, pos.z], i * 3);
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      if (targets) {
        const tg = targets[i];
        vel.set([tg.x * 1.45, tg.y * 1.45, (tg.z ?? 0) * 1.45], i * 3);
      } else {
        const sp = speed * (0.75 + Math.random() * 0.25);
        vel.set([s * Math.cos(th) * sp, u * sp, s * Math.sin(th) * sp], i * 3);
      }
      c.set(pal[i % pal.length]);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.bursts.push({ pts, vel, age: 0, life, gravity });
  }
  update(dt) {
    if (this.auto) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0.45 + Math.random() * 0.6;
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 16;
        this.burst({ x: Math.sin(a) * r, y: 20 + Math.random() * 12, z: Math.cos(a) * r - 6 });
        this.onBoom?.();
      }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      const p = b.pts.geometry.attributes.position.array;
      const drag = 1 - 1.4 * dt;
      for (let k = 0; k < p.length; k += 3) {
        b.vel[k + 1] -= b.gravity * dt;
        b.vel[k] *= drag; b.vel[k + 1] *= drag; b.vel[k + 2] *= drag;
        p[k] += b.vel[k] * dt; p[k + 1] += b.vel[k + 1] * dt; p[k + 2] += b.vel[k + 2] * dt;
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, 1 - Math.pow(b.age / b.life, 2));
      if (b.age >= b.life) {
        this.scene.remove(b.pts);
        b.pts.geometry.dispose(); b.pts.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }
}
