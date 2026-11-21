// A single session retains the wilderness while isolated bot arenas come and go.
import { CELL, Game, type Input, type Mode } from "./engine";
import { HUB_STATIONS, WILDERNESS_GATE } from "./hub";
import { INTERACT_RANGE, WildWorld } from "./world";

export class GameSession {
  readonly world = new WildWorld();
  arena: Game | null = null;
  get active(): Game { return this.arena ?? this.world; }
  get station() {
    if (this.arena || !this.world.player.alive) return undefined;
    const p = this.world.player;
    return HUB_STATIONS.find((s) => Math.hypot(p.x - s.x, p.y - s.y) < INTERACT_RANGE * CELL);
  }
  enter(mode: Mode) { this.arena = new Game(mode); }
  explore() {
    this.arena = null;
    // The east avenue leads directly into the unchanged continuous terrain.
    Object.assign(this.world.player, { x: 42 * CELL, y: WILDERNESS_GATE.y, z: 0, vz: 0, grounded: true, kbx: 0, kby: 0 });
    this.world.peak = 0;
    this.world.message = "Wilderness";
  }
  home() { this.arena = null; this.world.home(); }
  interact(): "shop" | "arena" | "wilderness" | null {
    if (this.arena) return null;
    if (this.world.player.alive && this.world.nearMerchant()) return "shop";
    const station = this.station;
    if (!station) return null;
    if (station.mode === "wilderness") { this.explore(); return "wilderness"; }
    this.enter(station.mode); return "arena";
  }
  step(dt: number, input: Input) { this.active.step(dt, input); }
}