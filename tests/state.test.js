import { describe, it, expect } from 'vitest';
import {
  BIRTHDAY, GIFT_COUNT, GIFTS, RIDE_NOTE, ordinal, createGameState, collectGift, canBlowCandles, blowCandle, boardRide, birthdayStatus,
} from '../src/game/state.js';
import { MELODY, melodyBeats, midiToHz } from '../src/game/melody.js';

describe('birthday constants', () => {
  it('is Ann (安安小寶) turning 21 on Oct. 8th, 2026', () => {
    expect(BIRTHDAY).toMatchObject({ name: 'Ann', nickname: '安安小寶', age: 21, year: 2026, month: 10, day: 8, dateLabel: 'Oct. 8th', zhDate: '2026年10月8號' });
  });
  it('has 8 gifts, each with a title and text', () => {
    expect(GIFT_COUNT).toBe(8);
    for (const g of GIFTS) { expect(g.title.length).toBeGreaterThan(0); expect(g.text.length).toBeGreaterThan(0); }
  });
  it('includes the food-care and surprise gifts', () => {
    expect(GIFTS.some((g) => g.title.includes('食物照顧'))).toBe(true);
    expect(GIFTS.some((g) => g.title.includes('驚喜'))).toBe(true);
  });
});

describe('ordinal', () => {
  it.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [11, '11th'], [13, '13th'], [21, '21st'], [22, '22nd'], [8, '8th']])(
    '%i -> %s', (n, s) => expect(ordinal(n)).toBe(s),
  );
});

describe('gift collection', () => {
  it('collects each gift once and moves to cake phase at the end', () => {
    let s = createGameState();
    for (let i = 0; i < GIFT_COUNT; i++) {
      const r = collectGift(s, i);
      expect(r.isNew).toBe(true);
      expect(r.gift).toBe(GIFTS[i]);
      s = r.state;
    }
    expect(s.phase).toBe('cake');
    expect(collectGift(s, 0).isNew).toBe(false);
  });
  it('ignores invalid ids', () => {
    const s = createGameState();
    expect(collectGift(s, -1).isNew).toBe(false);
    expect(collectGift(s, GIFT_COUNT).isNew).toBe(false);
    expect(collectGift(s, 1.5).isNew).toBe(false);
  });
});

describe('candles', () => {
  it('cannot blow before all gifts are found', () => {
    const s = createGameState();
    expect(canBlowCandles(s)).toBe(false);
    expect(blowCandle(s)).toBe(s);
  });
  it('blows out all 21 candles then celebrates', () => {
    let s = createGameState();
    for (let i = 0; i < GIFT_COUNT; i++) s = collectGift(s, i).state;
    expect(s.candlesLit).toBe(21);
    for (let i = 0; i < 20; i++) s = blowCandle(s);
    expect(s.phase).toBe('cake');
    s = blowCandle(s, 5);
    expect(s.candlesLit).toBe(0);
    expect(s.phase).toBe('celebrate');
    expect(canBlowCandles(s)).toBe(false);
  });
});

describe('rides', () => {
  it('shows the 大立百貨 note only on the first ride of each attraction', () => {
    let s = createGameState();
    let r = boardRide(s, 'ferris');
    expect(r.note).toBe(RIDE_NOTE);
    expect(RIDE_NOTE).toContain('大立百貨');
    s = r.state;
    expect(boardRide(s, 'ferris').note).toBeNull();
    r = boardRide(s, 'carousel');
    expect(r.note).toBe(RIDE_NOTE);
    expect(r.state.ridden).toEqual(['ferris', 'carousel']);
  });
});

describe('birthdayStatus', () => {
  it('detects the birthday', () => {
    expect(birthdayStatus(new Date(2026, 9, 8, 15))).toEqual({ isToday: true, daysUntil: 0 });
  });
  it('counts down', () => {
    expect(birthdayStatus(new Date(2026, 9, 7)).daysUntil).toBe(1);
    expect(birthdayStatus(new Date(2026, 9, 9)).daysUntil).toBe(364);
  });
});

describe('melody', () => {
  it('is the full four-line song', () => {
    expect(MELODY).toHaveLength(25);
    expect(melodyBeats()).toBe(25);
    expect(midiToHz(69)).toBe(440);
  });
});
