export const PARK_RADIUS = 40;
export const TAU = Math.PI * 2;

export const PALETTE = {
  pink: '#ff8fb1', rose: '#e8507e', cream: '#fff3e2', mint: '#97e0c0', butter: '#ffd65c',
  lilac: '#c4aef2', sky: '#9fd6ff', coral: '#ff7d6b', white: '#ffffff', grass: '#bfe8b2',
  path: '#f7e3c6', gold: '#f2b632', leaf: '#7fcf95', berry: '#ff4d6d',
};
export const CANDY = [PALETTE.pink, PALETTE.butter, PALETTE.mint, PALETTE.lilac, PALETTE.sky, PALETTE.coral];

export const SPAWN = { x: 0, z: 34 };
export const ATTRACTIONS = {
  cake: { x: 0, z: 0, r: 7.6 },
  ferris: { x: -22, z: -12, r: 5.5 },
  carousel: { x: 22, z: -10, r: 7 },
};
export const GATE = { x: 0, z: 34, pillarX: 6.5 };
// keep the view behind the spawn clear (no trees between camera and gate)
export const inSpawnView = (x, z) => Math.abs(x) < 10 && z > 26;
export const SIGN = { x: 6, z: 16, r: 1.6 };
export const CUPCAKES = [{ x: -13, z: 17 }, { x: 13, z: 17 }, { x: -31, z: 12 }, { x: 31, z: 14 }];
export const GIFT_SPOTS = [
  { x: -7, z: 20 }, { x: 16, z: 24 }, { x: -30, z: 2 }, { x: 31, z: 3 },
  { x: -14, z: -30 }, { x: 9, z: -32 }, { x: -28, z: -25 }, { x: 25, z: -27 },
];
export const SPOKES = [{ x: 0, z: 34 }, ATTRACTIONS.ferris, ATTRACTIONS.carousel, { x: 0, z: -38 }];
export const RING_PATH = { inner: 10.5, outer: 13.5 };

export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export function staticObstacles() {
  return [
    ...Object.values(ATTRACTIONS),
    ...CUPCAKES.map((c) => ({ ...c, r: 1.9 })),
    ...GIFT_SPOTS.map((g) => ({ ...g, r: 2.5 })),
    { ...SIGN },
    { x: SPAWN.x, z: SPAWN.z, r: 3 },
    { x: -GATE.pillarX, z: GATE.z, r: 1.3 },
    { x: GATE.pillarX, z: GATE.z, r: 1.3 },
  ];
}

export function isClear(x, z, pad = 0) {
  const d = Math.hypot(x, z);
  if (d > RING_PATH.inner - pad && d < RING_PATH.outer + 1 + pad) return false;
  if (staticObstacles().some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad)) return false;
  return !SPOKES.some((s) => distToSegment(x, z, 0, 0, s.x, s.z) < 2.4 + pad);
}

export function generateTrees(rng) {
  const trees = [];
  const border = 54;
  for (let i = 0; i < border; i++) {
    const a = (i / border) * TAU + rng() * 0.08;
    const r = PARK_RADIUS + 2.5 + rng() * 7;
    const tx = Math.sin(a) * r, tz = Math.cos(a) * r;
    if (inSpawnView(tx, tz)) { rng(); rng(); continue; }
    trees.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, type: rng() < 0.3 ? 'lollipop' : 'round', s: 0.9 + rng() * 0.6, inner: false });
  }
  let inner = 0, tries = 0;
  while (inner < 16 && tries < 800) {
    tries++;
    const a = rng() * TAU, r = 16 + rng() * 21;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (!isClear(x, z, 1.2) || inSpawnView(x, z)) continue;
    if (trees.some((t) => t.inner && Math.hypot(t.x - x, t.z - z) < 5)) continue;
    trees.push({ x, z, type: rng() < 0.45 ? 'lollipop' : 'round', s: 0.8 + rng() * 0.5, inner: true });
    inner++;
  }
  return trees;
}
