import * as THREE from 'three';
import { buildPlayer } from '../world/world.js';
import { Fireworks, textPoints, heartPoints } from '../world/effects.js';
import * as audio from '../audio.js';
import { mulberry32 } from '../game/random.js';
import { SPAWN, SPOTS, FINALE, districtAt, cornerLabel, clampToCity, pushRect, pushCircle } from '../game/cityLayout.js';
import { buildCity, TIMES } from './cityWorld.js';
import { Traffic } from './traffic.js';
import { Minimap } from './minimap.js';
import { mountVoiceAgent, isFromVoiceAgent } from '../voiceAgent.js';

const UNLOCK_KEY = 'annland.cityUnlocked', STAMP_KEY = 'annland.city.stamps', TIME_KEY = 'annland.city.time';
if (localStorage.getItem(UNLOCK_KEY) !== '1') { location.replace('./index.html'); throw new Error('city locked'); }

const $ = (id) => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const coarse = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', coarse);
const KEY = coarse ? '點這裡' : '按 E';

async function fontsReady() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 64px Fredoka'), document.fonts.load('700 64px "Noto Sans TC"', '安小寶生日快樂')]),
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
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1600);
camera.position.set(60, 90, 160);

await fontsReady();
const city = buildCity(scene);
const traffic = new Traffic(scene, mulberry32(504));
const fireworks = new Fireworks(scene, () => audio.boom());
const player = buildPlayer();
scene.add(player.root);
player.root.position.set(SPAWN.x, 0, SPAWN.z);
let facing = Math.PI;
player.root.rotation.y = facing;
const minimap = new Minimap($('mini'));

let stamps = [];
try { stamps = JSON.parse(localStorage.getItem(STAMP_KEY) ?? '[]').filter((id) => SPOTS.some((s) => s.id === id)); } catch { stamps = []; }
const saveStamps = () => localStorage.setItem(STAMP_KEY, JSON.stringify(stamps));
let timeIdx = Number(localStorage.getItem(TIME_KEY) ?? 1);
if (!(timeIdx >= 0 && timeIdx < TIMES.length)) timeIdx = 1;
function applyTime() {
  city.setTime(timeIdx);
  traffic.setNight(TIMES[timeIdx].night);
  $('time').textContent = TIMES[timeIdx].label;
}
applyTime();

let started = false, locked = false, riding = null, cine = null, noteTimer = 0, walkT = 0, placeT = 0, lastDistrict = '';

const dots = $('stamp-dots');
for (const s of SPOTS) dots.appendChild(Object.assign(document.createElement('span'), { className: 'dot', title: s.name }));
function refreshStamps() {
  SPOTS.forEach((s, i) => { dots.children[i].classList.toggle('on', stamps.includes(s.id)); city.setVisited(s.id, stamps.includes(s.id)); });
  $('stamp-count').textContent = `${stamps.length}/${SPOTS.length}`;
}
refreshStamps();
$('controls').textContent = coarse ? '左下搖桿移動（推到底就是跑步）・拖曳畫面轉視角' : 'WASD / 方向鍵移動・Shift 跑步・E 互動・拖曳畫面轉視角・滾輪縮放';
const setHint = (t) => { $('hint').textContent = t; };

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
  setHint(stamps.length < SPOTS.length ? '跟著小地圖上的粉紅點，去蒐集城市印章' : '城市印章都蒐集完了，隨意逛逛吧');
});
$('mute').addEventListener('click', () => {
  audio.setMuted(!audio.isMuted());
  $('mute').textContent = audio.isMuted() ? '音效 關' : '音效 開';
});
$('time').addEventListener('click', () => {
  timeIdx = (timeIdx + 1) % TIMES.length;
  localStorage.setItem(TIME_KEY, String(timeIdx));
  applyTime();
});
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

let camYaw = 0, camPitch = 0.38, camDist = 14;
let drag = null;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  camYaw -= (e.clientX - drag.x) * 0.005;
  camPitch = THREE.MathUtils.clamp(camPitch + (e.clientY - drag.y) * 0.004, 0.08, 1.3);
  drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (e) => { camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.012, 7, 40); }, { passive: true });

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

