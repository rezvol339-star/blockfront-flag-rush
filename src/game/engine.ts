// Pure game simulation: no React, no DOM.
export type Team = "red" | "blue";
export const W = 2000, H = 1000, CELL = 40;
export const COLS = W / CELL, ROWS = H / CELL;
export const WIN_SCORE = 3;
export const ROUND_TIME = 300;
export const SPEED = 230, RADIUS = 16, MAX_HP = 100, RESPAWN = 3;
export const SWING_CD = 0.42, BOT_SWING_CD = 0.6, REACH = 140, ARC = 1.15;
export const BASE_R = 120, FLAG_RETURN = 10, CARRY_SLOW = 0.85;
export const BLOCK_HP = 60, PLACE_RANGE = 140;
// vertical physics (sim px, 40px = 1 block)
export const GRAVITY = 1500, JUMP_V = 470, SPRINT = 1.35, AIR_DRAG = 1.5, GROUND_DRAG = 10;
export const TEAM_BLOCK_H = 44, WALL_H = 80;
export const CRIT_MULT = 1.75;
/** Bunny-hop: each chained jump while moving adds BHOP_STEP to speed, capped at BHOP_MAX (x sprint). */
export const BHOP_STEP = 0.06, BHOP_MAX = 1.35, BHOP_DECAY = 3, KNOCKBACK = 460;
// fireballs
export const FB_SPEED = 620, FB_RADIUS = 110, FB_DMG = 16, FB_KB = 650, FB_LIFT = 820, FB_CD = 0.5, FB_LIFE = 2.5;

export const SWORDS = [
  { name: "Wooden Sword", dmg: 11, cost: 0 },
  { name: "Iron Sword", dmg: 15, cost: 25 },
  { name: "Diamond Sword", dmg: 20, cost: 60 },
];
export const ARMORS = [
  { name: "No Armor", reduce: 0, cost: 0 },
  { name: "Iron Armor", reduce: 0.25, cost: 30 },
  { name: "Diamond Armor", reduce: 0.45, cost: 70 },
];
export const BLOCK_PACK = { count: 6, cost: 10 };
export const POTION = { heal: 50, cost: 8 };
export const FIREBALL_PACK = { count: 2, cost: 12 };
// dynamite: lobbed, fuse then big blast that wrecks placed blocks
export const DYNAMITE_PACK = { count: 1, cost: 15 };
export const TNT_SPEED = 430, TNT_UP = 420, TNT_FUSE = 1.6, TNT_RADIUS = 170, TNT_DMG = 35, TNT_BLOCK_DMG = 200, TNT_KB = 900;
/** Hotbar slots, in order (keys 1-4). */
export const ITEMS = ["sword", "blocks", "fireball", "dynamite"] as const;
export type ItemSlot = (typeof ITEMS)[number];
export const PLACE_CD = 0.18, PLACE_DIST = 70;
export type ShopItem = "sword" | "armor" | "blocks" | "potion" | "fireball" | "dynamite";

export type Mode = "solo" | "duo" | "deathmatch" | "ranked" | "rankedSolo" | "training";
export const MODES: Record<Mode, { label: string; red: number; blue: number; flags: boolean; time: number; skill: number; botDmg: number; startGold: number; fireballs: number }> = {
  solo: { label: "Solo Duel", red: 1, blue: 1, flags: true, time: 180, skill: 1.1, botDmg: 1, startGold: 0, fireballs: 1 },
  ranked: { label: "Ranked 3v3", red: 3, blue: 3, flags: true, time: ROUND_TIME, skill: 1.3, botDmg: 1, startGold: 0, fireballs: 1 },
  training: { label: "Training Arena", red: 1, blue: 3, flags: false, time: Infinity, skill: 1.2, botDmg: 0.5, startGold: 250, fireballs: 6 },
  duo: { label: "2v2", red: 2, blue: 2, flags: true, time: ROUND_TIME, skill: 1.1, botDmg: 1, startGold: 0, fireballs: 1 },
  deathmatch: { label: "Team Deathmatch", red: 3, blue: 3, flags: false, time: ROUND_TIME, skill: 1.1, botDmg: 1, startGold: 0, fireballs: 2 },
  rankedSolo: { label: "Ranked Solo", red: 1, blue: 1, flags: true, time: 180, skill: 1.5, botDmg: 1, startGold: 0, fireballs: 1 },
};

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

