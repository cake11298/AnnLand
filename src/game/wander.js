import { staticObstacles, PARK_RADIUS } from './layout.js';

export const ANIMALS = [
  { kind: 'cat', name: '麻糬', color: '#f4a65a', lines: ['喵～ 安安小寶生日快樂！', '呼嚕呼嚕…（蹭了蹭妳的腳）', '今天的妳特別可愛，喵。'] },
  { kind: 'cat', name: '芝麻', color: '#8f8a99', lines: ['喵嗚～ 摸摸頭就是最好的禮物。', '（翻肚子給妳看）', '21 歲也要每天睡飽飽喔。'] },
  { kind: 'dog', name: '布丁', color: '#e8b77a', lines: ['汪汪！生日快樂！要一起散步嗎？', '（尾巴搖到停不下來）', '汪！男朋友說今天妳最大！'] },
  { kind: 'dog', name: '可可', color: '#9c6b4a', lines: ['汪～ 我幫妳顧蛋糕，不會偷吃的！', '（把頭靠在妳手上）', '汪汪！再摸一下下嘛。'] },
  { kind: 'raccoon', name: '小偷偷', color: '#9a96a0', lines: ['嘿嘿，我偷偷幫妳藏了一顆糖果。', '浣熊洗洗手，跟妳說生日快樂！', '（遞給妳一片餅乾）'] },
  { kind: 'raccoon', name: '團團', color: '#b3aeb8', lines: ['生日快樂！可以分我一口蛋糕嗎？', '（抱著尾巴對妳眨眼）', '我會在樂園裡等妳下次再來。'] },
];

export function isWalkable(x, z, pad = 1.2, maxR = PARK_RADIUS - 4) {
  if (Math.hypot(x, z) > maxR) return false;
  return !staticObstacles().some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad);
}

export function pickTarget(rng, isFree = isWalkable, minR = 9, maxR = PARK_RADIUS - 4) {
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2, r = minR + rng() * (maxR - minR);
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (isFree(x, z)) return { x, z };
  }
  return { x: 0, z: 24 };
}

export function stepToward(pos, target, speed, dt, arriveDist = 0.4) {
  const dx = target.x - pos.x, dz = target.z - pos.z;
  const d = Math.hypot(dx, dz);
  if (d <= arriveDist) return { x: pos.x, z: pos.z, arrived: true, heading: null };
  const s = Math.min(d, speed * dt);
  return { x: pos.x + (dx / d) * s, z: pos.z + (dz / d) * s, arrived: d - s <= arriveDist, heading: Math.atan2(dx, dz) };
}

export function nextLine(animal, count) {
  return animal.lines[count % animal.lines.length];
}
