import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { z } from "zod";

type Choice = {
  id: string;
  text: string;
};

type Question = {
  id: string;
  prompt: string;
  choices: Choice[];
  correctChoiceId: string;
};

type MapId = "village" | "prison" | "laser";
type PlayerStatus = "lobby" | "countdown" | "playing" | "finished";
type RoomPhase = "lobby" | "countdown" | "playing" | "podium";

type Player = {
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

type Room = {
  id: string;
  hostSocketId: string;
  deck: Question[];
  players: Record<string, Player>;
  phase: RoomPhase;
  started: boolean;
  createdAt: number;
  countdownEndsAt?: number;
};

const rooms: Record<string, Room> = {};
const countdownTimers: Record<string, NodeJS.Timeout> = {};

const COUNTDOWN_MS = 4000;

const defaultDeck: Question[] = [
  {
    id: "q1",
    prompt: "What is 7 × 8?",
    choices: [
      { id: "a", text: "54" },
      { id: "b", text: "56" },
      { id: "c", text: "64" }
    ],
    correctChoiceId: "b"
  },
  {
    id: "q2",
    prompt: "Which gas do plants absorb for photosynthesis?",
    choices: [
      { id: "a", text: "Oxygen" },
      { id: "b", text: "Carbon dioxide" },
      { id: "c", text: "Nitrogen" }
    ],
    correctChoiceId: "b"
  },
  {
    id: "q3",
    prompt: "What is the capital of Japan?",
    choices: [
      { id: "a", text: "Seoul" },
      { id: "b", text: "Kyoto" },
      { id: "c", text: "Tokyo" },
      { id: "d", text: "Osaka" }
    ],
    correctChoiceId: "c"
  }
];

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function publicRoom(room: Room) {
  return {
    id: room.id,
    started: room.started,
    phase: room.phase,
    playerCount: Object.keys(room.players).length,
    deckSize: room.deck.length,
    countdownEndsAt: room.countdownEndsAt
  };
}

function leaderboard(room: Room) {
  return Object.values(room.players)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.finishedAt ?? Number.MAX_SAFE_INTEGER) - (b.finishedAt ?? Number.MAX_SAFE_INTEGER);
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      correct: p.correct,
      wrong: p.wrong,
      deaths: p.deaths,
      status: p.status,
      progress: `${Math.min(p.currentQuestionIndex, room.deck.length)}/${room.deck.length}`
    }));
}

function hostDashboard(room: Room) {
  const totalQuestions = room.deck.length;
  return {
    room: publicRoom(room),
    leaderboard: leaderboard(room),
    players: Object.values(room.players).map((p) => ({
      id: p.id,
      name: p.name,
      mapId: p.mapId,
      score: p.score,
      correct: p.correct,
      wrong: p.wrong,
      deaths: p.deaths,
      status: p.status,
      currentQuestionIndex: Math.min(p.currentQuestionIndex, totalQuestions),
      totalQuestions,
      progressPct: totalQuestions === 0 ? 0 : Math.round((Math.min(p.currentQuestionIndex, totalQuestions) / totalQuestions) * 100),
      finishedAt: p.finishedAt
    }))
  };
}

function emitRoomState(room: Room) {
  io.to(room.id).emit("room-updated", publicRoom(room));
  io.to(room.id).emit("leaderboard", leaderboard(room));
  io.to(room.id).emit("host-dashboard", hostDashboard(room));
}

function resetPlayersForCountdown(room: Room) {
  for (const player of Object.values(room.players)) {
    player.score = 0;
    player.correct = 0;
    player.wrong = 0;
    player.deaths = 0;
    player.currentQuestionIndex = 0;
    player.status = "countdown";
    delete player.finishedAt;
  }
}

