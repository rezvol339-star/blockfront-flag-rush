import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Environment, Html, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { BASES, BASE_R, CELL, H, MINES, W, type Game, type Team } from "./engine";

// 1 world unit = 1 grid cell (40 sim px). Sim (x, y) maps to world (x, z).
export const S = 1 / CELL;
const WX = W * S, WZ = H * S;
const TEAM = { red: "#e8443a", blue: "#2f86e8" } as const;
const SWORD_COL = ["#a8743a", "#d6dde4", "#5ff0f0"];
const ARMOR_COL = [null, "#c7cdd3", "#5ff0f0"];
const CAM_DIST = 7, CAM_LERP = 12;

export interface Controls { keys: Set<string>; yaw: number; pitch: number; attack: boolean; started: boolean }

function Stepper({ game, ctl }: { game: MutableRefObject<Game>; ctl: Controls }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const fx = useRef({ stop: 0, shake: 0 });
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = game.current, p = g.player, a = ctl.yaw;
    fx.current.stop -= dt; fx.current.shake = Math.max(0, fx.current.shake - dt);
    if (ctl.started && fx.current.stop <= 0) {
      const k = ctl.keys;
      const f = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
      const r = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
      const dx = Math.cos(a) * f - Math.sin(a) * r, dy = Math.sin(a) * f + Math.cos(a) * r;
      g.step(dt, { dx, dy, aimX: p.x + Math.cos(a) * 100, aimY: p.y + Math.sin(a) * 100, attack: ctl.attack, jump: k.has(" ") || k.has("space"), sprint: k.has("shift") });
      for (const ev of g.events) {
        if (ev.type === "crit" && ev.player) { fx.current.stop = 0.08; fx.current.shake = 0.28; playCrit(); }
        else if (ev.type === "hit" && ev.player) fx.current.shake = Math.max(fx.current.shake, 0.08);
      }
    }
    const px = p.x * S, pz = p.y * S;
    const cp = Math.cos(ctl.pitch);
    target.set(px - Math.cos(a) * CAM_DIST * cp, 1.6 + p.z * S * 0.6 + CAM_DIST * Math.sin(ctl.pitch), pz - Math.sin(a) * CAM_DIST * cp);
    camera.position.lerp(target, 1 - Math.exp(-CAM_LERP * dt));
    const sh = fx.current.shake * 0.9;
    if (sh > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh));
    camera.lookAt(px + Math.cos(a) * 3, 1.3 + p.z * S * 0.8, pz + Math.sin(a) * 3);
  }, -1);
  return null;
}

let actx: AudioContext | null = null;
function playCrit() {
  try {
    actx ??= new AudioContext();
    const t = actx.currentTime, o = actx.createOscillator(), n = actx.createOscillator(), gn = actx.createGain();
    o.type = "square"; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.18);
    n.type = "sawtooth"; n.frequency.setValueAtTime(1320, t); n.frequency.exponentialRampToValueAtTime(440, t + 0.12);
    gn.gain.setValueAtTime(0.18, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(gn); n.connect(gn); gn.connect(actx.destination);
    o.start(t); n.start(t); o.stop(t + 0.22); n.stop(t + 0.22);
  } catch { /* audio unavailable */ }
}

const MAX_T = 12;
function FloatTexts({ game }: { game: MutableRefObject<Game> }) {
  const groups = useRef<(THREE.Group | null)[]>([]), spans = useRef<(HTMLDivElement | null)[]>([]);
  useFrame(() => {
    const ts = game.current.texts;
    for (let i = 0; i < MAX_T; i++) {
      const g = groups.current[i], el = spans.current[i], t = ts[ts.length - 1 - i];
      if (!g || !el) continue;
      if (!t) { el.style.display = "none"; continue; }
      el.style.display = "block";
      const big = t.text === "CRIT!";
      g.position.set(t.x * S, 2.6 + (0.9 - t.life) * 1.6 + (big ? 0.5 : 0), t.y * S);
      el.textContent = t.text; el.style.color = t.color; el.style.opacity = String(Math.min(1, t.life * 2));
      el.style.fontSize = big ? `${28 + (0.9 - t.life) * 10}px` : "18px";
    }
  });
  return (
    <>
      {Array.from({ length: MAX_T }, (_, i) => (
        <group key={i} ref={(el) => { groups.current[i] = el; }}>
          <Html center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
            <div ref={(el) => { spans.current[i] = el; }} className="font-display text-outline whitespace-nowrap" style={{ display: "none" }} />
          </Html>
        </group>
      ))}
    </>
  );
}

