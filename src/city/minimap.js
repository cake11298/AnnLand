import { blocks, BLOCK_HALF, WATER_Z, PIER } from '../game/cityLayout.js';

const WX0 = -240, WZ0 = -240, W = 480, H = 440, PPU = 1.25;

export class Minimap {
  constructor(canvas, zoom = 0.85) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.zoom = zoom;
    this.base = this.bake();
    this.resize();
  }
  resize() {
    const s = this.c.clientWidth || 160;
    this.dpr = Math.min(devicePixelRatio, 2);
    this.c.width = this.c.height = Math.round(s * this.dpr);
    this.S = this.c.width;
  }
  bake() {
    const c = document.createElement('canvas');
    c.width = W * PPU; c.height = H * PPU;
    const g = c.getContext('2d');
    g.scale(PPU, PPU); g.translate(-WX0, -WZ0);
    g.fillStyle = '#2a2e38'; g.fillRect(WX0, WZ0, W, H);
    g.fillStyle = '#6b7182'; g.fillRect(-199, -199, 398, 302);
    for (const b of blocks()) {
      g.fillStyle = b.special === 'park' ? '#5f9c5e' : ['cityhall', 'square', 'tower', 'union'].includes(b.special) ? '#8d8899' : '#3a3f4d';
      g.fillRect(b.cx - BLOCK_HALF, b.cz - BLOCK_HALF, BLOCK_HALF * 2, BLOCK_HALF * 2);
    }
    g.fillStyle = '#a8916c'; g.fillRect(-215, 103, 430, WATER_Z - 103);
    g.fillStyle = '#3b7fb0'; g.fillRect(WX0, WATER_Z, W, H);
    g.fillStyle = '#a8916c'; g.fillRect(PIER.x0, PIER.z0, PIER.x1 - PIER.x0, PIER.z1 - PIER.z0);
    g.fillStyle = '#d6262f'; g.fillRect(-199, -1, 398, 2);
    return c;
  }
  draw(px, pz, yaw, facing, spots, done, streetcars) {
    const g = this.g, S = this.S, R = S / 2, d = this.dpr, k = this.zoom * d;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(R, R, R - d, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#2a2e38'; g.fillRect(0, 0, S, S);
    g.translate(R, R); g.rotate(yaw); g.scale(k / PPU, k / PPU);
    g.translate(-(px - WX0) * PPU, -(pz - WZ0) * PPU);
    g.drawImage(this.base, 0, 0);
    g.restore();
    const cos = Math.cos(yaw), sin = Math.sin(yaw), max = R - 11 * d;
    const put = (wx, wz, clamp) => {
      const dx = wx - px, dz = wz - pz;
      let x = (dx * cos - dz * sin) * k, y = (dx * sin + dz * cos) * k;
      const l = Math.hypot(x, y);
      if (clamp && l > max) { x *= max / l; y *= max / l; }
      return [R + x, R + y, l <= max];
    };
    for (const sc of streetcars) {
      const [x, y, inside] = put(sc.s, sc.lane, false);
      if (!inside) continue;
      g.fillStyle = '#ff4d55'; g.beginPath(); g.arc(x, y, 3 * d, 0, Math.PI * 2); g.fill();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const s of spots) {
      const [x, y] = put(s.x, s.z, true);
      const ok = done.includes(s.id);
      g.fillStyle = ok ? '#97e0c0' : '#e8507e';
      g.strokeStyle = '#fff'; g.lineWidth = 2 * d;
      g.beginPath(); g.arc(x, y, 7.5 * d, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = ok ? '#2a4a3c' : '#fff'; g.font = `700 ${9 * d}px Fredoka, sans-serif`;
      g.fillText(ok ? '✓' : s.icon, x, y + 0.5 * d);
    }
    const [nx, ny] = put(px, pz - 1e5, true);
    g.fillStyle = '#fff'; g.font = `700 ${11 * d}px Fredoka, sans-serif`; g.fillText('N', nx, ny);
    g.save();
    g.translate(R, R); g.rotate(yaw + Math.PI - facing);
    g.beginPath(); g.moveTo(0, -9 * d); g.lineTo(6.5 * d, 7 * d); g.lineTo(0, 3.5 * d); g.lineTo(-6.5 * d, 7 * d); g.closePath();
    g.fillStyle = '#ffd65c'; g.strokeStyle = '#4a2a45'; g.lineWidth = 2 * d; g.fill(); g.stroke();
    g.restore();
    g.beginPath(); g.arc(R, R, R - d * 1.5, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255,248,241,.9)'; g.lineWidth = 3 * d; g.stroke();
  }
}
