import { describe, expect, it } from "vitest";
import { CELL, MAX_HP } from "./engine";
import { HUB_STATIONS, PORTALS, SPAWN, WILDERNESS_GATE } from "./hub";
import { GameSession } from "./session";
import { MERCHANT, WildWorld, height, safe, type Target } from "./world";

describe("protected spawn and connected modes", () => {
  it("starts safely in the hub rather than a flag arena", () => {
    const session = new GameSession();
    expect(session.arena).toBeNull();
    expect(session.active).toBe(session.world);
    expect(session.world.player.x).toBe(SPAWN.x);
    expect(session.world.player.y).toBe(SPAWN.y);
    expect(safe(SPAWN.x / CELL, SPAWN.y / CELL)).toBe(true);
    expect(session.world.player.hp).toBe(MAX_HP);
    expect(session.world.ents).toHaveLength(1);
  });
  it("protects spawn from PvP damage", () => {
    const world = new WildWorld();
    const attacker = { ...world.player, x: 50 * CELL, y: 0, team: "blue" as const };
    world.damage(world.player, 100, attacker);
    expect(world.player.hp).toBe(100);
  });
  it("prevents mining and building inside the hub", () => {
    const world = new WildWorld();
    const target: Target = { x: 5, y: 11, z: -1, type: "grass", adjacent: { x: 6, y: 11, z: 0 } };
    expect(world.mine(target)).toBe(false);
    expect(world.place(target)).toBe(false);
    expect(world.edits.size).toBe(0);
    expect(world.player.blocks).toBe(24);
  });
  it("enters every arena only from a nearby interactive station", () => {
    const session = new GameSession();
    expect(session.interact()).toBeNull();
    expect(HUB_STATIONS).toHaveLength(7);
    for (const station of PORTALS) {
      Object.assign(session.world.player, { x: station.x, y: station.y });
      expect(session.interact()).toBe("arena");
      expect(session.arena?.mode).toBe(station.mode);
      session.home();
    }
  });
  it("explores continuous wilderness and preserves edits and resources after an arena", () => {
    const session = new GameSession();
    Object.assign(session.world.player, { x: WILDERNESS_GATE.x, y: WILDERNESS_GATE.y });
    expect(session.interact()).toBe("wilderness");
    expect(safe(session.world.player.x / CELL, session.world.player.y / CELL)).toBe(false);
    session.world.edit(50, 0, 1, "stone");
    session.world.resources.wood = 3;
    const terrain = height(120, 100);
    session.enter("solo"); session.home();
    expect(session.active).toBe(session.world);
    expect(session.world.voxel(50, 0, 1)).toBe("stone");
    expect(session.world.resources.wood).toBe(3);
    expect(height(120, 100)).toBe(terrain);
  });
});

describe("hub merchant", () => {
  it("requires proximity to the vendor for gear and block purchases", () => {
    const world = new WildWorld(); world.player.gold = 50;
    expect(world.buy(world.player, "sword")).toBe(false);
    expect(world.buy(world.player, "blocks")).toBe(false);
    expect(world.player.gold).toBe(50);
    Object.assign(world.player, { x: MERCHANT.x * CELL, y: MERCHANT.y * CELL });
    expect(world.buy(world.player, "sword")).toBe(true);
    expect(world.player.sword).toBe(1);
    expect(world.player.gold).toBe(25);
    expect(world.buy(world.player, "blocks")).toBe(true);
    expect(world.player.blocks).toBe(34);
    expect(world.player.gold).toBe(20);
  });
  it("trades mined resources at the existing exchange rates", () => {
    const session = new GameSession(), world = session.world;
    world.resources.wood = 3; world.resources.stone = 2; world.resources.gold = 1;
    expect(world.trade("wood")).toBe(false);
    Object.assign(world.player, { x: MERCHANT.x * CELL, y: MERCHANT.y * CELL });
    expect(session.interact()).toBe("shop");
    for (const resource of ["wood", "stone", "gold"] as const) expect(world.trade(resource)).toBe(true);
    expect(world.player.gold).toBe(16);
    expect(world.resources).toEqual({ wood: 0, stone: 0, gold: 0 });
  });
});