import { describe, it, expect } from 'vitest';
import { ANIMALS, isWalkable, pickTarget, stepToward, nextLine } from '../src/game/wander.js';
import { ATTRACTIONS } from '../src/game/layout.js';
import { mulberry32 } from '../src/game/random.js';

describe('animals', () => {
  it('has cats, dogs and raccoons with lines', () => {
    for (const k of ['cat', 'dog', 'raccoon']) expect(ANIMALS.some((a) => a.kind === k)).toBe(true);
    for (const a of ANIMALS) expect(a.lines.length).toBeGreaterThan(0);
  });
  it('cycles lines', () => {
    const a = ANIMALS[0];
    expect(nextLine(a, 0)).toBe(a.lines[0]);
    expect(nextLine(a, a.lines.length)).toBe(a.lines[0]);
  });
});

describe('wandering', () => {
  it('never picks targets inside attractions', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const t = pickTarget(rng);
      expect(isWalkable(t.x, t.z)).toBe(true);
      for (const a of Object.values(ATTRACTIONS)) expect(Math.hypot(t.x - a.x, t.z - a.z)).toBeGreaterThan(a.r);
    }
  });
  it('moves at the given speed and arrives', () => {
    const r = stepToward({ x: 0, z: 0 }, { x: 10, z: 0 }, 1, 2);
    expect(r.x).toBeCloseTo(2);
    expect(r.arrived).toBe(false);
    expect(r.heading).toBeCloseTo(Math.PI / 2);
    const end = stepToward({ x: 9.5, z: 0 }, { x: 10, z: 0 }, 1, 2);
    expect(end.arrived).toBe(true);
    expect(end.x).toBeCloseTo(10);
  });
});