export interface Body { x: number; y: number; z: number; vz: number; grounded: boolean }
export interface Ent extends Body {
  id: number; name: string; team: Team; isPlayer: boolean;
  role: "attacker" | "defender" | "collector" | "hunter";
  kbx: number; kby: number; angle: number;
  hp: number; alive: boolean; respawn: number;
  swingT: number; swingCd: number; hitFlash: number;
  gold: number; goldAcc: number; sword: number; armor: number; blocks: number; fireballs: number; fbCd: number; dynamite: number; useCd: number;
  carrying: Team | null; kills: number; bhop: number;
  avoid: number; avoidT: number; strafe: number; strafeT: number;
  aimCircle?: AimCircle | null;
}
export interface Block { cx: number; cy: number; hp: number; team: Team | null }
export interface Flag { team: Team; x: number; y: number; home: boolean; carrier: number | null; dropT: number }
export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: string; size: number }
export interface FloatText { x: number; y: number; text: string; life: number; color: string }
export interface Fireball { x: number; y: number; z: number; vx: number; vy: number; vz: number; owner: number; team: Team; life: number; kind?: "fire" | "tnt" }
export interface GameEvent { type: "swing" | "hit" | "crit" | "boom" | "jump" | "throw" | "capture" | "death"; x: number; y: number; player: boolean }
export interface Input { dx: number; dy: number; aimX: number; aimY: number; attack: boolean; jump?: boolean; sprint?: boolean; circle?: AimCircle | null }
/** Circle aim mode: a movable ground reticle. Enemies inside it (and within CIRCLE_REACH) are hit regardless of facing arc. */
export interface AimCircle { x: number; y: number; r: number }
export const CIRCLE_R = 55, CIRCLE_REACH = 190;

export const other = (t: Team): Team => (t === "red" ? "blue" : "red");
const k = (cx: number, cy: number) => cx + "," + cy;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const angDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

