import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import DeckEditor, { parseDeck } from "./components/DeckEditor";
import Leaderboard from "./components/Leaderboard";
import GameCanvas from "./game/GameCanvas";
import { maps } from "./game/gameConfig";
import type {
  HostDashboard,
  HostDashboardPlayer,
  LeaderboardEntry,
  MapId,
  Player,
  Question
} from "./types";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

const socket = io(SERVER_URL, {
  autoConnect: true
});

const initialDeck = parseDeck(`What is 7 × 8?
54
56 *
64

Which gas do plants absorb for photosynthesis?
Oxygen
Carbon dioxide *
Nitrogen

What is the capital of Japan?
Seoul
Kyoto
Tokyo *
Osaka`);

type Mode =
  | "landing"
  | "host"
  | "host-overview"
  | "lobby"
  | "countdown"
  | "player-game"
  | "waiting"
  | "podium";

type Role = "host" | "player" | null;

function CountdownOverlay({ endsAt }: { endsAt: number | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  return (
    <div className="countdown-screen">
      <div className="countdown-card">
        <p>Get ready</p>
        <div className="countdown-number">{remaining || "GO"}</div>
        <p className="muted">Find the correct answer monster. Shoot fast.</p>
      </div>
    </div>
  );
}

function Podium({
  entries,
  onRestart,
  onEnd,
  isHost
}: {
  entries: LeaderboardEntry[];
  onRestart?: () => void;
  onEnd?: () => void;
  isHost: boolean;
}) {
  const top = entries.slice(0, 3);
  const first = top[0];
  const second = top[1];
  const third = top[2];

  return (
    <div className="podium-screen">
      <div className="spotlight spotlight-left" />
      <div className="spotlight spotlight-right" />
      <div className="podium-card">
        <p className="badge">Final Results</p>
        <h1>Champion Podium</h1>
        <div className="podium-stage">
          <div className="podium-place second">
            <div className="podium-player">{second?.name ?? "—"}</div>
            <div className="podium-score">{second?.score ?? 0}</div>
            <div className="podium-block">2</div>
          </div>
          <div className="podium-place first">
            <div className="podium-crown">👑</div>
            <div className="podium-player">{first?.name ?? "—"}</div>
            <div className="podium-score">{first?.score ?? 0}</div>
            <div className="podium-block">1</div>
          </div>
          <div className="podium-place third">
            <div className="podium-player">{third?.name ?? "—"}</div>
            <div className="podium-score">{third?.score ?? 0}</div>
            <div className="podium-block">3</div>
          </div>
        </div>

        <Leaderboard entries={entries} animated />

        {isHost && (
          <div className="button-row center-row">
            <button className="primary-btn" onClick={onRestart}>
              Restart Same Game
            </button>
            <button className="danger-btn" onClick={onEnd}>
              End Game For Everyone
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HostOverview({
  roomId,
  dashboard,
  selectedPlayerId,
  setSelectedPlayerId,
  countdownEndsAt,
  onRestart,
  onEnd
}: {
  roomId: string;
  dashboard: HostDashboard | null;
  selectedPlayerId: string | null;
  setSelectedPlayerId: (id: string) => void;
  countdownEndsAt: number | null;
  onRestart: () => void;
  onEnd: () => void;
}) {
  const players = dashboard?.players ?? [];
  const selected = players.find((p) => p.id === selectedPlayerId) ?? players[0] ?? null;

  return (
    <div className="host-dashboard-screen">
      <section className="host-topbar">
        <div>
          <p className="muted">Room Code</p>
          <div className="host-room-code">{roomId}</div>
        </div>
        <div>
          <p className="muted">Game Status</p>
          <div className="status-pill">{dashboard?.room.phase ?? "lobby"}</div>
        </div>
        <div className="button-row">
          <button className="secondary-btn" onClick={onRestart}>
            Restart Same Game
          </button>
          <button className="danger-btn" onClick={onEnd}>
            End Game
          </button>
        </div>
      </section>

      {dashboard?.room.phase === "countdown" && (
        <section className="countdown-strip">
          Countdown running. Players enter the arena when it hits GO.
          {countdownEndsAt && <span> Starts in {Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000))}s</span>}
        </section>
      )}

      <main className="host-grid">
        <section className="panel">
          <h2>Players</h2>
          <div className="player-grid">
            {players.length === 0 ? (
              <p className="muted">No players yet.</p>
            ) : (
              players.map((player) => (
                <button
                  key={player.id}
                  className={[
                    "player-tile",
                    selected?.id === player.id ? "selected-player" : "",
                    player.status === "finished" ? "finished-player" : ""
                  ].join(" ")}
                  onClick={() => setSelectedPlayerId(player.id)}
                >
                  <strong>{player.name}</strong>
                  <span>{player.status}</span>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${player.progressPct}%` }} />
                  </div>
                  <small>{player.currentQuestionIndex}/{player.totalQuestions} questions</small>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Individual Progress</h2>
          {selected ? (
            <div className="progress-detail">
              <h3>{selected.name}</h3>
              <p className="muted">Map: {maps[selected.mapId].title}</p>
              <div className="big-score">{selected.score}</div>
              <div className="stat-grid">
                <span>Correct <strong>{selected.correct}</strong></span>
                <span>Wrong <strong>{selected.wrong}</strong></span>
                <span>Deaths <strong>{selected.deaths}</strong></span>
                <span>Progress <strong>{selected.currentQuestionIndex}/{selected.totalQuestions}</strong></span>
              </div>
            </div>
          ) : (
            <p className="muted">Click a player to inspect progress.</p>
          )}
        </section>

        <section className="panel">
          <Leaderboard entries={dashboard?.leaderboard ?? []} animated />
        </section>
      </main>

      {dashboard?.room.phase === "podium" && dashboard.leaderboard.length > 0 && (
        <section className="mini-podium panel">
          <h2>Final Top 3</h2>
          <div className="mini-podium-row">
            {dashboard.leaderboard.slice(0, 3).map((entry, index) => (
              <div key={entry.id} className="mini-podium-card">
                <span>#{index + 1}</span>
                <strong>{entry.name}</strong>
                <small>{entry.score} pts</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>("landing");
  const [role, setRole] = useState<Role>(null);
  const [roomId, setRoomId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [mapId, setMapId] = useState<MapId>("village");
  const [deck, setDeck] = useState<Question[]>(initialDeck);
  const [player, setPlayer] = useState<Player | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [dashboard, setDashboard] = useState<HostDashboard | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const roleRef = useRef<Role>(role);
  const playerRef = useRef<Player | null>(player);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    function resetToHome(message?: string) {
      setMode("landing");
      setRole(null);
      setRoomId("");
      setJoinCode("");
      setPlayer(null);
      setLeaderboard([]);
      setDashboard(null);
      setSelectedPlayerId(null);
      setCountdownEndsAt(null);
      if (message) setToast(message);
    }

    function handleLeaderboard(entries: LeaderboardEntry[]) {
      setLeaderboard(entries);
    }

    function handleDashboard(nextDashboard: HostDashboard) {
      setDashboard(nextDashboard);
      if (!selectedPlayerId && nextDashboard.players[0]) {
        setSelectedPlayerId(nextDashboard.players[0].id);
      }
    }

    function handleGameCountdown(payload: { deck: Question[]; startsAt: number }) {
      setDeck(payload.deck);
      setCountdownEndsAt(payload.startsAt);

      if (roleRef.current === "host") {
        setMode("host-overview");
      }

      if (roleRef.current === "player") {
        setMode("countdown");
      }
    }

    function handleGameStarted(payload: { deck: Question[] }) {
      setDeck(payload.deck);
      setCountdownEndsAt(null);

      if (roleRef.current === "host") {
        setMode("host-overview");
      }

      if (roleRef.current === "player") {
        setMode("player-game");
      }
    }

    function handleGameFinished(payload: { leaderboard: LeaderboardEntry[] }) {
      setLeaderboard(payload.leaderboard);
      setCountdownEndsAt(null);
      setMode("podium");
    }

    function handleDeckUpdated(nextDeck: Question[]) {
      setDeck(nextDeck);
    }

    function handleHostDisconnected() {
      setToast("Host disconnected. The room is paused.");
    }

    function handleReturnHome(payload: { reason?: string }) {
      resetToHome(payload.reason ?? "Game ended.");
    }

    socket.on("leaderboard", handleLeaderboard);
    socket.on("host-dashboard", handleDashboard);
    socket.on("countdown-started", handleGameCountdown);
    socket.on("game-started", handleGameStarted);
    socket.on("game-finished", handleGameFinished);
    socket.on("deck-updated", handleDeckUpdated);
    socket.on("host-disconnected", handleHostDisconnected);
    socket.on("return-home", handleReturnHome);

    return () => {
      socket.off("leaderboard", handleLeaderboard);
      socket.off("host-dashboard", handleDashboard);
      socket.off("countdown-started", handleGameCountdown);
      socket.off("game-started", handleGameStarted);
      socket.off("game-finished", handleGameFinished);
      socket.off("deck-updated", handleDeckUpdated);
      socket.off("host-disconnected", handleHostDisconnected);
      socket.off("return-home", handleReturnHome);
    };
  }, [selectedPlayerId]);

  const currentQuestion =
    player && player.status !== "finished"
      ? deck[player.currentQuestionIndex]
      : null;

  const currentMap = maps[mapId];

  function createRoom() {
    socket.emit("create-room", { hostName: name || "Host", deck }, (response: any) => {
      if (!response.ok) {
        setToast(response.error ?? "Could not create room.");
        return;
      }

      setRole("host");
      setRoomId(response.room.id);
      setDeck(response.deck);
      setMode("host");
    });
  }

  function applyDeck(nextDeck: Question[]) {
    setDeck(nextDeck);
    setToast(`Question deck applied: ${nextDeck.length} questions loaded.`);

    if (roomId) {
      socket.emit("update-deck", { roomId, deck: nextDeck }, (response: any) => {
        if (!response.ok) {
          setToast(response.error ?? "Could not update deck.");
        } else {
          setToast(`Question deck saved for this room: ${nextDeck.length} questions.`);
        }
      });
    }
  }

  function joinRoom() {
    socket.emit(
      "join-room",
      {
        roomId: joinCode.trim().toUpperCase(),
        name: name || "Player",
        mapId
      },
      (response: any) => {
        if (!response.ok) {
          setToast(response.error ?? "Could not join room.");
          return;
        }

        setRole("player");
        setRoomId(response.room.id);
        setDeck(response.deck);
        setPlayer(response.player);
        setLeaderboard(response.leaderboard);
        setMode("lobby");
      }
    );
  }

  function startGame() {
    socket.emit("start-game", { roomId }, (response: any) => {
      if (!response.ok) {
        setToast(response.error ?? "Could not start game.");
      } else {
        setDashboard(response.dashboard);
        setMode("host-overview");
        setToast("Countdown started for all players.");
      }
    });
  }

  function restartGame() {
    socket.emit("restart-game", { roomId }, (response: any) => {
      if (!response.ok) {
        setToast(response.error ?? "Could not restart game.");
      } else {
        setDashboard(response.dashboard);
        setMode("host-overview");
        setToast("Restarting game. Countdown started.");
      }
    });
  }

  function endGame() {
    socket.emit("end-game", { roomId }, (response: any) => {
      if (!response.ok) {
        setToast(response.error ?? "Could not end game.");
      }
    });
  }

  function submitResult(result: {
    kind: "correct" | "wrong" | "killed" | "hazard";
    label: string;
    responseMs: number;
  }) {
    if (!player || !currentQuestion) return;

    const killed = result.kind === "killed" || result.kind === "hazard";
    const correct = result.kind === "correct";

    setToast(result.label);

    socket.emit(
      "answer-result",
      {
        roomId,
        playerId: player.id,
        questionId: currentQuestion.id,
        correct,
        killed,
        responseMs: result.responseMs
      },
      (response: any) => {
        if (!response.ok) {
          setToast(response.error ?? "Could not submit result.");
          return;
        }

        setPlayer(response.player);

        if (response.finished || response.player.status === "finished") {
          setMode("waiting");
          setToast("You finished. Waiting for other players...");
        } else {
          setTimeout(() => setToast(""), 900);
        }
      }
    );
  }

  if (mode === "countdown") {
    return <CountdownOverlay endsAt={countdownEndsAt} />;
  }

  if (mode === "waiting") {
    return (
      <div className="waiting-screen">
        <div className="waiting-card">
          <p className="badge">Finished</p>
          <h1>Waiting Room</h1>
          <p className="muted">
            You are done. The leaderboard will keep updating as other players finish.
          </p>
          <Leaderboard entries={leaderboard} animated />
        </div>
      </div>
    );
  }

  if (mode === "podium") {
    return (
      <Podium
        entries={leaderboard}
        isHost={role === "host"}
        onRestart={restartGame}
        onEnd={endGame}
      />
    );
  }

  if (mode === "host-overview") {
    return (
      <HostOverview
        roomId={roomId}
        dashboard={dashboard}
        selectedPlayerId={selectedPlayerId}
        setSelectedPlayerId={setSelectedPlayerId}
        countdownEndsAt={countdownEndsAt}
        onRestart={restartGame}
        onEnd={endGame}
      />
    );
  }

  if (mode === "player-game" && player && currentQuestion) {
    return (
      <div className="game-screen">
        <div className="game-hud">
          <h2>{currentMap.title}</h2>
          <div className="current-question">{currentQuestion.prompt}</div>
          <div className="hud-meta">
            <span className="badge">Player: {player.name}</span>
            <span className="badge">Score: {player.score}</span>
            <span className="badge">Question {player.currentQuestionIndex + 1}/{deck.length}</span>
            <span className="badge">WASD to move · Click to shoot</span>
          </div>
          <p className="muted">{currentMap.hazardLabel}</p>
        </div>
        <Leaderboard entries={leaderboard} floating />
        <div className="crosshair" />
        <GameCanvas
          key={`${currentQuestion.id}-${player.currentQuestionIndex}-${mapId}`}
          mapId={mapId}
          question={currentQuestion}
          onResult={submitResult}
        />
        {toast && <div className="event-toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="landing">
        <section className="hero-card">
          <h1>Quiz Shooter 3D</h1>
          <p>
            A multiplayer quiz game where each answer becomes a monster. Shoot the correct
            monster, dodge hazards, avoid civilians, and climb the leaderboard.
          </p>
          <div className="badge-row">
            <span className="badge">3D Arena</span>
            <span className="badge">Host + Players</span>
            <span className="badge">Live Leaderboard</span>
            <span className="badge">Independent Player Flow</span>
            <span className="badge">Village · Prison · Laser Tag</span>
          </div>
        </section>

        <section className="panel">
          {mode === "landing" && (
            <div className="form-stack">
              <h2>Start or Join</h2>
              <input
                className="input"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />

              <div className="button-row">
                <button className="primary-btn" onClick={createRoom}>
                  Host Game
                </button>
              </div>

              <hr style={{ width: "100%", borderColor: "rgba(148, 163, 184, 0.18)" }} />

              <input
                className="input"
                placeholder="Room code"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              />

              <select
                className="select"
                value={mapId}
                onChange={(event) => setMapId(event.target.value as MapId)}
              >
                <option value="village">Village Defense</option>
                <option value="prison">Prison Break Quiz</option>
                <option value="laser">Neon Monster Arena</option>
              </select>

              <button className="secondary-btn" onClick={joinRoom}>
                Join as Player
              </button>
              {toast && <p className="muted">{toast}</p>}
            </div>
          )}

          {mode === "host" && (
            <div className="form-stack">
              <h2>Host Room</h2>
              <div className="room-code">{roomId}</div>
              <p className="muted">
                Share this code with players. They can join without an account.
              </p>
              <DeckEditor onDeckChange={applyDeck} />
              <button className="primary-btn" onClick={startGame}>
                Start Game
              </button>
              <Leaderboard entries={leaderboard} />
              {toast && <p className="muted">{toast}</p>}
            </div>
          )}

          {mode === "lobby" && (
            <div className="form-stack">
              <h2>Waiting for Host</h2>
              <p>
                Room <strong>{roomId}</strong>
              </p>
              <p className="muted">
                You joined as <strong>{name || "Player"}</strong> on the{" "}
                <strong>{maps[mapId].title}</strong> map.
              </p>
              <p className="muted">The game will not start until the host presses Start Game.</p>
              <Leaderboard entries={leaderboard} />
              {toast && <p className="muted">{toast}</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
