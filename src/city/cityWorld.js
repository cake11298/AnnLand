import * as THREE from 'three';
import { mulberry32 } from '../game/random.js';
import { canvasTexture, textTexture, stripeTexture, glowTexture, FONT_EN, FONT_TC } from '../world/textures.js';
import * as L from '../game/cityLayout.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const FLAT = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

export const TIMES = [
  { label: '白天', top: '#4f9fe0', bottom: '#d4ebf7', fog: '#cfe3ee', sun: '#fff6e8', sunI: 2.4, hemi: 1.15, night: 0 },
  { label: '黃昏', top: '#3a3f86', bottom: '#f6a98c', fog: '#e9a594', sun: '#ffb27a', sunI: 1.7, hemi: 0.8, night: 0.5 },
  { label: '夜晚', top: '#070b26', bottom: '#28305e', fog: '#1f2549', sun: '#9aa8ff', sunI: 0.35, hemi: 0.4, night: 1 },
];

// 依世界座標畫窗戶，一個材質就能套在所有大樓上
function windowMaterial(night) {
  const m = M('#ffffff', { roughness: 0.75, metalness: 0.05 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uNight = night;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        mat4 wm = modelMatrix;
        #ifdef USE_INSTANCING
          wm = modelMatrix * instanceMatrix;
        #endif
        vWPos = (wm * vec4(transformed, 1.0)).xyz;
        vWNorm = normalize(mat3(wm) * objectNormal);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNorm; uniform float uNight;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float winMask = 0.0, winLit = 0.0;
        if (abs(vWNorm.y) < 0.5) {
          vec2 tg = normalize(vec2(-vWNorm.z, vWNorm.x));
          float u = dot(vWPos.xz, tg), v = vWPos.y;
          if (v > 4.5) {
            vec2 cell = vec2(u / 3.0, (v - 4.5) / 3.4);
            vec2 f = fract(cell);
            winMask = step(0.18, f.x) * step(f.x, 0.82) * step(0.22, f.y) * step(f.y, 0.86);
            winLit = step(0.58, h21(floor(cell) + vec2(vWNorm.x * 17.0 + floor(dot(vWPos.xz, vWNorm.xz)) * 0.37, vWNorm.z * 31.0)));
          } else if (v > 0.6 && v < 3.6) {
            float f = fract(u / 5.0);
            winMask = step(0.08, f) * step(f, 0.92) * 0.9;
            winLit = 1.0;
          }
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.40, 0.53), winMask * 0.8);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.8, 0.5) * winMask * winLit * uNight * 1.1;`);
  };
  return m;
}

function instanced(scene, geo, mat, items, set, { shadow = false, receive = false } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  const d = new THREE.Object3D();
  items.forEach((it, i) => {
    d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
    set(d, it, i);
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
  });
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = shadow; m.receiveShadow = receive;
  scene.add(m);
  return m;
}

const rectSet = (y) => (d, r) => { d.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2); d.scale.set(r.x1 - r.x0, 1, r.z1 - r.z0); };
function flat(scene, rect, color, y = 0.05, mat) {
  const m = new THREE.Mesh(FLAT, mat ?? M(color));
  rectSet(y)(m, rect);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}
function mesh(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function buildCity(scene) {
  const rng = mulberry32(20261008);
  const night = { value: 0.5 };
  const colliders = [...L.SPECIAL_RECTS];
  const circles = [];
  const occluders = [];
  const anim = [];
  const nightMats = [];

  // Sky + light
  const skyU = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(760, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main() { float h = clamp(normalize(vP).y * 1.8 + 0.06, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0);\n#include <colorspace_fragment>\n}',
  }));
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.Fog('#e9a594', 110, 520);
  const hemi = new THREE.HemisphereLight('#ffffff', '#7a6f80', 1);
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 1, far: 420 });
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun, sun.target);
  const SUN_DIR = new THREE.Vector3(-0.55, 1, 0.5).normalize();

  // Ground, water, harbour
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 900), M('#56555d', { roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, L.WATER_Z - 450); ground.receiveShadow = true;
  scene.add(ground);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 900), M('#3a7fb0', { roughness: 0.2, metalness: 0.25 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.6, L.WATER_Z + 450);
  scene.add(water);
  mesh(scene, new THREE.BoxGeometry(460, 1.2, 1), M('#9b9488'), 0, -0.55, L.WATER_Z + 0.5);
  flat(scene, { x0: -230, x1: 230, z0: 103, z1: L.WATER_Z }, '#c9b38f', 0.03);
  flat(scene, { x0: -230, x1: 230, z0: 103, z1: 110 }, '#8cc47c', 0.05);
  const wood = M('#a9825c');
  mesh(scene, new THREE.BoxGeometry(L.PIER.x1 - L.PIER.x0, 0.6, L.PIER.z1 - 118), wood, 0, -0.25, (118 + L.PIER.z1) / 2);
  for (let z = 128; z <= 176; z += 8) for (const x of [-4.6, 4.6]) mesh(scene, new THREE.CylinderGeometry(0.3, 0.3, 3, 8), wood, x, -1.2, z);
  const island = mesh(scene, new THREE.BoxGeometry(900, 1.6, 46), M('#7fb46e'), 0, -0.3, 340);
  island.castShadow = false;
  const islandTrees = Array.from({ length: 60 }, () => ({ x: (rng() - 0.5) * 760, z: 325 + rng() * 30, s: 3 + rng() * 3 }));
  instanced(scene, new THREE.ConeGeometry(1, 2.4, 7).translate(0, 1.2, 0), M('#4e8a54'), islandTrees, (d, t) => { d.position.set(t.x, 0.5, t.z); d.scale.setScalar(t.s); });

  const ferry = new THREE.Group();
  mesh(ferry, new THREE.BoxGeometry(6, 2, 18), M('#f4f1ea'), 0, 0.2, 0);
  mesh(ferry, new THREE.BoxGeometry(5, 2.4, 9), M('#2f4a6b'), 0, 2.4, -1);
  mesh(ferry, new THREE.BoxGeometry(6.1, 0.4, 18.1), M('#d6262f'), 0, -0.4, 0);
  ferry.position.set(14, -0.6, 150);
  scene.add(ferry);
  anim.push((t) => { ferry.position.y = -0.6 + Math.sin(t * 0.9) * 0.15; ferry.rotation.z = Math.sin(t * 0.7) * 0.02; });
  const sail = M('#ffffff', { side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    mesh(b, new THREE.BoxGeometry(1.6, 0.8, 5), M('#f4f1ea'), 0, 0, 0);
    const s = mesh(b, new THREE.ConeGeometry(2, 7, 3), sail, 0, 4, 0.3);
    s.scale.z = 0.12;
    const x0 = -150 + i * 70, z0 = 200 + (i % 3) * 30, sp = 0.03 + i * 0.008;
    scene.add(b);
    anim.push((t) => { b.position.set(x0 + Math.sin(t * sp) * 40, -0.4 + Math.sin(t + i) * 0.1, z0); b.rotation.y = Math.cos(t * sp) > 0 ? Math.PI / 2 : -Math.PI / 2; });
  }

  // Sidewalks, road markings
  const allBlocks = L.blocks();
  instanced(scene, FLAT, M('#bdb7ae'), allBlocks, (d, b) => { d.position.set(b.cx, 0.04, b.cz); d.scale.set(L.BLOCK_HALF * 2, 1, L.BLOCK_HALF * 2); }, { receive: true });
  const lines = [
    ...L.X_STREETS.map((s) => ({ x0: s.x - 0.18, x1: s.x + 0.18, z0: -232, z1: 89 })),
    ...L.Z_STREETS.filter((s) => s.z !== L.KING_Z).map((s) => ({ x0: -232, x1: 232, z0: s.z - 0.18, z1: s.z + 0.18 })),
  ];
  instanced(scene, FLAT, M('#e9c44a'), lines, rectSet(0.03));
  const tracks = [-4.25, -2.75, 2.75, 4.25].map((z) => ({ x0: -232, x1: 232, z0: z - 0.12, z1: z + 0.12 }));
  instanced(scene, FLAT, M('#8d8d94', { metalness: 0.6, roughness: 0.4 }), tracks, rectSet(0.035));
  const stripes = [];
  for (const xs of L.X_STREETS) for (const zs of L.Z_STREETS) {
    for (let k = -5; k <= 5; k += 2.5) {
      for (const sz of [-9.2, 9.2]) stripes.push({ x0: xs.x + k - 0.6, x1: xs.x + k + 0.6, z0: zs.z + sz - 1.5, z1: zs.z + sz + 1.5 });
      for (const sx of [-9.2, 9.2]) stripes.push({ x0: xs.x + sx - 1.5, x1: xs.x + sx + 1.5, z0: zs.z + k - 0.6, z1: zs.z + k + 0.6 });
    }
  }
  instanced(scene, FLAT, M('#ecebe6'), stripes, rectSet(0.036));

  // Buildings (one instanced mesh)
  const R = L.RECTS;
  const extra = [
    { ...R.screenA, h: 46, color: '#3b3f4c', nocol: true }, { ...R.screenB, h: 30, color: '#4a4e5c', nocol: true },
    { ...R.legislature, h: 13, color: '#c48a7a', nocol: true }, { x0: -75, x1: -69, z0: -180, z1: -174, y0: 13, h: 12, color: '#c48a7a', roof: true },
  ];
  const buildings = [...L.generateBuildings(rng), ...L.decorBuildings(rng), ...extra];
  const bMesh = instanced(scene, BOX, windowMaterial(night), buildings, (d, b) => {
    d.position.set((b.x0 + b.x1) / 2, b.y0 ?? 0, (b.z0 + b.z1) / 2);
    d.scale.set(b.x1 - b.x0, b.h, b.z1 - b.z0);
  }, { shadow: true, receive: true });
  const col = new THREE.Color();
  buildings.forEach((b, i) => bMesh.setColorAt(i, col.set(b.color)));
  bMesh.instanceColor.needsUpdate = true;
  occluders.push(bMesh);
  for (const b of buildings) if (!b.decor && !b.roof && !b.nocol) colliders.push(b);

  // Shop fronts: awnings + signs
  for (const b of buildings.filter((x) => x.shop)) {
    const south = b.shop.startsWith('kensington');
    const fz = south ? b.z1 : b.z0, out = south ? 1 : -1, w = b.x1 - b.x0, cx = (b.x0 + b.x1) / 2;
    const awn = mesh(scene, new THREE.BoxGeometry(w - 0.6, 0.18, 1.8), new THREE.MeshStandardMaterial({ map: stripeTexture(south ? ['#ffffff', '#e8507e'] : ['#f4e6c8', '#2f4a6b'], 10), roughness: 0.7 }), cx, 3.7, fz + out * 0.9);
    awn.rotation.x = out * 0.28;
    const label = L.SHOP_SIGNS[b.shop];
    const special = label.includes('1008') || label.includes('21');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - 1, 1.3), new THREE.MeshStandardMaterial({
      map: textTexture({ w: 512, h: 128, bg: special ? '#ffd65c' : '#fff8f1', radius: 24, lines: [{ text: label, size: 62, y: 0.55, color: '#4a2a45' }] }),
      roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0,
    }));
    sign.material.emissiveMap = sign.material.map;
    nightMats.push([sign.material, 0.6]);
    sign.position.set(cx, 5.1, fz + out * 0.06);
    if (!south) sign.rotation.y = Math.PI;
    scene.add(sign);
  }

  // Special lots
  const stone = M('#d8d3cb'), concrete = M('#d8d2c8');
  for (const b of allBlocks) {
    const lot = L.lotOf(b.cx, b.cz);
    if (b.special === 'park') {
      flat(scene, lot, '#86c27a', 0.06);
      flat(scene, { x0: b.cx - 1.5, x1: b.cx + 1.5, z0: lot.z0, z1: lot.z1 }, '#e8dcc4', 0.07);
    } else if (['cityhall', 'square', 'tower', 'union'].includes(b.special)) {
      flat(scene, lot, b.special === 'square' ? '#6b6772' : '#d9d4cc', 0.06);
    }
  }
  // City Hall: two curved towers + saucer
  const halfDisc = (r, h) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r, Math.PI, Math.PI * 2, false);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2);
  };
  const chMat = windowMaterial(night);
  const tw = mesh(scene, halfDisc(9, 58), chMat, -77, 0, -76); tw.rotation.y = -Math.PI / 2; tw.scale.z = 0.55;
  const te = mesh(scene, halfDisc(8, 44), chMat, -67, 0, -76); te.rotation.y = Math.PI / 2; te.scale.z = 0.55;
  mesh(scene, new THREE.BoxGeometry(10, 6, 8).translate(0, 3, 0), stone, -72, 0, -76);
  const dome = mesh(scene, new THREE.SphereGeometry(5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M('#ecebe6'), -72, 6, -76);
  dome.scale.y = 0.45;
  occluders.push(tw, te);

  // ANN 21 sign
  const LETTERS = ['A', 'N', 'N', '', '2', '1'];
  const LCOL = ['#e8507e', '#ffd65c', '#97e0c0', null, '#c4aef2', '#9fd6ff'];
  const signMats = [];
  LETTERS.forEach((ch, i) => {
    if (!ch) return;
    const tex = canvasTexture(256, 320, (g, w, h) => {
      g.fillStyle = LCOL[i]; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff'; g.font = `700 280px ${FONT_EN}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ch, w / 2, h / 2 + 14);
    });
    const face = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.5 });
    const side = M(LCOL[i], { roughness: 0.5 });
    nightMats.push([face, 0.75]);
    signMats.push(face);
    mesh(scene, new THREE.BoxGeometry(3.2, 4.2, 1.2), [side, side, side, side, face, face], -72 + (i - 2.5) * 3.8, 2.1, -63);
  });

  // Yonge-Dundas screens
  const bbCanvas = document.createElement('canvas');
  bbCanvas.width = 1024; bbCanvas.height = 512;
  const bbTex = new THREE.CanvasTexture(bbCanvas);
  bbTex.colorSpace = THREE.SRGBColorSpace;
  const MSGS = [['HAPPY 21st', 'BIRTHDAY ANN', FONT_EN], ['10.08', '2026', FONT_EN], ['安安小寶', '生日快樂', FONT_TC], ['I ♥ U', 'ANN LAND', FONT_EN]];
  const BGS = [['#e8507e', '#c4aef2'], ['#2f4a6b', '#9fd6ff'], ['#ff7d6b', '#ffd65c'], ['#4a2a45', '#e8507e']];
  let bbIdx = -1, bbSpecial = 0, bbTimer = 0;
  function drawBB(i, flash) {
    const g = bbCanvas.getContext('2d'), w = 1024, h = 512;
    const [a, b] = flash != null ? (flash ? ['#ffd65c', '#ff8fb1'] : ['#ff8fb1', '#c4aef2']) : BGS[i];
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const [l1, l2, font] = flash != null ? ['ANN', '♥ 21 ♥', FONT_EN] : MSGS[i];
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${flash != null ? 210 : 150}px ${font}`; g.fillText(l1, w / 2, l2 ? h * 0.38 : h / 2);
    if (l2) { g.font = `700 ${flash != null ? 120 : 110}px ${font}`; g.fillText(l2, w / 2, h * 0.75); }
    bbTex.needsUpdate = true;
  }
  const screenMat = new THREE.MeshBasicMaterial({ map: bbTex, toneMapped: false });
  const frame = M('#1c1d22');
  mesh(scene, new THREE.BoxGeometry(21, 12, 0.4), frame, 24, 24, -77.9);
  const sA = new THREE.Mesh(new THREE.PlaneGeometry(20, 11), screenMat); sA.position.set(24, 24, -77.65); scene.add(sA);
  mesh(scene, new THREE.BoxGeometry(0.4, 7.5, 12), frame, 29.8, 17, -69);
  const sB = new THREE.Mesh(new THREE.PlaneGeometry(11, 6.5), screenMat); sB.position.set(29.55, 17, -69); sB.rotation.y = -Math.PI / 2; scene.add(sB);
  drawBB(0);

  // Tower
  const tower = new THREE.Group();
  tower.position.set(-72, 0, 72);
  scene.add(tower);
  mesh(tower, new THREE.CylinderGeometry(10, 10.5, 5, 32).translate(0, 2.5, 0), M('#cfc8bd'));
  mesh(tower, new THREE.BoxGeometry(5, 3.4, 1).translate(0, 1.7, 0), M('#2b3445'), 0, 0, -10.2);
  mesh(tower, new THREE.CylinderGeometry(2.0, 4.6, 110, 24).translate(0, 55, 0), concrete);
  for (let i = 0; i < 3; i++) {
    const fin = mesh(tower, new THREE.BoxGeometry(1.4, 70, 5.5).translate(0, 35, 3.2), concrete);
    fin.rotation.y = (i / 3) * Math.PI * 2;
  }
  const glass = M('#2d3d55', { metalness: 0.6, roughness: 0.2, emissive: '#ffcf8a', emissiveIntensity: 0 });
  nightMats.push([glass, 0.5]);
  mesh(tower, new THREE.CylinderGeometry(9, 5.5, 5, 32).translate(0, 108, 0), concrete);
  mesh(tower, new THREE.CylinderGeometry(9.2, 9.2, 3, 32).translate(0, 112, 0), glass);
  mesh(tower, new THREE.CylinderGeometry(6, 9, 4, 32).translate(0, 115.5, 0), concrete);
  mesh(tower, new THREE.CylinderGeometry(1.6, 2.0, 30, 16).translate(0, 132, 0), concrete);
  mesh(tower, new THREE.CylinderGeometry(2.8, 2.8, 3, 20).translate(0, 146, 0), glass);
  mesh(tower, new THREE.CylinderGeometry(0.35, 1.0, 50, 8).translate(0, 173, 0), M('#e8e4dc'));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff3b3b', fog: false }));
  beacon.position.y = 199; tower.add(beacon);
  anim.push((t) => { beacon.visible = Math.sin(t * 3) > 0; });

  // Union-style station
  const uStone = M('#dccfb6');
  mesh(scene, new THREE.BoxGeometry(26, 15, 11).translate(0, 7.5, 0), uStone, 24, 0, 66.5);
  mesh(scene, new THREE.BoxGeometry(26, 1.6, 2.4).translate(0, 0, 0), uStone, 24, 11.8, 59.8);
  const colGeo = new THREE.CylinderGeometry(0.55, 0.62, 11, 10).translate(0, 5.5, 0);
  for (let i = 0; i < 10; i++) mesh(scene, colGeo, uStone, 12.5 + i * (23 / 9), 0, 59.6);

  // Trees
  const trees = L.generateTrees(rng);
  for (const t of trees) circles.push({ x: t.x, z: t.z, r: 0.5 });
  instanced(scene, new THREE.CylinderGeometry(0.22, 0.32, 2.6, 7).translate(0, 1.3, 0), M('#7a5a44'), trees, (d, t) => { d.position.set(t.x, 0, t.z); d.scale.setScalar(t.s); }, { shadow: true });
  const crowns = instanced(scene, new THREE.IcosahedronGeometry(1.8, 0).translate(0, 3.6, 0), M('#ffffff', { flatShading: true }), trees, (d, t) => { d.position.set(t.x, 0, t.z); d.scale.setScalar(t.s); d.rotation.y = t.x; }, { shadow: true });
  const GREENS = ['#6fb36a', '#5fa25e', '#7fc27a', '#8bbf6a'];
  trees.forEach((t, i) => crowns.setColorAt(i, col.set(GREENS[i % GREENS.length])));

  // Street lights
  const lights = L.streetLights();
  instanced(scene, new THREE.CylinderGeometry(0.11, 0.15, 6.2, 6).translate(0, 3.1, 0), M('#3b3d44'), lights, (d, p) => d.position.set(p.x, 0, p.z));
  const lampMat = M('#fff4d6', { emissive: '#ffd68a', emissiveIntensity: 0 });
  nightMats.push([lampMat, 2.4]);
  instanced(scene, new THREE.SphereGeometry(0.38, 10, 8), lampMat, lights, (d, p) => d.position.set(p.x, 6.3, p.z));

  // Traffic signals (NE corner = east-west traffic, SW corner = north-south)
  const sig = [];
  for (const xs of L.X_STREETS) for (const zs of L.Z_STREETS) { sig.push({ x: xs.x + 8.2, z: zs.z - 8.2, ew: true }, { x: xs.x - 8.2, z: zs.z + 8.2, ew: false }); }
  instanced(scene, new THREE.CylinderGeometry(0.1, 0.1, 4.6, 6).translate(0, 2.3, 0), M('#2a2b30'), sig, (d, p) => d.position.set(p.x, 0, p.z));
  instanced(scene, new THREE.BoxGeometry(0.5, 1.3, 0.5), M('#1c1d22'), sig, (d, p) => d.position.set(p.x, 4.9, p.z));
  const sigLights = instanced(scene, new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), sig, (d, p) => d.position.set(p.x, 4.9, p.z));
  let lastSig = '';
  const GREEN = new THREE.Color('#3ee07a'), RED = new THREE.Color('#ff3b3b'), AMBER = new THREE.Color('#ffb02e');
  function updateSignals(s) {
    const key = `${s.ew}${s.ns}${s.ewAmber}${s.nsAmber}`;
    if (key === lastSig) return;
    lastSig = key;
    sig.forEach((p, i) => sigLights.setColorAt(i, p.ew ? (s.ew ? GREEN : s.ewAmber ? AMBER : RED) : (s.ns ? GREEN : s.nsAmber ? AMBER : RED)));
    sigLights.instanceColor.needsUpdate = true;
  }

  // Mission markers
  const markers = new Map();
  const beamGeo = new THREE.CylinderGeometry(1, 1, 36, 20, 1, true).translate(0, 18, 0);
  for (const s of L.SPOTS) {
    const g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#ff8fb1', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd65c', transparent: true, opacity: 0.85, depthWrite: false }));
    ring.position.y = 0.1;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd65c', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(4); glow.position.y = 1.2;
    g.add(beam, ring, glow);
    scene.add(g);
    markers.set(s.id, { g, beam, ring, glow, done: false });
  }
  function setVisited(id, done) {
    const m = markers.get(id);
    if (!m) return;
    m.done = done;
    m.beam.visible = !done; m.glow.visible = !done;
    m.ring.material.color.set(done ? '#97e0c0' : '#ffd65c');
    m.ring.material.opacity = done ? 0.45 : 0.85;
  }

  function setTime(i) {
    const p = TIMES[i];
    skyU.top.value.set(p.top); skyU.bottom.value.set(p.bottom);
    scene.fog.color.set(p.fog);
    sun.color.set(p.sun); sun.intensity = p.sunI;
    hemi.intensity = p.hemi;
    night.value = p.night;
    for (const [m, k] of nightMats) m.emissiveIntensity = p.night * k;
  }

  function update(t, dt, focus, camera) {
    sky.position.copy(camera.position);
    sun.position.copy(focus).addScaledVector(SUN_DIR, 160);
    sun.target.position.copy(focus);
    for (const a of anim) a(t, dt);
    updateSignals(L.signal(t));
    bbTimer -= dt;
    if (bbSpecial > 0) {
      bbSpecial -= dt;
      if (bbTimer <= 0) { bbTimer = 0.45; drawBB(0, Math.floor(t * 2.2) % 2 === 0); }
      if (bbSpecial <= 0) bbTimer = 0;
    } else if (bbTimer <= 0) {
      bbTimer = 3.5; bbIdx = (bbIdx + 1) % MSGS.length; drawBB(bbIdx);
    }
    for (const m of markers.values()) if (!m.done) {
      m.ring.rotation.y = t;
      m.glow.position.y = 1.2 + Math.sin(t * 2.5) * 0.3;
      m.beam.material.opacity = 0.16 + Math.sin(t * 2) * 0.06;
    }
  }

  return {
    colliders, circles, occluders, setTime, update, setVisited,
    setBillboard: (secs = 12) => { bbSpecial = secs; bbTimer = 0; },
    towerTop: new THREE.Vector3(-72, 113, 72),
  };
}
