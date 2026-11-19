import { describe, it, expect } from "vitest";
import { Game, BASES, WIN_SCORE } from "./engine";

describe("flag wars rules", () => {
  it("bringing the enemy flag home scores a point", () => {
    const g = new Game();
    const p = g.player;
    p.x = BASES.blue.x; p.y = BASES.blue.y;
    g.updateFlags(0.016);
    expect(p.carrying).toBe("blue");
    p.x = BASES.red.x; p.y = BASES.red.y;
    g.updateFlags(0.016);
    expect(g.score.red).toBe(1);
    expect(g.flags.blue.home).toBe(true);
  });
  it("first to 3 captures wins", () => {
    const g = new Game();
    expect(WIN_SCORE).toBe(3);
    const p = g.player;
    for (let i = 0; i < 3; i++) {
      p.x = BASES.blue.x; p.y = BASES.blue.y; g.updateFlags(0.016);
      p.x = BASES.red.x; p.y = BASES.red.y; g.updateFlags(0.016);
    }
    expect(g.over).toBe(true);
    expect(g.winner).toBe("red");
  });
  it("diamond armor cuts damage by 45%", () => {
    const g = new Game();
    const a = g.ents[0]!, b = g.ents[3]!;
    b.armor = 2;
    g.damage(b, 100 / 1, a);
    expect(b.hp).toBeCloseTo(100 - 55);
  });
});

import { Game as G2, BHOP_MAX, SPRINT as SP2, REACH as R2 } from "./engine";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("bhop & melee", () => {
  i2("chained jumps while moving cap at 1.35x sprint", () => {
    const g = new G2(); const p = g.player;
    for (let i = 0; i < 600; i++) g.step(1 / 60, { dx: 1, dy: 0, aimX: p.x + 100, aimY: p.y, attack: false, jump: true, sprint: true });
    e2(p.bhop * SP2).toBeCloseTo(BHOP_MAX, 5);
  });
  i2("melee reach is ~3.5 units", () => { e2(R2).toBe(140); });
});

import { Game as G3, SWING_CD as CD3 } from "./engine";
import { it as i3, expect as e3 } from "vitest";
i3("holding attack keeps swinging once per cooldown", () => {
  const g = new G3(); const p = g.player; let swings = 0;
  for (let i = 0; i < 120; i++) {
    g.step(1 / 60, { dx: 0, dy: 0, aimX: p.x + 100, aimY: p.y, attack: true });
    swings += g.events.filter((ev) => ev.type === "swing" && ev.player).length;
  }
  e3(swings).toBeGreaterThanOrEqual(Math.floor(2 / CD3) - 1);
});

import { Game as G4, SWORDS, CRIT_MULT, MAX_HP as MH, isCrit } from "./engine";
import { it as i4, expect as e4 } from "vitest";
i4("grounded wooden sword needs more than 2 hits to kill", () => { e4(SWORDS[0]!.dmg * 2).toBeLessThan(MH); e4(Math.ceil(MH / SWORDS[2]!.dmg)).toBeGreaterThanOrEqual(5); });
i4("airborne attacks crit for 1.75x, grounded don't", () => {
  const g = new G4(); const p = g.player;
  e4(isCrit(p)).toBe(false);
  p.grounded = false; p.z = 30; p.vz = 100;
  e4(isCrit(p)).toBe(true);
  e4(CRIT_MULT).toBe(1.75);
});

describe("circle aim mode", () => {
  it("hits an enemy inside the ring even when it is behind the facing arc of the aim point", () => {
    const g = new Game();
    const p = g.player;
    for (const o of g.ents) if (o !== p) { o.alive = false; }
    const foe = g.ents.find((o) => o.team !== p.team)!;
    foe.alive = true; foe.hp = 100; foe.x = p.x + 170; foe.y = p.y; foe.z = 0; p.z = 0;
    g.step(0.016, { dx: 0, dy: 0, aimX: p.x, aimY: p.y - 100, attack: true, circle: { x: p.x + 170, y: p.y, r: 55 } });
    expect(foe.hp).toBeLessThan(100);
  });
  it("switching to circle mode keeps the swing cooldown", () => {
    const g = new Game();
    const p = g.player;
    g.step(0.016, { dx: 0, dy: 0, aimX: p.x + 100, aimY: p.y, attack: true });
    const cd = p.swingCd;
    g.step(0.016, { dx: 0, dy: 0, aimX: p.x + 100, aimY: p.y, attack: true, circle: { x: p.x + 100, y: p.y, r: 55 } });
    expect(p.swingCd).toBeLessThan(cd);
    expect(p.swingCd).toBeGreaterThan(0);
  });
});
