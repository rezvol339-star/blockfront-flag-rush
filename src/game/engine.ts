// Pure game simulation: no React, no DOM.
export type Team = "red" | "blue";
export const W = 2000, H = 1000, CELL = 40;
export const COLS = W / CELL, ROWS = H / CELL;
export const WIN_SCORE = 3;
export const ROUND_TIME = 300;
export const SPEED = 230, RADIUS = 16, MAX_HP = 100, RESPAWN = 3;
export const SWING_CD = 0.42, BOT_SWING_CD = 0.6, REACH = 64, ARC = 1.05;
export const BASE_R = 120, FLAG_RETURN = 10, CARRY_SLOW = 0.85;
export const BLOCK_HP = 60, PLACE_RANGE = 140;

export const SWORDS = [
  { name: "Wooden Sword", dmg: 18, cost: 0 },
  { name: "Iron Sword", dmg: 28, cost: 25 },
  { name: "Diamond Sword", dmg: 40, cost: 60 },
];
export const ARMORS = [
  { name: "No Armor", reduce: 0, cost: 0 },
  { name: "Iron Armor", reduce: 0.25, cost: 30 },
  { name: "Diamond Armor", reduce: 0.45, cost: 70 },
];
export const BLOCK_PACK = { count: 6, cost: 10 };
export const POTION = { heal: 50, cost: 8 };

export const BASES: Record<Team, { x: number; y: number }> = {
  red: { x: 150, y: 500 },
  blue: { x: W - 150, y: 500 },
};
export const MINES = [
  { x: 1000, y: 170, r: 70, rate: 6 },
  { x: 1000, y: 830, r: 70, rate: 6 },
  { x: 560, y: 500, r: 60, rate: 3 },
  { x: 1440, y: 500, r: 60, rate: 3 },
];

export interface Ent {
  id: number; name: string; team: Team; isPlayer: boolean;
  role: "attacker" | "defender" | "collector";
  x: number; y: number; kbx: number; kby: number; angle: number;
  hp: number; alive: boolean; respawn: number;
  swingT: number; swingCd: number; hitFlash: number;
  gold: number; goldAcc: number; sword: number; armor: number; blocks: number;
  carrying: Team | null; kills: number;
  avoid: number; avoidT: number;
}
export interface Block { cx: number; cy: number; hp: number; team: Team | null }
export interface Flag { team: Team; x: number; y: number; home: boolean; carrier: number | null; dropT: number }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
export interface FloatText { x: number; y: number; text: string; life: number; color: string }
export interface Input { dx: number; dy: number; aimX: number; aimY: number; attack: boolean }

export const other = (t: Team): Team => (t === "red" ? "blue" : "red");
const k = (cx: number, cy: number) => cx + "," + cy;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const angDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

const WALLS_LEFT: [number, number[]][] = [
  [8, [6, 7, 8, 9, 15, 16, 17, 18]],
  [14, [2, 3, 4, 20, 21, 22]],
  [19, [9, 10, 11, 13, 14, 15]],
  [24, [12]],
];

const NAMES = { red: ["You", "Ruby", "Blaze"], blue: ["Frost", "Cobalt", "Azure"] };

export class Game {
  ents: Ent[] = [];
  blocks = new Map<string, Block>();
  flags!: Record<Team, Flag>;
  score: Record<Team, number> = { red: 0, blue: 0 };
  time = ROUND_TIME;
  particles: Particle[] = [];
  texts: FloatText[] = [];
  feed: { text: string; t: number; team: Team }[] = [];
  over = false; winner: Team | "draw" | null = null;
  private nextId = 1;

  constructor() { this.reset(); }

  reset() {
    this.blocks.clear();
    for (const [cx, rows] of WALLS_LEFT) for (const cy of rows) {
      this.blocks.set(k(cx, cy), { cx, cy, hp: Infinity, team: null });
      const mx = COLS - 1 - cx;
      this.blocks.set(k(mx, cy), { cx: mx, cy, hp: Infinity, team: null });
    }
    this.flags = {
      red: { team: "red", ...BASES.red, home: true, carrier: null, dropT: 0 },
      blue: { team: "blue", ...BASES.blue, home: true, carrier: null, dropT: 0 },
    };
    this.score = { red: 0, blue: 0 };
    this.time = ROUND_TIME; this.over = false; this.winner = null;
    this.particles = []; this.texts = []; this.feed = [];
    this.ents = [];
    const roles: Ent["role"][] = ["attacker", "defender", "collector"];
    (["red", "blue"] as Team[]).forEach((team) => {
      for (let i = 0; i < 3; i++) this.ents.push(this.makeEnt(team, NAMES[team][i]!, team === "red" && i === 0, roles[i]!, i));
    });
  }

