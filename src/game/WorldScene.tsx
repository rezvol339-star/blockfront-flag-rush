import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { CELL, type Game } from "./engine";
import { Character, type Controls } from "./Scene";
import { HUB_STATIONS, SPAWN } from "./hub";
import { CHUNK, MERCHANT, SAFE_RADIUS, WildWorld, type Interval, type Voxel } from "./world";
import { stoneTexture, worldPalette, type WorldColor } from "./world-palette";

type Palette = ReturnType<typeof worldPalette>;
type Cube = { pos: [number, number, number]; size: [number, number, number]; color: WorldColor };
function hubCubes(): Cube[] {
  const list: Cube[] = [];
  const box = (x: number, z: number, y: number, w: number, d: number, h: number, color: WorldColor = "stone") => list.push({ pos: [x, y + h / 2, z], size: [w, h, d], color });
  // Paved octagonal terraces, radial avenues, balustrades and monumental arcade.
  for (let x = -27; x <= 27; x += 2) for (let z = -27; z <= 27; z += 2) {
    if (Math.hypot(x, z) < 28) box(x, z, -0.12, 1.98, 1.98, 0.13, Math.abs(x) < 3 || Math.abs(z) < 3 ? "light" : (x + z) % 4 === 0 ? "stone" : "dark");
  }
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const dx = Math.cos(a), dz = Math.sin(a);
    for (let n = 28; n < 43; n += 2) box(dx * n, dz * n, -0.08, dx === 0 ? 6 : 2, dz === 0 ? 6 : 2, 0.1, "light");
  }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, x = Math.cos(a) * 26, z = Math.sin(a) * 26;
    box(x, z, 0, 2.2, 2.2, 0.6, "dark"); box(x, z, 0.6, 1.35, 1.35, 5.4);
    box(x, z, 5.8, 2.2, 2.2, 0.5, "light"); box(x, z, 6.3, 0.7, 0.7, 0.3, "gold");
    const b = (i + 1) * Math.PI / 6, nx = Math.cos(b) * 26, nz = Math.sin(b) * 26;
    for (let t = 1; t <= 9; t++) {
      const f = t / 10, arch = 5.1 + Math.sin(f * Math.PI) * 1.4;
      box(x + (nx - x) * f, z + (nz - z) * f, arch, 1.5, 1.5, 0.65, "light");
    }
  }
  // Central stepped sword monument and four fountains.
  box(0, 0, 0, 9, 9, 0.25, "dark"); box(0, 0, 0.25, 7, 7, 0.3, "stone");
  box(0, 0, 0.55, 4, 4, 0.5, "light"); box(0, 0, 1.05, 2.5, 2.5, 1.2, "dark");
  box(0, 0, 2.25, 0.55, 0.6, 1.6, "wood"); box(0, 0, 3.8, 3.8, 0.6, 0.45, "gold");
  box(0, 0, 4.25, 1.2, 0.4, 4.2, "light"); box(0, 0, 8.45, 0.6, 0.4, 0.6, "gold");
  for (const x of [-8, 8]) for (const z of [-8, 8]) {
    box(x, z, 0.05, 3.8, 3.8, 0.25, "light"); box(x, z, 0.3, 3.1, 3.1, 0.12, "water"); box(x, z, 0.42, 0.7, 0.7, 1.6, "stone"); box(x, z, 2.02, 1.4, 1.4, 0.2, "water");
  }
  HUB_STATIONS.forEach((p, i) => {
    const x = p.x / CELL, z = p.y / CELL, accent: WorldColor = i === 0 || i > 3 ? "gold" : i === 1 ? "blue" : i === 2 ? "red" : "leaf";
    box(x, z, 0.05, 4.5, 4.5, 0.25, "dark"); box(x, z, 0.3, 3.5, 3.5, 0.45, "light"); box(x, z, 0.75, 2.6, 2.6, 0.4, accent);
    // Deliberately sculpted voxel knight statues, on individual plinths.
    box(x - 0.5, z, 1.15, 0.65, 0.75, 1.3, "dark"); box(x + 0.5, z, 1.15, 0.65, 0.75, 1.3, "dark");
    box(x, z, 2.45, 1.9, 0.85, 1.7); box(x, z + 0.46, 2.8, 0.8, 0.12, 0.8, accent);
    box(x, z, 4.2, 1.2, 1.1, 1.15, "light"); box(x, z, 5.25, 1.4, 1.25, 0.25, accent);
    box(x - 1.2, z, 2.8, 0.6, 0.75, 1.5); box(x + 1.2, z, 2.8, 0.6, 0.75, 1.5);
    box(x - 1.25, z + 0.5, 2.5, 1.2, 0.25, 1.7, accent); box(x + 1.2, z + 0.35, 3.2, 0.18, 0.25, 3, "light");
  });
  // Merchant counter, timber framework, striped awning, resource crates.
  const mx = MERCHANT.x, mz = MERCHANT.y;
  box(mx, mz, 0, 5, 3, 0.16, "dark"); box(mx, mz + 0.6, 0.16, 4.5, 0.8, 1.2, "wood");
  for (const dx of [-2, 2]) box(mx + dx, mz, 0.16, 0.3, 0.3, 3.1, "wood");
  for (let dx = -2; dx <= 2; dx += 0.5) box(mx + dx, mz, 3.25, 0.5, 3.3, 0.2, dx % 1 === 0 ? "leaf" : "light");
  box(mx, mz - 0.5, 0.2, 0.65, 0.5, 1.1, "leaf"); box(mx, mz - 0.5, 1.3, 0.6, 0.6, 0.6, "light");
  // Eyes and a cap make the voxel vendor readable at interaction distance.
  box(mx - 0.14, mz - 0.19, 1.62, 0.1, 0.03, 0.1, "dark"); box(mx + 0.14, mz - 0.19, 1.62, 0.1, 0.03, 0.1, "dark");
  box(mx, mz - 0.5, 1.9, 0.8, 0.75, 0.18, "gold");
  for (let i = 0; i < 3; i++) box(mx - 1.5 + i * 1.5, mz + 0.6, 1.36, 0.6, 0.6, 0.5, i === 0 ? "wood" : i === 1 ? "stone" : "gold");
  return list;
}
function HubArchitecture({ palette, texture }: { palette: Palette; texture: THREE.Texture }) {
  const cubes = useMemo(hubCubes, []), mesh = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = mesh.current; if (!m) return;
    const obj = new THREE.Object3D();
    cubes.forEach((c, i) => { obj.position.set(...c.pos); obj.scale.set(...c.size); obj.updateMatrix(); m.setMatrixAt(i, obj.matrix); m.setColorAt(i, palette[c.color]); });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [cubes, palette]);
  return <>
    <instancedMesh ref={mesh} args={[undefined, undefined, cubes.length]} receiveShadow castShadow frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial map={texture} roughness={0.85} /></instancedMesh>
    {HUB_STATIONS.map((pt) => <Html key={pt.mode} center position={[pt.x / CELL, 6.4, pt.y / CELL]} distanceFactor={24} zIndexRange={[15, 0]} occlude><div className="world-label font-display"><div className="text-lg">{pt.title}</div><div className="font-sans text-[10px] text-muted-foreground">{pt.sub}</div></div></Html>)}
    <Html center position={[MERCHANT.x, 4, MERCHANT.y]} distanceFactor={20} zIndexRange={[15, 0]}><div className="world-label font-display text-lg">Hub Merchant</div></Html>
    <mesh rotation-x={-Math.PI / 2} position={[SPAWN.x / CELL, 0.025, SPAWN.y / CELL]}><ringGeometry args={[1.6, 1.9, 32]} /><meshBasicMaterial color={palette.gold} /></mesh>
  </>;
}