function beginCountdown(room: Room) {
  if (countdownTimers[room.id]) {
    clearTimeout(countdownTimers[room.id]);
    delete countdownTimers[room.id];
  }

  resetPlayersForCountdown(room);
  room.phase = "countdown";
  room.started = true;
  room.countdownEndsAt = Date.now() + COUNTDOWN_MS;

  io.to(room.id).emit("countdown-started", {
    room: publicRoom(room),
    deck: room.deck,
    startsAt: room.countdownEndsAt,
    seconds: Math.ceil(COUNTDOWN_MS / 1000)
  });

  emitRoomState(room);

  countdownTimers[room.id] = setTimeout(() => {
    const liveRoom = rooms[room.id];
    if (!liveRoom || liveRoom.phase !== "countdown") return;

    liveRoom.phase = "playing";
    delete liveRoom.countdownEndsAt;

    for (const player of Object.values(liveRoom.players)) {
      player.status = "playing";
      player.currentQuestionIndex = 0;
      delete player.finishedAt;
    }

    io.to(liveRoom.id).emit("game-started", {
      room: publicRoom(liveRoom),
      deck: liveRoom.deck
    });

    emitRoomState(liveRoom);
    delete countdownTimers[liveRoom.id];
  }, COUNTDOWN_MS);
}

function finishIfEveryoneDone(room: Room) {
  const players = Object.values(room.players);
  if (players.length === 0) return false;

  const allDone = players.every((p) => p.status === "finished");
  if (!allDone) return false;

  room.phase = "podium";

  const board = leaderboard(room);
  io.to(room.id).emit("game-finished", {
    room: publicRoom(room),
    leaderboard: board,
    topThree: board.slice(0, 3)
  });

  emitRoomState(room);
  return true;
}

const CreateRoomSchema = z.object({
  hostName: z.string().min(1).max(40).default("Host"),
  deck: z.array(z.object({
    id: z.string(),
    prompt: z.string().min(1),
    choices: z.array(z.object({
      id: z.string(),
      text: z.string().min(1)
    })).min(2),
    correctChoiceId: z.string()
  })).optional()
});

const JoinRoomSchema = z.object({
  roomId: z.string().min(4).max(10),
  name: z.string().min(1).max(40),
  mapId: z.enum(["village", "prison", "laser"])
});

const AnswerResultSchema = z.object({
  roomId: z.string(),
  playerId: z.string(),
  questionId: z.string(),
  correct: z.boolean(),
  killed: z.boolean().optional().default(false),
  responseMs: z.number().min(0).max(120000).default(10000)
});

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({ ok: true, rooms: Object.keys(rooms).length });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

