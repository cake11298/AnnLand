// Map 2 — 多倫多市中心風格的開放城市。北方 = -z，湖在南邊 (+z)。
export const HALF_ROAD = 7;
export const WALK = 3.5;
export const BLOCK_HALF = 17;
export const LOT_HALF = BLOCK_HALF - WALK;

export const X_STREETS = [
  { x: -192, name: 'Bathurst St' }, { x: -144, name: 'Spadina Ave' }, { x: -96, name: 'University Ave' },
  { x: -48, name: 'Bay St' }, { x: 0, name: 'Yonge St' }, { x: 48, name: 'Church St' },
  { x: 96, name: 'Jarvis St' }, { x: 144, name: 'Sherbourne St' }, { x: 192, name: 'Parliament St' },
];
export const Z_STREETS = [
  { z: -192, name: 'Bloor St' }, { z: -144, name: 'College St' }, { z: -96, name: 'Dundas St' },
  { z: -48, name: 'Queen St' }, { z: 0, name: 'King St' }, { z: 48, name: 'Front St' }, { z: 96, name: 'Lake Shore Blvd' },
];
export const KING_Z = 0;
export const STREETCAR_STOPS = [-168, -120, -72, -24, 24, 72, 120, 168];
export const BOUNDS = { minX: -200, maxX: 200, minZ: -200, maxZ: 121 };
export const WATER_Z = 124;
export const PIER = { x0: -5, x1: 5, z0: 118, z1: 176 };
export const SPAWN = { x: 10, z: 30 };

export const SPECIAL = {
  '-72,-72': 'cityhall', '24,-72': 'square', '-168,-72': 'kensington', '168,72': 'distillery',
  '-72,72': 'tower', '-72,-168': 'park', '24,72': 'union',
};

export const COLORS = {
  core: ['#9fb3c8', '#7f93a8', '#c9d3dc', '#5d7189', '#a8b8b0', '#d7d2c8', '#8da2b8'],
  mid: ['#d9cbb8', '#c4b5a5', '#b9c2c9', '#e2d6c4', '#a7a19a', '#cfb9a3', '#bfae9c'],
  pastel: ['#f2a7a0', '#f6d38a', '#9fd1c2', '#b9a8e3', '#f4b6cf', '#a6cdea'],
  brick: ['#a5553f', '#8f4a37', '#b8664b', '#9b5b45'],
};

// 特殊街區裡的固定建築（碰撞用）
export const RECTS = {
  cityhall: { x0: -82.5, x1: -61.5, z0: -85, z1: -67 },
  sign: { x0: -83.2, x1: -60.8, z0: -63.6, z1: -62.4 },
  screenA: { x0: 12, x1: 36, z0: -85.5, z1: -78 },
  screenB: { x0: 30, x1: 37.5, z0: -76, z1: -62 },
  towerBase: { x0: -82, x1: -62, z0: 62, z1: 82 },
  legislature: { x0: -83, x1: -61, z0: -181.5, z1: -171.5 },
  union: { x0: 11, x1: 37, z0: 58.5, z1: 72 },
};
export const SPECIAL_RECTS = Object.values(RECTS);

export const styleAt = (cx, cz) => {
  if (cx <= -168) return 'pastel';
  if (cx >= 168 && cz >= 24) return 'brick';
  if (cx >= -72 && cx <= 72 && cz >= -72 && cz <= 24) return 'core';
  return 'mid';
};

export function blocks() {
  const out = [];
  for (let i = 0; i < X_STREETS.length - 1; i++) {
    for (let j = 0; j < Z_STREETS.length - 1; j++) {
      const cx = (X_STREETS[i].x + X_STREETS[i + 1].x) / 2, cz = (Z_STREETS[j].z + Z_STREETS[j + 1].z) / 2;
      out.push({ cx, cz, special: SPECIAL[`${cx},${cz}`] ?? null, style: styleAt(cx, cz) });
    }
  }
  return out;
}

