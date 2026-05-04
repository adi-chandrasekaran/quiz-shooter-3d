import type { LeaderboardEntry } from "../types";

export default function Leaderboard({
  entries,
  floating = false,
  animated = false
}: {
  entries: LeaderboardEntry[];
  floating?: boolean;
  animated?: boolean;
}) {
  return (
    <div
      className={[
        "leaderboard",
        floating ? "floating-leaderboard" : "",
        animated ? "animated-leaderboard" : ""
      ].join(" ")}
    >
      <h3>Leaderboard</h3>
      {entries.length === 0 ? (
        <p className="muted">No players yet.</p>
      ) : (
        entries.map((entry, index) => (
          <div className="leader-row" key={entry.id}>
            <span>
              {index + 1}. {entry.name}
              <br />
              <small className="muted">
                ✅ {entry.correct} · ❌ {entry.wrong} · 💀 {entry.deaths}
                {entry.progress ? ` · ${entry.progress}` : ""}
                {entry.status === "finished" ? " · DONE" : ""}
              </small>
            </span>
            <strong>{entry.score}</strong>
          </div>
        ))
      )}
    </div>
  );
}
