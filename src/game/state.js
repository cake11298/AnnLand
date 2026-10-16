export const BIRTHDAY = Object.freeze({ name: 'Ann', nickname: '安安小寶', age: 21, month: 10, day: 8, year: 2026, dateLabel: 'Oct. 8th', zhDate: '2026年10月8號' });

export const GIFTS = [
  { title: '一年份寶寶食物照顧券', text: '接下來一整年，安安小寶的早餐、午餐、晚餐和點心，都由我來照顧。想吃什麼，說一聲就好。' },
  { title: '不定時驚喜禮物', text: '男朋友會在某個妳完全想不到的日子，送出一份驚喜。什麼時候？我也不告訴妳。' },
  { title: '無限次抱抱券', text: '有效期限：永遠。使用方式：張開手就好。' },
  { title: '專屬司機券', text: '想去哪裡，我載妳去。不問為什麼，也不嫌遠。' },
  { title: '陪逛街不喊累券', text: '逛多久都陪妳，幫妳拿包包、幫妳拍照，還會認真說好看。' },
  { title: '吵架先低頭券', text: '吵架的時候，由我先道歉。（但希望妳很少用到它）' },
  { title: '說走就走小旅行', text: '一次由妳決定目的地的小旅行，行程和交通都交給我。' },
  { title: '21 歲的祝福', text: '願妳 21 歲勇敢、自由、被溫柔以待。10月8號是我最喜歡的日子，因為妳在這天來到這個世界。' },
];
export const GIFT_COUNT = GIFTS.length;
export const RIDE_NOTE = '我希望下次還帶你去大立百貨（高雄）玩。';

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function createGameState({ gifts = GIFT_COUNT, candles = BIRTHDAY.age } = {}) {
  return { totalGifts: gifts, found: [], candlesTotal: candles, candlesLit: candles, phase: 'explore', ridden: [] };
}

export function collectGift(state, id) {
  if (!Number.isInteger(id) || id < 0 || id >= state.totalGifts || state.found.includes(id)) {
    return { state, isNew: false, gift: null };
  }
  const found = [...state.found, id];
  const phase = found.length === state.totalGifts ? 'cake' : state.phase;
  return { state: { ...state, found, phase }, isNew: true, gift: GIFTS[id % GIFTS.length] };
}

export function canBlowCandles(state) {
  return state.found.length >= state.totalGifts && state.candlesLit > 0;
}

export function blowCandle(state, n = 1) {
  if (!canBlowCandles(state)) return state;
  const candlesLit = Math.max(0, state.candlesLit - n);
  return { ...state, candlesLit, phase: candlesLit === 0 ? 'celebrate' : state.phase };
}

export function boardRide(state, key) {
  if (state.ridden.includes(key)) return { state, note: null };
  return { state: { ...state, ridden: [...state.ridden, key] }, note: RIDE_NOTE };
}

export function birthdayStatus(date = new Date(), b = BIRTHDAY) {
  const y = date.getFullYear();
  const today = new Date(y, date.getMonth(), date.getDate());
  let target = new Date(y, b.month - 1, b.day);
  if (today > target) target = new Date(y + 1, b.month - 1, b.day);
  const daysUntil = Math.round((target - today) / 86400000);
  return { isToday: daysUntil === 0, daysUntil };
}
