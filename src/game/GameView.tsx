import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { ArrowRight, BrickWall, Crosshair, Flame, Home, Pickaxe, ShieldCheck, ShoppingBag, Sword, Target, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ARMORS, BLOCK_PACK, CELL, CIRCLE_REACH, DYNAMITE_PACK, FIREBALL_PACK, Game, MAX_HP, MODES, POTION, SWORDS, type ItemSlot, type Mode, type ShopItem } from "./engine";
import { Scene, type Controls } from "./Scene";
import { SPAWN } from "./hub";
import { GameSession } from "./session";
import { TRADE, height, safe, type Resource } from "./world";
import { WorldScene } from "./WorldScene";

const snap = (session: GameSession) => {
  const g = session.active, p = g.player, world = session.world;
  return {
    arena: !!session.arena, mode: g.mode, protected: !session.arena && safe(p.x / CELL, p.y / CELL),
    score: { ...g.score }, time: g.time, hp: p.hp, gold: p.gold, sword: p.sword, armor: p.armor,
    blocks: p.blocks, fireballs: p.fireballs, dynamite: p.dynamite, alive: p.alive, respawn: p.respawn,
    carrying: !!p.carrying, over: g.over, winner: g.winner, kills: p.kills,
    feed: g.feed.map((f) => ({ text: f.text, team: f.team })),
    merchant: !session.arena && p.alive && world.nearMerchant(), station: session.station,
    resources: { ...world.resources }, message: world.message,
  };
};
type Hud = ReturnType<typeof snap>;
const CIRCLE_SENS = 0.6, MOUSE_SENS = 0.0025, KEY_TURN = 2.4, PLACE_DIST = 70;

