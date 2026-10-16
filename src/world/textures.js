import * as THREE from 'three';

export const FONT_EN = 'Fredoka, "Noto Sans TC", sans-serif';
export const FONT_TC = '"Noto Sans TC", Fredoka, sans-serif';

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function textTexture({ w = 1024, h = 256, bg = null, radius = 48, border = null, lines = [] }) {
  return canvasTexture(w, h, (g) => {
    if (bg) {
      g.fillStyle = bg;
      g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, radius); g.fill();
      if (border) { g.lineWidth = 10; g.setLineDash([26, 18]); g.strokeStyle = border; g.beginPath(); g.roundRect(30, 30, w - 60, h - 60, radius * 0.7); g.stroke(); g.setLineDash([]); }
    }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (const l of lines) {
      g.font = `${l.weight ?? 700} ${l.size}px ${l.font ?? FONT_EN}`;
      if (l.stroke) { g.lineWidth = l.strokeWidth ?? 14; g.strokeStyle = l.stroke; g.strokeText(l.text, w / 2, l.y * h); }
      g.fillStyle = l.color ?? '#fff';
      g.fillText(l.text, w / 2, l.y * h);
    }
  });
}

let glow;
export function glowTexture() {
  return (glow ??= canvasTexture(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }));
}

export function stripeTexture(colors, count = 16, w = 512, h = 64) {
  return canvasTexture(w, h, (g) => {
    const sw = w / count;
    for (let i = 0; i < count; i++) { g.fillStyle = colors[i % colors.length]; g.fillRect(i * sw, 0, sw + 1, h); }
  });
}

export function swirlTexture(base, swirl) {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = base; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
    g.strokeStyle = swirl; g.lineWidth = 20; g.lineCap = 'round';
    for (const off of [0, Math.PI]) {
      g.beginPath();
      for (let t = 0; t < Math.PI * 6; t += 0.05) {
        const r = (t / (Math.PI * 6)) * 118;
        g.lineTo(128 + Math.cos(t + off) * r, 128 + Math.sin(t + off) * r);
      }
      g.stroke();
    }
  });
}