export const lotOf = (cx, cz) => ({ x0: cx - LOT_HALF, x1: cx + LOT_HALF, z0: cz - LOT_HALF, z1: cz + LOT_HALF });

// 一排 4 間面向街道的小店（south = 面向 +z 的街，north = 面向 -z 的街）
export function shopRow(cx, cz, side) {
  const lot = lotOf(cx, cz), w = (LOT_HALF * 2) / 4;
  return [0, 1, 2, 3].map((index) => {
    const x0 = lot.x0 + index * w + 0.25, x1 = lot.x0 + (index + 1) * w - 0.25;
    const z0 = side === 'south' ? lot.z1 - 12 : lot.z0, z1 = side === 'south' ? lot.z1 : lot.z0 + 12;
    return { x0, x1, z0, z1, index, side, door: { x: (x0 + x1) / 2, z: side === 'south' ? lot.z1 + 1.5 : lot.z0 - 1.5 } };
  });
}

export function generateBuildings(rng) {
  const out = [];
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const range = (a, b) => a + rng() * (b - a);
  const heightFor = (style) => ({ core: range(55, 150), mid: range(18, 55), pastel: range(7, 12), brick: range(9, 16) })[style];
  for (const b of blocks()) {
    const lot = lotOf(b.cx, b.cz);
    if (b.special === 'kensington' || b.special === 'distillery') {
      const side = b.special === 'kensington' ? 'south' : 'north';
      const style = b.special === 'kensington' ? 'pastel' : 'brick';
      for (const s of shopRow(b.cx, b.cz, side)) out.push({ x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, h: range(6.5, 9), color: pick(COLORS[style]), style, shop: `${b.special}-${s.index}` });
      const z0 = side === 'south' ? lot.z0 : lot.z0 + 15, z1 = side === 'south' ? lot.z1 - 15 : lot.z1;
      for (let k = 0; k < 2; k++) {
        const x0 = lot.x0 + k * 13.75;
        out.push({ x0, x1: x0 + 13.25, z0, z1, h: range(8, 14), color: pick(COLORS[style]), style });
      }
      continue;
    }
    if (b.special) continue;
    const m = rng();
    const cells = m < 0.25 ? [[0, 0, 1, 1]]
      : m < 0.5 ? [[0, 0, 0.5, 1], [0.5, 0, 1, 1]]
        : m < 0.7 ? [[0, 0, 1, 0.5], [0, 0.5, 1, 1]]
          : [[0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5], [0, 0.5, 0.5, 1], [0.5, 0.5, 1, 1]];
    const span = LOT_HALF * 2, g = 0.75;
    for (const [a, c, bb, d] of cells) {
      const x0 = lot.x0 + a * span + (a > 0 ? g : 0), x1 = lot.x0 + bb * span - (bb < 1 ? g : 0);
      const z0 = lot.z0 + c * span + (c > 0 ? g : 0), z1 = lot.z0 + d * span - (d < 1 ? g : 0);
      const h = heightFor(b.style);
      out.push({ x0, x1, z0, z1, h, color: pick(COLORS[b.style]), style: b.style });
      if (h > 30 && rng() < 0.55) {
        const ix = (x1 - x0) * 0.25, iz = (z1 - z0) * 0.25;
        out.push({ x0: x0 + ix, x1: x1 - ix, z0: z0 + iz, z1: z1 - iz, y0: h, h: range(3, 9), color: '#8d8f96', style: b.style, roof: true });
      }
    }
  }
  return out;
}

// 地圖外圍的天際線（不能走過去，只是背景）
export function decorBuildings(rng) {
  const out = [];
  const range = (a, b) => a + rng() * (b - a);
  const push = (cx, cz) => {
    const w = range(14, 22), d = range(14, 22);
    out.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, h: range(20, 85), color: COLORS.mid[Math.floor(rng() * COLORS.mid.length)], decor: true });
  };
  for (let x = -250; x <= 250; x += 26) push(x, -234);
  for (let z = -208; z <= 80; z += 26) { push(-234, z); push(234, z); }
  return out;
}

