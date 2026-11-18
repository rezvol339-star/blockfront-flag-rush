import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { ARMORS, BLOCK_PACK, Game, MAX_HP, POTION, SWORDS, WIN_SCORE, type Team } from "./engine";
import { Scene, type Controls } from "./Scene";

type Hud = {
  score: Record<Team, number>; time: number; hp: number; gold: number; sword: number; armor: number; blocks: number;
  alive: boolean; respawn: number; carrying: boolean; over: boolean; winner: Team | "draw" | null;
  feed: { text: string; team: Team }[]; kills: number;
};
const snap = (g: Game): Hud => {
  const p = g.player;
  return {
    score: { ...g.score }, time: g.time, hp: p.hp, gold: p.gold, sword: p.sword, armor: p.armor, blocks: p.blocks,
    alive: p.alive, respawn: p.respawn, carrying: !!p.carrying, over: g.over, winner: g.winner,
    feed: g.feed.map((f) => ({ text: f.text, team: f.team })), kills: p.kills,
  };
};
const MOUSE_SENS = 0.0025, KEY_TURN = 2.4, PLACE_DIST = 70;

export function GameView() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game>(new Game());
  const ctl = useRef<Controls>({ keys: new Set(), yaw: 0, pitch: 0.38, attack: false, started: false }).current;
  const [hud, setHud] = useState<Hud>(() => snap(gameRef.current));
  const [started, setStarted] = useState(false);
  const [shop, setShop] = useState(false);
  const [locked, setLocked] = useState(false);
  ctl.started = started && !hud.over;

  const buy = (item: "sword" | "armor" | "blocks" | "potion") => { gameRef.current.buy(gameRef.current.player, item); setHud(snap(gameRef.current)); };
  const lock = () => { const c = wrapRef.current?.querySelector("canvas"); c?.setAttribute("tabindex", "0"); c?.focus(); try { void c?.requestPointerLock?.(); } catch { /* not allowed */ } };
  const restart = () => { gameRef.current.reset(); ctl.yaw = 0; setHud(snap(gameRef.current)); setStarted(true); setShop(false); lock(); };
  const place = () => {
    const g = gameRef.current, p = g.player;
    g.placeBlock(p, p.x + Math.cos(ctl.yaw) * PLACE_DIST, p.y + Math.sin(ctl.yaw) * PLACE_DIST);
  };

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "b") setShop((s) => !s);
      if (k === "1") buy("sword"); if (k === "2") buy("armor"); if (k === "3") buy("blocks"); if (k === "4") buy("potion");
      if (k === "f") place();
      if (e.code === "Space" || k === " " || k.startsWith("arrow")) e.preventDefault();
      ctl.keys.add(e.code === "Space" ? " " : k);
    };
    const ku = (e: KeyboardEvent) => ctl.keys.delete(e.code === "Space" ? " " : e.key.toLowerCase());
    const mm = (e: MouseEvent) => {
      if (document.pointerLockElement || (e.buttons & 2)) {
        ctl.yaw += e.movementX * MOUSE_SENS;
        ctl.pitch = Math.max(0.1, Math.min(1.1, ctl.pitch + e.movementY * MOUSE_SENS));
      }
    };
    const md = (e: MouseEvent) => {
      if (!ctl.started || e.button !== 0) return;
      if ((e.target as HTMLElement)?.closest?.("button")) return;
      ctl.attack = true;
    };
    const mu = (e: MouseEvent) => { if (e.button === 0) ctl.attack = false; };
    const blur = () => { ctl.attack = false; ctl.keys.clear(); };
    const onLock = () => setLocked(!!document.pointerLockElement);
    let raf = 0, last = performance.now(), hudT = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (ctl.keys.has("q")) ctl.yaw -= KEY_TURN * dt;
      if (ctl.keys.has("e")) ctl.yaw += KEY_TURN * dt;
      hudT -= dt; if (hudT <= 0) { hudT = 0.1; setHud(snap(gameRef.current)); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    window.addEventListener("mousemove", mm); window.addEventListener("mousedown", md); window.addEventListener("mouseup", mu); document.addEventListener("pointerlockchange", onLock); window.addEventListener("blur", blur);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      window.removeEventListener("mousemove", mm); window.removeEventListener("mousedown", md); window.removeEventListener("mouseup", mu); document.removeEventListener("pointerlockchange", onLock); window.removeEventListener("blur", blur);
    };
  }, []);

  const mins = Math.max(0, Math.floor(hud.time / 60)), secs = Math.max(0, Math.floor(hud.time % 60));
  return (
    <div ref={wrapRef} className="relative h-screen w-screen select-none overflow-hidden bg-background font-sans text-foreground"
      onContextMenu={(e) => e.preventDefault()}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 60, near: 0.1, far: 120, position: [0, 8, 12] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        className="!absolute inset-0"
        onPointerDown={(e) => {
          if (!ctl.started) return;
          if (!document.pointerLockElement && e.button === 0) lock();
          if (e.button === 2 && document.pointerLockElement) place();
        }}
        >
        <Scene game={gameRef} ctl={ctl} onReady={() => wrapRef.current?.setAttribute("data-scene-ready", "true")} />
      </Canvas>

      {started && locked && <div className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-border bg-foreground" />}

      <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-3">
        <div className="block-panel bg-team-red px-4 py-1 font-display text-3xl text-outline">{hud.score.red}</div>
        <div className="block-panel px-3 py-1 text-center font-display">
          <div className="text-xl text-gold text-outline">{mins}:{secs.toString().padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">First to {WIN_SCORE}</div>
        </div>
        <div className="block-panel bg-team-blue px-4 py-1 font-display text-3xl text-outline">{hud.score.blue}</div>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 flex w-72 flex-col items-end gap-1">
        {hud.feed.map((f, i) => (
          <div key={i} className={`block-panel px-2 py-0.5 text-xs font-bold ${f.team === "red" ? "text-team-red" : "text-team-blue"}`}>{f.text}</div>
        ))}
      </div>

      <div className="block-panel absolute bottom-3 left-3 w-64 p-3">
        <div className="mb-1 flex justify-between font-display text-sm"><span>HP</span><span>{Math.ceil(hud.hp)}/{MAX_HP}</span></div>
        <div className="h-3 overflow-hidden rounded-sm border-2 border-border bg-muted">
          <div className="h-full bg-team-red transition-all" style={{ width: `${(hud.hp / MAX_HP) * 100}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <span className="font-display text-base text-gold">⛃ {hud.gold} gold</span>
          <span className="text-right">▦ {hud.blocks} blocks</span>
          <span>{SWORDS[hud.sword]!.name}</span>
          <span className="text-right">{ARMORS[hud.armor]!.name}</span>
        </div>
        <button className="block-btn mt-2 w-full py-1 text-sm" onClick={() => setShop((s) => !s)}>Shop (B)</button>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 block-panel px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        <b className="text-foreground">WASD</b> move · <b className="text-foreground">Mouse</b> look · <b className="text-foreground">Click</b> swing<br />
        <b className="text-foreground">Right click / F</b> place block · <b className="text-foreground">Q/E</b> turn · <b className="text-foreground">B</b> shop · <b className="text-foreground">Esc</b> free mouse
      </div>

      {hud.carrying && <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 animate-pulse font-display text-2xl text-gold text-outline">You have the flag! Run home!</div>}
      {started && !hud.alive && !hud.over && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="font-display text-5xl text-outline">Respawning in {Math.ceil(hud.respawn)}…</div>
        </div>
      )}
      {started && !locked && !hud.over && !shop && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 block-panel px-4 py-2 font-display text-lg">Click the arena to control the camera</div>
      )}

      {shop && started && (
        <div className="block-panel absolute left-3 top-20 max-h-[calc(100vh-15rem)] w-72 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl text-gold text-outline">Shop</h2>
            <span className="font-display text-gold">⛃ {hud.gold}</span>
          </div>
          {[
            { key: "sword" as const, n: 1, label: SWORDS[hud.sword + 1]?.name ?? "Max sword", cost: SWORDS[hud.sword + 1]?.cost, sub: SWORDS[hud.sword + 1] ? `${SWORDS[hud.sword + 1]!.dmg} damage` : "Maxed" },
            { key: "armor" as const, n: 2, label: ARMORS[hud.armor + 1]?.name ?? "Max armor", cost: ARMORS[hud.armor + 1]?.cost, sub: ARMORS[hud.armor + 1] ? `-${ARMORS[hud.armor + 1]!.reduce * 100}% damage taken` : "Maxed" },
            { key: "blocks" as const, n: 3, label: `${BLOCK_PACK.count} Wall blocks`, cost: BLOCK_PACK.cost, sub: "Right-click to build" },
            { key: "potion" as const, n: 4, label: "Health potion", cost: POTION.cost, sub: `+${POTION.heal} HP` },
          ].map((it) => (
            <button key={it.key} disabled={it.cost === undefined || hud.gold < it.cost} onClick={() => buy(it.key)}
              className="block-btn mb-2 flex w-full items-center justify-between px-3 py-2 text-left">
              <span><span className="block text-base">[{it.n}] {it.label}</span><span className="block font-sans text-[11px] font-bold opacity-75">{it.sub}</span></span>
              {it.cost !== undefined && <span className="text-lg">⛃{it.cost}</span>}
            </button>
          ))}
        </div>
      )}

      {(!started || hud.over) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="block-panel max-w-md p-8 text-center">
            {hud.over ? (
              <>
                <h1 className={`font-display text-6xl text-outline ${hud.winner === "red" ? "text-team-red" : hud.winner === "blue" ? "text-team-blue" : "text-gold"}`}>
                  {hud.winner === "red" ? "Victory!" : hud.winner === "blue" ? "Defeat" : "Draw"}
                </h1>
                <p className="mt-2 font-display text-2xl">Red {hud.score.red} — {hud.score.blue} Blue</p>
                <p className="mt-1 text-sm text-muted-foreground">You scored {hud.kills} eliminations</p>
              </>
            ) : (
              <>
                <h1 className="font-display text-6xl leading-none text-outline"><span className="text-team-red">Block</span> <span className="text-gold">Flag</span> <span className="text-team-blue">Wars</span></h1>
                <p className="mt-4 text-sm text-muted-foreground">You're on <b className="text-team-red">Red</b>. Mine gold, gear up, steal Blue's flag and carry it back to your base. First to {WIN_SCORE} captures wins.</p>
              </>
            )}
            <button className="block-btn mt-6 px-10 py-3 text-2xl" onClick={restart}>{hud.over ? "Play again" : "Play"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
