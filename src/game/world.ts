// Session-local, deterministic voxel survival. Coordinates: x/y horizontal, z vertical.
import { createNoise2D } from "simplex-noise";
import { AIR_DRAG, BHOP_DECAY, BHOP_MAX, BHOP_STEP, CELL, Game, GROUND_DRAG, MAX_HP, RADIUS, SPEED, SPRINT, SWING_CD, stepVertical, type Ent, type Input, type ShopItem } from "./engine";
import { PORTALS, SPAWN } from "./hub";

export const CHUNK = 16, SAFE_RADIUS = 36, WORLD_BOTTOM = -192, WORLD_TOP = 384;
export const MERCHANT = { x: -9, y: 8 }, INTERACT_RANGE = 5;
export const TRADE = { wood: 2, stone: 1, gold: 8, blocksCost: 5, blocksCount: 10 };
export type Resource = "wood" | "stone" | "gold";
export type Voxel = "grass" | "stone" | "gold" | "wood" | "leaf" | "snow";
export type Interval = [number, number]; // inclusive voxel heights
let seed = 4731;
const noise = createNoise2D(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
export const hash = (x: number, y: number, z = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); };
export const safe = (x: number, y: number) => Math.hypot(x, y) <= SAFE_RADIUS;
export const height = (x: number, y: number) => {
  const r = Math.hypot(x, y);
  if (r < 44) return 0;
  const fade = Math.min(1, (r - 44) / 55);
  const ridge = Math.pow(1 - Math.abs(noise(x / 180, y / 180)), 5);
  const valley = Math.max(0, noise(x / 75 + 8, y / 75 - 5));
  return Math.floor(fade * (5 + ridge * 235 + valley * 22 + noise(x / 24, y / 24) * 5));
};
export function treeAt(x: number, y: number) {
  if (safe(x, y) || height(x, y) > 48 || hash(x, y) < 0.985) return false;
  return x % 3 === 0 && y % 3 === 0;
}
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
export interface Target { x: number; y: number; z: number; type: Voxel; adjacent: { x: number; y: number; z: number } }