export function generateTrees(rng) {
  const out = [];
  for (const zs of [-48, 0]) for (const side of [-1, 1]) for (let x = -196; x <= 196; x += 12) {
    if (X_STREETS.some((s) => Math.abs(s.x - x) < 11)) continue;
    out.push({ x, z: zs + side * 9.6, s: 0.85 + rng() * 0.35 });
  }
  for (let x = -84; x <= -60; x += 4.5) for (let z = -167; z <= -156; z += 4.5) {
    if (Math.abs(x + 72) < 3) continue;
    out.push({ x: x + (rng() - 0.5) * 1.5, z: z + (rng() - 0.5) * 1.5, s: 1 + rng() * 0.4 });
  }
  for (let x = -196; x <= 196; x += 10) if (Math.abs(x) > 10) out.push({ x, z: 107, s: 0.9 + rng() * 0.3 });
  return out.filter((t) => !SPOTS.some((s) => Math.hypot(t.x - s.x, t.z - s.z) < 5));
}

export function streetLights() {
  const out = [];
  const nearZ = (z) => Z_STREETS.some((s) => Math.abs(s.z - z) < 12);
  const nearX = (x) => X_STREETS.some((s) => Math.abs(s.x - x) < 12);
  for (const s of X_STREETS) for (let z = -186; z <= 90; z += 24) if (!nearZ(z)) { out.push({ x: s.x - 8.4, z }, { x: s.x + 8.4, z }); }
  for (const s of Z_STREETS) {
    if (s.z === 0 || s.z === -48) continue;
    for (let x = -186; x <= 186; x += 24) if (!nearX(x)) { out.push({ x, z: s.z - 8.4 }, { x, z: s.z + 8.4 }); }
  }
  for (let x = -190; x <= 190; x += 20) if (Math.abs(x) > 8) out.push({ x, z: 117 });
  out.push({ x: -4.4, z: 174 }, { x: 4.4, z: 174 }, { x: -4.4, z: 146 }, { x: 4.4, z: 146 });
  return out;
}

const cafe = shopRow(-168, -72, 'south')[2];
const bakery = shopRow(168, 72, 'north')[1];
export const SPOTS = [
  { id: 'cafe', icon: 'C', x: cafe.door.x, z: cafe.door.z, verb: '點一杯熱可可', name: 'Kensington 小咖啡館', title: '熱可可，加兩顆棉花糖', text: '今天的第一杯我請客。坐在窗邊慢慢喝，不用趕時間。' },
  { id: 'square', icon: 'S', x: 20, z: -68, verb: '看大螢幕', name: 'Yonge-Dundas 廣場', title: '整條街的大螢幕都在說生日快樂', text: '抬頭看看，今天這裡的螢幕只為一個人亮。' },
  { id: 'sign', icon: 'A', x: -72, z: -57, verb: '跟招牌合照', name: '市政廳廣場', title: 'ANN 21', text: '全城最有名的招牌，今天換上妳的名字。' },
  { id: 'tower', icon: 'T', x: -72, z: 59.5, verb: '搭電梯上塔頂', name: '塔頂觀景台', title: '從最高的地方看這座城市', text: '整座城市都在下面，但我最想看的還是旁邊的妳。' },
  { id: 'bakery', icon: 'B', x: bakery.door.x, z: bakery.door.z, verb: '買一塊蛋糕', name: 'Distillery 麵包店', title: '一塊草莓蛋糕', text: '最大的那一塊留給 21 歲的妳，蠟燭已經插好了。' },
  { id: 'pier', icon: 'P', x: 0, z: 170, verb: '看看湖景', name: '湖濱碼頭', title: '安大略湖的晚風', text: '風有點涼，牽著手走到碼頭盡頭，就不冷了。' },
];
export const SHOP_SIGNS = { 'kensington-0': 'VINTAGE', 'kensington-1': 'BOOKS', 'kensington-2': 'CAFÉ 1008', 'kensington-3': 'FRUIT', 'distillery-0': 'GALLERY', 'distillery-1': 'BAKERY 21', 'distillery-2': 'CHOCOLATE', 'distillery-3': 'TEA' };
export const FINALE = { label: `城市印章 ${SPOTS.length}/${SPOTS.length}`, title: '整座城市都走過一遍了', text: '生日快樂，Ann。不管是樂園還是城市，我都想陪妳一起逛。' };

