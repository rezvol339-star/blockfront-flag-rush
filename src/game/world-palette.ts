import * as THREE from "three";
export type WorldColor = "stone" | "dark" | "light" | "grass" | "leaf" | "wood" | "snow" | "sky" | "water" | "gold" | "red" | "blue";
const TOKENS: Record<WorldColor, string> = { stone: "world-stone", dark: "world-dark-stone", light: "world-light-stone", grass: "world-grass", leaf: "world-leaf", wood: "world-wood", snow: "world-snow", sky: "world-sky", water: "world-water", gold: "gold", red: "team-red", blue: "team-blue" };
// Canvas resolves CSS oklch tokens into sRGB for Three's linear-light materials.
export function worldPalette(): Record<WorldColor, THREE.Color> {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d"); const css = getComputedStyle(document.documentElement);
  return Object.fromEntries(Object.entries(TOKENS).map(([name, token]) => {
    if (!ctx) return [name, new THREE.Color()];
    ctx.fillStyle = css.getPropertyValue(`--${token}`).trim(); ctx.fillRect(0, 0, 1, 1);
    const bytes = ctx.getImageData(0, 0, 1, 1).data;
    return [name, new THREE.Color((bytes[0] ?? 255) / 255, (bytes[1] ?? 255) / 255, (bytes[2] ?? 255) / 255).convertSRGBToLinear()];
  })) as Record<WorldColor, THREE.Color>;
}
export function stoneTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const ctx = c.getContext("2d");
  if (ctx) {
    const image = ctx.createImageData(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const v = x === 0 || y === 0 ? 170 : 217 + ((x * 19 + y * 37) % 29);
      const i = (y * 32 + x) * 4;
      image.data[i] = v; image.data[i + 1] = v; image.data[i + 2] = v; image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}