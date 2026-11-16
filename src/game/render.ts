import { ARMORS, BASES, BASE_R, CELL, COLS, H, MINES, ROWS, W, type Ent, type Game, type Team } from "./engine";

const TEAM = { red: { main: "#e8443a", dark: "#8f1f19", light: "#ff8a80" }, blue: { main: "#2f86e8", dark: "#164a8f", light: "#8cc4ff" } };
const SWORD_COL = ["#a8743a", "#d6dde4", "#5ff0f0"];
const ARMOR_COL = [null, "#c7cdd3", "#5ff0f0"];

let ground: HTMLCanvasElement | null = null;
function getGround() {
  if (ground) return ground;
  ground = document.createElement("canvas");
  ground.width = W; ground.height = H;
  const g = ground.getContext("2d")!;
  for (let cx = 0; cx < COLS; cx++) for (let cy = 0; cy < ROWS; cy++) {
    const left = cx < COLS / 2;
    const shade = (cx + cy) % 2 === 0 ? 0 : 8;
    const r = (left ? 96 : 82) + shade, gg = 150 + shade, b = (left ? 72 : 92) + shade;
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(cx * CELL, cy * CELL, CELL, CELL);
    if ((cx * 7 + cy * 13) % 11 === 0) { g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(cx * CELL + 10, cy * CELL + 14, 4, 8); }
  }
  // divider
  g.fillStyle = "rgba(255,255,255,0.55)";
  for (let y = 0; y < H; y += 30) g.fillRect(W / 2 - 3, y, 6, 18);
  for (const t of ["red", "blue"] as Team[]) {
    const b = BASES[t];
    g.fillStyle = t === "red" ? "rgba(232,68,58,0.22)" : "rgba(47,134,232,0.22)";
    g.beginPath(); g.arc(b.x, b.y, BASE_R, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6; g.strokeStyle = TEAM[t].main; g.setLineDash([14, 10]); g.stroke(); g.setLineDash([]);
  }
  for (const m of MINES) {
    g.fillStyle = "rgba(120,90,40,0.55)";
    g.beginPath(); g.arc(m.x, m.y, m.r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#ffd84a"; g.lineWidth = 3; g.stroke();
  }
  return ground;
}

export interface Cam { x: number; y: number; scale: number }

export function computeCam(game: Game, cw: number, ch: number): Cam {
  const scale = Math.max(0.55, Math.min(1.2, ch / 820, cw / 1100));
  const vw = cw / scale, vh = ch / scale;
  const p = game.player;
  const x = vw >= W ? (W - vw) / 2 : Math.max(0, Math.min(W - vw, p.x - vw / 2));
  const y = vh >= H ? (H - vh) / 2 : Math.max(0, Math.min(H - vh, p.y - vh / 2));
  return { x, y, scale };
}

export function render(ctx: CanvasRenderingContext2D, game: Game, cam: Cam, dpr: number, cw: number, ch: number, mouse: { x: number; y: number }, t: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#1d2a22"; ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, -cam.x * cam.scale * dpr, -cam.y * cam.scale * dpr);
  ctx.drawImage(getGround(), 0, 0);

  // mine sparkles
  for (const m of MINES) for (let i = 0; i < 5; i++) {
    const a = t * 1.3 + i * 1.256 + m.x;
    const s = (Math.sin(t * 4 + i) + 1) * 2 + 3;
    ctx.fillStyle = "#ffd84a";
    ctx.fillRect(m.x + Math.cos(a) * m.r * 0.55 - s / 2, m.y + Math.sin(a) * m.r * 0.55 - s / 2, s, s);
  }
  for (const m of MINES) {
    ctx.fillStyle = "#e0a91e"; ctx.fillRect(m.x - 14, m.y - 10, 28, 20);
    ctx.fillStyle = "#ffe17a"; ctx.fillRect(m.x - 14, m.y - 10, 28, 6);
  }

  // blocks
  for (const b of game.blocks.values()) {
    const x = b.cx * CELL, y = b.cy * CELL;
    if (!b.team) {
      ctx.fillStyle = "#6f6a66"; ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = "#8d8781"; ctx.fillRect(x + 3, y + 3, CELL - 6, CELL / 2 - 4);
      ctx.fillStyle = "#4f4b48"; ctx.fillRect(x, y + CELL - 5, CELL, 5);
    } else {
      const c = TEAM[b.team];
      ctx.fillStyle = c.dark; ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = c.main; ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 9);
      ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(x + 3, y + 3, CELL - 6, 5);
      if (b.hp < 60) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x + 10, y + 12, 3, 16); ctx.fillRect(x + 22, y + 8, 3, 12); }
    }
  }

  // flags
  for (const t2 of ["red", "blue"] as Team[]) {
    const f = game.flags[t2];
    if (f.carrier !== null) continue;
    drawFlag(ctx, f.x, f.y, t2, t, 1.4);
    if (!f.home) {
      ctx.fillStyle = "#fff"; ctx.font = "bold 12px Nunito, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(Math.ceil(f.dropT) + "s", f.x, f.y + 22);
    }
  }

  // entities
  const sorted = [...game.ents].sort((a, b) => a.y - b.y);
  for (const e of sorted) if (e.alive) drawEnt(ctx, e, t);

  // particles
  for (const p of game.particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  for (const tx of game.texts) {
    ctx.globalAlpha = Math.min(1, tx.life * 2);
    ctx.font = "bold 15px 'Lilita One', sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillText(tx.text, tx.x + 1, tx.y + 1);
    ctx.fillStyle = tx.color; ctx.fillText(tx.text, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;

  // placement ghost
  const p = game.player;
  if (p.alive && p.blocks > 0) {
    const cx = Math.floor(mouse.x / CELL), cy = Math.floor(mouse.y / CELL);
    const inRange = Math.hypot(p.x - mouse.x, p.y - mouse.y) <= 140 && !game.blockAt(cx, cy);
    ctx.strokeStyle = inRange ? "rgba(255,255,255,0.7)" : "rgba(255,80,80,0.4)";
    ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.strokeRect(cx * CELL + 2, cy * CELL + 2, CELL - 4, CELL - 4); ctx.setLineDash([]);
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, team: Team, t: number, s: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(0, 4, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3b2b1c"; ctx.fillRect(-2, -30, 4, 34);
  const wave = Math.sin(t * 6) * 3;
  ctx.fillStyle = TEAM[team].main;
  ctx.beginPath(); ctx.moveTo(2, -30); ctx.lineTo(24, -25 + wave); ctx.lineTo(2, -16); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawEnt(ctx: CanvasRenderingContext2D, e: Ent, t: number) {
  const c = TEAM[e.team];
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(e.x, e.y + 14, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
  // sword
  const sw = e.swingT > 0 ? (1 - e.swingT / 0.18) * 2.1 - 1.05 : -0.7;
  const sa = e.angle + sw;
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(sa);
  ctx.fillStyle = "#4a3320"; ctx.fillRect(12, -3, 10, 6);
  ctx.fillStyle = SWORD_COL[e.sword]!; ctx.fillRect(20, -3.5, 30 + e.sword * 4, 7);
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(20, -3.5, 30 + e.sword * 4, 2);
  ctx.restore();
  if (e.swingT > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${e.swingT * 3})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(e.x, e.y, 50, e.angle - 1.05, e.angle + sw); ctx.stroke();
  }
  // body
  const bob = Math.sin(t * 10 + e.id) * 1;
  const armor = ARMOR_COL[e.armor];
  ctx.fillStyle = e.hitFlash > 0 ? "#ffffff" : armor ?? c.dark;
  ctx.fillRect(e.x - 16, e.y - 16 + bob, 32, 32);
  ctx.fillStyle = e.hitFlash > 0 ? "#ffffff" : c.main;
  ctx.fillRect(e.x - 13, e.y - 13 + bob, 26, 26);
  // face/eyes toward angle
  const ex = Math.cos(e.angle) * 5, ey = Math.sin(e.angle) * 5;
  ctx.fillStyle = "#f6d2b0"; ctx.fillRect(e.x - 9 + ex, e.y - 9 + ey + bob, 18, 14);
  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(e.x - 6 + ex * 1.3, e.y - 5 + ey * 1.3 + bob, 4, 5);
  ctx.fillRect(e.x + 2 + ex * 1.3, e.y - 5 + ey * 1.3 + bob, 4, 5);
  if (e.carrying) drawFlag(ctx, e.x + 8, e.y - 18, e.carrying, t, 0.9);
  // hp bar + name
  const w = 40;
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(e.x - w / 2 - 1, e.y - 33, w + 2, 7);
  ctx.fillStyle = e.hp > 50 ? "#5ee06a" : e.hp > 25 ? "#f2c23a" : "#ef4a3c";
  ctx.fillRect(e.x - w / 2, e.y - 32, (w * e.hp) / 100, 5);
  ctx.font = "12px 'Lilita One', sans-serif"; ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillText(e.name, e.x + 1, e.y - 37);
  ctx.fillStyle = e.isPlayer ? "#ffd84a" : c.light; ctx.fillText(e.name, e.x, e.y - 38);
}
