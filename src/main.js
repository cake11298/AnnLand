import * as THREE from 'three';
import { BIRTHDAY, GIFT_COUNT, GIFTS, createGameState, collectGift, canBlowCandles, blowCandle, boardRide, birthdayStatus } from './game/state.js';
import { PARK_RADIUS, SPAWN, ATTRACTIONS } from './game/layout.js';
import { buildWorld, buildPlayer } from './world/world.js';
import { Confetti, Fireworks, Puffs, Lanterns, textPoints, heartPoints } from './world/effects.js';
import { glowTexture } from './world/textures.js';
import { buildAnimals } from './world/animals.js';
import * as audio from './audio.js';
import { mountVoiceAgent, isFromVoiceAgent } from './voiceAgent.js';

const $ = (id) => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const coarse = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', coarse);
const KEY = coarse ? '點這裡' : '按 E';

async function fontsReady() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 64px Fredoka'), document.fonts.load('700 64px "Noto Sans TC"', '安小寶歲生日快樂月號')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* system fonts */ }
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 20, 42);

await fontsReady();
const world = buildWorld(scene);
const player = buildPlayer();
scene.add(player.root);
player.root.position.set(SPAWN.x, 0, SPAWN.z);
let facing = Math.PI;
player.root.rotation.y = facing;
const confetti = new Confetti(scene, PARK_RADIUS);
const fireworks = new Fireworks(scene, () => audio.boom());
const puffs = new Puffs(scene);
const lanterns = new Lanterns(scene, PARK_RADIUS - 6);
const animals = buildAnimals(scene, world.colliders);
const ANIMAL_LABEL = { cat: '貓貓', dog: '狗狗', raccoon: '浣熊' };

let state = createGameState();
let started = false, locked = false, riding = null, cine = null, orbs = null, celebrated = false, blowing = false;
let dusk = 0, duskTarget = 0, blowAcc = 0, gustAcc = 0, breathAcc = 0, promptHeld = false, noteTimer = 0, walkT = 0;

// HUD
const giftDots = $('gift-dots');
for (let i = 0; i < GIFT_COUNT; i++) giftDots.appendChild(Object.assign(document.createElement('span'), { className: 'dot' }));
for (const g of GIFTS) $('finale-gifts').appendChild(Object.assign(document.createElement('li'), { textContent: g.title }));
const status = birthdayStatus();
$('status').textContent = status.isToday ? `今天就是${BIRTHDAY.nickname}的生日！` : `距離 ${BIRTHDAY.zhDate} 還有 ${status.daysUntil} 天`;
$('controls').textContent = coarse ? '左下搖桿移動・拖曳畫面轉視角' : 'WASD / 方向鍵移動・拖曳畫面轉視角・滾輪縮放';
const setHint = (t) => { $('hint').textContent = t; };

function refreshGifts() {
  [...giftDots.children].forEach((d, i) => d.classList.toggle('on', i < state.found.length));
  $('gift-count').textContent = `${state.found.length}/${GIFT_COUNT}`;
}
refreshGifts();

function showNote(label, title, text, secs = 8) {
  $('note-label').textContent = label;
  $('note-title').textContent = title;
  $('note-text').textContent = text;
  $('note').classList.add('show');
  noteTimer = secs;
}
const hideNote = () => { $('note').classList.remove('show'); noteTimer = 0; };
$('note').addEventListener('click', hideNote);

$('start-btn').addEventListener('click', () => {
  audio.initAudio();
  $('start').classList.add('hide');
  $('hud').classList.add('show');
  started = true;
});
$('mute').addEventListener('click', () => {
  audio.setMuted(!audio.isMuted());
  $('mute').textContent = audio.isMuted() ? '音效 關' : '音效 開';
});
$('finale-close').addEventListener('click', () => {
  $('finale').classList.remove('show');
  cine = null; locked = false;
  setHint(`生日快樂，${BIRTHDAY.nickname}！`);
});
$('finale-replay').addEventListener('click', () => {
  audio.initAudio();
  audio.playBirthdaySong();
  shapeShow();
});

const prompt = $('prompt');
prompt.addEventListener('pointerdown', (e) => { e.preventDefault(); promptHeld = true; });
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => prompt.addEventListener(ev, () => { promptHeld = false; }));
const action = $('action');
action.addEventListener('click', () => handleAction());