const D = (en, zh) => ({ en, zh });
export function districtAt(x, z) {
  const inR = (x0, x1, z0, z1) => x > x0 && x < x1 && z > z0 && z < z1;
  if (z > 100) return D('Harbourfront', '湖濱');
  if (x < -144) return D('Kensington Market', '肯辛頓市場');
  if (x > 144 && z > 0) return D('Distillery District', '酒廠區');
  if (inR(-96, -48, -96, -48)) return D('City Hall', '市政廳廣場');
  if (inR(0, 48, -96, -48)) return D('Yonge-Dundas Square', '央街廣場');
  if (inR(-96, -48, -192, -144)) return D("Queen's Park", '皇后公園');
  if (inR(-96, 48, 48, 100)) return D('Entertainment District', '娛樂區');
  if (z < -144) return D('Bloor-Yorkville', '約克維爾');
  if (inR(-96, 96, -48, 48)) return D('Financial District', '金融區');
  return D('Downtown', '市中心');
}

export function cornerLabel(x, z) {
  const ns = X_STREETS.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
  const ew = Z_STREETS.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a));
  return Math.abs(ns.x - x) < Math.abs(ew.z - z) ? `${ns.name} & ${ew.name}` : `${ew.name} & ${ns.name}`;
}

// 紅綠燈：22 秒一輪（東西向綠 → 黃 → 南北向綠 → 黃）
export function signal(t) {
  const m = ((t % 22) + 22) % 22;
  return { ew: m < 9, ns: m >= 11 && m < 20, ewAmber: m >= 9 && m < 11, nsAmber: m >= 20 };
}

// 沿行進方向到下一條停止線的距離
export function stopDistance(s, dir, crossings, back = HALF_ROAD + 2) {
  let best = Infinity;
  for (const c of crossings) {
    const d = (c - dir * back - s) * dir;
    if (d > -0.5 && d < best) best = d;
  }
  return best;
}

export function pushRect(p, r, pad = 0.6) {
  const x0 = r.x0 - pad, x1 = r.x1 + pad, z0 = r.z0 - pad, z1 = r.z1 + pad;
  if (p.x <= x0 || p.x >= x1 || p.z <= z0 || p.z >= z1) return false;
  const l = p.x - x0, rr = x1 - p.x, t = p.z - z0, b = z1 - p.z, m = Math.min(l, rr, t, b);
  if (m === l) p.x = x0; else if (m === rr) p.x = x1; else if (m === t) p.z = z0; else p.z = z1;
  return true;
}

export function pushCircle(p, c, pad = 0.6) {
  const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + pad;
  if (d >= min || d < 1e-4) return false;
  p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min;
  return true;
}

export function clampToCity(p, prev) {
  const px0 = PIER.x0 + 0.6, px1 = PIER.x1 - 0.6;
  if (prev && prev.z > BOUNDS.maxZ) {
    p.x = Math.min(px1, Math.max(px0, p.x));
    p.z = Math.min(PIER.z1 - 0.6, p.z);
  } else if (p.z > BOUNDS.maxZ && !(p.x >= px0 && p.x <= px1)) {
    p.z = BOUNDS.maxZ;
  }
  p.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, p.x));
  p.z = Math.max(BOUNDS.minZ, p.z);
  return p;
}
