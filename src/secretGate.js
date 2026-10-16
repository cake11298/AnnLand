import { checkCode, hexToText, CODE_GROUPS } from './game/secret.js';

const UNLOCK_KEY = 'annland.cityUnlocked';
const $ = (id) => document.getElementById(id);
const btn = $('secret-btn'), modal = $('secret'), box = $('code'), msg = $('secret-msg');
const goCity = () => { location.href = './city.html'; };
if (new URLSearchParams(location.search).has('lock')) {
  localStorage.removeItem(UNLOCK_KEY);
  history.replaceState(null, '', location.pathname);
}

const inputs = [];
for (let i = 0; i < CODE_GROUPS; i++) {
  if (i) box.appendChild(Object.assign(document.createElement('span'), { className: 'dash', textContent: '-' }));
  const el = Object.assign(document.createElement('input'), { maxLength: 2, autocomplete: 'off', spellcheck: false, inputMode: 'text', placeholder: '··' });
  el.setAttribute('aria-label', `第 ${i + 1} 組`);
  box.appendChild(el);
  inputs.push(el);
}
const clean = (v) => v.toLowerCase().replace(/[^0-9a-f]/g, '');
const fill = (hex, from = 0) => {
  for (let i = from; i < CODE_GROUPS && hex.length; i++) { inputs[i].value = hex.slice(0, 2); hex = hex.slice(2); }
  const next = inputs.find((el) => el.value.length < 2) ?? inputs[CODE_GROUPS - 1];
  next.focus();
};
inputs.forEach((el, i) => {
  el.addEventListener('input', () => {
    const v = clean(el.value);
    if (v.length > 2) { el.value = ''; fill(v, i); return; }
    el.value = v;
    if (v.length === 2 && i < CODE_GROUPS - 1) inputs[i + 1].focus();
  });
  el.addEventListener('paste', (e) => { e.preventDefault(); fill(clean(e.clipboardData.getData('text')), i); });
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Backspace' && !el.value && i > 0) inputs[i - 1].focus();
    if (e.key === 'ArrowLeft' && i > 0 && el.selectionStart === 0) inputs[i - 1].focus();
    if (e.key === 'ArrowRight' && i < CODE_GROUPS - 1 && el.selectionStart === el.value.length) inputs[i + 1].focus();
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') close();
  });
  el.addEventListener('keyup', (e) => e.stopPropagation());
});

function open() {
  if (localStorage.getItem(UNLOCK_KEY) === '1') { goCity(); return; }
  modal.classList.add('show');
  modal.classList.remove('ok', 'err');
  msg.textContent = '';
  setTimeout(() => (inputs.find((el) => el.value.length < 2) ?? inputs[0]).focus(), 60);
}
function close() { modal.classList.remove('show'); }
function submit() {
  const code = inputs.map((el) => el.value).join('-');
  if (checkCode(code)) {
    modal.classList.remove('err'); modal.classList.add('ok');
    msg.textContent = `${hexToText(code)} ♥ 城市地圖解鎖了`;
    localStorage.setItem(UNLOCK_KEY, '1');
    setTimeout(goCity, 1800);
  } else {
    modal.classList.remove('err'); void modal.offsetWidth; modal.classList.add('err');
    msg.textContent = inputs.some((el) => el.value.length < 2) ? '每一格都要填兩碼喔' : '密碼不對喔，再想想看';
  }
}
if (localStorage.getItem(UNLOCK_KEY) === '1') btn.textContent = '前往城市 →';
btn.addEventListener('click', open);
$('secret-ok').addEventListener('click', submit);
$('secret-cancel').addEventListener('click', close);
modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