export class WildWorld extends Game {
  edits = new Map<string, Voxel | null>();
  dirty = new Set<string>();
  revision = 0;
  resources: Record<Resource, number> = { wood: 0, stone: 0, gold: 0 };
  message = "Welcome to the Sanctuary";
  actionCd = 0;
  peak = 0;
  target: Target | null = null;
  constructor() {
    super("training");
    this.ents = this.ents.filter((e) => e.isPlayer);
    this.blocks.clear();
    this.player.gold = 0; this.player.blocks = 24;
    this.home();
  }
  home() {
    const p = this.player;
    Object.assign(p, { x: SPAWN.x, y: SPAWN.y, z: 0, vz: 0, grounded: true, alive: true, hp: MAX_HP, kbx: 0, kby: 0, bhop: 1, angle: SPAWN.yaw, swingT: 0, swingCd: 0 });
    this.peak = 0; this.target = null; this.actionCd = 0; this.message = "Sanctuary · Protected";
  }
  intervals(x: number, y: number): Interval[] {
    const h = height(x, y);
    let spans: Interval[] = [[WORLD_BOTTOM, h - 1]];
    if (!safe(x, y)) {
      // Continuous branching passages: a surface-level entrance and two deep cave strata.
      const cuts: Interval[] = [];
      if (Math.abs(noise(x / 42, y / 42)) < 0.16 && h > 4) cuts.push([0, 5]);
      if (Math.abs(noise(x / 33 + 100, y / 33)) < 0.34) cuts.push([-27, -19]);
      if (Math.abs(noise(x / 51 - 100, y / 51)) < 0.38) cuts.push([-79, -64]);
      for (const [a, b] of cuts) spans = spans.flatMap(([lo, hi]): Interval[] => hi < a || lo > b ? [[lo, hi]] : [...(lo < a ? [[lo, a - 1] as Interval] : []), ...(hi > b ? [[b + 1, hi] as Interval] : [])]);
      if (treeAt(x, y)) spans.push([h, h + 5]);
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
        if (treeAt(x + dx, y + dy)) {
          const th = height(x + dx, y + dy);
          spans.push([th + 4, th + 6 - (Math.abs(dx) + Math.abs(dy) > 2 ? 1 : 0)]);
        }
      }
    }
    const edits = this.columnEdits.get(`${x},${y}`);
    if (edits) for (const [z, type] of edits) {
      spans = spans.flatMap(([lo, hi]): Interval[] => z < lo || z > hi ? [[lo, hi]] : [...(z > lo ? [[lo, z - 1] as Interval] : []), ...(z < hi ? [[z + 1, hi] as Interval] : [])]);
      if (type) spans.push([z, z]);
    }
    spans.sort((a, b) => a[0] - b[0]);
    const merged: Interval[] = [];
    for (const [a, b] of spans) { const last = merged.at(-1); if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b); else merged.push([a, b]); }
    return merged;
  }
  private columnEdits = new Map<string, Map<number, Voxel | null>>();
  material(x: number, y: number, z: number): Voxel {
    const edited = this.edits.get(key(x, y, z));
    if (edited) return edited;
    const h = height(x, y);
    if (z >= h) return treeAt(x, y) && z < h + 5 ? "wood" : "leaf";
    if (z === h - 1) return h > 130 ? "snow" : h > 35 ? "stone" : "grass";
    return hash(x, y, z) > (z < -12 ? 0.93 : 0.986) ? "gold" : "stone";
  }
  voxel(x: number, y: number, z: number): Voxel | null {
    if (z < WORLD_BOTTOM || z >= WORLD_TOP) return null;
    if (this.edits.has(key(x, y, z))) return this.edits.get(key(x, y, z)) ?? null;
    return this.intervals(x, y).some(([lo, hi]) => z >= lo && z <= hi) ? this.material(x, y, z) : null;
  }
  edit(x: number, y: number, z: number, type: Voxel | null) {
    this.edits.set(key(x, y, z), type);
    const colKey = `${x},${y}`;
    let col = this.columnEdits.get(colKey); if (!col) { col = new Map(); this.columnEdits.set(colKey, col); }
    col.set(z, type);
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      this.dirty.add(`${Math.floor((x + (dx ?? 0)) / CHUNK)},${Math.floor((y + (dy ?? 0)) / CHUNK)}`);
    }
    this.revision++;
  }
  override groundH(x: number, y: number) {
    const z = this.player.z / CELL;
    const spans = this.intervals(Math.floor(x / CELL), Math.floor(y / CELL));
    let floor = WORLD_BOTTOM;
    for (const [, hi] of spans) if (hi + 1 <= z + 0.12) floor = Math.max(floor, hi + 1);
    return floor * CELL;
  }
  override collides(x: number, y: number, r: number, z = 0) {
    for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) {
      const cx = Math.floor((x + (dx ?? 0)) / CELL), cy = Math.floor((y + (dy ?? 0)) / CELL);
      for (const dz of [0.08, 0.9, 1.65]) if (this.voxel(cx, cy, Math.floor(z / CELL + dz))) return true;
    }
    return false;
  }
  trace(yaw: number, pitch: number): Target | null {
    const p = this.player, x = p.x / CELL, y = p.y / CELL, z = p.z / CELL + 1.6;
    let prev = { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
    for (let t = 0.2; t <= 6; t += 0.08) {
      const cx = Math.floor(x + Math.cos(yaw) * Math.cos(pitch) * t), cy = Math.floor(y + Math.sin(yaw) * Math.cos(pitch) * t), cz = Math.floor(z - Math.sin(pitch) * t);
      const type = this.voxel(cx, cy, cz);
      if (type) return { x: cx, y: cy, z: cz, type, adjacent: prev };
      prev = { x: cx, y: cy, z: cz };
    }
    return null;
  }
  mine(t: Target | null): boolean {
    if (!t || this.actionCd > 0) return false;
    if (safe(this.player.x / CELL, this.player.y / CELL) || safe(t.x + 0.5, t.y + 0.5)) { this.message = "Sanctuary is protected"; return false; }
    if (Math.hypot(t.x + 0.5 - this.player.x / CELL, t.y + 0.5 - this.player.y / CELL, t.z + 0.5 - this.player.z / CELL - 1.6) > 7 || !this.voxel(t.x, t.y, t.z)) return false;
    const type = this.voxel(t.x, t.y, t.z);
    this.edit(t.x, t.y, t.z, null); this.actionCd = 0.24;
    const resource = type === "wood" || type === "leaf" ? "wood" : type === "gold" ? "gold" : "stone";
    this.resources[resource]++; this.message = `+1 ${resource}`;
    this.burst(t.x * CELL, t.y * CELL, type === "gold" ? "#ffd84a" : "#b9bfb0", 5, t.z * CELL);
    return true;
  }
  place(t: Target | null): boolean {
    if (!t || this.actionCd > 0 || this.player.blocks <= 0) return false;
    const { x, y, z } = t.adjacent;
    if (safe(this.player.x / CELL, this.player.y / CELL) || safe(x + 0.5, y + 0.5)) { this.message = "Sanctuary is protected"; return false; }
    if (z < WORLD_BOTTOM || z >= WORLD_TOP || this.voxel(x, y, z)) return false;
    if (Math.hypot(x - this.player.x / CELL, y - this.player.y / CELL, z - this.player.z / CELL) > 7) return false;
    const p = this.player;
    if (Math.abs(x + 0.5 - p.x / CELL) < 0.9 && Math.abs(y + 0.5 - p.y / CELL) < 0.9 && z + 1 > p.z / CELL && z < p.z / CELL + 2) return false;
    this.edit(x, y, z, "stone"); p.blocks--; this.actionCd = 0.2; this.message = "Block placed"; return true;
  }
  nearMerchant() { return Math.hypot(this.player.x / CELL - MERCHANT.x, this.player.y / CELL - MERCHANT.y) < INTERACT_RANGE; }
  override buy(e: Ent, item: ShopItem): boolean {
    if (e !== this.player || !e.alive || !this.nearMerchant()) return false;
    return item === "blocks" ? this.buyBlocks() : super.buy(e, item);
  }
  trade(resource: Resource): boolean {
    if (!this.nearMerchant() || this.resources[resource] < 1) return false;
    const count = this.resources[resource]; this.resources[resource] = 0; this.player.gold += count * TRADE[resource]; this.message = `Traded ${count} ${resource}`; return true;
  }
  buyBlocks(): boolean {
    if (!this.nearMerchant() || this.player.gold < TRADE.blocksCost) return false;
    this.player.gold -= TRADE.blocksCost; this.player.blocks += TRADE.blocksCount; return true;
  }
  nearPortal() { return PORTALS.find((pt) => Math.hypot(this.player.x - pt.x, this.player.y - pt.y) < INTERACT_RANGE * CELL); }
  override damage(t: Ent, raw: number, from: Ent, crit = false) {
    if (safe(t.x / CELL, t.y / CELL) || safe(from.x / CELL, from.y / CELL)) return;
    super.damage(t, raw, from, crit);
  }
  override step(dt: number, input: Input) {
    this.events = []; this.actionCd -= dt;
    const p = this.player;
    if (!p.alive) { p.respawn -= dt; if (p.respawn <= 0) this.home(); this.tickFx(dt); return; }
    p.swingT -= dt; p.swingCd -= dt; p.hitFlash -= dt;
    let { dx, dy } = input; const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const speed = SPEED * (input.sprint ? SPRINT : 1) * p.bhop;
    p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    const nx = p.x + (dx * speed + p.kbx) * dt, ny = p.y + (dy * speed + p.kby) * dt;
    if (!this.collides(nx, p.y, RADIUS, p.z)) p.x = nx;
    if (!this.collides(p.x, ny, RADIUS, p.z)) p.y = ny;
    const damp = Math.exp(-(p.grounded ? GROUND_DRAG : AIR_DRAG) * dt); p.kbx *= damp; p.kby *= damp;
    const was = p.grounded;
    const jumped = stepVertical(p, !!input.jump, dt, this.groundH(p.x, p.y));
    if (p.vz > 0 && this.voxel(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL + 1.9))) { p.vz = 0; }
    this.peak = Math.max(this.peak, p.z);
    if (jumped && len > 0.1) p.bhop = Math.min(BHOP_MAX / (input.sprint ? SPRINT : 1), p.bhop + BHOP_STEP);
    else if (p.grounded && was && !input.jump) p.bhop = Math.max(1, p.bhop - BHOP_DECAY * dt);
    if (len < 0.1) p.bhop = 1;
    if (p.grounded) {
      const fall = (this.peak - p.z) / CELL;
      if (fall > 5 && !safe(p.x / CELL, p.y / CELL)) { p.hp = Math.max(0, p.hp - (fall - 5) * 7); p.hitFlash = 0.22; this.message = `Fall damage · ${Math.round((fall - 5) * 7)}`; }
      this.peak = p.z;
      if (p.hp <= 0) this.kill(p, null);
    }
    if (input.attack && p.swingCd <= 0) { p.swingT = 0.18; p.swingCd = SWING_CD; this.events.push({ type: "swing", x: p.x, y: p.y, player: true }); }
    this.tickFx(dt);
  }
}