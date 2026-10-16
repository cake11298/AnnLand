// 神秘密碼：「IloveU」的 16 進位
export const SECRET_HEX = '49-6c-6f-76-65-55';
export const CODE_GROUPS = 6;

export const normalizeCode = (input = '') => String(input).toLowerCase().replace(/[^0-9a-f]/g, '');

export function checkCode(input) {
  return normalizeCode(input) === normalizeCode(SECRET_HEX);
}

export function hexToText(hex) {
  const h = normalizeCode(hex);
  let out = '';
  for (let i = 0; i + 1 < h.length; i += 2) out += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  return out;
}