/** Gravity + landing for any body. Returns true if it jumped this step. */
export function stepVertical(b: Body, jump: boolean, dt: number, groundH: number): boolean {
  let jumped = false;
  if (jump && b.grounded) { b.vz = JUMP_V; b.grounded = false; jumped = true; }
  b.vz -= GRAVITY * dt;
  b.z += b.vz * dt;
  if (b.z <= groundH) { b.z = groundH; if (b.vz < 0) b.vz = 0; b.grounded = true; }
  else b.grounded = false;
  return jumped;
}
/** Jump crit: any attack made while airborne (rising or falling) after leaving the ground. */
export const isCrit = (b: Body) => !b.grounded && b.z > 2;

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
  fireballs: Fireball[] = [];
  events: GameEvent[] = [];
  feed: { text: string; t: number; team: Team }[] = [];
  over = false; winner: Team | "draw" | null = null;
  cfg: (typeof MODES)[Mode];
  private nextId = 1;

  constructor(public mode: Mode = "ranked") { this.cfg = MODES[mode]; this.reset(); }

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
    this.time = this.cfg.time; this.over = false; this.winner = null;
    this.particles = []; this.texts = []; this.feed = []; this.fireballs = []; this.events = [];
    this.ents = [];
    const roles: Ent["role"][] = this.cfg.flags ? ["attacker", "defender", "collector"] : ["hunter", "hunter", "hunter"];
    if (this.cfg.red === 1 && this.cfg.blue === 1) roles[0] = "attacker";
    (["red", "blue"] as Team[]).forEach((team) => {
      for (let i = 0; i < this.cfg[team]; i++) this.ents.push(this.makeEnt(team, NAMES[team][i]!, team === "red" && i === 0, team === "red" && i === 0 ? "attacker" : roles[i]!, i));
    });
  }

  private makeEnt(team: Team, name: string, isPlayer: boolean, role: Ent["role"], i: number): Ent {
    const b = BASES[team];
    return {
      id: this.nextId++, name, team, isPlayer, role,
      x: b.x + (team === "red" ? 40 : -40), y: b.y + (i - 1) * 50, z: 0, vz: 0, grounded: true, kbx: 0, kby: 0,
      angle: team === "red" ? 0 : Math.PI, hp: MAX_HP, alive: true, respawn: 0,
      swingT: 0, swingCd: 0, hitFlash: 0, bhop: 1, gold: isPlayer ? this.cfg.startGold : 0, goldAcc: 0, sword: 0, armor: 0, blocks: 3,
      fireballs: isPlayer ? this.cfg.fireballs : 0, fbCd: 0, dynamite: isPlayer ? 1 : 0, useCd: 0,
      carrying: null, kills: 0, avoid: 1, avoidT: 0, strafe: 1, strafeT: 0,
    };
  }

  get player() { return this.ents.find((e) => e.isPlayer)!; }

  blockAt(cx: number, cy: number) { return this.blocks.get(k(cx, cy)); }
  blockH(b: Block) { return b.team ? TEAM_BLOCK_H : WALL_H; }
  groundH(x: number, y: number) {
    const b = this.blockAt(Math.floor(x / CELL), Math.floor(y / CELL));
    return b ? this.blockH(b) : 0;
  }

  collides(x: number, y: number, r: number, z = 0) {
    if (x < r || y < r || x > W - r || y > H - r) return true;
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) {
        const b = this.blocks.get(k(cx, cy));
        if (!b || this.blockH(b) <= z + 2) continue;
        const nx = Math.max(cx * CELL, Math.min(x, cx * CELL + CELL));
        const ny = Math.max(cy * CELL, Math.min(y, cy * CELL + CELL));
        if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
      }
    return false;
  }

  private moveEnt(e: Ent, vx: number, vy: number, dt: number) {
    const nx = e.x + vx * dt;
    if (!this.collides(nx, e.y, RADIUS, e.z)) e.x = nx;
    const ny = e.y + vy * dt;
    if (!this.collides(e.x, ny, RADIUS, e.z)) e.y = ny;
  }

  // ---- shop ----
  buy(e: Ent, item: ShopItem): boolean {
    if (item === "sword") {
      const n = SWORDS[e.sword + 1]; if (!n || e.gold < n.cost) return false;
      e.gold -= n.cost; e.sword++;
    } else if (item === "armor") {
      const n = ARMORS[e.armor + 1]; if (!n || e.gold < n.cost) return false;
      e.gold -= n.cost; e.armor++;
    } else if (item === "blocks") {
      if (e.gold < BLOCK_PACK.cost) return false;
      e.gold -= BLOCK_PACK.cost; e.blocks += BLOCK_PACK.count;
    } else if (item === "fireball") {
      if (e.gold < FIREBALL_PACK.cost) return false;
      e.gold -= FIREBALL_PACK.cost; e.fireballs += FIREBALL_PACK.count;
    } else if (item === "dynamite") {
      if (e.gold < DYNAMITE_PACK.cost) return false;
      e.gold -= DYNAMITE_PACK.cost; e.dynamite += DYNAMITE_PACK.count;
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
    for (const o of this.ents) if (o.alive && o.z < TEAM_BLOCK_H && Math.abs(o.x - ccx) < CELL / 2 + RADIUS && Math.abs(o.y - ccy) < CELL / 2 + RADIUS) return false;
    this.blocks.set(k(cx, cy), { cx, cy, hp: BLOCK_HP, team: e.team });
    e.blocks--;
    return true;
  }

  /** look: downward angle in radians (positive = aim at the ground). */
  throwFireball(e: Ent, yaw: number, look: number): boolean {
    if (!e.alive || e.fireballs <= 0 || e.fbCd > 0) return false;
    const c = Math.cos(look);
    this.fireballs.push({
      x: e.x + Math.cos(yaw) * 18, y: e.y + Math.sin(yaw) * 18, z: e.z + 60,
      vx: Math.cos(yaw) * c * FB_SPEED, vy: Math.sin(yaw) * c * FB_SPEED, vz: -Math.sin(look) * FB_SPEED,
      owner: e.id, team: e.team, life: FB_LIFE,
    });
    e.fireballs--; e.fbCd = FB_CD;
    this.events.push({ type: "throw", x: e.x, y: e.y, player: e.isPlayer });
    return true;
  }

  throwDynamite(e: Ent, yaw: number): boolean {
    if (!e.alive || e.dynamite <= 0 || e.fbCd > 0) return false;
    this.fireballs.push({
      x: e.x + Math.cos(yaw) * 18, y: e.y + Math.sin(yaw) * 18, z: e.z + 60,
      vx: Math.cos(yaw) * TNT_SPEED, vy: Math.sin(yaw) * TNT_SPEED, vz: TNT_UP,
      owner: e.id, team: e.team, life: TNT_FUSE, kind: "tnt",
    });
    e.dynamite--; e.fbCd = FB_CD;
    this.events.push({ type: "throw", x: e.x, y: e.y, player: e.isPlayer });
    return true;
  }

  /** Use the item in a hotbar slot (sword swings are handled by Input.attack). */
  useItem(e: Ent, slot: ItemSlot, yaw: number): boolean {
    if (slot === "fireball") return this.throwFireball(e, yaw, -0.05);
    if (slot === "dynamite") return this.throwDynamite(e, yaw);
    if (slot === "blocks") {
      if (e.useCd > 0) return false;
      const ok = this.placeBlock(e, e.x + Math.cos(yaw) * PLACE_DIST, e.y + Math.sin(yaw) * PLACE_DIST);
      if (ok) e.useCd = PLACE_CD;
      return ok;
    }
    return false;
  }

  explode(fb: Fireball) {
    const tnt = fb.kind === "tnt";
    const R = tnt ? TNT_RADIUS : FB_RADIUS, KB = tnt ? TNT_KB : FB_KB, DMG = tnt ? TNT_DMG : FB_DMG, BD = tnt ? TNT_BLOCK_DMG : 40;
    const owner = this.ents.find((e) => e.id === fb.owner) ?? null;
    this.burst(fb.x, fb.y, "#ff8a2a", tnt ? 40 : 22, fb.z); if (tnt) this.burst(fb.x, fb.y, "#555555", 16, fb.z); this.burst(fb.x, fb.y, "#ffe066", 10, fb.z);
    this.events.push({ type: "boom", x: fb.x, y: fb.y, player: !!owner?.isPlayer });
    for (const e of this.ents) {
      if (!e.alive) continue;
      const hx = e.x - fb.x, hy = e.y - fb.y, hz = e.z + 30 - fb.z;
      const d = Math.hypot(hx, hy, hz);
      if (d >= R) continue;
      const f = 1 - d / R, hl = Math.hypot(hx, hy);
      if (hl > 0.001) { e.kbx += (hx / hl) * KB * f; e.kby += (hy / hl) * KB * f; }
      e.vz = Math.max(e.vz, FB_LIFT * Math.sqrt(f)); e.grounded = false;
      if (owner && e.team !== fb.team) this.damage(e, DMG * f + 6, owner);
    }
    for (const b of [...this.blocks.values()]) {
      if (!b.team) continue;
      if (dist(b.cx * CELL + CELL / 2, b.cy * CELL + CELL / 2, fb.x, fb.y) < R * 0.8) { b.hp -= BD; if (b.hp <= 0) this.blocks.delete(k(b.cx, b.cy)); }
    }
  }

  private stepFireballs(dt: number) {
    const keep: Fireball[] = [];
    for (const fb of this.fireballs) {
      if (fb.kind === "tnt") {
        fb.vz -= GRAVITY * dt;
        const nx = fb.x + fb.vx * dt, ny = fb.y + fb.vy * dt;
        if (this.collides(nx, fb.y, 6, fb.z)) fb.vx *= -0.4; else fb.x = nx;
        if (this.collides(fb.x, ny, 6, fb.z)) fb.vy *= -0.4; else fb.y = ny;
        fb.z += fb.vz * dt; fb.life -= dt;
        const gh = this.groundH(fb.x, fb.y);
        if (fb.z <= gh) { fb.z = gh; fb.vz = Math.abs(fb.vz) > 120 ? -fb.vz * 0.3 : 0; fb.vx *= 0.6; fb.vy *= 0.6; }
        if (fb.life <= 0) this.explode(fb); else keep.push(fb);
        continue;
      }
      fb.vz -= 300 * dt;
      fb.x += fb.vx * dt; fb.y += fb.vy * dt; fb.z += fb.vz * dt; fb.life -= dt;
      let hit = fb.life <= 0 || fb.z <= this.groundH(fb.x, fb.y) || this.collides(fb.x, fb.y, 6, fb.z);
      if (!hit) for (const e of this.ents) {
        if (e.alive && e.team !== fb.team && dist(e.x, e.y, fb.x, fb.y) < RADIUS + 10 && fb.z > e.z - 5 && fb.z < e.z + 85) { hit = true; break; }
      }
      if (hit) this.explode(fb); else keep.push(fb);
    }
    this.fireballs = keep;
  }

  // ---- combat ----
  damage(t: Ent, raw: number, from: Ent, crit = false) {
    if (!t.alive) return;
    if (t.isPlayer && !from.isPlayer) raw *= this.cfg.botDmg;
    const dmg = raw * (1 - ARMORS[t.armor]!.reduce);
    t.hp -= dmg; t.hitFlash = 0.22;
    const a = Math.atan2(t.y - from.y, t.x - from.x);
    const kb = KNOCKBACK * (crit ? 1.3 : 1); t.kbx += Math.cos(a) * kb; t.kby += Math.sin(a) * kb;
    if (t.grounded) { t.vz = Math.max(t.vz, 180); t.grounded = false; }
    this.burst(t.x, t.y, t.team === "red" ? "#ff5a4e" : "#4aa8ff", 6, t.z + 45);
    if (crit) {
      this.burst(t.x, t.y, "#ffffff", 10, t.z + 55); this.burst(t.x, t.y, "#ffe066", 10, t.z + 55);
      this.text(t.x, t.y - 44, "CRIT!", "#ffd84a");
    }
    this.text(t.x, t.y - 28, "-" + Math.round(dmg), crit ? "#ffd84a" : "#ffffff");
    this.events.push({ type: crit ? "crit" : "hit", x: t.x, y: t.y, player: t.isPlayer || from.isPlayer });
    if (t.hp <= 0) this.kill(t, from);
  }

  kill(t: Ent, by: Ent | null) {
    t.alive = false; t.hp = 0; t.respawn = RESPAWN;
    if (t.carrying) {
      const f = this.flags[t.carrying];
      f.carrier = null; f.x = t.x; f.y = t.y; f.dropT = FLAG_RETURN; t.carrying = null;
    }
    this.burst(t.x, t.y, "#ffffff", 16, t.z + 40);
    this.events.push({ type: "death", x: t.x, y: t.y, player: t.isPlayer || !!by?.isPlayer });
    if (by) {
      by.gold += 5; by.kills++;
      if (!this.cfg.flags) this.score[by.team]++;
      this.log(`${by.name} eliminated ${t.name}`, by.team);
    }
  }

  private swing(e: Ent) {
    const skill = e.isPlayer ? 1 : this.cfg.skill;
    e.swingCd = e.isPlayer ? SWING_CD : BOT_SWING_CD / skill; e.swingT = 0.18;
    const crit = isCrit(e);
    const dmg = SWORDS[e.sword]!.dmg * (crit ? CRIT_MULT : 1);
    if (e.isPlayer) this.events.push({ type: "swing", x: e.x, y: e.y, player: true });
    for (const o of this.ents) {
      if (!o.alive || o.team === e.team || Math.abs(o.z - e.z) > 90) continue;
      const d = dist(e.x, e.y, o.x, o.y);
      const c = e.aimCircle;
      if (c && d < CIRCLE_REACH + RADIUS && dist(c.x, c.y, o.x, o.y) < c.r + RADIUS) { this.damage(o, dmg, e, crit); continue; }
      if (d < REACH + RADIUS && (d < RADIUS * 2 || angDiff(Math.atan2(o.y - e.y, o.x - e.x), e.angle) < ARC)) this.damage(o, dmg, e, crit);
    }
    const px = e.x + Math.cos(e.angle) * 40, py = e.y + Math.sin(e.angle) * 40;
    const b = this.blockAt(Math.floor(px / CELL), Math.floor(py / CELL));
    if (b && b.team && b.hp !== Infinity) {
      b.hp -= dmg;
      this.burst(px, py, "#c9b28a", 4, 20);
      if (b.hp <= 0) this.blocks.delete(k(b.cx, b.cy));
    }
  }

  // ---- fx ----
  burst(x: number, y: number, color: string, n: number, z = 30) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
      this.particles.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 80 + Math.random() * 200, life: 0.5 + Math.random() * 0.3, color, size: 3 + Math.random() * 3 });
    }
  }
  text(x: number, y: number, text: string, color: string) { this.texts.push({ x, y, text, life: 0.9, color }); }
  log(text: string, team: Team) { this.feed.unshift({ text, t: 5, team }); this.feed.length = Math.min(this.feed.length, 5); }

  // ---- main step ----
  step(dt: number, input: Input) {
    this.events = [];
    if (this.over) { this.tickFx(dt); return; }
    this.time -= dt;
    for (const e of this.ents) {
      if (!e.alive) {
        e.respawn -= dt;
        if (e.respawn <= 0) {
          const b = BASES[e.team];
          e.alive = true; e.hp = MAX_HP; e.x = b.x; e.y = b.y + (Math.random() - 0.5) * 80; e.kbx = e.kby = 0; e.z = 0; e.vz = 0; e.grounded = true;
        }
        continue;
      }
      e.swingCd -= dt; e.swingT -= dt; e.hitFlash -= dt; e.fbCd -= dt; e.useCd -= dt;
      let dx = 0, dy = 0, attack = false, jump = false, sprint = false;
      if (e.isPlayer) {
        dx = input.dx; dy = input.dy; attack = input.attack; jump = !!input.jump; sprint = !!input.sprint;
        e.angle = Math.atan2(input.aimY - e.y, input.aimX - e.x);
        e.aimCircle = input.circle ?? null;
        if (e.aimCircle && dist(e.x, e.y, e.aimCircle.x, e.aimCircle.y) > 4) e.angle = Math.atan2(e.aimCircle.y - e.y, e.aimCircle.x - e.x);
      } else [dx, dy, attack, jump] = this.think(e, dt);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      const sp = SPEED * (e.carrying ? CARRY_SLOW : 1) * (e.isPlayer ? (sprint ? SPRINT : 1) * e.bhop : 0.92 * Math.min(1.08, this.cfg.skill));
      this.moveEnt(e, dx * sp + e.kbx, dy * sp + e.kby, dt);
      const damp = Math.exp(-(e.grounded ? GROUND_DRAG : AIR_DRAG) * dt); e.kbx *= damp; e.kby *= damp;
      const wasGrounded = e.grounded;
      const jumped = stepVertical(e, jump, dt, this.groundH(e.x, e.y));
      if (e.isPlayer) {
        if (jumped && len > 0.1) e.bhop = Math.min(BHOP_MAX / (sprint ? SPRINT : 1), e.bhop + BHOP_STEP);
        else if (e.grounded && wasGrounded && !jump) e.bhop = Math.max(1, e.bhop - BHOP_DECAY * dt);
        if (len < 0.1) e.bhop = 1;
      }
      if (jumped && e.isPlayer) this.events.push({ type: "jump", x: e.x, y: e.y, player: true });
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
    this.stepFireballs(dt);
    if (this.cfg.flags) this.updateFlags(dt);
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
          this.events.push({ type: "capture", x: c.x, y: c.y, player: true });
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
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(0, p.z + p.vz * dt); p.vz -= 700 * dt; p.vx *= 0.9; p.vy *= 0.9; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) { t.y -= 40 * dt; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const f of this.feed) f.t -= dt;
    this.feed = this.feed.filter((f) => f.t > 0);
  }

  // ---- bot AI ----
  private think(b: Ent, dt: number): [number, number, boolean, boolean] {
    if (b.sword < 2 && b.gold >= SWORDS[b.sword + 1]!.cost) this.buy(b, "sword");
    else if (b.armor < 2 && b.gold >= ARMORS[b.armor + 1]!.cost) this.buy(b, "armor");
    if (b.hp < 40 && b.gold >= POTION.cost + 10) this.buy(b, "potion");
    const skill = this.cfg.skill;

    const myFlag = this.flags[b.team], enFlag = this.flags[other(b.team)];
    const base = BASES[b.team];
    let near: Ent | null = null, nd = Infinity;
    for (const o of this.ents) if (o.alive && o.team !== b.team) {
      const d = dist(b.x, b.y, o.x, o.y); if (d < nd) { nd = d; near = o; }
    }
    let gx = b.x, gy = b.y, target: Ent | null = null;
    const thief = this.cfg.flags && myFlag.carrier !== null ? this.ents.find((e) => e.id === myFlag.carrier)! : null;
    const geared = b.sword >= 2 && b.armor >= 1;
    const role = b.role === "collector" && geared ? "attacker" : b.role;
    if (role === "hunter") { if (near) { target = near; gx = near.x; gy = near.y; } }
    else if (b.carrying) { gx = base.x; gy = base.y; if (near && nd < 70) target = near; }
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
    let attack = false, jump = false;
    b.strafeT -= dt;
    if (b.strafeT <= 0) { b.strafe = Math.random() < 0.5 ? 1 : -1; b.strafeT = 0.5 + Math.random() * 0.9; }
    if (target) {
      const td = dist(b.x, b.y, target.x, target.y);
      b.angle = Math.atan2(target.y - b.y, target.x - b.x);
      if (td < REACH + 6) attack = true;
      // close-range duel: circle-strafe and hop for crits
      if (td < 130) {
        if (b.grounded && Math.random() < dt * 0.9 * skill) jump = true;
        // hold the swing for the falling half of a jump (crit timing)
        if (!b.grounded && b.vz > 0 && skill > 1.15) attack = false;
        const px = -Math.sin(b.angle) * b.strafe, py = Math.cos(b.angle) * b.strafe;
        const toward = td < 40 ? -0.3 : td < REACH ? 0.2 : 1;
        return [Math.cos(b.angle) * toward + px * 0.8 * Math.min(1, skill - 0.2), Math.sin(b.angle) * toward + py * 0.8 * Math.min(1, skill - 0.2), attack, jump];
      }
    }
    if (d < 8) return [0, 0, attack, jump];
    let a = Math.atan2(dy, dx);
    if (!target) b.angle = a;
    // obstacle avoidance
    b.avoidT -= dt;
    const free = (ang: number) => !this.collides(b.x + Math.cos(ang) * 22, b.y + Math.sin(ang) * 22, RADIUS, b.z);
    if (!free(a)) {
      const ahead = this.blockAt(Math.floor((b.x + Math.cos(a) * 36) / CELL), Math.floor((b.y + Math.sin(a) * 36) / CELL));
      if (ahead && ahead.team && ahead.team !== b.team) {
        b.angle = a;
        if (b.grounded && Math.random() < dt * 2) return [Math.cos(a), Math.sin(a), false, true];
        return [Math.cos(a) * 0.3, Math.sin(a) * 0.3, true, false];
      }
      if (b.avoidT <= 0) { b.avoid = Math.random() < 0.5 ? 1 : -1; b.avoidT = 0.8; }
      for (const off of [0.6, 1.2, 1.8, 2.4]) {
        if (free(a + off * b.avoid)) { a += off * b.avoid; break; }
        if (free(a - off * b.avoid)) { a -= off * b.avoid; break; }
      }
    }
    return [Math.cos(a), Math.sin(a), attack, jump];
  }
}