export function GameView() {
  const [session] = useState(() => new GameSession());
  const wrapRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef(session.world), gameRef = useRef<Game>(session.active);
  const ctl = useRef<Controls>({ keys: new Set(), yaw: SPAWN.yaw, pitch: 0.4, attack: false, started: true, mode: "crosshair", cf: 110, cs: 0, slot: "sword" }).current;
  const [hud, setHud] = useState<Hud>(() => snap(session));
  const [aim, setAim] = useState<Controls["mode"]>("crosshair");
  const [slot, setSlot] = useState<ItemSlot>("sword");
  const [shop, setShop] = useState(false), shopRef = useRef(false);
  const [shopTab, setShopTab] = useState<"buy" | "trade">("buy");
  const [locked, setLocked] = useState(false);
  const sync = () => { gameRef.current = session.active; setHud(snap(session)); };
  const clearInput = () => { ctl.attack = false; ctl.keys.clear(); };
  const lock = () => {
    const canvas = wrapRef.current?.querySelector("canvas");
    canvas?.setAttribute("tabindex", "0"); canvas?.focus();
    try { const request = canvas?.requestPointerLock?.(); if (request) void request.catch(() => {}); } catch { /* Camera turning remains available with Q/E. */ }
  };
  const changeShop = (open: boolean) => {
    if (open && !session.arena && !session.world.nearMerchant()) return;
    clearInput(); shopRef.current = open; setShop(open); ctl.started = !open && !session.active.over;
    if (open) document.exitPointerLock?.();
  };
  const selectSlot = (item: ItemSlot) => { ctl.slot = item; setSlot(item); ctl.attack = false; };
  const toggleAim = () => { ctl.mode = ctl.mode === "crosshair" ? "circle" : "crosshair"; ctl.cf = 110; ctl.cs = 0; setAim(ctl.mode); };
  const home = () => {
    changeShop(false); clearInput(); session.home(); ctl.yaw = SPAWN.yaw; ctl.pitch = 0.4;
    selectSlot("sword"); ctl.started = true; wrapRef.current?.removeAttribute("data-scene-ready"); sync();
  };
  const interact = () => {
    const result = session.interact();
    if (result === "shop") { changeShop(true); return; }
    if (!result) return;
    clearInput(); selectSlot("sword"); ctl.yaw = 0; ctl.started = true;
    wrapRef.current?.removeAttribute("data-scene-ready"); sync(); lock();
  };
  const buy = (item: ShopItem) => { session.active.buy(session.active.player, item); sync(); };
  const trade = (resource: Resource) => { session.world.trade(resource); sync(); };
  const place = () => {
    if (shopRef.current || !ctl.started) return;
    const g = session.active, p = g.player;
    if (session.arena) g.placeBlock(p, p.x + Math.cos(ctl.yaw) * PLACE_DIST, p.y + Math.sin(ctl.yaw) * PLACE_DIST);
    else session.world.place(session.world.trace(ctl.yaw, ctl.pitch));
    sync();
  };

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Tab" || e.code.startsWith("Arrow")) e.preventDefault();
      if (e.code === "Escape") { if (shopRef.current) changeShop(false); clearInput(); return; }
      if (e.code === "KeyB" && !e.repeat) { changeShop(!shopRef.current); return; }
      if (shopRef.current) return;
      if (e.code === "KeyR" && !e.repeat) { interact(); return; }
      if (e.code === "Tab" && !e.repeat) { toggleAim(); return; }
      if (e.code === "KeyF" && !e.repeat) { place(); return; }
      const slots: Record<string, ItemSlot> = { Digit1: "sword", Digit2: "blocks", Digit3: "fireball", Digit4: "dynamite" };
      const item = slots[e.code]; if (item && (session.arena || item === "sword" || item === "blocks")) selectSlot(item);
      ctl.keys.add(e.code === "Space" ? " " : e.key.toLowerCase());
    };
    const ku = (e: KeyboardEvent) => ctl.keys.delete(e.code === "Space" ? " " : e.key.toLowerCase());
    const mm = (e: MouseEvent) => {
      if (shopRef.current || !(document.pointerLockElement || (e.buttons & 2))) return;
      if (ctl.mode === "circle" && session.arena) {
        ctl.cf = Math.max(30, Math.min(CIRCLE_REACH, ctl.cf - e.movementY * CIRCLE_SENS));
        const cs = ctl.cs + e.movementX * CIRCLE_SENS;
        ctl.cs = Math.max(-120, Math.min(120, cs)); ctl.yaw += (cs - ctl.cs) * 0.006;
      } else {
        ctl.yaw += e.movementX * MOUSE_SENS;
        ctl.pitch = Math.max(0.1, Math.min(1.1, ctl.pitch + e.movementY * MOUSE_SENS));
      }
    };
    const md = (e: MouseEvent) => {
      if (!ctl.started || e.button !== 0 || !(e.target instanceof Element) || e.target.closest("button, [role=dialog]")) return;
      ctl.attack = true;
    };
    const mu = (e: MouseEvent) => { if (e.button === 0) ctl.attack = false; };
    const onLock = () => { setLocked(!!document.pointerLockElement); if (!document.pointerLockElement) clearInput(); };
    let raf = 0, last = performance.now(), hudT = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (!shopRef.current) {
        if (ctl.keys.has("q")) ctl.yaw -= KEY_TURN * dt;
        if (ctl.keys.has("e")) ctl.yaw += KEY_TURN * dt;
      }
      ctl.started = !shopRef.current && !session.active.over;
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.1;
        if (shopRef.current && !session.arena && !session.world.nearMerchant()) changeShop(false);
        setHud(snap(session));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    window.addEventListener("mousemove", mm); window.addEventListener("mousedown", md); window.addEventListener("mouseup", mu);
    window.addEventListener("blur", clearInput); document.addEventListener("pointerlockchange", onLock);
    const debug = {
      get state() { return { ...snap(session), player: { ...session.active.player }, edits: session.world.edits.size }; },
      warp: (x: number, y: number, z = height(Math.floor(x), Math.floor(y))) => {
        Object.assign(session.active.player, { x: x * CELL, y: y * CELL, z: z * CELL, vz: 0, grounded: true });
        session.world.peak = z * CELL; sync();
      },
      sim: (seconds: number) => {
        const p = session.active.player;
        for (let t = 0; t < Math.min(seconds, 60); t += 1 / 60) session.step(1 / 60, {
          dx: Math.cos(ctl.yaw) * (ctl.keys.has("w") ? 1 : 0), dy: Math.sin(ctl.yaw) * (ctl.keys.has("w") ? 1 : 0),
          aimX: p.x + Math.cos(ctl.yaw) * 100, aimY: p.y + Math.sin(ctl.yaw) * 100,
          attack: ctl.attack, jump: ctl.keys.has(" "), sprint: ctl.keys.has("shift"),
        });
        sync();
      },
      enter: (mode: Mode) => { clearInput(); session.enter(mode); ctl.yaw = 0; sync(); },
      home,
    };
    const debugWindow = window as Window & { __game?: typeof debug };
    if (import.meta.env.DEV) debugWindow.__game = debug;
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      window.removeEventListener("mousemove", mm); window.removeEventListener("mousedown", md); window.removeEventListener("mouseup", mu);
      window.removeEventListener("blur", clearInput); document.removeEventListener("pointerlockchange", onLock);
      if (import.meta.env.DEV) delete debugWindow.__game;
    };
  }, [session]);

  const mins = Math.max(0, Math.floor(hud.time / 60)), secs = Math.max(0, Math.floor(hud.time % 60));
  const blockPack = hud.arena ? BLOCK_PACK : { count: TRADE.blocksCount, cost: TRADE.blocksCost };
  const swordUpgrade = SWORDS[hud.sword + 1], armorUpgrade = ARMORS[hud.armor + 1];
  const offers: { key: ShopItem; label: string; cost: number | undefined; detail: string; available: boolean }[] = [
    { key: "sword", label: swordUpgrade?.name ?? "Sword fully upgraded", cost: swordUpgrade?.cost, detail: `${swordUpgrade?.dmg ?? 0} damage`, available: !!swordUpgrade },
    { key: "armor", label: armorUpgrade?.name ?? "Armor fully upgraded", cost: armorUpgrade?.cost, detail: `${Math.round((armorUpgrade?.reduce ?? 0) * 100)}% protection`, available: !!armorUpgrade },
    { key: "blocks", label: `${blockPack.count} blocks`, cost: blockPack.cost, detail: "Stone", available: true },
    { key: "potion", label: "Health potion", cost: POTION.cost, detail: `+${POTION.heal} HP`, available: hud.hp < MAX_HP },
    { key: "fireball", label: `${FIREBALL_PACK.count} fireballs`, cost: FIREBALL_PACK.cost, detail: "Arena supply", available: true },
    { key: "dynamite", label: `${DYNAMITE_PACK.count} dynamite`, cost: DYNAMITE_PACK.cost, detail: "Arena supply", available: true },
  ];
  const items = [
    { key: "sword" as const, Icon: hud.arena ? Sword : Pickaxe, name: hud.arena ? "Sword" : "Mine", count: null },
    { key: "blocks" as const, Icon: BrickWall, name: "Blocks", count: hud.blocks },
    ...(hud.arena ? [{ key: "fireball" as const, Icon: Flame, name: "Fireball", count: hud.fireballs }, { key: "dynamite" as const, Icon: Zap, name: "Dynamite", count: hud.dynamite }] : []),
  ];
  return (
    <div ref={wrapRef} data-location={hud.arena ? hud.mode : hud.protected ? "hub" : "wilderness"}
      className="relative h-dvh w-full select-none overflow-hidden bg-background font-sans text-foreground" onContextMenu={(e) => e.preventDefault()}>
      <Canvas shadows dpr={[1, 1.25]} camera={{ fov: 60, near: 0.1, far: 420, position: [5, 7, 20] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }} className="!absolute inset-0"
        onPointerDown={(e) => { if (!ctl.started) return; if (!document.pointerLockElement && e.button === 0) lock(); if (e.button === 2) place(); }}>
        {hud.arena
          ? <Scene key={hud.mode} game={gameRef} ctl={ctl} onReady={() => wrapRef.current?.setAttribute("data-scene-ready", "true")} />
          : <WorldScene world={worldRef} ctl={ctl} onReady={() => wrapRef.current?.setAttribute("data-scene-ready", "true")} />}
      </Canvas>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="world-toolbar px-3 py-2">
          <h1 className="world-title text-xl sm:text-2xl">{hud.arena ? MODES[hud.mode].label : hud.protected ? "Spawn Hub" : "Wilderness"}</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{hud.arena ? "Bot arena" : hud.protected ? <><ShieldCheck className="h-3.5 w-3.5 text-gold" /> Sanctuary · Protected</> : "Forests · Mountains · Plains"}</div>
        </div>
        {hud.arena && <div className="world-toolbar hidden px-4 py-2 text-center font-display sm:block">
          {MODES[hud.mode].flags && <span className="text-team-red">{hud.score.red} </span>}
          <span className="text-gold">{Number.isFinite(hud.time) ? `${mins}:${secs.toString().padStart(2, "0")}` : "∞"}</span>
          {MODES[hud.mode].flags && <span className="text-team-blue"> {hud.score.blue}</span>}
        </div>}
        <div className="pointer-events-auto flex gap-2">
          {hud.arena && <Button variant="secondary" size="icon" onClick={toggleAim} title={aim === "circle" ? "Circle aim" : "Crosshair aim"} aria-label="Switch aim mode">{aim === "circle" ? <Target /> : <Crosshair />}</Button>}
          {hud.arena && <Button variant="secondary" size="icon" onClick={() => changeShop(!shopRef.current)} title="Arena shop" aria-label="Open arena shop"><ShoppingBag /></Button>}
          <Button variant="secondary" size="icon" onClick={home} title="Return to Spawn Hub" aria-label="Return to Spawn Hub"><Home /></Button>
        </div>
      </header>

      {locked && !shop && (aim === "crosshair" || !hud.arena) && <Crosshair className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-foreground/80" />}
      {hud.arena && hud.carrying && <div className="pointer-events-none absolute inset-x-0 top-24 text-center font-display text-xl text-gold text-outline">Enemy flag secured</div>}
      {hud.arena && <div className="pointer-events-none absolute right-3 top-24 flex max-w-52 flex-col items-end gap-1">{hud.feed.slice(-3).map((f, i) => <div key={i} className={`world-toolbar px-2 py-1 text-xs ${f.team === "red" ? "text-team-red" : "text-team-blue"}`}>{f.text}</div>)}</div>}

      <div className="world-toolbar pointer-events-none absolute bottom-3 left-3 w-44 p-2.5 sm:w-52">
        <div className="flex justify-between text-xs"><span>HP {Math.ceil(hud.hp)}/{MAX_HP}</span><span className="font-bold text-gold">{hud.gold} gold</span></div>
        <meter className="game-health mt-1.5 h-2 w-full" min={0} max={MAX_HP} value={hud.hp} aria-label="Player health" />
        <div className="mt-1.5 truncate text-[11px] text-muted-foreground">{SWORDS[hud.sword]?.name} · {ARMORS[hud.armor]?.name}</div>
      </div>
      <div className="absolute bottom-3 right-3 flex gap-1.5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
        {items.map((item, i) => <Button key={item.key} variant={slot === item.key ? "default" : "secondary"} className="relative h-11 w-11 p-0 sm:h-12 sm:w-12" onClick={() => selectSlot(item.key)} title={item.name} aria-label={`Select ${item.name}`} aria-pressed={slot === item.key}>
          <item.Icon /><span className="absolute left-1 top-0.5 text-[9px] opacity-70">{i + 1}</span>{item.count !== null && <span className="absolute bottom-0 right-1 text-[10px] font-bold">{item.count}</span>}
        </Button>)}
      </div>
      {!hud.arena && !shop && (hud.merchant || hud.station) && <div className="absolute bottom-24 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2">
        <Button className="h-auto min-h-11 max-w-full whitespace-normal border-2 border-border px-5 py-2 font-display text-base" onClick={interact} aria-label={hud.merchant ? "Open merchant shop" : `Enter ${hud.station?.title ?? "mode"}`}>
          {hud.merchant ? <ShoppingBag /> : <ArrowRight />}{hud.merchant ? "Hub Merchant" : hud.station?.title}<span className="ml-2 border-l border-primary-foreground/30 pl-2 text-xs">R</span>
        </Button>
      </div>}
      {!hud.alive && !hud.over && <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-3xl text-outline">Respawning in {Math.ceil(hud.respawn)}…</div>}

      {shop && <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 p-3" onClick={() => changeShop(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="shop-title" className="block-panel max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 id="shop-title" className="font-display text-2xl">{hud.arena ? "Arena Shop" : "Hub Merchant"}</h2><div className="text-sm text-gold">{hud.gold} gold</div></div><Button variant="ghost" size="icon" onClick={() => changeShop(false)} aria-label="Close shop" autoFocus><X /></Button></div>
          {!hud.arena && <div className="mb-4 flex gap-2" role="tablist" aria-label="Merchant services"><Button role="tab" aria-selected={shopTab === "buy"} variant={shopTab === "buy" ? "default" : "secondary"} onClick={() => setShopTab("buy")}>Buy</Button><Button role="tab" aria-selected={shopTab === "trade"} variant={shopTab === "trade" ? "default" : "secondary"} onClick={() => setShopTab("trade")}>Trade</Button></div>}
          {(hud.arena || shopTab === "buy") ? <div className="divide-y divide-border">{offers.map((offer) => <div key={offer.key} className="flex items-center justify-between gap-3 py-3"><div><div className="font-bold">{offer.label}</div><div className="text-xs text-muted-foreground">{offer.detail}</div></div><Button className="min-w-24" disabled={!offer.available || offer.cost === undefined || hud.gold < offer.cost} onClick={() => buy(offer.key)} aria-label={`Buy ${offer.key}`}>{offer.cost === undefined ? "Maxed" : `${offer.cost} gold`}</Button></div>)}</div>
            : <div className="divide-y divide-border">{(["wood", "stone", "gold"] as const).map((resource) => <div key={resource} className="flex items-center justify-between gap-3 py-3"><div><div className="font-bold capitalize">{resource} · {hud.resources[resource]}</div><div className="text-xs text-muted-foreground">{TRADE[resource]} gold each</div></div><Button disabled={hud.resources[resource] === 0} onClick={() => trade(resource)} aria-label={`Sell ${resource}`}>Sell · {hud.resources[resource] * TRADE[resource]} gold</Button></div>)}</div>}
        </section>
      </div>}
      {hud.over && <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 p-4"><div className="block-panel p-8 text-center"><h2 className="font-display text-4xl text-gold">{hud.winner === "red" ? "Victory!" : hud.winner === "blue" ? "Defeat" : "Draw"}</h2><p className="my-4">Red {hud.score.red} — {hud.score.blue} Blue · {hud.kills} eliminations</p><Button onClick={home}><Home /> Spawn Hub</Button></div></div>}
    </div>
  );
}
