import * as THREE from "three";
import type { PieceSet } from "../components/Piece";

function texture(kind: "wood" | "ivory" | "stone", size = 2048) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const warp =
        Math.sin(v * 13 + Math.sin(u * 8) * 0.4) * 2.5 + Math.sin(v * 31) * 0.6;
      const grain = Math.sin(u * 340 + warp + Math.sin(u * 28 + v * 3) * 4);
      const fine = Math.sin(u * 2100 + Math.sin(v * 44) * 2);
      const noise = ((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1) * 2;
      let value =
        kind === "wood"
          ? 210 + grain * 16 + fine * 4 + noise
          : kind === "ivory"
            ? 235 + Math.sin(u * 420 + v * 4) * 3 + grain * 2 + noise
            : 220 +
              Math.sin(u * 12 + v * 19 + Math.sin(u * 18 - v * 5) * 1.6) ** 14 *
                -42 +
              noise;
      value = Math.max(0, Math.min(255, value));
      const i = (y * size + x) * 4;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

// Keep the expensive source maps shared while the editor changes colours or sets.
let surfaces:
  | {
      wood: THREE.CanvasTexture;
      ivory: THREE.CanvasTexture;
      stone: THREE.CanvasTexture;
    }
  | undefined;
export function makeMaterials(light: string, dark: string, set: PieceSet) {
  const { wood, ivory, stone } = (surfaces ??= {
    wood: texture("wood"),
    ivory: texture("ivory"),
    stone: texture("stone"),
  });
  const material = (
    color: string,
    map: THREE.Texture,
    roughness: number,
    metalness = 0,
    clearcoat = 0.2,
  ) =>
    new THREE.MeshPhysicalMaterial({
      color,
      map,
      bumpMap: map,
      bumpScale: 0.013,
      roughness,
      metalness,
      clearcoat,
      clearcoatRoughness: 0.25,
    });
  const white = material(
    set === "noir" ? "#cfcbc0" : set === "modern" ? "#f0eee5" : "#e5cda3",
    set === "noir" ? stone : ivory,
    set === "noir" ? 0.28 : 0.32,
    set === "noir" ? 0.7 : 0.02,
    0.4,
  );
  const black = material(
    set === "noir" ? "#363d43" : set === "modern" ? "#444a42" : "#3d2418",
    set === "noir" ? stone : wood,
    0.3,
    set === "noir" ? 0.8 : 0.03,
    0.4,
  );
  const materials = {
    white,
    black,
    light: material(light, wood, 0.4),
    dark: material(dark, wood, 0.4),
    frame: material("#482a1b", wood, 0.36),
    edge: material("#2e1d16", wood, 0.4),
    brass: new THREE.MeshStandardMaterial({
      color: "#ba9454",
      metalness: 0.78,
      roughness: 0.3,
    }),
    felt: new THREE.MeshStandardMaterial({ color: "#303b2a", roughness: 0.95 }),
    detail: new THREE.MeshStandardMaterial({
      color: "#0d1210",
      roughness: 0.35,
    }),
  };
  return {
    ...materials,
    dispose() {
      Object.values(materials).forEach((m) => m.dispose());
    },
  };
}
export type StudioMaterials = ReturnType<typeof makeMaterials>;
