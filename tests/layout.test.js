import { describe, it, expect } from 'vitest';
import { GIFT_SPOTS, ATTRACTIONS, CUPCAKES, PARK_RADIUS, SPAWN, GATE, generateTrees, distToSegment, inSpawnView } from '../src/game/layout.js';
import { GIFT_COUNT } from '../src/game/state.js';
import { mulberry32 } from '../src/game/random.js';

describe('layout', () => {
  it('has a spot for every gift, inside the park', () => {
    expect(GIFT_SPOTS).toHaveLength(GIFT_COUNT);
    for (const g of GIFT_SPOTS) expect(Math.hypot(g.x, g.z)).toBeLessThan(PARK_RADIUS - 2);
  });
  it('keeps gifts reachable (not inside attractions or cupcakes)', () => {
    for (const g of GIFT_SPOTS) {
      for (const a of Object.values(ATTRACTIONS)) expect(Math.hypot(g.x - a.x, g.z - a.z)).toBeGreaterThan(a.r + 2);
      for (const c of CUPCAKES) expect(Math.hypot(g.x - c.x, g.z - c.z)).toBeGreaterThan(4);
    }
  });
  it('spreads gifts apart', () => {
    for (let i = 0; i < GIFT_SPOTS.length; i++)
      for (let j = i + 1; j < GIFT_SPOTS.length; j++)
        expect(Math.hypot(GIFT_SPOTS[i].x - GIFT_SPOTS[j].x, GIFT_SPOTS[i].z - GIFT_SPOTS[j].z)).toBeGreaterThan(6);
  });
  it('spawns away from the cake', () => {
    expect(Math.hypot(SPAWN.x, SPAWN.z)).toBeGreaterThan(ATTRACTIONS.cake.r + 5);
  });
  it('generates deterministic trees that do not block the spawn', () => {
    const a = generateTrees(mulberry32(1008));
    const b = generateTrees(mulberry32(1008));
    expect(a).toEqual(b);
    for (const t of a.filter((t) => t.inner)) expect(Math.hypot(t.x - SPAWN.x, t.z - SPAWN.z)).toBeGreaterThan(3);
  });
  it('spawns in line with the gate', () => {
    expect(SPAWN.z).toBe(GATE.z);
    expect(SPAWN.x).toBe(GATE.x);
  });
  it('keeps trees out of the view behind the spawn', () => {
    expect(generateTrees(mulberry32(20261008)).some((t) => inSpawnView(t.x, t.z))).toBe(false);
  });
  it('measures distance to a segment', () => {
    expect(distToSegment(0, 5, -10, 0, 10, 0)).toBe(5);
    expect(distToSegment(13, 4, 0, 0, 10, 0)).toBe(5);
  });
});