// Interactions
const nearSpot = () => {
  const p = player.root.position;
  return SPOTS.find((s) => Math.hypot(p.x - s.x, p.z - s.z) < 4.2) ?? null;
};
function boardStreetcar(sc) {
  sc.group.add(player.root);
  player.root.position.set(0.4, 0.5, -1.5);
  player.root.rotation.set(0, 0, 0);
  player.root.scale.setScalar(0.75);
  player.body.position.y = 0; player.body.rotation.z = 0;
  riding = sc;
  audio.bell();
  setHint('正在搭乘 504 King 路面電車，拖曳畫面看看街景');
}
function leaveStreetcar() {
  const sc = riding;
  scene.add(player.root);
  player.root.scale.setScalar(1);
  player.root.position.set(sc.s, 0, sc.lane + sc.dir * 6);
  facing = sc.dir > 0 ? 0 : Math.PI;
  player.root.rotation.set(0, facing, 0);
  riding = null;
  setHint('');
}
function handleAction() {
  if (!started || locked) return;
  if (riding) { leaveStreetcar(); return; }
  const s = nearSpot();
  if (s) { visitSpot(s); return; }
  const sc = traffic.nearestStreetcar(player.root.position);
  if (sc) boardStreetcar(sc);
}
function updateActionButton() {
  if (!started || locked) { action.classList.remove('show'); return; }
  const s = riding ? null : nearSpot();
  const sc = riding ?? traffic.nearestStreetcar(player.root.position);
  action.classList.toggle('show', !!(s || sc));
  if (s) action.textContent = `${KEY} ${s.verb}`;
  else if (sc) action.textContent = riding ? `${KEY} 下車` : `${KEY} 搭路面電車`;
}

const mirror = (pts) => pts.map((p) => ({ ...p, x: -p.x }));
async function visitSpot(s) {
  const isNew = !stamps.includes(s.id);
  if (isNew) { stamps.push(s.id); saveStamps(); refreshStamps(); }
  audio.chime();
  hideNote();
  if (s.id === 'sign') {
    fireworks.burst({ x: -72, y: 24, z: -66 }, { targets: textPoints('ANN', { width: 22 }), palette: ['#ff8fb1', '#ffd65c', '#ffffff'], size: 1 });
    audio.boom();
    setTimeout(() => { fireworks.burst({ x: -72, y: 22, z: -66 }, { targets: textPoints('21', { width: 15 }), palette: ['#c4aef2', '#9fd6ff', '#ffffff'], size: 1 }); audio.boom(); }, 1900);
  } else if (s.id === 'pier') {
    fireworks.burst({ x: 0, y: 34, z: 225 }, { targets: heartPoints(0.9), palette: ['#ff8fb1', '#ff4d6d', '#ffffff'], size: 2.2 });
    audio.boom();
  } else if (s.id === 'square') {
    city.setBillboard(12);
    camYaw = 0; camPitch = 0.2;
  } else if (s.id === 'tower') {
    await towerRide();
  }
  const label = isNew ? `${s.name}・城市印章 ${stamps.length}/${SPOTS.length}` : s.name;
  showNote(label, s.title, s.text, 9);
  if (isNew && stamps.length === SPOTS.length) setTimeout(cityFinale, 6000);
}

async function towerRide() {
  locked = true;
  player.root.visible = false;
  setHint('電梯往上…');
  cine = { kind: 'tower', t: 0 };
  await wait(12000);
  cine = null;
  player.root.visible = true;
  player.root.position.set(-72, 0, 59.5);
  locked = false;
  setHint('');
}

async function cityFinale() {
  if (riding) leaveStreetcar();
  locked = true;
  hideNote();
  setHint('看看湖面上…');
  cine = { kind: 'static', pos: V3(0, 22, 150), look: V3(0, 52, 240) };
  await wait(2500);
  audio.playBirthdaySong();
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      fireworks.burst({ x: (Math.random() - 0.5) * 140, y: 45 + Math.random() * 35, z: 235 + Math.random() * 40 }, { count: 220, speed: 26, size: 2.4, life: 2.6 });
      audio.boom();
    }, i * 650);
  }
  setTimeout(() => {
    fireworks.burst({ x: 0, y: 62, z: 245 }, { targets: mirror(textPoints('ANN 21', { width: 70 })), palette: ['#ffd65c', '#ff8fb1', '#ffffff'], size: 2.6 });
    audio.boom();
  }, 9800);
  await wait(15500);
  cine = null; locked = false;
  setHint('');
  showNote(FINALE.label, FINALE.title, FINALE.text, 14);
}

