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