// Input
const keys = new Set();
addEventListener('keydown', (e) => {
  if (isFromVoiceAgent(e)) return; // 在語音小工具打字時，不觸發遊戲操作
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) handleAction();
});
addEventListener('keyup', (e) => { if (!isFromVoiceAgent(e)) keys.delete(e.code); });
addEventListener('blur', () => keys.clear());

let camYaw = 0, camPitch = 0.42, camDist = 13;
let drag = null;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  camYaw -= (e.clientX - drag.x) * 0.005;
  camPitch = THREE.MathUtils.clamp(camPitch + (e.clientY - drag.y) * 0.004, 0.12, 1.15);
  drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (e) => { camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.01, 7, 26); }, { passive: true });

const joy = { x: 0, y: 0, id: null };
const joyEl = $('joy'), knob = $('joy-knob');
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const l = Math.hypot(dx, dy);
  if (l > 1) { dx /= l; dy /= l; }
  joy.x = dx; joy.y = -dy;
  knob.style.transform = `translate(calc(-50% + ${dx * 34}px), calc(-50% + ${dy * 34}px))`;
}
joyEl.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); moveJoy(e); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) moveJoy(e); });
const endJoy = (e) => {
  if (e.pointerId !== joy.id) return;
  joy.id = null; joy.x = joy.y = 0;
  knob.style.transform = 'translate(-50%, -50%)';
};
joyEl.addEventListener('pointerup', endJoy);
joyEl.addEventListener('pointercancel', endJoy);

// Rides
const RIDES = [
  { key: 'ferris', name: '摩天輪', ...ATTRACTIONS.ferris, range: 8.5, exitR: 7, camDist: 20 },
  { key: 'carousel', name: '旋轉木馬', ...ATTRACTIONS.carousel, range: 9.6, exitR: 8.4, camDist: 15 },
];
function nearRide() {
  const p = player.root.position;
  return RIDES.find((r) => Math.hypot(p.x - r.x, p.z - r.z) < r.range) ?? null;
}
const tmp = V3();
function board(ride) {
  let seat;
  if (ride.key === 'ferris') {
    seat = world.ferris.cabins.reduce((a, b) => (b.getWorldPosition(tmp).y < a.getWorldPosition(V3()).y ? b : a));
    seat.add(player.root);
    player.root.position.set(0, -2.75, 0);
    player.root.rotation.set(0, 0, 0);
  } else {
    const p = player.root.position.clone();
    seat = world.carousel.ponies.reduce((a, b) => (b.getWorldPosition(tmp).distanceTo(p) < a.getWorldPosition(V3()).distanceTo(p) ? b : a));
    seat.add(player.root);
    player.root.position.set(0, 0.32, 0.05);
    player.root.rotation.set(0, Math.PI, 0);
  }
  player.root.scale.setScalar(0.55);
  player.body.position.y = 0; player.body.rotation.z = 0;
  riding = ride;
  const r = boardRide(state, ride.key);
  state = r.state;
  if (r.note) { audio.chime(); showNote(ride.name, '下次的約定', r.note, 10); }
  setHint(`正在搭乘${ride.name}，拖曳畫面看看風景`);
}
function unboard() {
  const ride = riding;
  scene.add(player.root);
  player.root.scale.setScalar(1);
  const d = Math.hypot(ride.x, ride.z) || 1;
  const dx = -ride.x / d, dz = -ride.z / d;
  player.root.position.set(ride.x + dx * ride.exitR, 0, ride.z + dz * ride.exitR);
  facing = Math.atan2(dx, dz);
  player.root.rotation.set(0, facing, 0);
  riding = null;
  setHint(state.phase === 'explore' ? `還有 ${GIFT_COUNT - state.found.length} 份禮物藏在樂園裡` : '');
}
const nearAnimal = () => animals.nearest(player.root.position, 3.2);
function handleAction() {
  if (!started || locked) return;
  if (riding) { unboard(); return; }
  const a = nearAnimal();
  if (a) {
    const line = animals.interact(a, player.root.position);
    const p = player.root.position;
    facing = Math.atan2(a.root.position.x - p.x, a.root.position.z - p.z);
    player.root.rotation.y = facing;
    audio.animal(a.data.kind);
    showNote(`${ANIMAL_LABEL[a.data.kind]}・${a.data.name}`, line, '', 5);
    return;
  }
  const r = nearRide();
  if (r) board(r);
}
function updateActionButton() {
  if (!started || locked) { action.classList.remove('show'); return; }
  const a = riding ? null : nearAnimal();
  const r = riding ?? nearRide();
  action.classList.toggle('show', !!(a || r));
  if (a) action.textContent = `${KEY} 摸摸${a.data.name}`;
  else if (r) action.textContent = riding ? `${KEY} 下來` : `${KEY} 搭乘${r.name}`;
}

