import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { OrbitControls as Controls } from "three-stdlib";
import * as THREE from "three";
import { Chess, type Square } from "chess.js";
import { Camera, RotateCcw, Sun, Moon, Sparkles, Move3D } from "lucide-react";
import type { PieceSet } from "../components/Piece";
import { readStorage, writeStorage } from "../game/storage";
import {
  MOVE_SECONDS,
  positionSquare,
  reconcilePieces,
  squarePosition,
  type BoardPiece,
} from "./board";
import { makeMaterials, type StudioMaterials } from "./materials";
import { PieceModel } from "./PieceModel";

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduced;
}
type Lighting = "day" | "evening" | "gallery";
type Props = {
  fen: string;
  selected: Square | null;
  legal: Square[];
  showLegal: boolean;
  lastMove?: { from: Square; to: Square };
  hint: { from: string; to: string } | null;
  flipped: boolean;
  set: PieceSet;
  light: string;
  dark: string;
  canPlay: boolean;
  onSquare: (square: Square) => void;
  onDrop: (from: Square, to: Square) => void;
  onInteract: () => void;
  onFallback: () => void;
};
class SceneBoundary extends Component<
  { children: ReactNode; fallback: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        <p>Die 3D-Ansicht ist auf diesem Gerät nicht verfügbar.</p>
        <button className="secondary-button" onClick={this.props.fallback}>
          In 2D weiterspielen
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Environment() {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.55;
    invalidate();
    return () => {
      scene.environment = null;
      target.dispose();
      generator.dispose();
      room.dispose();
    };
  }, [gl, scene, invalidate]);
  return null;
}
function CameraRig({
  flipped,
  reset,
  overhead,
  dragging,
}: {
  flipped: boolean;
  reset: number;
  overhead: boolean;
  dragging: boolean;
}) {
  const reduced = useReducedMotion();
  const control = useRef<Controls>(null),
    target = useRef(new THREE.Vector3());
  const animating = useRef(true);
  const { camera, invalidate } = useThree();
  useEffect(() => {
    const sign = flipped ? -1 : 1;
    target.current.set(
      overhead ? 0 : 5.8 * sign,
      overhead ? 18.5 : 11.8,
      overhead ? 0.2 * sign : 12.6 * sign,
    );
    animating.current = true;
    invalidate();
  }, [flipped, reset, overhead, invalidate]);
  useFrame((_, dt) => {
    if (!animating.current) return;
    camera.position.lerp(target.current, reduced ? 1 : 1 - Math.exp(-dt * 7));
    control.current?.target.lerp(
      new THREE.Vector3(0, 0.15, 0),
      1 - Math.exp(-dt * 7),
    );
    control.current?.update();
    if (camera.position.distanceTo(target.current) < 0.015)
      animating.current = false;
    invalidate();
  });
  return (
    <OrbitControls
      ref={control}
      enabled={!dragging}
      makeDefault
      enablePan={false}
      minDistance={10}
      maxDistance={25}
      minPolarAngle={0.01}
      maxPolarAngle={Math.PI / 2.35}
      enableDamping={!reduced}
      dampingFactor={0.12}
      onStart={() => {
        animating.current = false;
      }}
      target={[0, 0.15, 0]}
    />
  );
}
function Lettering() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#d5b77c";
    ctx.font = "18px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const map = (v: number) => ((v + 4.5) / 9) * 1024;
    for (let i = 0; i < 8; i++) {
      ctx.fillText("abcdefgh"[i], map(i - 3.5), map(4.27));
      ctx.save();
      ctx.translate(map(i - 3.5), map(-4.27));
      ctx.rotate(Math.PI);
      ctx.fillText("abcdefgh"[i], 0, 0);
      ctx.restore();
      ctx.fillText(String(8 - i), map(-4.27), map(i - 3.5));
      ctx.fillText(String(8 - i), map(4.27), map(i - 3.5));
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh
      position={[0, 0.185, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={() => null}
    >
      <planeGeometry args={[9, 9]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
function AnimatedPiece({
  piece,
  materials,
  set,
  drag,
}: {
  piece: BoardPiece;
  materials: StudioMaterials;
  set: PieceSet;
  drag: { square: Square; x: number; z: number } | null;
}) {
  const reduced = useReducedMotion();
  const group = useRef<THREE.Group>(null);
  const [x, z] = squarePosition(piece.square);
  const initial = useRef<[number, number, number]>([x, 0.18, z]);
  const to = useRef(new THREE.Vector3(x, 0.18, z)),
    start = useRef(to.current.clone()),
    progress = useRef(1);
  const { invalidate } = useThree();
  useEffect(() => {
    start.current.copy(group.current?.position ?? to.current);
    to.current.set(x, 0.18, z);
    if (start.current.distanceTo(to.current) > 0.01) progress.current = 0;
    invalidate();
  }, [x, z, invalidate]);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (drag?.square === piece.square) {
      g.position.set(drag.x, 0.7, drag.z);
      invalidate();
      return;
    }
    if (progress.current < 1) {
      progress.current = reduced
        ? 1
        : Math.min(1, progress.current + dt / MOVE_SECONDS[piece.type]);
      const p = progress.current,
        eased = p * p * (3 - 2 * p);
      g.position.lerpVectors(start.current, to.current, eased);
      g.position.y +=
        Math.sin(p * Math.PI) *
        (piece.type === "n" ? 0.95 : piece.type === "r" ? 0.12 : 0.32);
      g.rotation.z =
        Math.sin(p * Math.PI * 2) * (piece.type === "n" ? 0.06 : 0.015);
      invalidate();
    } else if (g.position.distanceTo(to.current) > 0.01) {
      g.position.lerp(to.current, Math.min(1, dt * 15));
      invalidate();
    } else {
      g.position.copy(to.current);
      g.rotation.z = 0;
    }
  });
  return (
    <group ref={group} position={initial.current}>
      <PieceModel
        type={piece.type}
        color={piece.color}
        set={set}
        materials={materials}
      />
    </group>
  );
}
function Scene(
  props: Props & {
    lighting: Lighting;
    quality: boolean;
    reset: number;
    overhead: boolean;
  },
) {
  const {
    fen,
    light,
    dark,
    set,
    selected,
    legal,
    showLegal,
    lastMove,
    hint,
    canPlay,
    lighting,
    quality,
  } = props;
  const game = useMemo(() => new Chess(fen), [fen]);
  const pieces = useRef<BoardPiece[]>([]),
    previousFen = useRef("");
  if (previousFen.current !== fen) {
    pieces.current = reconcilePieces(pieces.current, fen);
    previousFen.current = fen;
  }
  const materials = useMemo(
    () => makeMaterials(light, dark, set),
    [light, dark, set],
  );
  useEffect(() => () => materials.dispose(), [materials]);
  const [drag, setDrag] = useState<{
    square: Square;
    x: number;
    z: number;
  } | null>(null);
  const gesture = useRef<{
    square: Square;
    px: number;
    py: number;
    active: boolean;
  } | null>(null);
  const { invalidate, gl } = useThree();
  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.18),
    [],
  );
  const point = useMemo(() => new THREE.Vector3(), []);
  const refs = useRef(props);
  refs.current = props;
  useEffect(() => {
    setDrag(null);
    gesture.current = null;
  }, [fen, canPlay]);
  useEffect(() => {
    const cancel = () => {
      gesture.current = null;
      setDrag(null);
    };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, []);
  const pointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || !canPlay) return;
    const square = positionSquare(e.point.x, e.point.z);
    if (!square) return;
    const piece = game.get(square);
    if (!piece || piece.color !== game.turn()) return;
    e.stopPropagation();
    props.onInteract();
    gesture.current = {
      square,
      px: e.nativeEvent.clientX,
      py: e.nativeEvent.clientY,
      active: false,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    // Disable orbit immediately when a piece is held; empty table remains the orbit handle.
    const [x, z] = squarePosition(square);
    setDrag({ square, x, z });
  };
  const pointerMove = (e: ThreeEvent<PointerEvent>) => {
    const g = gesture.current;
    if (!g) return;
    e.stopPropagation();
    if (
      Math.hypot(e.nativeEvent.clientX - g.px, e.nativeEvent.clientY - g.py) > 5
    )
      g.active = true;
    if (g.active && e.ray.intersectPlane(plane, point))
      setDrag({
        square: g.square,
        x: THREE.MathUtils.clamp(point.x, -4.3, 4.3),
        z: THREE.MathUtils.clamp(point.z, -4.3, 4.3),
      });
  };
  const pointerUp = (e: ThreeEvent<PointerEvent>) => {
    const g = gesture.current;
    if (!g) return;
    e.stopPropagation();
    gesture.current = null;
    setDrag(null);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    if (g.active && e.ray.intersectPlane(plane, point)) {
      const target = positionSquare(point.x, point.z);
      if (target && target !== g.square) props.onDrop(g.square, target);
    } else props.onSquare(g.square);
  };
  const evening = lighting === "evening",
    gallery = lighting === "gallery";
  useEffect(() => {
    invalidate();
  }, [lighting, quality, invalidate]);
  useEffect(() => {
    const lost = (e: Event) => {
      e.preventDefault();
      refs.current.onFallback();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl]);
  const checked = game.isCheck()
    ? pieces.current.find((p) => p.type === "k" && p.color === game.turn())
        ?.square
    : null;
  return (
    <>
      <color
        attach="background"
        args={[evening ? "#262b2a" : gallery ? "#dedbd4" : "#e8e8df"]}
      />
      <fog
        attach="fog"
        args={[evening ? "#262b2a" : gallery ? "#dedbd4" : "#e8e8df", 27, 65]}
      />
      <Environment />
      <hemisphereLight
        args={[
          evening ? "#a5b9d4" : "#e9f0ff",
          evening ? "#4a3428" : "#b5a58c",
          evening ? 0.8 : 1.25,
        ]}
      />
      <directionalLight
        position={[-6, 11, 5]}
        color={evening ? "#ffd09a" : "#fff0d8"}
        intensity={evening ? 3 : 3.6}
        castShadow
        shadow-mapSize={[quality ? 4096 : 2048, quality ? 4096 : 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={1}
        shadow-camera-far={28}
        shadow-radius={4}
      />
      <directionalLight
        position={[7, 6, -6]}
        color={evening ? "#9caee8" : "#d7e5fa"}
        intensity={evening ? 1.7 : 2}
      />
      <rectAreaLight
        position={[0, 7, -4]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={9}
        height={5}
        intensity={3}
        color="#fff8eb"
      />
      <CameraRig
        flipped={props.flipped}
        reset={props.reset}
        overhead={props.overhead}
        dragging={Boolean(drag)}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.49, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color={evening ? "#313431" : gallery ? "#c1bdb2" : "#d2d4c8"}
          roughness={0.94}
        />
      </mesh>
      <RoundedBox
        args={[9.06, 0.38, 9.06]}
        radius={0.08}
        smoothness={4}
        position={[0, -0.1, 0]}
        material={materials.edge}
        castShadow
        receiveShadow
      />
      <RoundedBox
        args={[8.98, 0.17, 8.98]}
        radius={0.045}
        smoothness={3}
        position={[0, 0.082, 0]}
        material={materials.frame}
        castShadow
        receiveShadow
      />
      <mesh position={[0, -0.326, 0]} material={materials.brass}>
        <boxGeometry args={[8.9, 0.015, 8.9]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[
            i < 2 ? (i === 0 ? -4.055 : 4.055) : 0,
            0.178,
            i >= 2 ? (i === 2 ? -4.055 : 4.055) : 0,
          ]}
          material={materials.brass}
        >
          <boxGeometry
            args={i < 2 ? [0.018, 0.008, 8.13] : [8.13, 0.008, 0.018]}
          />
        </mesh>
      ))}
      {Array.from({ length: 64 }, (_, i) => {
        const square = `${"abcdefgh"[i % 8]}${8 - Math.floor(i / 8)}` as Square;
        const [x, z] = squarePosition(square);
        const marked =
          selected === square || hint?.from === square || hint?.to === square;
        const last = lastMove?.from === square || lastMove?.to === square;
        return (
          <group key={square} position={[x, 0, z]}>
            <mesh
              position={[0, 0.103, 0]}
              material={
                (i + Math.floor(i / 8)) % 2 === 0
                  ? materials.light
                  : materials.dark
              }
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                if (
                  !gesture.current &&
                  canPlay &&
                  !(game.get(square)?.color === game.turn())
                ) {
                  props.onInteract();
                  props.onSquare(square);
                }
              }}
            >
              <boxGeometry args={[0.998, 0.145, 0.998]} />
            </mesh>
            {(marked || last || checked === square) && (
              <mesh
                position={[0, 0.181, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                raycast={() => null}
              >
                <planeGeometry args={[0.98, 0.98]} />
                <meshBasicMaterial
                  color={
                    checked === square
                      ? "#c8553c"
                      : marked
                        ? "#d3b762"
                        : "#d2c68a"
                  }
                  transparent
                  opacity={checked === square ? 0.46 : marked ? 0.4 : 0.18}
                  depthWrite={false}
                />
              </mesh>
            )}
            {showLegal && legal.includes(square) && (
              <mesh
                position={[0, 0.19, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                raycast={() => null}
              >
                {game.get(square) ? (
                  <ringGeometry args={[0.38, 0.425, 48]} />
                ) : (
                  <circleGeometry args={[0.105, 32]} />
                )}
                <meshBasicMaterial
                  color="#47603c"
                  transparent
                  opacity={0.65}
                  depthWrite={false}
                />
              </mesh>
            )}
          </group>
        );
      })}
      <Lettering />
      {/* One event surface sits above each occupied square; sculpture rays pass to it. */}
      {pieces.current.map((piece) => (
        <group
          key={piece.id}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={() => {
            gesture.current = null;
            setDrag(null);
          }}
          onLostPointerCapture={() => {
            gesture.current = null;
            setDrag(null);
          }}
        >
          <AnimatedPiece
            piece={piece}
            materials={materials}
            set={set}
            drag={drag}
          />
          <mesh
            position={[
              squarePosition(piece.square)[0],
              0.83,
              squarePosition(piece.square)[1],
            ]}
            visible={false}
          >
            <boxGeometry args={[0.8, 1.5, 0.8]} />
            <meshBasicMaterial />
          </mesh>
        </group>
      ))}
      <mesh
        visible={false}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        position={[0, 0.18, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
export default function ChessBoard3D(props: Props) {
  const [lighting, setLighting] = useState<Lighting>(() =>
    readStorage("atelier-lighting", "day"),
  );
  const [quality, setQuality] = useState(() =>
    readStorage("atelier-quality", true),
  );
  const [reset, setReset] = useState(0),
    [overhead, setOverhead] = useState(false);
  useEffect(() => {
    writeStorage("atelier-lighting", lighting);
    writeStorage("atelier-quality", quality);
  }, [lighting, quality]);
  return (
    <div className="studio">
      <div
        className="studio-scene"
        aria-label="Dreidimensionales Schachbrett. Figuren anklicken oder ziehen. Leeren Hintergrund ziehen, um die Kamera zu drehen."
      >
        <SceneBoundary fallback={props.onFallback}>
          <Canvas
            shadows={{ type: THREE.PCFShadowMap }}
            frameloop="demand"
            dpr={[1, quality ? 2 : 1.25]}
            camera={{
              position: [5.8, 11.8, 12.6],
              fov: 36,
              near: 0.1,
              far: 100,
            }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: "high-performance",
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 0.92,
            }}
            fallback={
              <div className="scene-fallback">
                <p>WebGL ist nicht verfügbar.</p>
                <button className="secondary-button" onClick={props.onFallback}>
                  In 2D weiterspielen
                </button>
              </div>
            }
          >
            <Scene
              {...props}
              lighting={lighting}
              quality={quality}
              reset={reset}
              overhead={overhead}
            />
          </Canvas>
        </SceneBoundary>
        <span className="studio-signature">
          <Move3D size={12} /> ATELIER / 3D
        </span>
      </div>
      <div className="studio-controls">
        <div className="studio-lighting">
          {lighting === "evening" ? (
            <Moon size={14} />
          ) : lighting === "gallery" ? (
            <Sparkles size={14} />
          ) : (
            <Sun size={14} />
          )}
          <select
            aria-label="Lichtstimmung"
            value={lighting}
            onChange={(e) => setLighting(e.target.value as Lighting)}
          >
            <option value="day">Tageslicht</option>
            <option value="evening">Abendlicht</option>
            <option value="gallery">Galerie</option>
          </select>
        </div>
        <div className="studio-camera-tools">
          <button
            aria-label={overhead ? "Perspektive ansehen" : "Ansicht von oben"}
            title={overhead ? "Perspektive" : "Von oben"}
            aria-pressed={overhead}
            onClick={() => setOverhead((v) => !v)}
          >
            <Camera size={15} />
            <span>{overhead ? "Perspektive" : "Von oben"}</span>
          </button>
          <button
            aria-label="Kamera zurücksetzen"
            title="Kamera zurücksetzen"
            onClick={() => {
              setOverhead(false);
              setReset((v) => v + 1);
            }}
          >
            <RotateCcw size={14} />
          </button>
          <select
            aria-label="Grafikqualität"
            value={quality ? "high" : "balanced"}
            onChange={(e) => setQuality(e.target.value === "high")}
          >
            <option value="high">Hohe Qualität</option>
            <option value="balanced">Flüssiger</option>
          </select>
        </div>
      </div>
    </div>
  );
}
