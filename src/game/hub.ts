// Spawn hub simulation: plain TS, no React/DOM.
import { SPEED, SPRINT, stepVertical, type Body, type Mode } from "./engine";

export const HUB_R = 520;
export const ENTER_R = 45, NEAR_R = 130;
export const PORTALS: { mode: Mode; x: number; y: number; color: string; title: string; sub: string }[] = [
  { mode: "solo", x: -300, y: -180, color: "#ffd84a", title: "Solo Duel", sub: "1v1 capture the flag" },
  { mode: "ranked", x: 0, y: -330, color: "#ff7a2f", title: "Ranked 3v3", sub: "Tougher bots · earn rating" },
  { mode: "training", x: 300, y: -180, color: "#3fd47a", title: "PvP Training", sub: "Practice combos & crits" },
];

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