// Movement
const move = V3(), prev = { x: 0, z: 0 };
function updatePlayer(dt) {
  const k = (c) => (keys.has(c) ? 1 : 0);
  const ix = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft') + joy.x;
  const iz = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown') + joy.y;
  const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
  move.set(cy * ix - sy * iz, 0, -sy * ix - cy * iz);
  const len = move.length();
  if (len > 1) move.divideScalar(len);
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joy.x, joy.y) > 0.93;
  const p = player.root.position;
  prev.x = p.x; prev.z = p.z;
  const moving = len > 0.05;
  if (moving) {
    p.addScaledVector(move, (sprint ? 17 : 9.5) * dt);
    let diff = Math.atan2(move.x, move.z) - facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    facing += diff * Math.min(1, dt * 12);
    player.root.rotation.y = facing;
    walkT += dt * (sprint ? 1.5 : 1);
  }
  for (const r of city.colliders) pushRect(p, r);
  for (const c of city.circles) pushCircle(p, c);
  clampToCity(p, prev);
  const bounce = moving ? Math.abs(Math.sin(walkT * 11)) : 0;
  player.body.position.y = THREE.MathUtils.lerp(player.body.position.y, bounce * 0.2, Math.min(1, dt * 15));
  player.body.rotation.z = moving ? Math.sin(walkT * 11) * 0.07 : player.body.rotation.z * 0.9;
}

function updatePlace(dt) {
  placeT -= dt;
  if (placeT > 0) return;
  placeT = 0.3;
  const p = player.root.getWorldPosition(V3());
  const d = districtAt(p.x, p.z);
  $('place-street').textContent = cornerLabel(p.x, p.z);
  if (d.en !== lastDistrict) {
    lastDistrict = d.en;
    $('place-district').textContent = `${d.en}・${d.zh}`;
    const pop = $('district-pop');
    pop.querySelector('strong').textContent = d.en;
    pop.querySelector('span').textContent = d.zh;
    pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
  }
}

// Loop
const clock = new THREE.Clock();
const look = V3(0, 30, 0), desired = V3(), focus = V3(), dir = V3();
const ray = new THREE.Raycaster();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (started && !locked && !riding) updatePlayer(dt);
  const ev = traffic.update(dt, t, started && !riding && player.root.visible ? player.root.position : null, riding);
  if (ev.honk) audio.honk();
  if (ev.bell && riding) audio.bell();
  player.root.getWorldPosition(focus);
  city.update(t, dt, focus, camera);
  fireworks.update(dt);
  updateActionButton();
  if (started) updatePlace(dt);
  if (noteTimer > 0) { noteTimer -= dt; if (noteTimer <= 0) hideNote(); }

  if (!started) {
    const a = t * 0.05 + 0.6;
    desired.set(-30 + Math.sin(a) * 190, 95, 10 + Math.cos(a) * 190);
    camera.position.lerp(desired, 1 - Math.exp(-dt * 1.5));
    look.lerp(desired.set(-30, 25, 0), 1 - Math.exp(-dt * 2));
  } else if (cine?.kind === 'tower') {
    cine.t += dt;
    const k = Math.min(1, cine.t / 3.5), e = k * k * (3 - 2 * k);
    const a = -Math.PI / 2 + cine.t * 0.42;
    const top = city.towerTop;
    camera.position.set(top.x + Math.cos(a) * 11, THREE.MathUtils.lerp(8, top.y, e), top.z + Math.sin(a) * 11);
    look.set(camera.position.x + Math.cos(a) * 60, camera.position.y - 12 - 10 * e, camera.position.z + Math.sin(a) * 60);
    if (cine.t > 3.5) setHint('');
  } else if (cine) {
    camera.position.lerp(cine.pos, 1 - Math.exp(-dt * 1.4));
    look.lerp(cine.look, 1 - Math.exp(-dt * 2));
  } else {
    let dist = riding ? Math.max(camDist, 18) : camDist;
    const cp = Math.cos(camPitch);
    const head = V3(focus.x, focus.y + 1.8 * player.root.scale.x, focus.z);
    dir.set(Math.sin(camYaw) * cp, Math.sin(camPitch), Math.cos(camYaw) * cp).normalize();
    ray.set(head, dir); ray.far = dist;
    const hit = ray.intersectObjects(city.occluders, false)[0];
    if (hit) dist = Math.max(2.5, hit.distance - 0.8);
    desired.copy(head).addScaledVector(dir, dist);
    desired.y = Math.max(1.2, desired.y);
    camera.position.lerp(desired, 1 - Math.exp(-dt * (hit ? 14 : 5)));
    look.lerp(head, 1 - Math.exp(-dt * 8));
  }
  camera.lookAt(look);
  if (started) minimap.draw(focus.x, focus.z, camYaw, riding ? (riding.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : facing, SPOTS, stamps, traffic.streetcars);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  minimap.resize();
});
document.body.classList.add('ready');

mountVoiceAgent();