// Explore
const move = V3();
function updatePlayer(dt) {
  const k = (c) => (keys.has(c) ? 1 : 0);
  const ix = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft') + joy.x;
  const iz = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown') + joy.y;
  const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
  move.set(cy * ix - sy * iz, 0, -sy * ix - cy * iz);
  const len = move.length();
  if (len > 1) move.divideScalar(len);
  const p = player.root.position;
  const moving = len > 0.05;
  if (moving) {
    p.addScaledVector(move, 9 * dt);
    const target = Math.atan2(move.x, move.z);
    let diff = target - facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    facing += diff * Math.min(1, dt * 12);
    player.root.rotation.y = facing;
    walkT += dt;
  }
  for (const c of world.colliders) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.6;
    if (d < min && d > 0.0001) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
  }
  const r = Math.hypot(p.x, p.z);
  if (r > PARK_RADIUS) { p.x *= PARK_RADIUS / r; p.z *= PARK_RADIUS / r; }
  const bounce = moving ? Math.abs(Math.sin(walkT * 11)) : 0;
  player.body.position.y = THREE.MathUtils.lerp(player.body.position.y, bounce * 0.2, Math.min(1, dt * 15));
  player.body.rotation.z = moving ? Math.sin(walkT * 11) * 0.07 : player.body.rotation.z * 0.9;

  for (const g of world.gifts) {
    if (g.collected || Math.hypot(p.x - g.x, p.z - g.z) > 2.5) continue;
    const res = collectGift(state, g.id);
    if (!res.isNew) continue;
    state = res.state;
    g.collected = true;
    audio.chime();
    fireworks.burst({ x: g.x, y: 2.5, z: g.z }, { count: 70, speed: 6, size: 0.4, life: 1.3 });
    showNote(`禮物 ${state.found.length} / ${GIFT_COUNT}`, res.gift.title, res.gift.text, 9);
    refreshGifts();
    if (state.phase === 'cake') {
      locked = true;
      setHint('8 份禮物都到齊了！');
      setTimeout(startCeremony, 3200);
    } else {
      setHint(`還有 ${GIFT_COUNT - state.found.length} 份禮物藏在樂園裡`);
    }
  }
}

function updateGifts(dt) {
  for (const g of world.gifts) {
    if (!g.collected || g.collectT >= 1) continue;
    g.collectT = Math.min(1, g.collectT + dt * 1.6);
    const k = g.collectT;
    g.box.scale.setScalar((1 + k * 0.8) * (1 - k * k));
    g.box.position.y += dt * 3;
    g.box.rotation.y += dt * 10;
    g.beam.material.opacity = 0.2 * (1 - k);
    g.halo.material.opacity = 0.6 * (1 - k);
    if (k >= 1) g.group.visible = false;
  }
}

// Ceremony: gifts fly to the cake, candles light up, make a wish
async function startCeremony() {
  hideNote();
  cine = { pos: V3(0, 12, 25), look: V3(0, 6, 0) };
  setHint('禮物們正飛向蛋糕…');
  await wait(1400);
  audio.swell();
  orbs = world.gifts.map((g, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: g.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(2.4);
    s.position.set(g.x, 2, g.z);
    scene.add(s);
    return { s, from: V3(g.x, 2, g.z), t: -i * 0.12, ang: (i / GIFT_COUNT) * Math.PI * 2, rad: 3.6, color: g.color };
  });
  await wait(4800);
  const top = world.cake.topY;
  fireworks.burst({ x: 0, y: top + 3, z: 0 }, { count: 240, speed: 9, size: 0.6, life: 2, palette: orbs.map((o) => o.color) });
  audio.boom();
  orbs.forEach((o) => { scene.remove(o.s); o.s.material.dispose(); });
  orbs = null;
  setHint('蠟燭一根一根亮起來了');
  await wait(500);
  for (let i = 0; i < BIRTHDAY.age; i++) { world.cake.setLit(i + 1); audio.sparkle(i); await wait(120); }
  await wait(800);
  $('wishmoment').classList.add('show');
  await wait(4500);
  $('wishmoment').classList.remove('show');
  player.root.position.set(0, 0, 9.4);
  facing = Math.PI; player.root.rotation.y = facing;
  camYaw = 0; camPitch = 0.32; camDist = 11;
  cine = null; locked = false;
  setHint('深呼吸，按住空白鍵把 21 根蠟燭吹熄');
}

