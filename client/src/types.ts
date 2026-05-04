export type MapId = "village" | "prison" | "laser";
export type PlayerStatus = "lobby" | "countdown" | "playing" | "finished";
export type RoomPhase = "lobby" | "countdown" | "playing" | "podium";

export type Choice = {
  id: string;
  text: string;
};

export type Question = {
  id: string;
  prompt: string;
  choices: Choice[];
  correctChoiceId: string;
};

export type Player = {
  id: string;
  socketId: string;
  name: string;
  mapId: MapId;
  score: number;
  correct: number;
  wrong: number;
  deaths: number;
  currentQuestionIndex: number;
  status: PlayerStatus;
  finishedAt?: number;
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  correct: number;
  wrong: number;
  deaths: number;
  status?: PlayerStatus;
  progress?: string;
};

export type HostDashboardPlayer = {
  id: string;
  name: string;
  mapId: MapId;
  score: number;
  correct: number;
  wrong: number;
  deaths: number;
  status: PlayerStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  progressPct: number;
  finishedAt?: number;
};

export type HostDashboard = {
  room: {
    id: string;
    started: boolean;
    phase: RoomPhase;
    playerCount: number;
    deckSize: number;
    countdownEndsAt?: number;
  };
  leaderboard: LeaderboardEntry[];
  players: HostDashboardPlayer[];
};
