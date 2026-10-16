// "Happy Birthday" (public domain) as [midi note, beats]
export const MELODY = [
  [67, 0.75], [67, 0.25], [69, 1], [67, 1], [72, 1], [71, 2],
  [67, 0.75], [67, 0.25], [69, 1], [67, 1], [74, 1], [72, 2],
  [67, 0.75], [67, 0.25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2],
  [77, 0.75], [77, 0.25], [76, 1], [72, 1], [74, 1], [72, 2],
];

export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const melodyBeats = (melody = MELODY) => melody.reduce((s, [, b]) => s + b, 0);