const materialColor: Record<Voxel, WorldColor> = { grass: "grass", stone: "stone", gold: "gold", wood: "wood", leaf: "leaf", snow: "snow" };
function subtract(lo: number, hi: number, neighbors: Interval[]) {
  let spans: Interval[] = [[lo, hi]];
  for (const [a, b] of neighbors) spans = spans.flatMap(([l, h]): Interval[] => h < a || l > b ? [[l, h]] : [...(l < a ? [[l, a - 1] as Interval] : []), ...(h > b ? [[b + 1, h] as Interval] : [])]);
  return spans;
}
function chunkGeometry(world: WildWorld, cx: number, cy: number, palette: Palette) {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], uvs: number[] = [];
  const cols = new Map<string, Interval[]>();
  const intervals = (x: number, y: number) => { const k = `${x},${y}`; let value = cols.get(k); if (!value) { value = world.intervals(x, y); cols.set(k, value); } return value; };
  const face = (points: number[][], normal: number[], color: THREE.Color, w = 1, h = 1) => {
    const uv = [[0, 0], [w, 0], [w, h], [0, h]];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = points[i], t = uv[i]; if (!p || !t) continue;
      positions.push(...p); normals.push(...normal); colors.push(color.r, color.g, color.b); uvs.push(...t);
    }
  };
  for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++) {
    for (const [lo, hi] of intervals(x, y)) {
      const top = palette[materialColor[world.material(x, y, hi)]], bottom = palette[materialColor[world.material(x, y, lo)]];
      face([[x, hi + 1, y], [x, hi + 1, y + 1], [x + 1, hi + 1, y + 1], [x + 1, hi + 1, y]], [0, 1, 0], top);
      if (lo > -192) face([[x, lo, y], [x + 1, lo, y], [x + 1, lo, y + 1], [x, lo, y + 1]], [0, -1, 0], bottom);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        for (const [a, b] of subtract(lo, hi, intervals(x + dx, y + dy))) {
          // Vertical runs are merged instead of allocating hidden underground cubes.
          const color = palette[materialColor[world.material(x, y, b)]];
          if (dx === 1) face([[x + 1, a, y], [x + 1, b + 1, y], [x + 1, b + 1, y + 1], [x + 1, a, y + 1]], [1, 0, 0], color, b - a + 1, 1);
          else if (dx === -1) face([[x, a, y + 1], [x, b + 1, y + 1], [x, b + 1, y], [x, a, y]], [-1, 0, 0], color, b - a + 1, 1);
          else if (dy === 1) face([[x + 1, a, y + 1], [x + 1, b + 1, y + 1], [x, b + 1, y + 1], [x, a, y + 1]], [0, 0, 1], color, b - a + 1, 1);
          else face([[x, a, y], [x, b + 1, y], [x + 1, b + 1, y], [x + 1, a, y]], [0, 0, -1], color, b - a + 1, 1);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3)); geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geo.computeBoundingSphere(); return geo;
}
type ChunkRecord = { key: string; cx: number; cy: number; geometry: THREE.BufferGeometry };
function ChunkMesh({ chunk, material }: { chunk: ChunkRecord; material: THREE.Material }) {
  useEffect(() => () => chunk.geometry.dispose(), [chunk.geometry]);
  return <mesh geometry={chunk.geometry} material={material} receiveShadow />;
}
function Terrain({ world, palette, texture }: { world: WildWorld; palette: Palette; texture: THREE.Texture }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: texture, vertexColors: true, roughness: 0.95 }), [texture]);
  const records = useRef(new Map<string, ChunkRecord>()), center = useRef(""), queue = useRef<[number, number][]>([]);
  const [chunks, setChunks] = useState<ChunkRecord[]>(() => {
    for (let cx = -1; cx <= 1; cx++) for (let cy = -1; cy <= 1; cy++) {
      const key = `${cx},${cy}`; records.current.set(key, { key, cx, cy, geometry: chunkGeometry(world, cx, cy, palette) });
    }
    return [...records.current.values()];
  });
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const cx = Math.floor(world.player.x / CELL / CHUNK), cy = Math.floor(world.player.y / CELL / CHUNK), k = `${cx},${cy}`;
    let changed = false;
    if (k !== center.current) {
      center.current = k;
      for (const [key, c] of records.current) if (Math.abs(c.cx - cx) > 3 || Math.abs(c.cy - cy) > 3) { records.current.delete(key); changed = true; }
      queue.current = [];
      for (let x = cx - 3; x <= cx + 3; x++) for (let y = cy - 3; y <= cy + 3; y++) if (!records.current.has(`${x},${y}`)) queue.current.push([x, y]);
      queue.current.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    }
    for (const key of world.dirty) {
      const c = records.current.get(key); if (c) { records.current.set(key, { ...c, geometry: chunkGeometry(world, c.cx, c.cy, palette) }); changed = true; }
    }
    world.dirty.clear();
    // A bounded work queue spreads generation over frames and drops unloaded meshes.
    const next = queue.current.shift();
    if (next) { const [x, y] = next, key = `${x},${y}`; records.current.set(key, { key, cx: x, cy: y, geometry: chunkGeometry(world, x, y, palette) }); changed = true; }
    if (changed) setChunks([...records.current.values()]);
  });
  return <>{chunks.map((c) => <ChunkMesh key={c.key} chunk={c} material={material} />)}</>;
}
function WorldStepper({ world, ctl, onReady }: { world: WildWorld; ctl: Controls; onReady: () => void }) {
  const { camera, gl } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []), look = useMemo(() => new THREE.Vector3(), []), sample = useMemo(() => new THREE.Vector3(), []), done = useRef(false);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05), p = world.player, a = ctl.yaw, keys = ctl.keys;
    if (ctl.started) {
      const f = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const r = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      world.step(dt, { dx: Math.cos(a) * f - Math.sin(a) * r, dy: Math.sin(a) * f + Math.cos(a) * r, aimX: p.x + Math.cos(a) * 100, aimY: p.y + Math.sin(a) * 100, attack: ctl.attack, jump: keys.has(" "), sprint: keys.has("shift") });
      world.target = world.trace(a, ctl.pitch);
      if (ctl.attack) { if (ctl.slot === "blocks") world.place(world.target); else world.mine(world.target); }
    }
    const px = p.x / CELL, pz = p.y / CELL, py = p.z / CELL;
    const distance = 9;
    target.set(px - Math.cos(a) * distance * Math.cos(ctl.pitch), py + 2 + distance * Math.sin(ctl.pitch), pz - Math.sin(a) * distance * Math.cos(ctl.pitch));
    // Pull the camera in when a cave wall would hide the player.
    look.set(px, py + 1.6, pz);
    for (let t = 0.2; t < 1; t += 0.1) {
      sample.copy(look).lerp(target, t);
      if (world.voxel(Math.floor(sample.x), Math.floor(sample.z), Math.floor(sample.y))) { target.copy(sample.copy(look).lerp(target, Math.max(0.1, t - 0.1))); break; }
    }
    camera.position.lerp(target, done.current ? 1 - Math.exp(-12 * dt) : 1);
    camera.lookAt(px + Math.cos(a) * 4, py + 1.6, pz + Math.sin(a) * 4);
    if (import.meta.env.DEV) (world as WildWorld & { metrics?: object }).metrics = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
    if (!done.current) { done.current = true; onReady(); }
  }, -1);
  return null;
}
function TargetOutline({ world, palette }: { world: WildWorld; palette: Palette }) {
  const ref = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.015, 1.015, 1.015)), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => { const m = ref.current, t = world.target; if (!m) return; m.visible = !!t; if (t) m.position.set(t.x + 0.5, t.z + 0.5, t.y + 0.5); });
  return <lineSegments ref={ref} geometry={geometry}><lineBasicMaterial color={palette.gold} /></lineSegments>;
}
export function WorldScene({ world, ctl, onReady }: { world: MutableRefObject<WildWorld>; ctl: Controls; onReady: () => void }) {
  const palette = useMemo(worldPalette, []), texture = useMemo(stoneTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const gameRef = world as MutableRefObject<Game>;
  return <>
    <color attach="background" args={[palette.sky]} /><fog attach="fog" args={[palette.sky, 48, 145]} />
    <hemisphereLight args={[palette.snow, palette.grass, 1.5]} />
    <directionalLight position={[35, 70, 20]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-38} shadow-camera-right={38} shadow-camera-top={38} shadow-camera-bottom={-38} shadow-bias={-0.001} />
    <Environment resolution={32}><Lightformer intensity={1.5} position={[0, 30, 0]} scale={[50, 50, 1]} /><Lightformer intensity={1} color={palette.sky} position={[-30, 10, 0]} rotation-y={Math.PI / 2} scale={[50, 20, 1]} /></Environment>
    <WorldStepper world={world.current} ctl={ctl} onReady={onReady} />
    <Terrain world={world.current} palette={palette} texture={texture} />
    <HubArchitecture palette={palette} texture={texture} />
    <Character game={gameRef} idx={0} />
    <TargetOutline world={world.current} palette={palette} />
    <mesh rotation-x={-Math.PI / 2} position-y={0.015}><ringGeometry args={[SAFE_RADIUS - 0.1, SAFE_RADIUS, 128]} /><meshBasicMaterial color={palette.water} transparent opacity={0.35} depthWrite={false} /></mesh>
    {/* Cloud deck sits below the highest tectonic peaks. */}
    {[-1, 1].map((i) => <mesh key={i} position={[i * 50, 65, -75]}><boxGeometry args={[45, 1.2, 16]} /><meshStandardMaterial color={palette.snow} transparent opacity={0.48} /></mesh>)}
  </>;
}