// Spawn hub simulation: plain TS, no React/DOM.
import { SPEED, SPRINT, stepVertical, type Body, type Mode } from "./engine";

export const HUB_R = 1440;
export const ENTER_R = 45, NEAR_R = 130;
export const SPAWN = { x: 5 * 40, y: 11 * 40, yaw: -Math.PI / 2 };
export const WILDERNESS_GATE = { mode: "wilderness" as const, x: 30 * 40, y: 0, title: "Wilderness", sub: "Forests · Mountains · Plains" };
export const PORTALS: { mode: Mode; x: number; y: number; color: string; title: string; sub: string }[] = [
  { mode: "solo", x: -600, y: -520, color: "#ffd84a", title: "Solo (1v1)", sub: "Capture the flag" },
  { mode: "duo", x: 0, y: -680, color: "#51c8e8", title: "2v2", sub: "Capture the flag" },
  { mode: "deathmatch", x: 600, y: -520, color: "#ef685c", title: "Team Deathmatch", sub: "Elimination battle" },
  { mode: "training", x: -720, y: 160, color: "#62d988", title: "Training Ground", sub: "Practice arena" },
  { mode: "ranked", x: 720, y: 160, color: "#e9ac55", title: "Ranked 3v3", sub: "Advanced opponents" },
  { mode: "rankedSolo", x: 0, y: 640, color: "#c3a0ed", title: "Ranked Solo", sub: "Expert duel" },
];
export const HUB_STATIONS = [...PORTALS, WILDERNESS_GATE];

export interface HubPlayer extends Body { angle: number }

export class Hub {
  p: HubPlayer = { x: 0, y: 250, z: 0, vz: 0, grounded: true, angle: -Math.PI / 2 };
  reset() { Object.assign(this.p, { x: 0, y: 250, z: 0, vz: 0, grounded: true, angle: -Math.PI / 2 }); }
  /** Returns true when the player jumped. */
  step(dt: number, i: { dx: number; dy: number; jump: boolean; sprint: boolean; yaw: number }): boolean {
    const p = this.p, len = Math.hypot(i.dx, i.dy);
    const dx = len > 1 ? i.dx / len : i.dx, dy = len > 1 ? i.dy / len : i.dy;
    const sp = SPEED * (i.sprint ? SPRINT : 1);
    p.x += dx * sp * dt; p.y += dy * sp * dt;
    const r = Math.hypot(p.x, p.y);
    if (r > HUB_R - 20) { p.x *= (HUB_R - 20) / r; p.y *= (HUB_R - 20) / r; }
    p.angle = i.yaw;
    return stepVertical(p, i.jump, dt, 0);
  }
  near(radius = NEAR_R) {
    let best: (typeof PORTALS)[number] | null = null, bd = radius;
    for (const pt of PORTALS) { const d = Math.hypot(this.p.x - pt.x, this.p.y - pt.y); if (d < bd) { bd = d; best = pt; } }
    return best;
  }
}