function updateOrbs(dt, t) {
  if (!orbs) return;
  const top = world.cake.topY;
  const end = V3(), ctrl = V3();
  for (const o of orbs) {
    o.t += dt / 2;
    const a = o.ang + t * 1.8;
    end.set(Math.cos(a) * o.rad, top + 3 + Math.sin(t * 3 + o.ang) * 0.3, Math.sin(a) * o.rad);
    if (o.t <= 0) continue;
    if (o.t < 1) {
      const k = o.t * o.t * (3 - 2 * o.t), m = 1 - k;
      ctrl.set(o.from.x * 0.5, 18, o.from.z * 0.5);
      o.s.position.set(
        m * m * o.from.x + 2 * m * k * ctrl.x + k * k * end.x,
        m * m * o.from.y + 2 * m * k * ctrl.y + k * k * end.y,
        m * m * o.from.z + 2 * m * k * ctrl.z + k * k * end.z,
      );
    } else {
      o.rad = Math.max(0.8, o.rad - dt * 0.8);
      o.s.position.copy(end);
    }
  }
}

// Blowing candles
const mouthLocal = V3(0, 1.65, 0.7);
function updateCake(dt) {
  blowing = false;
  if (!started || locked || riding || celebrated) { prompt.classList.remove('show'); return; }
  const p = player.root.position;
  if (Math.hypot(p.x, p.z) > 11.5) { prompt.classList.remove('show'); return; }
  prompt.classList.add('show');
  if (!canBlowCandles(state)) {
    prompt.disabled = true;
    prompt.textContent = `先找到全部 ${GIFT_COUNT} 份禮物，蠟燭才會亮起來（${state.found.length}/${GIFT_COUNT}）`;
    return;
  }
  prompt.disabled = false;
  prompt.textContent = `${coarse ? '按住這裡' : '按住 空白鍵'} 吹蠟燭・還有 ${state.candlesLit} 根`;
  if (!(keys.has('Space') || promptHeld)) { blowAcc = Math.min(blowAcc, 0.05); return; }
  blowing = true;
  const mouth = player.root.localToWorld(mouthLocal.clone());
  const target = world.cake.flames[state.candlesLit - 1].getWorldPosition(V3());
  const dir = target.clone().sub(mouth).normalize();
  gustAcc += dt;
  while (gustAcc > 0.03) {
    gustAcc -= 0.03;
    puffs.spawn({ pos: mouth, vel: { x: dir.x * 9 + (Math.random() - 0.5) * 1.5, y: dir.y * 9 + (Math.random() - 0.5) * 1.2, z: dir.z * 9 + (Math.random() - 0.5) * 1.5 }, size: 0.22, grow: 0.9, life: 0.6, opacity: 0.55 });
  }
  breathAcc += dt;
  if (breathAcc > 0.16) { breathAcc = 0; audio.breath(); }
  blowAcc += dt;
  while (blowAcc > 0.14 && state.candlesLit > 0) {
    blowAcc -= 0.14;
    const fp = world.cake.flames[state.candlesLit - 1].getWorldPosition(V3());
    state = blowCandle(state);
    world.cake.setLit(state.candlesLit);
    for (let k = 0; k < 5; k++) {
      puffs.spawn({ pos: { x: fp.x, y: fp.y + k * 0.12, z: fp.z }, vel: { x: (Math.random() - 0.5) * 0.4, y: 0.9 + Math.random() * 0.7, z: (Math.random() - 0.5) * 0.4 }, color: '#d8cfe0', size: 0.2, grow: 1, life: 2.6, opacity: 0.5 });
    }
    if (state.candlesLit % 4 === 0) audio.puff();
  }
  if (state.phase === 'celebrate') celebrate();
}

