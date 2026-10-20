import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Color, PieceSymbol } from "chess.js";
import type { PieceSet } from "../components/Piece";
import type { StudioMaterials } from "./materials";

const profiles: Record<PieceSymbol, [number, number][]> = {
  p: [
    [0, 0],
    [0.25, 0],
    [0.29, 0.04],
    [0.29, 0.09],
    [0.27, 0.13],
    [0.22, 0.15],
    [0.23, 0.19],
    [0.21, 0.23],
    [0.16, 0.26],
    [0.12, 0.38],
    [0.11, 0.46],
    [0.17, 0.49],
    [0.18, 0.53],
    [0.13, 0.57],
    [0, 0.58],
  ],
  r: [
    [0, 0],
    [0.3, 0],
    [0.33, 0.05],
    [0.33, 0.1],
    [0.31, 0.15],
    [0.26, 0.17],
    [0.27, 0.21],
    [0.25, 0.25],
    [0.19, 0.28],
    [0.18, 0.64],
    [0.23, 0.68],
    [0.25, 0.72],
    [0.25, 0.79],
    [0.28, 0.81],
    [0.28, 0.9],
    [0, 0.9],
  ],
  n: [
    [0, 0],
    [0.29, 0],
    [0.32, 0.05],
    [0.32, 0.1],
    [0.29, 0.14],
    [0.25, 0.16],
    [0.26, 0.2],
    [0.24, 0.24],
    [0.18, 0.27],
    [0.17, 0.36],
    [0.22, 0.39],
    [0.22, 0.44],
    [0, 0.44],
  ],
  b: [
    [0, 0],
    [0.29, 0],
    [0.32, 0.05],
    [0.32, 0.1],
    [0.29, 0.15],
    [0.24, 0.17],
    [0.25, 0.21],
    [0.22, 0.25],
    [0.16, 0.29],
    [0.11, 0.55],
    [0.14, 0.68],
    [0.22, 0.71],
    [0.23, 0.75],
    [0.21, 0.79],
    [0.12, 0.81],
    [0, 0.82],
  ],
  q: [
    [0, 0],
    [0.31, 0],
    [0.34, 0.05],
    [0.34, 0.11],
    [0.31, 0.16],
    [0.26, 0.18],
    [0.27, 0.23],
    [0.24, 0.27],
    [0.17, 0.31],
    [0.12, 0.62],
    [0.14, 0.76],
    [0.21, 0.8],
    [0.23, 0.84],
    [0.21, 0.89],
    [0.16, 0.91],
    [0.19, 1.02],
    [0.25, 1.12],
    [0.25, 1.17],
    [0.19, 1.19],
    [0, 1.19],
  ],
  k: [
    [0, 0],
    [0.32, 0],
    [0.35, 0.05],
    [0.35, 0.11],
    [0.32, 0.16],
    [0.27, 0.18],
    [0.28, 0.23],
    [0.25, 0.27],
    [0.17, 0.31],
    [0.13, 0.65],
    [0.15, 0.8],
    [0.23, 0.84],
    [0.24, 0.88],
    [0.22, 0.93],
    [0.16, 0.95],
    [0.18, 1.03],
    [0.17, 1.09],
    [0, 1.1],
  ],
};
function translate(g: THREE.BufferGeometry, x: number, y: number, z: number) {
  return g.translate(x, y, z);
}
function sphere(r: number, x: number, y: number, z: number, sy = 1) {
  return translate(
    new THREE.SphereGeometry(r, 24, 16).scale(1, sy, 1),
    x,
    y,
    z,
  );
}
function ring(r: number, tube: number, y: number) {
  return new THREE.TorusGeometry(r, tube, 8, 64)
    .rotateX(Math.PI / 2)
    .translate(0, y, 0);
}
function merged(parts: THREE.BufferGeometry[]) {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const result = mergeGeometries(flat);
  new Set([...flat, ...parts]).forEach((g) => g.dispose());
  return result!;
}
function sculpture(type: PieceSymbol, set: PieceSet) {
  const segments = set === "modern" ? 8 : 64;
  const body: THREE.BufferGeometry[] = [
    new THREE.LatheGeometry(
      profiles[type].map(([r, y]) => new THREE.Vector2(r, y)),
      segments,
    ),
  ];
  const trim: THREE.BufferGeometry[] = [
    ring(
      type === "p"
        ? 0.268
        : type === "k"
          ? 0.326
          : type === "q"
            ? 0.316
            : 0.296,
      0.009,
      0.122,
    ),
  ];
  const detail: THREE.BufferGeometry[] = [];
  if (type === "p") body.push(sphere(0.19, 0, 0.69, 0));
  if (type === "r") {
    // Six separate merlons give the tower an open, visibly crenellated crown.
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      body.push(
        new THREE.BoxGeometry(0.16, 0.19, 0.14)
          .translate(0, 0.94, 0.215)
          .rotateY(a),
      );
    }
    body.push(
      new THREE.CylinderGeometry(0.21, 0.21, 0.025, 48).translate(0, 0.91, 0),
    );
    trim.push(ring(0.247, 0.012, 0.745));
  }
  if (type === "b") {
    body.push(sphere(0.17, 0, 0.975, 0, 1.15), sphere(0.055, 0, 1.195, 0));
    // The inset follows the carved diagonal on the bishop's mitre.
    detail.push(
      new THREE.BoxGeometry(0.027, 0.22, 0.022)
        .rotateZ(-0.47)
        .translate(0.03, 1.015, 0.154),
    );
    trim.push(ring(0.212, 0.012, 0.74));
  }
  if (type === "q") {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      body.push(sphere(0.046, Math.sin(a) * 0.235, 1.215, Math.cos(a) * 0.235));
    }
    body.push(sphere(0.075, 0, 1.27, 0));
    trim.push(ring(0.215, 0.012, 0.855), ring(0.212, 0.013, 1.145));
  }
  if (type === "k") {
    body.push(
      new THREE.BoxGeometry(0.095, 0.36, 0.095).translate(0, 1.245, 0),
      new THREE.BoxGeometry(0.29, 0.092, 0.095).translate(0, 1.285, 0),
    );
    trim.push(ring(0.222, 0.012, 0.875), ring(0.163, 0.012, 1.06));
  }
  if (type === "n") {
    const s = new THREE.Shape();
    s.moveTo(-0.2, 0.42);
    s.bezierCurveTo(-0.28, 0.67, -0.2, 0.97, -0.08, 1.16);
    s.lineTo(-0.05, 1.35);
    s.lineTo(0.04, 1.24);
    s.lineTo(0.15, 1.29);
    s.lineTo(0.17, 1.15);
    s.bezierCurveTo(0.23, 1.09, 0.25, 1.03, 0.36, 0.96);
    s.lineTo(0.38, 0.83);
    s.lineTo(0.29, 0.79);
    s.lineTo(0.11, 0.88);
    s.bezierCurveTo(0.08, 0.8, 0.14, 0.69, 0.21, 0.6);
    s.lineTo(0.23, 0.44);
    s.closePath();
    const head = new THREE.ExtrudeGeometry(s, {
      depth: 0.23,
      steps: 1,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.025,
      bevelSegments: 3,
      curveSegments: 24,
    });
    head.translate(-0.06, 0, -0.115);
    body.push(head);
    // Carved mane, eyes, nostrils and a bridle line, visible on both sides.
    for (let i = 0; i < 7; i++) {
      body.push(
        new THREE.BoxGeometry(0.05, 0.045, 0.285)
          .rotateZ(-0.25)
          .translate(-0.22 + i * 0.017, 0.66 + i * 0.067, 0),
      );
    }
    for (const z of [-0.152, 0.152]) {
      detail.push(
        sphere(0.025, 0.125, 1.075, z),
        sphere(0.014, 0.282, 0.893, z),
      );
      trim.push(
        new THREE.BoxGeometry(0.245, 0.012, 0.012)
          .rotateZ(-0.3)
          .translate(0.14, 0.925, z),
      );
    }
  }
  return {
    body: merged(body),
    trim: merged(trim),
    detail: detail.length ? merged(detail) : undefined,
  };
}
// Geometry is shared by all pieces of a set, keeping GPU work small.
const geometries = new Map<string, ReturnType<typeof sculpture>>();
export function PieceModel({
  type,
  color,
  set,
  materials,
}: {
  type: PieceSymbol;
  color: Color;
  set: PieceSet;
  materials: StudioMaterials;
}) {
  const model = useMemo(() => {
    const key = `${type}-${set}`;
    let g = geometries.get(key);
    if (!g) {
      g = sculpture(type, set);
      geometries.set(key, g);
    }
    return g;
  }, [type, set]);
  return (
    <group
      rotation={[
        0,
        type === "n" ? (color === "w" ? Math.PI / 2 : -Math.PI / 2) : 0,
        0,
      ]}
    >
      <mesh
        geometry={model.body}
        material={color === "w" ? materials.white : materials.black}
        castShadow
        receiveShadow
      />
      <mesh geometry={model.trim} material={materials.brass} castShadow />
      {model.detail && (
        <mesh geometry={model.detail} material={materials.detail} />
      )}
      <mesh position={[0, 0.009, 0]} material={materials.felt}>
        <cylinderGeometry
          args={[
            type === "p" ? 0.253 : 0.29,
            type === "p" ? 0.253 : 0.29,
            0.025,
            48,
          ]}
        />
      </mesh>
    </group>
  );
}