function Ground() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 50 * 16; c.height = 25 * 16;
    const g = c.getContext("2d")!;
    for (let x = 0; x < 50; x++) for (let y = 0; y < 25; y++) {
      const left = x < 25, s = (x + y) % 2 ? 10 : 0;
      g.fillStyle = `rgb(${(left ? 100 : 86) + s},${152 + s},${(left ? 76 : 96) + s})`;
      g.fillRect(x * 16, y * 16, 16, 16);
      g.fillStyle = "rgba(0,0,0,0.06)"; g.fillRect(x * 16, y * 16 + 15, 16, 1); g.fillRect(x * 16 + 15, y * 16, 1, 16);
    }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[WX / 2, 0, WZ / 2]} receiveShadow>
        <planeGeometry args={[WX, WZ]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      {/* dirt underside around arena */}
      <mesh position={[WX / 2, -1.01, WZ / 2]}>
        <boxGeometry args={[WX + 2, 2, WZ + 2]} />
        <meshStandardMaterial color="#6b4a2e" />
      </mesh>
      {/* dividing line */}
      <mesh position={[WX / 2, 0.03, WZ / 2]}>
        <boxGeometry args={[0.25, 0.05, WZ]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>
      {/* border walls */}
      {[[WX / 2, -0.5, WX + 1, 1], [WX / 2, WZ + 0.5, WX + 1, 1], [-0.5, WZ / 2, 1, WZ], [WX + 0.5, WZ / 2, 1, WZ]].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x!, 0.6, z!]} castShadow receiveShadow>
          <boxGeometry args={[w!, 1.2, d!]} />
          <meshStandardMaterial color="#7d776f" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Bases() {
  return (
    <>
      {(["red", "blue"] as Team[]).map((t) => (
        <group key={t} position={[BASES[t].x * S, 0, BASES[t].y * S]}>
          <mesh position-y={0.05} receiveShadow>
            <cylinderGeometry args={[BASE_R * S, BASE_R * S, 0.1, 32]} />
            <meshStandardMaterial color={TEAM[t]} transparent opacity={0.45} />
          </mesh>
          <mesh position-y={0.3} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.6, 1.2]} />
            <meshStandardMaterial color="#d8d2c4" />
          </mesh>
          {[[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]].map(([x, z], i) => (
            <mesh key={i} position={[x!, 0.75, z!]} castShadow>
              <boxGeometry args={[0.5, 1.5, 0.5]} />
              <meshStandardMaterial color={TEAM[t]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function Mines() {
  const refs = useRef<THREE.Mesh[]>([]);
  useFrame(({ clock }) => refs.current.forEach((m, i) => { m.rotation.y = clock.elapsedTime + i; m.position.y = 0.8 + Math.sin(clock.elapsedTime * 2 + i) * 0.15; }));
  return (
    <>
      {MINES.map((m, i) => (
        <group key={i} position={[m.x * S, 0, m.y * S]}>
          <mesh position-y={0.04}>
            <cylinderGeometry args={[m.r * S, m.r * S, 0.08, 32]} />
            <meshStandardMaterial color="#c99a2a" emissive="#ffcc33" emissiveIntensity={0.25} />
          </mesh>
          <mesh ref={(el) => { if (el) refs.current[i] = el; }} castShadow>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color="#ffd84a" emissive="#ffb000" emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

const MAX_BLOCKS = 800;
function Blocks({ game }: { game: MutableRefObject<Game> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), c: new THREE.Color() }), []);
  useFrame(() => {
    const m = ref.current; if (!m) return;
    let i = 0;
    for (const b of game.current.blocks.values()) {
      if (i >= MAX_BLOCKS) break;
      const h = b.team ? 1.1 * Math.max(0.35, b.hp / 60) : 2;
      tmp.o.position.set(b.cx + 0.5, h / 2, b.cy + 0.5); tmp.o.scale.set(1, h, 1); tmp.o.updateMatrix();
      m.setMatrixAt(i, tmp.o.matrix);
      m.setColorAt(i, tmp.c.set(b.team ? TEAM[b.team] : (b.cx + b.cy) % 2 ? "#8a847c" : "#7a746d"));
      i++;
    }
    m.count = i; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_BLOCKS]} castShadow receiveShadow frustumCulled={false}>
      <boxGeometry args={[0.98, 1, 0.98]} />
      <meshStandardMaterial roughness={0.85} />
    </instancedMesh>
  );
}

const MAX_P = 300;
function Particles({ game }: { game: MutableRefObject<Game> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), c: new THREE.Color() }), []);
  useFrame(() => {
    const m = ref.current; if (!m) return;
    const ps = game.current.particles; let i = 0;
    for (const p of ps) {
      if (i >= MAX_P) break;
      const s = p.size * S * 2 * Math.min(1, p.life * 2);
      tmp.o.position.set(p.x * S, 0.6 + (0.8 - p.life) * 1.5, p.y * S); tmp.o.scale.setScalar(s); tmp.o.updateMatrix();
      m.setMatrixAt(i, tmp.o.matrix); m.setColorAt(i, tmp.c.set(p.color)); i++;
    }
    m.count = i; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_P]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

function FlagMesh({ team }: { team: Team }) {
  return (
    <group>
      <mesh position-y={0.9} castShadow><boxGeometry args={[0.08, 1.8, 0.08]} /><meshStandardMaterial color="#3b2b1c" /></mesh>
      <mesh position={[0.4, 1.5, 0]} castShadow><boxGeometry args={[0.8, 0.5, 0.05]} /><meshStandardMaterial color={TEAM[team]} emissive={TEAM[team]} emissiveIntensity={0.3} /></mesh>
    </group>
  );
}

function Flag({ game, team }: { game: MutableRefObject<Game>; team: Team }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current; if (!g) return;
    const f = game.current.flags[team];
    const y = f.carrier !== null ? 1.9 : f.home ? 0.6 : 0;
    g.position.set(f.x * S, y, f.y * S);
    g.rotation.y = clock.elapsedTime * (f.carrier !== null ? 0 : 0.8);
  });
  return <group ref={ref}><FlagMesh team={team} /></group>;
}

function Character({ game, idx }: { game: MutableRefObject<Game>; idx: number }) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null), legR = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Group>(null), armL = useRef<THREE.Mesh>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null), swordMat = useRef<THREE.MeshStandardMaterial>(null);
  const hpBar = useRef<THREE.Mesh>(null), hpMat = useRef<THREE.MeshBasicMaterial>(null);
  const last = useRef({ x: 0, y: 0, phase: 0 });
  const e0 = game.current.ents[idx]!;
  const teamCol = TEAM[e0.team];
  useFrame((_, delta) => {
    const e = game.current.ents[idx]; const r = root.current; if (!e || !r) return;
    r.visible = e.alive;
    if (!e.alive) return;
    const dt = Math.min(delta, 0.05);
    const moved = Math.hypot(e.x - last.current.x, e.y - last.current.y);
    last.current.x = e.x; last.current.y = e.y;
    if (moved > 0.5 && moved < 30) last.current.phase += moved * 0.06; else last.current.phase *= Math.exp(-8 * dt);
    const sw = Math.sin(last.current.phase) * 0.7;
    r.position.set(e.x * S, e.z * S, e.y * S);
    r.rotation.y = Math.PI / 2 - e.angle;
    legL.current!.rotation.x = sw; legR.current!.rotation.x = -sw; armL.current!.rotation.x = -sw;
    armR.current!.rotation.x = e.swingT > 0 ? -2.4 + (1 - e.swingT / 0.18) * 3 : -0.5 + sw * 0.4;
    armR.current!.rotation.z = e.swingT > 0 ? -0.4 : 0;
    const armor = ARMOR_COL[e.armor];
    bodyMat.current!.color.set(e.hitFlash > 0 ? "#ff2a2a" : armor ?? teamCol);
    swordMat.current!.color.set(SWORD_COL[e.sword]!);
    const hp = Math.max(0, e.hp / 100);
    hpBar.current!.scale.x = Math.max(0.001, hp); hpBar.current!.position.x = -(1 - hp) * 0.45;
    hpMat.current!.color.set(hp > 0.5 ? "#5ee06a" : hp > 0.25 ? "#f2c23a" : "#ef4a3c");
  });
  return (
    <group ref={root}>
      <mesh ref={legL} position={[-0.17, 0.4, 0]} castShadow><boxGeometry args={[0.28, 0.8, 0.3]} /><meshStandardMaterial color="#2c2f3a" /></mesh>
      <mesh ref={legR} position={[0.17, 0.4, 0]} castShadow><boxGeometry args={[0.28, 0.8, 0.3]} /><meshStandardMaterial color="#2c2f3a" /></mesh>
      <mesh position={[0, 1.15, 0]} castShadow><boxGeometry args={[0.7, 0.75, 0.4]} /><meshStandardMaterial ref={bodyMat} color={teamCol} /></mesh>
      <mesh position={[0, 1.15, 0.21]}><boxGeometry args={[0.5, 0.3, 0.02]} /><meshStandardMaterial color={teamCol} emissive={teamCol} emissiveIntensity={0.4} /></mesh>
      <mesh position={[0, 1.82, 0]} castShadow><boxGeometry args={[0.6, 0.6, 0.6]} /><meshStandardMaterial color="#f2c9a0" /></mesh>
      <mesh position={[0, 2.08, 0]}><boxGeometry args={[0.64, 0.16, 0.64]} /><meshStandardMaterial color={teamCol} /></mesh>
      <mesh position={[-0.13, 1.85, 0.305]}><boxGeometry args={[0.1, 0.14, 0.02]} /><meshBasicMaterial color="#1b1b1b" /></mesh>
      <mesh position={[0.13, 1.85, 0.305]}><boxGeometry args={[0.1, 0.14, 0.02]} /><meshBasicMaterial color="#1b1b1b" /></mesh>
      <mesh ref={armL} position={[-0.47, 1.15, 0]} castShadow><boxGeometry args={[0.22, 0.7, 0.26]} /><meshStandardMaterial color="#f2c9a0" /></mesh>
      <group ref={armR} position={[0.47, 1.45, 0]}>
        <mesh position-y={-0.3} castShadow><boxGeometry args={[0.22, 0.7, 0.26]} /><meshStandardMaterial color="#f2c9a0" /></mesh>
        <mesh position={[0, -0.62, 0.1]}><boxGeometry args={[0.08, 0.08, 0.35]} /><meshStandardMaterial color="#4a3320" /></mesh>
        <mesh position={[0, -0.62, 0.75]} castShadow><boxGeometry args={[0.07, 0.16, 1]} /><meshStandardMaterial ref={swordMat} color="#a8743a" metalness={0.4} roughness={0.4} /></mesh>
      </group>
      <Billboard position={[0, 2.55, 0]}>
        <mesh><planeGeometry args={[0.96, 0.14]} /><meshBasicMaterial color="#111111" /></mesh>
        <mesh ref={hpBar} position-z={0.01}><planeGeometry args={[0.9, 0.09]} /><meshBasicMaterial ref={hpMat} color="#5ee06a" /></mesh>
        {e0.isPlayer && <mesh position-y={0.22}><planeGeometry args={[0.2, 0.2]} /><meshBasicMaterial color="#ffd84a" /></mesh>}
      </Billboard>
    </group>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => { if (!done.current) { done.current = true; onReady(); } });
  return null;
}

export function Scene({ game, ctl, onReady }: { game: MutableRefObject<Game>; ctl: Controls; onReady: () => void }) {
  const n = game.current.ents.length;
  return (
    <>
      <color attach="background" args={["#9fd3f0"]} />
      <fog attach="fog" args={["#9fd3f0", 30, 70]} />
      <hemisphereLight args={["#dff3ff", "#5a7a3a", 0.7]} />
      <directionalLight position={[WX / 2 + 15, 30, WZ / 2 + 10]} intensity={2.2} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-0.0005}
        target-position={[WX / 2, 0, WZ / 2]} />
      <Environment resolution={64}>
        <Lightformer intensity={1.5} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={0.8} color="#bde" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      <Stepper game={game} ctl={ctl} />
      <Ground />
      <Bases />
      <Mines />
      <Blocks game={game} />
      <Flag game={game} team="red" />
      <Flag game={game} team="blue" />
      {Array.from({ length: n }, (_, i) => <Character key={i} game={game} idx={i} />)}
      <Particles game={game} />
      <FloatTexts game={game} />
      <Ready onReady={onReady} />
    </>
  );
}