io.on("connection", (socket) => {
  socket.on("create-room", (payload, callback) => {
    try {
      const parsed = CreateRoomSchema.parse(payload ?? {});
      let roomId = makeRoomCode();
      while (rooms[roomId]) roomId = makeRoomCode();

      const room: Room = {
        id: roomId,
        hostSocketId: socket.id,
        deck: parsed.deck?.length ? parsed.deck : defaultDeck,
        players: {},
        phase: "lobby",
        started: false,
        createdAt: Date.now()
      };

      rooms[roomId] = room;
      socket.join(roomId);

      callback?.({ ok: true, room: publicRoom(room), deck: room.deck });
      emitRoomState(room);
    } catch (error) {
      callback?.({ ok: false, error: String(error) });
    }
  });

  socket.on("update-deck", (payload, callback) => {
    const { roomId, deck } = payload ?? {};
    const room = rooms[roomId];

    if (!room) {
      callback?.({ ok: false, error: "Room not found." });
      return;
    }

    if (room.hostSocketId !== socket.id) {
      callback?.({ ok: false, error: "Only the host can update the deck." });
      return;
    }

    if (room.phase !== "lobby" && room.phase !== "podium") {
      callback?.({ ok: false, error: "You can only update the deck before the game starts or after it ends." });
      return;
    }

    room.deck = Array.isArray(deck) && deck.length ? deck : defaultDeck;
    io.to(roomId).emit("deck-updated", room.deck);
    emitRoomState(room);
    callback?.({ ok: true, deck: room.deck });
  });

  socket.on("join-room", (payload, callback) => {
    try {
      const parsed = JoinRoomSchema.parse(payload);
      const room = rooms[parsed.roomId];

      if (!room) {
        callback?.({ ok: false, error: "Room not found." });
        return;
      }

      if (room.phase !== "lobby") {
        callback?.({ ok: false, error: "This game has already started. Ask the host to restart." });
        return;
      }

      const playerId = makeId("player");
      const player: Player = {
        id: playerId,
        socketId: socket.id,
        name: parsed.name,
        mapId: parsed.mapId,
        score: 0,
        correct: 0,
        wrong: 0,
        deaths: 0,
        currentQuestionIndex: 0,
        status: "lobby"
      };

      room.players[playerId] = player;
      socket.join(room.id);

      callback?.({
        ok: true,
        room: publicRoom(room),
        player,
        deck: room.deck,
        leaderboard: leaderboard(room),
        dashboard: hostDashboard(room)
      });

      emitRoomState(room);
    } catch (error) {
      callback?.({ ok: false, error: String(error) });
    }
  });

  socket.on("start-game", (payload, callback) => {
    const { roomId } = payload ?? {};
    const room = rooms[roomId];

    if (!room) {
      callback?.({ ok: false, error: "Room not found." });
      return;
    }

    if (room.hostSocketId !== socket.id) {
      callback?.({ ok: false, error: "Only the host can start the game." });
      return;
    }

    if (Object.keys(room.players).length === 0) {
      callback?.({ ok: false, error: "No players have joined yet." });
      return;
    }

    beginCountdown(room);
    callback?.({ ok: true, room: publicRoom(room), dashboard: hostDashboard(room) });
  });

  socket.on("restart-game", (payload, callback) => {
    const { roomId } = payload ?? {};
    const room = rooms[roomId];

    if (!room) {
      callback?.({ ok: false, error: "Room not found." });
      return;
    }

    if (room.hostSocketId !== socket.id) {
      callback?.({ ok: false, error: "Only the host can restart the game." });
      return;
    }

    if (Object.keys(room.players).length === 0) {
      callback?.({ ok: false, error: "No players are in the room." });
      return;
    }

    beginCountdown(room);
    callback?.({ ok: true, room: publicRoom(room), dashboard: hostDashboard(room) });
  });

  socket.on("end-game", (payload, callback) => {
    const { roomId } = payload ?? {};
    const room = rooms[roomId];

    if (!room) {
      callback?.({ ok: false, error: "Room not found." });
      return;
    }

    if (room.hostSocketId !== socket.id) {
      callback?.({ ok: false, error: "Only the host can end the game." });
      return;
    }

    if (countdownTimers[room.id]) {
      clearTimeout(countdownTimers[room.id]);
      delete countdownTimers[room.id];
    }

    io.to(room.id).emit("return-home", {
      reason: "Host ended the game."
    });

    delete rooms[room.id];
    callback?.({ ok: true });
  });

  socket.on("answer-result", (payload, callback) => {
    try {
      const parsed = AnswerResultSchema.parse(payload);
      const room = rooms[parsed.roomId];

      if (!room) {
        callback?.({ ok: false, error: "Room not found." });
        return;
      }

      const player = room.players[parsed.playerId];
      if (!player || player.socketId !== socket.id) {
        callback?.({ ok: false, error: "Player not found." });
        return;
      }

      if (room.phase !== "playing" || player.status !== "playing") {
        callback?.({ ok: false, error: "Game is not currently accepting answers." });
        return;
      }

      if (parsed.killed) {
        player.score -= 50;
        player.deaths += 1;
      } else if (parsed.correct) {
        const speedBonus = Math.max(10, Math.round(320 - parsed.responseMs / 25));
        player.score += speedBonus;
        player.correct += 1;
      } else {
        player.wrong += 1;
      }

      const nextIndex = player.currentQuestionIndex + 1;
      player.currentQuestionIndex = nextIndex;

      if (nextIndex >= room.deck.length) {
        player.status = "finished";
        player.finishedAt = Date.now();
      }

      const board = leaderboard(room);
      io.to(room.id).emit("leaderboard", board);
      io.to(room.id).emit("host-dashboard", hostDashboard(room));

      callback?.({
        ok: true,
        player,
        leaderboard: board,
        finished: player.status === "finished"
      });

      finishIfEveryoneDone(room);
    } catch (error) {
      callback?.({ ok: false, error: String(error) });
    }
  });

  socket.on("disconnect", () => {
    for (const room of Object.values(rooms)) {
      for (const player of Object.values(room.players)) {
        if (player.socketId === socket.id) {
          delete room.players[player.id];
          emitRoomState(room);
        }
      }

      if (room.hostSocketId === socket.id) {
        io.to(room.id).emit("host-disconnected");
      }

      if (room.phase === "playing" || room.phase === "countdown") {
        finishIfEveryoneDone(room);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`Quiz Shooter server running on http://localhost:${PORT}`);
});
