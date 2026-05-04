import type { MapId } from "../types";

export type Vec2 = [number, number];

export type MapConfig = {
  id: MapId;
  title: string;
  floorColor: string;
  fogColor: string;
  playerColor: string;
  monsterColors: string[];
  hazardLabel: string;
  obstacles: { id: string; position: Vec2; size: Vec2; color: string; label?: string }[];
  civilians: { id: string; position: Vec2; color: string; label: string }[];
  jailCells: { id: string; position: Vec2; size: Vec2 }[];
  blindSpots: { id: string; position: Vec2; radius: number }[];
};

export const maps: Record<MapId, MapConfig> = {
  village: {
    id: "village",
    title: "Village Defense",
    floorColor: "#355e3b",
    fogColor: "#111827",
    playerColor: "#38bdf8",
    monsterColors: ["#ef4444", "#f97316", "#a855f7", "#eab308"],
    hazardLabel: "Do not hit civilians, sheep, or houses.",
    obstacles: [
      { id: "house1", position: [-6, -3], size: [3, 2.4], color: "#92400e", label: "House" },
      { id: "house2", position: [5, 3], size: [3, 2.4], color: "#7c2d12", label: "House" },
      { id: "well", position: [0, 0], size: [1.6, 1.6], color: "#475569", label: "Well" }
    ],
    civilians: [
      { id: "villager1", position: [-2.5, 4.5], color: "#fbbf24", label: "Civilian" },
      { id: "sheep1", position: [3.5, -4.5], color: "#f8fafc", label: "Sheep" }
    ],
    jailCells: [],
    blindSpots: []
  },
  prison: {
    id: "prison",
    title: "Prison Break Quiz",
    floorColor: "#334155",
    fogColor: "#020617",
    playerColor: "#22c55e",
    monsterColors: ["#dc2626", "#7f1d1d", "#9333ea", "#f97316"],
    hazardLabel: "Avoid guards. Lure monsters into jail cells to slow them.",
    obstacles: [
      { id: "block1", position: [-4.5, 0], size: [1.2, 7], color: "#64748b", label: "Wall" },
      { id: "block2", position: [4.5, 0], size: [1.2, 7], color: "#64748b", label: "Wall" },
      { id: "desk", position: [0, -4], size: [3.5, 1], color: "#78716c", label: "Desk" }
    ],
    civilians: [
      { id: "guard1", position: [-1.5, 4], color: "#60a5fa", label: "Guard" },
      { id: "guard2", position: [2.5, -3], color: "#60a5fa", label: "Guard" }
    ],
    jailCells: [
      { id: "cell1", position: [-7, 4], size: [2.5, 2] },
      { id: "cell2", position: [7, -4], size: [2.5, 2] }
    ],
    blindSpots: []
  },
  laser: {
    id: "laser",
    title: "Neon Monster Arena",
    floorColor: "#111827",
    fogColor: "#09090b",
    playerColor: "#f0abfc",
    monsterColors: ["#06b6d4", "#ec4899", "#84cc16", "#facc15"],
    hazardLabel: "Neon blind spots hide you, but your gun does not work inside them.",
    obstacles: [
      { id: "wall1", position: [-4, -2], size: [5, 0.7], color: "#8b5cf6", label: "Neon Wall" },
      { id: "wall2", position: [4, 2], size: [5, 0.7], color: "#06b6d4", label: "Neon Wall" },
      { id: "wall3", position: [0, 5], size: [7, 0.7], color: "#ec4899", label: "Neon Wall" }
    ],
    civilians: [],
    jailCells: [],
    blindSpots: [
      { id: "blind1", position: [-6, 4], radius: 1.8 },
      { id: "blind2", position: [6, -4], radius: 1.8 },
      { id: "blind3", position: [0, 0], radius: 1.5 }
    ]
  }
};

export function dist(a: Vec2, b: Vec2) {
  const dx = a[0] - b[0];
  const dz = a[1] - b[1];
  return Math.sqrt(dx * dx + dz * dz);
}

export function inRect(point: Vec2, center: Vec2, size: Vec2) {
  return (
    point[0] >= center[0] - size[0] / 2 &&
    point[0] <= center[0] + size[0] / 2 &&
    point[1] >= center[1] - size[1] / 2 &&
    point[1] <= center[1] + size[1] / 2
  );
}
