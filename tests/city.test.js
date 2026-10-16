import { describe, it, expect } from 'vitest';
import { checkCode, hexToText, normalizeCode, SECRET_HEX } from '../src/game/secret.js';
import {
  SPOTS, SPAWN, SPECIAL_RECTS, X_STREETS, Z_STREETS, HALF_ROAD, BOUNDS, PIER,
  generateBuildings, generateTrees, districtAt, cornerLabel, signal, stopDistance, pushRect, clampToCity,
} from '../src/game/cityLayout.js';
import { mulberry32 } from '../src/game/random.js';

const inside = (p, r) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;

describe('secret code', () => {
  it('decodes to IloveU', () => expect(hexToText(SECRET_HEX)).toBe('IloveU'));
  it('accepts the code in any case or separator', () => {
    for (const c of ['49-6c-6f-76-65-55', '49-6C-6F-76-65-55', '496c6f766555', '49 6c 6f 76 65 55']) expect(checkCode(c)).toBe(true);
  });
  it('rejects wrong codes', () => {
    for (const c of ['', '49-6c-6f-76-65', '49-6c-6f-76-65-56', 'iloveu']) expect(checkCode(c)).toBe(false);
  });
  it('normalizes input', () => expect(normalizeCode(' 49-6C ')).toBe('496c'));
});

describe('city layout', () => {
  const buildings = generateBuildings(mulberry32(20261008)).filter((b) => !b.roof);
  const solids = [...buildings, ...SPECIAL_RECTS];

  it('generates deterministic buildings', () => {
    expect(generateBuildings(mulberry32(7))).toEqual(generateBuildings(mulberry32(7)));
  });
  it('keeps buildings off the roads', () => {
    for (const b of buildings) {
      for (const s of X_STREETS) expect(b.x1 <= s.x - HALF_ROAD || b.x0 >= s.x + HALF_ROAD).toBe(true);
      for (const s of Z_STREETS) expect(b.z1 <= s.z - HALF_ROAD || b.z0 >= s.z + HALF_ROAD).toBe(true);
    }
  });
  it('places every spot in bounds and outside buildings', () => {
    expect(SPOTS).toHaveLength(6);
    for (const s of SPOTS) {
      const onPier = s.z > BOUNDS.maxZ && s.x > PIER.x0 && s.x < PIER.x1 && s.z < PIER.z1;
      expect(onPier || (s.x > BOUNDS.minX && s.x < BOUNDS.maxX && s.z > BOUNDS.minZ && s.z < BOUNDS.maxZ)).toBe(true);
      for (const r of solids) expect(inside(s, r)).toBe(false);
    }
  });
  it('spawns on open ground', () => {
    for (const r of solids) expect(inside(SPAWN, r)).toBe(false);
  });
  it('keeps trees off the spots', () => {
    for (const t of generateTrees(mulberry32(1))) for (const s of SPOTS) expect(Math.hypot(t.x - s.x, t.z - s.z)).toBeGreaterThan(2);
  });
  it('names districts and corners', () => {
    expect(districtAt(-72, -70).en).toBe('City Hall');
    expect(districtAt(0, 150).en).toBe('Harbourfront');
    expect(cornerLabel(1, 2)).toContain('Yonge St');
    expect(cornerLabel(1, 2)).toContain('King St');
  });
});

describe('traffic rules', () => {
  it('alternates green lights and never greens both ways', () => {
    for (let t = 0; t < 44; t += 0.5) expect(signal(t).ew && signal(t).ns).toBe(false);
    expect(signal(1).ew).toBe(true);
    expect(signal(12).ns).toBe(true);
  });
  it('measures distance to the next stop line ahead', () => {
    expect(stopDistance(0, 1, [48])).toBe(39);
    expect(stopDistance(60, -1, [48])).toBe(3);
    expect(stopDistance(50, 1, [48])).toBe(Infinity);
  });
  it('pushes the player out of a rect', () => {
    const p = { x: 0.2, z: 0 };
    expect(pushRect(p, { x0: -1, x1: 1, z0: -3, z1: 3 }, 0)).toBe(true);
    expect(p.x).toBe(1);
  });
  it('lets the player walk onto the pier but not into the lake', () => {
    const lake = clampToCity({ x: 40, z: 140 }, { x: 40, z: 120 });
    expect(lake.z).toBe(BOUNDS.maxZ);
    const pier = clampToCity({ x: 0, z: 150 }, { x: 0, z: 149 });
    expect(pier.z).toBe(150);
    const off = clampToCity({ x: 9, z: 150 }, { x: 0, z: 150 });
    expect(off.x).toBeLessThan(PIER.x1);
  });
});