function updatePose(dt) {
  const k = Math.min(1, dt * 10);
  player.body.rotation.x += ((blowing ? 0.28 : 0) - player.body.rotation.x) * k;
  const cs = blowing ? 1.9 + Math.sin(performance.now() * 0.03) * 0.1 : 1;
  for (const c of player.cheeks) { const s = c.userData.base ??= c.scale.clone(); c.scale.lerp(V3(s.x * cs, s.y * cs, s.z * cs), k); }
}

// Finale
async function shapeShow() {
  const z = -8;
  fireworks.burst({ x: 0, y: 26, z }, { targets: heartPoints(0.42), palette: ['#ff8fb1', '#ff4d6d', '#ffffff'], size: 0.75 });
  audio.boom();
  await wait(1700);
  fireworks.burst({ x: 0, y: 25, z }, { targets: textPoints('21', { width: 16 }), palette: ['#ffd65c', '#fff3c4'], size: 0.7 });
  audio.boom();
  await wait(1700);
  fireworks.burst({ x: 0, y: 25, z }, { targets: textPoints(BIRTHDAY.name, { width: 20 }), palette: ['#c4aef2', '#9fd6ff', '#ffffff'], size: 0.7 });
  audio.boom();
  await wait(1700);
  fireworks.burst({ x: 0, y: 25, z }, { targets: textPoints('10/8', { width: 20 }), palette: ['#97e0c0', '#ffd65c'], size: 0.7 });
  fireworks.burst({ x: -18, y: 22, z }, { targets: heartPoints(0.25), palette: ['#ff8fb1'], size: 0.6 });
  fireworks.burst({ x: 18, y: 22, z }, { targets: heartPoints(0.25), palette: ['#ff8fb1'], size: 0.6 });
  audio.boom();
}

async function celebrate() {
  celebrated = true; locked = true;
  prompt.classList.remove('show');
  promptHeld = false;
  setHint('');
  await wait(1400);
  duskTarget = 1;
  cine = { pos: V3(0, 11, 36), look: V3(0, 15, 0) };
  world.cake.celebrateText.visible = true;
  confetti.boost = 1;
  audio.playBirthdaySong();
  await wait(1800);
  shapeShow();
  await wait(2000);
  lanterns.release();
  await wait(5600);
  fireworks.auto = true;
  await wait(1500);
  $('finale').classList.add('show');
}

// Loop
const clock = new THREE.Clock();
const look = V3(0, 5, 0);
const desired = V3();
const focus = V3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (started && !locked && !riding) updatePlayer(dt);
  world.update(t, dt);
  confetti.update(dt, t);
  fireworks.update(dt);
  puffs.update(dt);
  lanterns.update(dt);
  animals.update(dt, t, riding ? null : player.root.position);
  updateOrbs(dt, t);
  updateGifts(dt);
  updateCake(dt);
  updatePose(dt);
  updateActionButton();
  dusk += (duskTarget - dusk) * Math.min(1, dt * 0.7);
  world.setDusk(dusk);
  if (noteTimer > 0) { noteTimer -= dt; if (noteTimer <= 0) hideNote(); }

  if (!started) {
    const a = t * 0.07;
    desired.set(Math.sin(a) * 44, 19, Math.cos(a) * 44);
    camera.position.lerp(desired, 1 - Math.exp(-dt * 2));
    look.set(0, 5, 0);
  } else if (cine) {
    camera.position.lerp(cine.pos, 1 - Math.exp(-dt * 1.6));
    look.lerp(cine.look, 1 - Math.exp(-dt * 2));
  } else {
    player.root.getWorldPosition(focus);
    const dist = riding ? Math.max(camDist, riding.camDist) : camDist;
    const cp = Math.cos(camPitch);
    desired.set(focus.x + Math.sin(camYaw) * cp * dist, Math.max(1.5, focus.y + Math.sin(camPitch) * dist + 1.6), focus.z + Math.cos(camYaw) * cp * dist);
    camera.position.lerp(desired, 1 - Math.exp(-dt * 5));
    look.lerp(desired.set(focus.x, focus.y + 1.8 * player.root.scale.x, focus.z), 1 - Math.exp(-dt * 8));
  }
  camera.lookAt(look);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

document.body.classList.add('ready');

mountVoiceAgent();