  private makeEnt(team: Team, name: string, isPlayer: boolean, role: Ent["role"], i: number): Ent {
    const b = BASES[team];
    return {
      id: this.nextId++, name, team, isPlayer, role,
      x: b.x + (team === "red" ? 40 : -40), y: b.y + (i - 1) * 50, kbx: 0, kby: 0,
      angle: team === "red" ? 0 : Math.PI, hp: MAX_HP, alive: true, respawn: 0,
      swingT: 0, swingCd: 0, hitFlash: 0, gold: 0, goldAcc: 0, sword: 0, armor: 0, blocks: 3,
      carrying: null, kills: 0, avoid: 1, avoidT: 0,
    };
  }

  get player() { return this.ents.find((e) => e.isPlayer)!; }

  blockAt(cx: number, cy: number) { return this.blocks.get(k(cx, cy)); }

  collides(x: number, y: number, r: number) {
    if (x < r || y < r || x > W - r || y > H - r) return true;
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) {
        if (!this.blocks.has(k(cx, cy))) continue;
        const nx = Math.max(cx * CELL, Math.min(x, cx * CELL + CELL));
        const ny = Math.max(cy * CELL, Math.min(y, cy * CELL + CELL));
        if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
      }
    return false;
  }

  private moveEnt(e: Ent, vx: number, vy: number, dt: number) {
    const nx = e.x + vx * dt;
    if (!this.collides(nx, e.y, RADIUS)) e.x = nx;
    const ny = e.y + vy * dt;
    if (!this.collides(e.x, ny, RADIUS)) e.y = ny;
  }

  // ---- shop ----
  buy(e: Ent, item: "sword" | "armor" | "blocks" | "potion"): boolean {
    if (item === "sword") {
      const n = SWORDS[e.sword + 1]; if (!n || e.gold < n.cost) return false;
      e.gold -= n.cost; e.sword++;
    } else if (item === "armor") {
      const n = ARMORS[e.armor + 1]; if (!n || e.gold < n.cost) return false;
      e.gold -= n.cost; e.armor++;
    } else if (item === "blocks") {
      if (e.gold < BLOCK_PACK.cost) return false;
      e.gold -= BLOCK_PACK.cost; e.blocks += BLOCK_PACK.count;
    } else {
      if (e.gold < POTION.cost || e.hp >= MAX_HP || !e.alive) return false;
      e.gold -= POTION.cost; e.hp = Math.min(MAX_HP, e.hp + POTION.heal);
    }
    if (e.isPlayer) this.text(e.x, e.y - 30, "Purchased!", "#ffd84a");
    return true;
  }

  placeBlock(e: Ent, wx: number, wy: number): boolean {
    if (!e.alive || e.blocks <= 0) return false;
    if (dist(e.x, e.y, wx, wy) > PLACE_RANGE) return false;
    const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS || this.blocks.has(k(cx, cy))) return false;
    const ccx = cx * CELL + CELL / 2, ccy = cy * CELL + CELL / 2;
    for (const t of ["red", "blue"] as Team[]) if (dist(ccx, ccy, BASES[t].x, BASES[t].y) < BASE_R + 20) return false;
    for (const o of this.ents) if (o.alive && Math.abs(o.x - ccx) < CELL / 2 + RADIUS && Math.abs(o.y - ccy) < CELL / 2 + RADIUS) return false;
    this.blocks.set(k(cx, cy), { cx, cy, hp: BLOCK_HP, team: e.team });
    e.blocks--;
    return true;
  }

  // ---- combat ----
  damage(t: Ent, raw: number, from: Ent) {
    if (!t.alive) return;
    const dmg = raw * (1 - ARMORS[t.armor]!.reduce);
    t.hp -= dmg; t.hitFlash = 0.15;
    const a = Math.atan2(t.y - from.y, t.x - from.x);
    t.kbx += Math.cos(a) * 380; t.kby += Math.sin(a) * 380;
    this.burst(t.x, t.y, t.team === "red" ? "#ff5a4e" : "#4aa8ff", 6);
    this.text(t.x, t.y - 28, "-" + Math.round(dmg), "#ffffff");
    if (t.hp <= 0) this.kill(t, from);
  }

  kill(t: Ent, by: Ent | null) {
    t.alive = false; t.hp = 0; t.respawn = RESPAWN;
    if (t.carrying) {
      const f = this.flags[t.carrying];
      f.carrier = null; f.x = t.x; f.y = t.y; f.dropT = FLAG_RETURN; t.carrying = null;
    }
    this.burst(t.x, t.y, "#ffffff", 16);
    if (by) {
      by.gold += 5; by.kills++;
      this.log(`${by.name} eliminated ${t.name}`, by.team);
    }
  }

  private swing(e: Ent) {
    e.swingCd = e.isPlayer ? SWING_CD : BOT_SWING_CD; e.swingT = 0.18;
    const dmg = SWORDS[e.sword]!.dmg;
    for (const o of this.ents) {
      if (!o.alive || o.team === e.team) continue;
      const d = dist(e.x, e.y, o.x, o.y);
      if (d < REACH + RADIUS && (d < RADIUS * 2 || angDiff(Math.atan2(o.y - e.y, o.x - e.x), e.angle) < ARC)) this.damage(o, dmg, e);
    }
    const px = e.x + Math.cos(e.angle) * 40, py = e.y + Math.sin(e.angle) * 40;
    const b = this.blockAt(Math.floor(px / CELL), Math.floor(py / CELL));
    if (b && b.team && b.hp !== Infinity) {
      b.hp -= dmg;
      this.burst(px, py, "#c9b28a", 4);
      if (b.hp <= 0) this.blocks.delete(k(b.cx, b.cy));
    }
  }

  // ---- fx ----
  burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.3, color, size: 3 + Math.random() * 3 });
    }
  }
  text(x: number, y: number, text: string, color: string) { this.texts.push({ x, y, text, life: 0.9, color }); }
  log(text: string, team: Team) { this.feed.unshift({ text, t: 5, team }); this.feed.length = Math.min(this.feed.length, 5); }

  // ---- main step ----
  step(dt: number, input: Input) {
    if (this.over) { this.tickFx(dt); return; }
    this.time -= dt;
    for (const e of this.ents) {
      if (!e.alive) {
        e.respawn -= dt;
        if (e.respawn <= 0) {
          const b = BASES[e.team];
          e.alive = true; e.hp = MAX_HP; e.x = b.x; e.y = b.y + (Math.random() - 0.5) * 80; e.kbx = e.kby = 0;
        }
        continue;
      }
      e.swingCd -= dt; e.swingT -= dt; e.hitFlash -= dt;
      let dx = 0, dy = 0, attack = false;
      if (e.isPlayer) {
        dx = input.dx; dy = input.dy; attack = input.attack;
        e.angle = Math.atan2(input.aimY - e.y, input.aimX - e.x);
      } else [dx, dy, attack] = this.think(e, dt);
      const len = Math.hypot(dx, dy);
      if (len > 0) { dx /= len; dy /= len; }
      const sp = SPEED * (e.carrying ? CARRY_SLOW : 1) * (e.isPlayer ? 1 : 0.92);
      this.moveEnt(e, dx * sp + e.kbx, dy * sp + e.kby, dt);
      const damp = Math.exp(-10 * dt); e.kbx *= damp; e.kby *= damp;
      if (attack && e.swingCd <= 0) this.swing(e);
      // gold
      let rate = 1;
      for (const m of MINES) if (dist(e.x, e.y, m.x, m.y) < m.r) rate += m.rate;
      e.goldAcc += rate * dt;
      while (e.goldAcc >= 1) {
        e.goldAcc -= 1; e.gold++;
        if (e.isPlayer && rate > 1) this.text(e.x + (Math.random() - 0.5) * 20, e.y - 24, "+1", "#ffd84a");
      }
    }
    this.updateFlags(dt);
    if (this.time <= 0 && !this.over) {
      this.over = true;
      this.winner = this.score.red === this.score.blue ? "draw" : this.score.red > this.score.blue ? "red" : "blue";
    }
    this.tickFx(dt);
  }

  updateFlags(dt: number) {
    for (const t of ["red", "blue"] as Team[]) {
      const f = this.flags[t];
      if (f.carrier !== null) {
        const c = this.ents.find((e) => e.id === f.carrier)!;
        f.x = c.x; f.y = c.y;
        const home = BASES[c.team];
        if (dist(c.x, c.y, home.x, home.y) < BASE_R * 0.6) {
          this.score[c.team]++; c.gold += 15; c.carrying = null;
          f.carrier = null; f.home = true; f.x = BASES[t].x; f.y = BASES[t].y;
          this.log(`${c.name} CAPTURED the ${t} flag!`, c.team);
          this.burst(c.x, c.y, "#ffd84a", 30);
          if (this.score[c.team] >= WIN_SCORE) { this.over = true; this.winner = c.team; }
        }
        continue;
      }
      if (!f.home) {
        f.dropT -= dt;
        if (f.dropT <= 0) { this.returnFlag(f); continue; }
      }
      for (const e of this.ents) {
        if (!e.alive || dist(e.x, e.y, f.x, f.y) > 30) continue;
        if (e.team === t) { if (!f.home) { this.returnFlag(f); this.log(`${e.name} returned the ${t} flag`, e.team); } }
        else if (!e.carrying) {
          f.carrier = e.id; f.home = false; e.carrying = t;
          this.log(`${e.name} took the ${t} flag!`, e.team);
          break;
        }
      }
    }
  }
  private returnFlag(f: Flag) { f.home = true; f.carrier = null; f.x = BASES[f.team].x; f.y = BASES[f.team].y; }

  tickFx(dt: number) {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) { t.y -= 40 * dt; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const f of this.feed) f.t -= dt;
    this.feed = this.feed.filter((f) => f.t > 0);
  }

  // ---- bot AI ----
  private think(b: Ent, dt: number): [number, number, boolean] {
    if (b.sword < 2 && b.gold >= SWORDS[b.sword + 1]!.cost) this.buy(b, "sword");
    else if (b.armor < 2 && b.gold >= ARMORS[b.armor + 1]!.cost) this.buy(b, "armor");
    if (b.hp < 40 && b.gold >= POTION.cost + 10) this.buy(b, "potion");

    const myFlag = this.flags[b.team], enFlag = this.flags[other(b.team)];
    const base = BASES[b.team];
    let near: Ent | null = null, nd = Infinity;
    for (const o of this.ents) if (o.alive && o.team !== b.team) {
      const d = dist(b.x, b.y, o.x, o.y); if (d < nd) { nd = d; near = o; }
    }
    let gx = b.x, gy = b.y, target: Ent | null = null;
    const thief = myFlag.carrier !== null ? this.ents.find((e) => e.id === myFlag.carrier)! : null;
    const geared = b.sword >= 2 && b.armor >= 1;
    const role = b.role === "collector" && geared ? "attacker" : b.role;
    if (b.carrying) { gx = base.x; gy = base.y; if (near && nd < 70) target = near; }
    else if (thief && (role !== "collector" || dist(b.x, b.y, thief.x, thief.y) < 500)) { target = thief; gx = thief.x; gy = thief.y; }
    else if (near && nd < (role === "defender" ? 320 : 230)) { target = near; gx = near.x; gy = near.y; }
    else if (role === "attacker") {
      if (enFlag.carrier !== null) { const c = this.ents.find((e) => e.id === enFlag.carrier)!; gx = c.x + 30; gy = c.y; }
      else { gx = enFlag.x; gy = enFlag.y; }
    } else if (role === "defender") {
      if (!myFlag.home) { gx = myFlag.x; gy = myFlag.y; }
      else { gx = base.x + (b.team === "red" ? 160 : -160); gy = base.y + Math.sin(this.time * 0.7) * 120; }
    } else {
      const mines = MINES.filter((m) => (b.team === "red" ? m.x <= 1000 : m.x >= 1000));
      const m = mines.reduce((a, c) => (dist(b.x, b.y, c.x, c.y) + (c.rate > 3 ? -150 : 0) < dist(b.x, b.y, a.x, a.y) + (a.rate > 3 ? -150 : 0) ? c : a));
      gx = m.x + Math.sin(this.time + b.id) * 30; gy = m.y + Math.cos(this.time + b.id) * 30;
    }
    let dx = gx - b.x, dy = gy - b.y;
    const d = Math.hypot(dx, dy);
    let attack = false;
    if (target) {
      const td = dist(b.x, b.y, target.x, target.y);
      b.angle = Math.atan2(target.y - b.y, target.x - b.x);
      if (td < REACH + 6) attack = true;
      if (td < 34) { dx = 0; dy = 0; }
    }
    if (d < 8) return [0, 0, attack];
    let a = Math.atan2(dy, dx);
    if (!target) b.angle = a;
    // obstacle avoidance
    b.avoidT -= dt;
    const free = (ang: number) => !this.collides(b.x + Math.cos(ang) * 22, b.y + Math.sin(ang) * 22, RADIUS);
    if (!free(a)) {
      const ahead = this.blockAt(Math.floor((b.x + Math.cos(a) * 36) / CELL), Math.floor((b.y + Math.sin(a) * 36) / CELL));
      if (ahead && ahead.team && ahead.team !== b.team) { b.angle = a; return [0, 0, true]; }
      if (b.avoidT <= 0) { b.avoid = Math.random() < 0.5 ? 1 : -1; b.avoidT = 0.8; }
      for (const off of [0.6, 1.2, 1.8, 2.4]) {
        if (free(a + off * b.avoid)) { a += off * b.avoid; break; }
        if (free(a - off * b.avoid)) { a -= off * b.avoid; break; }
      }
    }
    return [Math.cos(a), Math.sin(a), attack];
  }
}
