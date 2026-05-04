import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { MapId, Question } from "../types";
import { dist, inRect, maps, type Vec2 } from "./gameConfig";

type Monster = {
  id: string;
  choiceId: string;
  answerText: string;
  position: Vec2;
  color: string;
  speed: number;
  frozenUntil: number;
};

type HitResult = {
  kind: "correct" | "wrong" | "killed" | "hazard";
  label: string;
  responseMs: number;
};

function spawnMonsters(question: Question, mapId: MapId): Monster[] {
  const map = maps[mapId];
  const spawnPoints: Vec2[] = [
    [-9, -6],
    [9, 6],
    [-9, 6],
    [9, -6],
    [0, -8],
    [0, 8]
  ];

  return question.choices.map((choice, index) => ({
    id: `monster-${question.id}-${choice.id}`,
    choiceId: choice.id,
    answerText: choice.text,
    position: spawnPoints[index % spawnPoints.length],
    color: map.monsterColors[index % map.monsterColors.length],
    speed: 0.7 + index * 0.06,
    frozenUntil: 0
  }));
}

function ArenaObject({
  position,
  size,
  color,
  label
}: {
  position: Vec2;
  size: Vec2;
  color: string;
  label?: string;
}) {
  return (
    <group position={[position[0], 0.35, position[1]]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size[0], 0.7, size[1]]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} />
      </mesh>
      {label && (
        <Billboard position={[0, 1.05, 0]}>
          <Text fontSize={0.32} color="white" outlineWidth={0.02} outlineColor="black">
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

function Civilian({
  position,
  color,
  label
}: {
  position: Vec2;
  color: string;
  label: string;
}) {
  return (
    <group position={[position[0], 0.5, position[1]]}>
      <mesh castShadow>
        <capsuleGeometry args={[0.32, 0.7, 6, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Billboard position={[0, 1.2, 0]}>
        <Text fontSize={0.32} color="white" outlineWidth={0.02} outlineColor="black">
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

function Player({ position, color, aim }: { position: Vec2; color: string; aim: Vec2 }) {
  const angle = Math.atan2(aim[0] - position[0], aim[1] - position[1]);
  return (
    <group position={[position[0], 0.6, position[1]]} rotation={[0, angle, 0]}>
      <mesh castShadow>
        <capsuleGeometry args={[0.42, 0.8, 8, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 0.15, 0.78]} castShadow>
        <boxGeometry args={[0.22, 0.18, 0.85]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.4} roughness={0.25} />
      </mesh>
    </group>
  );
}

function MonsterMesh({ monster }: { monster: Monster }) {
  const bob = useRef(0);

  useFrame((_, delta) => {
    bob.current += delta;
  });

  return (
    <group position={[monster.position[0], 0.62 + Math.sin(bob.current * 5) * 0.05, monster.position[1]]}>
      <mesh castShadow>
        <sphereGeometry args={[0.58, 24, 24]} />
        <meshStandardMaterial
          color={monster.color}
          emissive={monster.color}
          emissiveIntensity={0.16}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0.18, 0.18, 0.48]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[-0.18, 0.18, 0.48]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <Billboard position={[0, 1.05, 0]}>
        <Text
          maxWidth={3.2}
          textAlign="center"
          fontSize={0.36}
          color="white"
          outlineWidth={0.035}
          outlineColor="black"
        >
          {monster.answerText}
        </Text>
      </Billboard>
    </group>
  );
}

function LaserBeam({ from, to }: { from: Vec2; to: Vec2 }) {
  const direction = new THREE.Vector3(to[0] - from[0], 0, to[1] - from[1]);
  const length = direction.length();
  const angle = Math.atan2(direction.x, direction.z);

  return (
    <mesh position={[(from[0] + to[0]) / 2, 0.88, (from[1] + to[1]) / 2]} rotation={[0, angle, 0]}>
      <boxGeometry args={[0.08, 0.08, length]} />
      <meshBasicMaterial color="#fef08a" transparent opacity={0.95} />
    </mesh>
  );
}

function MouseAimController({
  setAim
}: {
  setAim: (aim: Vec2) => void;
}) {
  const { camera, gl } = useThree();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    function onMove(event: MouseEvent) {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      raycaster.ray.intersectPlane(plane, hit);
      setAim([hit.x, hit.z]);
    }

    gl.domElement.addEventListener("mousemove", onMove);
    return () => gl.domElement.removeEventListener("mousemove", onMove);
  }, [camera, gl, hit, mouse, plane, raycaster, setAim]);

  return null;
}

function CameraRig() {
  const { camera } = useThree();

  useEffect(() => {
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return null;
}

function GameScene({
  mapId,
  question,
  onResult
}: {
  mapId: MapId;
  question: Question;
  onResult: (result: HitResult) => void;
}) {
  const map = maps[mapId];
  const [player, setPlayer] = useState<Vec2>([0, 0]);
  const [aim, setAim] = useState<Vec2>([0, -1]);
  const [monsters, setMonsters] = useState<Monster[]>(() => spawnMonsters(question, mapId));
  const [beam, setBeam] = useState<{ from: Vec2; to: Vec2; until: number } | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const startTime = useRef(Date.now());
  const resolved = useRef(false);

  useEffect(() => {
    setPlayer([0, 0]);
    setAim([0, -1]);
    setMonsters(spawnMonsters(question, mapId));
    startTime.current = Date.now();
    resolved.current = false;
    setBeam(null);
  }, [question, mapId]);

  const inBlindSpot = map.blindSpots.some((spot) => dist(player, spot.position) < spot.radius);

  useEffect(() => {
    function down(event: KeyboardEvent) {
      keys.current[event.key.toLowerCase()] = true;
    }

    function up(event: KeyboardEvent) {
      keys.current[event.key.toLowerCase()] = false;
    }

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  function resolve(result: Omit<HitResult, "responseMs">) {
    if (resolved.current) return;
    resolved.current = true;
    onResult({
      ...result,
      responseMs: Date.now() - startTime.current
    });
  }

  function shoot() {
    if (resolved.current) return;

    if (inBlindSpot) {
      setBeam(null);
      return;
    }

    const from = player;
    const to = aim;
    setBeam({ from, to, until: Date.now() + 120 });

    let closest: { kind: "monster" | "civilian"; id: string; distance: number } | null = null;

    const ray = new THREE.Ray(
      new THREE.Vector3(from[0], 0, from[1]),
      new THREE.Vector3(to[0] - from[0], 0, to[1] - from[1]).normalize()
    );

    function distanceToPoint(point: Vec2) {
      const p = new THREE.Vector3(point[0], 0, point[1]);
      const target = new THREE.Vector3();
      ray.closestPointToPoint(p, target);
      const lineDistance = target.distanceTo(p);
      const forwardDistance = target.distanceTo(ray.origin);
      return { lineDistance, forwardDistance };
    }

    for (const civ of map.civilians) {
      const d = distanceToPoint(civ.position);
      if (d.lineDistance < 0.58 && d.forwardDistance < 18) {
        if (!closest || d.forwardDistance < closest.distance) {
          closest = { kind: "civilian", id: civ.id, distance: d.forwardDistance };
        }
      }
    }

    for (const monster of monsters) {
      const d = distanceToPoint(monster.position);
      if (d.lineDistance < 0.78 && d.forwardDistance < 18) {
        if (!closest || d.forwardDistance < closest.distance) {
          closest = { kind: "monster", id: monster.id, distance: d.forwardDistance };
        }
      }
    }

    if (!closest) return;

    if (closest.kind === "civilian") {
      resolve({ kind: "hazard", label: "You hit a protected target. Penalty!" });
      return;
    }

    const monster = monsters.find((m) => m.id === closest?.id);
    if (!monster) return;

    const correct = monster.choiceId === question.correctChoiceId;

    if (correct) {
      resolve({ kind: "correct", label: "Correct hit!" });
    } else {
      resolve({ kind: "wrong", label: `Wrong answer: ${monster.answerText}` });
    }
  }

  useEffect(() => {
    window.addEventListener("click", shoot);
    return () => window.removeEventListener("click", shoot);
  });

  useFrame((_, delta) => {
    if (resolved.current) return;

    const moveSpeed = 5.8;
    let dx = 0;
    let dz = 0;

    if (keys.current.w || keys.current.arrowup) dz -= 1;
    if (keys.current.s || keys.current.arrowdown) dz += 1;
    if (keys.current.a || keys.current.arrowleft) dx -= 1;
    if (keys.current.d || keys.current.arrowright) dx += 1;

    if (dx || dz) {
      const len = Math.sqrt(dx * dx + dz * dz);
      const next: Vec2 = [
        Math.max(-10.5, Math.min(10.5, player[0] + (dx / len) * moveSpeed * delta)),
        Math.max(-8, Math.min(8, player[1] + (dz / len) * moveSpeed * delta))
      ];

      const blocked = map.obstacles.some((obstacle) =>
        inRect(next, obstacle.position, [obstacle.size[0] + 0.8, obstacle.size[1] + 0.8])
      );

      if (!blocked) setPlayer(next);
    }

    setMonsters((prev) =>
      prev.map((monster) => {
        const now = Date.now();
        let speed = monster.speed;

        for (const cell of map.jailCells) {
          if (inRect(monster.position, cell.position, cell.size)) {
            speed = 0.12;
          }
        }

        if (monster.frozenUntil > now) speed = 0;

        const dxm = player[0] - monster.position[0];
        const dzm = player[1] - monster.position[1];
        const len = Math.sqrt(dxm * dxm + dzm * dzm) || 1;

        const next: Vec2 = [
          monster.position[0] + (dxm / len) * speed * delta,
          monster.position[1] + (dzm / len) * speed * delta
        ];

        return { ...monster, position: next };
      })
    );

    const caught = monsters.some((monster) => dist(monster.position, player) < 0.85);
    if (caught) {
      resolve({ kind: "killed", label: "A monster got you. Respawning!" });
    }

    if (beam && Date.now() > beam.until) setBeam(null);
  });

  return (
    <>
      <color attach="background" args={[map.fogColor]} />
      <fog attach="fog" args={[map.fogColor, 18, 40]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[8, 18, 10]} intensity={1.3} castShadow />
      {mapId === "laser" && <Stars radius={55} depth={20} count={1200} factor={4} fade speed={1.5} />}

      <CameraRig />
      <MouseAimController setAim={setAim} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 19]} />
        <meshStandardMaterial color={map.floorColor} roughness={0.8} />
      </mesh>

      <gridHelper args={[24, 24, "#64748b", "#1e293b"]} position={[0, 0.02, 0]} />

      {map.obstacles.map((obstacle) => (
        <ArenaObject key={obstacle.id} {...obstacle} />
      ))}

      {map.civilians.map((civilian) => (
        <Civilian key={civilian.id} {...civilian} />
      ))}

      {map.jailCells.map((cell) => (
        <group key={cell.id} position={[cell.position[0], 0.08, cell.position[1]]}>
          <mesh>
            <boxGeometry args={[cell.size[0], 0.15, cell.size[1]]} />
            <meshStandardMaterial color="#0f172a" emissive="#38bdf8" emissiveIntensity={0.4} wireframe />
          </mesh>
          <Billboard position={[0, 0.8, 0]}>
            <Text fontSize={0.28} color="#bae6fd" outlineWidth={0.02} outlineColor="black">
              Jail Cell
            </Text>
          </Billboard>
        </group>
      ))}

      {map.blindSpots.map((spot) => (
        <group key={spot.id} position={[spot.position[0], 0.05, spot.position[1]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[spot.radius, 40]} />
            <meshBasicMaterial color="#ec4899" transparent opacity={0.22} />
          </mesh>
          <Billboard position={[0, 0.7, 0]}>
            <Text fontSize={0.26} color="#fbcfe8" outlineWidth={0.02} outlineColor="black">
              Blind Spot
            </Text>
          </Billboard>
        </group>
      ))}

      <Player position={player} color={map.playerColor} aim={aim} />

      {monsters.map((monster) => (
        <MonsterMesh key={monster.id} monster={monster} />
      ))}

      {beam && <LaserBeam from={beam.from} to={beam.to} />}

      {inBlindSpot && (
        <Billboard position={[player[0], 2.2, player[1]]}>
          <Text fontSize={0.32} color="#fbcfe8" outlineWidth={0.02} outlineColor="black">
            GUN DISABLED
          </Text>
        </Billboard>
      )}
    </>
  );
}

export default function GameCanvas({
  mapId,
  question,
  onResult
}: {
  mapId: MapId;
  question: Question;
  onResult: (result: HitResult) => void;
}) {
  return (
    <Canvas shadows camera={{ position: [0, 15, 14], fov: 47 }}>
      <GameScene mapId={mapId} question={question} onResult={onResult} />
    </Canvas>
  );
}
